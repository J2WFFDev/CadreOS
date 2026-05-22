import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">CadreOS</h1>
      <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
        Coach-centered operations system foundation. Phase 0 public landing page.
      </p>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Authentication is intentionally deferred for Phase 0 foundation work.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
      >
        Open dashboard shell
      </Link>
    </main>
  );
}
