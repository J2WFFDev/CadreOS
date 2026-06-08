// Arc 24D.8: Restore Habit route.
// Restores an ARCHIVED or COMPLETED habit back to ACTIVE.

import { HabitStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canReadHabit, canRestoreHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { logHabitAccessFailure } from "@/lib/habits/access-feedback";
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

  if (!habit) {
    logHabitAccessFailure({ workflow: "habits.restore", habitId, organizationId: scope.organizationId, actorPersonId: scope.auth.personId, reasonCode: "HABIT_NOT_FOUND" });
    return NextResponse.redirect(new URL("/habits?error=HABIT_NOT_FOUND", request.url), 303);
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadHabit(accessContext, habit)) {
    logHabitAccessFailure({ workflow: "habits.restore", habitId, organizationId: scope.organizationId, actorPersonId: scope.auth.personId, reasonCode: "HABIT_VISIBILITY_DENIED" });
    return NextResponse.redirect(new URL("/habits?error=HABIT_VISIBILITY_DENIED", request.url), 303);
  }

  if (!canRestoreHabit(accessContext, habit)) {
    logHabitAccessFailure({ workflow: "habits.restore", habitId, organizationId: scope.organizationId, actorPersonId: scope.auth.personId, reasonCode: "HABIT_RESTORE_DENIED" });
    return NextResponse.redirect(new URL(`/habits/${habitId}?error=HABIT_RESTORE_DENIED`, request.url), 303);
  }

  await db.habit.update({
    where: { id: habitId },
    data: {
      status: HabitStatus.ACTIVE,
      archivedAt: null,
      completedAt: null,
    },
  });

  await db.habitActivity.create({
    data: {
      organizationId: scope.organizationId,
      habitId,
      action: "habit.restored",
      actorPersonId: scope.auth.personId,
    },
  });

  return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
}
