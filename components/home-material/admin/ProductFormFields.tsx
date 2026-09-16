"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * The shared HmProduct field set, used by both the single-entry admin form
 * (app/(dashboard)/admin/home-material/products/ProductsView.tsx) and the
 * PDF-import review queue's per-page approval form (app/(dashboard)/admin/
 * home-material/import/[id]/ReviewQueueView.tsx) — one place for the field
 * list so the two entry paths can't silently drift apart. All values are
 * plain strings (controlled-input convention); productValuesToFormData
 * converts to the FormData shape lib/home-material/product-form.ts expects.
 */
export interface ProductFormValues {
  materialId: string;
  familyId: string;
  name: string;
  sku: string;
  brand: string;
  collection: string;
  description: string;
  colorName: string;
  colorHex: string;
  finish: string;
  materialComposition: string;
  patternCategory: string;
  visualStyle: string;
  installationMethod: string;
  sampleAvailable: string; // "" | "true" | "false"
  patternName: string;
  patternRepeatCm: string;
  orientation: string;
  dimensions: string;
  patternType: string; // "customizable" | "repeat_sheet"
  sheetWidthM: string;
  sheetHeightM: string;
  minWidthM: string;
  minHeightM: string;
  priceInr: string;
  priceUnit: string;
  warrantyInfo: string;
  availability: string;
  reviewStatus: string;
}

export const EMPTY_PRODUCT_FORM_VALUES: ProductFormValues = {
  materialId: "",
  familyId: "",
  name: "",
  sku: "",
  brand: "",
  collection: "",
  description: "",
  colorName: "",
  colorHex: "",
  finish: "",
  materialComposition: "",
  patternCategory: "",
  visualStyle: "",
  installationMethod: "",
  sampleAvailable: "",
  patternName: "",
  patternRepeatCm: "",
  orientation: "",
  dimensions: "",
  patternType: "customizable",
  sheetWidthM: "",
  sheetHeightM: "",
  minWidthM: "",
  minHeightM: "",
  priceInr: "",
  priceUnit: "",
  warrantyInfo: "",
  availability: "unspecified",
  reviewStatus: "draft",
};

export function productValuesToFormData(values: ProductFormValues): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(values)) {
    if (val !== "") fd.set(key, val);
  }
  return fd;
}

const AVAILABILITY_OPTIONS = [
  { value: "unspecified", label: "Unspecified" },
  { value: "in_stock", label: "In stock" },
  { value: "order", label: "Made to order" },
  { value: "discontinued", label: "Discontinued" },
];
const PRICE_UNIT_OPTIONS = [
  { value: "per_sqft", label: "Per sq. ft" },
  { value: "per_roll", label: "Per roll" },
  { value: "per_panel", label: "Per panel" },
  { value: "per_litre", label: "Per litre" },
];
const REVIEW_STATUS_OPTIONS = [
  { value: "draft", label: "Draft (hidden from customers)" },
  { value: "published", label: "Published (visible on /materials)" },
];
const SAMPLE_AVAILABLE_OPTIONS = [
  { value: "", label: "Unknown" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export function ProductFormFields({
  values,
  onChange,
  materials,
  families,
}: {
  values: ProductFormValues;
  onChange: (patch: Partial<ProductFormValues>) => void;
  materials: { id: string; category: string; subtype: string; name: string }[];
  families: { id: string; name: string }[];
}) {
  function set<K extends keyof ProductFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ [key]: e.target.value } as Partial<ProductFormValues>);
  }

  return (
    <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
      <Section title="Identity">
        <Select
          label="Material *"
          value={values.materialId}
          onChange={set("materialId")}
          placeholder="Select a material"
          options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.category} / ${m.subtype})` }))}
        />
        <Select
          label="Family (colourway group)"
          value={values.familyId}
          onChange={set("familyId")}
          placeholder="— none —"
          options={families.map((f) => ({ value: f.id, label: f.name }))}
        />
        <Input label="Name *" value={values.name} onChange={set("name")} placeholder="Meadow Bloom — Sage" />
        <Input label="SKU" value={values.sku} onChange={set("sku")} />
        <Input label="Brand" value={values.brand} onChange={set("brand")} />
        <Input label="Collection" value={values.collection} onChange={set("collection")} />
      </Section>

      <div>
        <Textarea label="Description" value={values.description} onChange={set("description")} rows={2} />
      </div>

      <Section title="Appearance">
        <Input label="Colour name" value={values.colorName} onChange={set("colorName")} />
        <Input label="Colour hex" type="text" value={values.colorHex} onChange={set("colorHex")} placeholder="#a3b18a" />
        <Input label="Finish" value={values.finish} onChange={set("finish")} placeholder="Matte, textured, ..." />
        <Input label="Pattern category" value={values.patternCategory} onChange={set("patternCategory")} placeholder="floral, geometric, ..." />
        <Input label="Visual style" value={values.visualStyle} onChange={set("visualStyle")} placeholder="modern, traditional, ..." />
        <Input label="Pattern name" value={values.patternName} onChange={set("patternName")} />
        <Input label="Orientation" value={values.orientation} onChange={set("orientation")} />
      </Section>

      <Section title="Material specifics">
        <Input label="Material composition" value={values.materialComposition} onChange={set("materialComposition")} placeholder="Non-woven, Vinyl/PVC, ..." />
        <Input label="Installation method" value={values.installationMethod} onChange={set("installationMethod")} placeholder="peel_and_stick, paste_the_wall, ..." />
        <Select label="Sample available" value={values.sampleAvailable} onChange={set("sampleAvailable")} options={SAMPLE_AVAILABLE_OPTIONS} />
        <Input label="Warranty info" value={values.warrantyInfo} onChange={set("warrantyInfo")} />
      </Section>

      <Section title="Sizing">
        <Select
          label="Pattern type *"
          value={values.patternType}
          onChange={set("patternType")}
          options={[
            { value: "customizable", label: "Customizable (single design, scales to wall)" },
            { value: "repeat_sheet", label: "Repeat sheet (real sheet size, tiled)" },
          ]}
        />
        <Input label="Pattern repeat (cm)" type="number" min="0" step="0.1" value={values.patternRepeatCm} onChange={set("patternRepeatCm")} />
        {values.patternType === "repeat_sheet" ? (
          <>
            <Input label="Sheet width (m) *" type="number" min="0" step="0.01" value={values.sheetWidthM} onChange={set("sheetWidthM")} />
            <Input label="Sheet height (m) *" type="number" min="0" step="0.01" value={values.sheetHeightM} onChange={set("sheetHeightM")} />
          </>
        ) : (
          <>
            <Input label="Min width (m)" type="number" min="0" step="0.01" value={values.minWidthM} onChange={set("minWidthM")} hint="Smallest size it can scale down to" />
            <Input label="Min height (m)" type="number" min="0" step="0.01" value={values.minHeightM} onChange={set("minHeightM")} />
          </>
        )}
        <Input label="Dimensions (free text)" value={values.dimensions} onChange={set("dimensions")} placeholder="Legacy/other — roll size, etc." />
      </Section>

      <Section title="Commerce & status">
        <Input label="Price (₹)" type="number" min="0" step="0.01" value={values.priceInr} onChange={set("priceInr")} />
        <Select label="Price unit" value={values.priceUnit} onChange={set("priceUnit")} placeholder="— select —" options={PRICE_UNIT_OPTIONS} />
        <Select label="Availability" value={values.availability} onChange={set("availability")} options={AVAILABILITY_OPTIONS} />
        <Select label="Review status" value={values.reviewStatus} onChange={set("reviewStatus")} options={REVIEW_STATUS_OPTIONS} />
      </Section>
    </div>
  );
}
