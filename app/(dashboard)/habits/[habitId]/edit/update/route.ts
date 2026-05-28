import { HabitFrequency } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canEditHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { MAX_HABIT_DESCRIPTION_LENGTH, MAX_HABIT_TITLE_LENGTH, normalizeCompletedOn } from "@/lib/habits/policy";
import { getOrganizationScope } from "@/lib/organization-context";

function normalizeFrequency(raw: string): HabitFrequency | null {
  if (raw === "DAILY") return HabitFrequency.DAILY;
  if (raw === "WEEKLY") return HabitFrequency.WEEKLY;
  if (raw === "CUSTOM") return HabitFrequency.CUSTOM;
  return null;
}

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

  if (!canEditHabit(accessContext, habit)) {
    return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_HABIT_TITLE_LENGTH);
  const description = String(formData.get("description") ?? "").trim().slice(0, MAX_HABIT_DESCRIPTION_LENGTH) || null;
  const athletePersonId = String(formData.get("athletePersonId") ?? "").trim();
  const assignedToTeamId = String(formData.get("assignedToTeamId") ?? "").trim() || null;
  const frequencyRaw = String(formData.get("frequency") ?? "").trim();
  const daysOfWeek = String(formData.get("daysOfWeek") ?? "").trim() || null;
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const scheduleId = String(formData.get("scheduleId") ?? "").trim() || null;

  if (!title || !athletePersonId) {
    return NextResponse.redirect(new URL(`/habits/${habitId}/edit`, request.url), 303);
  }

  // Validate athlete belongs to org
  const athlete = await db.person.findFirst({
    where: { id: athletePersonId, organizationId: scope.organizationId },
    select: { id: true },
  });
  if (!athlete) return NextResponse.redirect(new URL(`/habits/${habitId}/edit`, request.url), 303);

  // Validate team if provided
  if (assignedToTeamId) {
    const team = await db.team.findFirst({
      where: { id: assignedToTeamId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!team) return NextResponse.redirect(new URL(`/habits/${habitId}/edit`, request.url), 303);
  }

  const frequency = normalizeFrequency(frequencyRaw);
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;

  await db.habit.update({
    where: { id: habitId },
    data: {
      title,
      description,
      athletePersonId,
      assignedToTeamId,
    },
  });

  // Update or replace the schedule
  if (frequency && startDate) {
    if (scheduleId) {
      await db.habitSchedule.update({
        where: { id: scheduleId },
        data: {
          frequency,
          daysOfWeek,
          startDate: normalizeCompletedOn(startDate),
          endDate: endDate ? normalizeCompletedOn(endDate) : null,
        },
      });
    } else {
      await db.habitSchedule.create({
        data: {
          habitId,
          frequency,
          daysOfWeek,
          startDate: normalizeCompletedOn(startDate),
          endDate: endDate ? normalizeCompletedOn(endDate) : null,
        },
      });
    }
  } else if (scheduleId && !frequency) {
    // Clear the schedule if frequency was removed
    await db.habitSchedule.delete({ where: { id: scheduleId } });
  }

  return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
}
