import type { SVGProps } from "react";

/** A stylized D20 (icosahedron) die, drawn as a hexagonal outline with
 * internal facet lines — the shape D&D players actually associate with
 * "the d20", rather than a generic six-sided die emoji. */
export function D20Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2 L21 7.5 V16.5 L12 22 L3 16.5 V7.5 Z" />
      <path d="M12 2 V9" />
      <path d="M3 7.5 L12 9 L21 7.5" />
      <path d="M3 16.5 L12 9 L21 16.5" />
      <path d="M12 9 L12 22" />
    </svg>
  );
}
