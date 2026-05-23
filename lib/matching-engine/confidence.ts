export function getConfidenceLabel(score: number): string {
  if (score >= 0.85) return "Excellent Match";
  if (score >= 0.7) return "Great Match";
  if (score >= 0.55) return "Good Match";
  if (score >= 0.4) return "Fair Match";
  return "Possible Match";
}
