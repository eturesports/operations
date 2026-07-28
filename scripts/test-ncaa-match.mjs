import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const F = (u) => (agent ? undiciFetch(u, { dispatcher: agent }) : fetch(u));

function norm(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}
const toInt = (v) => { const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10); return Number.isFinite(n) ? n : undefined; };

async function pages(cat) {
  const rows = []; let page = 1, pages = 1;
  do {
    const url = `https://ncaa-api.henrygd.me/stats/soccer-men/d1/current/individual/${cat}${page > 1 ? `/p${page}` : ""}`;
    const res = await F(url); if (!res.ok) break;
    const j = await res.json(); pages = j.pages ?? 1;
    for (const d of j.data ?? []) rows.push(d);
    page++;
  } while (page <= pages);
  return rows;
}

// Build NCAA leaderboard index
const out = await pages(4);
const gk = await pages(10);
const board = new Map();
for (const d of out) board.set(norm(d.Name), { name: d.Name, team: d.Team, games: toInt(d.Games), goals: toInt(d.Goals), assists: toInt(d.Assists), points: toInt(d.Points) });
for (const d of gk) {
  const k = norm(d.Name); const e = board.get(k) ?? { name: d.Name, team: d.Team };
  e.saves = toInt(d.Saves); e.minutes = toInt(d["Goalie Min. Plyd"]); e.games = e.games ?? toInt(d.Games);
  board.set(k, e);
}
console.log(`NCAA D1 men leaderboard: ${board.size} distinct players (outfield ${out.length} + GK ${gk.length}).`);

// DB players
const players = await sql`SELECT name, university FROM "Player" ORDER BY name`;
console.log(`DB players: ${players.length}. Cross-matching by name…\n`);

let hits = 0;
for (const p of players) {
  const m = board.get(norm(p.name));
  if (m) {
    hits++;
    const line = [m.games!=null?`GP ${m.games}`:null, m.goals!=null?`G ${m.goals}`:null, m.assists!=null?`A ${m.assists}`:null, m.points!=null?`Pts ${m.points}`:null, m.saves!=null?`Sv ${m.saves}`:null, m.minutes!=null?`Min ${m.minutes}`:null].filter(Boolean).join("  ");
    console.log(`✅ ${p.name}  (DB: ${p.university ?? "—"})  →  NCAA ${m.name} · ${m.team}\n     ${line}`);
  }
}
console.log(`\nMatches found: ${hits} of ${players.length} DB players currently rank in NCAA D1 men leaderboards.`);
