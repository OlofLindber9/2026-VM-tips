"use client";

import { useState, useEffect } from "react";

const TOURNAMENT_START = new Date("2026-06-11T00:00:00Z");

function getTimeLeft() {
  const diff = TOURNAMENT_START.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export default function TournamentCountdown() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) return null;

  const units = [
    { value: timeLeft.days, label: "Dagar" },
    { value: timeLeft.hours, label: "Timmar" },
    { value: timeLeft.minutes, label: "Minuter" },
    { value: timeLeft.seconds, label: "Sekunder" },
  ];

  return (
    <div
      className="glass-card"
      style={{ borderColor: "rgba(232, 160, 32, 0.35)" }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-app-accent mb-3">
        Tippa klart innan VM börjar
      </p>
      <div className="flex gap-2 sm:gap-3">
        {units.map(({ value, label }) => (
          <div key={label} className="flex-1 text-center">
            <div
              className="rounded-xl py-3 font-black text-2xl tabular-nums text-white mb-1"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              {String(value).padStart(2, "0")}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
              {label}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/35 text-center mt-3">
        11 juni 2026 · tippstopp för alla gruppspelsmatcher
      </p>
    </div>
  );
}
