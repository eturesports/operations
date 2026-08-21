import { Prisma } from "@prisma/client";

/**
 * Reading season stats from a database that may not have them yet.
 *
 * The migration that creates `ProfileSeasonStat` has to be run by hand, and
 * between shipping the code and running it there is a window where every
 * query that includes the table fails outright — which is what happened: the
 * players page and the profiles endpoint both went to a 500 rather than
 * simply showing no season breakdown.
 *
 * A feature is allowed to be missing. It is not allowed to take the page with
 * it. So the query is attempted with the season rows and, if the table is not
 * there, run again without them.
 *
 * The cost is one failed query per request until the migration runs, and
 * nothing at all afterwards. Nothing is cached: a cached "not there" would
 * outlive the migration on every warm instance, and the whole point is that
 * this heals itself the moment the table appears.
 */
export function isMissingSeasonTable(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    // P2021: the table does not exist in the current database.
    e.code === "P2021" &&
    String((e.meta as { table?: string } | undefined)?.table ?? "").includes("ProfileSeasonStat")
  );
}

/**
 * @param withSeasons the query as it should be
 * @param withoutSeasons the same query with the season rows left out
 */
export async function tolerateMissingSeasons<T>(
  withSeasons: () => Promise<T>,
  withoutSeasons: () => Promise<T>
): Promise<T> {
  try {
    return await withSeasons();
  } catch (e) {
    if (isMissingSeasonTable(e)) return withoutSeasons();
    throw e;
  }
}
