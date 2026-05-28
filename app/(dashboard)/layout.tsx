import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { BuildMetadataBadge } from "@/components/build-metadata-badge";
import { DevPersonaSwitcher } from "@/components/dev-persona-switcher";
import { QuickCaptureLauncher } from "@/components/dashboard/quick-capture-launcher";
import { GearOfflineProvider } from "@/components/gear-ops/offline-provider";
import { NavSidebar } from "@/components/nav-sidebar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isDevPersonasEnabled } from "@/lib/auth/devPersonas";
import { db } from "@/lib/db";
import { countUnreadNotificationsForPerson } from "@/lib/notifications";
import { getOrganizationScope } from "@/lib/organization-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = await getOrganizationScope();
  const currentUser = await getCurrentUser();
  const shouldShowLinkingBanner = scope.auth.unresolvedPersonLink;
  const assignees =
    scope.databaseReady && scope.organizationId
      ? await db.person.findMany({
          where: { organizationId: scope.organizationId, lifecycleStatus: { not: "ARCHIVED" } },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
          take: 200,
        })
      : [];
  const unreadNotificationCount =
    scope.databaseReady && scope.organizationId && scope.auth.personId
      ? await countUnreadNotificationsForPerson(scope.organizationId, scope.auth.personId)
      : 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3 dark:bg-zinc-900">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          CadreOS
        </Link>
        <QuickCaptureLauncher
          assignees={assignees.map((person) => ({ id: person.id, name: `${person.firstName} ${person.lastName}`.trim() }))}
          defaultAssigneePersonId={scope.auth.personId}
          disabled={!scope.databaseReady || !scope.organizationId}
        />
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          {isDevPersonasEnabled() ? (
            <DevPersonaSwitcher currentPersonaId={currentUser?.isDevPersona ? currentUser.id : null} />
          ) : null}
          <BuildMetadataBadge />
          <Link
            href="/account"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Account
          </Link>
          <UserButton />
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-49px)]">
        <NavSidebar unreadNotificationCount={unreadNotificationCount} currentUser={currentUser} />
        <main className="flex-1 overflow-auto p-6">
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
