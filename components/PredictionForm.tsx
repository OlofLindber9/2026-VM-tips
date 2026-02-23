"use client";

import { useState } from "react";

interface Athlete {
  id: string;
  name: string;
  nationCode: string;
}

interface Group {
  id: string;
  name: string;
}

interface ExistingPrediction {
  groupId: string;
  first: string;
  second: string;
  third: string;
  score: number | null;
}

interface Props {
  race: { id: string; name: string; status: string };
  groups: Group[];
  existingPredictions: ExistingPrediction[];
  athletePool: Athlete[];
  locked?: boolean;
}

export default function PredictionForm({
  race,
  groups,
  existingPredictions,
  athletePool,
  locked = false,
}: Props) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id || "");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const isCompleted = race.status === "completed";
  const isLocked = isCompleted || locked;

  const existing = existingPredictions.find((p) => p.groupId === selectedGroup);

  // Pre-fill when switching groups
  function handleGroupChange(groupId: string) {
    setSelectedGroup(groupId);
    const pred = existingPredictions.find((p) => p.groupId === groupId);
    if (pred) {
      setFirst(pred.first);
      setSecond(pred.second);
      setThird(pred.third);
    } else {
      setFirst("");
      setSecond("");
      setThird("");
    }
    setSuccess(false);
    setError("");
  }

  const filteredAthletes = athletePool.filter((a) =>
    search === "" ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.nationCode.toLowerCase().includes(search.toLowerCase())
  );

  function athleteName(id: string) {
    return athletePool.find((a) => a.id === id)?.name || id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!first || !second || !third) {
      setError("Please select all three podium positions.");
      return;
    }
    if (first === second || first === third || second === third) {
      setError("Each position must be a different athlete.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId: race.id, groupId: selectedGroup, first, second, third }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      setSuccess(true);
    }
  }

  function AthleteSelect({
    label,
    value,
    onChange,
    position,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    position: number;
  }) {
    const medals = ["🥇", "🥈", "🥉"];
    return (
      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
          {medals[position - 1]} {label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLocked}
          className="select-dark"
        >
          <option value="">— select athlete —</option>
          {filteredAthletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.nationCode})
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="glass-card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white">
          {isLocked ? "Your prediction" : "Make your prediction"}
        </h2>
        {existing?.score !== null && existing?.score !== undefined && (
          <span className="text-ski-accent font-bold text-lg">{existing.score} pts</span>
        )}
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Group</label>
          <select
            value={selectedGroup}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="select-dark"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Read-only prediction summary (race is locked — past or completed) */}
      {isLocked && existing ? (
        <div className="space-y-2">
          {[
            { pos: 1, id: existing.first },
            { pos: 2, id: existing.second },
            { pos: 3, id: existing.third },
          ].map(({ pos, id }) => {
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div key={pos} className="flex items-center gap-3 p-3 rounded-xl border border-white/10"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <span className="text-xl">{medals[pos - 1]}</span>
                <span className="font-medium text-white/90">{athleteName(id)}</span>
                <span className="text-white/40 text-sm ml-auto">
                  {athletePool.find((a) => a.id === id)?.nationCode}
                </span>
              </div>
            );
          })}
        </div>
      ) : isLocked ? (
        <p className="text-sm text-white/40 text-center py-4">
          Predictions are closed for this race.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {athletePool.length > 10 && (
            <div>
              <input
                type="text"
                placeholder="Search athletes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-dark"
              />
            </div>
          )}

          <AthleteSelect label="Winner (1st)" value={first} onChange={setFirst} position={1} />
          <AthleteSelect label="2nd place" value={second} onChange={setSecond} position={2} />
          <AthleteSelect label="3rd place" value={third} onChange={setThird} position={3} />

          {error && (
            <div className="text-red-300 text-sm bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5">{error}</div>
          )}
          {success && (
            <div className="text-emerald-300 text-sm bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-4 py-2.5">
              Prediction saved!
            </div>
          )}

          <button type="submit" disabled={loading || isLocked} className="btn-primary w-full">
            {loading ? "Saving…" : existing ? "Update prediction" : "Submit prediction"}
          </button>

          {existing && !isLocked && (
            <p className="text-xs text-white/40 text-center">
              You already have a prediction for this group — submitting will update it.
            </p>
          )}
        </form>
      )}

      {!isLocked && !existing && athletePool.length === 0 && (
        <p className="text-sm text-white/40 text-center py-4">
          Athlete list not available yet. Check back closer to race day.
        </p>
      )}
    </div>
  );
}
