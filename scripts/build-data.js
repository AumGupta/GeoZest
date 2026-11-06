const fs = require("fs");
const path = require("path");
const countries = require("world-countries");
const topo = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));

const byN3 = new Map(countries.filter((c) => c.ccn3).map((c) => [c.ccn3, c]));
const nameFix = { Kosovo: "UNK" };

function mapIds(t) {
  for (const g of t.objects.countries.geometries) {
    const c = byN3.get(g.id);
    const name = g.properties && g.properties.name;
    if (c) g.id = c.cca3;
    else if (nameFix[name]) g.id = nameFix[name];
    else g.id = "X_" + (name || "unknown").replace(/\W+/g, "");
    g.properties = {};
  }
  return t;
}

const pc = require("polygon-clipping");
const d3geo = require("d3-geo");
const tjc = require("topojson-client");
const { topology: toTopo } = require("topojson-server");
const POV = require("./sources/pov-india.json");

const POV_BORDERS = { IND: ["AFG"], AFG: ["IND"] };
function applyPOV(t) {
  const q = Math.round(360 / t.transform.scale[0]) + 1;
  const fc = tjc.feature(t, t.objects.countries);
  const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
  const km2 = (p) => {
    const a = d3geo.geoArea({ type: "Polygon", coordinates: p });
    return Math.min(a, 4 * Math.PI - a) * 6371.0088 ** 2;
  };
  const [x0, y0, x1, y1] = POV.box,
    e = 0.02;

  const inner = [
    [
      [x0 + e, y0 + e],
      [x1 - e, y0 + e],
      [x1 - e, y1 - e],
      [x0 + e, y1 - e],
      [x0 + e, y0 + e],
    ],
  ];
  const hits = (g) => {
    const b = d3geo.geoBounds(g);
    return b[1][0] > x0 && b[0][0] < x1 && b[1][1] > y0 && b[0][1] < y1;
  };

  const wind = (ps) =>
    ps.map((p) =>
      p.map((ring, i) => {
        const cw = d3geo.geoArea({ type: "Polygon", coordinates: [ring] }) < 2 * Math.PI;
        return (i === 0) === cw ? ring : ring.slice().reverse();
      }),
    );

  const plane = (ps) =>
    ps.map((p) =>
      p.map((ring, i) => {
        let s = 0;
        for (let k = 0; k < ring.length - 1; k++)
          s += (ring[k + 1][0] - ring[k][0]) * (ring[k + 1][1] + ring[k][1]);
        const ccw = s < 0;
        return (i === 0) === ccw ? ring : ring.slice().reverse();
      }),
    );
  fc.features = fc.features.filter((f) => f.id !== "X_SiachenGlacier");
  for (const f of fc.features) {
    if (!f.geometry || !hits(f.geometry)) continue;
    let out = pc.difference(plane(polys(f.geometry)), inner);
    if (POV.parts[f.id]) out = pc.union(out, plane(POV.parts[f.id].coordinates));
    out = out.filter((p) => km2(p) > 1);
    if (f.id === "IND") out = out.map((p) => [p[0]]);
    f.geometry = { type: "MultiPolygon", coordinates: wind(out) };
  }
  const nt = toTopo({ countries: fc }, q);
  for (const g of nt.objects.countries.geometries) g.properties = {};
  return nt;
}
mapIds(topo);
const topo110 = mapIds(
  JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8")),
);
const topo10 = mapIds(
  JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-10m.json"), "utf8")),
);
const [topoP, topo110P, topo10P] = [topo, topo110, topo10].map(applyPOV);
const inMap = new Set(topo10.objects.countries.geometries.map((g) => g.id));
const svgFlags = require("./flags.js")();
const facts = require("./sources/facts.json");
const FIX = { VAT: require("./sources/vatican.json") };

const cities = require("world-cities-json/data/cities.json");
const norm = (x) =>
  x
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const CAPFIX = {
  MMR: [19.745, 96.129],
  UNK: [42.663, 21.166],
  PSE: [31.904, 35.204],
  ESH: [27.154, -13.203],
};
function capLL(c) {
  if (CAPFIX[c.cca3]) return CAPFIX[c.cca3];
  const cap = (c.capital || [])[0];
  if (!cap) return null;
  let m =
    cities.find(
      (p) =>
        p.iso3 === c.cca3 &&
        p.capital === "primary" &&
        (norm(p.city_ascii) === norm(cap) || norm(p.city) === norm(cap)),
    ) ||
    cities.find(
      (p) => p.iso3 === c.cca3 && (norm(p.city_ascii) === norm(cap) || norm(p.city) === norm(cap)),
    ) ||
    cities.find((p) => p.iso3 === c.cca3 && p.capital === "primary");
  return m ? [+(+m.lat).toFixed(3), +(+m.lng).toFixed(3)] : null;
}

const ab = require("country-json/src/country-by-abbreviation.json");
const popSrc = require("country-json/src/country-by-population.json");
const abMap = new Map(ab.map((x) => [x.country, x.abbreviation]));
const POP = { TL: 1267972 };
for (const p of popSrc) {
  const a = abMap.get(p.country);
  if (a && p.population) POP[a] = p.population;
}

const WB = {};
for (const line of fs
  .readFileSync(path.join(__dirname, "sources/population.csv"), "utf8")
  .replace(/\r/g, "")
  .trim()
  .split("\n")
  .slice(1)) {
  const m = line.match(/,([A-Z0-9]{3}),(\d{4}),([\d.]+)$/);
  if (!m) continue;
  const [, code, yr, v] = m;
  const k = code === "XKX" ? "UNK" : code;
  if (!WB[k] || +yr > WB[k][1]) WB[k] = [Math.round(+v), +yr];
}
const out = [];
const flags = {};
for (const c of countries) {
  if (c.cca3 === "ATA" || c.cca3 === "BVT" || c.cca3 === "HMD" || c.cca3 === "UMI") continue;
  if (svgFlags[c.cca2]) flags[c.cca2] = svgFlags[c.cca2];
  out.push({
    id: c.cca3,
    a2: c.cca2,
    n: c.name.common,
    o: c.name.official,
    nat: Object.values(c.name.native || {})[0]?.common || "",
    nv: Object.entries(c.name.native || {}).map(([k, v]) => [
      k,
      (c.languages || {})[k] || k,
      v.common,
    ]),
    cap: c.capital || [],
    r: c.region,
    sr: c.subregion || "",
    l: Object.values(c.languages || {}),
    cur: Object.entries(c.currencies || {}).map(([k, v]) => [k, v.name, v.symbol || ""]),
    ar: c.area,
    b: [...(c.borders || []), ...(POV_BORDERS[c.cca3] || [])],
    ll: c.latlng,
    lk: !!c.landlocked,
    dm: c.demonyms?.eng?.m || "",
    tld: (c.tld || [])[0] || "",
    cc: c.idd?.root
      ? c.idd.root + ((c.idd.suffixes || []).length === 1 ? c.idd.suffixes[0] : "")
      : "",
    pop: WB[c.cca3] ? WB[c.cca3][0] : c.cca3 === "TWN" ? 23400000 : POP[c.cca2] || 0,
    py: WB[c.cca3] ? WB[c.cca3][1] : c.cca3 === "TWN" ? 2024 : POP[c.cca2] ? 2018 : 0,
    cl: capLL(c),
    fx: facts[c.cca3] || [],
    ind: !!(c.independent || c.unMember),
    un: !!c.unMember,
    map: inMap.has(c.cca3),
  });
}
const INDIA = [
  "Hindi",
  "English",
  "Assamese",
  "Bengali",
  "Bodo",
  "Dogri",
  "Gujarati",
  "Kannada",
  "Kashmiri",
  "Konkani",
  "Maithili",
  "Malayalam",
  "Manipuri",
  "Marathi",
  "Nepali",
  "Odia",
  "Punjabi",
  "Sanskrit",
  "Santali",
  "Sindhi",
  "Tamil",
  "Telugu",
  "Urdu",
];
const ind = out.find((c) => c.id === "IND");
ind.l = INDIA;
ind.nv = ind.nv.filter((x) => x[0] === "hin" || x[0] === "eng");
const ct = require("countries-and-timezones");
const tzAll = ct.getAllTimezones({ deprecated: true });
const tz = {};
for (const [k, v] of Object.entries(tzAll)) {
  const c = (v.countries || [])[0] || (v.aliasOf && ((tzAll[v.aliasOf] || {}).countries || [])[0]);
  if (c) tz[k] = c;
}
const egm = require("egm96-universal");
const gb = Buffer.alloc(180 * 91);
for (let j = 0; j < 91; j++)
  for (let i = 0; i < 180; i++) {
    const v = Math.round(egm.meanSeaLevel(90 - 2 * j, -180 + 2 * i));
    gb.writeInt8(Math.max(-127, Math.min(127, v)), j * 180 + i);
  }
const geoid = { d: gb.toString("base64") };

function subData() {
  const all = require("./sources/states.json");
  const dir = path.join(__dirname, "../data/states");
  if (!dir) return all;
  fs.mkdirSync(dir, { recursive: true });
  return Object.fromEntries(
    Object.entries(all).map(([k, v]) => {
      fs.writeFileSync(path.join(dir, k + ".json"), JSON.stringify(v.topo));
      return [k, { ...v, topo: null }];
    }),
  );
}
const data =
  "window.GEO=" +
  JSON.stringify({
    topo: topoP,
    topo110: topo110P,
    topo10: topo10P,
    countries: out,
    flags,
    tz,
    geoid,
    fix: FIX,
    sub: subData(),
  }) +
  ";";
fs.writeFileSync(path.join(__dirname, "../data/geo.js"), data.replace(/<\/script/gi, "<\\/script"));
console.log("countries", out.length, "bytes", data.length);
