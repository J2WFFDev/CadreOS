import { HabitFrequency } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canCreateHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import {
  MAX_HABIT_DESCRIPTION_LENGTH,
  MAX_HABIT_TITLE_LENGTH,
  normalizeCompletedOn,
  normalizeTrackingMode,
} from "@/lib/habits/policy";
import { getOrganizationScope } from "@/lib/organization-context";

function normalizeFrequency(raw: string): HabitFrequency | null {
  if (raw === "DAILY") return HabitFrequency.DAILY;
  if (raw === "WEEKLY") return HabitFrequency.WEEKLY;
  if (raw === "CUSTOM") return HabitFrequency.CUSTOM;
  return null;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/habits", request.url), 303);
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canCreateHabit(accessContext)) {
    return NextResponse.redirect(new URL("/habits", request.url), 303);
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
  const trackingModeRaw = String(formData.get("trackingMode") ?? "").trim();
  const targetCountRaw = String(formData.get("targetCount") ?? "").trim();
  const targetUnit = String(formData.get("targetUnit") ?? "").trim() || null;

  if (!title || !athletePersonId) {
    return NextResponse.redirect(new URL("/habits/create", request.url), 303);
  }

  // Validate athlete belongs to the organization
  const athlete = await db.person.findFirst({
    where: { id: athletePersonId, organizationId: scope.organizationId },
    select: { id: true },
  });
  if (!athlete) {
    return NextResponse.redirect(new URL("/habits/create", request.url), 303);
  }

  // Validate team if provided
  if (assignedToTeamId) {
    const team = await db.team.findFirst({
      where: { id: assignedToTeamId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!team) {
      return NextResponse.redirect(new URL("/habits/create", request.url), 303);
    }
  }

  const frequency = normalizeFrequency(frequencyRaw);
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  const trackingMode = normalizeTrackingMode(trackingModeRaw);
  const targetCount = targetCountRaw ? parseInt(targetCountRaw, 10) || null : null;

  const habit = await db.habit.create({
    data: {
      organizationId: scope.organizationId,
      title,
      description,
      athletePersonId,
      assignedToTeamId,
      createdByPersonId: scope.auth.personId,
      trackingMode: trackingMode ?? undefined,
      targetCount,
      targetUnit,
      ...(frequency && startDate
        ? {
            schedules: {
              create: {
                frequency,
                daysOfWeek: daysOfWeek || null,
                startDate: normalizeCompletedOn(startDate),
                endDate: endDate ? normalizeCompletedOn(endDate) : null,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  await db.habitActivity.create({
    data: {
      organizationId: scope.organizationId,
      habitId: habit.id,
      action: "habit.created",
      actorPersonId: scope.auth.personId,
    },
  });

  return NextResponse.redirect(new URL(`/habits/${habit.id}`, request.url), 303);
}
