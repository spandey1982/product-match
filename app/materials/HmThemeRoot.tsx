"use client";
import { useEffect } from "react";

/**
 * Applies the `.hm-theme` scope (and font-variable classes) to
 * `<html>` instead of just a wrapping `<div>` (2026-09-10, fixing a real
 * bug found while testing the upload modal). Radix's `Dialog`/`Popover`/
 * etc. portal their content directly to `document.body` — a SIBLING of
 * any wrapping div, not a descendant of it — so a CSS-variable override
 * scoped only to a wrapper div never reached portaled content at all;
 * the "Upload a room" modal's Continue button rendered in the
 * fashion-side's default indigo, not Sage Studio's forest green.
 * `<html>` is a real ancestor of everything, portals included, so
 * scoping there fixes it for every current and future portaled
 * component without touching the shared Dialog component itself.
 * Applied/removed via effect (not directly in JSX) since this needs to
 * mutate `<html>`, which only the root layout renders — added on mount,
 * removed on unmount, so navigating back to the fashion side doesn't
 * carry the class along.
 */
export function HmThemeRoot({ className }: { className: string }) {
  useEffect(() => {
    const classes = className.split(" ").filter(Boolean);
    document.documentElement.classList.add(...classes);
    return () => {
      document.documentElement.classList.remove(...classes);
    };
  }, [className]);
  return null;
}
