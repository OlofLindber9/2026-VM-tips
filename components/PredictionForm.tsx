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

interface AthleteSelectProps {
  label: string;
  value: string;
  onChange: (id: string) => void;
  position: number;
  athletes: Athlete[];
  disabled: boolean;
}

function AthleteSelect({ label, value, onChange, position, athletes, disabled }: AthleteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const medals = ["🥇", "🥈", "🥉"];
  const selected = athletes.find((a) => a.id === value);
  const filtered = athletes.filter(
    (a) =>
      search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.nationCode.toLowerCase().includes(search.toLowerCase())
  );

  function open() {
    if (disabled) return;
    setIsOpen(true);
    setSearch("");
  }

  function close() {
    setIsOpen(false);
    setSearch("");
  }

  function handleSelect(id: string) {
    onChange(id);
    close();
  }

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
        {medals[position - 1]} {label}
      </label>

      <button
        type="button"
        onClick={isOpen ? close : open}
        disabled={disabled}
        className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: "rgba(255,255,255,0.07)",
          border: selected
            ? "1px solid rgba(232,160,32,0.5)"
            : "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-white font-medium truncate">{selected.name}</span>
            <span
              className="text-xs shrink-0 px-1.5 py-0.5 rounded-md font-semibold"
              style={{ background: "rgba(232,160,32,0.15)", color: "rgb(232,160,32)" }}
            >
              {selected.nationCode}
            </span>
          </span>
        ) : (
          <span className="text-white/35">— välj lag —</span>
        )}
        <svg
          className={`w-4 h-4 text-white/40 shrink-0 ml-2 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl overflow-hidden shadow-2xl"
            style={{
              background: "rgba(4,13,8,0.98)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <div className="p-2 border-b border-white/8">
              <input
                type="text"
                placeholder="Sök lag…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="input-dark py-2 text-sm"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="px-4 py-4 text-sm text-white/30 text-center">Inga lag hittades</div>
              ) : (
                filtered.map((a) => {
                  const isSelected = a.id === value;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelect(a.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors duration-100"
                      style={
                        isSelected
                          ? { background: "rgba(232,160,32,0.12)", color: "rgb(245,200,66)" }
                          : { color: "rgba(255,255,255,0.75)" }
                      }
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "";
                      }}
                    >
                      <span className="font-medium truncate">{a.name}</span>
                      <span
                        className="text-xs shrink-0 ml-3 px-1.5 py-0.5 rounded-md font-semibold"
                        style={
                          isSelected
                            ? { background: "rgba(232,160,32,0.2)", color: "rgb(232,160,32)" }
                            : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                        }
                      >
                        {a.nationCode}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function PredictionForm({
  race,
  groups,
  existingPredictions,
  athletePool,
  locked = false,
}: Props) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id || "");

  const initialPred = existingPredictions.find((p) => p.groupId === groups[0]?.id);
  const [first, setFirst] = useState(initialPred?.first || "");
  const [second, setSecond] = useState(initialPred?.second || "");
  const [third, setThird] = useState(initialPred?.third || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isCompleted = race.status === "completed";
  const isLocked = isCompleted || locked;
  const existing = existingPredictions.find((p) => p.groupId === selectedGroup);

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

  function athleteName(id: string) {
    return athletePool.find((a) => a.id === id)?.name || id;
  }

  function athleteNation(id: string) {
    return athletePool.find((a) => a.id === id)?.nationCode || "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!first || !second || !third) {
      setError("Välj alla tre positionerna.");
      return;
    }
    if (first === second || first === third || second === third) {
      setError("Varje position måste ha ett unikt lag.");
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
      setError(data.error || "Något gick fel");
    } else {
      setSuccess(true);
    }
  }

  return (
    <div
      className="glass-card space-y-5"
      style={existing && !isLocked ? { borderColor: "rgba(52, 211, 153, 0.35)" } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-white">
            {isLocked || existing ? "Ditt tips" : "Lägg ditt tips"}
          </h2>
          {existing && !isLocked && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border"
              style={{
                background: "rgba(52, 211, 153, 0.12)",
                borderColor: "rgba(52, 211, 153, 0.3)",
                color: "rgb(110, 231, 183)",
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Sparat
            </span>
          )}
        </div>
        {existing?.score !== null && existing?.score !== undefined && (
          <span className="text-app-accent font-bold text-lg">{existing.score} pts</span>
        )}
      </div>

      {/* Gruppselektor */}
      {groups.length > 1 && (
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
            Grupp
          </label>
          <select
            value={selectedGroup}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="select-dark"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nuvarande tips — visas när tippet finns och matchen fortfarande kan ändras */}
      {existing && !isLocked && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: "rgba(52, 211, 153, 0.06)", border: "1px solid rgba(52, 211, 153, 0.2)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(110, 231, 183, 0.65)" }}>
            Nuvarande tips
          </p>
          {[
            { medal: "🥇", id: existing.first },
            { medal: "🥈", id: existing.second },
            { medal: "🥉", id: existing.third },
          ].map(({ medal, id }) => (
            <div key={id} className="flex items-center gap-2">
              <span className="text-base leading-none">{medal}</span>
              <span className="text-sm text-white/85 font-medium">{athleteName(id)}</span>
              <span className="ml-auto text-xs text-white/35">{athleteNation(id)}</span>
            </div>
          ))}
          <p className="text-xs text-white/30 pt-0.5">Använd listorna nedan för att ändra</p>
        </div>
      )}

      {/* Låst vy — matchen är passerad eller avslutad */}
      {isLocked && existing ? (
        <div className="space-y-2">
          {[
            { pos: 1, id: existing.first },
            { pos: 2, id: existing.second },
            { pos: 3, id: existing.third },
          ].map(({ pos, id }) => {
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div
                key={pos}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/10"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <span className="text-xl">{medals[pos - 1]}</span>
                <span className="font-medium text-white/90">{athleteName(id)}</span>
                <span className="text-white/40 text-sm ml-auto">{athleteNation(id)}</span>
              </div>
            );
          })}
        </div>
      ) : isLocked ? (
        <p className="text-sm text-white/40 text-center py-4">
          Tipsningen är stängd för den här matchen.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AthleteSelect
            label="Vinnare (1:a)"
            value={first}
            onChange={setFirst}
            position={1}
            athletes={athletePool}
            disabled={isLocked}
          />
          <AthleteSelect
            label="2:a plats"
            value={second}
            onChange={setSecond}
            position={2}
            athletes={athletePool}
            disabled={isLocked}
          />
          <AthleteSelect
            label="3:e plats"
            value={third}
            onChange={setThird}
            position={3}
            athletes={athletePool}
            disabled={isLocked}
          />

          {error && (
            <div className="text-red-300 text-sm bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}
          {success && (
            <div className="text-emerald-300 text-sm bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-4 py-2.5">
              Tipset är sparat!
            </div>
          )}

          <button type="submit" disabled={loading || isLocked} className="btn-primary w-full">
            {loading ? "Sparar…" : existing ? "Uppdatera tips" : "Skicka tips"}
          </button>
        </form>
      )}

      {!isLocked && !existing && athletePool.length === 0 && (
        <p className="text-sm text-white/40 text-center py-4">
          Laglistan är inte tillgänglig ännu. Kom tillbaka närmre matchen.
        </p>
      )}
    </div>
  );
}
