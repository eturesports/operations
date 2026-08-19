import { originOf, resourceOf, OAUTH_CORS, SCOPE } from "@/lib/mcp/oauth";

/**
 * The same document as `/.well-known/oauth-protected-resource`, under the
 * path-suffixed name.
 *
 * RFC 9728 says a resource served at `https://host/mcp` publishes its
 * metadata at `/.well-known/oauth-protected-resource/mcp`. Clients differ on
 * which of the two they ask for, and one that asks for the wrong one and gets
 * a 404 stops there rather than trying the other. So both exist.
 *
 * Written out rather than re-exported from the sibling route: Next reads
 * `runtime` and `dynamic` statically, and a re-export is not something it can
 * read.
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
