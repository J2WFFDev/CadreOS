import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { BuildMetadataBadge } from "@/components/build-metadata-badge";
import { DevPersonaSwitcher } from "@/components/dev-persona-switcher";
import { QuickCaptureLauncher } from "@/components/dashboard/quick-capture-launcher";
import { GearOfflineProvider } from "@/components/gear-ops/offline-provider";
import { NavSidebar } from "@/components/nav-sidebar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDevPersonaById, getDevPersonaFeatureStatus } from "@/lib/auth/devPersonas";
import { countUnreadNotificationsForPerson } from "@/lib/notifications";
import { getOrganizationScope } from "@/lib/organization-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = await getOrganizationScope();
  const currentUser = await getCurrentUser();
  const devFeatureStatus = getDevPersonaFeatureStatus();
  const shouldShowLinkingBanner = scope.auth.unresolvedPersonLink;
  const unreadNotificationCount =
    scope.databaseReady && scope.organizationId && scope.auth.personId
      ? await countUnreadNotificationsForPerson(scope.organizationId, scope.auth.personId)
      : 0;

  const activePersona =
    devFeatureStatus.enabled && currentUser?.isDevPersona
      ? getDevPersonaById(currentUser.id)
      : null;
  const resolvedAccountName = currentUser?.name.trim() ?? "";
  const canShowAccountName = Boolean(scope.auth.personId) || currentUser?.isDevPersona === true;
  const isPlaceholderAccountName = resolvedAccountName.toLowerCase() === "clerk user";
  const accountDisplayName =
    canShowAccountName && resolvedAccountName && !isPlaceholderAccountName
      ? resolvedAccountName
      : "";
  const accountLabel = accountDisplayName || "Account";

  // Show a diagnostic when NEXT_PUBLIC_ENABLE_DEV_PERSONAS is set but the
  // switcher is blocked by the production guard. This helps diagnose Vercel
  // preview deployments where NODE_ENV=production and only one env var is set.
  const showBlockedDiagnostic =
    devFeatureStatus.nextPublicEnabled && !devFeatureStatus.enabled;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 md:flex md:h-screen md:flex-col md:overflow-hidden">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b bg-white px-6 py-3 dark:bg-zinc-900">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          CadreOS
        </Link>
        <QuickCaptureLauncher disabled={!scope.databaseReady || !scope.organizationId} />
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          {devFeatureStatus.enabled ? (
            <DevPersonaSwitcher currentPersonaId={currentUser?.isDevPersona ? currentUser.id : null} />
          ) : null}
          {activePersona ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Dev Persona: {activePersona.label}
            </span>
          ) : null}
          {showBlockedDiagnostic ? (
            <span
              className="rounded border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs text-orange-700 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
              title={`Dev Persona switcher blocked: ${devFeatureStatus.reason}`}
            >
              Dev Persona: blocked
            </span>
          ) : null}
          <BuildMetadataBadge />
          <Link
            href="/account"
            className="max-w-32 truncate text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 sm:max-w-48"
            title={accountDisplayName ? `Account: ${accountDisplayName}` : "Account"}
          >
            {accountLabel}
          </Link>
          <UserButton />
        </div>
      </header>
      <div className="flex flex-col md:min-h-0 md:flex-1 md:flex-row md:overflow-hidden">
        <NavSidebar unreadNotificationCount={unreadNotificationCount} currentUser={currentUser} />
        <main className="flex-1 overflow-auto p-4 md:min-h-0 md:p-6">
          <div className="mx-auto w-full max-w-5xl space-y-4">
            {shouldShowLinkingBanner ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  Your account is signed in with Clerk but is not linked to a CadreOS person yet.{" "}
                  <Link href="/account/link-person" className="underline">
                    Link a person now
                  </Link>
                  .
                </p>
              </div>
            ) : null}
            <GearOfflineProvider organizationId={scope.organizationId}>{children}</GearOfflineProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
