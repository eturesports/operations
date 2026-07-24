// Validación/normalización mínima del payload de jugador (sin dependencias externas).

export type PlayerInput = {
  sportId: string;
  name: string;
  university?: string | null;
  season?: string | null;
  division?: string | null;
  program?: string | null;
  scholarship?: number | null;
  notes?: string | null;
  legacyNumber?: number | null;
  active?: boolean;
  profileImageUrl?: string | null;
  actionImageUrl?: string | null;
  ncaaUrl?: string | null;
  instagramUrl?: string | null;
  nationality?: string | null;
  position?: string | null;
  previousClub?: string | null;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function intOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  // Acepta "120000", "$120.000", "120,000"
  const cleaned = String(v).replace(/[^0-9-]/g, "");
  if (cleaned === "") return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

export function parsePlayerInput(
  body: Record<string, unknown>,
  { partial = false }: { partial?: boolean } = {}
): { data?: Partial<PlayerInput>; error?: string } {
  const data: Partial<PlayerInput> = {};

  if (!partial || "sportId" in body) {
    const sportId = str(body.sportId);
    if (!sportId) return { error: "Falta el deporte (sportId)." };
    data.sportId = sportId;
  }
  if (!partial || "name" in body) {
    const name = str(body.name);
    if (!name) return { error: "El nombre es obligatorio." };
    data.name = name;
  }
  if ("university" in body) data.university = str(body.university);
  if ("season" in body) data.season = str(body.season);
  if ("division" in body) data.division = str(body.division);
  if ("program" in body) data.program = str(body.program);
  if ("scholarship" in body) data.scholarship = intOrNull(body.scholarship);
  if ("legacyNumber" in body) data.legacyNumber = intOrNull(body.legacyNumber);
  if ("notes" in body) data.notes = str(body.notes);
  if ("active" in body) data.active = Boolean(body.active);
  if ("profileImageUrl" in body) data.profileImageUrl = str(body.profileImageUrl);
  if ("actionImageUrl" in body) data.actionImageUrl = str(body.actionImageUrl);
  if ("ncaaUrl" in body) data.ncaaUrl = str(body.ncaaUrl);
  if ("instagramUrl" in body) data.instagramUrl = str(body.instagramUrl);
  if ("nationality" in body) data.nationality = str(body.nationality);
  if ("position" in body) data.position = str(body.position);
  if ("previousClub" in body) data.previousClub = str(body.previousClub);

  return { data };
}

// ─────────────────────────── Player profiles ───────────────────────────

export type ProfileInput = {
  university: string;
  division?: string | null;
  season?: string | null;
  current?: boolean;
  jersey?: string | null;
  ncaaSport?: string | null;
  ncaaDivision?: string | null;
  rosterUrl?: string | null;
  matchesPlayed?: number | null;
  matchesStarted?: number | null;
  minutes?: number | null;
  goals?: number | null;
  assists?: number | null;
  points?: number | null;
  saves?: number | null;
  goalsAgainst?: number | null;
};

const NUMERIC_PROFILE_FIELDS = [
  "matchesPlayed",
  "matchesStarted",
  "minutes",
  "goals",
  "assists",
  "points",
  "saves",
  "goalsAgainst",
] as const;

export function parseProfileInput(
  body: Record<string, unknown>,
  { partial = false }: { partial?: boolean } = {}
): { data?: Partial<ProfileInput>; error?: string } {
  const data: Partial<ProfileInput> = {};

  if (!partial || "university" in body) {
    const university = str(body.university);
    if (!university) return { error: "University is required for a profile." };
    data.university = university;
  }
  if ("division" in body) data.division = str(body.division);
  if ("season" in body) data.season = str(body.season);
  if ("current" in body) data.current = Boolean(body.current);
  if ("jersey" in body) data.jersey = str(body.jersey);
  if ("ncaaSport" in body) data.ncaaSport = str(body.ncaaSport);
  if ("ncaaDivision" in body) data.ncaaDivision = str(body.ncaaDivision);
  if ("rosterUrl" in body) data.rosterUrl = str(body.rosterUrl);
  for (const f of NUMERIC_PROFILE_FIELDS) {
    if (f in body) data[f] = intOrNull(body[f]);
  }

  return { data };
}
