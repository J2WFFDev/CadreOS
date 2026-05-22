export type AuthContext = {
  userId: string;
  organizationId: string | null;
};

const PHASE_0_MOCK_AUTH_CONTEXT: AuthContext = {
  userId: "phase0-mock-user",
  organizationId: "phase0-mock-org",
};

// Phase 0 stub: real authentication and organization resolution are deferred.
export async function requireAuthContext(): Promise<AuthContext> {
  return PHASE_0_MOCK_AUTH_CONTEXT;
}

// Phase 0 stub: replace with real authorization checks in the auth phase.
export async function requireOrganizationContext(): Promise<AuthContext> {
  return PHASE_0_MOCK_AUTH_CONTEXT;
}
