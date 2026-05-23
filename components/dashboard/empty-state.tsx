import Link from "next/link";

type EmptyStateProps = {
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ message, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="rounded-lg border bg-white p-6 text-center dark:bg-zinc-900">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
