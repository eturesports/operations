import {
  bearerFrom,
  resourceOf,
  unauthorized,
  userForToken,
  OAUTH_CORS,
  SCOPE,
} from "@/lib/mcp/oauth";
import { toolByName, toolCatalogue } from "@/lib/mcp/tools";

/**
 * The MCP endpoint. One URL, POST only, JSON-RPC in the body.
 *
 * It answers two eras of the protocol, because the specification moved and
 * the clients have not all followed:
 *
 *  - **Handshake era** (`2025-03-26` … `2025-11-25`) — the client sends
 *    `initialize`, then `tools/list`, then `tools/call`. This is what
 *    Claude's connectors, Claude Code and ChatGPT speak today.
 *  - **Per-request era** (`2026-07-28`) — no handshake and no session; every
 *    request carries its own protocol version, and `server/discover` replaces
 *    the handshake for clients that want to check first.
 *
 * Supporting only the newer one would mean a server nothing can connect to
 * yet; supporting only the older one means rewriting this when clients move.
 * Both are a few dozen lines, so it answers to both and lets the client
 * choose.
 *
 * There is no session either way: nothing is remembered between requests, so
 * two calls can land on two different serverless instances without noticing.
 * The older era allows a server not to assign a session, and the newer one
 * removed sessions entirely.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = {
  name: "eture-operations",
  title: "Eture Sports · Operations Database",
  version: "1.0.0",
};

/** Newest first. The handshake era echoes whichever of these the client asks. */
const SUPPORTED = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"];

const CAPABILITIES = { tools: { listChanged: false } };

const JSON_HEADERS = { "Content-Type": "application/json", ...OAUTH_CORS };

type Rpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function result(id: Rpc["id"], value: unknown, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: value }), {
    status,
    headers: JSON_HEADERS,
  });
}

function rpcError(id: Rpc["id"], code: number, message: string, status = 200, data?: unknown) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } }),
    { status, headers: JSON_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

/**
 * GET and DELETE belonged to the session mechanics the current revision
 * removed. 405 is the answer the specification asks for, and it is also what
 * tells an old client to stop looking for a stream here.
 */
export async function GET() {
  return new Response(JSON.stringify({ error: "This MCP endpoint accepts POST only." }), {
    status: 405,
    headers: { ...JSON_HEADERS, Allow: "POST, OPTIONS" },
  });
}
export const DELETE = GET;

export async function POST(req: Request) {
  const resource = resourceOf(req);

  // ---- who is asking ------------------------------------------------------
  const token = bearerFrom(req);
  if (!token) return unauthorized(req);
  const who = await userForToken(token, resource);
  if ("error" in who) {
    if (who.error === "insufficient_scope") {
      return new Response(
        JSON.stringify({ error: "insufficient_scope" }),
        {
          status: 403,
          headers: {
            ...JSON_HEADERS,
            "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${SCOPE}", resource_metadata="${new URL(resource).origin}/.well-known/oauth-protected-resource"`,
          },
        }
      );
    }
    return unauthorized(req, "invalid_token");
  }
  const user = who.user;

  // ---- the message --------------------------------------------------------
  let body: Rpc;
  try {
    body = (await req.json()) as Rpc;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return rpcError(null, -32600, "Invalid Request", 400);
  }

  const { id, method, params = {} } = body;
  if (typeof method !== "string") {
    return rpcError(id ?? null, -32600, "Invalid Request", 400);
  }

  // The per-request era mirrors `method` and the tool name into headers so
  // that proxies can route without parsing the body. Where a client sends
  // them, they must agree with the body — a load balancer acting on one value
  // while this code acts on another is the whole reason the rule exists.
  // Absence is tolerated: every client shipping today omits them.
  const headerMethod = req.headers.get("mcp-method");
  if (headerMethod && headerMethod !== method) {
    return rpcError(id ?? null, -32020, `Header mismatch: Mcp-Method "${headerMethod}" is not the body's "${method}"`, 400);
  }
  const headerName = req.headers.get("mcp-name");
  const bodyName = typeof params.name === "string" ? params.name : undefined;
  if (headerName && bodyName && decodeMcpValue(headerName) !== bodyName) {
    return rpcError(id ?? null, -32020, "Header mismatch: Mcp-Name does not match the body", 400);
  }

  // A notification carries no id and gets no answer.
  const isNotification = id === undefined || id === null;

  switch (method) {
    // ---- handshake era ----------------------------------------------------
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;
      // Echo the client's version when it is one we speak; otherwise offer
      // ours and let it decide, which is what the handshake is for.
      const version = asked && SUPPORTED.includes(asked) ? asked : "2025-06-18";
      return result(id, {
        protocolVersion: version,
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
        instructions:
          "The Eture Sports operations database: college soccer placements, the universities they went to, the money " +
          "involved and what happened afterwards. A row is one *operation* — a single placement — and one person can hold " +
          "several, which is how a transfer is recorded; get_player returns the rest of a career. Read-only.",
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202, headers: OAUTH_CORS });

    // ---- per-request era --------------------------------------------------
    case "server/discover":
      return result(id, {
        protocolVersions: SUPPORTED,
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
      });

    // ---- both -------------------------------------------------------------
    case "ping":
      return result(id, {});

    case "tools/list":
      return result(id, { tools: toolCatalogue() });

    case "tools/call": {
      const name = bodyName;
      const tool = name ? toolByName(name) : undefined;
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name ?? "(none)"}`);

      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        const value = await tool.run(args, user);
        return result(id, {
          // Text first: every client can read it. The same object goes in
          // structuredContent for the ones that would rather have the shape.
          content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
          structuredContent: value as Record<string, unknown>,
          isError: false,
        });
      } catch (e) {
        // A tool that fails reports through the result, not as a protocol
        // error: the model is meant to see what went wrong and try again.
        return result(id, {
          content: [
            { type: "text", text: `The tool failed: ${e instanceof Error ? e.message : String(e)}` },
          ],
          isError: true,
        });
      }
    }

    // Declared as unsupported rather than left to time out.
    case "resources/list":
      return result(id, { resources: [] });
    case "prompts/list":
      return result(id, { prompts: [] });

    default:
      if (isNotification) return new Response(null, { status: 202, headers: OAUTH_CORS });
      return rpcError(id, -32601, `Method not found: ${method}`, 404);
  }
}

/**
 * Header values that cannot be plain ASCII arrive Base64-wrapped in a
 * sentinel. A player called “Muñoz” is exactly the case this exists for.
 */
function decodeMcpValue(value: string): string {
  const m = /^=\?base64\?(.*)\?=$/.exec(value);
  if (!m) return value;
  try {
    return Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    return value;
  }
}
