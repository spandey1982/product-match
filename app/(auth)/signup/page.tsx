"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BUSINESS_TYPES, BusinessType } from "@/lib/business-type";
import { BusinessTypeIcon } from "@/components/shared/BusinessTypeIcon";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    storeName: "",
    businessType: "RETAILER" as BusinessType,
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }
      router.push("/catalog");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-100/30 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Start for free
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up your AI merchandising workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Your name"
            type="text"
            placeholder="Priya Sharma"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="name"
          />

          <Input
            label="Store name"
            type="text"
            placeholder="Elegance Boutique (optional)"
            value={form.storeName}
            onChange={(e) => setForm({ ...form, storeName: e.target.value })}
          />

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Business type</label>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-200 overflow-hidden">
              {BUSINESS_TYPES.map((type) => (
                <label
                  key={type.value}
                  className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all ${
                    form.businessType === type.value ? "bg-indigo-50/60" : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="businessType"
                    value={type.value}
                    checked={form.businessType === type.value}
                    onChange={() => setForm({ ...form, businessType: type.value })}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded-full border shrink-0 flex items-center justify-center ${
                      form.businessType === type.value ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                    }`}
                  >
                    {form.businessType === type.value && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <BusinessTypeIcon type={type.value} className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="text-sm text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Input
            label="Email"
            type="email"
            placeholder="you@brand.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type={showPw ? "text" : "password"}
            placeholder="min. 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            autoComplete="new-password"
            hint="Must be at least 8 characters"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showPw ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
            Create account
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-indigo-600 font-medium hover:text-indigo-800"
        >
          Sign in →
        </Link>
      </p>
    </div>
  );
}
