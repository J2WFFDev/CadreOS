import { requireModuleAccess } from "@/lib/auth/route-guards";

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("entry");
  return children;
}
