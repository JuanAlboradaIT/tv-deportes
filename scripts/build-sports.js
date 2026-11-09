// Genera sports.json (lo que descarga la app de la TV).
// Fuentes: F1 (Jolpica, sin clave), fútbol (API-Football, clave en FOOTBALL_KEY) y MotoGP (motogp.json).
// Editar config.json / motogp.json y relanzar el Action para cambiar el panel sin tocar la TV.
const fs = require('fs');

const TZ = 'Europe/Madrid';
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const motogp = JSON.parse(fs.readFileSync('motogp.json', 'utf8'));
const KEY = process.env.FOOTBALL_KEY || '';

const now = new Date();
const maxDate = new Date(now.getTime() + config.lookaheadDays * 86400000);

const events = [];

function addEvent(iso, name, comp, highlight) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return;
  if (d < now || d > maxDate) return; // solo desde ahora hasta el horizonte
  events.push({ iso, name, comp, highlight: !!highlight });
}

// ---- F1 ----
async function fetchF1() {
  const year = new Date().getFullYear();
  const res = await fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`);
  const j = await res.json();
  const races = (j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races) || [];
  for (const race of races) {
    const raceName = String(race.raceName || '').replace('Grand Prix', 'GP').trim();
    const sessions = [];
    if (race.FirstPractice) sessions.push({ t: race.FirstPractice, n: 'Libres 1' });
    if (race.SecondPractice) sessions.push({ t: race.SecondPractice, n: 'Libres 2' });
    if (race.ThirdPractice) sessions.push({ t: race.ThirdPractice, n: 'Libres 3' });
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

// ---- Fútbol ----
function madridYMD(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function fetchFootball() {
  if (!KEY) return;
  const wanted = new Set(config.priorityTeamIds);
  const highlight = new Set(config.highlightTeamIds);
  for (let i = 0; i < config.lookaheadDays; i++) {
    const day = new Date(now.getTime() + i * 86400000);
    const ymd = madridYMD(day);
    try {
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${ymd}`, {
        headers: { 'x-apisports-key': KEY },
      });
      const j = await res.json();
      for (const f of j.response || []) {
        const homeId = f.teams.home.id, awayId = f.teams.away.id;
        const isPriority = wanted.has(homeId) || wanted.has(awayId);
        const isChampions = f.league.id === config.championsLeagueId;
        if (!isPriority && !isChampions) continue;
        const hl = highlight.has(homeId) || highlight.has(awayId);
        const comp = config.leagueNames[String(f.league.id)] || f.league.name;
        addEvent(f.fixture.date, `${f.teams.home.name} vs ${f.teams.away.name}`, comp, hl);
      }
    } catch (e) {
      console.error('football', ymd, e.message);
    }
  }
}

// ---- MotoGP (estático) ----
function addMotoGp() {
  for (const m of motogp) addEvent(m.utc, m.name, m.comp, true);
}

async function main() {
  await fetchF1();
  await fetchFootball();
  addMotoGp();

  events.sort((a, b) => new Date(a.iso) - new Date(b.iso));
  const out = events.slice(0, config.maxEvents);

  fs.writeFileSync('sports.json', JSON.stringify(out, null, 1));
  console.log(`sports.json: ${out.length} eventos`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
