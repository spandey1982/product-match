import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";

export const metadata = { title: "Client Profiles — Admin" };

async function loadClients() {
  const users = await db.user.findMany({
    where: { role: "RETAILER" },
    select: {
      id: true,
      name: true,
      email: true,
      storeName: true,
      clientProfile: {
        select: { enabledModules: true, primaryModule: true, brandName: true, themePreset: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return users;
}

export default async function AdminClientsPage() {
  const session = await getSession();
  if (!session || !isAdmin(session)) notFound();

  const users = await loadClients();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Client Profiles</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scope an account to a subset of modules with promoted nav placement
          and curated branding — no accounts here are restricted by default.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Store</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Profile</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Modules</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const modules = u.clientProfile ? parseArray(u.clientProfile.enabledModules) : null;
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.storeName || "—"}</td>
                    <td className="px-4 py-3">
                      {u.clientProfile ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                          {u.clientProfile.brandName || "Custom"} · {u.clientProfile.themePreset}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                          Default (unrestricted)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {modules ? `${modules.length} enabled` : "All"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/clients/${u.id}`}
                        className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No retailers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
