import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">Sin permiso</h1>
        <p className="mb-6 text-sm text-gray-400">
          No tienes permisos suficientes para ver esta sección. Si crees que es un
          error, pide a un administrador que revise tu rol.
        </p>
        <Link href="/dashboard" className="btn-primary">
          Volver al panel
        </Link>
      </div>
    </main>
  );
}
