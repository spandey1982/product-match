"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseJsonSafe } from "@/lib/home-material/client";

/**
 * "Request a quote" / "Request a sample" lead capture (brief §17, §41's
 * Validation-layer sample loop — Visualize -> Shortlist -> Request
 * sample -> Receive sample -> ... -> Purchase). A sample only makes
 * sense against a real SKU (`productId`) — you can't physically ship a
 * "material category" — so that trigger only appears when one is
 * available; a material-category-only recommendation card only ever
 * offers a quote. Self-contained: manages its own open/closed + form +
 * submit state. Deliberately the plainest form in this domain (brief's
 * Validation-layer principle: precision/plainness increases as
 * commitment increases) — standard inputs, no illustrated pickers, no
 * progressive disclosure tricks.
 *
 * Shared between RoomView (a completed preview, or a recommendation
 * card) and /materials/shortlist (a saved product with no room context)
 * — extracted 2026-09-10 rather than duplicated, since both need
 * identical behavior.
 *
 * Resolves server-side to whichever HmRetailer exists — as of 2026-09-08
 * that's exactly one deliberately-labeled placeholder
 * (scripts/seed-retailers.ts), not a real business. The confirmation
 * copy below always echoes the real retailer name/isVerified flag from
 * the response rather than assuming — never silently implies a real
 * business received the request.
 */
export function LeadCaptureButton({ productId, materialCategory }: { productId?: string; materialCategory?: string }) {
  const [leadType, setLeadType] = useState<"quote" | "sample" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [areaSqft, setAreaSqft] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ name: string; isVerified: boolean } | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    if (leadType === "sample" && !shippingAddress.trim()) {
      setError("A shipping address is required to send a sample.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const parsedArea = parseFloat(areaSqft);
      const res = await fetch(`/api/home-material/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          materialCategory,
          leadType,
          contactName: name,
          contactPhone: phone,
          contactEmail: email || undefined,
          message: message || undefined,
          areaSqft: leadType === "quote" && Number.isFinite(parsedArea) && parsedArea > 0 ? parsedArea : undefined,
          shippingAddress: leadType === "sample" ? shippingAddress : undefined,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not submit request");
        return;
      }
      setResult(data.retailer as { name: string; isVerified: boolean });
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <p className="text-xs text-emerald-700 mt-2">
        ✓ {leadType === "sample" ? "Sample request" : "Quote request"} saved. Note: {result.name} is placeholder demo
        data, not a real business yet — this won&apos;t reach an actual retailer until real partners are onboarded.
      </p>
    );
  }

  if (!leadType) {
    return (
      <div className="flex items-center gap-3 mt-2">
        <button type="button" onClick={() => setLeadType("quote")} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          Request a quote
        </button>
        {productId && (
          <button type="button" onClick={() => setLeadType("sample")} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Request a sample
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-amber-700">⚠ Demo mode — no real retailer will receive this yet.</p>
      <p className="text-xs text-gray-500">
        {leadType === "sample"
          ? "A retailer would ship you a physical sample of this exact material — useful before committing, since a screen and the real thing can look different."
          : "A retailer would follow up with a real price for this project — the numbers you've seen so far are platform estimates."}
      </p>
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        type="tel"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {leadType === "quote" ? (
        <input
          type="number"
          min={1}
          placeholder="Approximate area in sqft (optional)"
          value={areaSqft}
          onChange={(e) => setAreaSqft(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      ) : (
        <textarea
          placeholder="Shipping address"
          value={shippingAddress}
          onChange={(e) => setShippingAddress(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}
      <textarea
        placeholder="Message (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => setLeadType(null)}>Cancel</Button>
        <Button size="sm" className="flex-1" onClick={handleSubmit} loading={submitting}>Submit</Button>
      </div>
    </div>
  );
}
