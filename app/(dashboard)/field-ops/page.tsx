import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function FieldOpsIndexPage() {
  redirect("/field-ops/facilities");
}
