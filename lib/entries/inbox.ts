import { EntryPriority, EntryType } from "@prisma/client";

type InboxRoutingContext = {
  entryType: EntryType;
  contextTargetId: string | null;
};

export function shouldRouteEntryToInbox(context: InboxRoutingContext) {
  // Arc 24D.2: quick capture is Inbox-first, so due dates do not remove captures from inbox triage.
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
