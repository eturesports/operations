import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      active: boolean;
      approved: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}
