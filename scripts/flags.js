const { optimize } = require("svgo");
const fs = require("fs");
const dir = require("path").join(__dirname, "../node_modules/svg-country-flags/svg/");
const RAW = new Set(["SI", "NU"]);
function mini(s, code) {
  const pre = { name: "prefixIds", params: { prefix: "f" + code.toLowerCase(), delim: "-" } };
  const cfg = (p) =>
    RAW.has(code)
      ? { plugins: [pre] }
      : {
          multipass: true,
          floatPrecision: p,
          plugins: [
            { name: "preset-default", params: { overrides: { removeViewBox: false } } },
            "removeDimensions",
            pre,
          ],
        };
  try {
    return optimize(s, cfg(3)).data;
  } catch (e) {
    try {
      return optimize(s, { plugins: [pre] }).data;
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
    const code = f.replace(".svg", "").toUpperCase();
    let s = fs.readFileSync(dir + f, "utf8");
    s = ensureVB(s);
    s = mini(s, code).replace(/<\?xml[^>]*>/, "");
    out[code] = s;
  }
  return out;
};
if (require.main === module) {
  const o = module.exports();
  let t = 0;
  for (const v of Object.values(o)) t += v.length;
  console.log(Object.keys(o).length, t);
}
