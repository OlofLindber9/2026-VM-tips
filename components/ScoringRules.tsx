"use client";

import { useState } from "react";

interface Props {
  defaultOpen?: boolean;
}

export default function ScoringRules({ defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="glass-card overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📋</span>
          <span className="font-bold text-white">Poängregler</span>
        </div>
        <svg
          className="w-4 h-4 text-white/40 transition-transform duration-200 group-hover:text-white/70"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-5 space-y-5 text-sm">

          {/* Group stage */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest"
                style={{ background: "rgba(59,130,246,0.2)", color: "rgb(147,197,253)" }}
              >
                Gruppspel
              </span>
              <span className="text-white/30 text-[11px]">72 matcher</span>
            </div>
            <p className="text-white/55 mb-3 leading-relaxed">
              Tippa <strong className="text-white/80">exakt resultat</strong> på alla 72 gruppspelets matcher
              — du måste lämna in dina tips <strong className="text-white/80">innan turneringen startar</strong>.
            </p>
            <div className="space-y-2">
              <RuleRow pts={3} color="gold" label="Exakt rätt resultat" example="Tips 2–1, verkligt 2–1" />
              <RuleRow pts={1} color="silver" label="Rätt utfall (H/O/B), fel mål" example="Tips 2–1, verkligt 3–1" />
              <RuleRow pts={0} color="none" label="Fel utfall" example="Tips 2–1, verkligt 1–2" />
            </div>
          </section>

          <Divider />

          {/* Knockout */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest"
                style={{ background: "rgba(16,185,129,0.2)", color: "rgb(110,231,183)" }}
              >
                Slutspel
              </span>
              <span className="text-white/30 text-[11px]">Omgång 32 → Semifinaler + Bronsmatch</span>
            </div>
            <p className="text-white/55 mb-3 leading-relaxed">
              Tippa <strong className="text-white/80">vem som vinner</strong> varje match — inga mål anges.
              Alla tips lämnas in när slutspelsträdet är klart,
              <strong className="text-white/80"> innan slutspelet startar</strong>.
            </p>
            <div className="space-y-2">
              <RuleRow pts={2} color="green" label="Rätt vinnare" example="Tips: Brasilien vinner, verkligt: Brasilien vinner" />
              <RuleRow pts={0} color="none" label="Fel vinnare" example="" />
            </div>
          </section>

          <Divider />

          {/* Final */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest"
                style={{ background: "rgba(245,200,66,0.2)", color: "rgb(245,200,66)" }}
              >
                Finalen
              </span>
            </div>
            <p className="text-white/55 mb-3 leading-relaxed">
              Finalen är speciell — tippa både <strong className="text-white/80">resultatet efter 90 min</strong> och{" "}
              <strong className="text-white/80">vem som vinner</strong> matchen (inkl. förlängning och straffar om det behövs).
            </p>
            <div className="space-y-2">
              <RuleRow
                pts={5}
                color="gold"
                label="Rätt vinnare + exakt 90-min resultat"
                example="Tips: 1–1 / Arg vinner · Verkligt: 1–1 / Arg vinner på straffar"
              />
              <RuleRow
                pts={2}
                color="green"
                label="Rätt vinnare, fel 90-min resultat"
                example="Tips: 2–0 / Arg vinner · Verkligt: 1–1 / Arg vinner på straffar"
              />
              <RuleRow pts={0} color="none" label="Fel vinnare" example="" />
            </div>
            <p className="text-white/35 text-[11px] mt-3 leading-relaxed">
              Notera: resultatet efter 90 min bedöms på <em>ordinarie tid</em> — inte inkl. förlängning.
              Vinnaren bedöms efter <em>hela matchen</em> inkl. ev. förlängning och straffar.
            </p>
          </section>

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Divider() {
  return <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />;
}

type PtColor = "gold" | "silver" | "green" | "none";

const PT_STYLES: Record<PtColor, { bg: string; color: string }> = {
  gold: { bg: "rgba(245,200,66,0.18)", color: "rgb(245,200,66)" },
  silver: { bg: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" },
  green: { bg: "rgba(52,211,153,0.15)", color: "rgb(110,231,183)" },
  none: { bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" },
};

function RuleRow({
  pts,
  color,
  label,
  example,
}: {
  pts: number;
  color: PtColor;
  label: string;
  example?: string;
}) {
  const style = PT_STYLES[color];
  return (
    <div className="flex items-start gap-3">
      <span
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black tabular-nums"
        style={{ background: style.bg, color: style.color }}
      >
        {pts}p
      </span>
      <div>
        <p className="text-white/75 font-semibold leading-snug">{label}</p>
        {example && <p className="text-white/35 text-[11px] mt-0.5 leading-snug">{example}</p>}
      </div>
    </div>
  );
}
