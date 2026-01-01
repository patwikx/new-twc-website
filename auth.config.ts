import type { NextAuthConfig } from "next-auth"
 
export const authConfig = {
  pages: {
    signIn: '/auth/login',
  },
  providers: [], // Providers added in auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard'); // Example protected route
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn && nextUrl.pathname === '/login') {
         // Redirect logged-in users away from login page
        return Response.redirect(new URL('/', nextUrl));
      }
      return true;
    },
    session({ session, user, token }) {
        if (session.user) {
            session.user.id = user?.id || token?.sub as string;
            // session.user.role = user.role; // Needs role in types
        }
        return session;
    }
  },
} satisfies NextAuthConfig;
