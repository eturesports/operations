// Fill in players' NCAA roster links automatically.
//
// Given a map of university → athletics domain, this downloads each team's
// roster page once, pulls out every player's link, and matches them against
// our records by name. Only writes a link where exactly one player on that
// roster matches, so an ambiguous name is left for a human.
//
//   node scripts/link-rosters.mjs            # dry run, shows what it would do
//   node scripts/link-rosters.mjs --apply    # writes

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);
const F = (u, o = {}) => undiciFetch(u, { ...o, dispatcher: agent });

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const DOMAINS = JSON.parse(readFileSync(new URL("./roster-domains.json", import.meta.url), "utf8"));

const uniKey = (s) =>
  (s.toLowerCase().replace(/[.,]/g, "")
    .replace(/\b(university|univ|college|of|the)\b/g, " ")
    .replace(/[^a-z0-9&' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()) || s.trim().toLowerCase();

const tokens = (s) =>
  new Set(
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .split(/[^a-z]+/).filter((w) => w.length > 1)
  );

// Athletics sites mangle accents into their slugs: "Javier Solá" becomes
// "javier-sol-mart-nez". A truncated stem still identifies the name.
const sameWord = (a, b) =>
  a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

// Every part of the shorter name must appear in the longer one. Returns how
// many parts matched, because one shared part is far weaker evidence than two:
// a record holding only "Cristobal" would otherwise match any Cristobal on the
// roster, and a wrong link would credit someone else's stats to our player.
function nameMatch(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter((w) => [...B].some((x) => sameWord(w, x))).length;
  return shared === Math.min(A.size, B.size) ? shared : 0;
}

// Most of our players have already left, so the current roster alone finds
// very few of them. Past seasons are fetched too — the bio pages they link to
// stay live long after the player has gone.
const SEASONS_BACK = 8;

// Hosts that appear on every athletics page and are never the school's own.
const OFF_SITE =
  /facebook|twitter|x\.com|instagram|youtube|linkedin|tiktok|google|apple|adobe|cloudflare|jquery|gstatic|doubleclick|sidearmsports|prestosports|flosports|smugmug|vimeo|spotify|issuu|wufoo|evenue|ticket|ncaa\.(com|org)|w3\.org|schema\.org/i;

async function rosterLinks(domain) {
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  const host = base.replace(/^https?:\/\//, "");
  const now = new Date().getFullYear();
  const paths = ["/sports/mens-soccer/roster"];
  for (let y = now; y > now - SEASONS_BACK; y--) {
    paths.push(`/sports/mens-soccer/roster/${y}`);
  }
  // PrestoSports, the other platform small colleges use, files rosters by
  // academic year: /sports/msoc/2021-22/roster. It serves old seasons
  // straight from the URL, which is exactly what our leavers need.
  const prestoPaths = [];
  for (let y = now; y > now - SEASONS_BACK; y--) {
    prestoPaths.push(`/sports/msoc/${y}-${String((y + 1) % 100).padStart(2, "0")}/roster`);
  }

  const out = [];
  const seenHref = new Set();

  const read = async (url) => {
    try {
      const res = await F(url, {
        headers: { "user-agent": UA, accept: "text/html" },
        signal: AbortSignal.timeout(20_000),
      });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };

  const harvest = (html) => {
    // Sidearm: /roster/slug/1234   ·   WMT: /roster/player/slug
    const re = /href="(\/sports\/[a-z-]+\/roster\/(?:player\/)?[a-z0-9-]+(?:\/\d+)?)"/g;
    for (const m of html.matchAll(re)) {
      const href = m[1];
      if (/\/roster\/(season|player)?$/.test(href)) continue;
      if (/\/roster\/\d{4}$/.test(href)) continue; // a season link, not a player
      const slug = href.replace(/\/\d+$/, "").split("/").pop();
      if (!slug || slug === "player" || seenHref.has(href)) continue;
      seenHref.add(href);
      out.push({ url: base + href, slug, host });
    }
    // Presto: /sports/msoc/2021-22/bios/ward_carson_9244
    for (const m of html.matchAll(/href="(\/sports\/msoc\/[\d-]+\/bios\/[^"?#]+)"/g)) {
      const href = m[1];
      if (seenHref.has(href)) continue;
      seenHref.add(href);
      // The trailing four characters are an id, not part of the name.
      const slug = href.split("/").pop().replace(/_[a-z0-9]{4}$/i, "").replace(/_/g, "-");
      out.push({ url: base + href, slug, host });
    }
  };

  await Promise.all(
    paths.map(async (path) => {
      const html = await read(base + path);
      if (html) harvest(html);
    })
  );

  if (!out.length) {
    await Promise.all(
      prestoPaths.map(async (path) => {
        const html = await read(base + path);
        if (html) harvest(html);
      })
    );
  }

  // Some sites file men's soccer under a different path. Ask the site itself
  // where its roster lives before giving up on it.
  let home = null;
  if (!out.length) {
    home = await read(base + "/");
    const link = home?.match(
      /href="(\/sports\/[a-z-]*soc[a-z-]*\/(?:[\d-]+\/)?roster[^"]*)"/i
    )?.[1];
    if (link) {
      // Once one season's URL is known, its neighbours follow the same shape.
      const seasons = new Set([link]);
      const year = link.match(/\/(\d{4})-(\d{2})\//);
      if (year) {
        for (let y = now; y > now - SEASONS_BACK; y--) {
          seasons.add(
            link.replace(
              /\/\d{4}-\d{2}\//,
              `/${y}-${String((y + 1) % 100).padStart(2, "0")}/`
            )
          );
        }
      }
      await Promise.all(
        [...seasons].map(async (path) => {
          const page = await read(base + path);
          if (page) harvest(page);
        })
      );
    }
  }

  // The NCAA directory sometimes lists the campus website rather than the
  // athletics one (Bentley, Guilford). The athletics site is normally linked
  // from the homepage, so follow the site's own outbound links.
  if (!out.length && home) {
    const bare = host.replace(/^www\./, "");
    const external = [
      ...new Set(
        [...home.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase())
      ),
    ].filter((h) => !OFF_SITE.test(h) && !h.endsWith(bare));

    for (const candidate of external.slice(0, 8)) {
      const page = await read(`https://${candidate}/sports/mens-soccer/roster`);
      if (page && /\/sports\/[a-z-]+\/roster\//.test(page)) {
        return rosterLinks(candidate);
      }
    }
  }
  return out;
}

const PROPOSAL = new URL("./roster-links-proposed.json", import.meta.url);
if (process.argv.includes("--from-file")) {
  if (!existsSync(PROPOSAL)) throw new Error("No proposal file — run the crawl first.");
  const { matched } = JSON.parse(readFileSync(PROPOSAL, "utf8"));
  if (!process.argv.includes("--apply")) {
    console.log(`${matched.length} links ready to write. Add --apply to write them.`);
    process.exit(0);
  }
  for (const m of matched) {
    await sql`UPDATE "Player" SET "ncaaUrl" = ${m.url} WHERE id = ${m.id} AND "ncaaUrl" IS NULL`;
  }
  await sql`
    INSERT INTO "AuditLog" (id, entity, action, summary, changes, "userEmail", "userName", "createdAt")
    VALUES (gen_random_uuid()::text, 'Player', 'roster_links_filled',
      ${`Filled college roster links for ${matched.length} players`},
      ${JSON.stringify({ count: matched.length, players: matched })}::jsonb,
      'marketing@eturesports.com', 'System maintenance', now())
  `;
  console.log(`Wrote ${matched.length} links; recorded in the audit log.`);
  process.exit(0);
}

const players = await sql`
  SELECT id, name, university FROM "Player"
  WHERE active AND "ncaaUrl" IS NULL AND university IS NOT NULL
`;

const byUni = new Map();
for (const p of players) {
  const k = uniKey(p.university);
  (byUni.get(k) ?? byUni.set(k, []).get(k)).push(p);
}

const apply = process.argv.includes("--apply");
const matched = [];
const weak = [];
const report = [];

for (const [key, entry] of Object.entries(DOMAINS)) {
  const ours = byUni.get(key);
  if (!ours?.length) continue;
  // A name like "PC" or "Rhode Island" can mean several schools. Rather than
  // pick one, read every candidate's roster: the school our player actually
  // appears on is the right one, and a name found on two of them stays
  // unlinked instead of being credited to a stranger.
  const domains = [].concat(entry);
  const rosters = await Promise.all(domains.map((d) => rosterLinks(d)));
  const roster = rosters.flat();
  if (!roster.length) {
    report.push(`  ✗ ${key} (${domains.join(", ")}) — roster page unreadable`);
    continue;
  }
  let hits = 0;
  for (const p of ours) {
    const scored = roster
      .map((r) => ({ r, score: nameMatch(r.slug.replace(/-/g, " "), p.name) }))
      .filter((x) => x.score > 0);
    if (!scored.length) continue;
    // The same player has one page per season, each with its own id. Those
    // are one person, not a clash — only different people are ambiguous.
    const people = new Set(scored.map((x) => `${x.r.host}|${x.r.slug}`));
    if (people.size !== 1) continue; // two different players match → for a human
    // Their most recent bio page: the highest id is the latest season.
    const only = scored.sort(
      (a, b) => (parseInt(b.r.url.match(/\/(\d+)$/)?.[1] ?? "0", 10)) -
                (parseInt(a.r.url.match(/\/(\d+)$/)?.[1] ?? "0", 10))
    )[0];
    const entry = { id: p.id, name: p.name, url: only.r.url, uni: p.university };
    if (only.score >= 2) {
      matched.push(entry);
      hits++;
    } else {
      weak.push(entry); // only one name part in common — needs eyes on it
    }
  }
  report.push(
    `  ${hits}/${ours.length} matched — ${key} (${domains.join(", ")}, ${roster.length} on roster)`
  );
}

console.log(report.join("\n"));
console.log(`\nConfident matches (two or more name parts): ${matched.length}`);
for (const m of matched.slice(0, 20)) console.log(`   ${m.name} → ${m.url}`);
if (matched.length > 20) console.log(`   … and ${matched.length - 20} more`);
console.log(`\nSingle-name matches held back for review: ${weak.length}`);
for (const w of weak) console.log(`   ${w.name} (${w.uni}) → ${w.url}`);

// The proposal is written out so it can be read in full before anything is
// saved, and applied later without crawling every athletics site again.
writeFileSync(
  new URL("./roster-links-proposed.json", import.meta.url),
  JSON.stringify({ matched, weak }, null, 1) + "\n"
);

if (!apply) {
  console.log("\nDry run — proposal written to scripts/roster-links-proposed.json.");
  console.log("Re-run with --apply (add --from-file to use the proposal as-is).");
  process.exit(0);
}

for (const m of matched) {
  await sql`UPDATE "Player" SET "ncaaUrl" = ${m.url} WHERE id = ${m.id} AND "ncaaUrl" IS NULL`;
}
await sql`
  INSERT INTO "AuditLog" (id, entity, action, summary, changes, "userEmail", "userName", "createdAt")
  VALUES (gen_random_uuid()::text, 'Player', 'roster_links_filled',
    ${`Filled NCAA roster links for ${matched.length} players`},
    ${JSON.stringify({ count: matched.length, players: matched })}::jsonb,
    'marketing@eturesports.com', 'System maintenance', now())
`;
console.log(`\nWrote ${matched.length} links; recorded in the audit log.`);
