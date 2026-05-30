import { EntryType } from "@prisma/client";

export const DECISION_CLASSIFICATION_VALUES = ["SOFT", "HARD"] as const;
export type DecisionClassificationValue = (typeof DECISION_CLASSIFICATION_VALUES)[number];

export const DECISION_MATURITY_RESULT_VALUES = ["SUCCESSFUL", "PARTIALLY_SUCCESSFUL", "FAILED"] as const;
export type DecisionMaturityResultValue = (typeof DECISION_MATURITY_RESULT_VALUES)[number];

export type DecisionEntryPayload = {
  decisionStatement: string;
  decisionDetails: string;
  decisionMaker: string;
  supporters: string[];
  opposition: string[];
  classification: DecisionClassificationValue | null;
  decisionDate: string | null;
  maturityDate: string | null;
  maturityResult: DecisionMaturityResultValue | null;
  maturityReviewNotes: string;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createEmptyDecisionEntryPayload(): DecisionEntryPayload {
  return {
    decisionStatement: "",
    decisionDetails: "",
    decisionMaker: "",
    supporters: [],
    opposition: [],
    classification: null,
    decisionDate: null,
    maturityDate: null,
    maturityResult: null,
    maturityReviewNotes: "",
  };
}

export function parseDecisionEntryPayload(payloadJson: string | null | undefined): DecisionEntryPayload {
  if (!payloadJson) return createEmptyDecisionEntryPayload();

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return createEmptyDecisionEntryPayload();

    const classification = normalizeDecisionClassification(asOptionalString(parsed.classification));
    const maturityResult = normalizeDecisionMaturityResult(asOptionalString(parsed.maturityResult));

    return {
      decisionStatement: asOptionalString(parsed.decisionStatement),
      decisionDetails: asOptionalString(parsed.decisionDetails),
      decisionMaker: asOptionalString(parsed.decisionMaker),
      supporters: asNameList(parsed.supporters),
      opposition: asNameList(parsed.opposition),
      classification,
      decisionDate: normalizeDecisionDateOnly(asOptionalString(parsed.decisionDate)),
      maturityDate: normalizeDecisionDateOnly(asOptionalString(parsed.maturityDate)),
      maturityResult,
      maturityReviewNotes: asOptionalString(parsed.maturityReviewNotes),
    };
  } catch {
    return createEmptyDecisionEntryPayload();
  }
}

export function serializeDecisionEntryPayload(payload: DecisionEntryPayload) {
  return JSON.stringify(payload);
}

export function parseDecisionParticipantNames(input: string) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of input.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return names;
}

export function formatDecisionParticipantNames(input: string[] | null | undefined) {
  if (!Array.isArray(input)) return "";
  return input.join("\n");
}

export function isDecisionPayloadType(payloadType: EntryType) {
  return payloadType === EntryType.DECISION;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDecisionDateOnly(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_ONLY_PATTERN.test(trimmed) ? trimmed : null;
}

function asNameList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return names;
}

export function normalizeDecisionClassification(value: string | null | undefined): DecisionClassificationValue | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return DECISION_CLASSIFICATION_VALUES.includes(normalized as DecisionClassificationValue)
    ? (normalized as DecisionClassificationValue)
    : null;
}

export function normalizeDecisionMaturityResult(value: string | null | undefined): DecisionMaturityResultValue | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return DECISION_MATURITY_RESULT_VALUES.includes(normalized as DecisionMaturityResultValue)
    ? (normalized as DecisionMaturityResultValue)
    : null;
}
