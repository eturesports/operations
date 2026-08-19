import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canView } from "@/lib/permissions";
import { sign } from "@/lib/mcp/tokens";
import { readClient, redirectAllowed, SCOPE, CODE_TTL } from "@/lib/mcp/oauth";
import { headers } from "next/headers";

/**
 * The consent screen: the only step of this whole flow a person sees.
 *
 * It exists to answer one question honestly — some piece of software is
 * asking to read the database as you, and do you want that. So it names the
 * client, names the account, says plainly what will be readable and what will
 * not, and gives refusing the same weight as agreeing.
 *
 * Everything checkable is checked before the screen is drawn. A bad
 * redirect_uri never reaches a human, because a human cannot be expected to
 * spot one.
 */
export const dynamic = "force-dynamic";

type Params = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  resource?: string;
};

function originFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function Refuse({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <div className="kicker mb-3">Connection refused</div>
        <h1 className="mb-2 text-2xl leading-tight text-fg">{title}</h1>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </main>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Params }) {
  const origin = originFromHeaders();
  const {
    client_id,
    redirect_uri,
    response_type,
    code_challenge,
    code_challenge_method,
    state,
    resource,
  } = searchParams;

  // ---- the request itself -------------------------------------------------
  const client = readClient(client_id ?? null);
  if (!client) {
    return <Refuse title="Unknown application" detail="The client_id is missing, expired or was not issued by this server." />;
  }
  if (!redirect_uri || !redirectAllowed(client, redirect_uri)) {
    // Deliberately not redirected anywhere: an unregistered redirect_uri is
    // exactly the thing an attacker supplies, so it is shown here and goes no
    // further.
    return <Refuse title="Redirect not registered" detail="The application asked to be sent somewhere it did not register. Nothing has been shared." />;
  }
  if (response_type !== "code") {
    return <Refuse title="Unsupported request" detail="Only the authorization code flow is supported." />;
  }
  if (!code_challenge || code_challenge_method !== "S256") {
    return <Refuse title="Unsupported request" detail="PKCE with S256 is required." />;
  }

  const audience = resource ?? `${origin}/mcp`;

  // ---- who is agreeing ----------------------------------------------------
  const session = await auth();
  if (!session?.user) {
    const back = `/oauth/authorize?${new URLSearchParams(
      Object.entries(searchParams).filter(([, v]) => v != null) as [string, string][]
    )}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(back)}`);
  }
  const user = session!.user;
  if (user.active === false) redirect("/unauthorized");
  if (user.approved === false) redirect("/pending");
  if (!canView(user.role)) {
    return <Refuse title="No access" detail="This account cannot read the database, so there is nothing to connect." />;
  }

  // ---- agreeing issues the code ------------------------------------------
  async function approve() {
    "use server";
    const code = sign(
      "code",
      {
        sub: user.id,
        cid: client_id,
        redirect_uri,
        code_challenge,
        aud: audience,
        scope: SCOPE,
      },
      CODE_TTL
    );
    const back = new URL(redirect_uri!);
    back.searchParams.set("code", code);
    if (state) back.searchParams.set("state", state);
    // RFC 9207: saying who issued this lets the client refuse a response that
    // came from somewhere else.
    back.searchParams.set("iss", origin);
    redirect(back.toString());
  }

  async function deny() {
    "use server";
    const back = new URL(redirect_uri!);
    back.searchParams.set("error", "access_denied");
    if (state) back.searchParams.set("state", state);
    back.searchParams.set("iss", origin);
    redirect(back.toString());
  }

  const appName = client.client_name || "An application";
  const host = (() => {
    try {
      return new URL(redirect_uri!).host;
    } catch {
      return redirect_uri;
    }
  })();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8">
        <div className="kicker mb-3">ETURE SPORTS</div>
        <h1 className="mb-2 text-2xl leading-tight text-fg">
          Connect {appName}?
        </h1>
        <p className="mb-6 text-sm text-muted">
          It is asking to read the operations database as{" "}
          <b className="text-fg">{user.email}</b>, with your {String(user.role).toLowerCase()} access.
        </p>

        <div className="mb-6 space-y-3 rounded-xl border border-ink-600 p-4 text-sm">
          <div className="flex gap-2.5">
            <span aria-hidden className="text-emerald-400">✓</span>
            <span className="text-fg">
              Read players, universities, seasons, scholarships, college profiles and the audit trail
            </span>
          </div>
          <div className="flex gap-2.5">
            <span aria-hidden className="text-muted">✕</span>
            <span className="text-muted">
              Create, edit or delete anything — this connection cannot write
            </span>
          </div>
        </div>

        <p className="mb-6 text-xs leading-relaxed text-muted">
          Whatever the assistant reads leaves our servers and goes to whoever runs it. It will send
          the answers to <b className="text-fg">{host}</b>. Only connect software you trust with
          players&apos; personal details.
        </p>

        <div className="flex gap-2">
          <form action={deny} className="flex-1">
            <button type="submit" className="btn-ghost w-full">
              Cancel
            </button>
          </form>
          <form action={approve} className="flex-1">
            <button type="submit" className="btn-primary w-full">
              Connect
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
