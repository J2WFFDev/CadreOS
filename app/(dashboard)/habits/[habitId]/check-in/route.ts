import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canCheckInHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { MAX_CHECKIN_NOTE_LENGTH, normalizeCompletedOn } from "@/lib/habits/policy";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request, { params }: { params: Promise<{ habitId: string }> }) {
  const { habitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/habits", request.url), 303);
  }

  const habit = await db.habit.findFirst({
    where: { id: habitId, organizationId: scope.organizationId },
    select: {
      id: true,
      athletePersonId: true,
      assignedToTeamId: true,
      createdByPersonId: true,
      status: true,
    },
  });

  if (!habit) return NextResponse.redirect(new URL("/habits", request.url), 303);

  const accessContext = await resolveHabitAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canCheckInHabit(accessContext, habit)) {
    return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
  }

  const formData = await request.formData();
  const completedOnRaw = String(formData.get("completedOn") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_CHECKIN_NOTE_LENGTH) || null;

  if (!completedOnRaw) {
    return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
  }

  const completedOn = normalizeCompletedOn(new Date(completedOnRaw));

  // Attempt to create the completion. The unique constraint on (habitId, completedOn)
  // will silently skip duplicate same-day completions.
  try {
    await db.habitCompletion.create({
      data: {
        habitId,
        athletePersonId: habit.athletePersonId,
        completedOn,
        note,
      },
    });
  } catch (error: unknown) {
    // Unique constraint violation — same-day duplicate. Redirect gracefully.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.redirect(new URL(`/habits/${habitId}?duplicate=1`, request.url), 303);
    }
    throw error;
  }

  return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
}
