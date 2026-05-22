import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { userId } = await auth();

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold tracking-tight">Welcome to CadreOS</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Authenticated dashboard shell is active.
      </p>
      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <p className="text-sm">Signed in user: {userId}</p>
      </div>
    </section>
  );
}
