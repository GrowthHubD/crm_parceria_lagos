import { NextRequest, NextResponse } from "next/server";

// Rotas públicas que não precisam de autenticação
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/_next",
  "/favicon.ico",
  "/images",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Deixar passar rotas públicas
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Verificar cookie de sessão do better-auth
  // O better-auth usa o cookie "better-auth.session_token" por padrão
  const sessionToken =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|api/|favicon.ico|images|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.js$|.*\\.css$).*)",
  ],
};
