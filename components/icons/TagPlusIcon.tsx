import React from "react";

/**
 * TagPlusIcon
 *
 * A product tag with a "+" badge — represents "add a new product to your
 * catalogue". Replaces the generic Upload arrow which reads as "file upload"
 * rather than "add product". Stroke-based, inherits currentColor, scales
 * cleanly at 16–32 px — same conventions as HangerPlusIcon and lucide-react.
 */
export interface TagPlusIconProps
  extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  size?: number | string;
  strokeWidth?: number | string;
}

export function TagPlusIcon({
  size = 24,
  strokeWidth = 2,
  className,
  ...props
}: TagPlusIconProps) {
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
      {/* Tag body — a price/product tag shape */}
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8 8a2 2 0 0 0 2.828 0l5.172-5.172a2 2 0 0 0 0-2.828z" />
      {/* Tag hole */}
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
      {/* Plus — vertical */}
      <line x1="15.5" y1="6" x2="15.5" y2="12" />
      {/* Plus — horizontal */}
      <line x1="12.5" y1="9" x2="18.5" y2="9" />
    </svg>
  );
}
