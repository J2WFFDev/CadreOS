import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canCreateHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import {
  buildHabitCreateData,
  createHabitActivitySafely,
  getHabitCreateValidationError,
  normalizeHabitCreateFormInput,
} from "@/lib/habits/create";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

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
  const input = normalizeHabitCreateFormInput(formData);

  const validationError = getHabitCreateValidationError(input);
  if (validationError) {
    return NextResponse.redirect(new URL(`/habits/create?error=${validationError}`, request.url), 303);
  }

  // Validate athlete belongs to the organization
  const athlete = await db.person.findFirst({
    where: { id: input.athletePersonId, organizationId: scope.organizationId },
    select: { id: true },
  });
  if (!athlete) {
    return NextResponse.redirect(new URL("/habits/create?error=missing_athlete", request.url), 303);
  }

  // Validate team if provided
  if (input.assignedToTeamId) {
    const team = await db.team.findFirst({
      where: { id: input.assignedToTeamId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!team) {
      return NextResponse.redirect(new URL("/habits/create", request.url), 303);
    }
  }

  let habitId: string;
  try {
    const habit = await db.habit.create({
      data: buildHabitCreateData(input, {
        organizationId: scope.organizationId,
        actorPersonId: scope.auth.personId,
      }),
      select: { id: true },
    });
    habitId = habit.id;
  } catch (error) {
    const schemaDetail = describeSchemaUnavailableError(error);
    console.error("[habits.create.save] Habit create failed", {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      schemaDetail,
      error,
    });
    if (isSchemaUnavailableError(error)) {
      return NextResponse.redirect(new URL("/habits/create?error=schema_unavailable", request.url), 303);
    }
    return NextResponse.redirect(new URL("/habits/create?error=create_failed", request.url), 303);
  }

  await createHabitActivitySafely({
    createActivity: async ({ organizationId, habitId, actorPersonId }) =>
      db.habitActivity.create({
        data: {
          organizationId,
          habitId,
          action: "habit.created",
          actorPersonId,
        },
      }),
    organizationId: scope.organizationId,
    habitId,
    actorPersonId: scope.auth.personId,
    logError: (error) => {
      const schemaDetail = describeSchemaUnavailableError(error);
      console.error("[habits.create.save] Habit activity create failed", {
        organizationId: scope.organizationId,
        habitId,
        actorPersonId: scope.auth.personId,
        schemaDetail,
        error,
      });
    },
  });

  return NextResponse.redirect(new URL(`/habits/${habitId}`, request.url), 303);
}
