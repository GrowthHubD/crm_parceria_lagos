import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userGoogleIntegration } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${APP_URL}/configuracoes?calendar=error`);
  }

  const redirectUri = `${APP_URL}/api/auth/google-calendar/callback`;


  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${APP_URL}/configuracoes?calendar=error`);
  }

  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    // User already authorized — no refresh token returned (prompt=consent should prevent this)
    return NextResponse.redirect(`${APP_URL}/configuracoes?calendar=no_refresh_token`);
  }

  // Fetch Google account email
  let googleEmail: string | null = null;
  if (tokens.access_token) {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json();
      googleEmail = info.email ?? null;
    }
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  // Upsert integration row
  const existing = await db
    .select({ id: userGoogleIntegration.id })
    .from(userGoogleIntegration)
    .where(eq(userGoogleIntegration.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userGoogleIntegration)
      .set({
        googleEmail,
        googleRefreshToken: tokens.refresh_token,
        googleAccessToken: tokens.access_token ?? null,
        googleAccessTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(userGoogleIntegration.userId, userId));
  } else {
    await db.insert(userGoogleIntegration).values({
      userId,
      googleEmail,
      googleRefreshToken: tokens.refresh_token,
      googleAccessToken: tokens.access_token ?? null,
      googleAccessTokenExpiresAt: expiresAt,
    });
  }

  return NextResponse.redirect(`${APP_URL}/configuracoes?calendar=connected`);
}
