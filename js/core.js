"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const G = window.GEO;
const C = new Map(G.countries.map((c) => [c.id, c]));
const BY2 = new Map(G.countries.map((c) => [c.a2, c]));
const REGIONS = ["Africa", "Americas", "Asia", "Europe", "Oceania"];
const RSHORT = {
  World: "W",
  Africa: "AF",
  Americas: "AM",
  Asia: "AS",
  Europe: "EU",
  Oceania: "OC",
};
const REGION_BOX = {
  Africa: [
    [-19, -36],
    [52, 38],
  ],
  Americas: [
    [-168, -56],
    [-34, 72],
  ],
  Asia: [
    [26, -10],
    [146, 55],
  ],
  Europe: [
    [-25, 35],
    [42, 71],
  ],
  Oceania: [
    [112, -47],
    [179, -1],
  ],
};
const EXTRA_REGION = {
  X_Somaliland: "Africa",
  X_NCyprus: "Asia",
  X_SiachenGlacier: "Asia",
  X_IndianOceanTer: "Oceania",
  X_Dhekelia: "Asia",
  X_Akrotiri: "Asia",
  X_CyprusUNBufferZone: "Asia",
  X_Baikonur: "Asia",
  X_USNBGuantanamoBay: "Americas",
  ATA: "Antarctic",
};
const CONTINENTS = [
  ["AFRICA", [18, 4]],
  ["EUROPE", [16, 53]],
  ["ASIA", [88, 46]],
  ["NORTH AMERICA", [-102, 46]],
  ["SOUTH AMERICA", [-60, -14]],
  ["OCEANIA", [134, -24]],
  ["ANTARCTICA", [20, -80]],
];
const OCEANS = [
  ["Pacific Ocean", [-145, 8]],
  ["Pacific Ocean", [165, 10]],
  ["Atlantic Ocean", [-36, 12]],
  ["Indian Ocean", [78, -22]],
  ["Arctic Ocean", [10, 80]],
  ["Southern Ocean", [60, -58]],
];
const nf = new Intl.NumberFormat("en-GB");
const isPhone = () => matchMedia("(max-width:700px)").matches;
const reduced = () =>
  !!(S && S.settings && S.settings.calm) || matchMedia("(prefers-reduced-motion: reduce)").matches;
const regionOf = (id) => (C.get(id) || {}).r || EXTRA_REGION[id] || "Antarctic";
const SANS =
  getComputedStyle(document.documentElement).getPropertyValue("--sans") ||
  "Helvetica, Arial, sans-serif";
const WIKI = (t) =>
  "https://en.wikipedia.org/wiki/" +
  encodeURIComponent(t.replace(/ /g, "_")).replace(/%2C/g, ",").replace(/%27/g, "'");

const ic = (p) => `<svg class="i" viewBox="0 0 24 24">${p}</svg>`;
const PJ = [
  ["globe", "3D", "Globe"],
  ["geoid", "GEO", "Geoid"],
  ["ee", "EE", "Equal Earth"],
  ["merc", "MRC", "Mercator"],
];
const LINKS = {
  repo: "https://github.com/AumGupta/GeoZest",
  support: "https://github.com/sponsors/AumGupta",
};
const I = {
  x: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
  search: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  locate: ic('<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  identify: ic('<path d="M5 7l5-3 4 2 5-1-1 6 2 4-6 4-5-1-4 2-1-6z"/>'),
  capitals: ic(
    '<circle cx="12" cy="12" r="8"/><path d="m12 7.5 1.3 2.8 3 .3-2.3 2 .7 3-2.7-1.5-2.7 1.5.7-3-2.3-2 3-.3z" fill="currentColor" stroke="none"/>',
  ),
  flags: ic('<path d="M5 21V4h12l-2.5 4L17 12H5"/>'),
  languages: ic('<path d="M4 5h9v7H8l-3 3v-3H4zM13 9h7v7h-1v3l-3-3h-5v-3"/>'),
  currencies: ic(
    '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  ),
  neighbours: ic('<path d="M3 6l6-2v16l-6 2zM9 4l6 2v16l-6-2zM15 6l6-2v16l-6 2z"/>'),
  mixed: ic(
    '<path d="M3 7h3c4 0 6 10 10 10h5M3 17h3c1.8 0 3-2 4.2-4.3M14 7h7M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  ),
  daily: ic('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  flame:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3-1-3 0-6 1-9z"/></svg>',
  timer:
    '<svg class="i" viewBox="0 0 24 24" style="width:15px;height:15px"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
  timerOff:
    '<svg class="i" viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M9 2h6M7.2 7.6A8 8 0 0 0 17.4 18.8M19.6 15.6A8 8 0 0 0 10 5.2M3 4l18 18"/></svg>',
  sun: ic(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  ),
  moon: ic('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  snd: ic(
    '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  ),
  mute: ic('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
};

const KEY = "geozest.v1";
const defaults = () => ({
  xp: 0,
  prog: {},
  ach: {},
  days: [],
  daily: {},
  sessions: [],
  viewed: [],
  best: 0,
  tot: { a: 0, c: 0 },
  settings: {
    timer: true,
    terr: false,
    isl: true,
    labels: true,
    calm: false,
    units: "km",
    proj: "globe",
    night: false,
    region: "World",
    len: 10,
    sound: true,
  },
});
function load() {
  try {
    const s = localStorage.getItem(KEY) || localStorage.getItem("meridian-atlas.v1");
    if (s) {
      const o = JSON.parse(s);
      const d = defaults();
      return Object.assign(d, o, { settings: Object.assign(d.settings, o.settings || {}) });
    }
  } catch (e) {}
  return defaults();
}
let S = load();
if (!S.settings.v3) {
  S.settings.proj = "globe";
  S.settings.v3 = true;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {}
}
function applyTheme() {
  document.documentElement.classList.toggle("night", !!S.settings.night);
  document.documentElement.classList.toggle("calm", !!S.settings.calm);
  if (window.__M) window.__M.palette();
}
function applyLbl() {
  const on = S.settings.labels !== false,
    b = $("#btnLbl");
  b.innerHTML = on
    ? '<svg class="i" viewBox="0 0 24 24"><path d="M5 7V5h14v2M12 5v14M9 19h6"/></svg>'
    : '<svg class="i" viewBox="0 0 24 24"><path d="M5 7V5h14v2M12 5v14M9 19h6M4 4l16 16"/></svg>';
  b.setAttribute("aria-label", on ? "Hide map labels" : "Show map labels");
  b.setAttribute("aria-pressed", on);
}
function applySound() {
  const b = $("#btnSound");
  b.innerHTML = S.settings.sound ? I.snd : I.mute;
  b.setAttribute("aria-label", S.settings.sound ? "Mute sounds" : "Turn sounds on");
}
applyTheme();
applySound();
applyLbl();

const SND = {
  ctx: null,
  ensure() {
    try {
      if (!this.ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return null;
        this.ctx = new A();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch (e) {
      return null;
    }
    return this.ctx;
  },
  tone(f, at, dur, type = "sine", vol = 0.07) {
    const c = this.ctx;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + dur + 0.02);
  },
  play(name) {
    if (!S.settings.sound) return;
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime + 0.01;
    if (name === "good") {
      this.tone(784, t, 0.12);
      this.tone(1175, t + 0.09, 0.22);
    } else if (name === "bad") {
      this.tone(220, t, 0.16, "triangle", 0.09);
      this.tone(165, t + 0.11, 0.26, "triangle", 0.09);
    } else if (name === "tick") {
      this.tone(1320, t, 0.04, "square", 0.018);
    } else if (name === "end") {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.09, 0.3, "sine", 0.06));
    } else if (name === "tap") {
      this.tone(900, t, 0.03, "sine", 0.03);
    } else if (name === "level") {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        this.tone(f, t + i * 0.07, 0.35, "triangle", 0.05),
      );
    }
  },
};
addEventListener(
  "pointerdown",
  () => {
    if (S.settings.sound) SND.ensure();
  },
  { once: true },
);

function todayKey(d = new Date()) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function hash(s) {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (a, r = Math.random) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const flag = (c, st = "") =>
  `<span class="flag" style="${st}" aria-hidden="true">${G.flags[c.a2] || ""}</span>`;
function fmtLL(ll) {
  const [la, lo] = ll;
  return `${Math.abs(la).toFixed(1)}° ${la >= 0 ? "N" : "S"}  ${Math.abs(lo).toFixed(1)}° ${lo >= 0 ? "E" : "W"}`;
}
function fmtPop(n) {
  if (!n) return "n/a";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + " bn";
  if (n >= 1e7) return Math.round(n / 1e6) + " m";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " m";
  if (n >= 1e4) return Math.round(n / 1e3) + " k";
  return nf.format(n);
}
function fmtArea(a) {
  return a < 10 ? a.toFixed(2) : nf.format(Math.round(a));
}
const areaTxt = (a) =>
  S.settings.units === "mi" ? `${fmtArea(a * 0.386102)} mi²` : `${fmtArea(a)} km²`;
const ord = (n) =>
  n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
function lvlInfo(xp) {
  let n = 1;
  while (50 * (n + 1) * n <= xp) n++;
  const base = 50 * n * (n - 1),
    next = 50 * (n + 1) * n;
  return {
    n,
    into: xp - base,
    need: next - base,
    pct: Math.round(((xp - base) / (next - base)) * 100),
  };
}
function dayStreak() {
  const set = new Set(S.days);
  let n = 0;
  const d = new Date();
  if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(todayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
const sovereign = G.countries.filter((c) => c.ind);
const areaRank = new Map(
  sovereign
    .slice()
    .sort((a, b) => b.ar - a.ar)
    .map((c, i) => [c.id, i + 1]),
);
let HOME = null;
try {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const a2 = G.tz[tz];
  if (a2 && BY2.has(a2)) HOME = BY2.get(a2).id;
} catch (e) {}

function factsFor(c) {
  const cur = (c.fx || []).map(([t, u]) => ({ t, u: WIKI(u) }));
  const gen = [];
  const n = c.n;
  const rank = areaRank.get(c.id);
  if (rank && rank <= 12)
    gen.push({
      t: `${n} is the ${ord(rank)} largest country in the world by area.`,
      u: WIKI("List of countries and dependencies by area"),
    });
  if (rank && rank > sovereign.length - 15)
    gen.push({
      t: `${n} is one of the 15 smallest countries in the world by area.`,
      u: WIKI("List of countries and dependencies by area"),
    });
  const nb = c.b.length;
  if (nb >= 8)
    gen.push({
      t: `${n} shares a land border with ${nb} countries.`,
      u: WIKI("List of countries and territories by number of land borders"),
    });
  if (c.lk && !cur.some((x) => /landlocked/i.test(x.t)))
    gen.push({
      t: `${n} is landlocked: it has no coastline at all.`,
      u: WIKI("Landlocked country"),
    });
  if (c.id === "IND")
    gen.push({
      t: `India recognises 22 scheduled languages in its constitution. The central government works in Hindi and English.`,
      u: WIKI("Languages with official status in India"),
    });
  else if (c.l.length >= 3)
    gen.push({
      t: `${n} has ${c.l.length} official languages.`,
      u: WIKI("List of official languages by country and territory"),
    });
  if (c.pop && c.ar) {
    const d = c.pop / c.ar;
    if (d >= 500)
      gen.push({
        t: `With about ${nf.format(Math.round(d))} people per km², ${n} is one of the most densely populated countries.`,
        u: WIKI("List of countries and dependencies by population density"),
      });
    else if (d <= 6 && c.ind)
      gen.push({
        t: `${n} is one of the most sparsely populated countries, with about ${d.toFixed(1)} people per km².`,
        u: WIKI("List of countries and dependencies by population density"),
      });
  }
  if (!nb && !c.lk && c.ind && !cur.length)
    gen.push({ t: `${n} shares no land border with any other country.`, u: WIKI(n) });
  return { cur, gen };
}
function funFact(c) {
  const { cur, gen } = factsFor(c);
  if (cur.length && (Math.random() < 0.75 || !gen.length)) return pick(cur);
  if (gen.length) return pick(gen);
  return null;
}
const BULB =
  '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>';
function funHTML(c) {
  const f = funFact(c);
  return f
    ? `<a class="fun" href="${esc(f.u)}" target="_blank" rel="noopener">${BULB}<span class="ft">${esc(f.t)}<span class="src">Wikipedia ↗</span></span></a>`
    : "";
}

const COLOR = new Map();
(function () {
  for (const topo of [G.topo, G.topo10]) {
    const geoms = topo.objects.countries.geometries;
    const nb = topojson.neighbors(geoms);
    const order = geoms.map((g, i) => i).sort((a, b) => nb[b].length - nb[a].length);
    const idx = new Array(geoms.length).fill(-1);

    geoms.forEach((g, i) => {
      if (COLOR.has(g.id)) idx[i] = COLOR.get(g.id);
    });
    for (const i of order) {
      if (idx[i] >= 0) continue;
      const used = new Set(nb[i].map((j) => idx[j]));
      const start = hash(geoms[i].id) % 6;
      for (let s = 0; s < 6; s++) {
        const k = (start + s) % 6;
        if (!used.has(k)) {
          idx[i] = k;
          break;
        }
      }
      if (idx[i] < 0) idx[i] = start;
      COLOR.set(geoms[i].id, idx[i]);
    }
  }
  for (const c of G.countries) if (!COLOR.has(c.id)) COLOR.set(c.id, hash(c.id) % 6);
})();

const MODES = {
  locate: { t: "Locate", ok: (c) => !!c.ll },
  identify: { t: "Identify", ok: (c) => !!c.ll },
  capitals: { t: "Capitals", ok: (c) => c.cap.length > 0 },
  flags: { t: "Flags", ok: (c) => !!G.flags[c.a2] },
  languages: { t: "Languages", ok: (c) => c.l.length > 0 },
  currencies: { t: "Currencies", ok: (c) => c.cur.length > 0 },
  neighbours: { t: "Neighbors", ok: (c) => c.b.some((x) => C.has(x)) },
  mixed: { t: "Mixed", ok: () => true },
};
const SKILLS = Object.keys(MODES).filter((k) => k !== "mixed");
function poolFor(mode, region) {
  const R = region === "World" ? null : region.split(",");
  return G.countries.filter((c) => inPlay(c) && (!R || R.includes(c.r)) && MODES[mode].ok(c));
}
const isIsle = (c) => !(c.b && c.b.length) && c.ar < 30000;
const inPlay = (c) => (c.ind || S.settings.terr) && (S.settings.isl !== false || !isIsle(c));
function regionBox(r) {
  const L = String(r)
    .split(",")
    .filter((x) => REGION_BOX[x]);
  if (!L.length) return null;
  if (L.length === 1) return REGION_BOX[L[0]];
  let a = 180,
    b = 90,
    c = -180,
    d = -90;
  for (const x of L) {
    const [[a1, b1], [c1, d1]] = REGION_BOX[x];
    a = Math.min(a, a1);
    b = Math.min(b, b1);
    c = Math.max(c, c1);
    d = Math.max(d, d1);
  }
  return c - a > 200
    ? null
    : [
        [a, b],
        [c, d],
      ];
}
function rec(mode, id) {
  return (S.prog[mode] || {})[id];
}
function mastered(mode, id) {
  const r = rec(mode, id);
  return !!(r && r.l === 1);
}
function mastery(mode, region = "World") {
  if (mode === "mixed") {
    const v = SKILLS.map((m) => mastery(m, region));
    return { n: v.reduce((a, b) => a + b.n, 0), t: v.reduce((a, b) => a + b.t, 0) };
  }
  const P = poolFor(mode, region);
  return { n: P.filter((c) => mastered(mode, c.id)).length, t: P.length };
}
function countryScore(id) {
  return SKILLS.reduce((a, m) => a + (mastered(m, id) ? 1 : 0), 0);
}
