import { EntryType } from "@prisma/client";

export const USER_SELECTABLE_ENTRY_TYPES: EntryType[] = [
  EntryType.TASK,
  EntryType.NOTE,
  EntryType.EVENT,
  EntryType.DECISION,
  EntryType.HABIT,
  EntryType.JOURNAL,
];
