import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/sign-in", "/sign-up"];
const authenticatedSetupRoutes = ["/onboarding"];
const authCookieNames = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isAuthenticatedSetupRoute = authenticatedSetupRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const hasAuthCookie = authCookieNames.some((name) => request.cookies.has(name));

  if (!isPublicRoute && !isAuthenticatedSetupRoute && !hasAuthCookie) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthenticatedSetupRoute && !hasAuthCookie) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isPublicRoute && hasAuthCookie) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
