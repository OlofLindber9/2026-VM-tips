/**
 * Mock knockout bracket data for development.
 *
 * Enable by setting USE_MOCK_KNOCKOUT=true in your .env file.
 * The slutspel page will bypass the DB and render this data instead,
 * letting you develop the bracket UI without real WC 2026 fixtures.
 *
 * The mock scenario:
 *   R32 — all matches upcoming (tippable)
 *   R16+ — TBD (greyed out, as they would be before R32 is played)
 *   One R32 match set to "completed" to test that state
 *   One R32 match set to "live" to test locked state
 */

export interface MockBracketMatch {
  id: string;
  stage: string;
  status: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  homeScore: number | null;
  awayScore: number | null;
  knockoutWinner: string | null;
  scheduledAt: string;
}

const TBD = { id: "TBD", name: "TBD" };
const d = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString();

// 16 R32 matches — real teams
const R32: MockBracketMatch[] = [
  // completed — test completed state + winner highlight
  {
    id: "mock-r32-1",
    stage: "r32",
    status: "completed",
    homeTeam: { id: "BRA", name: "Brasilien" },
    awayTeam: { id: "CMR", name: "Kamerun" },
    homeScore: 3,
    awayScore: 0,
    knockoutWinner: "home",
    scheduledAt: d(-2),
  },
  // live — test locked state
  {
    id: "mock-r32-2",
    stage: "r32",
    status: "live",
    homeTeam: { id: "ARG", name: "Argentina" },
    awayTeam: { id: "POL", name: "Polen" },
    homeScore: 1,
    awayScore: 0,
    knockoutWinner: null,
    scheduledAt: d(0),
  },
  // upcoming — tippable matches
  {
    id: "mock-r32-3",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "FRA", name: "Frankrike" },
    awayTeam: { id: "MAR", name: "Marocko" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(1),
  },
  {
    id: "mock-r32-4",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "ENG", name: "England" },
    awayTeam: { id: "SEN", name: "Senegal" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(1),
  },
  {
    id: "mock-r32-5",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "ESP", name: "Spanien" },
    awayTeam: { id: "URU", name: "Uruguay" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(2),
  },
  {
    id: "mock-r32-6",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "GER", name: "Tyskland" },
    awayTeam: { id: "USA", name: "USA" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(2),
  },
  {
    id: "mock-r32-7",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "POR", name: "Portugal" },
    awayTeam: { id: "GHA", name: "Ghana" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(3),
  },
  {
    id: "mock-r32-8",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "NED", name: "Nederländerna" },
    awayTeam: { id: "ECU", name: "Ecuador" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(3),
  },
  {
    id: "mock-r32-9",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "CRO", name: "Kroatien" },
    awayTeam: { id: "JPN", name: "Japan" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(4),
  },
  {
    id: "mock-r32-10",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "BEL", name: "Belgien" },
    awayTeam: { id: "KOR", name: "Sydkorea" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(4),
  },
  {
    id: "mock-r32-11",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "MEX", name: "Mexiko" },
    awayTeam: { id: "SUI", name: "Schweiz" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(5),
  },
  {
    id: "mock-r32-12",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "COL", name: "Colombia" },
    awayTeam: { id: "DEN", name: "Danmark" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(5),
  },
  {
    id: "mock-r32-13",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "CAN", name: "Kanada" },
    awayTeam: { id: "NGA", name: "Nigeria" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(6),
  },
  {
    id: "mock-r32-14",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "AUS", name: "Australien" },
    awayTeam: { id: "IRN", name: "Iran" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(6),
  },
  {
    id: "mock-r32-15",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "SAU", name: "Saudiarabien" },
    awayTeam: { id: "EGY", name: "Egypten" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(7),
  },
  {
    id: "mock-r32-16",
    stage: "r32",
    status: "upcoming",
    homeTeam: { id: "QAT", name: "Qatar" },
    awayTeam: { id: "TUN", name: "Tunisien" },
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(7),
  },
];

// 8 R16 matches — all TBD
const R16: MockBracketMatch[] = Array.from({ length: 8 }, (_, i) => ({
  id: `mock-r16-${i + 1}`,
  stage: "r16",
  status: "upcoming",
  homeTeam: TBD,
  awayTeam: TBD,
  homeScore: null,
  awayScore: null,
  knockoutWinner: null,
  scheduledAt: d(10 + i),
}));

// 4 QF matches — all TBD
const QF: MockBracketMatch[] = Array.from({ length: 4 }, (_, i) => ({
  id: `mock-qf-${i + 1}`,
  stage: "qf",
  status: "upcoming",
  homeTeam: TBD,
  awayTeam: TBD,
  homeScore: null,
  awayScore: null,
  knockoutWinner: null,
  scheduledAt: d(14 + i),
}));

// 2 SF matches — all TBD
const SF: MockBracketMatch[] = Array.from({ length: 2 }, (_, i) => ({
  id: `mock-sf-${i + 1}`,
  stage: "sf",
  status: "upcoming",
  homeTeam: TBD,
  awayTeam: TBD,
  homeScore: null,
  awayScore: null,
  knockoutWinner: null,
  scheduledAt: d(18 + i),
}));

// 3rd place match
const THIRD_PLACE: MockBracketMatch[] = [
  {
    id: "mock-3p-1",
    stage: "3p",
    status: "upcoming",
    homeTeam: TBD,
    awayTeam: TBD,
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(21),
  },
];

// Final
const FINAL: MockBracketMatch[] = [
  {
    id: "mock-final-1",
    stage: "final",
    status: "upcoming",
    homeTeam: TBD,
    awayTeam: TBD,
    homeScore: null,
    awayScore: null,
    knockoutWinner: null,
    scheduledAt: d(22),
  },
];

export const MOCK_KNOCKOUT_MATCHES: MockBracketMatch[] = [
  ...R32,
  ...R16,
  ...QF,
  ...SF,
  ...THIRD_PLACE,
  ...FINAL,
];

/** Group matches by stage, same shape as the page's matchesByStage. */
export function getMockKnockoutByStage(): Record<string, MockBracketMatch[]> {
  const result: Record<string, MockBracketMatch[]> = {};
  for (const m of MOCK_KNOCKOUT_MATCHES) {
    if (!result[m.stage]) result[m.stage] = [];
    result[m.stage].push(m);
  }
  return result;
}
