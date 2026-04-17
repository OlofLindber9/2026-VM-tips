// All group-stage predictions lock when the tournament kicks off
export const TOURNAMENT_START = new Date("2026-06-11T00:00:00Z");

const FLAG: Record<string, string> = {
  ALG: "🇩🇿", ARG: "🇦🇷", AUS: "🇦🇺", AUT: "🇦🇹", BEL: "🇧🇪",
  BIH: "🇧🇦", BRA: "🇧🇷", CAN: "🇨🇦", CIV: "🇨🇮", COD: "🇨🇩",
  COL: "🇨🇴", CPV: "🇨🇻", CRO: "🇭🇷", CUW: "🇨🇼", CZE: "🇨🇿",
  ECU: "🇪🇨", EGY: "🇪🇬", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ESP: "🇪🇸", FRA: "🇫🇷",
  GER: "🇩🇪", GHA: "🇬🇭", HAI: "🇭🇹", IRN: "🇮🇷", IRQ: "🇮🇶",
  JOR: "🇯🇴", JPN: "🇯🇵", KOR: "🇰🇷", MAR: "🇲🇦", MEX: "🇲🇽",
  NED: "🇳🇱", NOR: "🇳🇴", NZL: "🇳🇿", PAN: "🇵🇦", PAR: "🇵🇾",
  POR: "🇵🇹", QAT: "🇶🇦", RSA: "🇿🇦", SAU: "🇸🇦", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  SEN: "🇸🇳", SUI: "🇨🇭", SWE: "🇸🇪", TUN: "🇹🇳", TUR: "🇹🇷",
  URU: "🇺🇾", USA: "🇺🇸", UZB: "🇺🇿",
};

export function teamFlag(id: string): string {
  return FLAG[id] ?? "";
}

export function format(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function formatWithTime(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function stageLabel(stage: string): string {
  switch (stage) {
    case "group":  return "Gruppspel";
    case "r32":    return "Omgång 32";
    case "r16":    return "Åttondelsfinaler";
    case "qf":     return "Kvartsfinaler";
    case "sf":     return "Semifinaler";
    case "3p":     return "Bronsmatch";
    case "final":  return "Final";
    default:       return stage;
  }
}

export function stageColor(stage: string): string {
  switch (stage) {
    case "final":  return "badge-gold";
    case "sf":     return "badge-yellow";
    case "qf":     return "badge-green";
    case "r16":    return "badge-teal";
    case "r32":    return "badge-blue";
    case "group":  return "badge-blue";
    default:       return "badge-gray";
  }
}
