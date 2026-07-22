"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "phone" | "otp";
type Mode = "signin" | "signup";

/**
 * Mobile-OTP sign in for end customers — deliberately separate from the
 * retailer's email/password /login. There's no functionally distinct "sign
 * up" step: verifying a phone number for the first time creates the Customer
 * record, same flow as returning. "signin" vs "signup" only changes the copy
 * (sign-in is the default, sign-up is a subtext toggle), per the request.
 */
export function CustomerLoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/rent";

  const [mode, setMode] = useState<Mode>(searchParams.get("intent") === "signup" ? "signup" : "signin");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/customer-auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send OTP");
        return;
      }
      setMockOtp(data.otp);
      setOtp("");
      setStep("otp");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/customer-auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect or expired OTP");
        return;
      }
      router.push(returnTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-100/30 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {step === "otp" ? "Enter the code" : mode === "signup" ? "Create your account" : "Sign in to rent"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === "phone"
              ? "We'll send a one-time code to your mobile number."
              : `Code sent to ${phone}`}
          </p>
        </div>

        {step === "phone" && (
          <p className="text-sm text-gray-500 mb-6">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-indigo-600 font-medium hover:text-indigo-800"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-indigo-600 font-medium hover:text-indigo-800"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        )}

        {step === "phone" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <Input
              label="Mobile number"
              type="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="h-4 w-4" />}
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Send OTP <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {mockOtp && (
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-xs text-indigo-700 font-medium">
                  ✨ Mock OTP (no SMS is sent yet): <span className="font-mono">{mockOtp}</span>
                </p>
              </div>
            )}
            <Input
              label="One-time code"
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Verify &amp; Continue <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline w-full text-center"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Are you a retailer?{" "}
        <Link href="/login" className="text-indigo-500 hover:text-indigo-700 underline">
          Sign in here
        </Link>
      </p>
    </div>
  );
}
