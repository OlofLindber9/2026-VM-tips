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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {medals[position - 1]} {label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLocked}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ski-light bg-white disabled:bg-gray-50 disabled:text-gray-400"
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
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ski-blue">
          {isLocked ? "Your prediction" : "Make your prediction"}
        </h2>
        {existing?.score !== null && existing?.score !== undefined && (
          <span className="text-ski-accent font-bold text-lg">{existing.score} pts</span>
        )}
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
          <select
            value={selectedGroup}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ski-light bg-white"
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
              <div key={pos} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-xl">{medals[pos - 1]}</span>
                <span className="font-medium">{athleteName(id)}</span>
                <span className="text-gray-400 text-sm ml-auto">
                  {athletePool.find((a) => a.id === id)?.nationCode}
                </span>
              </div>
            );
          })}
        </div>
      ) : isLocked ? (
        <p className="text-sm text-gray-400 text-center py-4">
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ski-light"
              />
            </div>
          )}

          <AthleteSelect label="Winner (1st)" value={first} onChange={setFirst} position={1} />
          <AthleteSelect label="2nd place" value={second} onChange={setSecond} position={2} />
          <AthleteSelect label="3rd place" value={third} onChange={setThird} position={3} />

          {error && (
            <div className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}
          {success && (
            <div className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2">
              Prediction saved!
            </div>
          )}

          <button type="submit" disabled={loading || isLocked} className="btn-primary w-full">
            {loading ? "Saving…" : existing ? "Update prediction" : "Submit prediction"}
          </button>

          {existing && !isLocked && (
            <p className="text-xs text-gray-400 text-center">
              You already have a prediction for this group — submitting will update it.
            </p>
          )}
        </form>
      )}

      {!isLocked && !existing && athletePool.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          Athlete list not available yet. Check back closer to race day.
        </p>
      )}
    </div>
  );
}
