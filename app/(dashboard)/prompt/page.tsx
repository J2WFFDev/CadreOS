import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";

export default function PromptAliasPage() {
  return (
    <section className="space-y-4">
      <PageHeader title="Journal Prompt" description="Guided journal prompt workflows." />
      <EmptyState
        message="Journal prompts are not implemented yet."
        actionHref="/entries"
        actionLabel="Back to EntryOps"
      />
    </section>
  );
}
