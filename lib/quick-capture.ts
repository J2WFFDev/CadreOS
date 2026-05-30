export const QUICK_CAPTURE_PRESETS = {
  QUICK_TASK: {
    label: "Task",
    entryType: "TASK",
    defaultTags: [],
  },
} as const;

export type QuickCaptureType = keyof typeof QUICK_CAPTURE_PRESETS;
export type QuickCaptureEntryType = (typeof QUICK_CAPTURE_PRESETS)[QuickCaptureType]["entryType"];
export type QuickCapturePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type QuickCaptureDueShortcut = "TODAY" | "TOMORROW" | "NEXT_WEEK";
export type QuickCaptureContextTargetType = "PERSON" | "TEAM" | "EVENT" | "GEAR_ITEM" | "RESOURCE_BOOKING";

export type QuickCaptureContext = {
  targetType: QuickCaptureContextTargetType;
  targetId: string;
  label: string;
};

const QUICK_CAPTURE_PRIORITIES: QuickCapturePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const QUICK_CAPTURE_DUE_SHORTCUTS: QuickCaptureDueShortcut[] = ["TODAY", "TOMORROW", "NEXT_WEEK"];
const QUICK_CAPTURE_CONTEXT_TARGET_TYPES: QuickCaptureContextTargetType[] = ["PERSON", "TEAM", "EVENT", "GEAR_ITEM", "RESOURCE_BOOKING"];

export function isQuickCaptureType(value: string): value is QuickCaptureType {
  return value in QUICK_CAPTURE_PRESETS;
}

export function getQuickCapturePreset(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!isQuickCaptureType(normalized)) return null;
  return QUICK_CAPTURE_PRESETS[normalized];
}

export function resolveQuickCaptureEntryType(input: {
  captureType?: string | null;
  legacyEntryType?: string | null;
  inferredType?: "TASK" | "NOTE";
}): QuickCaptureEntryType {
  void input;
  return "TASK";
}

export function normalizeQuickCapturePriority(value: string | null | undefined, fallback: QuickCapturePriority): QuickCapturePriority {
  const normalized = (value ?? "").trim().toUpperCase();
  return QUICK_CAPTURE_PRIORITIES.includes(normalized as QuickCapturePriority) ? (normalized as QuickCapturePriority) : fallback;
}

export function resolveQuickCaptureDueDate(value: string | null | undefined, now: Date = new Date()) {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!QUICK_CAPTURE_DUE_SHORTCUTS.includes(normalized as QuickCaptureDueShortcut)) {
    return null;
  }

  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (normalized === "TODAY") return base;
  if (normalized === "TOMORROW") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));
}

export function isQuickCaptureContextTargetType(value: string): value is QuickCaptureContextTargetType {
  return QUICK_CAPTURE_CONTEXT_TARGET_TYPES.includes(value as QuickCaptureContextTargetType);
}

export function inferQuickCaptureContextFromPath(pathname: string): QuickCaptureContext | null {
  const normalized = pathname.trim();
  const patterns: Array<{ regex: RegExp; targetType: QuickCaptureContextTargetType; labelPrefix: string }> = [
    { regex: /^\/teams\/([^/]+)/, targetType: "TEAM", labelPrefix: "Team" },
    { regex: /^\/events\/([^/]+)/, targetType: "EVENT", labelPrefix: "Event" },
    { regex: /^\/gear-ops\/items\/([^/]+)/, targetType: "GEAR_ITEM", labelPrefix: "Gear item" },
    { regex: /^\/people\/([^/]+)/, targetType: "PERSON", labelPrefix: "Person" },
    { regex: /^\/field-ops\/bookings\/([^/]+)/, targetType: "RESOURCE_BOOKING", labelPrefix: "Booking" },
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);
    if (!match?.[1]) continue;

    return {
      targetType: pattern.targetType,
      targetId: decodeURIComponent(match[1]),
      label: `${pattern.labelPrefix} context auto-linked`,
    };
  }

  return null;
}
