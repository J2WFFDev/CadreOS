const USAGE_LOG_PREFIX = "Usage log:";

export function buildGearCheckoutReturnNotes(input: {
  usageLog: string | null | undefined;
  returnNotes: string | null | undefined;
}): string | null {
  const usageLog = input.usageLog?.trim() ?? "";
  const returnNotes = input.returnNotes?.trim() ?? "";
  const sections: string[] = [];

  if (usageLog.length > 0) {
    sections.push(`${USAGE_LOG_PREFIX} ${usageLog}`);
  }

  if (returnNotes.length > 0) {
    sections.push(returnNotes);
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}

export function parseGearCheckoutReturnNotes(returnNotes: string | null | undefined): {
  usageLog: string;
  returnNotes: string;
} {
  const normalized = returnNotes?.trim() ?? "";
  if (normalized.length === 0) {
    return { usageLog: "", returnNotes: "" };
  }

  const [firstBlock, ...remainingBlocks] = normalized.split(/\n\s*\n/);
  if (!firstBlock.startsWith(USAGE_LOG_PREFIX)) {
    return { usageLog: "", returnNotes: normalized };
  }

  const usageLog = firstBlock.slice(USAGE_LOG_PREFIX.length).trim();
  return {
    usageLog,
    returnNotes: remainingBlocks.join("\n\n").trim(),
  };
}

export function buildGearCheckoutUsageHistoryLabel(usageLog: string | null | undefined): string | null {
  const normalized = usageLog?.trim() ?? "";
  return normalized.length > 0 ? `${USAGE_LOG_PREFIX} ${normalized}` : null;
}
