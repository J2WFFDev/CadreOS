import { EntryPriority, EntryType } from "@prisma/client";

type InboxRoutingContext = {
  entryType: EntryType;
  contextTargetId: string | null;
};

export function shouldRouteEntryToInbox(context: InboxRoutingContext) {
  if (context.contextTargetId) return false;
  if (context.entryType === EntryType.EVENT) return false;
  return true;
}

export function mapEntryPriorityToInboxPriority(priority: EntryPriority) {
  if (priority === EntryPriority.URGENT) return 40;
  if (priority === EntryPriority.HIGH) return 30;
  if (priority === EntryPriority.MEDIUM) return 20;
  return 10;
}
