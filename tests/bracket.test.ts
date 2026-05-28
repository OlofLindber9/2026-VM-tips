import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bracketSlotUpdatesForCompletedMatch } from "../lib/bracket";

describe("bracket advancement", () => {
  it("advances a normal knockout winner to the configured next slot", () => {
    assert.deepEqual(
      bracketSlotUpdatesForCompletedMatch({
        stage: "r32",
        homeTeamId: "SWE",
        awayTeamId: "BRA",
        knockoutWinner: "away",
        nextMatchCode: "R16-1",
        nextMatchSlot: "home",
      }),
      [{ bracketCode: "R16-1", slot: "home", teamId: "BRA" }]
    );
  });

  it("fills final with the semifinal winner and bronze match with the loser", () => {
    assert.deepEqual(
      bracketSlotUpdatesForCompletedMatch({
        stage: "sf",
        homeTeamId: "ARG",
        awayTeamId: "FRA",
        knockoutWinner: "home",
        nextMatchCode: "F",
        nextMatchSlot: "away",
      }),
      [
        { bracketCode: "F", slot: "away", teamId: "ARG" },
        { bracketCode: "3P", slot: "away", teamId: "FRA" },
      ]
    );
  });

  it("does not propagate placeholder winners or losers", () => {
    assert.deepEqual(
      bracketSlotUpdatesForCompletedMatch({
        stage: "sf",
        homeTeamId: "TBD-SF-1",
        awayTeamId: "BRA",
        knockoutWinner: "home",
        nextMatchCode: "F",
        nextMatchSlot: "home",
      }),
      [{ bracketCode: "3P", slot: "home", teamId: "BRA" }]
    );
  });

  it("ignores malformed winner sides", () => {
    assert.deepEqual(
      bracketSlotUpdatesForCompletedMatch({
        stage: "sf",
        homeTeamId: "ARG",
        awayTeamId: "FRA",
        knockoutWinner: "draw",
        nextMatchCode: "F",
        nextMatchSlot: "home",
      }),
      []
    );
  });

  it("supports isolated bracket code prefixes", () => {
    assert.deepEqual(
      bracketSlotUpdatesForCompletedMatch({
        stage: "sf",
        homeTeamId: "ARG",
        awayTeamId: "FRA",
        knockoutWinner: "away",
        nextMatchCode: "test-run-F",
        nextMatchSlot: "home",
      }),
      [
        { bracketCode: "test-run-F", slot: "home", teamId: "FRA" },
        { bracketCode: "test-run-3P", slot: "home", teamId: "ARG" },
      ]
    );
  });
});
