import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const libraryPage = source("../../app/(dashboard)/habits/page.tsx");
const createPage = source("../../app/(dashboard)/habits/create/page.tsx");
const createRoute = source("../../app/(dashboard)/habits/create/save/route.ts");
const detailPage = source("../../app/(dashboard)/habits/[habitId]/page.tsx");
const checkInRoute = source("../../app/(dashboard)/habits/[habitId]/check-in/route.ts");
const archiveRoute = source("../../app/(dashboard)/habits/[habitId]/archive/route.ts");
const restoreRoute = source("../../app/(dashboard)/habits/[habitId]/restore/route.ts");
const schema = source("../../prisma/schema.prisma");

test("Habit Library defaults to active definitions and exposes create and archive discovery", () => {
  assert.match(libraryPage, /title="Habit Library"/);
  assert.match(libraryPage, /return "active"/);
  assert.match(libraryPage, /status: HabitStatus\.ACTIVE/);
  assert.match(libraryPage, /href="\/habits\/create"/);
  assert.match(libraryPage, /Create first habit/);
  assert.match(libraryPage, /href: "\/habits\?status=archived"/);
  assert.match(libraryPage, />Last check-in</);
  assert.match(libraryPage, />Context \/ List</);
  assert.match(libraryPage, />Visibility</);
});

test("direct Habit creation uses the Habit model and does not create a Task or Entry", () => {
  assert.match(createPage, /action="\/habits\/create\/save"/);
  assert.match(createPage, /Existing team assignment/);
  assert.match(createPage, /does not fan out or create Habits for team members/);
  assert.match(createRoute, /db\.habit\.create/);
  assert.doesNotMatch(createRoute, /db\.entry\.create|EntryType\.TASK|db\.task/);
});

test("Habit detail presents metadata, last check-in, authorized check-in, and history", () => {
  assert.match(detailPage, />Created by</);
  assert.match(detailPage, />Context</);
  assert.match(detailPage, />Visibility</);
  assert.match(detailPage, />Last check-in</);
  assert.match(detailPage, /canCheckIn \?/);
  assert.match(detailPage, />Record a check-in</);
  assert.match(detailPage, />Activity \/ history</);
  assert.match(detailPage, />Recorded by</);
  assert.doesNotMatch(detailPage, /Owner/);
});

test("Habit check-in writes completion and activity records without creating Task or Entry rows", () => {
  assert.match(checkInRoute, /canCheckInHabit/);
  assert.match(checkInRoute, /db\.habitCompletion\.create/);
  assert.match(checkInRoute, /completedBy: scope\.auth\.personId/);
  assert.match(checkInRoute, /lastCompletedAt: resolveLatestHabitCheckIn\(habit\.lastCompletedAt, completedOn\)/);
  assert.match(checkInRoute, /action: "habit\.checked_in"/);
  assert.doesNotMatch(checkInRoute, /db\.entry\.create|EntryType\.TASK|db\.task/);
});

test("Habit lifecycle routes preserve the definition and check-in history", () => {
  assert.match(archiveRoute, /status: HabitStatus\.ARCHIVED/);
  assert.match(restoreRoute, /status: HabitStatus\.ACTIVE/);
  assert.doesNotMatch(archiveRoute, /delete|deleteMany|habitCompletion/);
  assert.doesNotMatch(restoreRoute, /delete|deleteMany|habitCompletion/);
});

test("Habit definitions, check-ins, and activity are separate schema records", () => {
  assert.match(schema, /model Habit \{/);
  assert.match(schema, /model HabitCompletion \{/);
  assert.match(schema, /model HabitActivity \{/);
  assert.match(schema, /lastCompletedAt\s+DateTime\?/);
  assert.match(schema, /@@unique\(\[habitId, completedOn\]\)/);
});
