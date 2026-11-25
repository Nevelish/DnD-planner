import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { cache } from "react";

import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { credentialsSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/auth.config";
import {
  clearLoginFailures,
  clientIp,
  loginRetryAfterMs,
  recordLoginFailure,
} from "@/lib/loginRateLimit";

/** Too many failed sign-ins for this email or IP; the form shows a wait message. */
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

/**
 * The account's current standing, read fresh on every request (and only once
 * per request, however many times the session is looked at). Sessions are
 * JWTs that last 30 days, so without this a disabled account, a reset
 * password or a removed admin role wouldn't take effect until the user
 * happened to sign in again.
 */
const currentAccount = cache((userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, disabled: true, sessionVersion: true },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? [
          Discord({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            // Discord added an `iss` parameter to OAuth callbacks on Oct 14
            // 2026 (RFC 9207). Auth.js's built-in Discord provider doesn't
            // set an issuer, so it falls back to a placeholder and rejects
            // Discord's real one — https://github.com/nextauthjs/next-auth/pull/12694
            issuer: "https://discord.com",
          }),
        ]
      : []),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Rate limited here rather than in the sign-in form, so posting
      // straight to /api/auth/callback/credentials is limited too.
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const ip = clientIp(request?.headers);
        if (loginRetryAfterMs(email, ip) > 0) throw new TooManyAttempts();

        const user = await prisma.user.findUnique({ where: { email } });
        const isValid =
          !!user?.passwordHash && !user.disabled && (await bcrypt.compare(password, user.passwordHash));
        if (!user || !isValid) {
          recordLoginFailure(email, ip);
          return null;
        }
        clearLoginFailures(email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.id) return true;

      // Credentials sign-ins are already rejected for disabled accounts in
      // authorize() above; this also covers Discord, which has no such gate.
      // Note: for a brand-new OAuth signup, the adapter hasn't created the
      // User row yet at this point, so dbUser is null here — that's fine,
      // a user that doesn't exist yet can't be disabled or need promoting.
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, disabled: true },
      });
      if (dbUser?.disabled) return false;

      // Self-hosted bootstrap: whoever first successfully signs in becomes
      // the admin, so there's no separate setup step or env var needed.
      // A no-op once any admin exists.
      if (dbUser && dbUser.role !== "ADMIN") {
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
        if (adminCount === 0) {
          await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      if (!token.id) return token;

      const account = await currentAccount(token.id as string);
      // Deleted or disabled since signing in: the session ends here.
      if (!account || account.disabled) return null;
      if (user) {
        // Fresh sign-in: remember which "version" of the account it's for.
        token.sessionVersion = account.sessionVersion;
      } else if ((token.sessionVersion ?? 0) !== account.sessionVersion) {
        // The password was changed or reset after this sign-in.
        return null;
      }
      // Re-read every time, so adding or removing admin takes effect now.
      token.role = account.role;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole | undefined) ?? "USER";
      }
      return session;
    },
  },
  events: {
    // Fires once the adapter has created/linked the account, so the User
    // row is guaranteed to exist — unlike signIn(), which for a brand-new
    // OAuth signup runs before that row is created. Captures the Discord
    // user ID automatically so @mentions on session proposed/cancelled
    // Discord posts work without the user copying it in from Account
    // settings. The discordUserId: null filter keeps this from overwriting
    // a value already set (e.g. entered manually).
    async linkAccount({ user, account }) {
      if (account.provider !== "discord" || !user.id) return;
      await prisma.user.updateMany({
        where: { id: user.id, discordUserId: null },
        data: { discordUserId: account.providerAccountId },
      });
    },
  },
});
