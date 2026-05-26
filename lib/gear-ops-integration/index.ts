/**
 * Arc 20M — GearOps Cross-Module Integration Readiness
 *
 * Public API surface for the gear-ops-integration module.
 * Import from this file rather than from sub-modules directly.
 *
 * Exported surface:
 * - Types — reference contracts, integration context, availability, etc.
 * - Resolver — DB-backed reference lookups and selector option queries.
 * - Guardian — approval boundary evaluation and display helpers.
 * - Context — high-level context selector for GearOps item screens.
 */

export * from "./types";
export * from "./resolver";
export * from "./guardian";
export * from "./context";
