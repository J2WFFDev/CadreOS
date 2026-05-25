import { AttendanceStatus, RSVPStatus } from "@prisma/client";

export type AttendanceCoverage = "complete" | "partial" | "missing" | "captured" | "not_applicable";
export type AttendanceTrendDirection = "up" | "down" | "steady" | "insufficient_data";

type AttendanceRecordLike = {
  personId: string;
  status: AttendanceStatus;
};

type RSVPRecordLike = {
  personId: string;
  status: RSVPStatus;
};

type AttendanceTrendInput = {
  startsAt: Date;
  expectedPersonIds: string[];
  attendanceRecords: AttendanceRecordLike[];
};

export function getUniquePersonIds(personIds: Iterable<string | null | undefined>): string[] {
  const uniquePersonIds = new Set<string>();

  for (const personId of personIds) {
    if (personId) {
      uniquePersonIds.add(personId);
    }
  }

  return [...uniquePersonIds];
}

export function getAttendanceCoverage(
  expectedAttendanceCount: number,
  capturedAttendanceCount: number,
  missingAttendanceCount: number,
): AttendanceCoverage {
  if (expectedAttendanceCount === 0) {
    return capturedAttendanceCount > 0 ? "captured" : "not_applicable";
  }

  if (capturedAttendanceCount === 0) {
    return "missing";
  }

  if (missingAttendanceCount > 0) {
    return "partial";
  }

  return "complete";
}

export function summarizeAttendanceParticipation(input: {
  expectedPersonIds: string[];
  attendanceRecords: AttendanceRecordLike[];
}) {
  const expectedPersonIds = getUniquePersonIds(input.expectedPersonIds);
  const attendanceByPersonId = new Map<string, AttendanceStatus>();
  const statusCounts = Object.values(AttendanceStatus).reduce(
    (counts, status) => {
      counts[status] = 0;
      return counts;
    },
    {} as Record<AttendanceStatus, number>,
  );

  for (const record of input.attendanceRecords) {
    if (!attendanceByPersonId.has(record.personId)) {
      attendanceByPersonId.set(record.personId, record.status);
    }
  }

  attendanceByPersonId.forEach((status) => {
    statusCounts[status] += 1;
  });

  const expectedAttendanceCount = expectedPersonIds.length;
  const capturedAttendanceCount = attendanceByPersonId.size;
  const missingPersonIds = expectedPersonIds.filter((personId) => !attendanceByPersonId.has(personId));
  const missingAttendanceCount = expectedAttendanceCount > 0 ? missingPersonIds.length : 0;
  const capturedWithinExpectationCount = Math.min(capturedAttendanceCount, expectedAttendanceCount);
  const captureRatePercent =
    expectedAttendanceCount > 0
      ? Math.round((capturedWithinExpectationCount / expectedAttendanceCount) * 100)
      : 0;

  return {
    expectedAttendanceCount,
    capturedAttendanceCount,
    capturedWithinExpectationCount,
    missingAttendanceCount,
    missingPersonIds,
    captureRatePercent,
    coverage: getAttendanceCoverage(expectedAttendanceCount, capturedAttendanceCount, missingAttendanceCount),
    presentCount: statusCounts[AttendanceStatus.PRESENT],
    lateCount: statusCounts[AttendanceStatus.LATE],
    excusedAbsentCount: statusCounts[AttendanceStatus.EXCUSED_ABSENT],
    unexcusedAbsentCount: statusCounts[AttendanceStatus.UNEXCUSED_ABSENT],
    concernCount:
      missingAttendanceCount + statusCounts[AttendanceStatus.LATE] + statusCounts[AttendanceStatus.UNEXCUSED_ABSENT],
  };
}

export function summarizeRsvpReadiness(input: {
  expectedPersonIds: string[];
  rsvps: RSVPRecordLike[];
}) {
  const expectedPersonIds = getUniquePersonIds(input.expectedPersonIds);
  const rsvpByPersonId = new Map<string, RSVPStatus>();
  const statusCounts = Object.values(RSVPStatus).reduce(
    (counts, status) => {
      counts[status] = 0;
      return counts;
    },
    {} as Record<RSVPStatus, number>,
  );

  for (const rsvp of input.rsvps) {
    if (!rsvpByPersonId.has(rsvp.personId)) {
      rsvpByPersonId.set(rsvp.personId, rsvp.status);
    }
  }

  rsvpByPersonId.forEach((status) => {
    statusCounts[status] += 1;
  });

  const expectedResponseCount = expectedPersonIds.length;
  const respondedCount = rsvpByPersonId.size;
  const noResponsePersonIds = expectedPersonIds.filter((personId) => !rsvpByPersonId.has(personId));
  const noResponseCount = expectedResponseCount > 0 ? noResponsePersonIds.length : 0;
  const responseRatePercent =
    expectedResponseCount > 0 ? Math.round((Math.min(respondedCount, expectedResponseCount) / expectedResponseCount) * 100) : 0;

  return {
    expectedResponseCount,
    respondedCount,
    noResponseCount,
    noResponsePersonIds,
    responseRatePercent,
    goingCount: statusCounts[RSVPStatus.GOING],
    maybeCount: statusCounts[RSVPStatus.MAYBE],
    notGoingCount: statusCounts[RSVPStatus.NOT_GOING],
  };
}

function calculateCoveragePercent(summaries: Array<{ expectedAttendanceCount: number; capturedWithinExpectationCount: number }>) {
  const totals = summaries.reduce(
    (coverage, summary) => {
      coverage.expectedAttendanceCount += summary.expectedAttendanceCount;
      coverage.capturedWithinExpectationCount += summary.capturedWithinExpectationCount;
      return coverage;
    },
    { expectedAttendanceCount: 0, capturedWithinExpectationCount: 0 },
  );

  return totals.expectedAttendanceCount > 0
    ? Math.round((totals.capturedWithinExpectationCount / totals.expectedAttendanceCount) * 100)
    : 0;
}

export function summarizeAttendanceTrend(input: AttendanceTrendInput[]) {
  const summaries = input
    .map((event) => ({
      startsAt: event.startsAt,
      ...summarizeAttendanceParticipation({
        expectedPersonIds: event.expectedPersonIds,
        attendanceRecords: event.attendanceRecords,
      }),
    }))
    .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());

  const reviewedEvents = summaries.filter((summary) => summary.expectedAttendanceCount > 0);
  const completeEvents = reviewedEvents.filter((summary) => summary.coverage === "complete").length;
  const partialEvents = reviewedEvents.filter((summary) => summary.coverage === "partial").length;
  const missingEvents = reviewedEvents.filter((summary) => summary.coverage === "missing").length;
  const capturedWithoutExpectationEvents = summaries.filter((summary) => summary.coverage === "captured").length;
  const coveragePercent = calculateCoveragePercent(reviewedEvents);
  const comparisonWindowSize = Math.min(3, Math.floor(reviewedEvents.length / 2));

  if (comparisonWindowSize === 0) {
    return {
      reviewedEventCount: reviewedEvents.length,
      completeEvents,
      partialEvents,
      missingEvents,
      capturedWithoutExpectationEvents,
      coveragePercent,
      recentCoveragePercent: coveragePercent,
      priorCoveragePercent: coveragePercent,
      trendDirection: "insufficient_data" as AttendanceTrendDirection,
    };
  }

  const recentCoveragePercent = calculateCoveragePercent(reviewedEvents.slice(0, comparisonWindowSize));
  const priorCoveragePercent = calculateCoveragePercent(
    reviewedEvents.slice(comparisonWindowSize, comparisonWindowSize * 2),
  );
  const coverageDelta = recentCoveragePercent - priorCoveragePercent;

  return {
    reviewedEventCount: reviewedEvents.length,
    completeEvents,
    partialEvents,
    missingEvents,
    capturedWithoutExpectationEvents,
    coveragePercent,
    recentCoveragePercent,
    priorCoveragePercent,
    trendDirection:
      Math.abs(coverageDelta) < 5
        ? ("steady" as AttendanceTrendDirection)
        : coverageDelta > 0
          ? ("up" as AttendanceTrendDirection)
          : ("down" as AttendanceTrendDirection),
  };
}
