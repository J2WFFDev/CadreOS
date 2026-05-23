import { AttendanceStatus, Prisma, RoleType, TaskStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { formatDateTime, formatEnumLabel } from "@/lib/follow-up-tasks";
import {
  buildSupportedTaskSourceNoteVisibilityWhere,
  hasResolvedFollowUpTaskOperationalVisibility,
  SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
} from "@/lib/operational-visibility";

type OperationalHistoryContext = {
  label: string;
  value: string;
  href: string | null;
};

export type OperationalHistoryItem = {
  id: string;
  kind: "task" | "note" | "attendance" | "event" | "roster" | "assignment";
  href: string;
  title: string;
  changeLabel: string;
  changedAt: Date;
  summary: string;
  contexts: OperationalHistoryContext[];
  actor:
    | {
        label: string;
        name: string;
        href: string | null;
      }
    | {
        label: string;
        name: null;
        href: null;
      };
  unresolvedLabel?: string | null;
};

export async function getOperationalHistory(input: {
  organizationId: string;
  teamId?: string;
  eventId?: string;
  personId?: string;
  limit?: number;
  sinceDays?: number;
  unresolvedOnly?: boolean;
  allowAllStaffScope?: boolean;
  allowedTeamIds?: string[];
  allowedProgramIds?: string[];
}) {
  const sinceDays = input.sinceDays ?? 30;
  const limit = input.limit ?? 8;
  const changedSince = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const unresolvedStatuses: TaskStatus[] = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED];
  const allowAllStaffScope = input.allowAllStaffScope ?? true;
  const allowedTeamIds = Array.from(new Set((input.allowedTeamIds ?? []).filter(Boolean)));
  const allowedProgramIds = Array.from(new Set((input.allowedProgramIds ?? []).filter(Boolean)));
  const taskWhere: Prisma.FollowUpTaskWhereInput = {
    organizationId: input.organizationId,
    updatedAt: { gte: changedSince },
    ...(input.unresolvedOnly ? { status: { in: unresolvedStatuses } } : {}),
  };
  const taskAnd: Prisma.FollowUpTaskWhereInput[] = [buildSupportedTaskSourceNoteVisibilityWhere()];

  if (!allowAllStaffScope) {
    taskAnd.push({
      OR: [
        ...(allowedTeamIds.length > 0
          ? [{ sourceEvent: { is: { teamId: { in: allowedTeamIds } } } }]
          : []),
        ...(allowedTeamIds.length > 0
          ? [{ sourceNote: { is: { teamId: { in: allowedTeamIds } } } }]
          : []),
        ...(allowedTeamIds.length > 0
          ? [{ sourceNote: { is: { event: { is: { teamId: { in: allowedTeamIds } } } } } }]
          : []),
        ...(allowedProgramIds.length > 0
          ? [{ sourceEvent: { is: { programId: { in: allowedProgramIds } } } }]
          : []),
        ...(allowedProgramIds.length > 0
          ? [{ sourceNote: { is: { team: { is: { programId: { in: allowedProgramIds } } } } } }]
          : []),
        ...(allowedProgramIds.length > 0
          ? [{ sourceNote: { is: { event: { is: { programId: { in: allowedProgramIds } } } } } }]
          : []),
      ],
    });
  }

  if (input.eventId) {
    taskAnd.push({
      OR: [{ sourceEventId: input.eventId }, { sourceNote: { is: { eventId: input.eventId } } }],
    });
  }

  if (input.personId) {
    taskAnd.push({
      OR: [
        { assigneePersonId: input.personId },
        { createdByPersonId: input.personId },
        { sourceNote: { is: { athletePersonId: input.personId } } },
      ],
    });
  }

  if (input.teamId) {
    taskAnd.push({
      OR: [
        { sourceEvent: { is: { teamId: input.teamId } } },
        { sourceNote: { is: { teamId: input.teamId } } },
        { sourceNote: { is: { event: { is: { teamId: input.teamId } } } } },
      ],
    });
  }

  if (taskAnd.length > 0) {
    taskWhere.AND = taskAnd;
  }

  const noteWhere: Prisma.ObservationNoteWhereInput = {
    organizationId: input.organizationId,
    visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
    updatedAt: { gte: changedSince },
  };
  const noteAnd: Prisma.ObservationNoteWhereInput[] = [];

  if (!allowAllStaffScope) {
    noteAnd.push({
      OR: [
        ...(allowedTeamIds.length > 0 ? [{ teamId: { in: allowedTeamIds } }] : []),
        ...(allowedTeamIds.length > 0 ? [{ event: { is: { teamId: { in: allowedTeamIds } } } }] : []),
        ...(allowedProgramIds.length > 0 ? [{ team: { is: { programId: { in: allowedProgramIds } } } }] : []),
        ...(allowedProgramIds.length > 0
          ? [{ event: { is: { programId: { in: allowedProgramIds } } } }]
          : []),
      ],
    });
  }

  if (input.eventId) {
    noteAnd.push({ eventId: input.eventId });
  }

  if (input.personId) {
    noteAnd.push({ OR: [{ athletePersonId: input.personId }, { authorPersonId: input.personId }] });
  }

  if (input.teamId) {
    noteAnd.push({ OR: [{ teamId: input.teamId }, { event: { is: { teamId: input.teamId } } }] });
  }

  if (noteAnd.length > 0) {
    noteWhere.AND = noteAnd;
  }

  const attendanceWhere: Prisma.AttendanceRecordWhereInput = {
    organizationId: input.organizationId,
    updatedAt: { gte: changedSince },
  };
  const attendanceAnd: Prisma.AttendanceRecordWhereInput[] = [];

  if (!allowAllStaffScope) {
    attendanceAnd.push({
      OR: [
        ...(allowedTeamIds.length > 0 ? [{ event: { is: { teamId: { in: allowedTeamIds } } } }] : []),
        ...(allowedProgramIds.length > 0
          ? [{ event: { is: { programId: { in: allowedProgramIds } } } }]
          : []),
      ],
    });
  }

  if (input.eventId) {
    attendanceAnd.push({ eventId: input.eventId });
  }

  if (input.personId) {
    attendanceAnd.push({ OR: [{ personId: input.personId }, { markedByPersonId: input.personId }] });
  }

  if (input.teamId) {
    attendanceAnd.push({ event: { is: { teamId: input.teamId } } });
  }

  if (attendanceAnd.length > 0) {
    attendanceWhere.AND = attendanceAnd;
  }

  const eventWhere: Prisma.EventWhereInput = {
    organizationId: input.organizationId,
    updatedAt: { gte: changedSince },
  };
  const eventAnd: Prisma.EventWhereInput[] = [];

  if (!allowAllStaffScope) {
    eventAnd.push({
      OR: [
        ...(allowedTeamIds.length > 0 ? [{ teamId: { in: allowedTeamIds } }] : []),
        ...(allowedProgramIds.length > 0 ? [{ programId: { in: allowedProgramIds } }] : []),
      ],
    });
  }

  if (input.eventId) {
    eventAnd.push({ id: input.eventId });
  }

  if (input.personId) {
    eventAnd.push({ createdByPersonId: input.personId });
  }

  if (input.teamId) {
    eventAnd.push({ teamId: input.teamId });
  }

  if (eventAnd.length > 0) {
    eventWhere.AND = eventAnd;
  }

  const [tasks, notes, attendanceRecords, events, rosterMemberships, roleAssignments] = await Promise.all([
    db.followUpTask.findMany({
      where: {
        ...taskWhere,
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        dueAt: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        sourceNote: {
          select: {
            id: true,
            visibility: true,
            eventId: true,
            teamId: true,
            athlete: { select: { id: true, firstName: true, lastName: true } },
            team: { select: { id: true, name: true, programId: true } },
            event: { select: { id: true, title: true, teamId: true, programId: true, team: { select: { id: true, name: true } } } },
          },
        },
        sourceEvent: { select: { id: true, title: true, teamId: true, programId: true, team: { select: { id: true, name: true } } } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
    }),
    db.observationNote.findMany({
      where: {
        ...noteWhere,
      },
      select: {
        id: true,
        body: true,
        updatedAt: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        athlete: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, team: { select: { id: true, name: true } } } },
        tasks: { select: { status: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
    }),
    db.attendanceRecord.findMany({
      where: {
        ...attendanceWhere,
      },
      select: {
        id: true,
        status: true,
        markedAt: true,
        updatedAt: true,
        reasonCode: true,
        person: { select: { id: true, firstName: true, lastName: true } },
        markedBy: { select: { id: true, firstName: true, lastName: true } },
        event: { select: { id: true, title: true, team: { select: { id: true, name: true } } } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
    }),
    db.event.findMany({
      where: {
        ...eventWhere,
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        startsAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        team: {
          select: {
            id: true,
            name: true,
            roster: {
              where: { organizationId: input.organizationId, rosterRole: RoleType.ATHLETE },
              select: { personId: true },
            },
          },
        },
        _count: { select: { attendance: true } },
        tasks: { select: { status: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
    }),
    input.unresolvedOnly || input.eventId
      ? Promise.resolve([])
      : db.rosterMembership.findMany({
          where: {
            organizationId: input.organizationId,
            updatedAt: { gte: changedSince },
            ...(!allowAllStaffScope
              ? {
                  OR: [
                    ...(allowedTeamIds.length > 0 ? [{ teamId: { in: allowedTeamIds } }] : []),
                    ...(allowedProgramIds.length > 0
                      ? [{ team: { is: { programId: { in: allowedProgramIds } } } }]
                      : []),
                  ],
                }
              : {}),
            ...(input.personId ? { personId: input.personId } : {}),
            ...(input.teamId ? { teamId: input.teamId } : {}),
          },
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            rosterRole: true,
            person: { select: { id: true, firstName: true, lastName: true } },
            team: { select: { id: true, name: true } },
            season: { select: { id: true, name: true } },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 50,
        }),
    input.unresolvedOnly || input.eventId
      ? Promise.resolve([])
      : db.roleAssignment.findMany({
          where: {
            organizationId: input.organizationId,
            updatedAt: { gte: changedSince },
            ...(!allowAllStaffScope
              ? {
                  OR: [
                    ...(allowedTeamIds.length > 0 ? [{ teamId: { in: allowedTeamIds } }] : []),
                    ...(allowedProgramIds.length > 0 ? [{ programId: { in: allowedProgramIds } }] : []),
                    ...(allowedProgramIds.length > 0
                      ? [{ team: { is: { programId: { in: allowedProgramIds } } } }]
                      : []),
                  ],
                }
              : {}),
            ...(input.personId ? { personId: input.personId } : {}),
            ...(input.teamId ? { teamId: input.teamId } : {}),
          },
          select: {
            id: true,
            roleType: true,
            scopeType: true,
            createdAt: true,
            updatedAt: true,
            person: { select: { id: true, firstName: true, lastName: true } },
            team: { select: { id: true, name: true } },
            program: { select: { id: true, name: true } },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 50,
        }),
  ]);

  const items: Array<OperationalHistoryItem | null> = [
    ...tasks
      .filter((task) =>
        hasResolvedFollowUpTaskOperationalVisibility({
          sourceNoteId: task.sourceNote?.id ?? null,
          sourceEventId: task.sourceEvent?.id ?? null,
          sourceNoteVisibility: task.sourceNote?.visibility,
          sourceNoteEventId: task.sourceNote?.eventId ?? null,
          sourceNoteTeamId: task.sourceNote?.teamId ?? null,
          sourceNoteEventTeamId: task.sourceNote?.event?.teamId ?? null,
          sourceEventTeamId: task.sourceEvent?.teamId ?? null,
          sourceNoteTeamProgramId: task.sourceNote?.team?.programId ?? null,
          sourceNoteEventProgramId: task.sourceNote?.event?.programId ?? null,
          sourceEventProgramId: task.sourceEvent?.programId ?? null,
        }),
      )
      .map((task) => {
      const unresolved = isUnresolvedTaskStatus(task.status);
      const contexts = compactContexts([
        buildContext("Assignee", `${task.assignee.firstName} ${task.assignee.lastName}`, `/people/${task.assignee.id}`),
        task.sourceNote?.athlete
          ? buildContext(
              "Person",
              `${task.sourceNote.athlete.firstName} ${task.sourceNote.athlete.lastName}`,
              `/people/${task.sourceNote.athlete.id}`,
            )
          : null,
        task.sourceEvent
          ? buildContext("Event", task.sourceEvent.title, `/events/${task.sourceEvent.id}`)
          : task.sourceNote?.event
            ? buildContext("Event", task.sourceNote.event.title, `/events/${task.sourceNote.event.id}`)
            : null,
        ...dedupeContexts(
          compactContexts([
            task.sourceEvent?.team ? buildContext("Team", task.sourceEvent.team.name, `/teams/${task.sourceEvent.team.id}`) : null,
            task.sourceNote?.team ? buildContext("Team", task.sourceNote.team.name, `/teams/${task.sourceNote.team.id}`) : null,
            task.sourceNote?.event?.team
              ? buildContext("Team", task.sourceNote.event.team.name, `/teams/${task.sourceNote.event.team.id}`)
              : null,
          ]),
        ),
      ]);

        return {
          id: `task-${task.id}`,
          kind: "task" as const,
          href: `/tasks/${task.id}`,
          title: task.title,
          changeLabel: "Task update",
          changedAt: task.updatedAt,
          summary: [
            `Status: ${formatEnumLabel(task.status)}`,
            `Due: ${formatDateTime(task.dueAt)}`,
            unresolved ? "Unresolved follow-up" : "Resolved follow-up",
          ].join(" · "),
          contexts,
          actor: {
            label: "Creator",
            name: `${task.createdBy.firstName} ${task.createdBy.lastName}`,
            href: `/people/${task.createdBy.id}`,
          },
          unresolvedLabel: unresolved ? formatEnumLabel(task.status) : null,
        };
      }),
    ...notes.flatMap((note) => {
        const unresolvedTaskCount = note.tasks.filter((task) =>
          isUnresolvedTaskStatus(task.status),
        ).length;
        if (input.unresolvedOnly && unresolvedTaskCount === 0) {
          return [];
        }

        return [{
          id: `note-${note.id}`,
          kind: "note" as const,
          href: `/notes/${note.id}`,
          title: note.body.length > 100 ? `${note.body.slice(0, 100)}…` : note.body,
          changeLabel: "Note update",
          changedAt: note.updatedAt,
          summary:
            unresolvedTaskCount > 0
              ? `${unresolvedTaskCount} unresolved linked task${unresolvedTaskCount === 1 ? "" : "s"}`
              : "No unresolved linked tasks",
          contexts: compactContexts([
            note.athlete
              ? buildContext("Person", `${note.athlete.firstName} ${note.athlete.lastName}`, `/people/${note.athlete.id}`)
              : null,
            note.team ? buildContext("Team", note.team.name, `/teams/${note.team.id}`) : null,
            note.event ? buildContext("Event", note.event.title, `/events/${note.event.id}`) : null,
          ]),
          actor: {
            label: "Author",
            name: `${note.author.firstName} ${note.author.lastName}`,
            href: `/people/${note.author.id}`,
          },
          unresolvedLabel:
            unresolvedTaskCount > 0
              ? `${unresolvedTaskCount} unresolved linked task${unresolvedTaskCount === 1 ? "" : "s"}`
              : null,
        }];
      }),
    ...attendanceRecords.flatMap((attendance) => {
        const hasOperationalConcern = attendance.status !== AttendanceStatus.PRESENT;
        if (input.unresolvedOnly && !hasOperationalConcern) {
          return [];
        }

        return [{
          id: `attendance-${attendance.id}`,
          kind: "attendance" as const,
          href: `/events/${attendance.event.id}#attendance-workflow`,
          title: `${attendance.person.firstName} ${attendance.person.lastName} · ${formatEnumLabel(attendance.status)}`,
          changeLabel: "Attendance update",
          changedAt: attendance.markedAt,
          summary: attendance.reasonCode ? `Reason: ${attendance.reasonCode}` : "Attendance recorded without reason code",
          contexts: compactContexts([
            buildContext("Person", `${attendance.person.firstName} ${attendance.person.lastName}`, `/people/${attendance.person.id}`),
            buildContext("Event", attendance.event.title, `/events/${attendance.event.id}`),
            attendance.event.team ? buildContext("Team", attendance.event.team.name, `/teams/${attendance.event.team.id}`) : null,
          ]),
          actor: attendance.markedBy
            ? {
                label: "Marked by",
                name: `${attendance.markedBy.firstName} ${attendance.markedBy.lastName}`,
                href: `/people/${attendance.markedBy.id}`,
              }
            : {
                label: "Marked by",
                name: null,
                href: null,
              },
          unresolvedLabel: hasOperationalConcern ? formatEnumLabel(attendance.status) : null,
        }];
      }),
    ...events.flatMap((event) => {
        const expectedAttendanceCount = new Set(event.team?.roster.map((membership) => membership.personId) ?? []).size;
        const missingAttendanceCount =
          expectedAttendanceCount > 0 ? Math.max(expectedAttendanceCount - event._count.attendance, 0) : 0;
        const unresolvedTaskCount = event.tasks.filter((task) =>
          isUnresolvedTaskStatus(task.status),
        ).length;
        const hasOperationalConcern = missingAttendanceCount > 0 || unresolvedTaskCount > 0;
        if (input.unresolvedOnly && !hasOperationalConcern) {
          return [];
        }

        return [{
          id: `event-${event.id}`,
          kind: "event" as const,
          href: `/events/${event.id}`,
          title: event.title,
          changeLabel: "Event update",
          changedAt: event.updatedAt,
          summary: [
            `Status: ${formatEnumLabel(event.status)}`,
            `Starts: ${formatDateTime(event.startsAt)}`,
            `Missing attendance: ${missingAttendanceCount}`,
            `Open tasks: ${unresolvedTaskCount}`,
          ].join(" · "),
          contexts: compactContexts([event.team ? buildContext("Team", event.team.name, `/teams/${event.team.id}`) : null]),
          actor: event.createdBy
            ? {
                label: "Created by",
                name: `${event.createdBy.firstName} ${event.createdBy.lastName}`,
                href: `/people/${event.createdBy.id}`,
              }
            : {
                label: "Created by",
                name: null,
                href: null,
              },
          unresolvedLabel: hasOperationalConcern
            ? [
                missingAttendanceCount > 0 ? `${missingAttendanceCount} attendance gap${missingAttendanceCount === 1 ? "" : "s"}` : null,
                unresolvedTaskCount > 0 ? `${unresolvedTaskCount} unresolved task${unresolvedTaskCount === 1 ? "" : "s"}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : null,
        }];
      }),
    ...rosterMemberships.map((membership) => ({
      id: `roster-${membership.id}`,
      kind: "roster" as const,
      href: `/teams/${membership.team.id}#operational-history`,
      title: `${membership.person.firstName} ${membership.person.lastName} · ${formatEnumLabel(membership.rosterRole)}`,
      changeLabel:
        membership.createdAt.getTime() === membership.updatedAt.getTime()
          ? "Roster membership added"
          : "Roster membership updated",
      changedAt: membership.updatedAt,
      summary: `Season: ${membership.season.name}`,
      contexts: compactContexts([
        buildContext("Person", `${membership.person.firstName} ${membership.person.lastName}`, `/people/${membership.person.id}`),
        buildContext("Team", membership.team.name, `/teams/${membership.team.id}`),
        buildContext("Season", membership.season.name, `/teams/${membership.team.id}`),
      ]),
      actor: { label: "Actor", name: null, href: null },
      unresolvedLabel: null,
    })),
    ...roleAssignments.map((assignment) => ({
      id: `assignment-${assignment.id}`,
      kind: "assignment" as const,
      href: assignment.team ? `/teams/${assignment.team.id}#operational-history` : `/people/${assignment.person.id}#operational-history`,
      title: `${assignment.person.firstName} ${assignment.person.lastName} · ${formatEnumLabel(assignment.roleType)}`,
      changeLabel:
        assignment.createdAt.getTime() === assignment.updatedAt.getTime()
          ? "Role assignment added"
          : "Role assignment updated",
      changedAt: assignment.updatedAt,
      summary: `Scope: ${formatEnumLabel(assignment.scopeType)}${
        assignment.team ? ` · Team: ${assignment.team.name}` : assignment.program ? ` · Program: ${assignment.program.name}` : ""
      }`,
      contexts: compactContexts([
        buildContext("Person", `${assignment.person.firstName} ${assignment.person.lastName}`, `/people/${assignment.person.id}`),
        assignment.team ? buildContext("Team", assignment.team.name, `/teams/${assignment.team.id}`) : null,
        assignment.program ? buildContext("Program", assignment.program.name, `/programs/${assignment.program.id}`) : null,
      ]),
      actor: { label: "Actor", name: null, href: null },
      unresolvedLabel: null,
    })),
  ];

  return items
    .filter((item): item is OperationalHistoryItem => Boolean(item))
    .sort((left, right) => right.changedAt.getTime() - left.changedAt.getTime())
    .slice(0, limit);
}

function buildContext(label: string, value: string, href: string | null): OperationalHistoryContext {
  return { label, value, href };
}

function compactContexts(items: Array<OperationalHistoryContext | null>) {
  return items.filter((item): item is OperationalHistoryContext => Boolean(item));
}

function dedupeContexts(items: OperationalHistoryContext[]) {
  return items.filter(
    (item, index, array) =>
      array.findIndex(
        (candidate) =>
          candidate.label === item.label && candidate.value === item.value && candidate.href === item.href,
      ) === index,
  );
}

function isUnresolvedTaskStatus(value: string) {
  return value === TaskStatus.OPEN || value === TaskStatus.IN_PROGRESS || value === TaskStatus.BLOCKED;
}
