import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  const agent = new ProxyAgent(proxy);
  neonConfig.fetchFunction = (url, opts) => undiciFetch(url, { ...opts, dispatcher: agent });
}
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const q = process.argv[2] || "";
const rows = await sql.query(q);
console.log(JSON.stringify(rows, null, 2));
