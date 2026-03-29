/**
 * Edge-compatible NextAuth config (no native module imports).
 * Used by middleware.js which runs on the Edge runtime.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminRoute = nextUrl.pathname.startsWith('/admin');
      if (isAdminRoute) return isLoggedIn;
      return true;
    },
  },
  providers: [],
};
