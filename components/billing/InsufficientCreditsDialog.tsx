"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  remainingPercentage?: number;
}

export function InsufficientCreditsDialog({ open, onClose, remainingPercentage }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 z-10">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Credits Running Low
          </h3>

          {remainingPercentage != null && (
            <div className="mb-3">
              <div className="w-48 h-2 rounded-full bg-gray-200 overflow-hidden mx-auto">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${remainingPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {remainingPercentage}% remaining
              </p>
            </div>
          )}

          <p className="text-sm text-gray-600 mb-5">
            You don&apos;t have enough credits to complete this operation.
            Please contact your admin to add more credits.
          </p>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function useInsufficientCredits() {
  const [state, setState] = useState<{
    open: boolean;
    remainingPercentage?: number;
  }>({ open: false });

  const show = (remainingPercentage?: number) => {
    setState({ open: true, remainingPercentage });
  };

  const close = () => setState({ open: false });

  return { ...state, show, close };
}
