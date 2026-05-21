import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  csvEscape,
  formatUtc,
  legacyWinnerTeamId,
  stageLabel,
  toCsv,
} from "../scripts/export-predictions-csv";

describe("prediction CSV export helpers", () => {
  it("escapes CSV values safely", () => {
    assert.equal(csvEscape("plain"), "plain");
    assert.equal(csvEscape("A,B"), "\"A,B\"");
    assert.equal(csvEscape("He said \"yes\""), "\"He said \"\"yes\"\"\"");
    assert.equal(csvEscape(null), "");
  });

  it("serializes CSV rows with a trailing newline", () => {
    assert.equal(toCsv([["name", "value"], ["A,B", 3]]), "name,value\n\"A,B\",3\n");
  });

  it("formats UTC timestamps consistently even with milliseconds", () => {
    assert.equal(formatUtc(new Date("2026-06-11T19:00:00.000Z")), "2026-06-11 19:00:00 UTC");
    assert.equal(formatUtc(new Date("2026-06-11T19:00:00.325Z")), "2026-06-11 19:00:00 UTC");
  });

  it("uses readable stage labels", () => {
    assert.equal(stageLabel("r32"), "Round of 32");
    assert.equal(stageLabel("3p"), "Third-place match");
    assert.equal(stageLabel("other"), "other");
  });

  it("resolves legacy winner sides for backup readability", () => {
    assert.equal(legacyWinnerTeamId("home", "SWE", "BRA"), "SWE");
    assert.equal(legacyWinnerTeamId("away", "SWE", "BRA"), "BRA");
    assert.equal(legacyWinnerTeamId(null, "SWE", "BRA"), null);
  });
});
