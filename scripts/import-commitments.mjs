// Read the marketing department's commitments export and add the 25/26
// operations that are not in the database yet.
//
// The file is a task list, not a clean table: names arrive in capitals, with
// trailing spaces, misspelled twice, and the same player appears under two
// task ids. Universities are written the way a person types them in a hurry —
// "SNHU", "FDU", "quinnipiac university", "Limpscomb". So the report comes
// first and nothing is written without --apply.
//
//   node --env-file=.env scripts/import-commitments.mjs
//   node --env-file=.env scripts/import-commitments.mjs --apply
//
import { readFileSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const apply = process.argv.includes("--apply");
const SEASON = "25/26";
const CSV = process.argv.includes("--csv")
  ? process.argv[process.argv.indexOf("--csv") + 1]
  : "scripts/_commitments.csv";

// --- reading the file ----------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Compare people the way a person would: ignore case, accents and spacing. */
const nameKey = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Names in the file that are the same person already in the database,
 *  written another way. Each was found by comparing against the database and
 *  checked one by one — a nickname, a missing space, two transposed letters:
 *
 *    ZainThompson        -> Zain Thompson        (25/26, NJIT)
 *    Jonah Ferrnate      -> Jonah Ferrante       (25/26, Suffolk)
 *    Nathaniel Pi-Sunyer -> Nathaniel Pi-Suyner  (25/26, SNHU)
 *    Santiago Arruffat   -> Santi Arrufat        (25/26, Brescia)
 *    Alen Kapetanovic    -> Alen Kapetanovik     (23/24 + 24/25, George Mason)
 *
 *  Without these five the import would have created a second record for each,
 *  which is how a database of 733 operations starts counting 738.
 */
const NAME_ALIASES = {
  "zainthompson": "Zain Thompson",
  "jonah ferrnate": "Jonah Ferrante",
  "nathaniel pi sunyer": "Nathaniel Pi-Suyner",
  "santiago arruffat": "Santi Arrufat",
  "alen kapetanovic": "Alen Kapetanovik",
};

/** The database writes people in title case, accents kept. */
function titleCase(s) {
  const raw = s.replace(/\s+/g, " ").trim();
  // Already mixed case — the person who typed it meant it that way.
  if (/[a-zà-ÿ]/.test(raw) && /[A-ZÀ-Þ]/.test(raw)) return raw;
  return raw
    .toLowerCase()
    .replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_, p, c) => p + c.toUpperCase());
}

/** Universities as typed → the name the database already uses. Only the ones
 *  this file actually contains, each checked against the directory. */
const UNI_ALIASES = {
  "snhu": "Southern New Hampshire University",
  "fdu": "Fairleigh Dickinson University, Metropolitan Campus",
  "uic": "University of Illinois Chicago",
  "university of illinois chicago uic": "University of Illinois Chicago",
  "fgcu": "Florida Gulf Coast University",
  "shu": "Sacred Heart University",
  "sacred heart univeristy": "Sacred Heart University",
  "siue": "Southern Illinois University Edwardsville",
  "njit": "New Jersey Institute of Technology",
  "ucla": "University of California, Los Angeles",
  "cal berkeley": "University of California, Berkeley",
  "uc irvine": "University of California, Irvine",
  "umbc": "University of Maryland, Baltimore County",
  "unk": "University of Nebraska at Kearney",
  "fpu": "Franklin Pierce University",
  "usao": "University of Science and Arts of Oklahoma",
  "vcu": "Virginia Commonwealth University",
  "university of bryant": "Bryant University",
  "bryant univeristy": "Bryant University",
  "saint michaels": "Saint Michael's College",
  "saint michaels university": "Saint Michael's College",
  "st marys university": "St. Mary's University",
  "mount st marys": "Mount St. Mary's University",
  "mount st mary s university": "Mount St. Mary's University",
  "mount st mary s": "Mount St. Mary's University",
  "limpscomb": "Lipscomb University",
  "lipscomb university": "Lipscomb University",
  "quinnipiac university": "Quinnipiac University",
  "gardner webb": "Gardner-Webb University",
  "central connecticut": "Central Connecticut State University",
  "evansville": "University of Evansville",
  "evansville university": "University of Evansville",
  "coastal carolina": "Coastal Carolina University",
  "northwestern": "Northwestern University",
  "bowling green": "Bowling Green State University",
  "oregon state": "Oregon State University",
  "longwood": "Longwood University",
  "manhattan": "Manhattan University",
  "missouri state": "Missouri State University",
  "presbyterian": "Presbyterian College",
  "emory and henry": "Emory & Henry University",
  "emory henry": "Emory & Henry University",
  "gannon": "Gannon University",
  "unlv": "University of Nevada, Las Vegas",
  "tulsa": "University of Tulsa",
  "embry riddle": "Embry-Riddle Aeronautical University",
  "nova southeastern": "Nova Southeastern University",
  "anderson university": "Anderson University (South Carolina)",
  "post university": "POST UNIVERSITY",
  "le moyne": "Le Moyne College",
  "felician unversity": "Felician University",
  "drexel dragons": "Drexel University",
  "saint johns university": "St. John's University",
  "davis and elkins college": "Davis & Elkins College",
  "colorado school of mines": "Colorado School of Mines",
  "suny new paltz": "SUNY New Paltz",
  "american international": "American International College",
  "american international college": "American International College",
  "new haven university": "University of New Haven",
  "william penn": "William Penn University",
  "shawnee university": "Shawnee State University",
  "southern idaho": "College of Southern Idaho",
  "union college": "Union College",
  "indian university columbus": "Indiana University Columbus",
  "university of texas tyler": "University of Texas at Tyler",
  "christian brothers": "Christian Brothers University",
  "holy cross college naia": "Holy Cross College",
  "sewanee university": "Sewanee: The University of the South",
  "carl sandburg": "Carl Sandburg College",
  "blinn college": "Blinn College",
  "iowa western": "Iowa Western",
  "pellissippi college": "Pellissippi State Community College",
  "coker college": "Coker University",
  "brescia university": "Brescia University",
  "tabor college": "Tabor College",
  "hendrix college": "Hendrix College",
  "colby college": "Colby College",
  "bradley university": "Bradley University",
  "sacramento state": "California State University, Sacramento",
  "north greenville university": "North Greenville University",
  "florida southern college": "Florida Southern College",
  "florida tech university": "Florida Institute of Technology",
  "barry university": "Barry University",
  "guilford college": "Guilford College",
  "erskine college": "Erskine College",
  "bethel university": "Bethel University",
  "widener university": "Widener University",
  "suffolk university": "Suffolk University",
  "lincoln memorial university": "Lincoln Memorial University",
  "franklin pierce university": "Franklin Pierce University",
  "heidelberg university": "Heidelberg University",
  "bentley university": "Bentley University",
  "bucknell university": "Bucknell University",
  "depaul university": "DePaul University",
  "creighton university": "Creighton University",
  "providence college": "Providence College",
  "mercer university": "Mercer University",
  "university of kentucky": "University of Kentucky",
  "university of washington": "University of Washington",
  "university of portland": "University of Portland",
  "university of alabama at birmingham": "University of Alabama at Birmingham",
  "university of st thomas": "University of St. Thomas",
  "university of northwestern ohio": "University of Northwestern Ohio",
  "east tennessee state university": "East Tennessee State University",
  "northern kentucky university": "Northern Kentucky University",
  "long island university": "Long Island University",
  "university of evansville": "University of Evansville",
  "gardner webb university": "Gardner-Webb University",
  "central connecticut state university": "Central Connecticut State University",
  "missouri state university": "Missouri State University",
};

const uniKey = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,'’]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Same school, however it was typed — the key the app itself matches on. */
const schoolKey = (s) =>
  uniKey(s).replace(/\b(university|univ|college|of|the|at|and)\b/g, " ").replace(/\s+/g, " ").trim();

function canonicalUni(raw) {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return UNI_ALIASES[uniKey(t)] ?? t.replace(/\s+/g, " ");
}

// --- the file ------------------------------------------------------------

const rows = parseCsv(readFileSync(CSV, "utf8")).slice(1); // drop the header
const entries = rows.map(([taskId, name, uni]) => {
  const raw = (name ?? "").trim();
  const known = NAME_ALIASES[nameKey(raw)];
  return {
    taskId,
    rawName: raw,
    // Under the spelling the database already uses, so the record joins the
    // person who is there rather than starting a second one.
    name: known ?? titleCase(raw),
    key: nameKey(known ?? raw),
    aliased: Boolean(known),
    rawUni: (uni ?? "").trim(),
    university: canonicalUni(uni),
  };
});

// The same player under two task ids, or spelled two ways.
const seen = new Map();
const dupes = [];
for (const e of entries) {
  if (!e.key) continue;
  if (seen.has(e.key)) { dupes.push([seen.get(e.key), e]); continue; }
  seen.set(e.key, e);
}
const unique = [...seen.values()];
const noUni = unique.filter((e) => !e.university);

// --- against the database ------------------------------------------------

const players = await sql`SELECT id, name, university, season, program FROM "Player"`;
const dbThisSeason = new Map();
const dbAnySeason = new Map();
for (const p of players) {
  const k = nameKey(p.name);
  if (p.season === SEASON) dbThisSeason.set(k, p);
  if (!dbAnySeason.has(k)) dbAnySeason.set(k, []);
  dbAnySeason.get(k).push(p);
}

// Spell a university the way the database already spells it. The file shouts
// ("BRYANT UNIVERSITY") and abbreviates, and a new spelling of a school that
// is already in there is exactly the mess the merge script had to undo.
const dbUniByKey = new Map();
for (const p of players) {
  if (!p.university) continue;
  const k = schoolKey(p.university);
  if (!dbUniByKey.has(k)) dbUniByKey.set(k, p.university);
}
for (const e of unique) {
  if (!e.university) continue;
  const known = dbUniByKey.get(schoolKey(e.university));
  if (known) e.university = known;
}

const already = [], transfers = [], brandNew = [];
for (const e of unique) {
  const here = dbThisSeason.get(e.key);
  if (here) { already.push({ e, p: here }); continue; }
  const elsewhere = dbAnySeason.get(e.key);
  if (elsewhere?.length) transfers.push({ e, prior: elsewhere });
  else brandNew.push(e);
}

// Did the university move for someone already recorded this season?
const uniMismatch = already.filter(
  ({ e, p }) => e.university && schoolKey(e.university) !== schoolKey(p.university ?? "")
);

const money = (n) => (n == null ? "—" : `$${n.toLocaleString("en-US")}`);
console.log(`CSV rows: ${entries.length}  ->  ${unique.length} distinct people`);
console.log(`database already holds ${dbThisSeason.size} operations for ${SEASON}\n`);

const aliased = entries.filter((e) => e.aliased);
console.log(`— written differently from the database (${aliased.length}), matched to the existing person —`);
for (const e of aliased) console.log(`   "${e.rawName}" -> ${e.name}`);

console.log(`\n— the same person twice in the file (${dupes.length}) —`);
for (const [a, b] of dupes)
  console.log(`   "${a.rawName}" (${a.rawUni || "—"})   ==   "${b.rawName}" (${b.rawUni || "—"})`);

console.log(`\n— no university given (${noUni.length}), imported without one —`);
for (const e of noUni) console.log(`   ${e.name}`);

console.log(`\n— already in ${SEASON} (${already.length}) — nothing to do`);

console.log(`\n— recorded this season at a DIFFERENT university (${uniMismatch.length}) — left alone`);
for (const { e, p } of uniMismatch)
  console.log(`   ${e.name.padEnd(26)} database: ${String(p.university).padEnd(38)} file: ${e.university}`);

console.log(`\n— in the database but not for ${SEASON} (${transfers.length}) — a new operation each`);
for (const { e, prior } of transfers)
  console.log(`   ${e.name.padEnd(26)} ${String(e.university ?? "—").padEnd(38)} previously ${prior.map((p) => `${p.season}@${p.university}`).join(", ")}`);

console.log(`\n— not in the database at all (${brandNew.length}) —`);
for (const e of brandNew)
  console.log(`   ${e.name.padEnd(26)} ${e.university ?? "—"}`);

const toCreate = [...transfers.map((t) => t.e), ...brandNew];
console.log(`\n=> would create ${toCreate.length} operations for ${SEASON}`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to create them.");
  process.exit(0);
}

// --- writing -------------------------------------------------------------

const [sport] = await sql`SELECT id FROM "Sport" WHERE code = 'MSOC'`;
let created = 0;
for (const e of toCreate) {
  // One person across their operations: reuse the person if the name is known.
  const prior = dbAnySeason.get(e.key)?.[0];
  let personId = null;
  if (prior) {
    const [row] = await sql`SELECT "personId" FROM "Player" WHERE id = ${prior.id}`;
    personId = row?.personId ?? null;
  }
  if (!personId) {
    const [person] = await sql`INSERT INTO "Person" (id, name, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${e.name}, now(), now()) RETURNING id`;
    personId = person.id;
  }

  const [player] = await sql`
    INSERT INTO "Player" (id, "sportId", "personId", name, university, season, active,
                          graduated, "nationalChampion", "fullRide", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${sport.id}, ${personId}, ${e.name},
            ${e.university}, ${SEASON}, true, false, false, false, now(), now())
    RETURNING id`;

  // Every operation carries a college profile — that is where the money, the
  // division and the roster link live once they are known.
  if (e.university) {
    await sql`
      INSERT INTO "PlayerProfile" (id, "playerId", university, season, current,
                                   "fullRide", "conferenceChampion", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${player.id}, ${e.university}, ${SEASON},
              false, false, false, now(), now())`;
  }
  created++;
}

await sql`
  INSERT INTO "AuditLog" (id, "userId", "userName", entity, "entityId", "entityName",
                          action, summary, changes, "createdAt")
  VALUES (gen_random_uuid()::text, NULL, 'script', 'Player', NULL, NULL, 'import_commitments',
          ${`Added ${created} ${SEASON} operations from the marketing commitments export`},
          ${JSON.stringify(toCreate.map((e) => ({ name: e.name, university: e.university, taskId: e.taskId })))}::jsonb,
          now())`;

console.log(`\nCreated ${created} operations for ${SEASON}.`);
