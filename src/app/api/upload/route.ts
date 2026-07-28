import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { blobToken, NO_STORAGE } from "@/lib/blob";
import { auth } from "@/auth";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// POST /api/upload  (multipart/form-data with a single "file")
// Uploads an image to Vercel Blob and returns its public URL. Any signed-in
// user may upload (e.g. their own avatar); saving a URL onto a player record
// is still permission-gated at that endpoint.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Image uploads are not enabled yet. Create a Blob store in Vercel (Storage → Create → Blob) and redeploy. Meanwhile you can paste an image URL.",
      },
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
  const key = `players/${crypto.randomUUID()}.${ext}`;

  try {
    const blob = await put(key, file, { access: "public", contentType: file.type, token });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
