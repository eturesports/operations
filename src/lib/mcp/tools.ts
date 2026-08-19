import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { McpUser } from "./oauth";

/**
 * What an assistant can ask this database.
 *
 * Every tool here reads. There is no create, no update, no delete, and no
 * escape hatch that takes SQL — a model that misreads an instruction cannot
 * damage anything, because there is nothing here that writes. If that ever
 * changes, it changes deliberately, one tool at a time, with the audit log
 * wired in.
 *
 * The shapes are chosen for a reader that cannot scroll. Lists come back
 * narrow and capped; the full record is a second call, on purpose, so a
 * question about one player does not drag four hundred others through the
 * context window.
 */

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** shown to clients that support it; all of these are true here */
  annotations?: Record<string, unknown>;
  run: (args: Record<string, unknown>, user: McpUser) => Promise<unknown>;
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
const bool = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;
const int = (v: unknown, fallback: number, max: number): number => {
  const n = typeof v === "number" ? Math.floor(v) : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
};

/** The columns a list answer carries. Enough to recognise someone. */
const LIST_FIELDS = {
  id: true,
  name: true,
  university: true,
  season: true,
  division: true,
  program: true,
  scholarship: true,
  position: true,
  nationality: true,
  active: true,
  graduated: true,
  graduationYear: true,
} satisfies Prisma.PlayerSelect;

function playerWhere(a: Record<string, unknown>): Prisma.PlayerWhereInput {
  const where: Prisma.PlayerWhereInput = {};
  const and: Prisma.PlayerWhereInput[] = [];

  const q = str(a.query);
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { university: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { previousClub: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const uni = str(a.university);
  if (uni) and.push({ university: { contains: uni, mode: "insensitive" } });
  const season = str(a.season);
  if (season) and.push({ season });
  const division = str(a.division);
  if (division) and.push({ division: { contains: division, mode: "insensitive" } });
  const program = str(a.program);
  if (program) and.push({ program: { contains: program, mode: "insensitive" } });
  const nationality = str(a.nationality);
  if (nationality) and.push({ nationality: { contains: nationality, mode: "insensitive" } });
  const position = str(a.position);
  if (position) and.push({ position: { contains: position, mode: "insensitive" } });

  const graduated = bool(a.graduated);
  if (graduated !== undefined) and.push({ graduated });
  const champion = bool(a.nationalChampion);
  if (champion !== undefined) and.push({ nationalChampion: champion });
  const fullRide = bool(a.fullRide);
  if (fullRide !== undefined) and.push({ fullRide });

  // Archived records are excluded unless asked for: they are deliberately
  // outside every dashboard, and an assistant counting players should agree
  // with the app by default.
  const archived = bool(a.includeArchived);
  if (!archived) and.push({ active: true });

  // "Playing now" is a college profile marked current, not a column.
  const playing = bool(a.playingNow);
  if (playing === true) and.push({ profiles: { some: { current: true } } });
  if (playing === false) and.push({ profiles: { none: { current: true } } });

  if (and.length) where.AND = and;
  return where;
}

const PLAYER_FILTERS = {
  query: { type: "string", description: "Free text — matched against name, university, notes and previous club." },
  university: { type: "string", description: "Part of a university name, e.g. \"Providence\"." },
  season: { type: "string", description: "Exactly as stored, e.g. \"25/26\"." },
  division: { type: "string", description: "\"Division I\", \"Division II\", \"Division III\", \"NAIA\", \"JUCO\"." },
  program: { type: "string", description: "e.g. \"Becas EEUU\", \"Gap Year / Eture FC\"." },
  nationality: { type: "string" },
  position: { type: "string", description: "GK, DF, MF, FW." },
  playingNow: { type: "boolean", description: "On a college roster right now." },
  graduated: { type: "boolean" },
  fullRide: { type: "boolean", description: "Scholarship covers the whole cost." },
  nationalChampion: { type: "boolean" },
  includeArchived: {
    type: "boolean",
    description: "Archived records are excluded by default, matching every dashboard in the app.",
  },
} as const;

export const TOOLS: ToolDef[] = [
  {
    name: "search_players",
    title: "Search players",
    description:
      "Find players by any combination of name, university, season, division, programme, nationality, position and status. " +
      "Returns a compact row per player. One player can hold several rows — one per university they were placed at — so a " +
      "transfer appears twice, joined by the same person. Use get_player for the whole record.",
    inputSchema: {
      type: "object",
      properties: {
        ...PLAYER_FILTERS,
        limit: { type: "integer", description: "Up to 200. Default 50.", default: 50 },
      },
    },
    annotations: READ_ONLY,
    run: async (a) => {
      const where = playerWhere(a);
      const limit = int(a.limit, 50, 200);
      const [total, players] = await Promise.all([
        prisma.player.count({ where }),
        prisma.player.findMany({
          where,
          select: { ...LIST_FIELDS, profiles: { where: { current: true }, select: { university: true }, take: 1 } },
          orderBy: [{ name: "asc" }, { season: "desc" }],
          take: limit,
        }),
      ]);
      return {
        total,
        returned: players.length,
        truncated: total > players.length,
        players: players.map(({ profiles, ...p }) => ({
          ...p,
          playingNow: profiles.length > 0,
          playingAt: profiles[0]?.university ?? null,
        })),
      };
    },
  },

  {
    name: "get_player",
    title: "Get a player",
    description:
      "The whole record for one player: their details, every college profile with its scholarship and season statistics, " +
      "their achievements, and the rest of their career — the other records belonging to the same person, which is how a " +
      "transfer or a second signing is stored. Give an id, or a name to look up.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The player id, as returned by search_players." },
        name: { type: "string", description: "Used when no id is given. An exact name is best; a partial one is matched." },
      },
    },
    annotations: READ_ONLY,
    run: async (a) => {
      const id = str(a.id);
      const name = str(a.name);
      if (!id && !name) return { error: "Give an id or a name." };

      const player = await prisma.player.findFirst({
        where: id
          ? { id }
          : { name: { contains: name!, mode: "insensitive" } },
        include: {
          sport: { select: { code: true, name: true } },
          profiles: { orderBy: [{ current: "desc" }, { season: "desc" }] },
          achievements: { orderBy: { season: "desc" } },
        },
      });
      if (!player) return { error: `No player found for ${id ?? name}.` };

      // The rest of the career: the same human, at other universities.
      const career = player.personId
        ? await prisma.player.findMany({
            where: { personId: player.personId, id: { not: player.id } },
            select: LIST_FIELDS,
            orderBy: { season: "asc" },
          })
        : [];

      return {
        player,
        career: {
          otherRecords: career.length,
          note:
            career.length > 0
              ? "These are the same person at other universities — transfers and later signings."
              : player.personId
                ? "Only one record for this person."
                : "This record is not joined to a person, so any transfer of theirs would not be linked.",
          records: career,
        },
      };
    },
  },

  {
    name: "database_stats",
    title: "Counts and totals",
    description:
      "Aggregates over any filtered selection: how many operations and how many distinct people, the division split, " +
      "scholarship totals, how many are on a roster now, and the breakdown by season, programme and university.",
    inputSchema: { type: "object", properties: PLAYER_FILTERS },
    annotations: READ_ONLY,
    run: async (a) => {
      const where = playerWhere(a);
      const rows = await prisma.player.findMany({
        where,
        select: {
          personId: true,
          season: true,
          program: true,
          university: true,
          division: true,
          scholarship: true,
          fullRide: true,
          graduated: true,
          profiles: { where: { current: true }, select: { id: true }, take: 1 },
        },
      });

      const tally = (pick: (r: (typeof rows)[number]) => string | null) => {
        const m = new Map<string, number>();
        for (const r of rows) {
          const k = pick(r) ?? "(none)";
          m.set(k, (m.get(k) ?? 0) + 1);
        }
        return Object.fromEntries([...m].sort((x, y) => y[1] - x[1]));
      };

      const withMoney = rows.filter((r) => r.scholarship != null);
      const people = new Set(rows.map((r) => r.personId ?? `unlinked:${Math.random()}`));

      return {
        operations: rows.length,
        people: people.size,
        note: "An operation is one placement. One person can hold several — that is what a transfer is.",
        playingNow: rows.filter((r) => r.profiles.length > 0).length,
        graduated: rows.filter((r) => r.graduated).length,
        scholarships: {
          recorded: withMoney.length,
          totalUSD: withMoney.reduce((s, r) => s + (r.scholarship ?? 0), 0),
          averageUSD: withMoney.length
            ? Math.round(withMoney.reduce((s, r) => s + (r.scholarship ?? 0), 0) / withMoney.length)
            : null,
          fullRides: rows.filter((r) => r.fullRide).length,
          note: "Totals cover only the operations that have an amount recorded.",
        },
        byDivision: tally((r) => r.division),
        bySeason: tally((r) => r.season),
        byProgram: tally((r) => r.program),
        byUniversity: tally((r) => r.university),
      };
    },
  },

  {
    name: "list_universities",
    title: "Universities",
    description:
      "Every university in the database with how many players were placed there, their division, and how many are on the " +
      "roster right now. Optionally narrowed to one season.",
    inputSchema: {
      type: "object",
      properties: {
        season: { type: "string" },
        includeArchived: { type: "boolean" },
      },
    },
    annotations: READ_ONLY,
    run: async (a) => {
      const rows = await prisma.player.findMany({
        where: playerWhere(a),
        select: {
          university: true,
          division: true,
          scholarship: true,
          profiles: { where: { current: true }, select: { id: true }, take: 1 },
        },
      });
      const map = new Map<
        string,
        { university: string; division: string | null; players: number; playingNow: number; scholarshipUSD: number }
      >();
      for (const r of rows) {
        if (!r.university) continue;
        const cur = map.get(r.university) ?? {
          university: r.university,
          division: r.division,
          players: 0,
          playingNow: 0,
          scholarshipUSD: 0,
        };
        cur.players += 1;
        if (r.profiles.length) cur.playingNow += 1;
        cur.scholarshipUSD += r.scholarship ?? 0;
        cur.division ??= r.division;
        map.set(r.university, cur);
      }
      const universities = [...map.values()].sort((x, y) => y.players - x.players);
      return { count: universities.length, universities };
    },
  },

  {
    name: "list_seasons",
    title: "Seasons and programmes",
    description:
      "The values actually in use for season, division and programme, with counts. Call this before filtering, so a filter " +
      "matches what is stored rather than what it was assumed to be.",
    inputSchema: { type: "object", properties: {} },
    annotations: READ_ONLY,
    run: async () => {
      const rows = await prisma.player.findMany({
        where: { active: true },
        select: { season: true, division: true, program: true },
      });
      const tally = (pick: (r: (typeof rows)[number]) => string | null) => {
        const m = new Map<string, number>();
        for (const r of rows) {
          const k = pick(r);
          if (k) m.set(k, (m.get(k) ?? 0) + 1);
        }
        return Object.fromEntries([...m].sort((x, y) => y[1] - x[1]));
      };
      return {
        seasons: tally((r) => r.season),
        divisions: tally((r) => r.division),
        programs: tally((r) => r.program),
      };
    },
  },

  {
    name: "recent_changes",
    title: "What changed recently",
    description:
      "The audit trail: who changed what and when, newest first. Every edit made in the app is here, including bulk edits " +
      "and imports.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Up to 100. Default 25.", default: 25 },
        entity: { type: "string", description: "Player, User, ShowcaseUniversity…" },
      },
    },
    annotations: READ_ONLY,
    run: async (a) => {
      const entries = await prisma.auditLog.findMany({
        where: str(a.entity) ? { entity: str(a.entity) } : undefined,
        orderBy: { createdAt: "desc" },
        take: int(a.limit, 25, 100),
        select: {
          createdAt: true,
          entity: true,
          entityName: true,
          action: true,
          summary: true,
          userName: true,
          userEmail: true,
        },
      });
      return { count: entries.length, entries };
    },
  },
];

/**
 * `search` and `fetch`, which ChatGPT's connectors look for by name.
 *
 * They are the same two questions the tools above already answer — find
 * things, then read one — in the shape that integration expects: a list of
 * `{id, title, url}` and a document with a `text` body. Wrapping rather than
 * renaming means Claude still gets tools that say what they do.
 */
const CHATGPT_TOOLS: ToolDef[] = [
  {
    name: "search",
    title: "Search",
    description:
      "Search Eture Sports' players by free text. Returns matching records with an id to pass to fetch.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "What to look for." } },
      required: ["query"],
    },
    annotations: READ_ONLY,
    run: async (a, user) => {
      const found = (await TOOLS[0].run({ query: str(a.query), limit: 25 }, user)) as {
        players: { id: string; name: string; university: string | null; season: string | null }[];
      };
      return {
        results: found.players.map((p) => ({
          id: p.id,
          title: `${p.name} — ${p.university ?? "no university"}${p.season ? ` (${p.season})` : ""}`,
          url: `https://operations.eturesports.com/players?player=${p.id}`,
        })),
      };
    },
  },
  {
    name: "fetch",
    title: "Fetch",
    description: "Retrieve the full record for one player id returned by search.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "A player id from search." } },
      required: ["id"],
    },
    annotations: READ_ONLY,
    run: async (a, user) => {
      const full = (await TOOLS[1].run({ id: str(a.id) }, user)) as {
        player?: { id: string; name: string };
        error?: string;
      };
      if (full.error || !full.player) return { error: full.error ?? "Not found" };
      return {
        id: full.player.id,
        title: full.player.name,
        url: `https://operations.eturesports.com/players?player=${full.player.id}`,
        text: JSON.stringify(full, null, 2),
        metadata: { source: "Eture Sports operations database" },
      };
    },
  },
];

export const ALL_TOOLS = [...TOOLS, ...CHATGPT_TOOLS];

export function toolByName(name: string): ToolDef | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

/** The catalogue as the protocol wants it — without the handlers. */
export function toolCatalogue() {
  return ALL_TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
    name,
    title,
    description,
    inputSchema,
    annotations,
  }));
}
