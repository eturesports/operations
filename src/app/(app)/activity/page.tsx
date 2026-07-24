import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ActivityClient, type LogRow } from "./ActivityClient";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await requireAdmin();
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const rows: LogRow[] = logs.map((l) => ({
    id: l.id,
    entity: l.entity,
    entityName: l.entityName,
    action: l.action,
    summary: l.summary,
    changes: l.changes ? JSON.stringify(l.changes) : null,
    userEmail: l.userEmail,
    userName: l.userName,
    createdAt: l.createdAt.toISOString(),
  }));

  return <ActivityClient rows={rows} />;
}
