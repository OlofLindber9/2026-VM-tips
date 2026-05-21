import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { liveMinuteLabel, stageColor, stageLabel, teamFlag } from "../lib/utils";

describe("utils", () => {
  it("formats live minutes without double apostrophes", () => {
    assert.equal(liveMinuteLabel(null), "");
    assert.equal(liveMinuteLabel("72"), "72'");
    assert.equal(liveMinuteLabel("45+2"), "45+2'");
    assert.equal(liveMinuteLabel("72'"), "72'");
    assert.equal(liveMinuteLabel("HT"), "HT");
  });

  it("maps stages to Swedish labels and badge colors", () => {
    assert.equal(stageLabel("group"), "Gruppspel");
    assert.equal(stageLabel("final"), "Final");
    assert.equal(stageLabel("unknown"), "unknown");
    assert.equal(stageColor("final"), "badge-gold");
    assert.equal(stageColor("unknown"), "badge-gray");
  });

  it("returns known team flags and empty string for unknown ids", () => {
    assert.notEqual(teamFlag("SWE"), "");
    assert.equal(teamFlag("XXX"), "");
  });
});
