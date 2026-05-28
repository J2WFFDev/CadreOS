import { redirect } from "next/navigation";

import { canAccessModule } from "@/lib/auth/access-control";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  const canAccessReports =
    canAccessModule(currentUser, "memberOps") ||
    canAccessModule(currentUser, "entry") ||
    canAccessModule(currentUser, "journal") ||
    canAccessModule(currentUser, "fieldOps") ||
    canAccessModule(currentUser, "gearOps") ||
    canAccessModule(currentUser, "admin");

  if (!canAccessReports) {
    redirect("/dashboard");
  }

  return children;
}
