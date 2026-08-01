// @axis-love/contracts
// Versioned schemas, fixtures, expected results, and feature matrix.
// These types are consumed by both JavaScript (kmd-web) and native (Unity) implementations.

export const CONTRACTS_VERSION = "0.1.0";

/**
 * Feature support states used in the cross-platform feature matrix.
 */
export type FeatureState = "full" | "fallback" | "planned" | "unsupported" | "not-applicable";

/**
 * A single entry in the cross-platform feature matrix.
 */
export interface FeatureMatrixEntry {
  readonly feature: string;
  readonly state: FeatureState;
  readonly notes?: string;
}
