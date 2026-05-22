import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";

export default function MarketingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">CadreOS</h1>
      <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
        Coach-centered operations system foundation. Phase 0 public landing page.
      </p>

      <Show when="signed-out">
        <div className="flex gap-3">
          <SignInButton mode="modal">
            <button className="rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-md border px-4 py-2">Create account</button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <Link
          href="/dashboard"
          className="rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
        >
          Go to dashboard
        </Link>
      </Show>
    </main>
  );
}
