"use strict";

function weightedOrder(P, mode, rng) {
  return P.map((c) => {
    const r = rec(mode, c.id);
    const w = r ? (r.l === 1 ? 0.6 : 3 + r.w * 0.5) : 2;
    return { c, k: Math.pow(rng(), 1 / w) };
  })
    .sort((a, b) => b.k - a.k)
    .map((x) => x.c);
}
function distract(c, P, rng, ok, label) {
  const seen = new Set([label(c)]);
  const out = [];
  for (const t of [
    P.filter((x) => x.sr === c.sr),
    P.filter((x) => x.r === c.r),
    P,
    c.st ? [] : sovereign,
  ]) {
    for (const x of shuffle(t, rng)) {
      if (out.length >= 3) break;
      if (x.id === c.id || !ok(x)) continue;
      const lb = label(x);
      if (seen.has(lb)) continue;
      seen.add(lb);
      out.push(x);
    }
    if (out.length >= 3) break;
  }
  return out;
}

const LEAK_STOP = new Set([
  "republic",
  "democratic",
  "people",
  "peoples",
  "federal",
  "federated",
  "kingdom",
  "islands",
  "island",
  "saint",
  "city",
  "state",
  "states",
]);
const leakWords = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !LEAK_STOP.has(w));
const leakKeys = (c) =>
  c.__lk || (c.__lk = new Set([...leakWords(c.n), ...leakWords(c.dm)].map((w) => w.slice(0, 4))));
function leak(text, c) {
  const k = leakKeys(c);
  return leakWords(text).some((w) => k.has(w.slice(0, 4)));
}
const REAL_CUR = new Set(G.countries.flatMap((c) => c.cur.map((x) => x[1].toLowerCase())));
const unitOf = (n) => {
  const w = n.trim().split(/\s+/);
  return w.length > 1 ? w[w.length - 1] : null;
};

function fakeCurrencies(c, P, rng) {
  const ans = c.cur[0][1],
    sp = ans.lastIndexOf(" ");
  if (sp < 0) return null;
  const pre = ans.slice(0, sp),
    own = new Set(c.cur.map((x) => (unitOf(x[1]) || "").toLowerCase()));
  const out = [],
    seen = new Set();
  for (const t of [P.filter((x) => x.sr === c.sr), P.filter((x) => x.r === c.r), G.countries]) {
    for (const x of shuffle(t, rng)) {
      if (out.length >= 3) break;
      for (const y of x.cur) {
        const u = unitOf(y[1]);
        if (!u) continue;
        const ul = u.toLowerCase();
        if (own.has(ul) || seen.has(ul)) continue;
        const f = pre + " " + u;
        if (REAL_CUR.has(f.toLowerCase())) continue;
        seen.add(ul);
        out.push(f);
        break;
      }
    }
    if (out.length >= 3) break;
  }
  return out.length === 3 ? out : null;
}
function makeQ(mode, c, P, rng) {
  const q = { mode, id: c.id, kind: "mc", ans: c.id };
  const nm = (x) => x.n;
  const opts = (a, ds, lab, f) => shuffle([a, ...ds], rng).map((x) => ({ id: x.id, t: lab(x), f }));
  if (mode === "locate") {
    q.kind = "map";
    return q;
  }
  if (mode === "identify") {
    q.title = c.st ? SUBS[c.st].q : "Which country is this?";
    q.hint = "target";
    q.opts = opts(
      c,
      distract(c, P, rng, () => true, nm),
      nm,
    );
    return q;
  }
  if (mode === "flags") {
    q.title = "Whose flag?";
    q.flag = "big";
    q.opts = opts(
      c,
      distract(c, P, rng, (x) => !!G.flags[x.a2], nm),
      nm,
    );
    return q;
  }
  if (mode === "capitals") {
    if (c.cap.some((x) => leak(x, c))) return null;
    q.title = `Capital of ${esc(c.n)}?`;
    q.flag = "sm";
    q.hint = "sel";
    q.opts = opts(
      c,
      distract(
        c,
        P,
        rng,
        (x) => x.cap.length && !c.cap.includes(x.cap[0]) && !leak(x.cap[0], x),
        (x) => x.cap[0],
      ),
      (x) => x.cap[0],
    );
    return q;
  }
  if (mode === "currencies") {
    const mine = new Set(c.cur.map((x) => x[1]));
    q.title = `Currency of ${esc(c.n)}?`;
    q.flag = "sm";
    q.hint = "sel";
    if (leak(c.cur[0][1], c)) {
      const fk = fakeCurrencies(c, P, rng);
      if (fk) {
        q.opts = shuffle(
          [{ id: c.id, t: c.cur[0][1] }, ...fk.map((t, k) => ({ id: "~" + k, t }))],
          rng,
        );
        return q;
      }
    }

    q.opts = opts(
      c,
      distract(
        c,
        P,
        rng,
        (x) =>
          x.cur.length &&
          !x.cur.some((y) => mine.has(y[1])) &&
          (leak(c.cur[0][1], c) || !leak(x.cur[0][1], x)),
        (x) => x.cur[0][1],
      ),
      (x) => x.cur[0][1],
    );
    return q;
  }
  if (mode === "languages") {
    const free = (l) => sovereign.filter((x) => !x.l.includes(l)).length > 3;
    let t = c,
      L = shuffle(c.l, rng).find((l) => free(l) && !leak(l, c));

    if (!L)
      for (const l of shuffle(c.l, rng)) {
        if (!free(l)) continue;
        const alt = shuffle(
          P.filter((x) => x.id !== c.id && x.l.includes(l) && !leak(l, x)),
          rng,
        )[0];
        if (alt) {
          t = alt;
          L = l;
          break;
        }
      }
    if (!L) return null;
    q.id = t.id;
    q.ans = t.id;
    q.lang = L;
    q.title = `Where is ${esc(L)} official?`;
    q.opts = opts(
      t,
      distract(t, P, rng, (x) => x.l.length && !x.l.includes(L) && !leak(L, x), nm),
      nm,
      true,
    );
    return q;
  }
  if (mode === "neighbours") {
    const bs = c.b.filter((x) => C.has(x)),
      fair = bs.filter((x) => !leak(C.get(x).n, c) && !leak(c.n, C.get(x)));
    if (!fair.length) return null;
    const N = C.get(pick(fair, rng));
    q.title = `Which borders ${esc(c.n)}?`;
    q.hint = "sel";
    q.ans = N.id;
    const ds = distract(
      c,
      P,
      rng,
      (x) => x.id !== N.id && !c.b.includes(x.id) && !leak(x.n, c),
      nm,
    );
    q.opts = shuffle([N, ...ds], rng).map((x) => ({ id: x.id, t: x.n, f: true }));
    return q;
  }
}
function buildQuestions(mode, region, n, rng) {
  const qs = [];
  if (mode === "mixed") {
    const used = new Set(),
      ms = SKILLS.filter((m) => poolFor(m, region).length >= 4);
    if (!ms.length) return qs;
    for (let i = 0; i < n; i++) {
      const m = ms[i % ms.length];
      const P = poolFor(m, region);
      let q = null;
      for (const c of weightedOrder(P, m, rng)) {
        if (used.has(c.id)) continue;
        q = makeQ(m, c, P, rng);
        if (q) {
          used.add(c.id);
          used.add(q.id);
          break;
        }
      }
      if (q) qs.push(q);
    }
    return shuffle(qs, rng);
  }
  const P = poolFor(mode, region);
  const used = new Set();
  for (const c of weightedOrder(P, mode, rng)) {
    if (qs.length >= n) break;
    if (used.has(c.id)) continue;
    const q = makeQ(mode, c, P, rng);
    if (q && !used.has(q.id)) {
      used.add(c.id);
      used.add(q.id);
      qs.push(q);
    }
  }
  return qs;
}

let Q = null,
  raf = 0;
const QL = $("#quizLayer");
function quizDots() {
  const sb = Q && subOf(Q.region);
  return new Set(sb ? SUBS[sb].ids : G.countries.filter(inPlay).map((c) => c.id));
}
function startQuiz(o) {
  const sb = subOf(o.region);
  if (sb && SUBS[sb] && !SUBS[sb].ready) {
    ensureSub(sb).then((ok) => ok && startQuiz(o));
    return;
  }
  return startQuiz0(o);
}
function startQuiz0({ mode, region, n, timer, daily = false, questions }) {
  const qs = questions || buildQuestions(mode, region, n, Math.random);
  if (!qs.length) {
    toast("Too few places in this mix, add a region");
    return;
  }
  sheetClose();
  deselect();
  coverage(false);
  cancelAnimationFrame(raf);
  M.sub = subOf(region);
  M.focus =
    region && region !== "World" && !M.sub
      ? new Set(region === "Islands" ? ["Islands"] : region.split(","))
      : null;
  Q = {
    mode,
    region,
    timer,
    daily,
    qs,
    i: 0,
    score: 0,
    correct: 0,
    streak: 0,
    maxStreak: 0,
    log: [],
    lv0: lvlInfo(S.xp).n,
    answered: false,
  };
  document.body.classList.add("quiz");
  M.forceCountry = true;
  M.tipOn = false;
  M.labels = false;
  M.only(quizDots());
  M.showLabels(null);
  M.setPins([]);
  M.onClick = guessMap;
  renderQ();
}
const DAILY_N = 6,
  DAILY_XP = 50;
const DAILY_DO = {
  locate: "Find 6 countries on the map",
  identify: "Name 6 highlighted countries",
  capitals: "Name 6 capitals",
  flags: "Recognise 6 flags",
  languages: "Place 6 languages",
  currencies: "Match 6 currencies",
  neighbours: "Find 6 neighbors",
};
function dailyTask() {
  const rng = rngFrom(hash("daily2" + todayKey()));
  const mode = pick(SKILLS, rng);
  let region = rng() < 0.4 ? "World" : pick(REGIONS, rng);
  let P = sovereign.filter((c) => MODES[mode].ok(c) && (region === "World" || c.r === region));
  if (P.length < 15) {
    region = "World";
    P = sovereign.filter(MODES[mode].ok);
  }
  return {
    mode,
    region,
    P,
    rng,
    text: DAILY_DO[mode],
    where: region === "World" ? "Worldwide" : `In ${region}`,
  };
}
function startDaily() {
  const t = dailyTask();
  const used = new Set(),
    qs = [];
  for (let k = 0; k < 300 && qs.length < DAILY_N; k++) {
    const c = pick(t.P, t.rng);
    if (used.has(c.id)) continue;
    const q = makeQ(t.mode, c, t.P, t.rng);
    if (q && !used.has(q.id)) {
      used.add(q.id);
      used.add(c.id);
      qs.push(q);
    }
  }
  startQuiz({
    mode: t.mode,
    region: t.region,
    n: qs.length,
    timer: true,
    daily: true,
    questions: qs,
  });
}
function endQuiz() {
  cancelAnimationFrame(raf);
  Q = null;
  QL.innerHTML = "";
  M.focus = null;
  M.sub = null;
  document.body.classList.remove("results");
  document.body.classList.remove("quiz");
  M.forceCountry = false;
  M.tipOn = true;
  M.labels = S.settings.labels !== false;
  M.dim = false;
  M.clear();
  M.only(null);
  M.showLabels(null);
  M.setPins([]);
  M.onClick = exploreClick;
  M.inset = { top: 0, right: 0, bottom: 0, left: 0 };
  renderChrome();

  if (M.mode === "globe" || !HOME) M.world(1000);
  else M.toId(HOME, isPhone() ? 0.28 : 0.3, 1000);
}
const pad2 = (n) => String(n).padStart(2, "0");
function hud() {
  return `<div class="hud" role="status"><button class="x" id="qx" aria-label="End quiz">${I.x}</button><span>${pad2(Q.i + 1)}/${pad2(Q.qs.length)}</span><span class="hxp" id="qs">${nf.format(Q.score)}<small>xp</small></span><span class="stk ${Q.streak ? "" : "zero"}" id="qk">${I.flame}${Q.streak}</span>${Q.timer ? `<span class="tbox" id="qtc" role="timer" aria-label="Seconds left"><svg viewBox="0 0 34 34" aria-hidden="true"><path class="tr" d="M17 1.25H23A9.75 9.75 0 0 1 32.75 11V23A9.75 9.75 0 0 1 23 32.75H11A9.75 9.75 0 0 1 1.25 23V11A9.75 9.75 0 0 1 11 1.25Z" pathLength="100"/><path class="pr" d="M17 1.25H23A9.75 9.75 0 0 1 32.75 11V23A9.75 9.75 0 0 1 23 32.75H11A9.75 9.75 0 0 1 1.25 23V11A9.75 9.75 0 0 1 11 1.25Z" pathLength="100" style="stroke-dasharray:100 100"/></svg><b id="qt">${Q.qs[Q.i].kind === "map" ? 20 : 15}</b></span>` : ""}</div>`;
}
function timerGo(sec) {
  cancelAnimationFrame(raf);
  const t0 = performance.now();
  Q.t0 = t0;
  Q.dur = Q.timer ? sec * 1000 : 0;
  Q.limit = sec;
  if (!Q.timer) return;
  const chip = $("#qtc"),
    ring = chip && chip.querySelector(".pr"),
    lab = $("#qt");
  const me = Q;
  let lastS = -1;
  const tick = (now) => {
    if (Q !== me || Q.answered) return;
    const el = now - t0,
      left = Math.max(0, Q.dur - el);
    if (ring) ring.style.strokeDasharray = `${((left / Q.dur) * 100).toFixed(2)} 100`;
    const s2 = Math.ceil(left / 1000);
    if (s2 !== lastS) {
      lastS = s2;
      if (lab) lab.textContent = s2;
      const low = s2 <= 5;
      chip.classList.toggle("low", low);
      if (low && s2 > 0) SND.play("tick");
    }
    if (left <= 0) {
      timeout();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function pauseTimer() {
  cancelAnimationFrame(raf);
  Q.took = Math.min((performance.now() - Q.t0) / 1000, Q.timer ? Q.limit : 1e9);
  const c = $("#qtc");
  if (c) {
    c.classList.remove("low");
    c.classList.add("done");
  }
}
function regionView() {
  Q.region !== "World" ? M.toRegion(Q.region, 700) : M.world(700);
}
const panelGap = () => (isPhone() ? 8 : 28);
function renderQ() {
  const q = Q.qs[Q.i];
  const c = C.get(q.id);
  Q.answered = false;
  M.clear();
  M.dim = false;
  M.only(quizDots());
  M.showLabels(null);
  M.setPins([]);
  if (q.kind === "map") {
    QL.innerHTML =
      hud() + `<div class="ask-top"><span class="cap">Find</span><b>${esc(c.n)}</b></div>`;
    M.inset = { top: 140, right: 0, bottom: 0, left: 0 };
    regionView();
    timerGo(20);
  } else {
    const head =
      q.flag === "big"
        ? `<div class="qh col"><button class="flagbtn" data-flag="${c.id}" data-anon="1" aria-label="Enlarge the flag">${flag(c)}</button><p class="q">${q.title}</p></div>`
        : `<div class="qh">${q.flag === "sm" ? flag(c) : ""}<p class="q">${q.title}</p></div>`;
    QL.innerHTML =
      hud() +
      `<div class="qp" id="qp">${head}<div class="opts">${q.opts.map((o) => `<button class="opt" data-id="${o.id}">${o.f ? flag(C.get(o.id)) : ""}<span class="t">${esc(o.t)}</span></button>`).join("")}</div></div>`;
    $$(".opt").forEach((b) => (b.onclick = () => answer(b.dataset.id)));
    requestAnimationFrame(() => {
      if (!Q) return;
      M.inset = { top: 64, right: 0, bottom: $("#qp").offsetHeight + panelGap(), left: 0 };
      if (q.hint === "target") {
        M.only(new Set([q.id]));
        M.cls(q.id, "target");
        M.toId(q.id, 0.55, 900);
      } else if (q.hint === "sel") {
        M.cls(q.id, "sel");
        M.toId(q.id, 0.6, 900);
      } else regionView();
    });
    timerGo(15);
  }
  $("#qx").onclick = endQuiz;
}
function pts(ok) {
  if (!ok) return 0;
  let p = 10;
  if (Q.timer && Q.dur) p += 5 * Math.max(0, 1 - (performance.now() - Q.t0) / Q.dur);
  return Math.round(p * (1 + Math.min(Q.streak, 10) * 0.1));
}
function record(mode, id, ok) {
  S.prog[mode] = S.prog[mode] || {};
  const r = S.prog[mode][id] || { c: 0, w: 0, l: 0 };
  ok ? r.c++ : r.w++;
  r.l = ok ? 1 : 0;
  S.prog[mode][id] = r;
  S.tot.a++;
  if (ok) S.tot.c++;
}
function settle(ok, q, picked) {
  pauseTimer();
  Q.answered = true;
  const p = pts(ok);
  if (ok) {
    Q.streak++;
    Q.correct++;
    Q.maxStreak = Math.max(Q.maxStreak, Q.streak);
    S.run = (S.run || 0) + 1;
    S.best = Math.max(S.best, S.run);
  } else {
    Q.streak = 0;
    S.run = 0;
  }
  Q.score += p;
  record(q.mode, q.id, ok);
  Q.log.push({ q, ok, picked });
  save();
  SND.play(ok ? "good" : "bad");
  $("#qs").innerHTML = nf.format(Q.score) + "<small>xp</small>";
  const k = $("#qk");
  k.innerHTML = I.flame + Q.streak;
  k.classList.toggle("zero", !Q.streak);

  M.clear();
  M.dim = true;
  M.only(quizDots());
  const frame = [q.ans];
  M.cls(q.ans, "good");
  const lbl = [q.ans];
  if (q.mode === "neighbours") {
    M.cls(q.id, "sel");
    frame.push(q.id);
    lbl.push(q.id);
  }
  if (!ok && picked && C.has(picked) && picked !== q.ans) {
    M.cls(picked, "bad");
    lbl.push(picked);
  }
  M.showLabels(lbl);
  M.setPins([q.ans]);
  return { p, frame };
}
function statusChip(ok, q, p, picked, timedOut) {
  let msg;
  if (ok)
    msg = `Correct${Q.timer ? ` in ${Q.took.toFixed(1)}s` : ""} <span class="pts">+${p} xp</span>`;
  else if (timedOut) msg = "Time's up";
  else {
    const P = C.get(picked);
    const o = q.opts && q.opts.find((x) => x.id === picked);
    msg =
      q.kind === "map"
        ? `You tapped ${esc(P ? P.n : "the sea")}`
        : `You chose ${esc(o ? o.t : "")}${o && P && o.t !== P.n ? ` (${esc(P.n)})` : ""}`;
  }
  return `<div class="stchip" role="status"><i class="${ok ? "good" : "bad"}"></i><span>${msg}</span></div>`;
}
function extraRow(q) {
  const c = C.get(q.ans);
  if (q.mode === "currencies")
    return `<div class="full"><div class="k">Currency</div><div class="v">${esc(c.cur.map((x) => x[1] + " " + x[0] + (x[2] ? " " + x[2] : "")).join(", "))}</div></div>`;
  if (q.mode === "neighbours")
    return `<div class="full"><div class="k">Neighbour of</div><div class="v">${esc(C.get(q.id).n)}</div></div>`;
  return "";
}
function showInfo(ok, q, p, picked, frame, timedOut) {
  const at = $(".ask-top");
  at && at.remove();
  QL.insertAdjacentHTML("beforeend", statusChip(ok, q, p, picked, timedOut));
  let qp = $("#qp");
  if (!qp) {
    qp = document.createElement("div");
    qp.className = "qp";
    qp.id = "qp";
    QL.appendChild(qp);
  }
  const c = C.get(q.ans);
  qp.className = "qp drawer";
  qp.innerHTML = `<div class="qgrab" aria-hidden="true"><div class="grab"></div></div><div data-peek-end>${countryBlock(c, { right: `<button class="btn" id="nx">${Q.i + 1 < Q.qs.length ? "Next" : "Results"}</button>`, extra: extraRow(q) })}</div>${detailRows(c)}`;
  $$("[data-nb]", qp).forEach(
    (b) =>
      (b.onclick = () => {
        M.setPins([b.dataset.nb]);
        M.toId(b.dataset.nb, 0.7, 800);
      }),
  );
  drawer(qp);
  $("#nx").onclick = next;
  $("#nx").focus({ preventScroll: true });
  requestAnimationFrame(() => {
    const el = $("#qp");
    if (!el) return;
    M.inset = { top: 118, right: 0, bottom: el.offsetHeight + panelGap(), left: 0 };
    M.toIds(frame, 0.82, 900);
  });
}
function drawer(el) {
  const pe = el.querySelector("[data-peek-end]");
  let full = false,
    y0 = null,
    moved = false;
  const maxH = () => Math.min(el.scrollHeight, innerHeight - (isPhone() ? 100 : 120));
  const peekH = () =>
    Math.min(
      maxH(),
      pe.offsetTop + pe.offsetHeight + parseFloat(getComputedStyle(el).paddingBottom),
    );
  const set = (f) => {
    full = f;
    el.classList.toggle("full", f);
    if (!f) el.scrollTop = 0;
    el.style.height = (f ? maxH() : peekH()) + "px";
  };
  el._fit = () => {
    el.classList.toggle("nomore", peekH() >= maxH() - 2);
    set(full);
  };
  el._fit();
  el.onpointerdown = (e) => {
    const g = e.target.closest(".qgrab");
    if (!g && (full || e.target.closest("button,a"))) return;
    y0 = e.clientY;
    moved = false;
  };
  el.onpointermove = (e) => {
    if (y0 !== null && Math.abs(e.clientY - y0) > 6) moved = true;
  };
  el.onpointerup = (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    y0 = null;
    if (!moved) {
      if (e.target.closest(".qgrab")) set(!full);
      return;
    }
    if (dy < -24 && !full) set(true);
    else if (dy > 24 && full) set(false);
  };
  el.onpointercancel = () => {
    y0 = null;
  };
  el.addEventListener(
    "wheel",
    (e) => {
      if (!full && e.deltaY > 0) {
        e.preventDefault();
        set(true);
      } else if (full && e.deltaY < 0 && el.scrollTop <= 0) set(false);
    },
    { passive: false },
  );
}
addEventListener("resize", () => {
  const d = document.querySelector("#qp.drawer");
  d && d._fit && d._fit();
});
function answer(id) {
  if (!Q || Q.answered) return;
  const q = Q.qs[Q.i];
  const ok = id === q.ans;
  const { p, frame } = settle(ok, q, id);
  showInfo(ok, q, p, id, frame, false);
}
function guessMap(id) {
  if (!Q || Q.answered || Q.qs[Q.i].kind !== "map" || !id) return;
  const q = Q.qs[Q.i];
  const ok = id === q.id;
  const { p, frame } = settle(ok, q, id);
  showInfo(ok, q, p, id, frame, false);
}
function timeout() {
  if (!Q || Q.answered) return;
  const q = Q.qs[Q.i];
  const { frame } = settle(false, q, null);
  showInfo(false, q, 0, null, frame, true);
}
function next() {
  if (!Q) return;
  const s = $(".stchip");
  s && s.remove();
  if (Q.i + 1 < Q.qs.length) {
    Q.i++;
    renderQ();
  } else finish();
}
function finish() {
  cancelAnimationFrame(raf);
  SND.play("end");
  const total = Q.qs.length,
    correct = Q.correct;
  const gained = Q.score + 10 + (correct === total ? 25 : 0) + (Q.daily ? DAILY_XP : 0);
  const lv0 = lvlInfo(S.xp).n;
  S.xp += gained;
  const dk = todayKey();
  if (!S.days.includes(dk)) S.days.push(dk);
  S.days = S.days.slice(-400);
  if (Q.daily) S.daily[dk] = { c: correct, t: total };
  S.games = Math.max(S.games || 0, S.sessions.length) + 1;
  if (total >= 10 && correct === total) S.perfects = (S.perfects || 0) + 1;
  S.bestDays = Math.max(S.bestDays || 0, dayStreak());
  S.sessions.unshift({
    d: Date.now(),
    mode: Q.daily ? "daily" : Q.mode,
    region: Q.region,
    score: Q.score,
    correct,
    total,
  });
  S.sessions = S.sessions.slice(0, 50);
  save();
  const L = lvlInfo(S.xp);
  const pct = Math.round((correct / total) * 100);
  const missed = Q.log.filter((x) => !x.ok);
  const nudge =
    S.sessions.length >= 3 &&
    (L.n > lv0 || correct === total) &&
    Date.now() - (S.nudge || 0) > 7 * 864e5;
  if (nudge) {
    S.nudge = Date.now();
    save();
  }
  M.clear();
  M.dim = true;
  M.only(quizDots());
  M.setPins([]);
  for (const x of Q.log) M.cls(x.q.ans, x.ok ? "good" : "bad");
  M.showLabels(Q.log.map((x) => x.q.ans));
  const label = (x) => {
    const c = C.get(x.q.ans);
    return x.q.mode === "capitals"
      ? c.cap[0]
      : x.q.mode === "currencies"
        ? c.cur[0][1]
        : x.q.mode === "languages"
          ? x.q.lang + ": " + c.n
          : c.n;
  };
  QL.innerHTML = `<div class="qp" id="qp">
    <div class="res-top"><span class="big">${pct}%</span><span class="res-r"><span class="mono res-c">${correct}/${total} correct</span><span class="res-xp" id="resXp">+<b id="xpn">0</b> xp</span></span></div>
    ${missed.length ? `<div class="cap">Review</div><ul class="list" style="max-height:26vh;overflow:auto">${missed.map((x) => rowHTML(C.get(x.q.ans), MODES[x.q.mode].t).replace(`<span class="n">${esc(C.get(x.q.ans).n)}</span>`, `<span class="n">${esc(label(x))}</span>`)).join("")}</ul>` : ""}
    <div style="display:flex;gap:8px">${Q.daily ? "" : `<button class="btn ghost" id="again" style="flex:1">Again</button>`}<button class="btn" id="done" style="flex:1">Done</button></div>
    ${nudge ? `<a class="nudge" href="${LINKS.support}" target="_blank" rel="noopener"><svg class="i" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="var(--pink)" stroke="none"/></svg>Enjoying GeoZest? Support it</a>` : ""}
  </div>`;
  const last = { mode: Q.mode, region: Q.region, n: total, timer: Q.timer };
  const all = Q.log.map((x) => x.q.ans);
  Q = null;
  M.onClick = null;
  $("#done").onclick = endQuiz;
  const ag = $("#again");
  ag && (ag.onclick = () => startQuiz(last));
  $$("#qp [data-id]").forEach(
    (b) =>
      (b.onclick = () => {
        M.setPins([b.dataset.id]);
        M.toId(b.dataset.id, 0.7);
      }),
  );
  requestAnimationFrame(() => {
    const qp = $("#qp");
    if (!qp) return;
    M.inset = { top: 20, right: 0, bottom: qp.offsetHeight + panelGap(), left: 0 };
    M.toIds(all, 0.92, 1000);
  });
  document.body.classList.add("results");
  xpReward(gained, lv0, L.n);
}
function countUp(el, to, ms) {
  return new Promise((res) => {
    if (reduced()) {
      el.textContent = nf.format(to);
      res();
      return;
    }
    const t0 = performance.now();
    const f = (now) => {
      const u = Math.min(1, (now - t0) / ms);
      el.textContent = nf.format(Math.round(to * d3.easeCubicOut(u)));
      u < 1 ? requestAnimationFrame(f) : res();
    };
    requestAnimationFrame(f);
  });
}
async function xpReward(gained, lv0, lv1) {
  const n = $("#xpn");
  if (!n) {
    renderChrome();
    await popBadges(checkBadges());
    return;
  }
  await new Promise((r) => setTimeout(r, 350));
  await countUp(n, gained, Math.min(1400, 500 + gained * 4));
  const from = $("#resXp"),
    to = $("#btnMe");
  if (from && to && !reduced()) {
    const a = from.getBoundingClientRect(),
      b = to.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "xpfly";
    fly.textContent = `+${nf.format(gained)} xp`;
    document.body.appendChild(fly);
    const fw = fly.offsetWidth,
      fh = fly.offsetHeight;
    fly.style.left = a.right - fw + "px";
    fly.style.top = a.top + (a.height - fh) / 2 + "px";
    const dx = b.left + b.width / 2 - (a.right - fw / 2),
      dy = b.top + b.height / 2 - (a.top + a.height / 2);
    await fly.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        {
          transform: `translate(${dx * 0.5}px,${dy * 0.5 - 40}px) scale(.9)`,
          opacity: 1,
          offset: 0.55,
        },
        { transform: `translate(${dx}px,${dy}px) scale(.35)`, opacity: 0.2 },
      ],
      { duration: 850, easing: "cubic-bezier(.5,0,.3,1)" },
    ).finished;
    fly.remove();
    to.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
      { duration: 380, easing: "ease-out" },
    );
    SND.play("tap");
  }
  renderChrome();
  if (lv1 > lv0) {
    await new Promise((r) => setTimeout(r, 500));
    await levelUp(lv0, lv1);
  }
  const got = checkBadges();
  if (got.length) {
    await new Promise((r) => setTimeout(r, 300));
    await popBadges(got);
  }
}
function badgeInfo(b) {
  const t = badgeTier(b),
    v = b.v();
  const o = document.createElement("div");
  o.className = "lvup bdg info";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", b.t);
  o.innerHTML = `<div class="lvcard">${medal(b, t, "big")}<b class="bt">${b.t}</b>${t ? `<span class="tchip t${t}">${TIERS[t - 1]}</span>` : `<span class="tchip t0">Locked</span>`}
    <ul class="tiers">${b.at
      .map((n, k) => {
        const got = k < t;
        return `<li class="${got ? "got" : ""}"><i class="${got ? "t" + (k + 1) : ""}"></i><span><b>${TIERS[k]}</b>${b.d(n)}</span>${got ? CK : `<em>${nf.format(Math.min(v, n))}/${nf.format(n)}</em>`}</li>`;
      })
      .join("")}</ul>
    <button class="btn" data-ok style="width:100%">Close</button></div>`;
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add("on"));
  if (t && !reduced()) setTimeout(() => o.classList.add("spin"), 60);
  const close = () => {
    o.classList.remove("on");
    setTimeout(() => o.remove(), 300);
    document.removeEventListener("keydown", esc1, true);
  };
  const esc1 = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", esc1, true);
  o.onclick = (e) => {
    if (e.target === o || e.target.closest("[data-ok]")) close();
  };
}

function countryPicker(cur, pick) {
  const L = Object.entries(SUBS).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const o = document.createElement("div");
  o.className = "lvup cpov";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", "Choose a country");
  const row = ([k, x]) =>
    `<button class="cprow" role="radio" aria-checked="${k === cur}" data-k="${k}">${flag(C.get(k) || { a2: "" })}<span><b>${esc(x.name)}</b><small>${esc(subCount(x))}</small></span>${k === cur ? `<i class="cpck">${CK}</i>` : ""}</button>`;
  o.innerHTML = `<div class="lvcard"><div class="row-x"><b class="cpt">Choose a country</b><button class="x" data-ok aria-label="Close">${I.x}</button></div>
    ${L.length > 10 ? `<label class="searchbox cps">${I.search}<input type="search" placeholder="Search countries" aria-label="Search countries"></label>` : ""}
    <div class="cplist" role="radiogroup">${L.map(row).join("")}</div><p class="cpnote">More countries are being added soon.</p></div>`;
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add("on"));
  const close = () => {
    o.classList.remove("on");
    setTimeout(() => o.remove(), 300);
    document.removeEventListener("keydown", kd, true);
  };
  const kd = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", kd, true);
  const q = o.querySelector(".cps input");
  if (q)
    q.oninput = () => {
      const t = q.value.trim().toLowerCase();
      o.querySelectorAll(".cprow").forEach(
        (b) => (b.hidden = !!t && !SUBS[b.dataset.k].name.toLowerCase().includes(t)),
      );
    };
  o.onclick = (e) => {
    const b = e.target.closest(".cprow");
    if (b) {
      close();
      pick(b.dataset.k);
      return;
    }
    if (e.target === o || e.target.closest("[data-ok]")) close();
  };
  setTimeout(
    () =>
      (o.querySelector('.cprow[aria-checked="true"]') || o.querySelector(".cprow")).focus({
        preventScroll: true,
      }),
    60,
  );
}
async function popBadges(got) {
  for (const [b, t] of got) await badgePop(b, t);
}
function badgePop(b, t) {
  return new Promise((res) => {
    const o = document.createElement("div");
    o.className = "lvup bdg";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-label", `Achievement unlocked: ${b.t}, ${TIERS[t - 1]}`);
    o.innerHTML = `<div class="lvcard"><span class="cap">Achievement unlocked</span>${medal(b, t, "big")}<b class="bt">${b.t}</b><span class="tchip t${t}">${TIERS[t - 1]}</span><span class="lvs">${b.d(b.at[t - 1])}</span></div>`;
    document.body.appendChild(o);
    SND.play("level");
    requestAnimationFrame(() => {
      o.classList.add("on");
      if (!reduced()) setTimeout(() => o.classList.add("spin"), 120);
    });
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      o.classList.remove("on");
      setTimeout(() => {
        o.remove();
        res();
      }, 300);
    };
    o.onclick = close;
    setTimeout(close, reduced() ? 2200 : 3400);
  });
}
function levelUp(a, b) {
  return new Promise((res) => {
    const o = document.createElement("div");
    o.className = "lvup";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-label", `Level ${b} reached`);
    o.innerHTML = `<div class="lvcard"><span class="cap">Level up</span><div class="lvroll"><span class="lvn">${a}</span><span class="lvn">${b}</span></div><span class="lvs">You reached level ${b}</span></div>`;
    document.body.appendChild(o);
    SND.play("level");
    requestAnimationFrame(() => {
      o.classList.add("on");
      setTimeout(() => o.classList.add("roll"), 450);
    });
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      o.classList.remove("on");
      setTimeout(() => {
        o.remove();
        res();
      }, 300);
    };
    o.onclick = close;
    setTimeout(close, reduced() ? 1800 : 2800);
  });
}
