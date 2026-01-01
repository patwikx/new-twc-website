import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { LoginSchema } from "@/schemas";
import { sendWelcomeEmail } from "@/lib/mail";
import { getUserByEmail } from "@/data/user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" }, // Use JWT for edge compatibility and simplicity
  ...authConfig,
  events: {
    async linkAccount({ user }) {
      // Mark email as verified for OAuth accounts
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() }
      });

      // Send welcome email for first OAuth login
      if (user.email) {
        await sendWelcomeEmail(user.email, user.name || "Guest");
      }
    }
  },
  callbacks: {
    async signIn({ user, account }) {
      // Allow OAuth providers
      if (account?.provider !== "credentials") return true;

      // Check if user email is verified for credentials login
      const existingUser = await getUserByEmail(user.email!);

      // If email is not verified, prevent sign in
      if (!existingUser?.emailVerified) return false;

      return true;
    },
    async session({ token, session }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }

      return session;
    },
    async jwt({ token }) {
      return token;
    }
  },
  providers: [
    Google,
    Credentials({
      async authorize(credentials) {
        const validatedFields = LoginSchema.safeParse(credentials);

        if (validatedFields.success) {
          const { email, password } = validatedFields.data;

          const user = await db.user.findUnique({ where: { email } });
          if (!user || !user.password) return null;

          const passwordsMatch = await bcrypt.compare(
            password,
            user.password
          );

          if (passwordsMatch) return user;
        }

        return null;
      }
    })
  ],
});
