import { requireModuleAccess } from "@/lib/auth/route-guards";

export default async function PromptAssignmentsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("admin");
  return children;
}
