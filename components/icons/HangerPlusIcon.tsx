import React from "react";

/**
 * HangerPlusIcon
 *
 * Custom stroke-based SVG icon — a clothes hanger with a "+" badge overlapping
 * the right shoulder arm, representing "add to virtual try-on".
 *
 * Design conventions:
 * - Pure stroke, no fill (matches lucide-react style)
 * - Inherits color from `currentColor` → hover/active/disabled driven by CSS
 * - `strokeWidth` defaults to 2 (same as lucide default); override with prop
 * - Scales cleanly at 16 / 20 / 24 / 32 px via the `size` prop
 * - Works in both light and dark themes
 *
 * Usage:
 *   <HangerPlusIcon className="h-5 w-5 text-indigo-600" />
 *   <HangerPlusIcon size={20} strokeWidth={1.5} />
 */
export interface HangerPlusIconProps
  extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  size?: number | string;
  strokeWidth?: number | string;
}

export function HangerPlusIcon({
  size = 24,
  strokeWidth = 2,
  className,
  ...props
}: HangerPlusIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/*
       * Hook — a short neck topped by a semicircle curving to the right.
       * Center of semicircle: (13.5, 3.5), radius 1.5
       * This creates a clean, readable hook at 16-32 px.
       */}
      <path d="M12 5 A1.5 1.5 0 0 1 12 2" />

      {/* Neck connecting hook to shoulder junction */}
      <line x1="12" y1="5" x2="12" y2="7.5" />

      {/* Left shoulder arm */}
      <line x1="12" y1="7.5" x2="3" y2="19" />

      {/* Right shoulder arm */}
      <line x1="12" y1="7.5" x2="21" y2="19" />

      {/*
       * Plus badge — centered at (18, 15) which lies on the right arm.
       * The plus arms are 3 px in each direction from center.
       * The intersection with the shoulder arm is intentional and creates
       * the visual "overlapping badge" effect described in the design brief.
       */}
      {/* Plus — vertical */}
      <line x1="18" y1="12" x2="18" y2="18" />
      {/* Plus — horizontal */}
      <line x1="15" y1="15" x2="21" y2="15" />
    </svg>
  );
}
