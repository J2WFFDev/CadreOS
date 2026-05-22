export default function DashboardPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold tracking-tight">Welcome to CadreOS</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Dashboard shell is active with authentication deferred for Phase 0.
      </p>
      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <p className="text-sm">Auth provider integration will be implemented in a later phase.</p>
      </div>
    </section>
  );
}
