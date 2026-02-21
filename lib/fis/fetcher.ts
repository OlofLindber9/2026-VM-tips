/**
 * FIS data fetcher
 *
 * Calendar:  data.fis-ski.com/fis_events/ajax/calendarfunctions/load_calendar.html
 * Results:   data.fis-ski.com/fis_events/ajax/raceresultsfunctions/details.html
 *
 * Both return HTML that we parse with cheerio.
 */
import * as cheerio from "cheerio";

const BASE = "https://data.fis-ski.com";

export interface FisRace {
  id: string;
  name: string;
  venue: string;
  country: string;
  date: Date;
  discipline: string;
  gender: string;
  season: string;
}

export interface FisResult {
  athleteId: string;
  athleteName: string;
  nationCode: string;
  rank: number | null;
}

/** Fetch World Cup cross-country calendar for a given season (e.g. "2026") */
export async function fetchCalendar(seasonCode: string): Promise<FisRace[]> {
  const url =
    `${BASE}/fis_events/ajax/calendarfunctions/load_calendar.html` +
    `?sectorcode=CC&seasoncode=${seasonCode}&categorycode=WC`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SkiPredictor/1.0)" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`FIS calendar fetch failed: ${res.status}`);
  const html = await res.text();
  return parseCalendar(html, seasonCode);
}

/** Fetch results for a race by its FIS race ID */
export async function fetchResults(raceId: string): Promise<FisResult[]> {
  const url =
    `${BASE}/fis_events/ajax/raceresultsfunctions/details.html` +
    `?sectorcode=CC&raceid=${raceId}&competitors=`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SkiPredictor/1.0)" },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`FIS results fetch failed: ${res.status}`);
  const html = await res.text();
  return parseResults(html);
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseCalendar(html: string, seasonCode: string): FisRace[] {
  const $ = cheerio.load(html);
  const races: FisRace[] = [];

  // Each race row has class "event-header" or is inside a table-like structure.
  // FIS calendar HTML wraps events in divs with data-raceid attributes.
  $("[data-raceid]").each((_, el) => {
    const raceId = $(el).attr("data-raceid");
    if (!raceId) return;

    // Gender is in a sibling/parent with class "gender" or data-gender
    const gender = $(el).attr("data-gender") || detectGender($, el);
    const discipline = $(el).attr("data-disciplinecode") || extractDiscipline($, el);
    const dateStr = $(el).attr("data-date") || $(el).find(".date").text().trim();
    const venue = $(el).find(".venue, .place").first().text().trim() ||
                  $(el).attr("data-place") || "";
    const country = $(el).attr("data-nationcode") || extractCountry($, el);

    const date = parseFisDate(dateStr);
    if (!date) return; // skip rows we can't parse

    const name = buildRaceName(venue, discipline, gender);
    const season = `${parseInt(seasonCode) - 1}-${seasonCode}`;

    races.push({ id: raceId, name, venue, country, date, discipline, gender, season });
  });

  // Fallback: parse anchor links to results pages — these always contain raceid
  if (races.length === 0) {
    $("a[href*='raceid=']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(/raceid=(\d+)/);
      if (!match) return;
      const raceId = match[1];

      // Avoid duplicates
      if (races.some((r) => r.id === raceId)) return;

      const rowEl = $(el).closest("tr, .event-row, .table-row");
      const text = rowEl.text();
      const gender = text.match(/\bWomen\b/i) ? "W" : text.match(/\bMen\b/i) ? "M" : "M";
      const discipline = extractDisciplineFromText(text);
      const venue = rowEl.find("td").eq(2).text().trim() || extractVenueFromLink($(el).text());
      const country = rowEl.find(".country, .nat").first().text().trim().toUpperCase().slice(0, 3);
      const dateText = rowEl.find("td").first().text().trim();
      const date = parseFisDate(dateText) || new Date();
      const season = `${parseInt(seasonCode) - 1}-${seasonCode}`;
      const name = buildRaceName(venue, discipline, gender);

      races.push({ id: raceId, name, venue, country, date, discipline, gender, season });
    });
  }

  return races;
}

function parseResults(html: string): FisResult[] {
  const $ = cheerio.load(html);

  // The details.html endpoint embeds a JSON array in a script tag or a hidden input
  // Format: [{"Competitorid":"189450","Competitorname":"...","Nationcode":"FIN","Position":"1"}, ...]
  const results: FisResult[] = [];

  // Try to find the JSON array in script tags
  $("script").each((_, el) => {
    const text = $(el).html() || "";
    const match = text.match(/\[\s*\{"Competitorid"[\s\S]*?\}\s*\]/);
    if (match) {
      try {
        const data = JSON.parse(match[0]) as Array<{
          Competitorid: string;
          Competitorname: string;
          Nationcode: string;
          Position: string | null;
        }>;
        data.forEach((item) => {
          results.push({
            athleteId: item.Competitorid,
            athleteName: item.Competitorname,
            nationCode: item.Nationcode,
            rank: item.Position ? parseInt(item.Position) : null,
          });
        });
      } catch {
        // ignore parse errors
      }
    }
  });

  // Fallback: parse hidden inputs that may hold competitor JSON
  if (results.length === 0) {
    $("input[type=hidden]").each((_, el) => {
      const val = $(el).attr("value") || "";
      if (!val.startsWith("[")) return;
      try {
        const data = JSON.parse(val) as Array<{
          Competitorid: string;
          Competitorname: string;
          Nationcode: string;
          Position: string | null;
        }>;
        data.forEach((item) => {
          results.push({
            athleteId: item.Competitorid,
            athleteName: item.Competitorname,
            nationCode: item.Nationcode,
            rank: item.Position ? parseInt(item.Position) : null,
          });
        });
      } catch {
        // ignore
      }
    });
  }

  // Second fallback: look for raw JSON text anywhere in the document
  if (results.length === 0) {
    const bodyText = $.html();
    const match = bodyText.match(/\[\s*\{"Competitorid"[\s\S]*?\}\s*\]/);
    if (match) {
      try {
        const data = JSON.parse(match[0]) as Array<{
          Competitorid: string;
          Competitorname: string;
          Nationcode: string;
          Position: string | null;
        }>;
        data.forEach((item) => {
          results.push({
            athleteId: item.Competitorid,
            athleteName: item.Competitorname,
            nationCode: item.Nationcode,
            rank: item.Position ? parseInt(item.Position) : null,
          });
        });
      } catch {
        // ignore
      }
    }
  }

  return results.sort((a, b) => {
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectGender($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const row = $(el).closest("tr, .event-row, [class*='event']");
  const text = row.text().toLowerCase();
  if (text.includes("women") || text.includes("w ")) return "W";
  return "M";
}

function extractDiscipline($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const text = $(el).text().toLowerCase();
  return extractDisciplineFromText(text);
}

function extractDisciplineFromText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("sprint")) return "Sprint";
  if (t.includes("skiathlon")) return "Skiathlon";
  if (t.includes("pursuit")) return "Pursuit";
  if (t.includes("relay")) return "Relay";
  if (t.includes("50")) return "Distance 50k";
  if (t.includes("30")) return "Distance 30k";
  if (t.includes("15")) return "Distance 15k";
  if (t.includes("10")) return "Distance 10k";
  return "Distance";
}

function extractCountry($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const row = $(el).closest("tr, .event-row");
  return row.find(".country, .nat, [class*='nation']").first().text().trim().slice(0, 3).toUpperCase();
}

function extractVenueFromLink(text: string): string {
  return text.replace(/\d{4}/, "").replace(/WC|CC|SP|DS/g, "").trim();
}

function buildRaceName(venue: string, discipline: string, gender: string): string {
  const g = gender === "W" ? "Women" : "Men";
  return `${g} ${discipline} - ${venue}`.trim();
}

function parseFisDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;

  // FIS often uses "28 Nov 2025" or "28-30 Nov 2025" format
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // Range like "28-30 Nov 2025" — take first day
  const rangeMatch = dateStr.match(/(\d{1,2})[-–]\d{1,2}\s+(\w{3})\s+(\d{4})/i);
  if (rangeMatch) {
    const [, day, mon, year] = rangeMatch;
    const m = monthMap[mon.toLowerCase()];
    if (m !== undefined) return new Date(parseInt(year), m, parseInt(day));
  }

  // Single date like "28 Nov 2025"
  const singleMatch = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/i);
  if (singleMatch) {
    const [, day, mon, year] = singleMatch;
    const m = monthMap[mon.toLowerCase()];
    if (m !== undefined) return new Date(parseInt(year), m, parseInt(day));
  }

  return null;
}
