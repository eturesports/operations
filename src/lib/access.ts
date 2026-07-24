// Reglas de acceso derivadas de variables de entorno.
// Un correo puede entrar si: su dominio está en ALLOWED_EMAIL_DOMAINS,
// o está listado en ALLOWED_EMAILS. Si ambas listas están vacías, se permite
// cualquier cuenta de Google (no recomendado en producción).

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const allowedDomains = parseList(process.env.ALLOWED_EMAIL_DOMAINS);
const allowedEmails = parseList(process.env.ALLOWED_EMAILS);
const adminEmails = parseList(process.env.ADMIN_EMAILS);

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  if (allowedEmails.includes(e)) return true;
  if (allowedDomains.length > 0) {
    const domain = e.split("@")[1] ?? "";
    if (allowedDomains.includes(domain)) return true;
    return false;
  }
  // Sin dominios configurados y no en allowlist:
  // permitir solo si tampoco hay allowlist (modo abierto).
  return allowedEmails.length === 0;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase());
}
