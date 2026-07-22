"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CustomerAddress,
  createCustomerAddress,
  deleteCustomerAddress,
  setDefaultAddress,
  updateCustomerAddress,
} from "@/lib/rental/customer-profile";

const editInputClass =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none";

const emptyForm = { label: "", line1: "", pincode: "", landmark: "" };

interface AddressesViewProps {
  initialAddresses: CustomerAddress[];
}

/**
 * Saved-address book for the signed-in customer — selectable at order time
 * from RentalRequestModal's Delivery Address step. Data lives in Postgres
 * (CustomerAddress) now; page.tsx fetches it server-side and this component
 * mutates via the API + router.refresh() to pull fresh server data back in.
 */
export function AddressesView({ initialAddresses }: AddressesViewProps) {
  const router = useRouter();
  const addresses = initialAddresses;

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function openEditForm(address: CustomerAddress) {
    setEditingId(address.id);
    setForm({
      label: address.label ?? "",
      line1: address.line1,
      pincode: address.pincode,
      landmark: address.landmark ?? "",
    });
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSaveAddress() {
    if (!form.line1.trim()) {
      setError("Enter the address");
      return;
    }
    if (form.pincode.replace(/\D/g, "").length !== 6) {
      setError("Enter a valid 6-digit pincode");
      return;
    }

    setBusy(true);
    setError("");
    const payload = {
      label: form.label.trim() || undefined,
      line1: form.line1.trim(),
      pincode: form.pincode.trim(),
      landmark: form.landmark.trim() || undefined,
    };

    try {
      if (editingId) {
        await updateCustomerAddress(editingId, payload);
      } else {
        await createCustomerAddress(payload);
      }
      closeForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save address");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await deleteCustomerAddress(id);
      setConfirmingDeleteId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(id: string) {
    setBusy(true);
    try {
      await setDefaultAddress(id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900">My Address</h1>
        {!formOpen && (
          <Button size="sm" onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add Address
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {formOpen && (
          <Card className="rounded-3xl overflow-hidden bg-white/90 border-indigo-100">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-900">
                {editingId ? "Edit address" : "Add a new address"}
              </p>
              <Input
                label="Label (optional)"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Home, Work, etc."
              />
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Address</label>
                <textarea
                  value={form.line1}
                  onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                  placeholder="House no., street, locality, city"
                  rows={3}
                  className={editInputClass}
                />
              </div>
              <Input
                label="Pincode"
                value={form.pincode}
                onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                placeholder="6-digit pincode"
                inputMode="numeric"
              />
              <Input
                label="Landmark (optional)"
                value={form.landmark}
                onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
                placeholder="Nearby landmark"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" onClick={closeForm} className="flex-1" disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAddress} className="flex-1" loading={busy}>
                  Save Address
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {addresses.length === 0 && !formOpen ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved addresses</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Addresses you save here can be picked at checkout instead of retyping them.
            </p>
            <Button onClick={openAddForm}>
              <Plus className="h-4 w-4" />
              Add Address
            </Button>
          </div>
        ) : (
          addresses.map((addr) => (
            <Card key={addr.id} className="rounded-2xl overflow-hidden bg-white">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {addr.label && <p className="text-sm font-semibold text-gray-900">{addr.label}</p>}
                      {addr.isDefault && <Badge variant="purple">Default</Badge>}
                    </div>
                    <p className="text-sm text-gray-700">{addr.line1}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {addr.pincode}
                      {addr.landmark ? ` · ${addr.landmark}` : ""}
                    </p>
                  </div>
                </div>

                {confirmingDeleteId === addr.id ? (
                  <div className="flex items-center gap-2.5 mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <Trash2 className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700 flex-1">Delete this address?</p>
                    <button
                      onClick={() => setConfirmingDeleteId(null)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1"
                    >
                      Never mind
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      disabled={busy}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    {!addr.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={busy}
                        onClick={() => handleSetDefault(addr.id)}
                      >
                        <Star className="h-3.5 w-3.5" />
                        Set Default
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditForm(addr)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmingDeleteId(addr.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
