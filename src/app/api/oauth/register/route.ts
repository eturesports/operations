import { registerClient, redirectUriUsable, OAUTH_CORS } from "@/lib/mcp/oauth";

/**
 * RFC 7591 — dynamic client registration.
 *
 * A client nobody has heard of asks for an id and gets one. That sounds
 * alarming and is not: an id is worth nothing on its own. It cannot read
 * anything, and the only thing it can do is send a person to a consent screen
 * that names it and asks them to approve it. The approval is the gate, not
 * the registration.
 *
 * What is checked here is the one thing that matters — where the
 * authorization code would be delivered. Redirect URIs must be HTTPS, or
 * loopback HTTP (how a desktop client receives its callback), or a custom
 * app scheme. `http://` to a real host would put a code on the open wire, and
 * is refused.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "Body must be JSON." },
      { status: 400, headers: OAUTH_CORS }
    );
  }

  const uris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  if (uris.length === 0) {
    return Response.json(
      { error: "invalid_redirect_uri", error_description: "At least one redirect_uri is required." },
      { status: 400, headers: OAUTH_CORS }
    );
  }
  const bad = uris.find((u) => !redirectUriUsable(u));
  if (bad) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: `${bad} is not a redirect this server will send a browser to. Use https, http on 127.0.0.1, or a custom app scheme.`,
      },
      { status: 400, headers: OAUTH_CORS }
    );
  }

  const clientName = typeof body.client_name === "string" ? body.client_name.slice(0, 120) : undefined;
  const clientUri = typeof body.client_uri === "string" ? body.client_uri.slice(0, 300) : undefined;

  const clientId = registerClient({
    redirect_uris: uris,
    client_name: clientName,
    client_uri: clientUri,
  });

  return Response.json(
    {
      client_id: clientId,
      // No secret: the client is public and proves itself with PKCE instead.
      redirect_uris: uris,
      client_name: clientName,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: OAUTH_CORS }
  );
}
