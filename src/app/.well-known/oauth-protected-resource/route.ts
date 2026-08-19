import { originOf, resourceOf, OAUTH_CORS, SCOPE } from "@/lib/mcp/oauth";

/**
 * RFC 9728 — the document an MCP client fetches after a 401, to find out who
 * issues tokens for this server. It is the first link in the chain: the 401
 * points here, this points at the authorization server, and that one's own
 * metadata says where to send the browser.
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
      resource: resourceOf(req),
      authorization_servers: [origin],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "Eture Sports · Operations Database",
      resource_documentation: `${origin}/mcp`,
    },
    { headers: OAUTH_CORS }
  );
}
