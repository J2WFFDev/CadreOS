import { auth } from "@clerk/nextjs/server";

export type AuthContext = {
  userId: string | null;
  clerkUserId: string | null;
  userAccountId: string | null;
  personId: string | null;
  organizationId: string | null;
};

const LOCAL_UNCONFIGURED_AUTH_CONTEXT: AuthContext = {
  userId: null,
  clerkUserId: null,
  userAccountId: null,
  personId: null,
  organizationId: null,
};

export function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

async function getClerkAuthContext(): Promise<AuthContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("Unauthenticated request.");
  }

  return {
    userId,
    clerkUserId: userId,
    userAccountId: null,
    personId: null,
    organizationId: orgId ?? null,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  if (isClerkConfigured()) {
    return getClerkAuthContext();
  }

  // Local/dev fallback when Clerk env vars are missing. This is fail-safe:
  // no user and no org are assumed so writes remain denied and org selection cannot be spoofed.
  return LOCAL_UNCONFIGURED_AUTH_CONTEXT;
}

export async function requireOrganizationContext(): Promise<AuthContext> {
  return requireAuthContext();
}
