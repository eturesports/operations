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
      weeklyRefreshSecret: !!process.env.CRON_SECRET,
      deployedAt: process.env.VERCEL_DEPLOYMENT_ID ? undefined : "local",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
