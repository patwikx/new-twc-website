import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import {
  DEFAULT_LOGIN_REDIRECT,
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
  publicRoutePrefixes,
  publicApiRoutes,
} from "@/routes";

const { auth } = NextAuth(authConfig);

/**
 * Check if a pathname matches any public route or prefix
 */
function isPublicPath(pathname: string): boolean {
  // Exact match for public routes
  if (publicRoutes.includes(pathname)) {
    return true;
  }
  
  // Prefix match for dynamic public routes
  for (const prefix of publicRoutePrefixes) {
    if (pathname.startsWith(prefix)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a pathname is a public API route
 */
function isPublicApiRoute(pathname: string): boolean {
  for (const route of publicApiRoutes) {
    if (pathname.startsWith(route)) {
      return true;
    }
  }
  return false;
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;

  // 1. Allow NextAuth API routes (authentication endpoints)
  if (pathname.startsWith(apiAuthPrefix)) {
    return;
  }

  // 2. Allow public API routes (webhooks, contact forms, etc.)
  if (isPublicApiRoute(pathname)) {
    return;
  }

  // 3. Handle auth routes (login, register, etc.)
  //    Redirect logged-in users away from auth pages
  if (authRoutes.includes(pathname)) {
    if (isLoggedIn) {
      return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
    }
    return;
  }

  // 4. Allow public routes without authentication
  if (isPublicPath(pathname)) {
    return;
  }

  // 5. Protect all other routes - redirect to login if not authenticated
  if (!isLoggedIn) {
    // Store the original URL to redirect back after login
    const callbackUrl = encodeURIComponent(pathname + nextUrl.search);
    return Response.redirect(
      new URL(`/auth/login?callbackUrl=${callbackUrl}`, nextUrl)
    );
  }

  // 6. User is authenticated, allow access
  return;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
