import type { EntryPriorityValue, EntryQuickAddParseResult } from "@/lib/entries/types";

const ACTION_KEYWORDS = [
  "todo",
  "to-do",
  "follow up",
  "follow-up",
  "call",
  "email",
  "send",
  "review",
  "prepare",
  "schedule",
  "submit",
  "finish",
  "complete",
  "remind",
];

const DATE_SIGNAL_PATTERN = /\b(today|tomorrow|tonight|next week|next month|due|by|before|at \d{1,2}(:\d{2})?)\b/i;

function normalizeInput(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function parseTags(input: string) {
  return Array.from(new Set([...input.matchAll(/#([a-zA-Z0-9_-]+)/g)].map((match) => match[1].toLowerCase())));
}

function parseAssigneeHandle(input: string) {
  const match = input.match(/@([a-zA-Z0-9._-]+)/);
  return match?.[1] ?? null;
}

function parsePriority(input: string): EntryPriorityValue {
  if (/\b(!{3}|p1|high|urgent)\b/i.test(input)) return "URGENT";
  if (/\b(!{2}|p2)\b/i.test(input)) return "HIGH";
  if (/\b(!|p3)\b/i.test(input)) return "MEDIUM";
  if (/\b(p4|low)\b/i.test(input)) return "LOW";
  return "MEDIUM";
}

function parseDueDate(input: string, now: Date) {
  const lower = input.toLowerCase();
  if (lower.includes("today")) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (lower.includes("tomorrow")) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  }
  if (lower.includes("next week")) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));
  }
  if (lower.includes("next month")) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()));
  }

  const explicit = input.match(/\b(?:on|by|due)\s+(\d{4}-\d{2}-\d{2})\b/i) ?? input.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (!explicit) return null;
  const parsed = new Date(`${explicit[1]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDueTime(input: string) {
  const match = input.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseRecurrenceRule(input: string) {
  const match = input.match(/\bevery\s+(day|daily|week|weekly|month|monthly)\b/i);
  if (!match) return null;
  const token = match[1].toLowerCase();
  if (token === "day" || token === "daily") return "FREQ=DAILY";
  if (token === "week" || token === "weekly") return "FREQ=WEEKLY";
  if (token === "month" || token === "monthly") return "FREQ=MONTHLY";
  return null;
}

function hasActionLanguage(input: string) {
  const lower = input.toLowerCase();
  return ACTION_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function inferType(input: string): "TASK" | "NOTE" {
  if (hasActionLanguage(input) || DATE_SIGNAL_PATTERN.test(input)) return "TASK";
  return "NOTE";
}

export function parseQuickAddEntryInput(rawInput: string, now: Date = new Date()): EntryQuickAddParseResult {
  const normalized = normalizeInput(rawInput);
  const inferredType = inferType(normalized);
  const dueDate = inferredType === "TASK" ? parseDueDate(normalized, now) : null;
  const dueTime = inferredType === "TASK" ? parseDueTime(normalized) : null;
  const recurrenceRule = inferredType === "TASK" ? parseRecurrenceRule(normalized) : null;

  return {
    inferredType,
    title: normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized,
    content: normalized,
    tags: parseTags(normalized),
    priority: parsePriority(normalized),
    dueDate,
    dueTime,
    recurrenceRule,
    assigneeHandle: parseAssigneeHandle(normalized),
  };
}
