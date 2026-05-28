import { requireModuleAccess } from "@/lib/auth/route-guards";

export default async function GearOpsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("gearOps");
  return children;
}
