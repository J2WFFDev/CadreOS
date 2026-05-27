import { strict as assert } from "node:assert";
import test from "node:test";

import { selectSeededOrCurrentSeason } from "../../lib/workflows";

test("selectSeededOrCurrentSeason returns null when no seasons exist", () => {
  assert.equal(selectSeededOrCurrentSeason([]), null);
});

test("selectSeededOrCurrentSeason prefers an in-range current season", () => {
  const now = new Date();
  const current = {
    id: "season-current",
    name: "Spring Current",
    startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  };
  const old = {
    id: "season-old",
    name: "Fall Old",
    startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
  };

  assert.equal(selectSeededOrCurrentSeason([old, current])?.id, current.id);
});

test("selectSeededOrCurrentSeason falls back to demo season when no current season exists", () => {
  const now = new Date();
  const future = {
    id: "season-future",
    name: "Future",
    startDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    endDate: null,
  };
  const demo = {
    id: "season-demo",
    name: "Demo Season",
    startDate: null,
    endDate: null,
  };

  assert.equal(selectSeededOrCurrentSeason([future, demo])?.id, demo.id);
});

test("selectSeededOrCurrentSeason falls back to first season when no current or demo season exists", () => {
  const now = new Date();
  const first = {
    id: "season-1",
    name: "Season One",
    startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    endDate: null,
  };
  const second = {
    id: "season-2",
    name: "Season Two",
    startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    endDate: null,
  };

  assert.equal(selectSeededOrCurrentSeason([first, second])?.id, first.id);
});
