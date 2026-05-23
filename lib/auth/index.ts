import { auth } from "@clerk/nextjs/server";

export type AuthContext = {
  userId: string;
  organizationId: string | null;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const authState = await auth();

  if (!authState.userId) {
    return null;
  }

  return {
    userId: authState.userId,
    organizationId: authState.orgId ?? null,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const authState = await auth();

  if (!authState.userId) {
    authState.redirectToSignIn();
  }

  return {
    userId: authState.userId,
    organizationId: authState.orgId ?? null,
  };
}

export async function requireOrganizationContext(): Promise<AuthContext> {
  return requireAuthContext();
}
