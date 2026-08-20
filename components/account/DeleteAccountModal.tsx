"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Two-step account-deletion confirmation — must type "delete" before the
 * confirm button enables. The actual deletion is a soft delete with a 7-day
 * recovery window (logging back in cancels it) — see
 * /api/settings/account's DELETE handler and lib/account/purge.ts.
 */
export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canConfirm = confirmText.trim().toLowerCase() === "delete";

  function handleOpenChange(next: boolean) {
    if (deleting) return;
    if (!next) {
      setConfirmText("");
      setError("");
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/settings/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't delete your account. Please try again.");
        return;
      }
      router.push("/login?deletionRequested=1");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete your account
          </DialogTitle>
          <DialogDescription>
            Your account will be scheduled for deletion and permanently removed in{" "}
            <strong>7 days</strong> — including your catalog, model profiles, and wallet.
            Simply logging back in with your password any time before then cancels the
            deletion and restores your account.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <Input
            label={'Type "delete" to confirm'}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
          />
        </div>

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete my account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
