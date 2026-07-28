// Non-destructive university normalization (framework cap. 16).
// Handles abbreviations (FPU, OSU), case/typo variants and combined transfers
// ("OSU, UNCG"), while preserving full canonical names that legitimately contain
// commas ("University of California, Berkeley") and stripping trailing "(ABBR)".

const DROP = new Set([
  "SIN CONFIRMAR",
  "NAIA",
  "NAIA III",
  "NJCAA",
  "JUCO",
  "D1",
  "D2",
  "D3",
  "DIVISION I",
  "DIVISION II",
  "DIVISION III",
  "MLS NEXT PRO",
  "MLS NEXT",
  "TBD",
]);

// key (UPPER, no dots, no trailing parenthetical, ' apostrophes) -> canonical name
const ALIASES: Record<string, string> = {
  FPU: "Franklin Pierce University",
  "FRANKLIN PIERCE": "Franklin Pierce University",
  OSU: "Oregon State University",
  "OREGON ST": "Oregon State University",
  "OREGON STATE": "Oregon State University",
  FDU: "Fairleigh Dickinson University",
  NJIT: "New Jersey Institute of Technology",
  PC: "Providence College",
  PROVIDENCE: "Providence College",
  "PROVIDENCE UNIVERSITY": "Providence College",
  SHU: "Sacred Heart University",
  "SACRED HEART": "Sacred Heart University",
  "ST LEO": "Saint Leo University",
  "SAINT LEO": "Saint Leo University",
  WVU: "West Virginia University",
  "WEST VIRGINIA": "West Virginia University",
  UCWV: "University of Charleston (WV)",
  "UC WV": "University of Charleston (WV)",
  "UC CHARLESTON": "University of Charleston (WV)",
  "UNIVERSITY OF CHARLESTON WEST VIRGINIA": "University of Charleston (WV)",
  UCA: "University of Central Arkansas",
  "CENTRAL ARKANSAS": "University of Central Arkansas",
  CBU: "California Baptist University",
  "CAL BAPTIST": "California Baptist University",
  GCU: "Grand Canyon University",
  UIW: "University of the Incarnate Word",
  SIUE: "Southern Illinois University Edwardsville",
  SNHU: "Southern New Hampshire University",
  AIC: "American International College",
  NOVA: "Nova Southeastern University",
  VCU: "Virginia Commonwealth University",
  UAB: "University of Alabama at Birmingham",
  UNLV: "University of Nevada, Las Vegas",
  UCF: "University of Central Florida",
  FIU: "Florida International University",
  FGCU: "Florida Gulf Coast University",
  "FLORIDA GULF COAST": "Florida Gulf Coast University",
  "FLORIDA TECH": "Florida Institute of Technology",
  UCLA: "UCLA",
  "NC STATE": "North Carolina State University",
  "NC STATE UNIVERSITY": "North Carolina State University",
  "MISSOURI ST": "Missouri State University",
  "MISSOURI STATE": "Missouri State University",
  MSU: "Missouri State University",
  UMKC: "University of Missouri–Kansas City",
  "UNIVERSITY OF MISSOURI KANSAS CITY": "University of Missouri–Kansas City",
  UMBC: "University of Maryland, Baltimore County",
  UNCG: "University of North Carolina Greensboro",
  UNC: "University of North Carolina at Chapel Hill",
  "UNC CHAPEL HILL": "University of North Carolina at Chapel Hill",
  UNH: "University of New Hampshire",
  URI: "University of Rhode Island",
  "RHODE ISLAND": "University of Rhode Island",
  USF: "University of San Francisco",
  UVM: "University of Vermont",
  VERMONT: "University of Vermont",
  "VERMONT UNIVERSITY": "University of Vermont",
  UVU: "Utah Valley University",
  "UTAH VALLEY": "Utah Valley University",
  UIC: "University of Illinois Chicago",
  "LOYOLA CHICAGO": "Loyola University Chicago",
  "LOYOLA MARYMOUNT": "Loyola Marymount University",
  "UNIVERSIDAD LOYOLA MARYMOUNT": "Loyola Marymount University",
  LMU: "Loyola Marymount University",
  SDSU: "San Diego State University",
  "SAN DIEGO STATE": "San Diego State University",
  TU: "University of Tulsa",
  TULSA: "University of Tulsa",
  "USC AIKEN": "University of South Carolina Aiken",
  BRYANT: "Bryant University",
  BUTLER: "Butler University",
  IONA: "Iona University",
  EVANSVILLE: "University of Evansville",
  PACIFIC: "University of the Pacific",
  GONZAGA: "Gonzaga University",
  "IOWA WESTERN": "Iowa Western Community College",
  "CENTRAL CONNECTICUT": "Central Connecticut State University",
  "SOUTHERN CT STATE UNIVERSITY": "Southern Connecticut State University",
  LIPSCOMB: "Lipscomb University",
  LISPSCOMB: "Lipscomb University",
  LONGWOOD: "Longwood University",
  "FRANCIS MARION": "Francis Marion University",
  "MISSISIPI COLLEGE": "Mississippi College",
  "MISSISSIPPI COLLEGE": "Mississippi College",
  "MARIAN UNIVERSITY": "Marian University",
  "UNION COLLEGE": "Union College",
  "MARSH HILL": "Mars Hill University",
  "MARS HILL": "Mars Hill University",
  STONEHILL: "Stonehill College",
  CHARLOTTE: "University of Charlotte",
  MARSHALL: "Marshall University",
  FORDHAM: "Fordham University",
  KENTUCKY: "University of Kentucky",
  LOUSVILLE: "University of Louisville",
  LOUISVILLE: "University of Louisville",
  "ST THOMAS": "University of St. Thomas",
  "SAINT JOHNS": "Saint John's University",
  "AIR FORCE": "United States Air Force Academy",
  "AIR FORCE ACADEMY": "United States Air Force Academy",
  "UMASS LOWELL": "UMass Lowell",
  "PENN STATE": "Pennsylvania State University",
  "OLD DOMINION": "Old Dominion University",
  NEO: "Northeastern Oklahoma A&M (NEO)",
  BSGU: "Bluefield State University",
  "CAL ST": "California State University",
  "CAL BERKLEY": "University of California, Berkeley",
  "CAL BERKELEY": "University of California, Berkeley",
  JMU: "James Madison University",
  NSU: "Nova Southeastern University",
  BU: "Boston University",
  GSU: "Georgia State University",
  UNF: "University of North Florida",
  "NORTH FLORIDA": "University of North Florida",
  "GEORGE MASON": "George Mason University",
  MEMPHIS: "University of Memphis",
  MILLIGAN: "Milligan University",
  GANNON: "Gannon University",
  "CSU PUEBLO": "Colorado State University Pueblo",
  TIFFIN: "Tiffin University",
  BARRY: "Barry University",
  TYLER: "Tyler Junior College",
  LENOIR: "Lenoir-Rhyne University",
  "LENOIR RHYNE": "Lenoir-Rhyne University",
  KANSAS: "University of Kansas",
  LIFE: "Life University",
  MACU: "Mid-America Christian University",
  PBA: "Palm Beach Atlantic University",
  SVSU: "Saginaw Valley State University",
  UNOH: "University of Northwestern Ohio",
  OCU: "Oklahoma City University",
  FREED: "Freed-Hardeman University",
  SIENNA: "Siena College",
  SIENA: "Siena College",
  DOMINICAN: "Dominican University",
  SALEM: "Salem University",
  ICC: "Illinois Central College",
  PITT: "University of Pittsburgh",
  PITTSBURGH: "University of Pittsburgh",
  "PITTSBURGH UNIVERSITY": "University of Pittsburgh",
  UWV: "University of Charleston (WV)",
  UP: "University of Portland",
  EIU: "Eastern Illinois University",
  STETSON: "Stetson University",
  LYNN: "Lynn University",
  // Showcase-specific variants
  ADELPHI: "Adelphi University",
  "COASTAL CAROLINA": "Coastal Carolina University",
  NORTHWESTERN: "Northwestern University",
  TEMPLE: "Temple University",
  QUINNIPIAC: "Quinnipiac University",
  FARIFIELD: "Fairfield University",
  FAIRFIELD: "Fairfield University",
  LIMENSTONE: "Limestone University",
  LIMESTONE: "Limestone University",
  "EASTERN FLORIDA": "Eastern Florida State College",
  "DAVIS AND ELKINS": "Davis & Elkins College",
  "DE PAUL UNIVERSITY": "DePaul University",
  "WILLIAM PENN": "William Penn University",
  "ADAMS STATE": "Adams State University",
  "BOWLING GREEN UNIVERSITY": "Bowling Green State University",
  "ROGER STATE UNIVERSITY": "Rogers State University",
  "CONCORDIA UNIVERSITY OF IRVINE": "Concordia University Irvine",
  "SAINT MICHAELS": "Saint Michael's College",
  "SAINT MICHAEL'S": "Saint Michael's College",
  "ST MICHAELS": "Saint Michael's College",
  "ST MICHAEL'S": "Saint Michael's College",
  "SAINT MICHAELS COLLEGE": "Saint Michael's College",
  "SAINT MICHAEL'S COLLEGE": "Saint Michael's College",
  "CALIFORNIA STATE FULLERTON": "California State University, Fullerton",
  "CAL STATE FULLERTON": "California State University, Fullerton",
  "CAL STATE BAKERSFIELD ROADRUNNERS": "California State University, Bakersfield",
  "UC RIVERSIDE": "University of California, Riverside",
  "ST MARY'S": "St. Mary's University (TX)",
  "ST MARYS": "St. Mary's University (TX)",
};

function fixApos(s: string): string {
  return s.replace(/[´`’]/g, "'");
}
function stripParenthetical(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function keyOf(seg: string): string {
  return stripParenthetical(fixApos(seg))
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/^[^A-Z0-9']+|[^A-Z0-9']+$/g, "")
    .trim();
}

function titleize(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function displayOf(seg: string): string {
  let d = stripParenthetical(fixApos(seg))
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/[a-z]/.test(d)) return d; // already a proper name
  if (!d.includes(" ") && d.replace(/[^A-Za-z0-9]/g, "").length <= 4) return d; // abbreviation
  return titleize(d);
}

function splitCombined(raw: string): string[] {
  const segs = fixApos(raw).split(/\s*\/\s*|\s+-\s+/);
  const out: string[] = [];
  for (const seg of segs) {
    if (seg.includes(",")) {
      const parts = seg.split(",").map((s) => s.trim()).filter(Boolean);
      // Only split on comma when every part is an all-caps abbreviation (e.g.
      // "OSU, UNCG") — never for full names like "University of California, Berkeley".
      const allCaps = parts.length > 1 && parts.every((p) => !/[a-z]/.test(p));
      if (allCaps) out.push(...parts);
      else out.push(seg);
    } else out.push(seg);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

export function canonicalizeUniversity(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const seg of splitCombined(raw)) {
    const k = keyOf(seg);
    if (!k || DROP.has(k)) continue;
    out.push(ALIASES[k] ?? displayOf(seg));
  }
  return [...new Set(out)];
}

// Single canonical name (first match) — handy when a value is one institution.
export function canonicalOne(raw: string | null | undefined): string {
  const c = canonicalizeUniversity(raw);
  return c[0] ?? (raw ?? "").trim();
}

/**
 * Grouping key for a university name.
 *
 * The sheet holds the same institution written many ways — "CLEMSON",
 * "Clemson University", "University of Evansville", "Evansville" — so the key
 * drops the generic words that carry no identity. "Clemson" and "Clemson
 * University" therefore land in the same bucket without needing an alias each.
 */
export function uniKey(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[.,]/g, "")
      .replace(/\b(university|univ|college|of|the)\b/g, " ")
      .replace(/[^a-z0-9&' -]/g, " ")
      .replace(/\s+/g, " ")
      .trim() ||
    // never collapse to nothing (a name made only of generic words)
    name.trim().toLowerCase()
  );
}

/**
 * Of several spellings that share a key, the one to show: prefer a properly
 * capitalized name over a shouted one, then the more complete spelling.
 */
export function preferDisplay(a: string, b: string): string {
  const mixed = (s: string) => /[a-z]/.test(s) && /[A-Z]/.test(s);
  if (mixed(a) !== mixed(b)) return mixed(a) ? a : b;
  return b.length > a.length ? b : a;
}
