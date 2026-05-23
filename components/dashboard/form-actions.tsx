import Link from "next/link";

type FormActionsProps = {
  submitLabel: string;
  cancelHref: string;
};

export function FormActions({ submitLabel, cancelHref }: FormActionsProps) {
  return (
    <div className="flex gap-3">
      <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
        {submitLabel}
      </button>
      <Link href={cancelHref} className="rounded-md border px-4 py-2 text-sm">
        Cancel
      </Link>
    </div>
  );
}
