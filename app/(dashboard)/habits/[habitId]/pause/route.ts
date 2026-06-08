import { HabitStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canPauseHabit, canReadHabit, resolveHabitAccessContext } from "@/lib/habits/access";
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
    logHabitAccessFailure({ workflow: "habits.pause", habitId, organizationId: scope.organizationId, actorPersonId: scope.auth.personId, reasonCode: "HABIT_NOT_FOUND" });
    return NextResponse.redirect(new URL("/habits?error=HABIT_NOT_FOUND", request.url), 303);
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadHabit(accessContext, habit)) {
    logHabitAccessFailure({ workflow: "habits.pause", habitId, organizationId: scope.organizationId, actorPersonId: scope.auth.personId, reasonCode: "HABIT_VISIBILITY_DENIED" });
    return NextResponse.redirect(new URL("/habits?error=HABIT_VISIBILITY_DENIED", request.url), 303);
  }

  if (!canPauseHabit(accessContext, habit)) {
    logHabitAccessFailure({ workflow: "habits.pause", habitId, organizationId: scope.organizationId, actorPersonId: scope.auth.personId, reasonCode: "HABIT_PAUSE_DENIED" });
    return NextResponse.redirect(new URL(`/habits/${habitId}?error=HABIT_PAUSE_DENIED`, request.url), 303);
  }

  const formData = await request.formData();
  const resume = String(formData.get("resume") ?? "") === "true";

  if (resume && habit.status === HabitStatus.PAUSED) {
    await db.habit.update({
      where: { id: habitId },
      data: { status: HabitStatus.ACTIVE, pausedAt: null },
    });
    await db.habitActivity.create({
      data: {
        organizationId: scope.organizationId,
        habitId,
        action: "habit.resumed",
        actorPersonId: scope.auth.personId,
      },
    });
  } else if (!resume && habit.status === HabitStatus.ACTIVE) {
    await db.habit.update({
      where: { id: habitId },
      data: { status: HabitStatus.PAUSED, pausedAt: new Date() },
    });
    await db.habitActivity.create({
      data: {
        organizationId: scope.organizationId,
        habitId,
        action: "habit.paused",
        actorPersonId: scope.auth.personId,
      },
    });
  }

  return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
}
