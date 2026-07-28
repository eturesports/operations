import { NextResponse } from "next/server";
import { blobToken } from "@/lib/blob";

// Whether the optional pieces are actually wired into the running deployment.
// Booleans only — no values, no names, nothing an attacker could use — which
// makes it safe to leave open, and it answers "did the Blob store connect?"
// without anyone having to sign in and press a button to find out.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      imageStorage: !!blobToken(),
      // Names only, never values. Vercel names a store's variable after the
      // store when it is not the first one connected, so seeing which ones
      // arrive is the difference between "not connected" and "connected
      // under a name we are not reading".
      storageVars: Object.keys(process.env).filter((n) => /_READ_WRITE_TOKEN$/.test(n)),
      weeklyRefreshSecret: !!process.env.CRON_SECRET,
      deployedAt: process.env.VERCEL_DEPLOYMENT_ID ? undefined : "local",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
