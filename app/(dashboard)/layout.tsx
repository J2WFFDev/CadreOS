import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { NavSidebar } from "@/components/nav-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3 dark:bg-zinc-900">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          CadreOS
        </Link>
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span>Protected dashboard</span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-49px)]">
        <NavSidebar />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
