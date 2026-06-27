import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateKnockoutPredictionWindow,
  knockoutPredictionWindowError,
  type KnockoutPredictionWindowInput,
} from "../lib/prediction-windows";

const baseInput: KnockoutPredictionWindowInput = {
  now: new Date("2026-06-28T12:00:00Z"),
  groupMatchesTotal: 72,
  incompleteGroupMatches: 0,
  knockoutMatchesTotal: 32,
  initialKnockoutStage: "r32",
  initialKnockoutMatchesTotal: 16,
  incompleteInitialKnockoutMatches: 0,
  firstKnockoutStartsAt: new Date("2026-06-28T19:00:00Z"),
  startedKnockoutMatches: 0,
};

describe("knockout prediction window", () => {
  it("opens after groups are complete and the first knockout round is ready", () => {
    const window = evaluateKnockoutPredictionWindow(baseInput);

    assert.equal(window.isOpen, true);
    assert.equal(window.groupStageCompleted, true);
    assert.equal(window.knockoutBracketReady, true);
    assert.equal(window.knockoutStarted, false);
  });

  it("stays closed while first-round knockout teams are still placeholders", () => {
    const window = evaluateKnockoutPredictionWindow({
      ...baseInput,
      incompleteInitialKnockoutMatches: 2,
    });

    assert.equal(window.isOpen, false);
    assert.equal(window.knockoutBracketReady, false);
    assert.equal(
      knockoutPredictionWindowError(window),
      "Slutspelstipsningen \u00f6ppnar n\u00e4r alla lag i f\u00f6rsta slutspelsrundan \u00e4r klara."
    );
  });

  it("stays closed until all group matches are completed", () => {
    const window = evaluateKnockoutPredictionWindow({
      ...baseInput,
      incompleteGroupMatches: 1,
    });

    assert.equal(window.isOpen, false);
    assert.equal(window.groupStageCompleted, false);
  });

  it("closes when the first knockout match starts", () => {
    const window = evaluateKnockoutPredictionWindow({
      ...baseInput,
      now: new Date("2026-06-28T19:00:00Z"),
    });

    assert.equal(window.isOpen, false);
    assert.equal(window.knockoutStarted, true);
  });
});
