import { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  children: ReactNode;
};

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      {title ? <h3 className="mb-3 text-lg font-medium">{title}</h3> : null}
      {children}
    </div>
  );
}
