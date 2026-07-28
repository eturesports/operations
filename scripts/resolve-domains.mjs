// Work out each university's athletics website automatically.
//
// Filling in players' roster links needs one thing per university: the domain
// its athletics site lives on. The NCAA's own member directory publishes it
// (`athleticWebUrl`) for every school in Divisions I, II and III, which is a
// far better source than guessing or scraping a search engine.
//
// Our records name schools the way staff typed them — "SNHU", "MARSH HILL",
// "Rhode Island" — so names are matched loosely, and anything that could mean
// two different schools is left for a human instead of being guessed.
//
// A name that could mean two schools is not thrown away: every candidate is
// kept, and the roster crawl decides between them by looking for our players
// on each one. Evidence beats guessing.
//
//   node scripts/resolve-domains.mjs          # report only
//   node scripts/resolve-domains.mjs --apply  # merge into roster-domains.json

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);
const F = (u, o = {}) => undiciFetch(u, { ...o, dispatcher: agent });

const DOMAINS_FILE = new URL("./roster-domains.json", import.meta.url);
const CACHE_FILE = new URL("./ncaa-schools.json", import.meta.url);

const uniKey = (s) =>
  (s.toLowerCase().replace(/[.,]/g, "")
    .replace(/\b(university|univ|college|of|the)\b/g, " ")
    .replace(/[^a-z0-9&' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()) || s.trim().toLowerCase();

// Words that carry no identity: every school has them, so they neither
// confirm a match nor rule one out.
const FILLER = new Set(["university", "college", "of", "the", "at", "and", "saint", "st"]);
const words = (s) =>
  s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
const meaningful = (s) => words(s).filter((w) => !FILLER.has(w));

// Levenshtein, for names typed from memory.
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const carry = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = carry;
    }
  }
  return prev[b.length];
}

// "SNHU" → southern new hampshire university
const initials = (s) => words(s).map((w) => w[0]).join("");
const initialsNoFiller = (s) => meaningful(s).map((w) => w[0]).join("");

// Names that no amount of string comparison will resolve: local shorthand,
// a school outside the NCAA directory, or a typo we know the intent of.
const ALIASES = {
  "nc state": "North Carolina State University",
  "n c state": "North Carolina State University",
  "missisipi": "Mississippi Christian University", // renamed from Mississippi College
  "marsh hill": "Mars Hill University",
  "ole miss": "University of Mississippi",
  "penn state": "Pennsylvania State University",
  "pitt": "University of Pittsburgh",
  "uconn": "University of Connecticut",
  "umass": "University of Massachusetts, Amherst",
  "usc": "University of Southern California",
  "ucla": "University of California, Los Angeles",
  "byu": "Brigham Young University",
  "smu": "Southern Methodist University",
  "tcu": "Texas Christian University",
  "vcu": "Virginia Commonwealth University",
  "ucf": "University of Central Florida",
  "usf": "University of South Florida",
  "fiu": "Florida International University",
  "fau": "Florida Atlantic University",
  "unlv": "University of Nevada, Las Vegas",
  "uic": "University of Illinois at Chicago",
  "uab": "University of Alabama at Birmingham",
  "utep": "University of Texas at El Paso",
  "utsa": "University of Texas at San Antonio",
  "unc": "University of North Carolina at Chapel Hill",
  "uncw": "University of North Carolina at Wilmington",
  "uncg": "University of North Carolina at Greensboro",
  "unca": "University of North Carolina at Asheville",
  "umbc": "University of Maryland, Baltimore County",
  "uMES": "University of Maryland Eastern Shore",
  "snhu": "Southern New Hampshire University",
  "uca": "University of Central Arkansas",
  "aic": "American International College",
  "lmu": "Loyola Marymount University",
  "slu": "Saint Louis University",
  "vmi": "Virginia Military Institute",
  "citadel": "The Citadel",
  "villanova": "Villanova University",
  "gw": "George Washington University",
  "gmu": "George Mason University",
  "odu": "Old Dominion University",
  "etsu": "East Tennessee State University",
  "mtsu": "Middle Tennessee State University",
  "fgcu": "Florida Gulf Coast University",
  "ipfw": "Purdue University Fort Wayne",
  "iupui": "Indiana University-Purdue University Indianapolis",
  "sf austin": "Stephen F. Austin State University",
  "cal poly": "California Polytechnic State University",
  "cal": "University of California, Berkeley",
  "sdsu": "San Diego State University",
  "sjsu": "San Jose State University",
  "csun": "California State University, Northridge",
  "csu bakersfield": "California State University, Bakersfield",
  "ucsb": "University of California, Santa Barbara",
  "ucsd": "University of California, San Diego",
  "uci": "University of California, Irvine",
  "ucr": "University of California, Riverside",
  "ucd": "University of California, Davis",
  "wvu": "West Virginia University",
  "lsu": "Louisiana State University",
  "west point": "United States Military Academy",
  "army": "United States Military Academy",
  "navy": "United States Naval Academy",
  "metro state": "Metropolitan State University of Denver",
  "cal berkley": "University of California, Berkeley",
  "florida tech": "Florida Institute of Technology",
  "leron rhyne": "Lenoir-Rhyne University",
  "virginia tech": "Virginia Polytechnic Institute and State University",
  "uri": "University of Rhode Island",
  "ucwv": "University of Charleston (West Virginia)",
  "charleston wv": "University of Charleston (West Virginia)",
  "umass lowell": "University of Massachusetts Lowell",
  "csu pueblo": "Colorado State University Pueblo",
  "sec": null, // not a school
};

// The directory is typed by hand too: "//lrtrojans.com", trailing paths,
// stray capitals.
const cleanDomain = (raw) =>
  String(raw)
    .trim()
    .replace(/^https?:/i, "")
    .replace(/^\/+/, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

async function ncaaSchools() {
  if (existsSync(CACHE_FILE)) {
    const cached = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    if (cached.length > 500) return cached;
  }
  const all = [];
  for (const division of ["I", "II", "III"]) {
    const res = await F(
      `https://web3.ncaa.org/directory/api/directory/memberList?type=12&division=${division}`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) }
    );
    if (!res.ok) throw new Error(`NCAA directory answered ${res.status} for division ${division}`);
    for (const row of await res.json()) {
      if (!row.athleticWebUrl) continue;
      all.push({
        name: row.nameOfficial,
        division,
        domain: cleanDomain(row.athleticWebUrl),
      });
    }
  }
  writeFileSync(CACHE_FILE, JSON.stringify(all, null, 1));
  return all;
}

// Returns every school the given text could plausibly mean.
function candidates(name, schools) {
  const key = uniKey(name);
  const alias = ALIASES[key] ?? ALIASES[name.toLowerCase().trim()];
  if (alias === null) return [];
  const target = alias ?? name;

  const byExact = schools.filter((s) => uniKey(s.name) === uniKey(target));
  if (byExact.length) return byExact;

  const ours = meaningful(target);
  if (!ours.length) return [];

  // Every meaningful word we have appears in the school's name. "Rhode
  // Island" matching two different schools stays ambiguous on purpose.
  const contained = schools.filter((s) => {
    const theirs = new Set(meaningful(s.name));
    return ours.every((w) => theirs.has(w));
  });
  if (contained.length) return contained;

  // An acronym typed in place of the name.
  if (/^[a-z]{2,6}$/.test(key) && !key.includes(" ")) {
    const acro = schools.filter(
      (s) => initials(s.name) === key || initialsNoFiller(s.name) === key
    );
    if (acro.length) return acro;
  }

  // A misspelling: "WINTRHOP", "SIENNA", "Farleigh Dickinson". Allow a couple
  // of wrong letters, more forgiving on longer names.
  const mine = uniKey(target);
  const budget = mine.length >= 6 ? 2 : 1;
  const near = schools
    .map((s) => ({ s, d: distance(mine, uniKey(s.name)) }))
    .filter((x) => x.d <= budget)
    .sort((a, b) => a.d - b.d);
  if (near.length) return near.map((x) => x.s);

  // Last resort: a word so rare in the directory that it names the school on
  // its own — "Iona Gaels" is only ever going to be Iona.
  const rare = ours
    .map((w) => ({ w, hits: schools.filter((s) => meaningful(s.name).includes(w)) }))
    .filter((x) => x.hits.length > 0 && x.hits.length <= 3)
    .sort((a, b) => a.hits.length - b.hits.length)[0];
  if (rare) return rare.hits;

  return [];
}

const known = JSON.parse(readFileSync(DOMAINS_FILE, "utf8"));
const knownKeys = new Set(Object.keys(known).map(uniKey));

const rows = await sql`
  SELECT university, COUNT(*)::int AS missing
  FROM "Player"
  WHERE active AND "ncaaUrl" IS NULL AND university IS NOT NULL AND university <> ''
  GROUP BY university
  ORDER BY missing DESC
`;

const schools = await ncaaSchools();
console.log(`NCAA directory: ${schools.length} schools with an athletics site\n`);

// More than four candidates means the name is too vague to be worth
// crawling every school it could be.
const MAX_CANDIDATES = 4;

const resolved = {};
const unresolved = [];
let covered = 0;
let single = 0;
let several = 0;

for (const row of rows) {
  const key = uniKey(row.university);
  if (knownKeys.has(key) || resolved[key]) continue;
  const hits = candidates(row.university, schools).slice(0, MAX_CANDIDATES);
  if (!hits.length) {
    unresolved.push([row.university, row.missing]);
    continue;
  }
  const domains = [...new Set(hits.map((h) => h.domain))];
  resolved[key] = domains.length === 1 ? domains[0] : domains;
  covered += row.missing;
  if (domains.length === 1) single += 1;
  else {
    several += 1;
    console.log(`   ? ${row.university} (${row.missing}) → ${hits.map((h) => h.name).join(" | ")}`);
  }
}

console.log(`\nResolved ${Object.keys(resolved).length} new universities (${covered} players)`);
console.log(`   ${single} with one school, ${several} left for the roster crawl to decide`);

const stillMissing = unresolved.reduce((a, [, n]) => a + n, 0);
console.log(`\nNot in the NCAA directory (${unresolved.length} universities, ${stillMissing} players):`);
for (const [u, n] of unresolved.slice(0, 40)) console.log(`   ${n}\t${u}`);

if (!process.argv.includes("--apply")) {
  console.log("\nReport only. Re-run with --apply to merge into roster-domains.json.");
  process.exit(0);
}

const merged = {};
for (const k of [...new Set([...Object.keys(known), ...Object.keys(resolved)])].sort()) {
  merged[k] = resolved[k] ?? known[k];
}
writeFileSync(DOMAINS_FILE, JSON.stringify(merged, null, 2) + "\n");
console.log(`\nroster-domains.json now holds ${Object.keys(merged).length} universities.`);
