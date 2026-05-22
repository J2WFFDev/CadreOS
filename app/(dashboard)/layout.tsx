export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">CadreOS Dashboard</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Auth deferred (Phase 0)</span>
      </header>
      <main className="mx-auto w-full max-w-6xl p-6">{children}</main>
    </div>
  );
}
