// Generates assets/stats.svg from the GitHub contribution calendar (private contributions included).
// Usage: GH_TOKEN=<token> node scripts/stats.mjs [login]
import { writeFileSync } from 'node:fs';

const login = process.argv[2] || 'wermisek';
const query = `query($login:String!){user(login:$login){contributionsCollection{
  totalContributions: contributionCalendar{totalContributions}
  totalCommitContributions
  contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${process.env.GH_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { login } }),
});
const json = await res.json();
const c = json.data?.user?.contributionsCollection;
if (!c) throw new Error(JSON.stringify(json));

const weeks = c.contributionCalendar.weeks;
const days = weeks.flatMap((w) => w.contributionDays);
const total = c.totalContributions.totalContributions;
const commits = c.totalCommitContributions;

const today = new Date().toISOString().slice(0, 10);
const past = days.filter((d) => d.date <= today);
let longest = 0, run = 0;
for (const d of past) { run = d.contributionCount ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0, i = past.length - 1;
if (past[i] && !past[i].contributionCount) i--; // today may still be empty
for (; i >= 0 && past[i].contributionCount; i--) current++;

const fmt = (n) => n.toLocaleString('en-US');
const max = Math.max(...days.map((d) => d.contributionCount), 1);
const shade = (n) => n === 0 ? '#161b22' : n <= max * 0.25 ? '#0e4429' : n <= max * 0.5 ? '#006d32' : n <= max * 0.75 ? '#26a641' : '#39d353';

const W = 900, tileW = 204, gap = 16, x0 = 18;
const tiles = [
  ['CONTRIBUTIONS', fmt(total), 'in the last 12 months', '#ffffff'],
  ['COMMITS', fmt(commits), 'in the last 12 months', '#ffffff'],
  ['CURRENT STREAK', fmt(current), current === 1 ? 'day in a row' : 'days in a row', '#39d353'],
  ['LONGEST STREAK', fmt(longest), 'days in a row', '#ffffff'],
].map(([label, value, sub, color], k) => {
  const x = x0 + k * (tileW + gap);
  return `<g transform="translate(${x} 18)">
  <rect width="${tileW}" height="108" rx="12" fill="#0d1117" stroke="#30363d"/>
  <text x="20" y="32" class="l">${label}</text>
  <text x="20" y="76" class="v" fill="${color}">${value}</text>
  <text x="20" y="96" class="s">${sub}</text>
</g>`;
}).join('\n');

const cell = 12, step = 15, hx = (W - weeks.length * step + 3) / 2, hy = 178;
const months = [];
let heat = '';
weeks.forEach((w, wi) => {
  const first = w.contributionDays[0].date;
  const m = new Date(first + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  if (new Date(first + 'T00:00:00Z').getUTCDate() <= 7 && wi > 0 && wi < weeks.length - 2)
    months.push(`<text x="${hx + wi * step}" y="${hy - 10}" class="s">${m}</text>`);
  w.contributionDays.forEach((d, di) => {
    heat += `<rect x="${hx + wi * step}" y="${hy + di * step}" width="${cell}" height="${cell}" rx="3" fill="${shade(d.contributionCount)}"><title>${d.date}: ${d.contributionCount}</title></rect>`;
  });
});

const H = hy + 7 * step + 38;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub activity: ${fmt(total)} contributions, ${current} day streak">
<style>
  text{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif}
  .l{font-size:11px;font-weight:600;letter-spacing:.12em;fill:#8b949e}
  .v{font-size:40px;font-weight:700}
  .s{font-size:12px;fill:#8b949e}
</style>
<rect width="${W}" height="${H}" rx="16" fill="#010409"/>
${tiles}
<text x="${hx}" y="${hy - 28}" class="l">ACTIVITY</text>
${months.join('')}
${heat}
<text x="${hx}" y="${H - 14}" class="s">Updated ${today} · private repositories included</text>
</svg>
`;
writeFileSync(new URL('../assets/stats.svg', import.meta.url), svg);
console.log({ total, commits, current, longest });
