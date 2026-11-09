// Genera sports.json (lo que descarga la app de la TV).
// Fuentes: F1 (Jolpica, sin clave), fútbol (ESPN, sin clave) y MotoGP (motogp.json).
// Editar config.json / motogp.json y relanzar el Action para cambiar el panel sin tocar la TV.
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const motogp = JSON.parse(fs.readFileSync('motogp.json', 'utf8'));

const now = new Date();
const maxDate = new Date(now.getTime() + config.lookaheadDays * 86400000);
const cutoff = new Date(now.getTime() - (config.cutoffHours || 3) * 3600000);

const events = [];
const seen = new Set();

function addEvent(iso, name, comp, highlight) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return;
  if (d < cutoff || d > maxDate) return; // desde hace 3h hasta el horizonte
  const key = `${iso}|${name}`;
  if (seen.has(key)) return;
  seen.add(key);
  events.push({ iso, name, comp, highlight: !!highlight });
}

// ---- F1 ----
async function fetchF1() {
  const year = new Date().getFullYear();
  const res = await fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`);
  const j = await res.json();
  const races = (j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races) || [];
  const includePractice = !!config.f1IncludePractice;
  for (const race of races) {
    const raceName = String(race.raceName || '').replace('Grand Prix', 'GP').trim();
    const sessions = [];
    if (includePractice && race.FirstPractice) sessions.push({ t: race.FirstPractice, n: 'Libres 1' });
    if (includePractice && race.SecondPractice) sessions.push({ t: race.SecondPractice, n: 'Libres 2' });
    if (includePractice && race.ThirdPractice) sessions.push({ t: race.ThirdPractice, n: 'Libres 3' });
    if (race.Sprint) sessions.push({ t: race.Sprint, n: 'Sprint' });
    if (race.Qualifying) sessions.push({ t: race.Qualifying, n: 'Clasif.' });
    sessions.push({ t: { date: race.date, time: race.time }, n: 'Carrera' });
    for (const s of sessions) {
      let time = s.t.time || '00:00:00Z';
      if (!/Z$/.test(time)) time += 'Z';
      addEvent(`${s.t.date}T${time}`, s.n, raceName, true);
    }
  }
}

// ---- Fútbol (ESPN, sin clave) ----
async function fetchEspnMonth(slug, yyyymm) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${yyyymm}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return j.events || [];
}

async function fetchFootball() {
  const wanted = new Set(config.priorityTeamIds);
  const highlight = new Set(config.highlightTeamIds);

  // Meses que toca el horizonte (normalmente uno; dos si cruza de mes).
  const months = new Set();
  for (let t = cutoff.getTime(); t <= maxDate.getTime(); t += 86400000) {
    const d = new Date(t);
    months.add(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  for (const slug of config.espnLeagues) {
    for (const yyyymm of months) {
      let fixtures;
      try {
        fixtures = await fetchEspnMonth(slug, yyyymm);
      } catch (e) {
        console.error('espn', slug, yyyymm, e.message);
        continue;
      }
      for (const ev of fixtures) {
        const comp = (ev.competitions && ev.competitions[0]) || {};
        const competitors = comp.competitors || [];
        const ids = competitors
          .map((c) => Number(c.team && c.team.id))
          .filter((id) => !isNaN(id));
        const isPriority = ids.some((id) => wanted.has(id));
        const isChampions = slug === config.championsLeagueSlug;
        if (!isPriority && !isChampions) continue;

        const home = competitors.find((c) => c.homeAway === 'home');
        const away = competitors.find((c) => c.homeAway === 'away');
        if (!home || !away) continue;

        const name = `${home.team.displayName} vs ${away.team.displayName}`;
        const hl = ids.some((id) => highlight.has(id));
        addEvent(ev.date, name, config.leagueNames[slug] || slug, hl);
      }
    }
  }
}

// ---- MotoGP (estático) ----
function addMotoGp() {
  for (const m of motogp) addEvent(m.utc, m.name, m.comp, true);
}

async function main() {
  await Promise.allSettled([fetchF1(), fetchFootball()]);
  addMotoGp();

  events.sort((a, b) => new Date(a.iso) - new Date(b.iso));
  const out = events.slice(0, config.maxEvents || 20);

  fs.writeFileSync('sports.json', JSON.stringify(out, null, 1));
  console.log(`sports.json: ${out.length} eventos`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
