import { auth } from "@clerk/nextjs/server";

export type AuthContext = {
  userId: string;
  organizationId: string | null;
};

const PHASE_0_MOCK_AUTH_CONTEXT: AuthContext = {
  userId: "phase0-mock-user",
  organizationId: "phase0-mock-org",
};

function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

async function getClerkAuthContext(): Promise<AuthContext | null> {
  if (!isClerkConfigured()) {
    return null;
  }

  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("Unauthenticated request.");
  }

  return {
    userId,
    organizationId: orgId ?? null,
  };
}

// Phase 4B baseline: use Clerk identity when available; keep Phase 0 fallback for non-configured environments.
export async function requireAuthContext(): Promise<AuthContext> {
  if (isClerkConfigured()) {
    const clerkAuthContext = await getClerkAuthContext();

    if (clerkAuthContext) {
      return clerkAuthContext;
    }
  }

  return PHASE_0_MOCK_AUTH_CONTEXT;
}

// Phase 4B baseline: mirror auth context for organization resolution until explicit org authorization is introduced.
export async function requireOrganizationContext(): Promise<AuthContext> {
  return requireAuthContext();
}
