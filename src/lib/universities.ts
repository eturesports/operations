// Non-destructive university normalization (framework cap. 16).
// Raw values in the data are messy: abbreviations (FPU, OSU), case variants
// (Bryant / BRYANT / Bryant University) and combined transfers ("OSU, UNCG").
// canonicalizeUniversity() splits combined entries and maps each part to a
// canonical display name. The ALIASES map is easy to extend as the audit grows.

// Tokens that are NOT universities (divisions / associations / placeholders).
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

// key (UPPER, no dots) -> canonical display name
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
  SHU: "Sacred Heart University",
  "SACRED HEART": "Sacred Heart University",
  "ST LEO": "Saint Leo University",
  "SAINT LEO": "Saint Leo University",
  "STLEO": "Saint Leo University",
  "ST. LEO": "Saint Leo University",
  WVU: "West Virginia University",
  "WEST VIRGINIA": "West Virginia University",
  UCWV: "University of Charleston (WV)",
  "UC WV": "University of Charleston (WV)",
  "UC CHARLESTON": "University of Charleston (WV)",
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
  "FLORIDA TECH": "Florida Institute of Technology",
  UCLA: "UCLA",
  "NC STATE": "North Carolina State University",
  "NC STATE UNIVERSITY": "North Carolina State University",
  "MISSOURI ST": "Missouri State University",
  "MISSOURI STATE": "Missouri State University",
  UMKC: "University of Missouri–Kansas City",
  UMBC: "University of Maryland, Baltimore County",
  UNCG: "University of North Carolina Greensboro",
  UNC: "University of North Carolina at Chapel Hill",
  "UNC CHAPEL HILL": "University of North Carolina at Chapel Hill",
  UNH: "University of New Hampshire",
  URI: "University of Rhode Island",
  "RHODE ISLAND": "University of Rhode Island",
  USF: "University of San Francisco",
  UVM: "University of Vermont",
  "VERMONT UNIVERSITY": "University of Vermont",
  UVU: "Utah Valley University",
  "UTAH VALLEY": "Utah Valley University",
  UIC: "University of Illinois Chicago",
  "LOYOLA CHICAGO": "Loyola University Chicago",
  "LOYOLA MARYMOUNT": "Loyola Marymount University",
  LMU: "Loyola Marymount University",
  "SDSU": "San Diego State University",
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
  "ST. THOMAS": "University of St. Thomas",
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
};

function titleize(s: string): string {
  // If it already has lowercase letters, assume it's a proper name; keep as-is.
  if (/[a-z]/.test(s)) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function canonicalizeUniversity(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[,/]|\s-\s/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
    if (DROP.has(key)) continue;
    const mapped = ALIASES[key] ?? ALIASES[p.toUpperCase().trim()];
    out.push(mapped ?? titleize(p));
  }
  return out;
}

// Canonical key for de-duplicating counts.
export function uniKey(name: string): string {
  return name.trim().toLowerCase();
}
