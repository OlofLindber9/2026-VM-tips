import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AFFixture } from "../lib/api-football";
import {
  buildMatchUpdate,
  resolveApiFootballKnockoutWinner,
  stageFromApiRound,
} from "../lib/sync";

const baseFixture: AFFixture = {
  fixture: {
    id: 100,
    date: "2026-07-19T19:00:00Z",
    status: { long: "Not Started", short: "NS", elapsed: null },
  },
  league: { id: 1, season: 2026, round: "Final" },
  teams: {
    home: { id: 1, name: "Argentina" },
    away: { id: 2, name: "France" },
  },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};

const baseDbMatch = {
  id: "match-1",
  apiFootballId: 100,
  homeTeamId: "ARG",
  awayTeamId: "FRA",
  scheduledAt: new Date("2026-07-19T19:00:00Z"),
  venue: "MetLife Stadium",
  city: "East Rutherford",
  country: "USA",
  stage: "final",
  status: "upcoming",
  homeScore: null,
  awayScore: null,
  minute: null,
  halftimeHomeScore: null,
  halftimeAwayScore: null,
  liveEvents: null,
  liveStats: null,
  knockoutWinner: null,
};

describe("sync fixture parsing", () => {
  it("maps API rounds to app stages", () => {
    assert.equal(stageFromApiRound("Group Stage - 1"), "group");
    assert.equal(stageFromApiRound("Round of 32"), "r32");
    assert.equal(stageFromApiRound("Quarter-finals"), "qf");
    assert.equal(stageFromApiRound("3rd Place Final"), "3p");
    assert.equal(stageFromApiRound("Final"), "final");
  });

  it("uses penalty shootout data to resolve a tied knockout winner", () => {
    assert.equal(
      resolveApiFootballKnockoutWinner({
        ...baseFixture,
        fixture: {
          ...baseFixture.fixture,
          status: { long: "Match Finished", short: "PEN", elapsed: 120 },
        },
        goals: { home: 3, away: 3 },
        score: {
          ...baseFixture.score,
          fulltime: { home: 2, away: 2 },
          extratime: { home: 3, away: 3 },
          penalty: { home: 4, away: 2 },
        },
      }),
      "home"
    );
  });

  it("falls back to extra-time scores before penalties", () => {
    assert.equal(
      resolveApiFootballKnockoutWinner({
        ...baseFixture,
        fixture: {
          ...baseFixture.fixture,
          status: { long: "Match Finished", short: "AET", elapsed: 120 },
        },
        goals: { home: 1, away: 1 },
        score: {
          ...baseFixture.score,
          fulltime: { home: 1, away: 1 },
          extratime: { home: 2, away: 1 },
        },
      }),
      "home"
    );
  });

  it("keeps final scoring on 90-minute fulltime while displaying final goals", () => {
    const update = buildMatchUpdate(baseDbMatch, {
      ...baseFixture,
      fixture: {
        ...baseFixture.fixture,
        status: { long: "Match Finished", short: "PEN", elapsed: 120 },
      },
      goals: { home: 3, away: 3 },
      score: {
        ...baseFixture.score,
        halftime: { home: 2, away: 0 },
        fulltime: { home: 2, away: 2 },
        extratime: { home: 3, away: 3 },
        penalty: { home: 4, away: 2 },
      },
    });

    assert.equal(update.nextStatus, "completed");
    assert.equal(update.nextKnockoutWinner, "home");
    assert.equal(update.scoreHome, 2);
    assert.equal(update.scoreAway, 2);
    assert.equal(update.data.homeScore, 3);
    assert.equal(update.data.awayScore, 3);
    assert.equal(update.data.knockoutWinner, "home");
  });

  it("fills seeded TBD-* teams from API team names", () => {
    const update = buildMatchUpdate(
      {
        ...baseDbMatch,
        stage: "r32",
        homeTeamId: "TBD-R32-1-HOME",
        awayTeamId: "TBD-R32-1-AWAY",
      },
      {
        ...baseFixture,
        teams: {
          home: { id: 1, name: "Brazil" },
          away: { id: 2, name: "United States" },
        },
      }
    );

    assert.equal(update.nextHomeTeamId, "BRA");
    assert.equal(update.nextAwayTeamId, "USA");
    assert.equal(update.data.homeTeamId, "BRA");
    assert.equal(update.data.awayTeamId, "USA");
    assert.equal(update.teamsUpdated, 2);
  });
});
