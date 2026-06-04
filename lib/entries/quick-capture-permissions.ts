export function canQuickCaptureCreateForAssignee(input: {
  actorPersonId: string;
  assigneePersonId: string;
  hasContextTarget: boolean;
  hasTaskCreatePermission: boolean;
}): boolean {
  if (input.hasTaskCreatePermission) {
    return true;
  }

  return !input.hasContextTarget && input.assigneePersonId === input.actorPersonId;
}
