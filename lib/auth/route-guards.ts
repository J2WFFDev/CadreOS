import { redirect } from "next/navigation";

import { canAccessModule, type ModuleKey } from "@/lib/auth/access-control";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function requireModuleAccess(moduleKey: ModuleKey) {
  const currentUser = await getCurrentUser();

  if (!canAccessModule(currentUser, moduleKey)) {
    redirect("/dashboard");
  }

  return currentUser;
}
