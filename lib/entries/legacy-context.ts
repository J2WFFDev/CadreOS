export type LegacyContextLink = {
  key: string;
  label: string;
  href: string;
};

export function buildLegacyContextLinks({
  sourceTaskId,
  sourceNoteId,
  followUpEntries,
}: {
  sourceTaskId: string | null;
  sourceNoteId: string | null;
  followUpEntries: Array<{ id: string; title: string }>;
}): LegacyContextLink[] {
  const links: LegacyContextLink[] = [];
  if (sourceTaskId) {
    links.push({ key: `task:${sourceTaskId}`, label: "Created from task source", href: `/tasks/${sourceTaskId}` });
  }
  if (sourceNoteId) {
    links.push({ key: `note:${sourceNoteId}`, label: "Created from note source", href: `/notes/${sourceNoteId}` });
  }
  for (const followUp of followUpEntries) {
    links.push({ key: `follow-up:${followUp.id}`, label: `Follow-up entry: ${followUp.title}`, href: `/entries/${followUp.id}` });
  }
  return links;
}
