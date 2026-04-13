/**
 * Google Calendar helper — per-user OAuth2 tokens.
 *
 * Each user must go through the OAuth flow at /api/auth/google-calendar
 * to store their refresh token in `user_google_integration`.
 *
 * Required env vars (same OAuth app as Drive):
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL  (e.g. https://your-domain.com)
 */

import { db } from "@/lib/db";
import { userGoogleIntegration } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ── Token management ─────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  return { accessToken: data.access_token as string, expiresAt };
}

/**
 * Get a valid access token for a user. Uses cached token if still valid,
 * otherwise refreshes and persists the new one.
 */
export async function getUserCalendarToken(userId: string): Promise<string> {
  const [integration] = await db
    .select()
    .from(userGoogleIntegration)
    .where(eq(userGoogleIntegration.userId, userId))
    .limit(1);

  if (!integration) {
    throw new Error("Google Calendar not connected. Visit /configuracoes to connect.");
  }

  // Return cached token if still valid (with 60s buffer)
  if (
    integration.googleAccessToken &&
    integration.googleAccessTokenExpiresAt &&
    integration.googleAccessTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return integration.googleAccessToken;
  }

  // Refresh
  const { accessToken, expiresAt } = await refreshAccessToken(integration.googleRefreshToken);

  await db
    .update(userGoogleIntegration)
    .set({ googleAccessToken: accessToken, googleAccessTokenExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(userGoogleIntegration.userId, userId));

  return accessToken;
}

// ── Calendar event operations ─────────────────────────────────────────────────

export interface CalendarTaskEvent {
  title: string;
  description?: string | null;
  dueDate: string; // YYYY-MM-DD
  priority?: string;
}

function buildEventBody(task: CalendarTaskEvent) {
  return {
    summary: task.title,
    description: [
      task.description ?? "",
      task.priority ? `Prioridade: ${task.priority}` : "",
    ].filter(Boolean).join("\n"),
    start: { date: task.dueDate },
    end: { date: task.dueDate },
  };
}

export async function createCalendarEvent(
  userId: string,
  calendarId: string,
  task: CalendarTaskEvent
): Promise<string | null> {
  try {
    const token = await getUserCalendarToken(userId);
    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody(task)),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id as string;
  } catch {
    return null; // Calendar sync is best-effort — don't break task creation
  }
}

export async function updateCalendarEvent(
  userId: string,
  calendarId: string,
  eventId: string,
  task: CalendarTaskEvent
): Promise<void> {
  try {
    const token = await getUserCalendarToken(userId);
    await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody(task)),
    });
  } catch {
    // Best-effort
  }
}

export async function deleteCalendarEvent(
  userId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  try {
    const token = await getUserCalendarToken(userId);
    await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort
  }
}

export async function listCalendarEvents(
  userId: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const token = await getUserCalendarToken(userId);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as CalendarEvent[];
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  htmlLink?: string;
  colorId?: string;
}

// ── OAuth URL builder ─────────────────────────────────────────────────────────

export function buildCalendarOAuthUrl(userId: string): string {
  const base = "https://accounts.google.com/o/oauth2/v2/auth";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/google-calendar/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });

  return `${base}?${params}`;
}
