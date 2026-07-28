import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { blobToken, NO_STORAGE } from "@/lib/blob";
import { resolveShareToken, noteShareUse } from "@/lib/share";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// POST /api/share/[token]/upload — image upload for share-link holders.
// Same limits as the signed-in uploader; gated by a valid, unrevoked token.
export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const share = await resolveShareToken(params.token);
  if (!share.ok) {
    return NextResponse.json({ error: share.reason }, { status: share.status });
  }
  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      { error: "Image uploads aren't enabled yet — paste an image URL instead." },
      { status: 501 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 8 MB)" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  try {
    const blob = await put(`players/${crypto.randomUUID()}.${ext}`, file, { access: "public", contentType: file.type, token });
    await noteShareUse(share.linkId);
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
