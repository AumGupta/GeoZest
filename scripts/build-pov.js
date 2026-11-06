const fs = require("fs"),
  path = require("path");
const pc = require("polygon-clipping");
const d3 = require("d3-geo");
const topojson = require("topojson-client");
const pov = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const adm1 = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
const t10 = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-10m.json"), "utf8"));
const ind10 = topojson
  .feature(t10, t10.objects.countries)
  .features.find((f) => f.id === "356").geometry;
const indPov = pov.features.find((f) => f.properties.ADM0_A3 === "IND").geometry;
const BOX = [72.3, 32.3, 80.7, 37.3];
const inBox = (p) => {
  const R = p[0];
  const x = R.reduce((s, q) => s + q[0], 0) / R.length,
    y = R.reduce((s, q) => s + q[1], 0) / R.length;
  return x > BOX[0] && x < BOX[2] && y > BOX[1] && y < BOX[3];
};
const km2 = (p) => Math.abs(d3.geoArea({ type: "Polygon", coordinates: p }));
const areaOf = (p) => {
  const a = km2(p);
  return Math.min(a, 4 * Math.PI - a) * 6371.0088 ** 2;
};
const claim = pc.difference(polys(indPov), polys(ind10)).filter((p) => inBox(p) && areaOf(p) > 50);
const ajk = adm1.features.find(
  (f) => f.properties.adm0_a3 === "PAK" && /Azad/.test(f.properties.name),
).geometry;

const boxRing = [
  [
    [BOX[0], BOX[1]],
    [BOX[2], BOX[1]],
    [BOX[2], BOX[3]],
    [BOX[0], BOX[3]],
    [BOX[0], BOX[1]],
  ],
];
const parts = {};
for (const f of pov.features) {
  const id = f.properties.ADM0_A3,
    cut = pc.intersection(polys(f.geometry), boxRing).filter((p) => areaOf(p) > 0.5);
  if (cut.length)
    parts[{ IND: "IND", PAK: "PAK", CHN: "CHN", AFG: "AFG", TJK: "TJK" }[id] || id] = {
      type: "MultiPolygon",
      coordinates: cut,
    };
}
const r = (c) => (typeof c[0] === "number" ? [+c[0].toFixed(5), +c[1].toFixed(5)] : c.map(r));
for (const k in parts) parts[k].coordinates = r(parts[k].coordinates);
const out = {
  box: BOX,
  parts,
  claim: { type: "MultiPolygon", coordinates: r(claim) },
  ajk: { type: "MultiPolygon", coordinates: r(polys(ajk)) },
};
console.log("countries in box:", Object.keys(parts).join(", "));
fs.writeFileSync(path.join(__dirname, "sources/pov-india.json"), JSON.stringify(out));
console.log(
  "claim parts",
  claim.length,
  claim.map((p) => Math.round(areaOf(p))).join(", "),
  "km2; bytes",
  fs.statSync(path.join(__dirname, "sources/pov-india.json")).size,
);
