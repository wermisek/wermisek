// Generates assets/stats.svg from the GitHub contribution calendar (private contributions included).
// Usage: GH_TOKEN=<token> node scripts/stats.mjs [login]
import { readFileSync, writeFileSync } from 'node:fs';

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
const lastActive = past[i]?.date;
for (; i >= 0 && past[i].contributionCount; i--) current++;
const streakStart = past[i + 1]?.date;
const activeDays = past.filter((d) => d.contributionCount).length;

const fmt = (n) => n.toLocaleString('en-US');
const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const max = Math.max(...days.map((d) => d.contributionCount), 1);
const r = (n) => Math.round(n * 10) / 10;


// Minimal activity: the streak as a big serif number, four quiet stats, and the year as a tile calendar (one tile per day).
// Written twice — assets/dark/stats.svg and assets/light/stats.svg — with transparent backgrounds.
const fonts = JSON.parse(readFileSync(new URL('./fonts.json', import.meta.url), 'utf8'));
const W = 1200, H = 556, N = past.length;
const fmtD = (d, o) => new Date(d + 'T00:00:00Z').toLocaleString('en-US', { timeZone: 'UTC', ...o });
const si = current ? past.findIndex((d) => d.date === streakStart) : N;
const todayCount = past.at(-1)?.date === today ? past.at(-1).contributionCount : 0;

const GY = 352, GAP = 4, cols = weeks.length, pitch = (W + GAP) / cols, size = pitch - GAP;
const act = past.map((d) => d.contributionCount).filter(Boolean).sort((a, b) => a - b);
const q = (p) => act[Math.min(act.length - 1, Math.floor(act.length * p))] ?? 1;
const cuts = [q(0.25), q(0.5), q(0.8)];
const level = (n) => !n ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4;
let tiles = '', months = '';
weeks.forEach((w, c) => {
  const x = r(c * pitch);
  const first = w.contributionDays[0].date;
  if (c > 0 && c < cols - 2 && Number(first.slice(8)) <= 7) months += `<text x="${x}" y="${GY - 14}" class="mo mu" font-size="16">${fmtD(first, { month: 'short' })}</text>`;
  w.contributionDays.forEach((d, row) => {
    if (d.date > today) return;
    const lv = level(d.contributionCount), y = r(GY + row * pitch);
    tiles += `<rect class="l${lv} t" x="${x}" y="${y}" width="${r(size)}" height="${r(size)}" rx="4" style="animation-delay:${r(0.3 + c * 0.012)}s"><title>${d.date}: ${d.contributionCount}</title></rect>`;
    if (d.date === today) tiles += `<rect class="ring" x="${r(Number(x) - 3)}" y="${r(Number(y) - 3)}" width="${r(size + 6)}" height="${r(size + 6)}" rx="6"/>`;
  });
});
const gridB = GY + 7 * pitch - GAP;
const legend = `<text x="0" y="${r(gridB + 40)}" class="mo mu" font-size="16">one tile per day</text>
<text x="${W - 5 * 22 - 66}" y="${r(gridB + 40)}" class="mo mu" font-size="16" text-anchor="end">less</text><text x="${W}" y="${r(gridB + 40)}" class="mo mu" font-size="16" text-anchor="end">more</text>
${[0, 1, 2, 3, 4].map((j) => `<rect class="l${j}" x="${W - 56 - (5 - j) * 22}" y="${r(gridB + 26)}" width="18" height="18" rx="4"/>`).join('')}`;

const rows = [
  ['Contributions', fmt(total)],
  ['Commits', fmt(commits)],
  ['Active days', `${activeDays} / ${N}`],
  ['Longest streak', `${fmt(longest)} days`],
].map(([l, v], j) => `<text x="760" y="${136 + j * 48}" class="mo mu" font-size="19">${l}</text><text x="${W}" y="${136 + j * 48}" class="mo fg" font-size="19" text-anchor="end">${v}</text>${j < 3 ? `<path d="M760 ${r(156.5 + j * 48)}H${W}" stroke="var(--line)"/>` : ''}`).join('');

const numW = String(current).length * 112;
const body = `
<text x="0" y="40" class="mo fg" font-size="19">Activity</text>
<text x="${W}" y="40" class="mo mu" font-size="19" text-anchor="end">last 12 months · private repos included · updated ${fmtD(today, { month: 'short', day: 'numeric' }).toLowerCase()}</text>
<path d="M0 63.5H${W}" stroke="var(--line)"/>
<text x="-8" y="262" class="sf fg up" font-size="230" letter-spacing="-6">${current}</text>
<g class="up" style="animation-delay:.2s">
<text x="${numW + 24}" y="160" class="mo fg" font-size="24">${current === 1 ? 'day' : 'days'} in a row</text>
${current && current >= longest ? (() => { const px = numW + 24 + (current === 1 ? 12 : 13) * 14.4 + 18; return `<rect class="pill" x="${r(px)}" y="138.5" width="146" height="29" rx="14.5"/><text x="${r(px + 73)}" y="158" class="mo live" font-size="15" text-anchor="middle">personal best</text>`; })() : ''}
<text x="${numW + 24}" y="194" class="mo mu" font-size="19">${current ? `shipping code daily since ${fmtD(streakStart, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'starting a new streak'}</text>
<circle cx="${numW + 29}" cy="${231}" r="4" class="live p"/>
<text x="${numW + 42}" y="237" class="mo mu" font-size="19">${todayCount ? `${todayCount} contribution${todayCount === 1 ? '' : 's'} today` : 'today in progress'}</text>
</g>
<g class="up" style="animation-delay:.3s">${rows}</g>
${months}
${tiles}
${legend}`;

const css = `
.sf{font-family:Serif,Georgia,serif;font-weight:400}.mo{font-family:Mono,ui-monospace,monospace;font-weight:400}
.fg{fill:var(--fg)}.mu{fill:var(--mute)}.live{fill:var(--live)}
.l0{fill:var(--t0)}.l1{fill:var(--t1)}.l2{fill:var(--t2)}.l3{fill:var(--t3)}.l4{fill:var(--t4)}
.ring{fill:none;stroke:var(--fg);stroke-width:2;animation:pulse 1.6s ease-in-out infinite}
.pill{fill:var(--live);fill-opacity:.12;stroke:var(--live);stroke-opacity:.6}
.t{animation:fade .6s ease-out both}
.up{animation:up .9s cubic-bezier(.16,1,.3,1) both}.p{animation:pulse 2s ease-in-out infinite}
@keyframes fade{from{opacity:0}}@keyframes up{from{opacity:0;transform:translateY(10px)}}@keyframes pulse{50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
const THEMES = {
  dark: '--fg:#ededed;--mute:#8b8b8b;--faint:#454545;--line:#262626;--live:#3ddc84;--t0:#16181c;--t1:#0e3b2a;--t2:#146c46;--t3:#1fa463;--t4:#5beb98',
  light: '--fg:#111111;--mute:#6e6e6e;--faint:#c9c9c9;--line:#e4e4e4;--live:#15803d;--t0:#ebedf0;--t1:#c4ecd4;--t2:#7fd4a2;--t3:#2ea866;--t4:#137a43',
};
for (const [t, vars] of Object.entries(THEMES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${current} consecutive days with contributions; ${fmt(total)} contributions in the last 12 months">
<style>@font-face{font-family:Serif;src:url(data:font/woff;base64,${fonts.serif})}@font-face{font-family:Mono;src:url(data:font/woff;base64,${fonts.mono})}svg{${vars}}${css}</style>${body}</svg>\n`;
  writeFileSync(new URL(`../assets/${t}/stats.svg`, import.meta.url), svg);
}
console.log({ total, commits, current, longest, activeDays, streakStart, todayCount });
