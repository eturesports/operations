import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

type ActingUser = Session["user"] | null | undefined;

export async function logAudit(
  user: ActingUser,
  e: {
    entity: string;
    entityId?: string | null;
    entityName?: string | null;
    action: string;
    summary?: string | null;
    changes?: unknown;
  }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entity: e.entity,
        entityId: e.entityId ?? null,
        entityName: e.entityName ?? null,
        action: e.action,
        summary: e.summary ?? null,
        changes:
          e.changes === undefined || e.changes === null
            ? undefined
            : (e.changes as object),
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
      },
    });
  } catch (err) {
    // Never let audit logging break a mutation.
    console.error("audit log failed", err);
  }
}

// Returns { field: { from, to } } for fields that actually changed, or undefined.
export function diffFields(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
  fields: string[]
): Record<string, { from: unknown; to: unknown }> | undefined {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of fields) {
    if (f in patch) {
      const from = before[f] ?? null;
      const to = patch[f] ?? null;
      if (from !== to) changes[f] = { from, to };
    }
  }
  return Object.keys(changes).length ? changes : undefined;
}
