import { prisma } from "@/lib/prisma";
import { canView } from "@/lib/permissions";
import { sign, verify, verifyPkce } from "@/lib/mcp/tokens";
import {
  readClient,
  redirectAllowed,
  originOf,
  OAUTH_CORS,
  SCOPE,
  ACCESS_TTL,
  REFRESH_TTL,
} from "@/lib/mcp/oauth";

/**
 * The token endpoint: a code becomes an access token, and a refresh token
 * becomes a fresher one.
 *
 * Four things are checked on the code, and each of them closes a real hole:
 * the PKCE verifier (so a code stolen out of the redirect is useless without
 * the secret that never left the client), the client id (so one client cannot
 * redeem another's code), the redirect URI (which is bound into the code), and
 * the resource (so a token minted for this server cannot be replayed at a
 * different one).
 *
 * Refreshing re-reads the user. Someone deactivated between one hour and the
 * next does not get another token.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

function fail(error: string, description?: string, status = 400) {
  return Response.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status, headers: { ...OAUTH_CORS, "Cache-Control": "no-store" } }
  );
}

function issue(userId: string, resource: string, clientId: string, origin: string) {
  return Response.json(
    {
      access_token: sign("access", { sub: userId, aud: resource, scope: SCOPE, iss: origin, cid: clientId }, ACCESS_TTL),
      token_type: "Bearer",
      expires_in: ACCESS_TTL,
      refresh_token: sign("refresh", { sub: userId, aud: resource, scope: SCOPE, iss: origin, cid: clientId }, REFRESH_TTL),
      scope: SCOPE,
    },
    { headers: { ...OAUTH_CORS, "Cache-Control": "no-store" } }
  );
}

/** Still allowed in, right now — not when the token was minted. */
async function stillAllowed(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { active: true, approved: true, role: true },
  });
  return !!user && user.active && user.approved && canView(user.role);
}

export async function POST(req: Request) {
  const origin = originOf(req);

  let form: URLSearchParams;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      // Not what the spec asks for, but some clients send it and the
      // alternative is an opaque failure at the last step of a login.
      const json = (await req.json()) as Record<string, unknown>;
      form = new URLSearchParams(
        Object.entries(json).map(([k, v]) => [k, String(v ?? "")])
      );
    } else {
      form = new URLSearchParams(await req.text());
    }
  } catch {
    return fail("invalid_request", "Could not read the request body.");
  }

  const grantType = form.get("grant_type");
  const clientId = form.get("client_id");
  const client = readClient(clientId);
  if (!client) return fail("invalid_client", "Unknown client_id.", 401);

  // ---- authorization_code -------------------------------------------------
  if (grantType === "authorization_code") {
    const code = form.get("code");
    const verifier = form.get("code_verifier");
    const redirectUri = form.get("redirect_uri");

    const claims = verify("code", code);
    if (!claims) return fail("invalid_grant", "The authorization code is expired or invalid.");

    if (claims.cid !== clientId) return fail("invalid_grant", "This code was issued to another client.");
    if (claims.redirect_uri !== redirectUri) {
      return fail("invalid_grant", "redirect_uri does not match the one the code was issued for.");
    }
    if (!redirectUri || !redirectAllowed(client, redirectUri)) {
      return fail("invalid_grant", "redirect_uri is not registered for this client.");
    }
    if (!verifier || !verifyPkce(verifier, String(claims.code_challenge ?? ""))) {
      return fail("invalid_grant", "PKCE verification failed.");
    }

    // The resource the code was issued for is the audience of the token. A
    // client asking for a different one at this step is asking for a token it
    // was never authorized to hold.
    const asked = form.get("resource");
    if (asked && asked !== claims.aud) {
      return fail("invalid_target", "resource does not match the one authorized.");
    }

    const userId = String(claims.sub ?? "");
    if (!userId || !(await stillAllowed(userId))) {
      return fail("invalid_grant", "This account no longer has access.");
    }
    return issue(userId, String(claims.aud), clientId!, origin);
  }

  // ---- refresh_token ------------------------------------------------------
  if (grantType === "refresh_token") {
    const claims = verify("refresh", form.get("refresh_token"));
    if (!claims) return fail("invalid_grant", "The refresh token is expired or invalid.");
    if (claims.cid !== clientId) return fail("invalid_grant", "This refresh token was issued to another client.");

    const userId = String(claims.sub ?? "");
    if (!userId || !(await stillAllowed(userId))) {
      return fail("invalid_grant", "This account no longer has access.");
    }
    return issue(userId, String(claims.aud), clientId!, origin);
  }

  return fail("unsupported_grant_type", `${grantType ?? "(none)"} is not supported.`);
}
