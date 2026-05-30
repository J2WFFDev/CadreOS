import { Prisma } from "@prisma/client";

export const ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE =
  "Entry list assignment is temporarily unavailable until setup is complete.";
export const ENTRY_LIST_MIGRATION_NAME = "20260530000000_arc24d4_entry_list_management";
export const ENTRY_TYPE_PAYLOAD_MIGRATION_NAME = "20260530010000_arc24d5_entry_type_payloads";
export const ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE =
  "Decision metadata is temporarily unavailable until setup is complete.";

export type EntryListSchemaRequirement = "EntryList" | "Entry.listId" | "EntryListScope";

export type EntryListSchemaIssue = {
  missing: EntryListSchemaRequirement[];
  detail: string;
};

export type EntryTypePayloadSchemaRequirement = "EntryTypePayload";

export type EntryTypePayloadSchemaIssue = {
  missing: EntryTypePayloadSchemaRequirement[];
  detail: string;
};

function includesValue(source: string | null | undefined, value: string) {
  return source?.toLowerCase().includes(value.toLowerCase()) ?? false;
}

function stringifyErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function getEntryListSchemaIssue(error: unknown): EntryListSchemaIssue | null {
  const missing = new Set<EntryListSchemaRequirement>();
  const details: string[] = [];

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = (error.meta ?? {}) as Record<string, unknown>;
    const table = typeof meta.table === "string" ? meta.table : null;
    const column = typeof meta.column === "string" ? meta.column : null;

    if (error.code === "P2021" && includesValue(table, "EntryList")) {
      missing.add("EntryList");
      details.push(`Missing database table: ${table}`);
    }

    if (error.code === "P2022" && (includesValue(column, "Entry.listId") || includesValue(column, "listId"))) {
      missing.add("Entry.listId");
      details.push(`Missing database column: ${column ?? "Entry.listId"}`);
    }
  }

  const message = stringifyErrorMessage(error);

  if (
    includesValue(message, "EntryListScope")
    && (includesValue(message, "does not exist") || includesValue(message, "invalid input value") || includesValue(message, "enum"))
  ) {
    missing.add("EntryListScope");
    details.push("Missing database enum: EntryListScope");
  }

  if (missing.size === 0) {
    return null;
  }

  return {
    missing: Array.from(missing),
    detail: details.join("; "),
  };
}

export function getEntryTypePayloadSchemaIssue(error: unknown): EntryTypePayloadSchemaIssue | null {
  const missing = new Set<EntryTypePayloadSchemaRequirement>();
  const details: string[] = [];

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = (error.meta ?? {}) as Record<string, unknown>;
    const table = typeof meta.table === "string" ? meta.table : null;

    if (error.code === "P2021" && includesValue(table, "EntryTypePayload")) {
      missing.add("EntryTypePayload");
      details.push(`Missing database table: ${table}`);
    }
  }

  const message = stringifyErrorMessage(error);
  if (
    includesValue(message, "entrytypepayload")
    && (includesValue(message, "does not exist") || includesValue(message, "relation"))
  ) {
    missing.add("EntryTypePayload");
    details.push("Missing database table: EntryTypePayload");
  }

  if (missing.size === 0) {
    return null;
  }

  return {
    missing: Array.from(missing),
    detail: details.join("; "),
  };
}

export function formatEntryListSetupIncompleteMessage() {
  return `Entry list setup is incomplete in this environment. Run migration ${ENTRY_LIST_MIGRATION_NAME} to enable entry lists.`;
}

export function formatEntryTypePayloadSetupIncompleteMessage() {
  return `Entry type payload setup is incomplete in this environment. Run migration ${ENTRY_TYPE_PAYLOAD_MIGRATION_NAME} to enable structured type payloads.`;
}

export function logEntryListSchemaIssue(query: string, error: unknown, extra?: Record<string, unknown>) {
  const issue = getEntryListSchemaIssue(error);

  if (!issue) {
    return null;
  }

  console.warn("[entry-lists.schema]", {
    query,
    detail: issue.detail,
    missing: issue.missing,
    ...extra,
    error,
  });

  return issue;
}

export function logEntryTypePayloadSchemaIssue(query: string, error: unknown, extra?: Record<string, unknown>) {
  const issue = getEntryTypePayloadSchemaIssue(error);

  if (!issue) {
    return null;
  }

  console.warn("[entry-type-payload.schema]", {
    query,
    detail: issue.detail,
    missing: issue.missing,
    ...extra,
    error,
  });

  return issue;
}
