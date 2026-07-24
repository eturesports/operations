import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { ShowcaseClient, type ShowcaseItem } from "./ShowcaseClient";

export const dynamic = "force-dynamic";

export default async function ShowcasePage() {
  const session = await requireSession();
  const editable = canEdit(session.user.role);

  const items = await prisma.showcaseUniversity.findMany({
    orderBy: [{ year: "desc" }, { order: "asc" }, { name: "asc" }],
    select: { id: true, year: true, name: true, logoUrl: true, order: true },
  });

  return (
    <ShowcaseClient
      editable={editable}
      items={items as ShowcaseItem[]}
    />
  );
}
