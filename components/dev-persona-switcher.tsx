"use client";

import { useTransition } from "react";

import { DEV_PERSONA_COOKIE_NAME, DEV_PERSONAS } from "@/lib/auth/devPersonas";

const PERSONA_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function DevPersonaSwitcher({ currentPersonaId }: { currentPersonaId?: string | null }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span>Dev Persona</span>
      <select
        aria-label="Select development persona"
        defaultValue={currentPersonaId ?? ""}
        disabled={isPending}
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        onChange={(event) => {
          const nextValue = event.currentTarget.value;

          startTransition(() => {
            document.cookie = `${DEV_PERSONA_COOKIE_NAME}=${encodeURIComponent(nextValue)}; path=/; max-age=${PERSONA_COOKIE_MAX_AGE_SECONDS}; samesite=strict`;
            window.location.reload();
          });
        }}
      >
        <option value="">Use Clerk Session</option>
        {DEV_PERSONAS.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.label}
          </option>
        ))}
      </select>
    </label>
  );
}
