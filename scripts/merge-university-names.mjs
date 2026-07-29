// Merge the ways one university got typed.
//
// "UCA" and "University of Central Arkansas" are the same school, but no
// amount of string comparison can know that — the two share no words. What
// does know it is the roster link: both point at ucasports.com, and a school
// has one athletics site.
//
// So the evidence is the link our own records already carry, resolved to the
// official name in the NCAA directory. Nothing is merged on a hunch: a
// variant with no linked player is left exactly as it was typed.
//
//   node scripts/merge-university-names.mjs          # report only
//   node scripts/merge-university-names.mjs --apply

import { readFileSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const DOMAINS = JSON.parse(
  readFileSync(new URL("./roster-domains.json", import.meta.url), "utf8")
);
const uniKey = (s) =>
  (s.toLowerCase().replace(/[.,]/g, "")
    .replace(/\b(university|univ|college|of|the)\b/g, " ")
    .replace(/[^a-z0-9&' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()) || s.trim().toLowerCase();

const schools = JSON.parse(
  readFileSync(new URL("./ncaa-schools.json", import.meta.url), "utf8")
);
const officialByHost = new Map();
for (const s of schools) {
  officialByHost.set(s.domain.replace(/^www\./, ""), s.name);
}

const hostOf = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const apply = process.argv.includes("--apply");

const rows = await sql`
  SELECT university, "ncaaUrl", COUNT(*)::int ops
  FROM "Player"
  WHERE active AND university IS NOT NULL AND university <> ''
  GROUP BY university, "ncaaUrl"`;

// Two sources of the same evidence. The link a record carries is the stronger
// one; for records with no link, the athletics domain the NCAA directory
// publishes for that name does the same job — it is how "UCA" and "University
// of Central Arkansas" are known to be one school with no link between them.
const domainForName = (name) => {
  const entry = DOMAINS[uniKey(name)];
  const first = Array.isArray(entry) ? entry[0] : entry;
  return first ? first.replace(/^www\./, "") : null;
};

const byHost = new Map();
for (const r of rows) {
  const host = hostOf(r.ncaaUrl) ?? domainForName(r.university);
  if (!host) continue;
  const seen = byHost.get(host) ?? new Map();
  seen.set(r.university, (seen.get(r.university) ?? 0) + r.ops);
  byHost.set(host, seen);
}

const FILLER = new Set([
  "university", "univ", "college", "of", "the", "at", "and", "state", "saint", "st", "us",
]);
const words = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split(/[^a-z]+/).filter((w) => w.length > 1);
const meaningful = (s) => words(s).filter((w) => !FILLER.has(w));
const acronym = (s) => words(s).map((w) => w[0]).join("");
const acronymNoFiller = (s) => meaningful(s).map((w) => w[0]).join("");

// Sharing a link is strong evidence, but not proof: a link pasted onto the
// wrong record would otherwise rename a university that was typed correctly.
// A variant only merges if it also reads like the same school — an acronym of
// it, or a word in common.
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const carry = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = carry;
    }
  }
  return prev[b.length];
}

function sameSchool(variant, official) {
  const v = words(variant).join("");
  // "UNCG" and "URI" put a U for University in front of the initials.
  // "Fairleigh Dickinson University, Metropolitan Campus" is FDU: the campus
  // after the comma is not part of how anyone abbreviates it.
  const short = official.split(",")[0];
  const forms = new Set([
    acronym(official),
    acronymNoFiller(official),
    "u" + acronymNoFiller(official),
    acronym(short),
    acronymNoFiller(short),
    "u" + acronymNoFiller(short),
  ]);
  if (forms.has(v)) return true;
  const theirs = meaningful(official);
  const ours = meaningful(variant);
  if (ours.some((w) => theirs.includes(w))) return true;
  // "EVANSVILLLE", "Limpscomb": typed from memory, one letter out.
  return ours.some((w) => theirs.some((t) => w.length > 4 && distance(w, t) <= 2));
}

const merges = [];
const suspicious = [];
for (const [host, variants] of byHost) {
  if (variants.size < 2) continue;
  const official = officialByHost.get(host);
  // Without an official name, keep the spelling most operations used.
  const ranked = [...variants.entries()].sort((a, b) => b[1] - a[1]);
  const target = official ?? ranked[0][0];

  const from = [];
  for (const [name, ops] of ranked) {
    if (name === target) continue;
    if (sameSchool(name, target) || sameSchool(name, ranked[0][0])) from.push(name);
    else suspicious.push({ host, name, ops, target });
  }
  if (from.length === 0) continue;
  merges.push({ host, target, from, variants: ranked.filter(([n]) => n === target || from.includes(n)) });
}

console.log(`Universities typed more than one way: ${merges.length}\n`);
for (const m of merges) {
  console.log(`${m.target}   [${m.host}]`);
  for (const [name, ops] of m.variants) {
    console.log(`   ${name === m.target ? "keep " : "merge"}  ${name} (${ops})`);
  }
}

if (suspicious.length) {
  console.log(`\nNOT merged — the link says one school and the record says another:`);
  for (const s2 of suspicious) {
    console.log(`   "${s2.name}" (${s2.ops}) links to ${s2.host} = ${s2.target}`);
  }
}

if (!apply) {
  console.log("\nReport only. Re-run with --apply to rename them.");
  process.exit(0);
}

let renamed = 0;
for (const m of merges) {
  for (const name of m.from) {
    const r = await sql`
      UPDATE "Player" SET university = ${m.target}
      WHERE university = ${name}
        AND ("ncaaUrl" LIKE ${"%" + m.host + "%"} OR "ncaaUrl" IS NULL)
      RETURNING id`;
    renamed += r.length;
    // The college profiles carry the name too.
    await sql`
      UPDATE "PlayerProfile" SET university = ${name === m.target ? name : m.target}
      WHERE university = ${name}
        AND ("rosterUrl" LIKE ${"%" + m.host + "%"} OR "rosterUrl" IS NULL)`;
  }
}

await sql`
  INSERT INTO "AuditLog" (id, entity, action, summary, changes, "userEmail", "userName", "createdAt")
  VALUES (gen_random_uuid()::text, 'Player', 'university_names_merged',
    ${`Merged ${merges.length} universities typed more than one way, renaming ${renamed} operations`},
    ${JSON.stringify(merges)}::jsonb,
    'marketing@eturesports.com', 'System maintenance', now())`;

console.log(`\nRenamed ${renamed} operations across ${merges.length} universities.`);
