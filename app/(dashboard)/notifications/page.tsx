import { EntryPriority, NotificationDeliveryTiming } from "@prisma/client";
import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/follow-up-tasks";
import {
  countUnreadNotificationsForPerson,
  getNotificationPreferences,
  labelForDeliveryTiming,
  listLiveDueAwareness,
  listNotificationsForPerson,
} from "@/lib/notifications";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function statusClassName(priority: EntryPriority) {
  if (priority === EntryPriority.URGENT) return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
  if (priority === EntryPriority.HIGH) return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300";
}

function dueStateClassName(dueState: "OVERDUE" | "DUE_SOON") {
  return dueState === "OVERDUE"
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
}

export default async function NotificationsPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await getOrganizationScope();
  const searchParams = (await props.searchParams) ?? {};
  const view = searchParams.view === "all" ? "all" : "unread";

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Notifications" description="Lightweight operational awareness and activity routing." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load notifications right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Notifications" description="Lightweight operational awareness and activity routing." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  if (!scope.auth.personId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Notifications" description="Lightweight operational awareness and activity routing." />
        <ErrorMessage message="Link your account to a person before using the notification center." />
      </section>
    );
  }

  const [preferences, notifications, unreadCount, dueItems, pendingDigest] = await Promise.all([
    getNotificationPreferences(scope.organizationId, scope.auth.personId),
    listNotificationsForPerson({
      organizationId: scope.organizationId,
      personId: scope.auth.personId,
      includeRead: view === "all",
      limit: 60,
    }),
    countUnreadNotificationsForPerson(scope.organizationId, scope.auth.personId),
    listLiveDueAwareness({
      organizationId: scope.organizationId,
      personId: scope.auth.personId,
    }),
    db.notificationDigest.findFirst({
      where: {
        organizationId: scope.organizationId,
        personId: scope.auth.personId,
        status: "PENDING",
      },
      orderBy: { windowEndsAt: "asc" },
      select: { windowEndsAt: true },
    }),
  ]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Calm operational awareness for assignments, workflow follow-through, linked issues, and lightweight due attention."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={view === "all" ? "/notifications" : "/notifications?view=all"}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {view === "all" ? "Unread view" : "All activity"}
            </Link>
            {unreadCount > 0 ? (
              <form action="/notifications/read-all" method="post">
                <input type="hidden" name="returnTo" value={view === "all" ? "/notifications?view=all" : "/notifications"} />
                <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                  Mark all read
                </button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span>{unreadCount} unread notification(s)</span>
              <span>{notifications.length} visible in this view</span>
              <span>Delivery mode: {labelForDeliveryTiming(preferences.deliveryTiming)}</span>
              {pendingDigest ? <span>Digest placeholder queued until {formatDateTime(pendingDigest.windowEndsAt)}</span> : null}
            </div>
          </div>

          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="rounded-lg border bg-white p-6 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                No {view === "all" ? "notification activity" : "unread notifications"} right now.
              </div>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${statusClassName(notification.priority)}`}>
                          {notification.priority.toLowerCase()}
                        </span>
                        <span>{notification.categoryLabel}</span>
                        <span>{notification.awarenessEventLabel}</span>
                        {notification.eventCount > 1 ? <span>{notification.eventCount} updates</span> : null}
                        <span>{formatDateTime(notification.lastEventAt)}</span>
                        {notification.actorLabel ? <span>by {notification.actorLabel}</span> : null}
                      </div>
                      <div>
                        <Link href={notification.href} className="text-base font-medium underline">
                          {notification.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{notification.body}</p>
                      </div>
                    </div>

                    <form
                      action={notification.readAt ? `/notifications/${notification.id}/unread` : `/notifications/${notification.id}/read`}
                      method="post"
                      className="shrink-0"
                    >
                      <input type="hidden" name="returnTo" value={view === "all" ? "/notifications?view=all" : "/notifications"} />
                      <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        {notification.readAt ? "Mark unread" : "Mark read"}
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Due awareness
            </h2>
            {!preferences.dueEnabled ? (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Due/overdue awareness is muted in your preferences.
              </p>
            ) : dueItems.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No overdue or near-due assigned work right now.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {dueItems.map((item) => (
                  <div key={item.entryId} className="rounded border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${dueStateClassName(item.dueState)}`}>
                        {item.dueState === "OVERDUE" ? "Overdue" : "Due soon"}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassName(item.priority)}`}>
                        {item.priority.toLowerCase()}
                      </span>
                    </div>
                    <Link href={item.href} className="mt-2 block font-medium underline">
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Due {formatDateTime(item.dueDate)}{item.teamName ? ` · ${item.teamName}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Preferences foundation
            </h2>
            <form action="/notifications/preferences/update" method="post" className="mt-3 space-y-3 text-sm">
              <input type="hidden" name="returnTo" value={view === "all" ? "/notifications?view=all" : "/notifications"} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Minimum priority</span>
                  <select name="minimumPriority" defaultValue={preferences.minimumPriority} className="w-full rounded-md border px-3 py-2">
                    {Object.values(EntryPriority).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Delivery timing</span>
                  <select name="deliveryTiming" defaultValue={preferences.deliveryTiming} className="w-full rounded-md border px-3 py-2">
                    {Object.values(NotificationDeliveryTiming).map((value) => (
                      <option key={value} value={value}>
                        {labelForDeliveryTiming(value)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Digest window hours</span>
                <input name="digestWindowHours" type="number" min={1} max={168} defaultValue={preferences.digestWindowHours} className="w-full rounded-md border px-3 py-2" />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["assignmentEnabled", "Assignment awareness", preferences.assignmentEnabled],
                  ["followUpEnabled", "Follow-up awareness", preferences.followUpEnabled],
                  ["readinessEnabled", "Readiness awareness", preferences.readinessEnabled],
                  ["workflowEnabled", "Workflow awareness", preferences.workflowEnabled],
                  ["statusEnabled", "Status awareness", preferences.statusEnabled],
                  ["linkedIssueEnabled", "Linked issue awareness", preferences.linkedIssueEnabled],
                  ["attendanceEnabled", "Attendance awareness", preferences.attendanceEnabled],
                  ["dueEnabled", "Due/overdue awareness", preferences.dueEnabled],
                ] as const).map(([name, label, checked]) => (
                  <label key={name} className="flex items-center gap-2 rounded border px-3 py-2">
                    <input name={name} type="checkbox" defaultChecked={Boolean(checked)} value="1" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                Save preferences
              </button>
            </form>
          </div>

          <div className="rounded-lg border bg-white p-4 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Deferred delivery scope remains lightweight: CadreOS stores digest placeholders and in-app relevance state only. Email, SMS, push, and automated broadcast scheduling stay deferred until a later delivery arc.
          </div>
        </div>
      </div>
    </section>
  );
}
