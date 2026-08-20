"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deletionRequested = searchParams.get("deletionRequested") === "1";

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveredMessage, setRecoveredMessage] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      if (data.recovered) {
        setRecoveredMessage(true);
        setTimeout(() => router.push("/catalog"), 1500);
        return;
      }
      router.push("/catalog");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setForm({ email: "demo@productmatch.ai", password: "demo1234" });
  }

  return (
    <div className="space-y-6">
      {/* Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-100/30 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to your merchandising dashboard
          </p>
        </div>

        {deletionRequested && (
          <div className="mb-6 p-3 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Your account is scheduled for deletion in 7 days. Log back in any time before then to cancel it.
            </p>
          </div>
        )}

        {recoveredMessage && (
          <div className="mb-6 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700">
              Welcome back — your account deletion was cancelled.
            </p>
          </div>
        )}

        {/* Demo notice */}
        <div className="mb-6 p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
          <p className="text-xs text-indigo-700 font-medium mb-2">
            ✨ Try the demo account
          </p>
          <button
            onClick={fillDemo}
            className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Fill demo credentials →
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            autoComplete="current-password"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full mt-2"
            size="lg"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-indigo-600 font-medium hover:text-indigo-800"
        >
          Create one →
        </Link>
      </p>
    </div>
  );
}
