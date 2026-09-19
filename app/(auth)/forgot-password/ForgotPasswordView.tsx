"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
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
          <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way. It expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@brand.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
              Send reset link
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>

      <p className="text-center text-sm text-gray-500">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-indigo-600 font-medium hover:text-indigo-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
