"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      router.push(data.redirectTo || "/catalog");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-100/30 p-8">
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-100">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              This link is missing its reset token. Request a new one from the forgot-password page.
            </p>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500">
          <Link href="/forgot-password" className="text-indigo-600 font-medium hover:text-indigo-800">
            Request a new link →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-100/30 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Choose a new password</h1>
          <p className="text-sm text-gray-500 mt-1">You&apos;ll be signed in automatically once it&apos;s set.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="New password"
            type={showPw ? "text" : "password"}
            placeholder="min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            rightIcon={
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          <Input
            label="Confirm new password"
            type={showPw ? "text" : "password"}
            placeholder="min. 8 characters"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
            Reset password
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-800">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
