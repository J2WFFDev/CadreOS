import { requireModuleAccess } from "@/lib/auth/route-guards";

export default async function FieldOpsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("fieldOps");
  return children;
}
