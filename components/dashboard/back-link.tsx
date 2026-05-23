import Link from "next/link";

type BackLinkProps = {
  href: string;
  label: string;
};

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link href={href} className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
      ← {label}
    </Link>
  );
}
