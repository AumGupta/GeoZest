const { optimize } = require("svgo");
const fs = require("fs");
const dir = require("path").join(__dirname, "../node_modules/svg-country-flags/svg/");
function mini(s) {
  const cfg = (p) => ({
    multipass: true,
    floatPrecision: p,
    plugins: [
      { name: "preset-default", params: { overrides: { removeViewBox: false } } },
      "removeDimensions",
    ],
  });
  try {
    return optimize(s, cfg(1)).data;
  } catch (e) {
    try {
      return optimize(s, cfg(2)).data;
    } catch (e2) {
      return s;
    }
  }
}
function ensureVB(s) {
  if (/viewBox=/.test(s)) return s;
  const w = /width="([\d.]+)/.exec(s),
    h = /height="([\d.]+)/.exec(s);
  return w && h ? s.replace("<svg", `<svg viewBox="0 0 ${w[1]} ${h[1]}"`) : s;
}
module.exports = function () {
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    let s = fs.readFileSync(dir + f, "utf8");
    s = ensureVB(s);
    s = mini(s).replace(/<\?xml[^>]*>/, "");
    out[f.replace(".svg", "").toUpperCase()] = s;
  }
  return out;
};
if (require.main === module) {
  const o = module.exports();
  let t = 0,
    b = [];
  for (const [k, v] of Object.entries(o)) {
    t += v.length;
    if (v.length > 40000) b.push(k + ":" + v.length);
    if (!/viewBox/.test(v)) b.push("NOVB " + k);
  }
  console.log(Object.keys(o).length, t, b.join(" "));
}
