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
          className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
            i < 3 ? "bg-yellow-50 border border-yellow-100" : "bg-gray-50"
          }`}
        >
          <span className="w-8 text-center font-bold text-gray-500">
            {r.rank !== null ? (medals[r.rank] ?? r.rank) : "DNF"}
          </span>
          <span className="flex-1 font-medium">{r.athlete.name}</span>
          <span className="text-gray-400 text-sm">{r.athlete.nationCode}</span>
        </div>
      ))}
    </div>
  );
}
