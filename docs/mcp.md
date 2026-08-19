# Connecting an assistant to the database

The platform speaks **MCP** (Model Context Protocol) at
`https://operations.eturesports.com/mcp`. Claude and ChatGPT can both connect
to it, sign in with their Eture Google account, and then ask questions about
the database in ordinary language.

It is **read-only**. There is no tool here that creates, edits or deletes
anything, and no tool that takes SQL. An assistant that misreads an
instruction can be wrong, but it cannot break anything.

---

## Connecting

### Claude (claude.ai, desktop, mobile)

Settings → Connectors → *Add custom connector* → paste
`https://operations.eturesports.com/mcp`. A browser window opens, you sign in
with Google as usual, and a screen asks whether to connect. That is the only
step where a human is involved.

### Claude Code

```
claude mcp add --transport http eture https://operations.eturesports.com/mcp
```

It opens the same browser flow the first time.

### ChatGPT

Settings → Connectors → *Add* → same URL. ChatGPT looks for two tools by name
— `search` and `fetch` — and both are there, alongside the more specific ones.

### Anything else

It is a standard OAuth 2.1 protected MCP server. A client that implements the
specification will discover everything it needs from the 401:

```
/.well-known/oauth-protected-resource        who issues tokens for /mcp
/.well-known/oauth-authorization-server      the endpoints and what they accept
POST /api/oauth/register                     dynamic client registration
GET  /oauth/authorize                        the consent screen
POST /api/oauth/token                        code → token, and refresh
POST /mcp                                    the MCP endpoint itself
```

---

## Who sees what

Whoever connects, connects **as themselves**. The browser step is the app's
own Google sign-in, so the assistant reads with that person's rank, and the
same three things that gate the app gate this: the account has to be active,
approved, and have a role.

That check runs on **every single call**, against the database, not against
whatever was true when the token was minted. Deactivate someone in the app and
their assistant stops being able to read on its next question — nobody has to
remember this exists.

The access token lasts an hour and refreshes silently for a month.

---

## What it can answer

| Tool | For |
|---|---|
| `search_players` | find players by name, university, season, division, programme, nationality, position, whether they are on a roster now |
| `get_player` | one player in full: college profiles, scholarships, season statistics, achievements, **and the rest of their career** — the other records belonging to the same person, which is how a transfer is stored |
| `database_stats` | counts and totals over any filtered selection: operations vs people, division split, scholarship totals, breakdowns by season, programme and university |
| `list_universities` | every university with its player count, division and how many are playing now |
| `list_seasons` | the season, division and programme values actually in use, with counts |
| `recent_changes` | the audit trail — who changed what, when |
| `search` / `fetch` | the same thing in the shape ChatGPT's connectors expect |

Two things worth telling the assistant once, because they are the two ways to
misread this database:

- **A row is an operation, not a person.** One placement. Someone who
  transferred holds two rows, joined by the same person. `database_stats`
  returns both counts for exactly this reason.
- **Archived records are excluded by default**, matching every dashboard in
  the app. `includeArchived: true` brings them back.

---

## What leaves the building

Everything the assistant reads goes to whoever runs it — OpenAI or Anthropic —
and is subject to their retention, not ours. That includes players' names,
their universities, and what they were paid. The consent screen says so before
anyone agrees.

This is the reason the connector is read-only and the reason it authenticates
per person rather than with one shared key: the audit trail can say who
connected what, and nothing that connects can change a record.

---

## How the security works, briefly

- **OAuth 2.1, authorization code + PKCE (S256 only).** No client secrets, no
  implicit flow, no password grant. Redirect URIs are matched exactly and must
  be HTTPS, loopback HTTP, or a custom app scheme.
- **Tokens are signed, not stored.** Every token is its payload plus an HMAC
  derived from `AUTH_SECRET`, with a separate key per purpose — so an
  authorization code cannot be presented as an access token. No tables, no
  migration, and the token endpoint answers without touching the database.
- **Audience binding (RFC 8707).** A token is minted for
  `https://operations.eturesports.com/mcp` and is rejected anywhere else, and a
  token minted for another resource is rejected here.
- **Issuer identification (RFC 9207).** The authorization response says who
  issued it, so a client cannot be tricked into sending its code elsewhere.

### The one thing to know about revocation

Because tokens are not stored, an individual token cannot be struck off a
list — there is no list. Three things stand in for one, and between them they
cover what revocation is for:

1. Access tokens live one hour, so a leaked one stops working by itself.
2. Every call re-reads the user, so removing someone's access in the app
   removes it here immediately.
3. Rotating `AUTH_SECRET` invalidates every token at once — but it also signs
   out every browser session, so it is the fire alarm, not the light switch.

If per-token revocation is ever wanted (say, "disconnect this one laptop"),
that needs a table and a migration, and it is a small change from here.

---

## Protocol notes

The server answers **two eras** of MCP, because the specification moved and the
clients have not all followed:

- **Handshake era** (`2025-03-26` … `2025-11-25`): `initialize`, then
  `tools/list`, then `tools/call`. This is what shipping clients speak today.
- **Per-request era** (`2026-07-28`): no handshake and no sessions; every
  request carries its own protocol version, and `server/discover` replaces the
  handshake.

It holds no session state either way, so requests can land on different
serverless instances without noticing. `GET` and `DELETE` on `/mcp` return
`405`, which is what the current revision asks for and what tells an older
client to stop looking for a stream there.

Where a client sends the newer mirror headers (`Mcp-Method`, `Mcp-Name`), they
must agree with the body — a proxy routing on one value while the server acts
on another is the reason that rule exists. Their **absence** is tolerated,
because every client shipping today omits them.
