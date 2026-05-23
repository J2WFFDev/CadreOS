import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";

export type AuthContext = {
  userId: string;
  organizationId: string | null;
};

export async function requireAuthContext(): Promise<AuthContext> {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  const linkedAccount = await db.userAccount.findUnique({
    where: { clerkUserId: userId },
    select: { organizationId: true },
  });

  return {
    userId,
    organizationId: linkedAccount?.organizationId ?? null,
  };
}

export async function requireOrganizationContext(): Promise<AuthContext> {
  return requireAuthContext();
}
