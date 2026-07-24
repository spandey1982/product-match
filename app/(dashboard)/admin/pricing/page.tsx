import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { BILLING_OPERATIONS } from "@/lib/billing/types";
import { SeedPricingButton } from "./SeedPricingButton";
import { EditPricingButton, AddPricingButton } from "./PricingActions";

export const metadata = { title: "Pricing Config — Admin" };

function formatUsd(n: number) {
  return `$${n.toFixed(5)}`;
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default async function PricingPage() {
  const session = await getSession();
  if (!session || !isAdmin(session)) notFound();

  const configs = await db.pricingConfig.findMany({
    orderBy: { effectiveFrom: "desc" },
    take: 20,
  });

  type ConfigRow = (typeof configs)[number];
  type ParsedConfig = Omit<ConfigRow, "prices"> & { prices: Record<string, number> };
  const parsed: ParsedConfig[] = configs.map((c: ConfigRow) => {
    const { prices: raw, ...rest } = c;
    return { ...rest, prices: JSON.parse(raw) as Record<string, number> };
  });

  const activeConfig = parsed.find((c) => c.isActive);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pricing Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Retail prices charged per AI operation.
          </p>
        </div>
        <AddPricingButton defaultPrices={activeConfig?.prices} />
      </div>

      {/* Active pricing table */}
      {activeConfig ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">
                {activeConfig.name}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Effective from{" "}
                {activeConfig.effectiveFrom.toLocaleDateString("en-IN", {
                  dateStyle: "medium",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <EditPricingButton
                configId={activeConfig.id}
                prices={activeConfig.prices}
              />
              <ActiveBadge active />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">
                    Operation
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">
                    Price (USD)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {BILLING_OPERATIONS.map((op) => {
                  const price = activeConfig.prices[op];
                  return (
                    <tr key={op} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <code className="text-xs font-mono text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded">
                          {op}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium text-gray-900">
                        {price != null ? formatUsd(price) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <SeedPricingButton />
      )}

      {/* Config history */}
      {parsed.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 text-sm">
              Configuration History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">
                    Name
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">
                    Effective From
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">
                    Operations
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parsed.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-900 font-medium text-xs">
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {c.effectiveFrom.toLocaleDateString("en-IN", {
                        dateStyle: "medium",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums">
                      {Object.keys(c.prices).length} ops
                    </td>
                    <td className="px-4 py-2.5">
                      <ActiveBadge active={c.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
