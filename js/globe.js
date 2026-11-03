"use strict";

const orthoRaw = d3.geoOrthographicRaw;
const mercClamp = (l, p) => mRaw(l, Math.max(BOT, Math.min(TOP, p)));
const flatRaw = (n) => (n === "merc" ? mercClamp : eeRaw);
const GRAT = d3.geoGraticule10();
const SPHERE = { type: "Sphere" };
const OUT85 = d3
  .geoGraticule()
  .extentMajor([
    [-180, -85],
    [180, 85],
  ])
  .outline();

for (const r of RECS) {
  const geo = r.f50
    ? { type: "FeatureCollection", features: r.f50 }
    : r.g10
      ? (r.geo10 = {
          type: "GeometryCollection",
          geometries: r.g10.map((g) => topojson.feature(G.topo10, g).geometry),
        })
      : null;
  if (!geo) continue;
  r.gc = d3.geoCentroid(geo);
  const b = d3.geoBounds(geo);
  let rad = 0;
  for (const q of [
    [b[0][0], b[0][1]],
    [b[1][0], b[0][1]],
    [b[0][0], b[1][1]],
    [b[1][0], b[1][1]],
  ])
    rad = Math.max(rad, d3.geoDistance(r.gc, q));
  r.gr = isFinite(rad) ? Math.max(0.002, rad) : Math.PI;
}
function gGeom(r, lod) {
  if (lod === "10" && r.g10) {
    if (!r.geo10)
      r.geo10 = {
        type: "GeometryCollection",
        geometries: r.g10.map((g) => topojson.feature(G.topo10, g).geometry),
      };
    return r.geo10;
  }
  if (lod === "110" && r.f110)
    return r.fc110 || (r.fc110 = { type: "FeatureCollection", features: r.f110 });
  if (r.f50) return r.fc50 || (r.fc50 = { type: "FeatureCollection", features: r.f50 });
  if (lod !== "110" && r.g10) return gGeom(r, "10");
  return null;
}
function mainParts(r) {
  if (r._mp) return r._mp;
  if (!r.f50) {
    r._mp = { c: r.gc, r: r.gr };
    return r._mp;
  }
  const parts = [];
  for (const f of r.f50) {
    const g = f.geometry;
    const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
    for (const p of polys) parts.push({ p, a: d3.geoArea({ type: "Polygon", coordinates: p }) });
  }
  parts.sort((a, b) => b.a - a.a);
  const keep = {
    type: "MultiPolygon",
    coordinates: parts.filter((x) => x.a > parts[0].a * 0.08).map((x) => x.p),
  };
  const c = d3.geoCentroid(keep),
    b = d3.geoBounds(keep);
  let rr = 0;
  for (const q of [
    [b[0][0], b[0][1]],
    [b[1][0], b[0][1]],
    [b[0][0], b[1][1]],
    [b[1][0], b[1][1]],
    [c[0], b[0][1]],
    [c[0], b[1][1]],
  ])
    rr = Math.max(rr, d3.geoDistance(c, q));
  r._mp = { c, r: Math.max(0.002, Math.min(rr, 1.5)) };
  return r._mp;
}

const GEOID = (() => {
  const b = atob(G.geoid.d);
  const a = new Int8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = (b.charCodeAt(i) << 24) >> 24;
  return a;
})();
const GW = 180,
  GH = 91;
function geoN(lon, lat) {
  let x = ((((lon + 180) % 360) + 360) % 360) / 2,
    y = (90 - lat) / 2;
  const x0 = Math.floor(x),
    y0 = Math.max(0, Math.min(GH - 2, Math.floor(y)));
  const fx = x - x0,
    fy = Math.min(1, y - y0);
  const x1 = (x0 + 1) % GW,
    X0 = x0 % GW;
  const v = (i, j) => GEOID[j * GW + i];
  return (
    (v(X0, y0) * (1 - fx) + v(x1, y0) * fx) * (1 - fy) +
    (v(X0, y0 + 1) * (1 - fx) + v(x1, y0 + 1) * fx) * fy
  );
}
const GEO_AMP = 0.0008;
const GEO_RAMP = d3
  .scaleLinear()
  .domain([-100, -55, -20, 10, 40, 80])
  .range(["#AE81FF", "#66D9EF", "#A6E22E", "#E6DB74", "#FD971F", "#F92672"])
  .clamp(true);
const GEO_LUT = (() => {
  const a = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const c = d3.rgb(GEO_RAMP(i - 128));
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  return a;
})();
Object.assign(M, {
  mode: S.settings.proj === "globe" || S.settings.proj === "geoid" ? "globe" : "flat",
  geoAmt: S.settings.proj === "geoid" ? 1 : 0,
  geoHeat: S.settings.geoHeat === false ? 0 : 1,
  geoHeatOn: S.settings.geoHeat !== false,
  gc: [10, 20],
  gs: 0,
  gtx: 0,
  gty: 0,
  moving: false,
  gR0() {
    const a = this.avail();
    return Math.max(60, Math.min(a.w * 0.45, a.h * 0.4));
  },
  gMin() {
    return this.gR0() * 0.8;
  },
  gMax() {
    return (6000 * 180) / Math.PI;
  },

  dpt(x, y, ll) {
    const n = ll ? geoN(ll[0], ll[1]) : 0;
    const f = 1 + GEO_AMP * this.geoAmt * n;
    return [this.gtx + (x - this.gtx) * f, this.gty + (y - this.gty) * f];
  },
  dproj() {
    const self = this,
      gp = this.gproj;
    return {
      stream(s) {
        return gp.stream({
          point(x, y) {
            const q = self.dpt(x, y, gp.invert([x, y]));
            s.point(q[0], q[1]);
          },
          lineStart() {
            s.lineStart();
          },
          lineEnd() {
            s.lineEnd();
          },
          polygonStart() {
            s.polygonStart();
          },
          polygonEnd() {
            s.polygonEnd();
          },
          sphere() {
            s.sphere && s.sphere();
          },
        });
      },
    };
  },

  paintGeoid(hv) {
    const R = this.gs,
      cx = this.gtx,
      cy = this.gty,
      amt = this.geoAmt,
      W = this.w,
      H = this.h;
    const step = this.moving || this.busy ? (R > 500 ? 4 : 3) : R > 420 ? 1.5 : 1;
    const key = [cx, cy, R, this.gc[0], this.gc[1], amt, step, W, H]
      .map((v) => (+v).toFixed(3))
      .join();
    if (this.gKey !== key) {
      const ext = R * 1.12,
        x0 = Math.max(0, Math.floor(cx - ext)),
        y0 = Math.max(0, Math.floor(cy - ext)),
        x1 = Math.min(W, Math.ceil(cx + ext)),
        y1 = Math.min(H, Math.ceil(cy + ext));
      const w = Math.max(1, Math.ceil((x1 - x0) / step)),
        h = Math.max(1, Math.ceil((y1 - y0) / step));
      const cv = this.gCv || (this.gCv = document.createElement("canvas"));
      cv.width = w;
      cv.height = h;
      const g = cv.getContext("2d");
      const img = g.createImageData(w, h),
        D = img.data,
        L = GEO_LUT,
        rad = Math.PI / 180,
        deg = 180 / Math.PI,
        p0 = this.gc[1] * rad,
        l0 = this.gc[0],
        cp = Math.cos(p0),
        sp = Math.sin(p0),
        A = GEO_AMP * amt;
      for (let j = 0; j < h; j++) {
        const dy = (cy - (y0 + (j + 0.5) * step)) / R;
        for (let i = 0; i < w; i++) {
          const dx = (x0 + (i + 0.5) * step - cx) / R;
          const r2 = dx * dx + dy * dy;
          if (r2 > 1.25) continue;
          let f = 1,
            n = 0,
            ok = false;
          for (let it = 0; it < 3; it++) {
            let x = dx / f,
              y = dy / f,
              q = x * x + y * y;
            ok = q <= 1;
            if (!ok) {
              const k = 1 / Math.sqrt(q);
              x *= k;
              y *= k;
              q = 1;
            }
            const z = Math.sqrt(Math.max(0, 1 - q));
            const lat = Math.asin(Math.max(-1, Math.min(1, y * cp + z * sp))) * deg,
              lon = l0 + Math.atan2(x, z * cp - y * sp) * deg;
            n = geoN(lon, lat);
            f = 1 + A * n;
          }
          if (!ok && r2 / (f * f) > 1) continue;
          const c = Math.max(0, Math.min(255, Math.round(n + 128))) * 3,
            o = (j * w + i) * 4;
          D[o] = L[c];
          D[o + 1] = L[c + 1];
          D[o + 2] = L[c + 2];
          D[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      this.gKey = key;
      this.gBox = [x0, y0, w * step, h * step];
    }
    const c = this.ctx;
    c.save();
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.globalAlpha = hv;
    c.drawImage(this.gCv, this.gBox[0], this.gBox[1], this.gBox[2], this.gBox[3]);
    c.restore();
  },
  setGeoid(on, done) {
    const from = this.geoAmt,
      to = on ? 1 : 0;
    if (from === to) {
      done && done();
      return;
    }
    this.busy = true;
    this.gStop();
    const fin = () => {
      this.ghost = null;
      this.geoAmt = to;
      this.busy = false;
      this.fadeAt = performance.now();
      this.sched();
      this.geoLegend();
      done && done();
    };
    if (reduced()) {
      fin();
      return;
    }
    this.ghost = this.snap();
    this.ghostA = 1;
    this.geoAmt = to;
    const tm = d3.timer((el) => {
      const u = Math.min(1, el / 520);
      this.ghostA = 1 - d3.easeCubicInOut(u);
      this.draw();
      if (u >= 1) {
        tm.stop();
        fin();
      }
    });
  },
  snap() {
    const c = document.createElement("canvas");
    c.width = this.cv.width;
    c.height = this.cv.height;
    c.getContext("2d").drawImage(this.cv, 0, 0);
    return c;
  },
  drawGhost() {
    if (!this.ghost || this.ghostA <= 0) return;
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = this.ghostA;
    c.drawImage(this.ghost, 0, 0);
    c.restore();
  },
  geoLegend() {
    const el = $("#geoLegend");
    if (!el) return;
    el.hidden = !(this.mode === "globe" && this.geoAmt > 0.5);
    el.setAttribute("aria-pressed", this.geoHeatOn ? "true" : "false");
  },

  setHeat(on) {
    this.geoHeatOn = on;
    this.geoLegend();
    const from = this.geoHeat,
      to = on ? 1 : 0;
    if (this.heatT) this.heatT.stop();
    if (reduced()) {
      this.geoHeat = to;
      this.sched();
      return;
    }
    this.heatT = d3.timer((el) => {
      const u = Math.min(1, el / 320);
      this.geoHeat = from + (to - from) * d3.easeCubicOut(u);
      this.draw();
      if (u >= 1) {
        this.heatT.stop();
        this.heatT = null;
      }
    });
  },
  gApply() {
    this.gproj.scale(this.gs).translate([this.gtx, this.gty]).rotate([-this.gc[0], -this.gc[1]]);
  },
  gLod() {
    if (this.moving) return this.gs < 900 ? "110" : "50";
    return this.gs < 340 ? "110" : this.gs > 2600 ? "10" : "50";
  },
  gView() {
    const half = Math.hypot(this.w, this.h) / 2 + 40;
    return half >= this.gs ? Math.PI / 2 : Math.asin(half / this.gs) + 0.02;
  },

  gStart(e) {
    this.gPrev = e.transform;
    if (e.sourceEvent) {
      this.gStop();
      this.gSamples = [];
    }
  },
  gZoom(e) {
    const t = e.transform,
      p = this.gPrev || t;
    this.gPrev = t;
    const dk = t.k / p.k;
    if (Math.abs(dk - 1) > 1e-5) {
      this.gs = Math.max(this.gMin(), Math.min(this.gMax(), this.gs * dk));
    } else if (e.sourceEvent) {
      const f = 180 / Math.PI / this.gs;
      const dx = t.x - p.x,
        dy = t.y - p.y;
      this.gc = [this.gc[0] - dx * f, Math.max(-85, Math.min(85, this.gc[1] + dy * f))];
      const n = performance.now();
      (this.gSamples || (this.gSamples = [])).push([n, dx, dy]);
      while (this.gSamples.length && n - this.gSamples[0][0] > 100) this.gSamples.shift();
    }
    this.moving = true;
    this.gApply();
    this.sched();
  },
  gEnd(e) {
    this.cv.__zoom = d3.zoomIdentity.scale(100);
    this.gPrev = null;
    const s = this.gSamples || [];
    this.gSamples = [];
    let vx = 0,
      vy = 0;
    const dt = s.length > 1 ? s[s.length - 1][0] - s[0][0] : 0;
    for (const q of s.slice(1)) {
      vx += q[1];
      vy += q[2];
    }
    if (e.sourceEvent && dt > 12 && Math.hypot(vx / dt, vy / dt) > 0.25 && !reduced()) {
      vx /= dt;
      vy /= dt;
      let last = 0;
      this.gSpin = d3.timer((el) => {
        const d = Math.min(32, el - last);
        last = el;
        const f = Math.exp(-d / 380);
        vx *= f;
        vy *= f;
        const g = 180 / Math.PI / this.gs;
        this.gc = [this.gc[0] - vx * d * g, Math.max(-85, Math.min(85, this.gc[1] + vy * d * g))];
        this.gApply();
        this.sched();
        if (Math.hypot(vx, vy) < 0.02) {
          this.gStop();
          this.moving = false;
          this.sched();
        }
      });
    } else {
      this.moving = false;
      this.sched();
    }
  },
  gStop() {
    if (this.gSpin) {
      this.gSpin.stop();
      this.gSpin = null;
    }
    if (this.gFly) {
      this.gFly.stop();
      this.gFly = null;
    }
  },

  gFlyTo(ll, s, dur = 900) {
    this.gStop();
    s = Math.max(this.gMin(), Math.min(this.gMax(), s));
    const a = this.avail(),
      tx1 = a.x + a.w / 2,
      ty1 = a.y + a.h / 2;
    const c0 = this.gc.slice(),
      s0 = this.gs || s,
      tx0 = this.gtx,
      ty0 = this.gty;
    const ip = d3.geoInterpolate(c0, ll);
    const bump = Math.min(0.5, (d3.geoDistance(c0, ll) / Math.PI) * 0.9);
    const set = (u) => {
      const e = d3.easeCubicInOut(u);
      const c = ip(e);
      this.gc = [c[0], Math.max(-85, Math.min(85, c[1]))];
      const base = Math.exp(Math.log(s0) + (Math.log(s) - Math.log(s0)) * e);
      this.gs = Math.max(this.gMin() * 0.95, base * (1 - bump * Math.sin(Math.PI * e)));
      this.gtx = tx0 + (tx1 - tx0) * e;
      this.gty = ty0 + (ty1 - ty0) * e;
      this.gApply();
    };
    if (!dur || reduced()) {
      set(1);
      this.moving = false;
      this.sched();
      return;
    }
    this.moving = true;
    this.gFly = d3.timer((el) => {
      const u = Math.min(1, el / dur);
      set(u);
      this.draw();
      if (u >= 1) {
        this.gFly.stop();
        this.gFly = null;
        this.moving = false;
        this.sched();
      }
    });
  },
  gScaleFor(rad, fill) {
    const a = this.avail();
    if (rad >= 1.3) return this.gR0();
    return ((Math.min(a.w, a.h) / 2) * fill) / Math.sin(Math.max(rad, 0.0004));
  },
  gToId(id, fill = 0.7, dur = 900) {
    const r = RBY.get(id),
      c = C.get(id);
    let ll, rad;
    if (r && r.gc) {
      const m = mainParts(r);
      ll = m.c;
      rad = m.r;
    } else if (c && c.ll) {
      ll = [c.ll[1], c.ll[0]];
      rad = 0.004;
    } else return;
    this.gFlyTo(ll, this.gScaleFor(rad, fill), dur);
  },
  gToIds(ids, fill = 0.8, dur = 900) {
    const ms = ids
      .map((id) => {
        const r = RBY.get(id),
          c = C.get(id);
        return r && r.gc ? mainParts(r) : c && c.ll ? { c: [c.ll[1], c.ll[0]], r: 0.004 } : null;
      })
      .filter(Boolean);
    if (!ms.length) return;
    const ctr =
      ms.length === 1
        ? ms[0].c
        : d3.geoCentroid({ type: "MultiPoint", coordinates: ms.map((m) => m.c) });
    let rad = 0;
    for (const m of ms) rad = Math.max(rad, d3.geoDistance(ctr, m.c) + m.r);
    this.gFlyTo(ctr, this.gScaleFor(rad, fill), dur);
  },
  gToRegion(r, dur = 800) {
    const RB = regionBox(r);
    if (!RB) {
      this.gWorld(dur);
      return;
    }
    const [[a, b], [c, d]] = RB;
    const ctr = [(a + c) / 2, (b + d) / 2];
    const rad = Math.max(d3.geoDistance(ctr, [a, b]), d3.geoDistance(ctr, [c, d]));
    this.gFlyTo(ctr, this.gScaleFor(rad, 0.98), dur);
  },
  gWorld(dur = 800) {
    const c = HOME && C.get(HOME);
    this.gFlyTo(c ? [c.ll[1], c.ll[0] * 0.6] : [10, 20], this.gR0(), dur);
  },
  gHit(sx, sy) {
    if (this.busy || !this.gs) return null;
    let px = sx,
      py = sy;
    if (this.geoAmt) {
      for (let i = 0; i < 3; i++) {
        const ll0 = this.gproj.invert([px, py]);
        const f = 1 + GEO_AMP * this.geoAmt * (ll0 ? geoN(ll0[0], ll0[1]) : 0);
        px = this.gtx + (sx - this.gtx) / f;
        py = this.gty + (sy - this.gty) / f;
      }
    }
    if (Math.hypot(px - this.gtx, py - this.gty) > this.gs) return null;
    const ll = this.gproj.invert([px, py]);
    if (!ll) return null;
    let best = null,
      bd = 1e9;
    for (const d of this.dotIt) {
      if (!this.dotVisible(d.id)) continue;
      for (const [x, y] of this.at(d)) {
        const dd = Math.hypot(x - sx, y - sy);
        if (dd < 16 && dd < bd) {
          bd = dd;
          best = d.id;
        }
      }
    }
    if (best) return best;
    for (const r of RHIT) {
      if (!(r.c || r.id === "ATA") || !r.gc) continue;
      if (d3.geoDistance(ll, r.gc) > r.gr + 0.01) continue;
      const g = gGeom(r, "50");
      if (g && d3.geoContains(g, ll)) return r.id;
    }
    return null;
  },

  paintGeo(proj, lod, g, cx, cy, R, cull) {
    const c = this.ctx,
      d = this.dpr,
      W = this.w,
      H = this.h,
      p = this.pal;
    c.setTransform(d, 0, 0, d, 0, 0);

    if (g <= 0) {
      c.fillStyle = p.ocean;
      c.fillRect(0, 0, W, H);
    } else {
      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, p.space);
      bg.addColorStop(1, p.space2);
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);
      if (g < 1) {
        c.globalAlpha = 1 - g;
        c.fillStyle = p.ocean;
        c.fillRect(0, 0, W, H);
        c.globalAlpha = 1;
      }
    }
    const fx =
      (g >= 1 ? 1 : g > 0.85 ? Math.pow((g - 0.85) / 0.15, 2) : 0) *
      (R > Math.hypot(W, H) * 0.9 ? 0 : 1);

    if (fx > 0.01) {
      const sy = cy + R * 1.12,
        rx = R * 1.05,
        ry = R * 0.075;
      c.save();
      c.globalAlpha = fx;
      c.translate(cx, sy);
      c.scale(1, ry / rx);
      const a0 = parseFloat(p.shadow.match(/[\d.]+\)$/)[0]),
        sa = (k) => p.shadow.replace(/[\d.]+\)$/, (a0 * k).toFixed(3) + ")");
      const sh = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      sh.addColorStop(0, sa(1));
      sh.addColorStop(0.3, sa(0.55));
      sh.addColorStop(0.65, sa(0.16));
      sh.addColorStop(1, sa(0));
      c.fillStyle = sh;
      c.beginPath();
      c.arc(0, 0, rx, 0, 7);
      c.fill();
      c.restore();
    }
    const P = this.geoAmt > 0 && cull ? this.dproj() : proj;
    const path = d3.geoPath(P, c);
    const round = g > 0.85 || !!cull;
    const ocean = g > 0.5 ? p.gocean : p.ocean;
    if (round) {
      c.beginPath();
      path(SPHERE);
      c.fillStyle = ocean;
      c.fill();
    } else if (this.mode === "morph" && g > 0) {
      const out = this.morphTo === "merc" ? OUT85 : SPHERE;
      c.save();
      c.beginPath();
      path(out);
      c.globalAlpha = 0.25 + 0.6 * g;
      c.fillStyle = p.gocean;
      c.fill();
      c.clip();
      const sh = c.createRadialGradient(
        cx - R * 0.42,
        cy - R * 0.46,
        R * 0.04,
        cx - R * 0.1,
        cy - R * 0.1,
        R * 1.15,
      );
      sh.addColorStop(0, p.glight);
      sh.addColorStop(0.45, "rgba(255,255,255,0)");
      sh.addColorStop(0.82, "rgba(0,0,0,0)");
      sh.addColorStop(1, p.rim);
      c.globalAlpha = g;
      c.fillStyle = sh;
      c.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
      c.restore();
    }
    c.save();
    if (round) {
      c.beginPath();
      path(SPHERE);
      c.clip();
    }
    const hv = (this.geoAmt || 0) * this.geoHeat;
    if (hv > 0 && cull) this.paintGeoid(hv);
    c.beginPath();
    path(GRAT);
    c.lineWidth = 1;
    c.strokeStyle = p.grat;
    c.globalAlpha = 1 - hv * 0.6;
    c.stroke();
    c.globalAlpha = 1;
    const LA = this.mode === "morph" ? (this.landA ?? 1) : 1;
    if (LA < 1) {
      c.strokeStyle = p.ink;
      c.lineWidth = 0.7;
      c.globalAlpha = (1 - LA) * 0.28;
      c.beginPath();
      path(GRAT);
      c.stroke();
      if (this.morphTo !== "merc") {
        c.lineWidth = 1.3;
        c.globalAlpha = (1 - LA) * 0.55;
        c.beginPath();
        path(SPHERE);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.lineWidth = 1;
    }
    const now = performance.now(),
      pa = 0.55 + 0.45 * Math.cos(now / 220);
    let pulse = false;
    const outl = [];
    const ga = this.geoAmt || 0;
    c.lineJoin = "round";
    for (const r of LA > 0.01 ? RECS : []) {
      if (!r.gc) continue;
      if (cull && d3.geoDistance(r.gc, cull[0]) - r.gr > cull[1]) continue;
      if (r.id === "ATA" && g < 0.5 && this.morphTo === "merc") continue;
      if (cull && r.gr * R < 0.4) continue;
      const geo = gGeom(r, lod);
      if (!geo) continue;
      c.beginPath();
      path(geo);
      const st = this.state.get(r.id);

      const fa = st ? 1 : 1 - hv * 0.88;
      if (st === "target") {
        pulse = true;
        c.globalAlpha = pa * LA;
      } else c.globalAlpha = fa * LA;
      c.fillStyle = this.fillFor(r.id);
      c.fill("evenodd");
      c.globalAlpha = LA;
      c.lineWidth = 0.8;
      if (hv > 0.3) {
        c.strokeStyle = p.night ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.42)";
        c.stroke();
        c.globalAlpha = 1;
      } else {
        const m = Math.max(this.mix, hv);
        if (m < 1) {
          c.strokeStyle = c.fillStyle;
          c.globalAlpha = (st === "target" ? pa : fa) * LA;
          c.stroke();
        }
        if (m > 0) {
          c.globalAlpha = m * LA;
          c.strokeStyle = p.edge;
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      if (OUTLINED.has(st)) outl.push(geo);
    }
    c.lineWidth = 1.6;
    c.strokeStyle = p.ink;
    c.globalAlpha = LA;
    for (const geo of outl) {
      c.beginPath();
      path(geo);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.restore();
    if (fx > 0.01 && round) {
      c.save();
      c.globalAlpha = fx;
      c.beginPath();
      path(SPHERE);
      c.clip();

      const sh = c.createRadialGradient(
        cx - R * 0.42,
        cy - R * 0.46,
        R * 0.04,
        cx - R * 0.1,
        cy - R * 0.1,
        R * 1.15,
      );
      sh.addColorStop(0, p.glight);
      sh.addColorStop(0.45, "rgba(255,255,255,0)");
      sh.addColorStop(0.82, "rgba(0,0,0,0)");
      sh.addColorStop(1, p.rim);
      c.fillStyle = sh;
      c.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
      c.restore();
      c.globalAlpha = fx;
      c.beginPath();
      path(SPHERE);
      c.lineWidth = 1;
      c.strokeStyle = p.rimLine;
      c.stroke();
      c.globalAlpha = 1;
    }
    return pulse;
  },
  gDraw() {
    const want = this.countryMode() ? 1 : 0;
    if (this.mix !== want) {
      this.mix += Math.sign(want - this.mix) * 0.12;
      if (Math.abs(this.mix - want) < 0.12) this.mix = want;
      else this.sched();
    }
    const pulse = this.paintGeo(this.gproj, this.gLod(), 1, this.gtx, this.gty, this.gs, [
      this.gc,
      this.gView(),
    ]);
    const c = this.ctx;
    let la = 1,
      pending = false;
    const now = performance.now();
    if (this.fadeAt) {
      la = Math.min(1, (now - this.fadeAt) / 380);
      if (la < 1) pending = true;
      else this.fadeAt = 0;
    }
    this.la = la;
    c.globalAlpha = la;
    this.drawDots();
    this.drawLabels();
    this.drawPins();
    c.globalAlpha = 1;
    this.drawGhost();
    if (pulse || pending) this.sched();
  },
  mDraw() {
    if (this.mproj) {
      this.paintGeo(this.mproj, "110", this.mGlobe, this.mcx, this.mcy, this.mproj.scale(), null);
      this.drawGhost();
    }
  },

  morph(from, to, done) {
    const toGlobe = to === "globe",
      flatName = toGlobe ? from : to;
    this.morphTo = flatName;
    const centre = toGlobe ? this.centre() || [0, 0] : this.gc.slice();
    const a = this.avail(),
      cx = a.x + a.w / 2,
      cy = a.y + a.h / 2;
    let s0, s1;
    if (toGlobe) {
      s0 = this.s * this.k;
      s1 = this.k < 1.6 ? this.gR0() : Math.min(this.gMax(), s0);
    } else {
      s0 = this.gs;
      this.t = flatName === "merc" ? 1 : 0;
      this.mut(this.t);
      this.fitBase();
      s1 = Math.max(this.s, s0);
    }
    let fx = cx,
      fy = cy;
    if (!toGlobe) {
      const k = Math.max(1, s1 / this.s),
        q = this.proj(centre);
      if (q) {
        const t = this.hard(d3.zoomIdentity.translate(cx - q[0] * k, cy - q[1] * k).scale(k));
        fx = t.x + q[0] * k;
        fy = t.y + q[1] * k;
      }
    }
    const rawA = toGlobe ? flatRaw(flatName) : orthoRaw,
      rawB = toGlobe ? orthoRaw : flatRaw(flatName);
    const mut = d3.geoProjectionMutator((u) =>
      u <= 0
        ? rawA
        : u >= 1
          ? rawB
          : (l, p) => {
              const x = rawA(l, p),
                y = rawB(l, p);
              return [x[0] * (1 - u) + y[0] * u, x[1] * (1 - u) + y[1] * u];
            },
    );
    const pj = mut(0).precision(0.6);
    this.stopFling();
    this.gStop();
    this.busy = true;
    this.mode = "morph";
    this.mproj = pj;
    this.mcx = cx;
    this.mcy = cy;
    const step = (u) => {
      const e = d3.easeCubicInOut(u);
      mut(e);
      const g = toGlobe ? e : 1 - e;
      this.mGlobe = g;
      this.landA =
        u < 0.26 ? 1 - d3.easeCubicOut(u / 0.26) : u > 0.7 ? d3.easeCubicIn((u - 0.7) / 0.3) : 0;
      if (this.ghost) this.ghostA = 1 - d3.easeCubicOut(Math.min(1, u / 0.3));
      pj.clipAngle(g > 0.002 ? Math.min(179.5, 90 + 90 * (1 - g)) : null)
        .rotate([-centre[0], -centre[1] * g])
        .scale(Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * e))
        .translate([0, 0]);
      const q = pj(centre) || [0, 0];
      pj.translate([cx + (fx - cx) * e - q[0], cy + (fy - cy) * e - q[1]]);
      this.draw();
    };
    const fin = () => {
      this.mproj = null;
      this.busy = false;
      this.fadeAt = performance.now();
      this.landA = 1;
      this.geoLegend();
      if (toGlobe) {
        this.mode = "globe";
        this.gs = s1;
        this.gR0Last = this.gR0();
        this.gc = [centre[0], centre[1]];
        this.gtx = cx;
        this.gty = cy;
        this.gApply();
        this.cv.__zoom = d3.zoomIdentity.scale(100);
        this.moving = false;
        this.sched();
      } else {
        this.mode = "flat";
        this.build("110");
        this.recentre(centre, Math.max(1, s1 / this.s));
        setTimeout(() => {
          if (this.mode === "flat" && !this.busy) {
            this.build("50");
            this.sched();
          }
        }, 120);
      }
      done && done();
    };
    if (reduced()) {
      step(1);
      fin();
      return;
    }
    const dur = 1150;
    const tm = d3.timer((el) => {
      const u = Math.min(1, el / dur);
      step(u);
      if (u >= 1) {
        tm.stop();
        fin();
      }
    });
  },
});
