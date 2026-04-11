import { getResult } from "@/lib/scoring";

interface Props {
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  homeScore: number;
  awayScore: number;
}

export default function MatchResult({ homeTeam, awayTeam, homeScore, awayScore }: Props) {
  const result = getResult(homeScore, awayScore);

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl px-6 py-5 border"
      style={{
        background:
          result === "home"
            ? "rgba(52, 211, 153, 0.08)"
            : result === "away"
            ? "rgba(251, 113, 133, 0.08)"
            : "rgba(251, 191, 36, 0.08)",
        borderColor:
          result === "home"
            ? "rgba(52, 211, 153, 0.3)"
            : result === "away"
            ? "rgba(251, 113, 133, 0.3)"
            : "rgba(251, 191, 36, 0.3)",
      }}
    >
      {/* Home team */}
      <div className="flex-1 text-right">
        <p
          className="font-bold text-lg"
          style={{ color: result === "home" ? "rgb(110, 231, 183)" : "rgba(255,255,255,0.7)" }}
        >
          {homeTeam.name}
        </p>
        {result === "home" && (
          <p className="text-xs text-white/40 mt-0.5">Vinnare</p>
        )}
      </div>

      {/* Score */}
      <div className="text-center shrink-0">
        <p
          className="text-4xl font-black tabular-nums tracking-tight"
          style={{
            color:
              result === "home"
                ? "rgb(110, 231, 183)"
                : result === "away"
                ? "rgb(253, 164, 175)"
                : "rgb(253, 224, 71)",
          }}
        >
          {homeScore} – {awayScore}
        </p>
        <p
          className="text-xs font-bold uppercase tracking-wider mt-1"
          style={{
            color:
              result === "home"
                ? "rgba(110, 231, 183, 0.6)"
                : result === "away"
                ? "rgba(253, 164, 175, 0.6)"
                : "rgba(253, 224, 71, 0.6)",
          }}
        >
          {result === "home" ? "Hemmaseger" : result === "away" ? "Bortaseger" : "Oavgjort"}
        </p>
      </div>

      {/* Away team */}
      <div className="flex-1 text-left">
        <p
          className="font-bold text-lg"
          style={{ color: result === "away" ? "rgb(253, 164, 175)" : "rgba(255,255,255,0.7)" }}
        >
          {awayTeam.name}
        </p>
        {result === "away" && (
          <p className="text-xs text-white/40 mt-0.5">Vinnare</p>
        )}
      </div>
    </div>
  );
}
