import type { ReactNode } from "react";

/** Shared size scale used across multiple components. */
export type Size = "xs" | "sm" | "md" | "lg";

/** Common props accepted by most primitive components. */
export interface BaseProps {
  className?: string;
  children?: ReactNode;
}
