// Parser CSV mínimo sin dependencias. Soporta comillas, comas y saltos de línea
// dentro de campos entrecomillados, y separador coma o punto y coma.

export function parseCSV(text: string): string[][] {
  // Quita BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  // Detecta separador por la primera línea (coma vs punto y coma)
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (c === "\r") {
      // ignora; el \n cierra la fila
    } else {
      field += c;
    }
  }
  // último campo/fila
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // descarta filas totalmente vacías
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Normaliza una cabecera a una clave canónica conocida.
const HEADER_MAP: Record<string, string> = {
  nombre: "name",
  name: "name",
  jugador: "name",
  universidad: "university",
  university: "university",
  uni: "university",
  temporada: "season",
  season: "season",
  temp: "season",
  "división": "division",
  division: "division",
  programa: "program",
  program: "program",
  beca: "scholarship",
  "beca usd": "scholarship",
  "beca ($)": "scholarship",
  "beca $": "scholarship",
  scholarship: "scholarship",
  deporte: "sportCode",
  sport: "sportCode",
  "código deporte": "sportCode",
  notas: "notes",
  notes: "notes",
  nationality: "nationality",
  nacionalidad: "nationality",
  position: "position",
  "posición": "position",
  posicion: "position",
  "previous club": "previousClub",
  "club anterior": "previousClub",
};

export type CsvPlayer = {
  name: string;
  university?: string;
  season?: string;
  division?: string;
  program?: string;
  scholarship?: string;
  sportCode?: string;
  notes?: string;
  nationality?: string;
  position?: string;
  previousClub?: string;
};

export function rowsToPlayers(rows: string[][]): {
  players: CsvPlayer[];
  unknownHeaders: string[];
} {
  if (rows.length === 0) return { players: [], unknownHeaders: [] };
  const rawHeaders = rows[0].map((h) => h.trim().toLowerCase());
  const keys = rawHeaders.map((h) => HEADER_MAP[h] ?? "");
  const unknownHeaders = rawHeaders.filter((h, i) => keys[i] === "" && h !== "");

  const players: CsvPlayer[] = [];
  for (let r = 1; r < rows.length; r++) {
    const obj: Record<string, string> = {};
    rows[r].forEach((cell, i) => {
      const k = keys[i];
      if (k) obj[k] = cell.trim();
    });
    if (obj.name) players.push(obj as CsvPlayer);
  }
  return { players, unknownHeaders };
}
