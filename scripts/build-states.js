const fs = require("fs"),
  path = require("path");
const { topology } = require("topojson-server");
const { presimplify, simplify, quantile } = require("topojson-simplify");
const { neighbors } = require("topojson-client");
const d3 = require("d3-geo");
const pc = require("polygon-clipping");
const SET = require("./states-config.js");
const src = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const pov = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const indPov = pov.features.find((f) => f.properties.ADM0_A3 === "IND").geometry;

const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
const km2 = (p) => {
  const a = d3.geoArea({ type: "Polygon", coordinates: p });
  return Math.min(a, 4 * Math.PI - a) * 6371.0088 ** 2;
};
const inBox = (p) => {
  const R = p[0];
  const x = R.reduce((s, q) => s + q[0], 0) / R.length,
    y = R.reduce((s, q) => s + q[1], 0) / R.length;
  return x > 72.3 && x < 80.7 && y > 32.3 && y < 37.3;
};

const wind = (g) => {
  const fix = (p) =>
    d3.geoArea({ type: "Polygon", coordinates: p }) > 2 * Math.PI
      ? p.map((r) => r.slice().reverse())
      : p;
  return g.type === "Polygon"
    ? { type: "Polygon", coordinates: fix(g.coordinates) }
    : { type: "MultiPolygon", coordinates: g.coordinates.map(fix) };
};

const KEEP = {
  RUS: 0.035,
  CAN: 0.035,
  CHN: 0.07,
  USA: 0.08,
  BRA: 0.1,
  AUS: 0.08,
  MEX: 0.1,
  IND: 0.1,
};

const out = {};
for (const [a3, cfg] of Object.entries(SET)) {
  const drop = new Set(cfg.drop || []),
    merge = cfg.merge || {};
  const extra = new Set(cfg.extra ? cfg.extra.codes.split(" ") : []);
  const byId = new Map();
  for (const f of src.features) {
    const P = f.properties;
    if (P.adm0_a3 !== a3 || drop.has(P.iso_3166_2)) continue;
    const id = merge[P.iso_3166_2] || P.iso_3166_2;
    if (!byId.has(id)) byId.set(id, { id, P: null, parts: [] });
    const e = byId.get(id);
    if (!merge[P.iso_3166_2] && (!e.P || P.name)) e.P = P;
    e.parts.push(...polys(f.geometry));
  }
  const feats = [...byId.values()].map((e) => {
    let g = {
      type: "MultiPolygon",
      coordinates: e.parts.length > 1 ? pc.union(...e.parts.map((p) => [p])) : e.parts,
    };
    return { type: "Feature", id: e.id, properties: {}, geometry: g, P: e.P };
  });
  if (a3 === "IND") {
    const all = pc.union(...feats.map((f) => polys(f.geometry)));
    const add0 = pc.difference(polys(indPov), all).filter((p) => inBox(p) && km2(p) > 50);
    const ajk = polys(
      src.features.find((f) => f.properties.adm0_a3 === "PAK" && /Azad/.test(f.properties.name))
        .geometry,
    );
    const add = {
      "IN-JK": pc.intersection(add0, ajk).filter((p) => km2(p) > 20),
      "IN-LA": pc.difference(add0, ajk).filter((p) => km2(p) > 20),
    };
    for (const f of feats)
      if (add[f.id])
        f.geometry = {
          type: "MultiPolygon",
          coordinates: pc
            .union(polys(f.geometry), add[f.id])
            .map((p) => [p[0], ...p.slice(1).filter((h) => km2(h) > 2000)]),
        };
  }
  if (a3 === "CHN")
    for (const f of feats)
      f.geometry = {
        type: "MultiPolygon",
        coordinates: pc.difference(polys(f.geometry), polys(indPov)).filter((p) => km2(p) > 5),
      };
  for (const f of feats) f.geometry = wind(f.geometry);
  let topo = topology(
    { s: { type: "FeatureCollection", features: feats.map(({ P, ...f }) => f) } },
    1e5,
  );
  const nb = neighbors(topo.objects.s.geometries);
  topo = presimplify(topo);
  topo = simplify(topo, quantile(topo, KEEP[a3] || 0.1));
  const meta = topo.objects.s.geometries.map((g, i) => {
    const f = feats[i],
      code = g.id.split("-")[1];
    if (!cfg.cap[code] || !cfg.zone[code]) throw new Error("missing " + g.id);
    const ar = Math.round(d3.geoArea(f.geometry) * 6371.0088 ** 2);
    const lab = d3.geoCentroid({
      type: "MultiPolygon",
      coordinates: polys(f.geometry)
        .slice()
        .sort((a, b) => km2(b) - km2(a))
        .slice(0, 1),
    });
    const ll =
      f.P && isFinite(f.P.latitude)
        ? [+f.P.latitude.toFixed(3), +f.P.longitude.toFixed(3)]
        : [+lab[1].toFixed(3), +lab[0].toFixed(3)];
    return {
      id: g.id,
      n: (cfg.names || {})[code] || f.P.name,
      main: !extra.has(code),
      cap: cfg.cap[code],
      sr: cfg.zone[code],
      ll,
      ar,
      b: nb[i].map((j) => topo.objects.s.geometries[j].id),
    };
  });
  out[a3] = {
    name: cfg.name,
    unit: cfg.unit,
    units: cfg.units,
    q: cfg.q,
    extra: cfg.extra ? { label: cfg.extra.label, one: cfg.extra.one, txt: cfg.extra.txt } : null,
    view: cfg.view || null,
    topo,
    meta,
  };
  console.log(a3, meta.length, "units,", (JSON.stringify(topo).length / 1024).toFixed(0), "KB");
}
fs.writeFileSync(path.join(__dirname, "sources/states.json"), JSON.stringify(out));
console.log(
  "total",
  (fs.statSync(path.join(__dirname, "sources/states.json")).size / 1024).toFixed(0),
  "KB",
);
