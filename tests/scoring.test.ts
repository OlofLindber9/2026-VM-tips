import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actualWinnerTeamId,
  calculateFinalScore,
  calculateGroupScore,
  calculateKnockoutScore,
  calculateScore,
  getResult,
} from "../lib/scoring";

describe("scoring", () => {
  it("classifies match results", () => {
    assert.equal(getResult(2, 1), "home");
    assert.equal(getResult(1, 2), "away");
    assert.equal(getResult(1, 1), "draw");
  });

  it("scores group-stage predictions", () => {
    assert.equal(calculateGroupScore(2, 1, 2, 1), 3);
    assert.equal(calculateGroupScore(2, 0, 1, 0), 1);
    assert.equal(calculateGroupScore(1, 1, 0, 0), 1);
    assert.equal(calculateGroupScore(0, 1, 1, 0), 0);
  });

  it("scores knockout predictions by winning team id", () => {
    assert.equal(calculateKnockoutScore("SWE", "SWE"), 2);
    assert.equal(calculateKnockoutScore("SWE", "BRA"), 0);
  });

  it("scores finals with winner and exact 90-minute score", () => {
    assert.equal(calculateFinalScore("SWE", 2, 1, 2, 1, "SWE"), 5);
    assert.equal(calculateFinalScore("SWE", 1, 0, 2, 1, "SWE"), 3);
    assert.equal(calculateFinalScore("SWE", 2, 1, 2, 1, "BRA"), 0);
  });

  it("resolves home/away winner side to team id", () => {
    assert.equal(actualWinnerTeamId("home", "SWE", "BRA"), "SWE");
    assert.equal(actualWinnerTeamId("away", "SWE", "BRA"), "BRA");
    assert.equal(actualWinnerTeamId(null, "SWE", "BRA"), null);
  });

  it("uses the stage-aware calculateScore entry point", () => {
    assert.equal(calculateScore("group", 1, 1, null, 1, 1, null), 3);
    assert.equal(calculateScore("r16", null, null, "SWE", 0, 0, "SWE"), 2);
    assert.equal(calculateScore("final", 1, 1, "SWE", 1, 1, "SWE"), 5);
    assert.equal(calculateScore("final", null, 1, "SWE", 1, 1, "SWE"), 0);
  });
});
