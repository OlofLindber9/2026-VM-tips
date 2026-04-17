import type { MockEvent, MockStats } from "@/lib/mock-live";

interface Props {
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  homeScore: number;
  awayScore: number;
  halftime: { home: number; away: number } | null;
  events: MockEvent[];
  stats: MockStats | null;
  isMock?: boolean;
}

// ---------------------------------------------------------------------------
// Event icon helpers
// ---------------------------------------------------------------------------

function GoalIcon({ detail }: { detail: string }) {
  if (detail === "Own Goal") {
    return <span className="text-base" title="Självmål">⚽️</span>;
  }
  if (detail === "Penalty") {
    return <span className="text-base" title="Straff">⚽️</span>;
  }
  return <span className="text-base">⚽️</span>;
}

function CardIcon({ detail }: { detail: string }) {
  if (detail === "Red Card" || detail === "Second Yellow card") {
    return (
      <span
        className="inline-block w-3.5 h-4.5 rounded-[2px] shrink-0"
        style={{ background: "#ef4444" }}
        title="Rött kort"
      />
    );
  }
  return (
    <span
      className="inline-block w-3.5 h-[18px] rounded-[2px] shrink-0"
      style={{ background: "#eab308" }}
      title="Gult kort"
    />
  );
}

function minuteStr(minute: number, extra: number | null) {
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

// ---------------------------------------------------------------------------
// Stat comparison bar
// ---------------------------------------------------------------------------

function StatBar({
  label,
  home,
  away,
  isPct = false,
}: {
  label: string;
  home: number;
  away: number;
  isPct?: boolean;
}) {
  const total = home + away;
  const homePct = total > 0 ? Math.round((home / total) * 100) : 50;
  const awayPct = 100 - homePct;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-bold tabular-nums">
        <span className="text-white/80">{isPct ? `${home}%` : home}</span>
        <span className="text-white/45 text-[10px] font-medium uppercase tracking-wider">{label}</span>
        <span className="text-white/80">{isPct ? `${away}%` : away}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        <div
          className="rounded-l-full transition-all duration-500"
          style={{
            width: `${homePct}%`,
            background: "linear-gradient(90deg, #2d6a4f, #6ee7a0)",
          }}
        />
        <div
          className="rounded-r-full transition-all duration-500"
          style={{
            width: `${awayPct}%`,
            background: "rgba(255,255,255,0.15)",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LiveMatchDetails({
  homeTeam,
  awayTeam,
  halftime,
  events,
  stats,
  isMock = false,
}: Props) {
  const goals = events.filter((e) => e.type === "Goal");
  const htMinute = 45;

  // Build a combined timeline: events + optional HT marker
  type TimelineItem =
    | { kind: "event"; event: MockEvent }
    | { kind: "ht" };

  const timeline: TimelineItem[] = [];
  for (const event of events) {
    if (
      event.type !== "Goal" &&
      event.type !== "Card"
    ) continue;

    // Insert HT marker before first 2nd-half event
    if (
      event.minute > htMinute &&
      !timeline.some((t) => t.kind === "ht")
    ) {
      timeline.push({ kind: "ht" });
    }
    timeline.push({ kind: "event", event });
  }
  // If all events are first half, still show HT at the end if halftime score exists
  if (halftime && !timeline.some((t) => t.kind === "ht")) {
    timeline.push({ kind: "ht" });
  }

  return (
    <div className="space-y-4">
      {isMock && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
          style={{ background: "rgba(245,200,66,0.1)", color: "rgba(245,200,66,0.8)", border: "1px solid rgba(245,200,66,0.2)" }}
        >
          <span>⚠</span>
          <span>Mockdata — aktiverat via USE_MOCK_LIVE=true</span>
        </div>
      )}

      {/* Halftime score banner */}
      {halftime && (
        <div
          className="flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl text-sm"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Halvtid</span>
          <span className="font-black tabular-nums text-white/70">
            {halftime.home} – {halftime.away}
          </span>
        </div>
      )}

      {/* Events timeline */}
      <div className="glass-card">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Händelser</h3>

        {timeline.length === 0 && (
          <p className="text-sm text-white/30 text-center py-2">Inga händelser ännu</p>
        )}

        <div className="space-y-1">
          {timeline.map((item, i) => {
            if (item.kind === "ht") {
              return (
                <div key="ht" className="flex items-center gap-2 py-2 my-1">
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-2">
                    HT {halftime ? `${halftime.home}–${halftime.away}` : ""}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                </div>
              );
            }

            const { event } = item;
            const isHome = event.side === "home";
            const teamName = isHome ? homeTeam.name : awayTeam.name;
            const isGoal = event.type === "Goal";
            const isCard = event.type === "Card";
            const isOwnGoal = event.detail === "Own Goal";
            const isPenalty = event.detail === "Penalty";

            return (
              <div
                key={i}
                className="flex items-start gap-3 px-1 py-1.5 rounded-lg"
                style={{ flexDirection: isHome ? "row" : "row-reverse" }}
              >
                {/* Icon */}
                <div className="shrink-0 w-6 flex justify-center pt-0.5">
                  {isGoal && <GoalIcon detail={event.detail} />}
                  {isCard && <CardIcon detail={event.detail} />}
                </div>

                {/* Event info */}
                <div className={`flex-1 ${isHome ? "text-left" : "text-right"}`}>
                  <div className="flex items-baseline gap-1.5" style={{ justifyContent: isHome ? "flex-start" : "flex-end" }}>
                    <span className="text-xs font-black tabular-nums text-white/40 w-8 text-center shrink-0">
                      {minuteStr(event.minute, event.extra)}
                    </span>
                    <span className="text-sm font-semibold text-white leading-tight">
                      {event.player}
                      {isPenalty && <span className="text-white/40 text-xs ml-1">(S)</span>}
                      {isOwnGoal && <span className="text-white/40 text-xs ml-1">(SG)</span>}
                    </span>
                  </div>
                  {event.assist && (
                    <p className="text-xs text-white/35 mt-0.5" style={{ paddingLeft: isHome ? "2.75rem" : 0, paddingRight: isHome ? 0 : "2.75rem" }}>
                      Assist: {event.assist}
                    </p>
                  )}
                  <p className="text-[10px] text-white/25 mt-0.5" style={{ paddingLeft: isHome ? "2.75rem" : 0, paddingRight: isHome ? 0 : "2.75rem" }}>
                    {teamName}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Goal summary line */}
        {goals.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/8 flex justify-between text-xs text-white/35">
            <span>
              {goals.filter(e => e.side === "home").map(e => `${minuteStr(e.minute, e.extra)}`).join("  ")}
            </span>
            <span className="font-bold uppercase tracking-widest text-white/20">Mål</span>
            <span className="text-right">
              {goals.filter(e => e.side === "away").map(e => `${minuteStr(e.minute, e.extra)}`).join("  ")}
            </span>
          </div>
        )}
      </div>

      {/* Statistics */}
      {stats && (
        <div className="glass-card">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-white/70 truncate">{homeTeam.name}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-2">Statistik</span>
            <span className="text-xs font-semibold text-white/70 truncate text-right">{awayTeam.name}</span>
          </div>
          <div className="space-y-3 mt-3">
            <StatBar label="Bollinnehav" home={stats.possession.home} away={stats.possession.away} isPct />
            <StatBar label="Skott på mål" home={stats.shotsOnGoal.home} away={stats.shotsOnGoal.away} />
            <StatBar label="Skott totalt" home={stats.totalShots.home} away={stats.totalShots.away} />
            <StatBar label="Hörnor" home={stats.corners.home} away={stats.corners.away} />
            <StatBar label="Frisparkar" home={stats.fouls.home} away={stats.fouls.away} />
            <StatBar label="Offside" home={stats.offsides.home} away={stats.offsides.away} />
            {(stats.yellowCards.home > 0 || stats.yellowCards.away > 0) && (
              <StatBar label="Gula kort" home={stats.yellowCards.home} away={stats.yellowCards.away} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
