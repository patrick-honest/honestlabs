import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const ALLOWED_DOMAINS = ["honest.co.id", "honestbank.com"];

// Build provider list — only include Google when credentials are configured
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: any[] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

providers.push(
  CredentialsProvider({
    name: "Admin Login",
    credentials: {
      username: { label: "Username", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      // Admin login
      if (
        credentials?.username === "Administrator" &&
        credentials?.password === "Honest0123"
      ) {
        return {
          id: "admin",
          name: "Administrator",
          email: "patrick@honestbank.com",
        };
      }
      // General team login
      if (
        credentials?.username === "Honest User" &&
        credentials?.password === "Honest0123"
      ) {
        return {
          id: "honest-user",
          name: "Honest User",
          email: "user@honest.co.id",
        };
      }
      return null;
    },
  })
);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "demo-secret-not-for-production",
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      // Skip domain check for credentials provider
      if (account?.provider === "credentials") return true;

      const email = profile?.email ?? "";
      const domain = email.split("@")[1];
      return ALLOWED_DOMAINS.includes(domain);
    },
    async session({ session, token }) {
      // Ensure email is always available in session
      if (token?.email) {
        session.user = session.user || {};
        session.user.email = token.email;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
