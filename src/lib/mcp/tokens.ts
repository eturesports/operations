import { createHmac, timingSafeEqual, randomBytes, createHash } from "node:crypto";

/**
 * Signed, self-contained tokens for the MCP OAuth server.
 *
 * Every token this file issues — the client id, the authorization code, the
 * access token, the refresh token — is its payload plus an HMAC of that
 * payload. Nothing is written down. That is a deliberate trade, and it is
 * worth being clear about which way it cuts.
 *
 * What it buys: no tables, so no migration, and a token endpoint that answers
 * without touching the database.
 *
 * What it costs: a token cannot be individually revoked, because there is no
 * list to strike it from. Three things stand in for that list, and together
 * they cover what revocation is actually for:
 *
 *  - Access tokens live one hour. A leaked one stops working by itself.
 *  - Every MCP call re-reads the user from the database and checks they are
 *    still active, still approved and still have a role. Removing someone's
 *    access in the app removes it here, on their next call, without anyone
 *    having to remember this exists.
 *  - Rotating AUTH_SECRET invalidates every token at once. It also signs out
 *    every browser session, so it is the fire alarm, not the light switch.
 *
 * The secret is AUTH_SECRET, which already exists for Auth.js. It is not used
 * directly: each purpose derives its own key, so an authorization code can
 * never be presented as an access token even if the payloads were made to
 * line up.
 */

type Purpose = "client" | "code" | "access" | "refresh";

function keyFor(purpose: Purpose): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Refusing is the only safe answer: an empty key signs happily and
    // verifies anything anyone else signs with an empty key.
    throw new Error("AUTH_SECRET is not set — the MCP server cannot sign tokens");
  }
  return createHmac("sha256", secret).update(`eture-mcp/v1/${purpose}`).digest();
}

const b64u = {
  encode: (buf: Buffer | string) =>
    Buffer.from(buf).toString("base64url"),
  decode: (s: string) => Buffer.from(s, "base64url"),
};

export type Claims = Record<string, unknown> & {
  /** seconds since the epoch */
  exp: number;
  iat: number;
  jti: string;
};

export function sign(
  purpose: Purpose,
  payload: Record<string, unknown>,
  ttlSeconds: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: Claims = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
    jti: randomBytes(9).toString("base64url"),
  };
  const body = b64u.encode(JSON.stringify(claims));
  const mac = b64u.encode(createHmac("sha256", keyFor(purpose)).update(body).digest());
  return `${body}.${mac}`;
}

export function verify(purpose: Purpose, token: string | null | undefined): Claims | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  let expected: Buffer;
  let given: Buffer;
  try {
    expected = createHmac("sha256", keyFor(purpose)).update(body).digest();
    given = b64u.decode(mac);
  } catch {
    return null;
  }
  // Length has to match before the constant-time compare, which throws on
  // mismatched lengths rather than returning false.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  let claims: Claims;
  try {
    claims = JSON.parse(b64u.decode(body).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return claims;
}

/** PKCE, S256 only — `plain` is not accepted, and OAuth 2.1 agrees. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  // RFC 7636: 43–128 characters of the unreserved set.
  if (verifier.length < 43 || verifier.length > 128) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
