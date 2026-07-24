import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isEmailAllowed, isAdminEmail } from "@/lib/access";
import type { Role } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // Allow any Google account to register. Access is gated afterwards by the
    // `approved` flag (auto-approved for the company domain/allowlist, otherwise
    // pending admin approval) and by the `active` flag.
    async signIn({ user }) {
      return !!user.email;
    },
    // Expose id, role, active and approved on the session.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: Role }).role ?? "VIEWER";
        session.user.active = (user as { active?: boolean }).active ?? true;
        session.user.approved = (user as { approved?: boolean }).approved ?? false;
      }
      return session;
    },
  },
  events: {
    // On first sign-up: auto-approve company-domain/allowlist emails; promote
    // ADMIN_EMAILS to ADMIN. External accounts stay pending (approved = false).
    async createUser({ user }) {
      const admin = isAdminEmail(user.email);
      const approved = admin || isEmailAllowed(user.email);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          approved,
          ...(admin ? { role: "ADMIN" as Role } : {}),
        },
      });
    },
    // En cada inicio de sesión reevalúa la promoción a ADMIN (por si se añade
    // el correo a ADMIN_EMAILS después de que el usuario ya existiera).
    async signIn({ user }) {
      if (user?.id && isAdminEmail(user.email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN", approved: true },
        });
      }
    },
  },
});
