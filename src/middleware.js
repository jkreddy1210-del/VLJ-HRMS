import { NextResponse } from "next/server";

export function middleware(request) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname === "/build-info.json" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Strip legacy cache-bust param from any URL (server-side, before React loads).
  if (url.searchParams.has("_cb")) {
    url.searchParams.delete("_cb");
    return NextResponse.redirect(url);
  }

  // Root domain → login (no client-side redirect, no query params).
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
