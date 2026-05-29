import { requireModuleAccess } from "@/lib/auth/route-guards";

export default async function NotesLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("journal");
  return children;
}
