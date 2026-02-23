interface ResultEntry {
  rank: number | null;
  athlete: { id: string; name: string; nationCode: string };
}

export default function ResultsPodium({ results }: { results: ResultEntry[] }) {
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <div className="space-y-2">
      {results.map((r, i) => (
        <div
          key={r.athlete.id}
          className="flex items-center gap-3 px-3 py-2 rounded-xl border transition-all"
          style={{
            background: i === 0
              ? "rgba(245, 200, 66, 0.12)"
              : i === 1
              ? "rgba(255, 255, 255, 0.06)"
              : i === 2
              ? "rgba(232, 160, 32, 0.08)"
              : "rgba(255, 255, 255, 0.04)",
            borderColor: i < 3
              ? "rgba(232, 160, 32, 0.2)"
              : "rgba(255, 255, 255, 0.08)",
          }}
        >
          <span className="w-8 text-center font-bold text-white/60">
            {r.rank !== null ? (medals[r.rank] ?? r.rank) : "DNF"}
          </span>
          <span className="flex-1 font-medium text-white/90">{r.athlete.name}</span>
          <span className="text-white/40 text-sm">{r.athlete.nationCode}</span>
        </div>
      ))}
    </div>
  );
}
