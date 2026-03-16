import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const ALLOWED_DOMAINS = ["honest.co.id", "honestbank.com"];

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Admin credentials login
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
        return null;
      },
    }),
  ],
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
