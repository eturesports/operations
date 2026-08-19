import { originOf, OAUTH_CORS, SCOPE } from "@/lib/mcp/oauth";

/**
 * RFC 8414 — what this authorization server can do and where its endpoints
 * are. A client reads this before sending anyone to a browser.
 *
 * The narrowness is the point. One grant type, one response type, PKCE with
 * S256 and nothing else, public clients only. Every line that is missing is a
 * thing this server will refuse.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

export function GET(req: Request) {
  const origin = originOf(req);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      scopes_supported: [SCOPE],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      // Public clients with PKCE. There is no client secret to leak because
      // there is no client secret.
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      // RFC 8707: tokens are minted for one resource and checked against it.
      resource_indicators_supported: true,
      // RFC 9207: the authorization response says who issued it, so a client
      // cannot be talked into sending its code to the wrong server.
      authorization_response_iss_parameter_supported: true,
      service_documentation: `${origin}/mcp`,
    },
    { headers: OAUTH_CORS }
  );
}
