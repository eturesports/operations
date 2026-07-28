// Finding the Blob store's token.
//
// Vercel names the variable BLOB_READ_WRITE_TOKEN for the first store you
// connect to a project, and prefixes the rest after their store name
// (OPERATIONSIMAGES_READ_WRITE_TOKEN). A project with two stores can
// therefore have image uploads silently unavailable while a token sits right
// there in the environment, so any of them will do.

export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const [name, value] of Object.entries(process.env)) {
    if (name.endsWith("_READ_WRITE_TOKEN") && value) return value;
  }
  return undefined;
}

export const NO_STORAGE =
  "Image storage is not enabled yet. Create a Blob store in Vercel (Storage → Create → Blob, with Public access), connect it to this project, and redeploy.";
