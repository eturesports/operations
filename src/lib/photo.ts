// Pull a player's headshot from their college roster page.
//
// Athletics sites publish the player's photo as the page's social preview
// image, which is a stable place to read it from across platforms. The photo
// is only useful if it is actually the player, so a page that falls back to
// the club crest is rejected — those come through with alt text like
// "Athletics Logo" and would otherwise fill the database with badges.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function metaContent(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content=["']([^"']+)["']/i)?.[1] ?? null;
}

const GENERIC_URL = /logo|placeholder|default|share|site\.(png|jpg)|favicon/i;
const GENERIC_ALT = /logo|athletics|university|crest|banner/i;

function nameParts(s: string): Set<string> {
  return new Set(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2)
  );
}

export type PhotoResult =
  | { ok: true; url: string; confident: boolean }
  | { ok: false; reason: string };

/**
 * @param playerName used to tell a real headshot from a generic club image
 */
export async function fetchRosterPhoto(
  rosterUrl: string,
  playerName: string
): Promise<PhotoResult> {
  let html: string;
  try {
    const res = await fetch(rosterUrl, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, reason: `The roster page answered ${res.status}.` };
    html = await res.text();
  } catch {
    return { ok: false, reason: "Could not open the roster page." };
  }

  const url = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
  if (!url) return { ok: false, reason: "That page publishes no photo." };
  if (GENERIC_URL.test(url)) {
    return { ok: false, reason: "The page only offers a generic club image." };
  }

  const alt = metaContent(html, "og:image:alt") ?? "";
  // Alt naming the player is the strongest signal it is really them.
  const wanted = nameParts(playerName);
  const got = nameParts(alt);
  const shared = [...wanted].filter((w) => got.has(w)).length;

  if (alt && shared === 0 && GENERIC_ALT.test(alt)) {
    return { ok: false, reason: "The page only offers a generic club image." };
  }

  let absolute: string;
  try {
    absolute = new URL(url, rosterUrl).toString();
  } catch {
    return { ok: false, reason: "The photo address is not valid." };
  }

  return { ok: true, url: absolute, confident: shared > 0 };
}
