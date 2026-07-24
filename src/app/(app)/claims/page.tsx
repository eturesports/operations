import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { getSuggestedClaims, claimFooter } from "@/lib/claims";
import { ClaimsClient, type SavedClaim, type Suggested } from "./ClaimsClient";

export const dynamic = "force-dynamic";

export default async function ClaimsPage() {
  const session = await requireSession();
  const editable = canEdit(session.user.role);

  const [claims, suggestedRaw] = await Promise.all([
    prisma.claim.findMany({ orderBy: { updatedAt: "desc" } }),
    getSuggestedClaims(),
  ]);

  const saved: SavedClaim[] = claims.map((c) => ({
    id: c.id,
    text: c.text,
    metric: c.metric,
    definition: c.definition,
    population: c.population,
    period: c.period,
    denominator: c.denominator,
    source: c.source,
    coverage: c.coverage,
    authorizedUse: c.authorizedUse,
    owner: c.owner,
    status: c.status,
    asOf: c.asOf ? c.asOf.toISOString() : null,
    footer: claimFooter({
      asOf: c.asOf,
      population: c.population,
      period: c.period,
      definition: c.definition,
      coverage: c.coverage,
    }),
  }));

  const suggested: Suggested[] = suggestedRaw.map((s) => ({
    ...s,
    footer: claimFooter({
      asOf: new Date(),
      population: s.population,
      period: s.period,
      definition: s.definition,
      coverage: s.coverage,
    }),
  }));

  return <ClaimsClient editable={editable} saved={saved} suggested={suggested} />;
}
