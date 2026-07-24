"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
};

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "ADMIN", label: "Administrador", desc: "Gestiona usuarios y todos los datos" },
  { value: "EDITOR", label: "Editor", desc: "Crea, edita y borra jugadores" },
  { value: "VIEWER", label: "Lectura", desc: "Solo consulta" },
];

export function UsersClient({
  currentUserId,
  users: initial,
}: {
  currentUserId: string;
  users: UserRow[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: { role?: Role; active?: boolean }) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al actualizar");
      }
      const { user } = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...user } : u)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios y permisos</h1>
        <p className="text-sm text-gray-400">
          Los usuarios aparecen aquí la primera vez que inician sesión. Ajusta su rol
          o desactiva su acceso.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink-700/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.image}
                          alt=""
                          className="h-8 w-8 rounded-full border border-ink-600"
                        />
                      ) : (
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-bold text-gray-300">
                          {(u.name ?? u.email).slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-white">
                          {u.name ?? "—"}
                          {u.id === currentUserId && (
                            <span className="ml-2 text-xs text-gray-500">(tú)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input max-w-[160px]"
                      value={u.role}
                      disabled={busy === u.id}
                      onChange={(e) => patch(u.id, { role: e.target.value as Role })}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={busy === u.id || u.id === currentUserId}
                      onClick={() => patch(u.id, { active: !u.active })}
                      className={`badge ${
                        u.active
                          ? "bg-green-500/15 text-green-300"
                          : "bg-red-500/15 text-red-300"
                      } ${u.id === currentUserId ? "opacity-60" : "hover:opacity-80"}`}
                      title={
                        u.id === currentUserId
                          ? "No puedes desactivarte a ti mismo"
                          : "Cambiar estado"
                      }
                    >
                      {u.active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.value} className="card p-4">
            <div className="text-sm font-semibold text-white">{r.label}</div>
            <div className="mt-1 text-xs text-gray-400">{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
