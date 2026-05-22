import { auth } from "@clerk/nextjs/server";

export type AuthContext = {
  userId: string;
  organizationId: string | null;
};

export async function requireAuthContext(): Promise<AuthContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    userId,
    organizationId: orgId ?? null,
  };
}

export async function requireOrganizationContext(): Promise<AuthContext> {
  const context = await requireAuthContext();

  if (!context.organizationId) {
    throw new Error("FORBIDDEN");
  }

  return context;
}
