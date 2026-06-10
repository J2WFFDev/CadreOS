import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canCheckInHabit, canReadHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { logHabitAccessFailure } from "@/lib/habits/access-feedback";
import {
  MAX_CHECKIN_NOTE_LENGTH,
  normalizeCompletedOn,
  parseHabitCountValue,
  resolveLatestHabitCheckIn,
} from "@/lib/habits/policy";
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
      title: true,
      athletePersonId: true,
      assignedToTeamId: true,
      createdByPersonId: true,
      status: true,
      lastCompletedAt: true,
    },
  });

  if (!habit) {
    logHabitAccessFailure({
      workflow: "habits.check-in",
      habitId,
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      reasonCode: "HABIT_NOT_FOUND",
    });
    return NextResponse.redirect(new URL("/habits?error=HABIT_NOT_FOUND", request.url), 303);
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadHabit(accessContext, habit)) {
    logHabitAccessFailure({
      workflow: "habits.check-in",
      habitId,
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      reasonCode: "HABIT_VISIBILITY_DENIED",
    });
    return NextResponse.redirect(new URL("/habits?error=HABIT_VISIBILITY_DENIED", request.url), 303);
  }

  if (!canCheckInHabit(accessContext, habit)) {
    logHabitAccessFailure({
      workflow: "habits.check-in",
      habitId,
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      reasonCode: "HABIT_CHECK_IN_DENIED",
    });
    return NextResponse.redirect(new URL(`/habits/${habitId}?error=HABIT_CHECK_IN_DENIED`, request.url), 303);
  }

  const formData = await request.formData();
  const completedOnRaw = String(formData.get("completedOn") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_CHECKIN_NOTE_LENGTH) || null;
  const countValue = parseHabitCountValue(String(formData.get("countValue") ?? ""));

  if (!completedOnRaw) {
    return NextResponse.redirect(new URL(`/habits/${habitId}?invalidDate=1`, request.url), 303);
  }

  const parsedCompletedOn = new Date(completedOnRaw);
  if (Number.isNaN(parsedCompletedOn.getTime())) {
    return NextResponse.redirect(new URL(`/habits/${habitId}?invalidDate=1`, request.url), 303);
  }

  const completedOn = normalizeCompletedOn(parsedCompletedOn);

  // Attempt to create the completion. The unique constraint on (habitId, completedOn)
  // prevents duplicate same-day completions.
  try {
    await db.habitCompletion.create({
      data: {
        habitId,
        athletePersonId: habit.athletePersonId,
        completedOn,
        note,
        completedBy: scope.auth.personId,
        countValue,
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

  // Update lastCompletedAt on the habit and write a HabitActivity record.
  await Promise.all([
    db.habit.update({
      where: { id: habitId },
      data: { lastCompletedAt: resolveLatestHabitCheckIn(habit.lastCompletedAt, completedOn) },
    }),
    db.habitActivity.create({
      data: {
        organizationId: scope.organizationId,
        habitId,
        action: "habit.checked_in",
        actorPersonId: scope.auth.personId,
      },
    }),
  ]);

  return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
}
