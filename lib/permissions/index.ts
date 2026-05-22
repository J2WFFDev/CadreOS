export type PermissionCheckInput = {
  actorUserId: string;
  organizationId: string;
  programId?: string | null;
  teamId?: string | null;
  action: string;
};

export async function canPerformAction(input: PermissionCheckInput): Promise<boolean> {
  void input;
  return false;
}

export async function requirePermission(input: PermissionCheckInput): Promise<void> {
  const allowed = await canPerformAction(input);

  if (!allowed) {
    throw new Error("FORBIDDEN");
  }
}
