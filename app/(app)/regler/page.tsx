export default function ReglerPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Poängregler</h1>
        <p className="text-white/50 mt-1 text-sm">
          Så här räknas poängen i VM-tips 2026.
        </p>
      </div>

      {/* Group stage */}
      <section className="glass-card space-y-5">
        <div className="flex items-center gap-3">
          <span
            className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest"
            style={{ background: "rgba(59,130,246,0.2)", color: "rgb(147,197,253)" }}
          >
            Gruppspel
          </span>
          <span className="text-white/30 text-sm">72 matcher · tippa innan VM startar</span>
        </div>

        <p className="text-white/65 leading-relaxed">
          I gruppspelet tippar du <strong className="text-white/85">exakt resultat</strong> på alla 72
          matcher — t.ex. &quot;Brasilien 2–1 Frankrike&quot;. Alla tips måste lämnas in innan den
          första matchen i turneringen sparkas igång. Du kan uppdatera dina tips fram till dess.
        </p>

        <div className="space-y-3">
          <RuleRow pts={3} color="gold" label="Exakt rätt resultat" example='Tips 2–1, verkligt 2–1' />
          <RuleRow pts={1} color="silver" label="Rätt utfall (hemmaseger / oavgjort / bortaseger)" example='Tips 2–1, verkligt 3–1 — rätt utfall, fel mål' />
          <RuleRow pts={0} color="none" label="Fel utfall" example='Tips 2–1, verkligt 1–2' />
        </div>

        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.15)" }}
        >
          <p className="text-white/55 leading-relaxed">
            <strong className="text-white/75">Maxpoäng per match:</strong> 3 p &nbsp;·&nbsp;
            <strong className="text-white/75">Maxpoäng totalt:</strong> 216 p (72 × 3)
          </p>
        </div>
      </section>

      {/* Knockout */}
      <section className="glass-card space-y-5">
        <div className="flex items-center gap-3">
          <span
            className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest"
            style={{ background: "rgba(16,185,129,0.2)", color: "rgb(110,231,183)" }}
          >
            Slutspel
          </span>
          <span className="text-white/30 text-sm">Omgång 32 → Semifinaler + Bronsmatch</span>
        </div>

        <p className="text-white/65 leading-relaxed">
          När slutspelsträdet är klart — efter att alla gruppspelsmatcher är avgjorda — öppnas
          tipsningen för slutspelet. Du tippar <strong className="text-white/85">enbart vem som vinner</strong> varje
          match, inga mål. Alla slutspelstips måste lämnas in innan den första slutspelsmatchen startar.
        </p>

        <div className="space-y-3">
          <RuleRow pts={2} color="green" label="Rätt vinnare" example="Tips: Brasilien vinner — Brasilien vinner" />
          <RuleRow pts={0} color="none" label="Fel vinnare" example="" />
        </div>

        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.15)" }}
        >
          <p className="text-white/55 leading-relaxed">
            Vinnaren avgörs efter <strong className="text-white/75">hela matchen</strong> — inkl.
            eventuell förlängning och straffar.
            Vid straffläggning räknas vinnaren av straffarna som matchvinnare.
          </p>
        </div>
      </section>

      {/* Final */}
      <section className="glass-card space-y-5">
        <div className="flex items-center gap-3">
          <span
            className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest"
            style={{ background: "rgba(245,200,66,0.2)", color: "rgb(245,200,66)" }}
          >
            Finalen
          </span>
          <span className="text-white/30 text-sm">1 match · max 5 p</span>
        </div>

        <p className="text-white/65 leading-relaxed">
          Finalen är det stora testet. Du tippar <em>både</em>{" "}
          <strong className="text-white/85">resultatet efter 90 min</strong> (ordinarie tid) och{" "}
          <strong className="text-white/85">vem som vinner</strong> turneringen — vilket kan skilja sig
          om matchen avgörs i förlängning eller på straffar.
        </p>

        <div className="space-y-3">
          <RuleRow
            pts={5}
            color="gold"
            label="Rätt vinnare + exakt rätt 90-min resultat"
            example="Tips: 1–1 / Argentina vinner  ·  Verkligt: 1–1 / Argentina vinner på straffar"
          />
          <RuleRow
            pts={2}
            color="green"
            label="Rätt vinnare, men fel 90-min resultat"
            example="Tips: 2–0 / Argentina vinner  ·  Verkligt: 1–1 / Argentina vinner på straffar"
          />
          <RuleRow pts={0} color="none" label="Fel vinnare" example="" />
        </div>

        <div
          className="rounded-xl px-4 py-3 text-sm space-y-1.5"
          style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.15)" }}
        >
          <p className="text-white/55 leading-relaxed">
            <strong className="text-white/75">90-min resultatet</strong> = slutresultatet efter ordinarie
            tid. Förlängningsresultatet räknas <em>inte</em> in.
          </p>
          <p className="text-white/55 leading-relaxed">
            <strong className="text-white/75">Vinnaren</strong> = vem som tar VM-guldet efter hela
            matchen (inkl. förlängning och straffar).
          </p>
        </div>
      </section>

      {/* Quick reference */}
      <section className="glass-card">
        <h2 className="font-bold text-white mb-4">Snabbreferens</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-[11px] uppercase tracking-widest">
                <th className="text-left pb-3 pr-4">Fas</th>
                <th className="text-left pb-3 pr-4">Vad du tippar</th>
                <th className="text-right pb-3">Poäng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2.5 pr-4 text-white/60 align-top">Gruppspel</td>
                <td className="py-2.5 pr-4 text-white/80">Exakt resultat</td>
                <td className="py-2.5 text-right font-bold text-app-gold">3 p</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-white/60 align-top"></td>
                <td className="py-2.5 pr-4 text-white/80">Rätt utfall</td>
                <td className="py-2.5 text-right font-bold text-white/60">1 p</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-white/60 align-top">Slutspel</td>
                <td className="py-2.5 pr-4 text-white/80">Rätt vinnare</td>
                <td className="py-2.5 text-right font-bold" style={{ color: "rgb(110,231,183)" }}>2 p</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-white/60 align-top">Final</td>
                <td className="py-2.5 pr-4 text-white/80">Rätt vinnare + exakt 90-min</td>
                <td className="py-2.5 text-right font-bold text-app-gold">5 p</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-white/60 align-top"></td>
                <td className="py-2.5 pr-4 text-white/80">Rätt vinnare</td>
                <td className="py-2.5 text-right font-bold" style={{ color: "rgb(110,231,183)" }}>2 p</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type PtColor = "gold" | "silver" | "green" | "none";

const PT_STYLES: Record<PtColor, { bg: string; color: string }> = {
  gold:   { bg: "rgba(245,200,66,0.18)",  color: "rgb(245,200,66)" },
  silver: { bg: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" },
  green:  { bg: "rgba(52,211,153,0.15)",  color: "rgb(110,231,183)" },
  none:   { bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" },
};

function RuleRow({ pts, color, label, example }: { pts: number; color: PtColor; label: string; example?: string }) {
  const style = PT_STYLES[color];
  return (
    <div className="flex items-start gap-3">
      <span
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black tabular-nums"
        style={{ background: style.bg, color: style.color }}
      >
        {pts}p
      </span>
      <div className="pt-0.5">
        <p className="text-white/80 font-semibold leading-snug">{label}</p>
        {example && <p className="text-white/35 text-xs mt-0.5 leading-snug">{example}</p>}
      </div>
    </div>
  );
}
