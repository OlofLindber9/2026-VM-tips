import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEvents, parseStats } from "../lib/mock-live";
import type { AFEvent, AFTeamStatistics } from "../lib/api-football";

describe("live data parsing", () => {
  it("keeps supported events and maps sides from API team ids", () => {
    const events: AFEvent[] = [
      {
        time: { elapsed: 12, extra: null },
        team: { id: 1, name: "Home" },
        player: { id: 10, name: "Home scorer" },
        assist: { id: 11, name: "Home assist" },
        type: "Goal",
        detail: "Normal Goal",
        comments: null,
      },
      {
        time: { elapsed: 20, extra: 1 },
        team: { id: 2, name: "Away" },
        player: { id: 20, name: "Away card" },
        assist: null,
        type: "Card",
        detail: "Yellow Card",
        comments: null,
      },
      {
        time: { elapsed: 30, extra: null },
        team: { id: 2, name: "Away" },
        player: { id: 30, name: "Ignored" },
        assist: null,
        type: "Var",
        detail: "Goal cancelled",
        comments: null,
      },
    ];

    assert.deepEqual(parseEvents(events, 1), [
      {
        minute: 12,
        extra: null,
        side: "home",
        player: "Home scorer",
        assist: "Home assist",
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        minute: 20,
        extra: 1,
        side: "away",
        player: "Away card",
        assist: null,
        type: "Card",
        detail: "Yellow Card",
      },
    ]);
  });

  it("parses key statistics and treats missing values as zero", () => {
    const stats: AFTeamStatistics[] = [
      {
        team: { id: 1, name: "Home" },
        statistics: [
          { type: "Ball Possession", value: "58%" },
          { type: "Shots on Goal", value: 7 },
          { type: "Total Shots", value: null },
          { type: "Corner Kicks", value: 5 },
        ],
      },
      {
        team: { id: 2, name: "Away" },
        statistics: [
          { type: "Ball Possession", value: "42%" },
          { type: "Shots on Goal", value: 3 },
          { type: "Total Shots", value: 9 },
          { type: "Yellow Cards", value: 2 },
        ],
      },
    ];

    assert.deepEqual(parseStats(stats), {
      possession: { home: 58, away: 42 },
      shotsOnGoal: { home: 7, away: 3 },
      totalShots: { home: 0, away: 9 },
      corners: { home: 5, away: 0 },
      fouls: { home: 0, away: 0 },
      offsides: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 2 },
    });
  });

  it("returns null when statistics do not contain both teams", () => {
    assert.equal(parseStats([]), null);
    assert.equal(parseStats([{ team: { id: 1, name: "Home" }, statistics: [] }]), null);
  });
});
