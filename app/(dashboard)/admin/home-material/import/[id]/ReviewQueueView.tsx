"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronUp, Check, X } from "lucide-react";
import {
  ProductFormFields,
  EMPTY_PRODUCT_FORM_VALUES,
  productValuesToFormData,
  type ProductFormValues,
} from "@/components/home-material/admin/ProductFormFields";

interface MaterialOption {
  id: string;
  category: string;
  subtype: string;
  name: string;
}
interface FamilyOption {
  id: string;
  name: string;
}
interface ImportPage {
  id: string;
  pageNumber: number;
  pageType: string;
  extractedImageUrl: string | null;
  extractedFields: string;
  reviewStatus: string;
  resultingProductId: string | null;
}
interface CatalogueImportFull {
  id: string;
  collection: string;
  brand: string | null;
  sourceFileName: string;
  status: string;
  errorMessage: string | null;
  pages: ImportPage[];
}

const PAGE_TYPE_LABEL: Record<string, string> = {
  product: "Looks like a product",
  info: "Looks like an info/reference page",
  noise: "Looks blank/noise",
  ambiguous: "Ambiguous — needs a human call",
};

function parseExtracted(raw: string): { name: string | null; sku: string | null; rawText: string } {
  try {
    const parsed = JSON.parse(raw);
    return { name: parsed.name ?? null, sku: parsed.sku ?? null, rawText: parsed.rawText ?? "" };
  } catch {
    return { name: null, sku: null, rawText: "" };
  }
}

function PageCard({
  page,
  importId,
  importCollection,
  importBrand,
  materials,
  families,
  onResolved,
}: {
  page: ImportPage;
  importId: string;
  importCollection: string;
  importBrand: string | null;
  materials: MaterialOption[];
  families: FamilyOption[];
  onResolved: () => void;
}) {
  const extracted = parseExtracted(page.extractedFields);
  // Collapsed by default regardless of pageType: a real catalogue PDF can
  // yield well over 100 product candidates (every qualifying photo on
  // every page), so defaulting every card open would make the queue
  // unusable. The admin expands one at a time to review/approve it.
  const [expanded, setExpanded] = useState(false);
  const [showText, setShowText] = useState(false);
  const [values, setValues] = useState<ProductFormValues>({
    ...EMPTY_PRODUCT_FORM_VALUES,
    name: extracted.name ?? "",
    sku: extracted.sku ?? "",
    collection: importCollection,
    brand: importBrand ?? "",
  });
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function submit(action: "approve" | "reject") {
    setLoading(action);
    setError("");
    try {
      const fd = action === "approve" ? productValuesToFormData(values) : new FormData();
      fd.set("action", action);
      const res = await fetch(`/api/admin/home-material/catalogue-imports/${importId}/pages/${page.id}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Could not ${action}`);
        return;
      }
      onResolved();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        {page.extractedImageUrl ? (
          <Image src={page.extractedImageUrl} alt="" width={64} height={64} className="rounded-lg object-cover border border-gray-200 shrink-0" unoptimized />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
            No image found
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-900">Page {page.pageNumber}</p>
            <span className="text-[10px] text-gray-400">{PAGE_TYPE_LABEL[page.pageType] ?? page.pageType}</span>
          </div>
          {extracted.name && <p className="text-xs text-gray-600 mt-0.5">Guessed name: {extracted.name}</p>}
          {extracted.sku && <p className="text-[11px] text-gray-400">Guessed SKU: {extracted.sku}</p>}
          <button
            onClick={() => setShowText((v) => !v)}
            className="text-[11px] text-indigo-600 hover:underline mt-1"
          >
            {showText ? "Hide" : "Show"} raw page text
          </button>
          {showText && (
            <p className="text-[11px] text-gray-500 mt-1 bg-gray-50 rounded-lg p-2 max-h-24 overflow-y-auto">
              {extracted.rawText || "(no text found on this page)"}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 text-gray-400 hover:text-gray-700 shrink-0"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <ProductFormFields
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            materials={materials}
            families={families}
          />
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={() => submit("reject")}
          disabled={loading !== null}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
        >
          <X size={12} />
          {loading === "reject" ? "Rejecting..." : "Reject"}
        </button>
        <button
          onClick={() => submit("approve")}
          disabled={loading !== null}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
        >
          <Check size={12} />
          {loading === "approve" ? "Creating..." : "Approve → create draft product"}
        </button>
      </div>
    </div>
  );
}

export function ReviewQueueView({
  catalogueImport,
  materials,
  families,
}: {
  catalogueImport: CatalogueImportFull;
  materials: MaterialOption[];
  families: FamilyOption[];
}) {
  const router = useRouter();
  const pending = catalogueImport.pages.filter((p) => p.reviewStatus === "pending");
  const resolved = catalogueImport.pages.filter((p) => p.reviewStatus !== "pending");

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link href="/admin/home-material/import" className="text-xs text-indigo-600 hover:underline">
        ← All imports
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mt-2">{catalogueImport.collection}</h1>
      <p className="text-sm text-gray-500 mt-1">
        {catalogueImport.sourceFileName} · {catalogueImport.pages.length} pages · {pending.length} pending review
      </p>
      {catalogueImport.errorMessage && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg p-2">{catalogueImport.errorMessage}</p>
      )}

      <div className="mt-6 space-y-4">
        {pending.map((page) => (
          <PageCard
            key={page.id}
            page={page}
            importId={catalogueImport.id}
            importCollection={catalogueImport.collection}
            importBrand={catalogueImport.brand}
            materials={materials}
            families={families}
            onResolved={() => router.refresh()}
          />
        ))}
        {pending.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-xs text-gray-400">
            Every page has been reviewed.
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Already reviewed</p>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {resolved.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-xs text-gray-500">Page {p.pageNumber}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className={p.reviewStatus === "approved" ? "text-emerald-700" : "text-gray-500"}>
                        {p.reviewStatus === "approved" ? "Approved" : "Rejected"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-right">
                      {p.resultingProductId && (
                        <Link href="/admin/home-material/products" className="text-indigo-600 hover:underline">
                          View in catalogue
                        </Link>
                      )}
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
