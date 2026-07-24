# ETURE Sports · Database Platform

Plataforma interna para unificar y contabilizar la base de datos de operaciones de
**Eture Sports**. Permite añadir, editar y eliminar jugadores; contabiliza y relaciona
todo automáticamente (totales por temporada, división, programa, universidad y becas);
y controla el acceso por usuario mediante inicio de sesión con Google.

- **Stack:** Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL · Auth.js (NextAuth v5) · Tailwind CSS
- **Despliegue previsto:** GitHub → Vercel, con Postgres (Neon) gestionado desde Vercel.
- **Datos iniciales:** 704 jugadores de MSOC (fútbol masculino) importados del Excel oficial.
  El diseño es **multideporte**: WSOC (fútbol femenino) ya está creado para empezar a
  cargar operaciones.

---

## 1. Qué hace

- **Jugadores (CRUD):** alta, edición, borrado, búsqueda y filtros por deporte,
  temporada, división y programa.
- **Importar / exportar CSV:** exporta la vista filtrada a CSV e importa jugadores
  en bloque desde un CSV (mismo formato), con detección de duplicados.
- **Panel / contabilización automática:** al abrir el panel se recalculan en vivo:
  - Jugadores totales y becas acumuladas (USD).
  - Desglose por temporada, división y programa.
  - Ranking de universidades por importe de becas.
- **Permisos por rol:**
  | Rol | Puede |
  |-----|-------|
  | **Administrador** | Todo + gestionar usuarios y roles |
  | **Editor** | Crear / editar / borrar jugadores |
  | **Lectura** | Solo consultar |
- **Acceso con Google** restringido al dominio de la empresa (`@eturesports.com`) y/o a
  una lista de correos concreta (allowlist).

---

## 2. Modelo de datos

`Sport` (MSOC, WSOC…) → `Player` (nombre, universidad, temporada, división, programa,
beca en USD, notas). Los usuarios (`User`) llegan con su rol; Auth.js gestiona
`Account` / `Session`. Ver `prisma/schema.prisma`.

---

## 3. Puesta en marcha (paso a paso)

> El código ya está listo. Estos pasos son la configuración de servicios externos
> (base de datos y login), que requieren tu cuenta.

### 3.1. Base de datos (Postgres en Vercel/Neon)

1. En [Vercel](https://vercel.com) → tu proyecto → **Storage** → **Create Database** →
   **Postgres (Neon)**. Región Europa (p. ej. Frankfurt).
2. Vercel añade automáticamente las variables. Asegúrate de tener:
   - `DATABASE_URL` (conexión *pooled*)
   - `DIRECT_URL` (conexión directa; si Vercel la llama `POSTGRES_URL_NON_POOLING`,
     crea `DIRECT_URL` con ese mismo valor).

### 3.2. Google OAuth (inicio de sesión)

1. [Google Cloud Console](https://console.cloud.google.com) → crea/usa un proyecto de
   la empresa → **APIs y servicios** → **Pantalla de consentimiento OAuth** → tipo
   **Interno** (así solo entra gente del Workspace de Eture).
2. **Credenciales** → **Crear credenciales** → **ID de cliente de OAuth** → **Aplicación
   web**.
   - **Orígenes autorizados de JavaScript:** `https://TU-DOMINIO.vercel.app`
   - **URIs de redirección autorizados:**
     `https://TU-DOMINIO.vercel.app/api/auth/callback/google`
   - (Para desarrollo local añade también `http://localhost:3000` y
     `http://localhost:3000/api/auth/callback/google`.)
3. Copia el **Client ID** y **Client Secret**.

### 3.3. Variables de entorno en Vercel

En Vercel → **Settings** → **Environment Variables** (ver `.env.example`):

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | (de Neon, pooled) |
| `DIRECT_URL` | (de Neon, directa) |
| `AUTH_SECRET` | genera con `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Client ID de Google |
| `AUTH_GOOGLE_SECRET` | Client Secret de Google |
| `ALLOWED_EMAIL_DOMAINS` | `eturesports.com` |
| `ALLOWED_EMAILS` | (opcional) correos sueltos permitidos, separados por coma |
| `ADMIN_EMAILS` | correos que serán administradores, p. ej. el tuyo |

### 3.4. Conectar el repo a Vercel

1. Vercel → **Add New Project** → importa el repositorio `eturesports/operations`.
2. **Root Directory:** déjalo por defecto (la raíz del repo).
3. Framework: Next.js (autodetectado). Deja el *Build Command* por defecto — usa el
   `build` del `package.json`, que aplica las migraciones (`prisma migrate deploy`) y
   compila.
4. **Deploy.** En el primer despliegue se crean las tablas automáticamente.

### 3.5. Cargar los datos iniciales (una vez)

El despliegue crea las tablas pero **no** rellena los jugadores. Para importar el Excel
(704 jugadores MSOC + deportes), ejecútalo una vez apuntando a la base de datos de
producción:

```bash
npm install
# Pega las URLs de Neon en un .env.local (DATABASE_URL y DIRECT_URL)
npm run db:seed
```

El seed es idempotente: si MSOC ya tiene jugadores, no duplica.

### 3.6. Primer acceso

Entra en tu URL de Vercel → **Entrar con Google**. Si tu correo está en `ADMIN_EMAILS`,
tendrás rol de administrador y podrás asignar roles al resto desde **Usuarios**.

---

## 4. Desarrollo local

```bash
git clone https://github.com/eturesports/operations
cd operations
npm install
cp .env.example .env.local   # y rellena las variables
npm run db:push              # crea el esquema en tu BD
npm run db:seed              # importa los datos
npm run dev                  # http://localhost:3000
```

Comandos útiles:

- `npm run db:studio` — explorar la BD con Prisma Studio.
- `npm run build` — build de producción (aplica migraciones).

---

## 5. Añadir un nuevo deporte

Los deportes viven en la tabla `Sport`. Para añadir uno nuevo (p. ej. baloncesto),
inserta una fila con su `code` y `name` (desde Prisma Studio o un pequeño script) y ya
aparecerá en los filtros y formularios. WSOC ya está creado.

---

## 6. Estructura

```
operations/
├─ prisma/
│  ├─ schema.prisma           # modelos User/Role/Sport/Player
│  ├─ migrations/             # migración inicial (SQL)
│  ├─ seed.ts                 # importa el Excel
│  └─ seed-data/msoc.json     # 704 jugadores exportados del Sheet
├─ src/
│  ├─ auth.ts                 # Auth.js (Google + control de acceso)
│  ├─ lib/                    # prisma, permisos, acceso, stats, formato
│  ├─ components/             # NavBar, StatCard, BarList
│  └─ app/
│     ├─ login/               # pantalla de acceso
│     ├─ (app)/dashboard/     # panel con contabilización
│     ├─ (app)/players/       # CRUD de jugadores
│     ├─ (app)/users/         # gestión de roles (admin)
│     └─ api/                 # endpoints REST (players, users, auth)
└─ .env.example
```
