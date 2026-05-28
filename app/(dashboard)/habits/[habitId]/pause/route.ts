import { HabitStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canPauseHabit, resolveHabitAccessContext } from "@/lib/habits/access";
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

  if (!canPauseHabit(accessContext, habit)) {
    return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
  }

  const formData = await request.formData();
  const resume = String(formData.get("resume") ?? "") === "true";

  if (resume && habit.status === HabitStatus.PAUSED) {
    await db.habit.update({
      where: { id: habitId },
      data: { status: HabitStatus.ACTIVE, pausedAt: null },
    });
  } else if (!resume && habit.status === HabitStatus.ACTIVE) {
    await db.habit.update({
      where: { id: habitId },
      data: { status: HabitStatus.PAUSED, pausedAt: new Date() },
    });
  }

  return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
}
