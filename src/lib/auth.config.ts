import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the Auth.js config: no Prisma, no Credentials provider.
// Used by middleware.ts for route protection. The full config (lib/auth.ts)
// extends this with the adapter and providers for use in server
// components/actions and the route handler.
export const authConfig = {
  pages: {
    signIn: "/signin",
    error: "/error",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const publicPaths = ["/", "/signin", "/signup", "/error"];
      const isPublicPath =
        publicPaths.includes(pathname) || pathname.startsWith("/invite/");

      if (isPublicPath) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
