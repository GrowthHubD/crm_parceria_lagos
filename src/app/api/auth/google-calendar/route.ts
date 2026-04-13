import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildCalendarOAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = buildCalendarOAuthUrl(session.user.id);
  return NextResponse.redirect(url);
}
