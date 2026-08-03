// Which conference a university competes in, and the canonical list of names.
//
// Two jobs, one source. A conference title is won *in* a conference, so a
// championship recorded against a university needs to know which one; and the
// same list is what the university selector offers, so a name gets typed
// correctly once instead of arriving as "St. Micheals" and never matching
// anything again.
//
// The data is the NCAA member directory, kept at
// `scripts/university-conferences.json` with its source and retrieval date.
// It is the institution's primary conference: a few schools play men's soccer
// in a different one, which is why a championship stores the conference name
// it was won in rather than looking it up fresh every time.

import raw from "@/data/ncaa-conferences.json";
import { uniKey } from "@/lib/universities";

type Entry = [conference: string, division: string];
const DATA = raw as unknown as Record<string, Entry>;

/** Names matched the way universities are matched everywhere else. */
const byKey = new Map<string, { name: string; conference: string; division: string }>();
for (const [name, [conference, division]] of Object.entries(DATA)) {
  const k = uniKey(name);
  if (!byKey.has(k)) byKey.set(k, { name, conference: conference.trim(), division });
}

/** Every NCAA institution, for the selector. Sorted, so the list reads. */
export const NCAA_UNIVERSITIES: string[] = Object.keys(DATA).sort((a, b) =>
  a.localeCompare(b)
);

/**
 * The conference a university competes in, or null when we do not know —
 * JUCO and NAIA schools are not in the NCAA directory at all, and neither is
 * a misspelling.
 */
export function conferenceFor(university: string | null | undefined): string | null {
  if (!university) return null;
  return byKey.get(uniKey(university))?.conference ?? null;
}

/** The directory's own spelling, for showing what a typed name resolved to. */
export function officialNameFor(university: string | null | undefined): string | null {
  if (!university) return null;
  return byKey.get(uniKey(university))?.name ?? null;
}
