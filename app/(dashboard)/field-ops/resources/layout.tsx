import { requireModuleAccess } from "@/lib/auth/route-guards";

export default async function FieldOpsResourcesLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("resourceOps");
  return children;
}
