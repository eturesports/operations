import { prisma } from "@/lib/prisma";
import { canView } from "@/lib/permissions";
import { sign, verify } from "./tokens";
import type { Role } from "@prisma/client";

/**
 * The OAuth 2.1 authorization server that sits in front of the MCP endpoint.
 *
 * An MCP client — Claude, ChatGPT, anything else — cannot use the app's
 * cookie. It has to be sent through a browser to log in, come back with a
 * code, and swap the code for a token. That is what this file describes, and
 * it deliberately implements only the parts MCP requires: the authorization
 * code grant with PKCE, refresh tokens, and dynamic client registration.
 * There are no passwords here and no second identity: the browser step is the
 * app's own Google sign-in, so whoever connects is whoever they already are,
 * with the rank they already have.
 */

/** The only scope. Read means read; nothing here can write. */
export const SCOPE = "eture:read";

export const ACCESS_TTL = 60 * 60; // an hour
export const REFRESH_TTL = 60 * 60 * 24 * 30; // a month
export const CODE_TTL = 60; // a minute — it is a hand-off, not a credential

/**
 * The public origin of this deployment, taken from the request.
 *
 * Not from an environment variable: the same code answers on the production
 * domain, on every preview URL and on localhost, and the issuer it advertises
 * has to be the one the client actually reached, or the client will reject
 * the mismatch (RFC 9207) — correctly.
 */
export function originOf(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? req.headers.get("host") ?? url.host;
  const proto = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The canonical resource identifier, per RFC 8707. No trailing slash. */
export function resourceOf(req: Request): string {
  return `${originOf(req)}/mcp`;
}

/** Cross-origin: these documents are fetched by clients from anywhere. */
export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export type ClientMeta = {
  redirect_uris: string[];
  client_name?: string;
  client_uri?: string;
};

/**
 * A registered client, carried inside its own id.
 *
 * Dynamic client registration normally means a row per client. Here the
 * client_id *is* the registration: the redirect URIs are signed into it, so
 * "look up the client" is "check the signature". A client id that was not
 * issued here cannot be forged, and one that was cannot have its redirect
 * URIs changed after the fact.
 */
export function registerClient(meta: ClientMeta): string {
  return sign("client", meta as unknown as Record<string, unknown>, 60 * 60 * 24 * 365 * 5);
}

export function readClient(clientId: string | null): ClientMeta | null {
  const claims = verify("client", clientId);
  if (!claims) return null;
  const uris = claims.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0) return null;
  return {
    redirect_uris: uris.filter((u): u is string => typeof u === "string"),
    client_name: typeof claims.client_name === "string" ? claims.client_name : undefined,
    client_uri: typeof claims.client_uri === "string" ? claims.client_uri : undefined,
  };
}

/**
 * Redirect URIs are compared exactly, as OAuth 2.1 requires — no prefix
 * matching, no wildcards. Loose comparison here is how authorization codes end
 * up delivered to somebody else's server.
 */
export function redirectAllowed(client: ClientMeta, redirectUri: string): boolean {
  return client.redirect_uris.includes(redirectUri);
}

/**
 * Is this a redirect target we are willing to send a browser to at all?
 *
 * HTTPS anywhere, or HTTP only on the loopback address — which is how a
 * desktop client receives its callback. `http://` to a real host would put an
 * authorization code on the open wire.
 */
export function redirectUriUsable(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return u.hostname === "127.0.0.1" || u.hostname === "localhost";
  // Custom schemes (claude://, cursor://…) are how native apps come back.
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && u.protocol !== "javascript:";
}

// ---------------------------------------------------------------------------
// The user behind a token
// ---------------------------------------------------------------------------

export type McpUser = { id: string; name: string | null; email: string; role: Role };

/**
 * Who is calling, checked against the database every time.
 *
 * This is the revocation the stateless tokens do not have. Someone
 * deactivated, un-approved or deleted in the app stops being able to read
 * anything here on their very next call, whatever token they hold.
 */
export async function userForToken(
  token: string | null,
  resource: string
): Promise<{ user: McpUser } | { error: "invalid_token" | "insufficient_scope" }> {
  const claims = verify("access", token);
  if (!claims) return { error: "invalid_token" };

  // The token has to have been issued *for this server*. A token minted for
  // another resource, however valid, is not ours to accept — this is the
  // confused-deputy check RFC 8707 exists for.
  if (claims.aud !== resource) return { error: "invalid_token" };

  const scopes = String(claims.scope ?? "").split(" ").filter(Boolean);
  if (!scopes.includes(SCOPE)) return { error: "insufficient_scope" };

  const sub = typeof claims.sub === "string" ? claims.sub : null;
  if (!sub) return { error: "invalid_token" };

  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, name: true, email: true, role: true, active: true, approved: true },
  });
  if (!user || !user.active || !user.approved || !canView(user.role)) {
    return { error: "invalid_token" };
  }
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

/** The 401 an MCP client is meant to receive, and the one it acts on. */
export function unauthorized(req: Request, error?: "invalid_token"): Response {
  const origin = originOf(req);
  const params = [
    `resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    `scope="${SCOPE}"`,
  ];
  if (error) params.push(`error="${error}"`);
  return new Response(
    JSON.stringify({ error: error ?? "unauthorized", error_description: "An access token is required." }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer ${params.join(", ")}`,
        ...OAUTH_CORS,
      },
    }
  );
}

export function bearerFrom(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
}
