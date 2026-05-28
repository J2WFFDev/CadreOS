import { resolveBuildMetadataLabel } from "@/lib/build-info";

export function BuildMetadataBadge() {
  const label = resolveBuildMetadataLabel();

  return (
    <span
      className="inline-flex max-w-[42rem] items-center rounded-md border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
      title={label}
      aria-label={`Operational release ribbon: ${label}`}
    >
      {label}
    </span>
  );
}
