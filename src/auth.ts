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
    // Bloquea el acceso de correos no autorizados antes de crear la sesión.
    async signIn({ user }) {
      return isEmailAllowed(user.email);
    },
    // Expone id, role y estado activo en la sesión.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: Role }).role ?? "VIEWER";
        session.user.active = (user as { active?: boolean }).active ?? true;
      }
      return session;
    },
  },
  events: {
    // Al crear el usuario, si su correo está en ADMIN_EMAILS lo hace ADMIN.
    async createUser({ user }) {
      if (isAdminEmail(user.email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
    // En cada inicio de sesión reevalúa la promoción a ADMIN (por si se añade
    // el correo a ADMIN_EMAILS después de que el usuario ya existiera).
    async signIn({ user }) {
      if (user?.id && isAdminEmail(user.email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
  },
});
