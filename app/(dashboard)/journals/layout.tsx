import { requireModuleAccess } from "@/lib/auth/route-guards";

export default async function JournalsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("journal");
  return children;
}
