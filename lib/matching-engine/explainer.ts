import { ColorMatchResult } from "./color-harmony";
import { CategoryPair } from "./category-rules";

export type ExplainInput = {
  categoryPair: CategoryPair;
  colorMatch: ColorMatchResult;
  occasionScore: number;
  styleScore: number;
  sourceOccasions: string[];
  targetOccasions: string[];
  sourceStyles: string[];
  targetStyles: string[];
};

export type ExplainOutput = {
  explanation: string;
  tags: string[];
};

const OCCASION_LABELS: Record<string, string> = {
  wedding: "Wedding",
  bridal: "Bridal",
  festive: "Festive",
  party: "Party wear",
  casual: "Casual",
  formal: "Formal",
  office: "Office wear",
  traditional: "Traditional",
  religious: "Religious",
  anniversary: "Anniversary",
};

const STYLE_LABELS: Record<string, string> = {
  ethnic: "Ethnic",
  boho: "Boho",
  minimalist: "Minimalist",
  traditional: "Traditional",
  contemporary: "Contemporary",
  fusion: "Fusion",
  royal: "Royal",
  bridal: "Bridal",
  casual: "Casual chic",
  festive: "Festive",
};

export function generateExplanation(input: ExplainInput): ExplainOutput {
  const tags: string[] = [];
  const parts: string[] = [];

  // Category-based explanation
  if (input.categoryPair.score >= 0.9) {
    parts.push(input.categoryPair.label);
  }

  // Occasion-based
  const sharedOccasions = input.sourceOccasions.filter((o) =>
    input.targetOccasions.includes(o)
  );
  if (sharedOccasions.length > 0) {
    const occ = sharedOccasions[0];
    const occLabel = OCCASION_LABELS[occ.toLowerCase()] || occ;
    tags.push(occLabel);
    if (input.occasionScore >= 0.8) {
      parts.push(`${occLabel} coordination`);
    }
  }

  // Style-based
  const sharedStyles = input.sourceStyles.filter((s) =>
    input.targetStyles.includes(s)
  );
  if (sharedStyles.length > 0) {
    const style = sharedStyles[0];
    const styleLabel = STYLE_LABELS[style.toLowerCase()] || style;
    tags.push(`${styleLabel} style`);
    if (input.styleScore >= 0.7) {
      parts.push(`${styleLabel} style coordination`);
    }
  }

  // Color-based
  if (input.colorMatch.score >= 0.8) {
    tags.push(input.colorMatch.label);
    parts.push(input.colorMatch.label);
  } else if (input.colorMatch.score >= 0.6) {
    tags.push(input.colorMatch.label);
  }

  // Add type tags
  if (input.colorMatch.type === "festive") {
    tags.push("Festive pairing");
  } else if (input.colorMatch.type === "tonal") {
    tags.push("Tonal harmony");
  } else if (input.colorMatch.type === "complementary") {
    tags.push("Color contrast");
  }

  // Build final explanation
  let explanation: string;
  if (parts.length === 0) {
    explanation = "Coordinated styling suggestion";
  } else if (parts.length === 1) {
    explanation = parts[0];
  } else {
    // Combine most relevant parts
    explanation = parts.slice(0, 2).join(" · ");
  }

  // De-duplicate tags
  const uniqueTags = [...new Set(tags)].slice(0, 4);

  return { explanation, tags: uniqueTags };
}

