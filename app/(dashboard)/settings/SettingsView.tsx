"use client";

import { useState } from "react";
import { Check, AlertCircle, Lock, Phone, MapPin, Mail, ShieldAlert, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CITY_NAMES } from "@/lib/geo/city-coordinates";
import { DeleteAccountModal } from "@/components/account/DeleteAccountModal";

interface Props {
  initialStoreName: string;
  initialStorePhone: string;
  initialStoreAddress: string;
  initialStoreCity: string;
  initialEmail: string;
  initialPhone: string | null;
  initialPhoneVerified: boolean;
}

export function SettingsView({
  initialStoreName,
  initialStorePhone,
  initialStoreAddress,
  initialStoreCity,
  initialEmail,
  initialPhone,
  initialPhoneVerified,
}: Props) {
  const [storeName, setStoreName] = useState(initialStoreName);
  const [storePhone, setStorePhone] = useState(initialStorePhone);
  const [storeAddress, setStoreAddress] = useState(initialStoreAddress);
  const [storeCity, setStoreCity] = useState(initialStoreCity);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSaved, setContactSaved] = useState(false);

  const [email, setEmail] = useState(initialEmail);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSaved, setEmailSaved] = useState(false);

  const [phone, setPhone] = useState(initialPhone);
  const [phoneVerified, setPhoneVerified] = useState(initialPhoneVerified);
  const [phoneInput, setPhoneInput] = useState(initialPhone ?? "");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [passwordOtp, setPasswordOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  async function requestPhoneOtp() {
    if (!phoneInput.trim()) return;
    setPhoneSaving(true);
    setPhoneError(null);
    try {
      const res = await fetch("/api/settings/phone/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneError(data.error || "Could not send OTP. Please try again.");
        return;
      }
      setPhoneOtpSent(true);
    } catch {
      setPhoneError("Network error. Please try again.");
    } finally {
      setPhoneSaving(false);
    }
  }

  async function verifyPhoneOtp() {
    if (!phoneOtp.trim()) return;
    setPhoneSaving(true);
    setPhoneError(null);
    try {
      const res = await fetch("/api/settings/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, otp: phoneOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneError(data.error || "Incorrect or expired OTP.");
        return;
      }
      setPhone(data.phone);
      setPhoneVerified(true);
      setPhoneOtpSent(false);
      setPhoneOtp("");
    } catch {
      setPhoneError("Network error. Please try again.");
    } finally {
      setPhoneSaving(false);
    }
  }

  async function requestPasswordOtp() {
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      const res = await fetch("/api/settings/password/request-otp", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Could not send OTP. Please try again.");
        return;
      }
      setPasswordOtpSent(true);
    } catch {
      setPasswordError("Network error. Please try again.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function resetPassword() {
    if (!passwordOtp.trim() || !newPassword || newPassword !== confirmPassword) return;
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const res = await fetch("/api/settings/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: passwordOtp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Could not update your password.");
        return;
      }
      setPasswordOtpSent(false);
      setPasswordOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch {
      setPasswordError("Network error. Please try again.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function saveEmail() {
    if (!newEmail.trim() || !currentPassword) return;
    setEmailSaving(true);
    setEmailError(null);
    setEmailSaved(false);
    try {
      const res = await fetch("/api/settings/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || "Could not update your email. Please try again.");
        return;
      }
      setEmail(data.email);
      setNewEmail("");
      setCurrentPassword("");
      setEmailSaved(true);
    } catch {
      setEmailError("Network error. Please try again.");
    } finally {
      setEmailSaving(false);
    }
  }

  async function saveStoreContact() {
    setContactSaving(true);
    setContactError(null);
    setContactSaved(false);
    try {
      const res = await fetch("/api/settings/store-contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName, storePhone, storeAddress, storeCity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactError(data.error || "Could not save your store details. Please try again.");
        return;
      }
      setStoreName(data.storeName);
      setStorePhone(data.storePhone);
      setStoreAddress(data.storeAddress);
      setStoreCity(data.storeCity);
      setContactSaved(true);
    } catch {
      setContactError("Network error. Please try again.");
    } finally {
      setContactSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      <p className="text-sm text-gray-500 mt-1">
        Manage your store details and account security.
      </p>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Store Contact &amp; Address
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Shown to shoppers on your rental and shop listings, along with a map link for directions. City powers the location-radius filter on /shop.
        </p>

        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
          <Input
            label="Store name"
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            leftIcon={<Store className="h-4 w-4" />}
            placeholder="Your store's name"
          />
          <Input
            label="Phone"
            type="tel"
            value={storePhone}
            onChange={(e) => setStorePhone(e.target.value)}
            leftIcon={<Phone className="h-4 w-4" />}
            placeholder="+91 98765 43210"
          />
          <div>
            <label htmlFor="storeAddress" className="text-sm font-medium text-gray-700 mb-1.5 block">
              Address
            </label>
            <textarea
              id="storeAddress"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              rows={3}
              placeholder="Shop no., street, area, city, state, pincode"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
          <div>
            <label htmlFor="storeCity" className="text-sm font-medium text-gray-700 mb-1.5 block">
              City
            </label>
            <select
              id="storeCity"
              value={storeCity}
              onChange={(e) => setStoreCity(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              <option value="">Select a city…</option>
              {CITY_NAMES.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button size="sm" onClick={saveStoreContact} loading={contactSaving} disabled={!storeName.trim()}>
              Save
            </Button>
            {contactSaved && !contactError && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
          {contactError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {contactError}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Account Email
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Used to sign in. Changing it requires your current password.
        </p>

        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-sm text-gray-500">
            Current: <span className="font-medium text-gray-900">{email}</span>
          </p>
          <Input
            label="New email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@brand.com"
            autoComplete="email"
          />
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          <div className="flex items-center gap-3 pt-1">
            <Button size="sm" onClick={saveEmail} loading={emailSaving} disabled={!newEmail.trim() || !currentPassword}>
              Save
            </Button>
            {emailSaved && !emailError && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
          {emailError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {emailError}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Phone Number
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          A verified phone number only you use for account security — separate
          from the store phone shown to shoppers above. Required before you
          can change your password via OTP.
        </p>

        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
          {phoneVerified && phone ? (
            <p className="text-sm text-gray-500">
              Verified: <span className="font-medium text-gray-900">{phone}</span>
            </p>
          ) : (
            <>
              <Input
                label="Phone number"
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                leftIcon={<Phone className="h-4 w-4" />}
                placeholder="+91 98765 43210"
                disabled={phoneOtpSent}
              />
              {phoneOtpSent && (
                <Input
                  label="Enter OTP"
                  type="text"
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  placeholder="6-digit code"
                />
              )}
              <div className="flex items-center gap-3 pt-1">
                {!phoneOtpSent ? (
                  <Button size="sm" onClick={requestPhoneOtp} loading={phoneSaving} disabled={!phoneInput.trim()}>
                    Send OTP
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={verifyPhoneOtp} loading={phoneSaving} disabled={!phoneOtp.trim()}>
                      Verify
                    </Button>
                    <button
                      onClick={() => { setPhoneOtpSent(false); setPhoneOtp(""); setPhoneError(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Change number
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          {phoneError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {phoneError}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Change Password
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Verified via an OTP sent to your phone above.
        </p>

        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
          {!phoneVerified ? (
            <p className="text-sm text-gray-500">Verify your phone number first to enable this.</p>
          ) : !passwordOtpSent ? (
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={requestPasswordOtp} loading={passwordSaving}>
                Send OTP to {phone}
              </Button>
            </div>
          ) : (
            <>
              <Input
                label="Enter OTP"
                type="text"
                value={passwordOtp}
                onChange={(e) => setPasswordOtp(e.target.value)}
                placeholder="6-digit code"
              />
              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <Input
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords don&apos;t match.</p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  size="sm"
                  onClick={resetPassword}
                  loading={passwordSaving}
                  disabled={!passwordOtp.trim() || newPassword.length < 8 || newPassword !== confirmPassword}
                >
                  Update Password
                </Button>
                {passwordSaved && !passwordError && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Updated
                  </span>
                )}
              </div>
            </>
          )}
          {passwordError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {passwordError}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Danger Zone
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Delete your account and everything in it. You get a 7-day window to
          change your mind.
        </p>

        <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
          <p className="text-sm text-gray-700 mb-3">
            Deleting your account removes your catalog, model profiles, and
            wallet after 7 days. Logging back in with your password any time
            before then cancels the deletion — nothing is lost until the
            window closes.
          </p>
          <Button size="sm" variant="destructive" onClick={() => setDeleteModalOpen(true)}>
            Delete My Account
          </Button>
        </div>
      </section>

      <DeleteAccountModal open={deleteModalOpen} onOpenChange={setDeleteModalOpen} />
    </div>
  );
}
