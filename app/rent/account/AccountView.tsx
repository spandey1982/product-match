"use client";
import { useState } from "react";
import { User, Phone, Mail, Check, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateCustomerAccount } from "@/lib/rental/customer-profile";

interface AccountViewProps {
  initialName: string;
  /** Verified phone from the real OTP session — fixed here, not freely editable. */
  phone: string;
  initialEmail: string;
}

/**
 * Only ever rendered for a signed-in customer (page.tsx gates on session and
 * fetches the initial values from Postgres). Shows saved details read-only
 * by default — no blank form re-prompting a returning customer — with Edit
 * for name/email, persisted via PATCH /api/customer/me.
 */
export function AccountView({ initialName, phone, initialEmail }: AccountViewProps) {
  const [editing, setEditing] = useState(!initialName);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateCustomerAccount({ name: name.trim(), email: email.trim() || undefined });
      setName(updated.name);
      setEmail(updated.email ?? "");
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save account details");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900 mb-6">My Account</h1>

      <Card className="rounded-3xl overflow-hidden bg-white/90">
        <CardHeader className="px-5 pt-4 pb-1 flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base font-medium">Account Details</CardTitle>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </CardHeader>
        <CardContent className="p-5">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<User className="h-4 w-4" />}
                placeholder="Your full name"
                autoFocus
              />
              <Input label="Mobile" value={phone} disabled leftIcon={<Phone className="h-4 w-4" />} />
              <Input
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                placeholder="you@example.com"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={saving}>
                  Save Changes
                </Button>
                {name.trim() && (
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <div className="divide-y divide-gray-50">
              <DetailRow icon={User} label="Name" value={name || "—"} />
              <DetailRow icon={Phone} label="Mobile" value={phone} badge="Verified" />
              <DetailRow icon={Mail} label="Email" value={email || "—"} />
              {saved && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600 pt-3">
                  <Check className="h-4 w-4" />
                  Saved
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="h-9 w-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-gray-400 tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
      {badge && <Badge variant="success">{badge}</Badge>}
    </div>
  );
}
