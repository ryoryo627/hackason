/**
 * Shared utility functions for HomeCare Admin UI.
 */

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

/**
 * Normalize a risk level string to the standard RiskLevel type.
 */
export function getRiskLevel(level: string): RiskLevel {
  const normalized = level.toUpperCase();
  if (normalized === "HIGH") return "HIGH";
  if (normalized === "MEDIUM") return "MEDIUM";
  return "LOW";
}
