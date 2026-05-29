import { requireModuleAccess } from "@/lib/auth/route-guards";

export default async function ProgramsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("memberOps");
  return children;
}
