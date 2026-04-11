import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/races") ||
    pathname.startsWith("/groups");

  if (!req.auth && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (req.auth && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)" ],
};
