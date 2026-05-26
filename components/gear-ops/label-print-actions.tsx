"use client";

export function LabelPrintActions() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
    >
      Print label
    </button>
  );
}
