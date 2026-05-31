// Arc 24D.8: Complete Habit lifecycle route.
// Marks the Habit itself as COMPLETED — distinct from completing an occurrence.
// A COMPLETED habit no longer appears in My Work and no new check-ins are accepted.

import { HabitStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canCompleteHabit, resolveHabitAccessContext } from "@/lib/habits/access";
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

  if (!canCompleteHabit(accessContext, habit)) {
    return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
  }

  await db.habit.update({
    where: { id: habitId },
    data: {
      status: HabitStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  await db.habitActivity.create({
    data: {
      organizationId: scope.organizationId,
      habitId,
      action: "habit.completed",
      actorPersonId: scope.auth.personId,
    },
  });

  return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
}
