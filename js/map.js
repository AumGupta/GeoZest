"use strict";

const eeRaw = d3.geoEqualEarthRaw,
  mRaw = d3.geoMercatorRaw;
const TOP = (84 * Math.PI) / 180,
  BOT = (-80 * Math.PI) / 180;
function rawFor(t) {
  const merc = (l, p) => mRaw(l, Math.max(BOT, Math.min(TOP, p)));
  if (t <= 0) return eeRaw;
  if (t >= 1) {
    const f = (l, p) => merc(l, p);
    f.invert = (x, y) => mRaw.invert(x, y);
    return f;
  }
  return (l, p) => {
    const a = eeRaw(l, p),
      b = merc(l, p);
    return [a[0] * (1 - t) + b[0] * t * 0.86, a[1] * (1 - t) + b[1] * t * 0.86];
  };
}
const SMALL = 2600;
function clampLat(g, min) {
  const c = (a) => (typeof a[0] === "number" ? [a[0], Math.max(min, a[1])] : a.map(c));
  return { type: g.type, coordinates: c(g.coordinates) };
}
const groupBy = (arr, key) => {
  const m = new Map();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};
const F50 = groupBy(topojson.feature(G.topo, G.topo.objects.countries).features, (f) => f.id);
const F110 = groupBy(
  topojson.feature(G.topo110, G.topo110.objects.countries).features,
  (f) => f.id,
);
const G10 = groupBy(G.topo10.objects.countries.geometries, (g) => g.id);
for (const [id, geometry] of Object.entries(G.fix || {})) {
  const f = [{ type: "Feature", id, properties: {}, geometry }];
  F50.set(id, f);
  F110.set(id, f);
  G10.delete(id);
}
const RECS = [...new Set([...F50.keys(), ...G10.keys()])].map((id) => ({
  id,
  f50: F50.get(id),
  f110: F110.get(id),
  g10: G10.get(id),
  c: C.get(id),
}));

RECS.sort((a, b) => ((b.c && b.c.ar) || 1e9) - ((a.c && a.c.ar) || 1e9));
const RHIT = RECS.slice().reverse();
const RBY = new Map(RECS.map((r) => [r.id, r]));
const isDot = (id) => {
  const c = C.get(id);
  return !!c && (c.ar < SMALL || !F50.has(id));
};
const DOTS = G.countries.filter((c) => isDot(c.id) && c.ll);
const OUTLINED = new Set(["sel", "good", "bad", "target"]);

const M = {
  t: S.settings.proj === "merc" ? 1 : 0,
  k: 1,
  tr: d3.zoomIdentity,
  inset: { top: 0, right: 0, bottom: 0, left: 0 },
  labels: S.settings.labels !== false,
  force: null,
  pins: new Set(),
  dotSet: null,
  dim: false,
  state: new Map(),
  onClick: null,
  tipOn: true,
  busy: false,
  mix: 1,
  init() {
    window.__M = this;
    this.el = $("#map");
    this.cv = $("#cv");
    this.ctx = this.cv.getContext("2d");
    this.hctx = document.createElement("canvas").getContext("2d");
    this.mut = d3.geoProjectionMutator(rawFor);
    this.proj = this.mut(this.t);
    this.sel = d3.select(this.cv);
    this.zoom = d3
      .zoom()
      .scaleExtent([1, 30000])
      .clickDistance(6)
      .tapDistance(12)
      .constrain((t) => (this.mode === "flat" ? this.rubber(t) : t))
      .on("start", (e) => {
        if (this.mode === "globe") return this.gStart(e);
        if (this.mode !== "flat") return;
        if (e.sourceEvent) {
          this.stopFling();
          this.samples = [];
        }
      })
      .on("zoom", (e) => {
        if (this.mode === "globe") return this.gZoom(e);
        if (this.mode !== "flat") return;
        this.tr = e.transform;
        this.k = e.transform.k;
        if (e.sourceEvent) {
          const n = performance.now();
          this.samples.push([n, this.tr.x, this.tr.y, this.k]);
          while (this.samples.length && n - this.samples[0][0] > 120) this.samples.shift();
        }
        this.sched();
      })
      .on("end", (e) => {
        if (this.mode === "globe") return this.gEnd(e);
        if (this.mode !== "flat") return;
        if (e.sourceEvent && this.flingFrom()) return;
        this.settle();
      });
    this.sel.call(this.zoom);
    this.cv.addEventListener("click", (e) => {
      const r = this.cv.getBoundingClientRect();
      const id = this.hit(e.clientX - r.left, e.clientY - r.top);
      this.onClick && this.onClick(id, e);
    });
    const tip = $("#tip");
    let tipRaf = 0,
      last = null;
    this.cv.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || !this.tipOn) {
        tip.style.opacity = 0;
        return;
      }
      last = e;
      if (tipRaf) return;
      tipRaf = requestAnimationFrame(() => {
        tipRaf = 0;
        const r = this.cv.getBoundingClientRect();
        const id = this.hit(last.clientX - r.left, last.clientY - r.top);
        if (id && C.has(id)) {
          tip.textContent = C.get(id).n;
          tip.style.left = last.clientX + "px";
          tip.style.top = last.clientY + "px";
          tip.style.opacity = 1;
        } else tip.style.opacity = 0;
      });
    });
    this.cv.addEventListener("pointerleave", () => (tip.style.opacity = 0));
    this.palette(false);
    this.gproj = d3.geoOrthographic().clipAngle(90).precision(0.35);
    new ResizeObserver(() => this.resize()).observe(this.el);
    this.resize();
  },
  palette(redraw = true) {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    this.pal = {
      space2: v("--space2"),
      gocean: v("--gocean"),
      glight: v("--glight"),
      space: v("--space"),
      shadow: v("--gshadow"),
      rim: v("--grim"),
      rimLine: v("--grimline"),
      ocean: v("--ocean"),
      land: v("--land"),
      edge: v("--edge"),
      grat: v("--grat"),
      ink: v("--ink"),
      bg: v("--bg"),
      lbl: v("--lbl"),
      halo: v("--lbl-halo"),
      sea: v("--sea-text"),
      muted: v("--muted"),
      p: [0, 1, 2, 3, 4, 5].map((i) => v("--p" + i)),
      sel: v("--accent"),
      good: v("--green"),
      bad: v("--pink"),
      target: v("--cyan"),
      home: v("--yellow"),
      m1: v("--m1"),
      m2: v("--m2"),
      m3: v("--m3"),
      m4: v("--m4"),
      night: document.documentElement.classList.contains("night"),
    };
    const P = this.pal.p;
    this.pal.reg = {
      Africa: P[3],
      Americas: P[1],
      Asia: P[4],
      Europe: P[2],
      Oceania: P[5],
      Antarctic: this.pal.land,
    };
    this.mixCache = new Map();
    if (redraw) this.sched();
  },
  resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const keep = this.w ? this.centre() : null;
    this.w = r.width;
    this.h = r.height;
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.zoom.extent([
      [0, 0],
      [this.w, this.h],
    ]);
    this.fitBase();
    this.build("50");
    if (this.mode === "globe") {
      const wasR0 = !this.gs || Math.abs(this.gs - this.gR0Last) < 1;
      const a = this.avail();
      this.gtx = a.x + a.w / 2;
      this.gty = a.y + a.h / 2;
      if (wasR0) this.gs = this.gR0();
      this.gR0Last = this.gR0();
      this.gApply();
      this.cv.__zoom = d3.zoomIdentity.scale(100);
      this.sched();
      return;
    }
    if (keep) this.recentre(keep, this.k);
    else this.sched();
  },

  fitBase() {
    this.proj.scale(1).translate([0, 0]);
    const b = d3.geoPath(this.proj).bounds({ type: "Sphere" });
    const s = this.h / (b[1][1] - b[0][1]);
    this.proj.scale(s).translate([this.w / 2 - (s * (b[0][0] + b[1][0])) / 2, -s * b[0][1]]);
    this.P = s * (b[1][0] - b[0][0]);
    this.X0 = this.w / 2 - this.P / 2;
    this.s = s;
  },
  build(lod) {
    this.lod = lod;
    {
      const a = this.proj([0, 90]),
        b = this.proj([0, -90]);
      this.yExt = a && b && isFinite(a[1]) && isFinite(b[1]) ? [a[1], b[1]] : null;
    }
    const gp = d3.geoPath(this.proj).digits(2);
    for (const r of RECS) {
      r.p10 = null;
      r.b10 = null;
      let fs = lod === "110" ? r.f110 : r.f50;
      if (fs && r.id === "ATA" && this.t > 0.5)
        fs = fs.map((f) => ({
          type: "Feature",
          id: f.id,
          properties: {},
          geometry: clampLat(f.geometry, -80),
        }));
      if (fs) {
        const fc = { type: "FeatureCollection", features: fs };
        r.p = new Path2D(gp(fc) || "");
        r.b = gp.bounds(fc);
      } else {
        r.p = null;
        const c = r.c;
        if (c && c.ll) {
          const q = this.proj([c.ll[1], c.ll[0]]);
          r.b = q
            ? [
                [q[0] - 1, q[1] - 1],
                [q[0] + 1, q[1] + 1],
              ]
            : null;
        } else r.b = null;
      }
    }
    this.gratP = new Path2D(
      gp({
        type: "MultiLineString",
        coordinates: d3
          .geoGraticule()
          .lines()
          .filter((l) => l.coordinates[0][0] === l.coordinates[1][0])
          .map((l) => l.coordinates),
      }) || "",
    );
    this.parY = d3
      .range(-80, 81, 10)
      .map((la) => {
        const q = this.proj([0, la]);
        return q ? q[1] : NaN;
      })
      .filter(isFinite);
    if (lod === "50") this.placeLabels(gp);
    this.sched();
  },
  build10(r) {
    const gp = d3.geoPath(this.proj).digits(5);
    const geo = {
      type: "GeometryCollection",
      geometries: r.g10.map((g) => topojson.feature(G.topo10, g).geometry),
    };
    r.p10 = new Path2D(gp(geo) || "");
    r.b10 = gp.bounds(geo);
    if (!r.p) r.b = r.b10;
  },
  placeLabels(gp) {
    this.ld = [];
    for (const r of RECS) {
      const c = r.c;
      if (!c) continue;
      if (r.f50 && !isDot(r.id)) {
        let best = null,
          ba = -1;
        for (const f of r.f50) {
          const g = f.geometry;
          const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
          for (const poly of polys) {
            const a = d3.geoArea({ type: "Polygon", coordinates: poly });
            if (a > ba) {
              ba = a;
              best = poly;
            }
          }
        }
        const g = { type: "Polygon", coordinates: best };
        const ce = gp.centroid(g),
          b = gp.bounds(g);
        if (!r.lg) {
          const gc = d3.geoCentroid(g),
            gb = d3.geoBounds(g);
          const dl = (gb[1][0] - gb[0][0] + 360) % 360;
          r.lg = {
            lon: gc[0],
            lat: gc[1],
            aw: ((dl * Math.PI) / 180) * Math.cos((gc[1] * Math.PI) / 180),
            ah: ((gb[1][1] - gb[0][1]) * Math.PI) / 180,
          };
        }
        this.ld.push({
          id: r.id,
          n: c.n,
          x: ce[0],
          y: ce[1],
          w: b[1][0] - b[0][0],
          h: b[1][1] - b[0][1],
          pt: false,
          ...r.lg,
        });
      } else if (c.ll) {
        const q = this.proj([c.ll[1], c.ll[0]]);
        this.ld.push({
          id: r.id,
          n: c.n,
          x: q ? q[0] : NaN,
          y: q ? q[1] : NaN,
          w: 0,
          h: 0,
          pt: true,
          lon: c.ll[1],
          lat: c.ll[0],
          aw: 0,
          ah: 0,
        });
      }
    }
    this.ld.sort((a, b) => b.w * b.h - a.w * a.h);
    const P = (ll) => this.proj([ll[1], ll[0]]);
    this.cont = CONTINENTS.map(([n, ll]) => {
      const q = this.proj(ll);
      return { n, x: q ? q[0] : NaN, y: q ? q[1] : NaN, lon: ll[0], lat: ll[1] };
    });
    this.oce = OCEANS.map(([n, ll]) => {
      const q = this.proj(ll);
      return { n, x: q ? q[0] : NaN, y: q ? q[1] : NaN, lon: ll[0], lat: ll[1] };
    });
    this.dotPos = new Map(DOTS.map((c) => [c.id, P(c.ll)]));
    this.capPos = new Map(G.countries.filter((c) => c.cl).map((c) => [c.id, P(c.cl)]));
    this.dotIt = DOTS.map((c) => {
      const q = this.dotPos.get(c.id);
      return { id: c.id, x: q ? q[0] : NaN, y: q ? q[1] : NaN, lon: c.ll[1], lat: c.ll[0] };
    });
    this.capIt = new Map(
      G.countries
        .filter((c) => c.cl)
        .map((c) => {
          const q = this.capPos.get(c.id);
          return [c.id, { x: q ? q[0] : NaN, y: q ? q[1] : NaN, lon: c.cl[1], lat: c.cl[0] }];
        }),
    );
  },
  centre() {
    if (this.mode === "globe") return this.gc.slice();
    const a = this.avail();
    return this.proj.invert
      ? this.proj.invert([
          (a.x + a.w / 2 - this.tr.x) / this.k,
          (a.y + a.h / 2 - this.tr.y) / this.k,
        ])
      : null;
  },
  recentre(ll, k, dur = 0) {
    if (!ll || !isFinite(ll[0])) {
      this.sched();
      return;
    }
    const q = this.proj(ll);
    if (!q) return;
    const a = this.avail();
    const t = this.hard(
      d3.zoomIdentity.translate(a.x + a.w / 2 - q[0] * k, a.y + a.h / 2 - q[1] * k).scale(k),
    );
    (dur ? this.sel.transition().duration(dur) : this.sel).call(this.zoom.transform, t);
  },

  yBounds(k) {
    const pad = 0,
      e = this.yExt || [0, this.h];
    let lo = this.h - pad - e[1] * k,
      hi = pad - e[0] * k;
    if (lo > hi) lo = hi = (lo + hi) / 2;
    return [lo, hi];
  },
  rubber(t) {
    const [lo, hi] = this.yBounds(t.k);
    let y = t.y;
    const R = (d) => (1 - 1 / ((d * 0.55) / this.h + 1)) * this.h * 0.35;
    if (y > hi) y = hi + R(y - hi);
    else if (y < lo) y = lo - R(lo - y);
    return y === t.y ? t : d3.zoomIdentity.translate(t.x, y).scale(t.k);
  },
  hard(t) {
    const [lo, hi] = this.yBounds(t.k);
    const y = Math.min(hi, Math.max(lo, t.y));
    return y === t.y ? t : d3.zoomIdentity.translate(t.x, y).scale(t.k);
  },
  settle() {
    if (this.busy || this.flingT) return;
    const t = this.hard(this.tr);
    if (Math.abs(t.y - this.tr.y) > 0.5 && !this.sel.node().__transitioning) {
      this.sel
        .transition()
        .duration(reduced() ? 0 : 320)
        .ease(d3.easeCubicOut)
        .call(this.zoom.transform, t)
        .on("end", () => this.normalise());
    } else this.normalise();
  },

  flingFrom() {
    const s = this.samples || [];
    if (s.length < 2 || reduced()) return false;
    const a = s[0],
      b = s[s.length - 1];
    const dt = b[0] - a[0];
    if (dt < 16 || Math.abs(a[3] - b[3]) > 1e-6 * b[3]) return false;
    let vx = (b[1] - a[1]) / dt,
      vy = (b[2] - a[2]) / dt;
    if (Math.hypot(vx, vy) < 0.3) return false;
    const cap = 4;
    const sp = Math.hypot(vx, vy);
    if (sp > cap) {
      vx *= cap / sp;
      vy *= cap / sp;
    }
    let last = 0;
    this.stopFling();
    this.flingT = d3.timer((el) => {
      const dt = Math.min(32, el - last);
      last = el;
      const f = Math.exp(-dt / 320);
      vx *= f;
      vy *= f;
      const [lo, hi] = this.yBounds(this.k);
      if (this.tr.y > hi || this.tr.y < lo) vy *= 0.5;
      const t = d3.zoomIdentity.translate(this.tr.x + vx * dt, this.tr.y + vy * dt).scale(this.k);
      this.sel.call(this.zoom.transform, this.rubber(t));
      if (Math.hypot(vx, vy) < 0.02) {
        this.stopFling();
        this.settle();
      }
    });
    return true;
  },
  stopFling() {
    if (this.flingT) {
      this.flingT.stop();
      this.flingT = null;
    }
  },
  normalise() {
    if (this.busy) return;
    const Pk = this.P * this.k;
    const cx = (this.w / 2 - this.tr.x) / this.k;
    const n = Math.floor((cx - this.X0) / this.P);
    if (n !== 0 && !this.sel.node().__transitioning)
      this.sel.call(
        this.zoom.transform,
        d3.zoomIdentity.translate(this.tr.x + n * Pk, this.tr.y).scale(this.k),
      );
  },
  sched() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  },

  scaleBar() {
    const sig =
      this.mode === "globe"
        ? this.gs.toFixed(1) + "," + this.gc[0].toFixed(3) + "," + this.gc[1].toFixed(3)
        : this.mode +
          "," +
          this.k.toFixed(3) +
          "," +
          this.tr.x.toFixed(1) +
          "," +
          this.tr.y.toFixed(1);
    if (sig === this.lastSig || this.mode === "morph") return;
    const first = this.lastSig == null;
    this.lastSig = sig;
    if (first) return;
    const a = this.avail(),
      x = a.x + a.w / 2,
      y = a.y + a.h / 2,
      dx = 60;
    let p0, p1;
    try {
      if (this.mode === "globe") {
        p0 = this.gproj.invert([this.gtx, this.gty]);
        p1 = this.gproj.invert([this.gtx + Math.min(dx, this.gs * 0.5), this.gty]);
      } else if (this.proj.invert) {
        const b = (q) =>
          this.proj.invert([(q[0] - this.tr.x) / this.k, (q[1] - this.tr.y) / this.k]);
        p0 = b([x, y]);
        p1 = b([x + dx, y]);
      }
    } catch (e) {}
    if (!p0 || !p1) return;
    const span = this.mode === "globe" ? Math.min(dx, this.gs * 0.5) : dx;
    const mpp = (d3.geoDistance(p0, p1) * 6371008) / span;
    if (!isFinite(mpp) || mpp <= 0) return;
    const maxM = mpp * 110;
    const mi = S.settings.units === "mi";
    const big = mi ? (maxM >= 1609.344 ? 1609.344 : 0.3048) : maxM >= 1000 ? 1000 : 1,
      bigName = mi ? (big > 1 ? " mi" : " ft") : big > 1 ? " km" : " m";
    const maxU = maxM / big;
    const pow = Math.pow(10, Math.floor(Math.log10(maxU)));
    let nu = pow;
    for (const m of [1, 2, 5, 10]) if (m * pow <= maxU) nu = m * pow;
    const nice = nu * big;
    const px = nice / mpp;
    const km = true;
    const fmt = (v) => nf.format(Math.round((v / big) * 100) / 100);
    const el = $("#scale");
    el.querySelector(".sb-bar").style.width = px + "px";
    el.querySelector(".sb-l").style.width = px + "px";
    $("#sbMid").textContent = px >= 96 ? fmt(nice / 2) : "";
    $("#sbEnd").textContent = fmt(nice) + bigName;
    el.classList.add("on");
    clearTimeout(this.sbT);
    this.sbT = setTimeout(() => el.classList.remove("on"), 650);
  },
  countryMode() {
    return this.forceCountry || this.worldPx() > 2600;
  },
  hiRes() {
    return this.lod === "50" && this.P * this.k > 5200;
  },
  copies() {
    const Pk = this.P * this.k,
      left = this.X0 * this.k + this.tr.x;
    const out = [];
    for (let n = Math.floor(-left / Pk) - 0; n * Pk + left < this.w; n++)
      if ((n + 1) * Pk + left > 0) out.push(n);
    return out;
  },
  fillFor(id) {
    const p = this.pal,
      st = this.state.get(id);
    if (st) return p[st] || p.ink;
    if (this.dim || (this.focus && !this.focus.has(regionOf(id)))) return p.land;
    const ci = COLOR.get(id) ?? 0,
      reg = regionOf(id);
    if (this.mix >= 1) return p.p[ci];
    if (this.mix <= 0) return p.reg[reg];
    const key = id;
    let f = this.mixCache.get(key);
    if (!f) {
      f = d3.interpolateRgb(p.reg[reg], p.p[ci]);
      this.mixCache.set(key, f);
    }
    return f(this.mix);
  },
  draw() {
    queueMicrotask(() => {
      try {
        this.scaleBar();
      } catch (e) {}
    });
    if (this.mode === "globe") return this.gDraw();
    if (this.mode === "morph") return this.mDraw();
    const c = this.ctx,
      d = this.dpr,
      k = this.k,
      tx = this.tr.x,
      ty = this.tr.y,
      W = this.w,
      H = this.h,
      Pk = this.P * k,
      p = this.pal;

    const want = this.countryMode() ? 1 : 0;
    if (this.mix !== want) {
      this.mix += Math.sign(want - this.mix) * 0.12;
      if (Math.abs(this.mix - want) < 0.12) this.mix = want;
      else this.sched();
    }
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = p.ocean;
    c.fillRect(0, 0, W, H);
    const hi = this.hiRes();
    const deadline = performance.now() + 12;
    let pending = false;
    let pulse = false;
    const now = performance.now();
    const pa = 0.55 + 0.45 * Math.cos(now / 220);
    c.lineJoin = "round";
    c.beginPath();
    for (const y of this.parY || []) {
      const Y = Math.round((ty + y * k) * d) / d + 0.5 / d;
      if (Y < 0 || Y > H) continue;
      c.moveTo(0, Y);
      c.lineTo(W, Y);
    }
    c.lineWidth = 1;
    c.strokeStyle = p.grat;
    c.stroke();
    for (const n of this.copies()) {
      const ox = tx + n * Pk;
      c.setTransform(d * k, 0, 0, d * k, d * ox, d * ty);
      c.lineWidth = 1 / k;
      c.strokeStyle = p.grat;
      c.stroke(this.gratP);
      const vis = [];
      for (const r of RECS) {
        const b = r.b;
        if (!b) continue;
        if (
          b[1][0] * k + ox < 0 ||
          b[0][0] * k + ox > W ||
          b[1][1] * k + ty < 0 ||
          b[0][1] * k + ty > H
        )
          continue;
        let path = r.p;
        if (hi && r.g10) {
          if (!r.p10 && performance.now() < deadline) this.build10(r);
          if (r.p10) path = r.p10;
          else pending = true;
        }
        if (!path) continue;

        const sw = (b[1][0] - b[0][0]) * k;
        if (sw < 0.6) continue;
        vis.push([r, path]);
        const st = this.state.get(r.id);
        if (st === "target") {
          pulse = true;
          c.globalAlpha = pa;
        }
        c.fillStyle = this.fillFor(r.id);
        c.fill(path, "evenodd");
        if (this.mix < 1) {
          c.lineWidth = 0.8 / k;
          c.strokeStyle = c.fillStyle;
          c.stroke(path);
        }
        c.globalAlpha = 1;
      }
      if (this.mix > 0) {
        c.globalAlpha = this.mix;
        c.lineWidth = 0.8 / k;
        c.strokeStyle = p.edge;
        for (const [r, path] of vis) c.stroke(path);
        c.globalAlpha = 1;
      }
      c.lineWidth = 1.6 / k;
      c.strokeStyle = p.ink;
      for (const [r, path] of vis) if (OUTLINED.has(this.state.get(r.id))) c.stroke(path);
    }
    c.setTransform(d, 0, 0, d, 0, 0);

    let la = 1;
    if (this.busy) la = 0;
    else if (this.fadeAt) {
      la = Math.min(1, (now - this.fadeAt) / 380);
      if (la < 1) pending = true;
      else this.fadeAt = 0;
    }
    this.la = la;
    if (la > 0) {
      c.globalAlpha = la;
      this.drawDots();
      this.drawLabels();
      this.drawPins();
      c.globalAlpha = 1;
    }
    if (pending || pulse) this.sched();
  },
  screenXs(bx) {
    const Pk = this.P * this.k;
    const out = [];
    const base = bx * this.k + this.tr.x;
    const n0 = Math.ceil((-40 - base) / Pk),
      n1 = Math.floor((this.w + 40 - base) / Pk);
    for (let n = n0; n <= n1; n++) out.push(base + n * Pk);
    return out;
  },

  at(d) {
    if (this.mode === "globe") {
      if (!isFinite(d.lon) || d3.geoDistance([d.lon, d.lat], this.gc) > Math.PI / 2 - 0.04)
        return [];
      const q = this.gproj([d.lon, d.lat]);
      return q ? [this.geoAmt ? this.dpt(q[0], q[1], [d.lon, d.lat]) : q] : [];
    }
    if (!isFinite(d.x)) return [];
    const y = d.y * this.k + this.tr.y;
    return this.screenXs(d.x).map((x) => [x, y]);
  },

  span(d) {
    if (this.mode === "globe") {
      const f = Math.max(0.15, Math.cos(d3.geoDistance([d.lon, d.lat], this.gc)));
      return [d.aw * this.gs * f, d.ah * this.gs * f];
    }
    return [d.w * this.k, d.h * this.k];
  },
  worldPx() {
    return this.mode === "globe" ? this.gs * 2 * Math.PI : this.P * this.k;
  },
  flatMerc() {
    return this.mode !== "globe" && this.t > 0.5;
  },
  dotVisible(id) {
    if (this.dotSet && !this.dotSet.has(id)) return false;
    if (!this.dotSet && !this.countryMode()) return !!this.state.get(id);
    const r = RBY.get(id);
    if (this.mode === "globe")
      return !(r && r.gr && r.gr * 2 * this.gs > 14 && (r.f50 || this.gLod() === "10"));
    const b = r && (r.b10 || (r.f50 ? r.b : null));
    if (b && (b[1][0] - b[0][0]) * this.k > 12) return false;
    return true;
  },
  drawDots() {
    const c = this.ctx,
      p = this.pal;
    for (const d of this.dotIt) {
      if (!this.dotVisible(d.id)) continue;
      for (const [x, y] of this.at(d)) {
        if (y < -10 || y > this.h + 10) continue;
        c.beginPath();
        c.arc(x, y, 3.2, 0, 7);
        c.fillStyle = this.fillFor(d.id);
        c.fill();
        c.lineWidth = 0.9;
        c.strokeStyle = p.night ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)";
        c.stroke();
      }
    }
  },
  drawPins() {
    const c = this.ctx,
      p = this.pal;
    for (const id of this.pins) {
      const it = this.capIt.get(id);
      const cc = C.get(id);
      if (!it || !cc) continue;
      for (const [x, y] of this.at(it)) {
        c.beginPath();
        c.arc(x, y, 5, 0, 7);
        c.fillStyle = p.bg;
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = p.ink;
        c.stroke();
        c.beginPath();
        c.arc(x, y, 1.8, 0, 7);
        c.fillStyle = p.ink;
        c.fill();
        this.text(
          cc.cap[0],
          x + 9,
          y,
          12.5,
          500,
          "left",
          p.ink,
          p.night ? "rgba(0,0,0,.8)" : "rgba(255,255,255,.9)",
          0.78,
        );
      }
    }
  },
  text(s, x, y, fs, wt, align, fill, halo, alpha = 1, italic = false, spacing = 0) {
    const c = this.ctx;
    c.font = `${italic ? "italic " : ""}${wt} ${fs}px ${SANS}`;
    c.textAlign = align;
    c.textBaseline = "middle";
    if (spacing && "letterSpacing" in c) c.letterSpacing = spacing + "px";
    c.globalAlpha = alpha * (this.la ?? 1);
    c.lineJoin = "round";
    if (halo) {
      c.lineWidth = 3.2;
      c.strokeStyle = halo;
      c.strokeText(s, x, y);
    }
    c.fillStyle = fill;
    c.fillText(s, x, y);
    c.globalAlpha = this.la ?? 1;
    if (spacing && "letterSpacing" in c) c.letterSpacing = "0px";
  },
  drawLabels() {
    const c = this.ctx,
      p = this.pal,
      W = this.w,
      H = this.h,
      wp = this.worldPx();
    const placed = [];
    const hitBox = (b) =>
      placed.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
    const measure = (s, fs, wt) => {
      c.font = `${wt} ${fs}px ${SANS}`;
      return c.measureText(s).width;
    };

    const forced = this.force ? this.ld.filter((d) => this.force.has(d.id)) : [];

    const many = forced.length > 1;
    if (many)
      forced.sort(
        (a, b) =>
          (this.state.get(a.id) === "bad" ? 0 : 1) - (this.state.get(b.id) === "bad" ? 0 : 1) ||
          (C.get(b.id)?.a || 0) - (C.get(a.id)?.a || 0),
      );
    const lap = (b) =>
      placed.some((q) => {
        const ox = Math.min(b[2], q[2]) - Math.max(b[0], q[0]),
          oy = Math.min(b[3], q[3]) - Math.max(b[1], q[1]);
        return (
          ox > 0 &&
          oy > 0 &&
          ox * oy > 0.18 * Math.min((b[2] - b[0]) * (b[3] - b[1]), (q[2] - q[0]) * (q[3] - q[1]))
        );
      });
    const fsM = many ? Math.max(11, Math.min(15, 10 + this.k * 1.2)) : 15;
    for (const d of forced) {
      const fs = fsM,
        tw = measure(d.n, fs, 700),
        hh = fs * 0.72;
      for (const [x, y0] of this.at(d)) {
        let y = y0 + (d.pt ? fs : 0);
        let b = [x - tw / 2 - 3, y - hh, x + tw / 2 + 3, y + hh];
        if (many && lap(b)) {
          const alt = [y - hh * 2.3, y + hh * 2.3]
            .map((yy) => [x - tw / 2 - 3, yy - hh, x + tw / 2 + 3, yy + hh])
            .find((bb) => !lap(bb));
          if (!alt) continue;
          b = alt;
          y = (b[1] + b[3]) / 2;
        }
        placed.push(b);
        const onInk = this.state.get(d.id) === "sel" && !d.pt;
        this.text(
          d.n,
          x,
          y,
          fs,
          700,
          "center",
          onInk ? p.bg : p.ink,
          onInk ? p.ink : p.night ? "rgba(0,0,0,.85)" : "rgba(255,255,255,.92)",
        );
      }
    }
    for (const id of this.pins) {
      const it = this.capIt.get(id);
      if (!it) continue;
      for (const [x, y] of this.at(it))
        placed.push([x - 6, y - 8, x + 10 + measure(C.get(id).cap[0], 12.5, 500), y + 8]);
    }
    if (this.labels && this.mix < 0.5) {
      for (const d of this.cont) {
        if (d.n === "ANTARCTICA" && this.flatMerc()) continue;
        for (const [x, y] of this.at(d)) {
          if (y < 0 || y > H) continue;
          this.text(
            d.n,
            x,
            y,
            12.5,
            700,
            "center",
            p.night ? "#0A0A0A" : p.lbl,
            p.halo,
            0.85,
            false,
            2.6,
          );
        }
      }
    }
    if (this.labels && wp < 9000) {
      for (const d of this.oce) {
        if (d.n === "Southern Ocean" && this.flatMerc()) continue;
        for (const [x, y] of this.at(d)) {
          if (y < 0 || y > H) continue;
          const tw = measure(d.n, 11, 400) + d.n.length * 1.6;
          const b = [x - tw / 2, y - 8, x + tw / 2, y + 8];
          if (hitBox(b)) continue;
          placed.push(b);
          this.text(d.n, x, y, 11, 400, "center", p.sea, null, 1, true, 1.6);
        }
      }
    }
    if (!(this.labels && this.mix >= 0.5)) return;
    for (const d of this.ld) {
      if (this.force && this.force.has(d.id)) continue;
      let fs,
        wt = 600;
      if (d.pt) {
        if (wp < 14000 || (!this.dotVisible(d.id) && !this.state.get(d.id))) continue;
        fs = 11;
      } else {
        const [sw, sh] = this.span(d);
        fs = sw > 340 ? 14.5 : sw > 140 ? 13 : 11.5;
        const tw = measure(d.n, fs, wt);
        if (sw < tw * 0.8 || sh < fs * 1.15) continue;
      }
      const tw = measure(d.n, fs, wt);
      for (const [x, y0] of this.at(d)) {
        const y = y0 + (d.pt ? 12 : 0);
        if (y < -20 || y > H + 20 || x < -tw || x > W + tw) continue;
        const b = [x - tw / 2 - 3, y - fs * 0.65, x + tw / 2 + 3, y + fs * 0.65];
        if (hitBox(b)) continue;
        placed.push(b);
        const onSea = d.pt;
        this.text(
          d.n,
          x,
          y,
          fs,
          wt,
          "center",
          onSea ? (p.night ? "#FFFFFF" : p.lbl) : this.state.get(d.id) === "sel" ? p.bg : p.lbl,
          onSea ? (p.night ? "rgba(0,0,0,.85)" : p.halo) : p.halo,
        );
      }
    }
  },

  hit(sx, sy) {
    if (this.mode === "globe") return this.gHit(sx, sy);
    if (this.busy || !this.P) return null;
    const k = this.k;
    let bx = (sx - this.tr.x) / k;
    const by = (sy - this.tr.y) / k;
    bx = this.X0 + ((((bx - this.X0) % this.P) + this.P) % this.P);

    let best = null,
      bd = 1e9;
    for (const cc of DOTS) {
      if (!this.dotVisible(cc.id)) continue;
      const q = this.dotPos.get(cc.id);
      if (!q) continue;
      let dx = q[0] - bx;
      dx -= Math.round(dx / this.P) * this.P;
      const dd = Math.hypot(dx * k, (q[1] - by) * k);
      if (dd < 16 && dd < bd) {
        bd = dd;
        best = cc.id;
      }
    }
    if (best) return best;
    const hi = this.hiRes();
    for (const r of RHIT) {
      if (!(r.c || r.id === "ATA") || !r.b) continue;
      const b = r.b10 || r.b;
      if (bx < b[0][0] || bx > b[1][0] || by < b[0][1] || by > b[1][1]) continue;
      const path = (hi && r.p10) || r.p || r.p10;
      if (path && this.hctx.isPointInPath(path, bx, by, "evenodd")) return r.id;
    }
    return null;
  },
  current() {
    return this.mode === "globe"
      ? this.geoAmt > 0.5
        ? "geoid"
        : "globe"
      : this.t >= 1
        ? "merc"
        : "ee";
  },
  setProjection(name, done) {
    const cur = this.current();
    if (name === cur || this.busy) return;
    if (name === "geoid") {
      if (cur === "globe") return this.setGeoid(true, done);
      return this.morph(cur, "globe", () => this.setGeoid(true, done));
    }
    if (cur === "geoid") {
      if (name === "globe") return this.setGeoid(false, done);
      if (reduced()) {
        this.geoAmt = 0;
        this.geoLegend();
        return this.morph("globe", name, done);
      }
      this.ghost = this.snap();
      this.ghostA = 1;
      this.geoAmt = 0;
      this.geoLegend();
      return this.morph("globe", name, () => {
        this.ghost = null;
        done && done();
      });
    }
    if (name === "globe" || cur === "globe") {
      this.morph(cur, name, done);
      return;
    }
    const target = name === "merc" ? 1 : 0;
    const centre = this.centre(),
      k = this.k,
      from = this.t;
    this.stopFling();
    this.busy = true;
    const fin = () => {
      this.t = target;
      this.mut(target);
      this.fitBase();
      this.build("50");
      this.busy = false;
      this.fadeAt = performance.now();
      this.recentre(centre, k);
      done && done();
    };
    if (reduced()) {
      fin();
      return;
    }
    const dur = 900,
      ease = d3.easeCubicInOut;
    const tm = d3.timer((el) => {
      const q = Math.min(1, el / dur);
      this.t = from + (target - from) * ease(q);
      this.mut(this.t);
      this.fitBase();
      this.build("110");

      if (centre && isFinite(centre[0])) {
        const pt = this.proj(centre);
        if (pt) {
          const a = this.avail();
          this.tr = d3.zoomIdentity
            .translate(
              a.x + a.w / 2 - pt[0] * k,
              Math.min(0, Math.max(this.h - this.h * k, a.y + a.h / 2 - pt[1] * k)),
            )
            .scale(k);
          this.cv.__zoom = this.tr;
        }
      }
      this.draw();
      if (q >= 1) {
        tm.stop();
        fin();
      }
    });
  },
  avail() {
    const i = this.inset;
    return {
      x: i.left,
      y: i.top,
      w: Math.max(80, this.w - i.left - i.right),
      h: Math.max(80, this.h - i.top - i.bottom),
    };
  },
  capK() {
    return 6000 / ((this.s * Math.PI) / 180);
  },
  toBounds(b, maxK = 10, fill = 0.5, dur = 800) {
    if (!b || !this.P) return;
    const [[x0, y0], [x1, y1]] = b;
    const a = this.avail();
    const k = Math.max(
      1,
      Math.min(maxK, this.capK(), fill / Math.max((x1 - x0) / a.w, (y1 - y0) / a.h, 1e-9)),
    );

    const cur = (a.x + a.w / 2 - this.tr.x) / this.k;
    let cx = (x0 + x1) / 2;
    cx += Math.round((cur - cx) / this.P) * this.P;
    const t = this.hard(
      d3.zoomIdentity
        .translate(a.x + a.w / 2 - k * cx, a.y + a.h / 2 - (k * (y0 + y1)) / 2)
        .scale(k),
    );
    this.stopFling();
    if (dur && !reduced()) {
      const tr = this.sel.transition().duration(dur).ease(d3.easeCubicInOut);
      const node = this.sel.node();
      node.__transitioning = true;
      tr.on("end interrupt", () => {
        node.__transitioning = false;
      });
      tr.call(this.zoom.transform, t);
    } else this.sel.call(this.zoom.transform, t);
  },
  boundsOf(id) {
    const r = RBY.get(id),
      c = C.get(id);
    if (r && r.f50 && !isDot(id)) {
      const gp = d3.geoPath(this.proj);
      const parts = [];
      for (const f of r.f50) {
        const g = f.geometry;
        const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
        for (const poly of polys)
          parts.push({ poly, a: d3.geoArea({ type: "Polygon", coordinates: poly }) });
      }
      parts.sort((a, b) => b.a - a.a);
      const keep = parts.filter((x) => x.a > parts[0].a * 0.08).map((x) => x.poly);
      const b = gp.bounds({ type: "MultiPolygon", coordinates: keep });
      if (b[1][0] - b[0][0] < this.P * 0.5) return b;
    }
    if (r && r.g10) {
      if (!r.p10) this.build10(r);
      const b = r.b10;
      if (b && b[1][0] - b[0][0] < this.P * 0.5) return b;
    }
    if (r && r.f50) {
      const b = d3.geoPath(this.proj).bounds({ type: "FeatureCollection", features: r.f50 });
      if (b && isFinite(b[0][0]) && b[1][0] - b[0][0] < this.P * 0.5) return b;
    }
    if (c && c.ll) {
      const q = this.proj([c.ll[1], c.ll[0]]);
      if (q)
        return [
          [q[0] - 2, q[1] - 2],
          [q[0] + 2, q[1] + 2],
        ];
    }
    return null;
  },
  union(bs) {
    bs = bs.filter(Boolean);
    if (!bs.length) return null;
    const P = this.P;
    const ref = (bs[0][0][0] + bs[0][1][0]) / 2;
    bs = bs.map((b) => {
      const cx = (b[0][0] + b[1][0]) / 2;
      const s = Math.round((ref - cx) / P) * P;
      return [
        [b[0][0] + s, b[0][1]],
        [b[1][0] + s, b[1][1]],
      ];
    });
    return [
      [d3.min(bs, (b) => b[0][0]), d3.min(bs, (b) => b[0][1])],
      [d3.max(bs, (b) => b[1][0]), d3.max(bs, (b) => b[1][1])],
    ];
  },
  toId(id, fill = 0.7, dur) {
    if (this.mode === "globe") return this.gToId(id, fill, dur);
    this.toBounds(this.boundsOf(id), Infinity, fill, dur);
  },
  toIds(ids, fill = 0.8, dur) {
    if (this.mode === "globe") return this.gToIds(ids, fill, dur);
    this.toBounds(this.union(ids.map((i) => this.boundsOf(i))), Infinity, fill, dur);
  },
  toRegion(r, dur = 800) {
    const RB = regionBox(r);
    if (!RB) {
      this.world(dur);
      return;
    }
    if (this.mode === "globe") return this.gToRegion(r, dur);
    const [[a, b], [c, d]] = RB;
    const pts = [];
    for (let i = 0; i <= 8; i++)
      for (let j = 0; j <= 8; j++)
        pts.push(this.proj([a + ((c - a) * i) / 8, b + ((d - b) * j) / 8]));
    const P = pts.filter(Boolean);
    this.toBounds(
      [
        [d3.min(P, (p) => p[0]), d3.min(P, (p) => p[1])],
        [d3.max(P, (p) => p[0]), d3.max(P, (p) => p[1])],
      ],
      60,
      0.98,
      dur,
    );
  },
  world(dur = 800) {
    if (this.mode === "globe") return this.gWorld(dur);
    const c = HOME && C.get(HOME);
    this.recentre([c ? c.ll[1] : 10, 0], 1, dur && !reduced() ? dur : 0);
  },
  zoomBy(f) {
    if (this.mode === "globe") return this.gFlyTo(this.gc, this.gs * f, 300);
    this.sel.transition().duration(300).call(this.zoom.scaleBy, f);
  },
  cls(id, c, on = true) {
    if (on) this.state.set(id, c);
    else if (this.state.get(id) === c) this.state.delete(id);
    this.sched();
  },
  clear(list) {
    if (!list) this.state.clear();
    else for (const [id, s] of [...this.state]) if (list.includes(s)) this.state.delete(id);
    this.sched();
  },
  showLabels(ids) {
    this.force = ids && ids.length ? new Set(ids) : null;
    this.sched();
  },
  setPins(ids) {
    this.pins = new Set((ids || []).filter((id) => C.get(id) && C.get(id).cl));
    this.sched();
  },
  only(set) {
    this.dotSet = set;
    this.sched();
  },
};
