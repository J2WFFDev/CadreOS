import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">CadreOS Dashboard</h1>
        <UserButton />
      </header>
      <main className="mx-auto w-full max-w-6xl p-6">{children}</main>
    </div>
  );
}
