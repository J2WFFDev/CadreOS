import { NoteVisibility, TaskStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeFollowUpTaskEntryRuntimeRef } from "@/lib/entry-runtime";
import { upsertEntryFromTask } from "@/lib/entries/service";
import {
  classifyFollowUpTaskOperationalVisibility,
  classifyObservationNoteOperationalVisibility,
} from "@/lib/operational-visibility";
import { resolveFollowUpTaskCreatorPersonId } from "@/lib/follow-up-tasks";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  followUpTaskWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, input: {
  values: {
    title: string;
    description: string;
    status: string;
    assigneePersonId: string;
    dueAt: string;
    sourceNoteId: string;
    sourceEventId: string;
    returnTo: string;
  };
  fieldErrors?: Partial<
    Record<"title" | "description" | "status" | "assigneePersonId" | "dueAt" | "sourceNoteId" | "sourceEventId", string>
  >;
  error?: string;
}) {
  const url = new URL("/tasks/new", requestUrl);

  url.searchParams.set("title", input.values.title);
  url.searchParams.set("description", input.values.description);
  url.searchParams.set("status", input.values.status);
  url.searchParams.set("assigneePersonId", input.values.assigneePersonId);
  url.searchParams.set("dueAt", input.values.dueAt);
  url.searchParams.set("sourceNoteId", input.values.sourceNoteId);
  url.searchParams.set("sourceEventId", input.values.sourceEventId);
  url.searchParams.set("returnTo", resolveSafeReturnPath(input.values.returnTo, "/tasks"));

  if (input.fieldErrors?.title) {
    url.searchParams.set("titleError", input.fieldErrors.title);
  }
  if (input.fieldErrors?.description) {
    url.searchParams.set("descriptionError", input.fieldErrors.description);
  }
  if (input.fieldErrors?.status) {
    url.searchParams.set("statusError", input.fieldErrors.status);
  }
  if (input.fieldErrors?.assigneePersonId) {
    url.searchParams.set("assigneePersonIdError", input.fieldErrors.assigneePersonId);
  }
  if (input.fieldErrors?.dueAt) {
    url.searchParams.set("dueAtError", input.fieldErrors.dueAt);
  }
  if (input.fieldErrors?.sourceNoteId) {
    url.searchParams.set("sourceNoteIdError", input.fieldErrors.sourceNoteId);
  }
  if (input.fieldErrors?.sourceEventId) {
    url.searchParams.set("sourceEventIdError", input.fieldErrors.sourceEventId);
  }
  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    title: getStringField(formData, "title"),
    description: getStringField(formData, "description"),
    status: getStringField(formData, "status") || TaskStatus.OPEN,
    assigneePersonId: getStringField(formData, "assigneePersonId"),
    dueAt: getStringField(formData, "dueAt"),
    sourceNoteId: getStringField(formData, "sourceNoteId"),
    sourceEventId: getStringField(formData, "sourceEventId"),
    returnTo: getStringField(formData, "returnTo"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: scope.errorMessage ?? "Unable to create task right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = followUpTaskWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        fieldErrors: {
          title: fieldErrors.title?.[0],
          description: fieldErrors.description?.[0],
          status: fieldErrors.status?.[0],
          assigneePersonId: fieldErrors.assigneePersonId?.[0],
          dueAt: fieldErrors.dueAt?.[0],
          sourceNoteId: fieldErrors.sourceNoteId?.[0],
          sourceEventId: fieldErrors.sourceEventId?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "task.create",
      noteId: parsed.data.sourceNoteId,
      eventId: parsed.data.sourceEventId,
    });

    const assignee = await db.person.findFirst({
      where: {
        id: parsed.data.assigneePersonId,
        organizationId: scope.organizationId,
      },
      select: { id: true },
    });

    if (!assignee) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          fieldErrors: { assigneePersonId: "Select a valid assignee in the active organization." },
          error: "Assignee selection is invalid.",
        }),
        303,
      );
    }

    let sourceNote:
      | {
          id: string;
          eventId: string | null;
          athletePersonId: string | null;
          visibility: NoteVisibility;
          teamId: string | null;
          team: { programId: string } | null;
          event: { teamId: string | null; programId: string } | null;
        }
      | null = null;
    if (parsed.data.sourceNoteId) {
      sourceNote = await db.observationNote.findFirst({
        where: {
          id: parsed.data.sourceNoteId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          eventId: true,
          athletePersonId: true,
          visibility: true,
          teamId: true,
          team: { select: { programId: true } },
          event: { select: { teamId: true, programId: true } },
        },
      });

      if (!sourceNote) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: { sourceNoteId: "Select a valid note in the active organization." },
            error: "Source note selection is invalid.",
          }),
          303,
        );
      }

      const sourceNoteVisibility = classifyObservationNoteOperationalVisibility({
        visibility: sourceNote.visibility,
        teamId: sourceNote.teamId,
        eventTeamId: sourceNote.event?.teamId ?? null,
        teamProgramId: sourceNote.team?.programId ?? null,
        eventProgramId: sourceNote.event?.programId ?? null,
      });

      if (sourceNoteVisibility.visibilityClass === "UNRESOLVED") {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: { sourceNoteId: "Selected note visibility context is unresolved for task linkage." },
            error: "Source note visibility is unresolved.",
          }),
          303,
        );
      }
    }

    const sourceEvent = parsed.data.sourceEventId
      ? await db.event.findFirst({
        where: {
          id: parsed.data.sourceEventId,
          organizationId: scope.organizationId,
        },
        select: { id: true, teamId: true, programId: true },
      })
      : null;

    if (parsed.data.sourceEventId && !sourceEvent) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          fieldErrors: { sourceEventId: "Select a valid event in the active organization." },
          error: "Source event selection is invalid.",
        }),
        303,
      );
    }

    if (sourceNote) {
      const linkedVisibility = classifyFollowUpTaskOperationalVisibility({
        sourceNoteId: sourceNote.id,
        sourceEventId: sourceEvent?.id ?? null,
        sourceNoteVisibility: sourceNote.visibility,
        sourceNoteEventId: sourceNote.eventId,
        sourceNoteTeamId: sourceNote.teamId,
        sourceNoteEventTeamId: sourceNote.event?.teamId ?? null,
        sourceEventTeamId: sourceEvent?.teamId ?? null,
        sourceNoteTeamProgramId: sourceNote.team?.programId ?? null,
        sourceNoteEventProgramId: sourceNote.event?.programId ?? null,
        sourceEventProgramId: sourceEvent?.programId ?? null,
      });

      if (linkedVisibility.visibilityClass === "UNRESOLVED") {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: {
              sourceNoteId: "Selected source-note linkage has unresolved visibility context.",
              sourceEventId: sourceEvent ? "Selected source-event linkage conflicts with source-note visibility context." : undefined,
            },
            error: "Source note/event visibility context is ambiguous.",
          }),
          303,
        );
      }

      if (parsed.data.sourceEventId && sourceNote.eventId && sourceNote.eventId !== parsed.data.sourceEventId) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: {
              sourceEventId: "Selected event must match the source note event context.",
            },
            error: "Source note/event context is ambiguous.",
          }),
          303,
        );
      }
    }

    const createdByPersonId = await resolveFollowUpTaskCreatorPersonId(
      scope.organizationId,
      scope.auth.clerkUserId,
      scope.auth.personId,
    );

    if (!createdByPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          error: "No organization person is available for created-by attribution yet.",
        }),
        303,
      );
    }

    const createdTask = await db.followUpTask.create({
      data: {
        organizationId: scope.organizationId,
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        assigneePersonId: parsed.data.assigneePersonId,
        createdByPersonId,
        dueAt: parsed.data.dueAt,
        sourceNoteId: parsed.data.sourceNoteId,
        sourceEventId: parsed.data.sourceEventId,
      },
      select: {
        id: true,
        organizationId: true,
        createdByPersonId: true,
        sourceNoteId: true,
        sourceEventId: true,
      },
    });

    try {
      await upsertEntryFromTask({
        organizationId: scope.organizationId,
        task: {
          id: createdTask.id,
          title: parsed.data.title,
          description: parsed.data.description,
          status: parsed.data.status,
          assigneePersonId: parsed.data.assigneePersonId,
          createdByPersonId,
          dueAt: parsed.data.dueAt,
        },
      });
      await writeFollowUpTaskEntryRuntimeRef({
        organizationId: scope.organizationId,
        task: {
          id: createdTask.id,
          organizationId: createdTask.organizationId,
          createdByPersonId: createdTask.createdByPersonId,
          sourceNoteId: createdTask.sourceNoteId,
          sourceEventId: createdTask.sourceEventId,
          sourceNoteVisibility: sourceNote?.visibility ?? null,
          sourceNoteEventId: sourceNote?.eventId ?? null,
          sourceNoteTeamId: sourceNote?.teamId ?? null,
          sourceNoteAthletePersonId: sourceNote?.athletePersonId ?? null,
          sourceNoteEventTeamId: sourceNote?.event?.teamId ?? null,
          sourceEventTeamId: sourceEvent?.teamId ?? null,
          sourceNoteTeamProgramId: sourceNote?.team?.programId ?? null,
          sourceNoteEventProgramId: sourceNote?.event?.programId ?? null,
          sourceEventProgramId: sourceEvent?.programId ?? null,
        },
      });
    } catch {
      // Entry wrapper sync is non-authoritative and must not block task creation.
    }

    return NextResponse.redirect(
      new URL(resolveSafeReturnPath(values.returnTo, `/tasks/${createdTask.id}`), request.url),
      303,
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          error: "Task references are invalid for the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating tasks."
            : "Unable to create task right now. Please try again.",
      }),
      303,
    );
  }
}
