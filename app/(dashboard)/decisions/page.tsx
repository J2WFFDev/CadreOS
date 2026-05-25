import Link from "next/link";
import { EntryType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Decisions" description="Operational decision records and follow-through." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load decisions right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Decisions" description="Operational decision records and follow-through." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const entries = await db.entry.findMany({
    where: {
      organizationId: scope.organizationId,
      type: EntryType.DECISION,
      deletedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, title: true, content: true, status: true, updatedAt: true },
    take: 200,
  });

  return (
    <section className="space-y-4">
      <PageHeader title="Decisions" description="Operational decision records and follow-through." />

      {entries.length === 0 ? (
        <EmptyState
          message="No decision entries exist yet."
          actionHref="/entries?type=DECISION"
          actionLabel="Create via Quick Add"
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <h3 className="text-base font-semibold">
                <Link href={`/entries/${entry.id}`} className="underline">
                  {entry.title}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {entry.content?.slice(0, 260) ?? "No decision context recorded yet."}
              </p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Status: {entry.status} · Updated: {entry.updatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
