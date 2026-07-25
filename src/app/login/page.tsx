import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const hasError = !!searchParams.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">
          <div className="kicker mb-3">ETURE SPORTS</div>
          <h1 className="mb-1 text-4xl leading-none text-fg">
            Database Platform
          </h1>
          <p className="mb-8 text-sm text-bone/55">
            Unified operations database
          </p>

          {hasError && (
            <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              Something went wrong signing you in. Try again, or contact an
              administrator if it persists.
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button type="submit" className="btn-ghost w-full py-3 text-base">
              <GoogleIcon />
              Sign in with Google
            </button>
          </form>

          <p className="mt-6 text-xs leading-relaxed text-muted">
            Eture Sports staff get access automatically. External accounts can
            sign in to request access — an administrator approves each request.
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.72 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.77 0 2.96.75 3.64 1.4l2.48-2.4C16.46 2.9 14.44 2 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.05 9.6-9.76 0-.66-.07-1.16-.16-1.66H12z"
      />
    </svg>
  );
}
