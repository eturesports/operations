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
  { value: "ADMIN", label: "Admin", desc: "Manages users and all data" },
  { value: "EDITOR", label: "Editor", desc: "Creates, edits and deletes players" },
  { value: "VIEWER", label: "Viewer", desc: "Read-only access" },
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
        throw new Error(j.error ?? "Failed to update");
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
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">Access & permissions</h1>
        <p className="text-sm text-muted">
          Users appear here the first time they sign in. Adjust their role or disable
          their access.
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
            <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
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
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-bold text-fg">
                          {(u.name ?? u.email).slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-fg">
                          {u.name ?? "—"}
                          {u.id === currentUserId && (
                            <span className="ml-2 text-xs text-muted">(you)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input max-w-[150px]"
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
                          ? "You can't deactivate yourself"
                          : "Toggle status"
                      }
                    >
                      {u.active ? "Active" : "Inactive"}
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
            <div className="text-sm font-semibold text-fg">{r.label}</div>
            <div className="mt-1 text-xs text-muted">{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
