"use strict";

const SH = {
  el: $("#sheet"),
  head: $("#sheetHead"),
  top: $("#sheetTop"),
  body: $("#sheetBody"),
  foot: $("#sheetFoot"),
  kind: null,
  state: null,
  pos: null,
  onClose: null,
};
function sheetOpen(kind, top, body, { snap = "full", onClose, foot = "" } = {}) {
  const was = !SH.el.hidden && SH.state !== "closed";
  if (SH.onClose) {
    const f = SH.onClose;
    SH.onClose = null;
    f();
  }
  SH.kind = kind;
  SH.onClose = onClose || null;
  SH.top.innerHTML = top;
  SH.body.innerHTML = body;
  SH.foot.innerHTML = foot;
  SH.foot.hidden = !foot;
  SH.body.scrollTop = 0;
  SH.el.hidden = false;
  if (isPhone()) {
    document.body.classList.add("sheet-up");
    SH.el.style.left = SH.el.style.top = "";
    SH.el.style.maxHeight = "";
    SH.el.classList.toggle("tall", kind === "search");
    fitTall();
    if (!was) {
      SH.el.classList.remove("anim");
      SH.el.style.transform = `translateY(${innerHeight}px)`;
      SH.el.offsetHeight;
    }
    requestAnimationFrame(() => snapTo(snap));
  } else {
    SH.el.style.transform = "";
    SH.el.classList.remove("peek", "tall");
    SH.el.style.height = "";
    SH.state = "full";
    if (!SH.pos) SH.pos = { x: 16, y: 68 };
    placeDesk();
    if (!was && !reduced())
      SH.el.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 200, easing: "ease-out" },
      );
    setInset();
  }
  $$("[data-close]", SH.el).forEach((b) => (b.onclick = sheetClose));
}

const EASE = "cubic-bezier(.2,.8,.2,1)";
function sheetResize(h0) {
  if (reduced() || SH.el.hidden || SH.el.classList.contains("tall")) return;
  const h1 = SH.el.getBoundingClientRect().height;
  if (Math.abs(h1 - h0) < 2) return;
  SH.el.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 320, easing: EASE });
}
function fitTall() {
  if (!SH.el.classList.contains("tall") || !isPhone()) {
    SH.el.style.height = "";
    return;
  }
  const v = window.visualViewport;
  SH.el.style.top = (v ? v.offsetTop : 0) + "px";
  SH.el.style.height = (v ? v.height : innerHeight) + "px";
}
if (window.visualViewport) {
  visualViewport.addEventListener("resize", fitTall);
  visualViewport.addEventListener("scroll", fitTall);
}
addEventListener("resize", () => setTimeout(fitTall));
function placeDesk() {
  const w = SH.el.offsetWidth || 380;
  SH.pos.x = Math.max(8, Math.min(innerWidth - w - 8, SH.pos.x));
  SH.pos.y = Math.max(8, Math.min(innerHeight - 80, SH.pos.y));
  SH.el.style.left = SH.pos.x + "px";
  SH.el.style.top = SH.pos.y + "px";
  SH.el.style.maxHeight = `calc(100dvh - ${SH.pos.y + 16}px)`;
}
function peekY() {
  const H = SH.el.offsetHeight;
  const pe = SH.body.querySelector("[data-peek-end]");
  const vis = pe ? pe.offsetTop + pe.offsetHeight + 12 : SH.head.offsetHeight;
  return Math.max(0, H - vis);
}
function curY() {
  const m = /translateY\(([-\d.]+)px\)/.exec(SH.el.style.transform);
  return m ? +m[1] : 0;
}
function snapTo(s) {
  SH.state = s;
  SH.el.classList.add("anim");
  const H = SH.el.offsetHeight;
  const y = s === "full" ? 0 : s === "peek" ? peekY() : H + 40;
  SH.el.style.transform = `translateY(${y}px)`;
  SH.el.classList.toggle("peek", s === "peek");
  if (s === "closed")
    setTimeout(() => {
      if (SH.state === "closed") SH.el.hidden = true;
    }, 360);
  setInset();
}
function sheetClose() {
  if (SH.el.hidden || SH.state === "closed") return;
  const f = SH.onClose;
  SH.onClose = null;
  SH.kind = null;
  document.body.classList.remove("sheet-up");
  if (isPhone()) snapTo("closed");
  else {
    SH.el.hidden = true;
    SH.state = "closed";
    setInset();
  }
  f && f();
}
function setInset() {
  if (SH.el.hidden || SH.state === "closed") {
    M.inset = { top: 0, right: 0, bottom: 0, left: 0 };
    return;
  }
  if (isPhone()) {
    const H = SH.el.offsetHeight;
    const vis = SH.state === "peek" ? H - peekY() : H;
    M.inset = { top: 64, right: 0, bottom: Math.min(vis, M.h * 0.72), left: 0 };
  } else {
    const r = SH.el.getBoundingClientRect();
    M.inset =
      r.left + r.width / 2 < M.w / 2
        ? { top: 0, right: 70, bottom: 0, left: r.right + 8 }
        : { top: 0, right: M.w - r.left + 8, bottom: 0, left: 0 };
  }
}
(function dragSheet() {
  let sy,
    sx,
    st,
    start,
    dragging = false,
    moved = false,
    lastY,
    lastT,
    vel = 0;
  SH.head.addEventListener("pointerdown", (e) => {
    if (SH.el.classList.contains("tall")) return;
    if (e.target.closest("button,input,a,label")) return;
    dragging = true;
    moved = false;
    sx = e.clientX;
    sy = e.clientY;
    lastY = sy;
    lastT = performance.now();
    vel = 0;
    try {
      SH.head.setPointerCapture(e.pointerId);
    } catch (_) {}
    if (isPhone()) {
      SH.el.classList.remove("anim");
      st = curY();
    } else {
      start = { ...SH.pos };
      SH.el.classList.add("drag");
    }
  });
  SH.head.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientY - sy) + Math.abs(e.clientX - sx) > 4) moved = true;
    if (isPhone()) {
      SH.el.style.transform = `translateY(${Math.max(0, st + e.clientY - sy)}px)`;
      const now = performance.now();
      vel = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY;
      lastT = now;
    } else {
      SH.pos.x = start.x + e.clientX - sx;
      SH.pos.y = start.y + e.clientY - sy;
      placeDesk();
    }
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    SH.el.classList.remove("drag");
    if (!isPhone()) {
      setInset();
      return;
    }
    const canPeek = SH.kind === "country";
    if (!moved) {
      snapTo(SH.state === "peek" ? "full" : canPeek ? "peek" : "full");
      return;
    }
    const y = curY(),
      H = SH.el.offsetHeight,
      py = canPeek ? peekY() : null;
    if (vel > 0.9 || y > (canPeek ? py + 70 : H * 0.35)) {
      sheetClose();
      return;
    }
    if (!canPeek || vel < -0.4) {
      snapTo("full");
      return;
    }
    snapTo(y < py / 2 ? "full" : "peek");
  };
  SH.head.addEventListener("pointerup", end);
  SH.head.addEventListener("pointercancel", end);
  let ty = null;
  SH.body.addEventListener(
    "touchstart",
    (e) => {
      ty = SH.body.scrollTop <= 0 ? e.touches[0].clientY : null;
    },
    { passive: true },
  );
  SH.body.addEventListener(
    "touchmove",
    (e) => {
      if (ty != null && isPhone() && SH.state === "full" && e.touches[0].clientY - ty > 90) {
        ty = null;
        SH.kind === "country" ? snapTo("peek") : sheetClose();
      }
    },
    { passive: true },
  );
})();

let toastT;
function toast(msg) {
  const o = $(".toast");
  o && o.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.innerHTML = `<i></i><span>${esc(msg)}</span>`;
  document.body.appendChild(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 2800);
}

const TIERS = ["Bronze", "Silver", "Gold"];

const sMast = (m) => () =>
  Object.keys(S.prog[m] || {}).filter((id) => C.has(id) && mastered(m, id)).length;
const BADGES = [
  {
    id: "games",
    sh: "circle",
    t: "Quiz runner",
    d: (n) => `Finish ${n} ${n > 1 ? "quizzes" : "quiz"}`,
    ic: "check",
    v: () => Math.max(S.games || 0, S.sessions.length),
    at: [5, 50, 250],
  },
  {
    id: "streak",
    sh: "shield",
    t: "On fire",
    d: (n) => `${n} right in a row, across games`,
    ic: "bolt",
    v: () => S.best || 0,
    at: [15, 40, 100],
  },
  {
    id: "perfect",
    sh: "seal",
    t: "Flawless",
    d: (n) => `${n} perfect ${n > 1 ? "rounds" : "round"} of 10+`,
    ic: "star",
    v: () =>
      Math.max(
        S.perfects || 0,
        S.sessions.filter((x) => x.total >= 10 && x.correct === x.total).length,
      ),
    at: [3, 15, 50],
  },
  {
    id: "answers",
    sh: "oct",
    t: "Sharpshooter",
    d: (n) => `${nf.format(n)} correct answers`,
    ic: "target",
    v: () => S.tot.c || 0,
    at: [250, 1500, 5000],
  },
  {
    id: "locate",
    sh: "hex",
    t: "Cartographer",
    d: (n) => `Locate ${n} countries`,
    ic: "locate",
    v: sMast("locate"),
    at: [40, 100, 150],
  },
  {
    id: "identify",
    sh: "diamond",
    t: "Shape spotter",
    d: (n) => `Identify ${n} countries`,
    ic: "identify",
    v: sMast("identify"),
    at: [40, 100, 150],
  },
  {
    id: "flags",
    sh: "square",
    t: "Flag expert",
    d: (n) => `Master ${n} flags`,
    ic: "flags",
    v: sMast("flags"),
    at: [40, 100, 150],
  },
  {
    id: "capitals",
    sh: "pent",
    t: "Capital minded",
    d: (n) => `Master ${n} capitals`,
    ic: "capitals",
    v: sMast("capitals"),
    at: [40, 90, 140],
  },
  {
    id: "languages",
    sh: "hex",
    t: "Polyglot",
    d: (n) => `Master ${n} in Languages`,
    ic: "languages",
    v: sMast("languages"),
    at: [25, 60, 110],
  },
  {
    id: "currencies",
    sh: "oct",
    t: "Money talks",
    d: (n) => `Master ${n} currencies`,
    ic: "currencies",
    v: sMast("currencies"),
    at: [40, 100, 150],
  },
  {
    id: "neighbours",
    sh: "pent",
    t: "Good neighbour",
    d: (n) => `Master ${n} in Neighbors`,
    ic: "neighbours",
    v: sMast("neighbours"),
    at: [25, 70, 140],
  },
  {
    id: "explorer",
    sh: "diamond",
    t: "Explorer",
    d: (n) => `Open ${n} countries`,
    ic: "compass",
    v: () => S.viewed.length,
    at: [50, 120, 200],
  },
  {
    id: "days",
    sh: "shield",
    t: "Daily habit",
    d: (n) => `${n}-day streak`,
    ic: "flame",
    v: () => Math.max(S.bestDays || 0, dayStreak()),
    at: [7, 30, 100],
  },
  {
    id: "daily",
    sh: "square",
    t: "Challenger",
    d: (n) => `${n} daily ${n > 1 ? "challenges" : "challenge"}`,
    ic: "daily",
    v: () => Object.keys(S.daily).length,
    at: [5, 30, 100],
  },
  {
    id: "level",
    sh: "seal",
    t: "Climber",
    d: (n) => `Reach level ${n}`,
    ic: "trophy",
    v: () => lvlInfo(S.xp).n,
    at: [10, 20, 35],
  },
];
const tierOf = (b) => {
  const v = b.v();
  return b.at.filter((x) => v >= x).length;
};
const badgeTier = (b) => Math.max((S.badges2 || {})[b.id] || 0, tierOf(b));

function checkBadges() {
  if (!S.badges2) {
    S.badges2 = {};
    for (const b of BADGES) S.badges2[b.id] = tierOf(b);
    save();
    return [];
  }
  const got = [];
  for (const b of BADGES) {
    const t = tierOf(b);
    if (t > (S.badges2[b.id] || 0)) {
      S.badges2[b.id] = t;
      got.push([b, t]);
    }
  }
  if (got.length) save();
  return got;
}

function renderChrome() {
  const L = lvlInfo(S.xp);
  $("#meLvl").textContent = L.n;
  $("#meRing").style.strokeDasharray = `${L.pct} 100`;
  {
    const j = PJ.find((x) => x[0] === S.settings.proj) || PJ[0];
    $("#btnProj").textContent = j[1];
    $("#btnProj").setAttribute("aria-label", `Map view: ${j[2]}`);
  }
  $("#dailyDot").hidden = !!S.daily[todayKey()];
}

function countryBlock(c, { right = "", extra = "", fact = true } = {}) {
  const LMAX = 5,
    more = c.l.length > LMAX + 1;
  const lang = more
    ? `${esc(c.l.slice(0, LMAX).join(", "))}<span class="lmore" hidden>, ${esc(c.l.slice(LMAX).join(", "))}</span> <button class="pill lbtn" data-lmore>+${c.l.length - LMAX}</button>`
    : esc(c.l.join(", "));
  return `<div class="info">
    <div class="info-h"><button class="flagbtn" data-flag="${c.id}" aria-label="Enlarge the flag of ${esc(c.n)}">${flag(c)}</button><div class="nmw"><div class="nm${Math.max(...c.n.split(" ").map((w) => w.length)) > 12 ? " xl" : Math.max(...c.n.split(" ").map((w) => w.length)) > 9 ? " l" : ""}">${esc(c.n)}${sayBtn(c, "name")}</div><div class="capn">${esc(c.cap.join(", ") || c.sr || c.r)}</div></div>${right}</div>
    <div class="facts">
      <div><div class="k">Population</div><div class="v mono">${fmtPop(c.pop)}${c.pop ? ` <small>${c.py || ""}</small>` : ""}</div></div>
      <div><div class="k">Area</div><div class="v mono">${areaTxt(c.ar)}</div></div>
      <div class="full"><div class="k">Language${c.l.length > 1 ? "s" : ""}</div><div class="v">${lang || "n/a"}</div></div>
      ${extra}
    </div>
    ${fact ? funHTML(c) : ""}
  </div>`;
}

function openFlag(id, anon) {
  const c = C.get(id);
  if (!c || !G.flags[c.a2]) return;
  const d = document.createElement("div");
  d.className = "lb";
  d.setAttribute("role", "dialog");
  d.setAttribute("aria-modal", "true");
  d.setAttribute("aria-label", anon ? "Flag" : "Flag of " + c.n);
  d.innerHTML = `<figure><div class="lbflag">${G.flags[c.a2]}</div>${anon ? "" : `<figcaption><b>${esc(c.n)}</b><a href="${esc(WIKI("Flag of " + c.n))}" target="_blank" rel="noopener">About this flag ↗</a></figcaption>`}</figure><button class="x lbx" aria-label="Close">${I.x}</button>`;
  const close = () => {
    d.remove();
    document.removeEventListener("keydown", k, true);
  };
  const k = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  d.addEventListener("click", (e) => {
    if (!e.target.closest("a")) close();
  });
  document.addEventListener("keydown", k, true);
  document.body.appendChild(d);
  d.querySelector(".lbx").focus({ preventScroll: true });
}

const HAS_TTS = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const SAY_ICON =
  '<svg class="i" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>';
function sayBtn(c, what) {
  return `<button class="say" data-say="${c.id}" data-what="${what}" aria-label="Hear how to say ${esc(c.n)}, its capital and languages">${SAY_ICON}</button>`;
}
const SAYC = new Map();
async function sayData(id) {
  if (SAYC.has(id)) return SAYC.get(id);
  const r = await fetch("data/say/" + id + ".json");
  if (!r.ok) throw new Error("missing");
  const j = await r.json();
  SAYC.set(id, j);
  return j;
}
let audio = null,
  playingBtn = null;
function stopAudio() {
  if (audio) {
    audio.pause();
    audio = null;
  }
  if (playingBtn) {
    playingBtn.classList.remove("on");
    playingBtn = null;
  }
  try {
    HAS_TTS && speechSynthesis.cancel();
  } catch (e) {}
}
function playRow(r, btn) {
  stopAudio();
  if (r.a) {
    audio = new Audio("data:audio/mpeg;base64," + r.a);
    playingBtn = btn;
    btn.classList.add("on");
    const done = () => {
      btn.classList.remove("on");
    };
    audio.onended = audio.onerror = done;
    audio.play().catch(() => {
      done();
      ttsFallback(r, btn);
    });
    return;
  }
  ttsFallback(r, btn);
}
function ttsFallback(r, btn) {
  if (!HAS_TTS) {
    toast("No audio for this one");
    return;
  }
  try {
    const u = new SpeechSynthesisUtterance(r.t);
    if (r.lang) u.lang = r.lang;
    u.rate = 0.88;
    btn.classList.add("on");
    u.onend = u.onerror = () => btn.classList.remove("on");
    speechSynthesis.speak(u);
  } catch (e) {
    toast("No audio for this one");
  }
}
async function openSay(id) {
  const c = C.get(id);
  if (!c) return;
  const d = document.createElement("div");
  d.className = "lb dim";
  d.setAttribute("role", "dialog");
  d.setAttribute("aria-modal", "true");
  d.setAttribute("aria-label", "Pronunciation");
  const head = `<div class="row-x"><div><div class="cap">Pronunciation</div><div class="title" style="font-size:20px;margin-top:2px">${esc(c.n)}</div></div><button class="x" data-x aria-label="Close">${I.x}</button></div>`;
  d.innerHTML = `<div class="dlg">${head}<div class="empty">Loading</div></div>`;
  let rows = [];
  const close = () => {
    stopAudio();
    d.remove();
    document.removeEventListener("keydown", k, true);
  };
  const k = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-x]")) {
      close();
      return;
    }
    const b = e.target.closest("[data-i]");
    if (b && !b.disabled) playRow(rows[+b.dataset.i], b);
  });
  document.addEventListener("keydown", k, true);
  document.body.appendChild(d);
  let secs;
  try {
    const j = await sayData(id);
    secs = [
      ["Country", j.name],
      ["Capital", j.cap],
      ["Language" + (c.l.length > 1 ? "s" : ""), j.lang],
    ];
  } catch (e) {
    secs = [
      [
        "Country",
        [
          { t: c.n, l: "English", lang: "en" },
          ...(c.nv || []).filter((x) => x[2] !== c.n).map((x) => ({ t: x[2], l: x[1] })),
        ],
      ],
      ["Capital", c.cap.length ? [{ t: c.cap[0], l: "English", lang: "en" }] : []],
      ["Languages", c.l.map((x) => ({ t: x, l: "English", lang: "en" }))],
    ];
  }
  if (!d.isConnected) return;
  const can = (r) => !!r.a || HAS_TTS;
  const rowH = (r) => {
    const i = rows.push(r) - 1;
    return `<li><button class="li" data-i="${i}" ${can(r) ? "" : "disabled"}><span class="ic play-ic">${can(r) ? '<svg class="i" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>' : '<svg class="i" viewBox="0 0 24 24"><path d="M6 12h12"/></svg>'}</span><span class="n"><span class="say-t">${esc(r.t)}</span><span class="say-l">${esc(r.l)}${r.ipa ? `<span class="ipa">/${esc(r.ipa.replace(/\([a-z-]+\)/g, ""))}/</span>` : ""}${can(r) ? "" : ", no audio"}</span></span></button></li>`;
  };
  d.querySelector(".dlg").innerHTML =
    head +
    `<div class="says-wrap">${secs
      .filter(([, r]) => r && r.length)
      .map(
        ([h, r]) =>
          `<div class="say-h">${h}</div><ul class="list says">${r.map(rowH).join("")}</ul>`,
      )
      .join("")}</div>
    <div class="say-note">Audio is synthesised with neural voices trained on native speakers where available, and eSpeak NG otherwise.</div>`;
  const first = d.querySelector("[data-i]:not([disabled])");
  first && first.focus({ preventScroll: true });
}
document.addEventListener(
  "click",
  (e) => {
    const f = e.target.closest("[data-flag]");
    if (f) {
      e.stopPropagation();
      openFlag(f.dataset.flag, !!f.dataset.anon);
      return;
    }
    const lm = e.target.closest("[data-lmore]");
    if (lm) {
      e.stopPropagation();
      const v = lm.closest(".v");
      v.querySelector(".lmore").hidden = false;
      lm.remove();
      if (isPhone() && SH.state === "peek" && SH.el.contains(v)) snapTo("full");
      return;
    }
    const s = e.target.closest("[data-say]");
    if (s) {
      e.stopPropagation();
      openSay(s.dataset.say);
    }
  },
  true,
);

let selected = null;
function exploreClick(id) {
  if (!id) {
    if (SH.kind === "country") sheetClose();
    else deselect();
    return;
  }
  SND.play("tap");
  openCountry(id);
}
function deselect() {
  if (selected) {
    M.cls(selected, "sel", false);
    selected = null;
    M.showLabels(null);
    M.setPins([]);
  }
}
function detailRows(c) {
  const id = c.id;
  const nb = c.b.map((x) => C.get(x)).filter(Boolean);
  const rank = areaRank.get(id);
  return `<div class="rows">
    <div class="kv"><span class="k">Currency</span><span class="v">${c.cur.map((x) => `${esc(x[1])} <small>${esc(x[0])} ${esc(x[2])}</small>`).join("<br>") || "n/a"}</span></div>
    ${rank ? `<div class="kv"><span class="k">Size rank</span><span class="v mono">#${rank} <small>of ${sovereign.length}</small></span></div>` : ""}
    ${c.dm ? `<div class="kv"><span class="k">People</span><span class="v">${esc(c.dm)}</span></div>` : ""}
    ${c.nat && c.nat !== c.n ? `<div class="kv"><span class="k">Local name</span><span class="v">${esc(c.nat)}</span></div>` : ""}
    <div class="kv"><span class="k">Borders</span><span class="v">${nb.length ? `<span class="pills">${nb.map((x) => `<button class="pill" data-nb="${x.id}">${flag(x)}${esc(x.n)}</button>`).join("")}</span>` : c.lk ? "None, landlocked" : "None"}</span></div>
    <div class="kv"><span class="k">Dial, web</span><span class="v mono">${esc(c.cc || "n/a")}  ${esc(c.tld || "")}</span></div>
    <div class="kv"><span class="k">Centre</span><span class="v mono">${fmtLL(c.ll)}</span></div>
    <div class="kv"><span class="k">Mastered</span><span class="v mono">${countryScore(id)} / ${SKILLS.length}</span></div>
  </div>`;
}
const PENG = [
  "Hi, I'm an emperor penguin. Welcome to Antarctica! Tap me for more.",
  "Looking for polar bears? Wrong end of the planet. They live in the Arctic, up north.",
  "Nobody owns this place. Twelve countries signed the Antarctic Treaty in 1959, and 54 are part of it today.",
  "About 70% of the world's fresh water is frozen right under my feet.",
  "The ice here is about 1.9 km thick on average.",
  "Coldest temperature ever measured: −89.2 °C, at Vostok Station in July 1983. Brr.",
  "Nobody lives here for good. About 5,000 people work at research stations in summer, and around 1,000 stay for winter.",
  "We emperors raise our chicks in the middle of the Antarctic winter. The dads keep the egg warm on their feet.",
  "Highest point: Vinson Massif, 4,892 m. I prefer swimming.",
];
const PENGSVG = `<svg class="pg" viewBox="0 0 64 80" aria-hidden="true"><path d="M11 46 Q3 60 12 68" stroke="#1f1f23" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M53 46 Q61 60 52 68" stroke="#1f1f23" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="32" cy="48" rx="21" ry="29" fill="#1f1f23"/><ellipse cx="32" cy="54" rx="14" ry="21" fill="#fff"/><circle cx="32" cy="22" r="14" fill="#1f1f23"/><ellipse cx="21.5" cy="31" rx="4.5" ry="6.5" fill="#F9C74F"/><ellipse cx="42.5" cy="31" rx="4.5" ry="6.5" fill="#F9C74F"/><circle cx="26.5" cy="20" r="2.4" fill="#fff"/><circle cx="37.5" cy="20" r="2.4" fill="#fff"/><circle cx="27" cy="20.5" r="1.2" fill="#000"/><circle cx="38" cy="20.5" r="1.2" fill="#000"/><path d="M29 25.5 L35 25.5 L32 31 Z" fill="#FD971F"/><ellipse cx="24" cy="77" rx="6" ry="2.6" fill="#FD971F"/><ellipse cx="40" cy="77" rx="6" ry="2.6" fill="#FD971F"/></svg>`;
function openAntarctica() {
  deselect();
  selected = "ATA";
  M.cls("ATA", "sel");
  M.setPins([]);
  const top = `<div class="row-x"><span class="cap">Continent, no countries</span><button class="x" data-close aria-label="Close">${I.x}</button></div>`;
  const body = `<div data-peek-end><div class="info"><div class="info-h"><div class="nmw"><div class="nm">Antarctica</div><div class="capn">No capital, no permanent residents</div></div></div>
      <div class="facts"><div><div class="k">Area</div><div class="v mono">${S.settings.units === "mi" ? "5.5 m mi²" : "14.2 m km²"}</div></div><div><div class="k">Residents</div><div class="v mono">0</div></div>
      <div><div class="k">Coldest</div><div class="v mono">−89.2 °C</div></div><div><div class="k">Highest</div><div class="v mono">4,892 m</div></div></div></div>
    <div class="gap"></div><button class="peng" id="peng" aria-label="Talk to the penguin"><span class="pgw">${PENGSVG}</span><span class="bub" id="bub" aria-live="polite">${PENG[0]}</span></button></div>
    <div class="gap"></div><div class="rows">
    <div class="kv"><span class="k">Governed by</span><span class="v">The Antarctic Treaty, signed by 12 countries in 1959. 54 countries are party to it today.</span></div>
    <div class="kv"><span class="k">Ice</span><span class="v">About 1.9 km thick on average, holding around 70% of the world's fresh water</span></div>
    <div class="kv"><span class="k">Highest</span><span class="v">Vinson Massif, 4,892 m</span></div>
    <div class="kv"><span class="k">Coldest</span><span class="v">−89.2 °C at Vostok Station, 21 July 1983</span></div>
    <div class="kv"><span class="k">People</span><span class="v">About 5,000 at research stations in summer, around 1,000 in winter</span></div></div>`;
  sheetOpen("country", top, body, { snap: "peek", onClose: deselect });
  let n = 0;
  $("#peng").onclick = () => {
    n = (n + 1) % PENG.length;
    $("#bub").textContent = PENG[n];
    SND.play("tap");
    const g = $("#peng .pg");
    g.classList.remove("hop");
    void g.getBBox();
    g.classList.add("hop");
  };
}
function openState(c) {
  const par = C.get(c.st),
    nb = c.b.map((x) => C.get(x)).filter(Boolean);
  const top = `<div class="row-x"><span class="cap">${esc(c.t)}, ${esc(par ? par.n : "")}</span><button class="x" data-close aria-label="Close">${I.x}</button></div>`;
  const body = `<div class="sthead">${flag(par || c)}<div><h2 class="title">${esc(c.n)}</h2><p class="muted">${esc(c.sr)}</p></div></div><div class="gap"></div>
    <div class="rows">${[
      ["Capital", c.cap.join(", ")],
      ["Area", areaTxt(c.ar)],
      [
        c.st === "IND" ? "Borders" : "Borders",
        nb.length
          ? nb.map((n) => `<button class="pill" data-nb="${n.id}">${esc(n.n)}</button>`).join(" ")
          : "None by land",
      ],
    ]
      .map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`)
      .join("")}</div>`;
  sheetOpen("country", top, body, { snap: "peek", onClose: deselect });
  deselect();
  selected = c.id;
  M.cls(c.id, "sel");
  M.showLabels([c.id]);
  $$("[data-nb]", SH.body).forEach((b) => (b.onclick = () => openCountry(b.dataset.nb)));
  setTimeout(() => {
    setInset();
    M.toId(c.id, 0.7, 900);
  }, 40);
}
function openCountry(id) {
  if (id === "ATA") {
    openAntarctica();
    return;
  }
  const c = C.get(id);
  if (!c) return;
  if (c.st) {
    openState(c);
    return;
  }
  if (!S.viewed.includes(id)) {
    S.viewed.push(id);
    save();
    if (!Q) popBadges(checkBadges());
  }
  const nb = c.b.map((x) => C.get(x)).filter(Boolean);
  const rank = areaRank.get(id);
  const reg = REGIONS.includes(c.r) ? c.r : "World";
  const top = `<div class="row-x"><span class="cap">${esc(c.sr || c.r)}${c.ind ? "" : ", territory"}</span><button class="x" data-close aria-label="Close">${I.x}</button></div>`;
  const body = `<div data-peek-end>${countryBlock(c, { fact: false })}</div><div class="gap"></div>${funHTML(c)}<div class="gap"></div>${detailRows(c)}<div class="gap"></div><button class="btn ghost w" id="quizHere">Quiz ${esc(reg)}</button>`;
  sheetOpen("country", top, body, { snap: "peek", onClose: deselect });
  deselect();
  selected = id;
  M.cls(id, "sel");
  M.showLabels([id]);
  M.setPins([id]);
  $$("[data-nb]", SH.body).forEach((b) => (b.onclick = () => openCountry(b.dataset.nb)));
  $("#quizHere").onclick = () =>
    startQuiz({ mode: "mixed", region: reg, n: S.settings.len, timer: S.settings.timer });
  setTimeout(() => {
    setInset();
    M.toId(id, 0.7, 900);
  }, 40);
}

function openSearch() {
  const top = `<div class="row-x"><label class="searchbox" style="flex:1">${I.search}<input id="q" type="search" placeholder="Country, capital, language" autocomplete="off" enterkeyhint="search" aria-label="Search"></label><button class="x" data-close aria-label="Close">${I.x}</button></div>`;
  sheetOpen("search", top, `<div id="res"></div>`, { snap: "full" });
  const q = $("#q");
  q.addEventListener("input", () => renderResults(q.value));
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const b = $("#res [data-id]");
      b && b.click();
    }
    if (e.key === "Escape") sheetClose();
  });
  renderResults("");
  setTimeout(() => q.focus({ preventScroll: true }), isPhone() ? 320 : 30);
}
const rowHTML = (c, sub) =>
  `<li><button class="li" data-id="${c.id}"><span class="fbox">${flag(c)}</span><span class="n">${esc(c.n)}</span><span class="s">${esc(sub == null ? c.cap[0] || "" : sub)}</span></button></li>`;
function renderResults(term) {
  term = term.trim().toLowerCase();
  const res = $("#res");
  if (!res) return;
  if (term) {
    const L = G.countries
      .filter(
        (c) =>
          c.n.toLowerCase().includes(term) ||
          c.o.toLowerCase().includes(term) ||
          c.cap.some((x) => x.toLowerCase().includes(term)) ||
          c.l.some((x) => x.toLowerCase().includes(term)),
      )
      .sort(
        (a, b) =>
          b.n.toLowerCase().startsWith(term) - a.n.toLowerCase().startsWith(term) ||
          b.ind - a.ind ||
          a.n.localeCompare(b.n),
      )
      .slice(0, 40);
    res.innerHTML = L.length
      ? `<ul class="list">${L.map((c) => rowHTML(c)).join("")}</ul>`
      : `<div class="empty">No match</div>`;
  } else {
    const recent = S.viewed
      .slice(-5)
      .reverse()
      .map((id) => C.get(id))
      .filter(Boolean);
    res.innerHTML = `<div class="scroller" style="margin-top:2px">${["World", ...REGIONS].map((r) => `<button class="pill" data-rz="${r}">${r}</button>`).join("")}</div>
      ${recent.length ? `<div class="gap"></div><div class="cap">Recent</div><ul class="list">${recent.map((c) => rowHTML(c)).join("")}</ul>` : ""}`;
  }
  res.onclick = (e) => {
    const b = e.target.closest("[data-id]");
    if (b) {
      openCountry(b.dataset.id);
      return;
    }
    const r = e.target.closest("[data-rz]");
    if (r) {
      sheetClose();
      setTimeout(() => (r.dataset.rz === "World" ? M.world() : M.toRegion(r.dataset.rz)), 30);
    }
  };
}

const ART = {
  locate: ["◎", "⌖", "●", "◉", "⌖"],
  identify: ["?", "?", "¿", "?"],
  capitals: ["★", "✦", "☆", "★"],
  languages: ["अ", "あ", "ع", "Ж", "Ω", "ก", "한", "ß", "ñ", "ψ"],
  currencies: ["$", "€", "£", "¥", "₹", "₩", "₽", "₺", "฿", "₦", "₫", "₴"],
  neighbours: ["⬡", "⬢", "⬡"],
  daily: ["1", "7", "12", "24", "31", "3", "19"],
};
function cardArt(k) {
  const rng = rngFrom(hash("art" + k));
  const pool = k === "mixed" ? Object.values(ART).flat() : ART[k];
  let out = "";
  for (let i = 0; i < 12; i++) {
    const x = (18 + rng() * 92).toFixed(1),
      y = (18 + rng() * 92).toFixed(1),
      r = ((rng() - 0.5) * 50).toFixed(0),
      col = `var(--p${i % 6})`,
      sz = (11 + rng() * 13).toFixed(0);
    if (k === "flags") {
      const w = +sz * 1.3,
        h = +sz * 0.85;
      out += `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h / 3}" fill="var(--p${i % 6})"/><rect x="${-w / 2}" y="${-h / 6}" width="${w}" height="${h / 3}" fill="var(--p${(i + 2) % 6})"/><rect x="${-w / 2}" y="${h / 6}" width="${w}" height="${h / 3}" fill="var(--p${(i + 4) % 6})"/></g>`;
    } else
      out += `<text x="${x}" y="${y}" font-size="${sz}" transform="rotate(${r} ${x} ${y})" text-anchor="middle" dominant-baseline="central" style="fill:${col}" font-weight="700">${pick(pool, rng)}</text>`;
  }
  return `<svg class="art" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${out}</svg>`;
}
let playMoved = false;
const CK =
  '<svg class="i ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const PLUS =
  '<svg class="i ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
const MDESC = {
  locate: "Find the country on the map",
  identify: "Name the highlighted country",
  capitals: "Pick each country's capital",
  flags: "Name the country from its flag",
  languages: "Find where a language is official",
  currencies: "Pick each country's currency",
  neighbours: "Spot the country that shares a border",
  mixed: "A bit of everything",
};
const CHEV = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
let pickOpen = false;

function glist(open, done) {
  const gl = $("#glist"),
    gp = $("#gpick");
  if (!gl) return;

  for (const el of [gl, ...gl.querySelectorAll(".gtile")])
    el.getAnimations().forEach((a) => a.cancel());
  pickOpen = open;
  gp.setAttribute("aria-expanded", open);
  $("#gbox").classList.toggle("open", open);
  if (reduced()) {
    gl.hidden = !open;
    done && done();
    return;
  }
  if (open) {
    gl.hidden = false;
    const h = gl.offsetHeight;
    gl.animate(
      [
        { height: "0px", marginTop: "0px" },
        { height: h + "px", marginTop: "8px" },
      ],
      { duration: 340, easing: EASE },
    );
    gl.querySelectorAll(".gtile").forEach((b, i) =>
      b.animate(
        [
          { opacity: 0, transform: "translateY(-8px) scale(.94)" },
          { opacity: b.disabled ? 0.4 : 1, transform: "none" },
        ],
        { duration: 300, delay: 40 + i * 35, easing: EASE, fill: "backwards" },
      ),
    );
    done && done();
  } else {
    const h = gl.offsetHeight;
    const fades = [...gl.querySelectorAll(".gtile")].map((b) =>
      b.animate([{ opacity: b.disabled ? 0.4 : 1 }, { opacity: 0 }], {
        duration: 160,
        fill: "forwards",
      }),
    );
    const a = gl.animate(
      [
        { height: h + "px", marginTop: "8px" },
        { height: "0px", marginTop: "0px" },
      ],
      { duration: 300, easing: EASE },
    );
    a.onfinish = () => {
      gl.hidden = true;
      fades.forEach((f) => f.cancel());
      done && done();
    };
  }
}
function openPlay() {
  const again = SH.kind === "play";
  if (!again) {
    playMoved = false;
    pickOpen = false;
  }
  const fk = (el, i) => el.dataset.r || el.dataset.inc || el.className + i;
  const FL = "[data-r],[data-inc],.plabel,.pnote,.seg,.tgl,.gpick";
  const prev = again
    ? new Map(
        [...SH.body.querySelectorAll(FL)].map((b, i) => [fk(b, i), b.getBoundingClientRect()]),
      )
    : null;
  const h0 = again ? SH.el.getBoundingClientRect().height : 0;
  const st = S.settings;
  const dd = S.daily[todayKey()];
  const keep = again ? SH.body.scrollTop : 0;
  const isl = st.region === "Islands",
    sel = st.region === "World" || isl ? [] : st.region.split(",");
  if (!MODES[st.pick]) st.pick = "locate";
  if (!SUBS[st.sub]) st.sub = Object.keys(SUBS)[0];
  const sc = st.scope === "sub" && !!SUBS[st.sub],
    R0 = sc ? "@" + st.sub : st.region,
    SB = sc ? SUBS[st.sub] : null;
  const offTxt = sc ? "Not for states" : "Not for Islands, too few land borders";
  const gOff = (k) =>
    k === "mixed"
      ? !SKILLS.some((m) => poolFor(m, R0).length >= 4)
      : sc
        ? poolFor(k, R0).length < 4
        : k === "neighbours" && isl;
  if (gOff(st.pick)) st.pick = "locate";
  const regs = ["World", ...REGIONS, "Islands"],
    on = (r) => (r === "World" ? st.region === "World" : r === "Islands" ? isl : sel.includes(r));
  const chip = (r) =>
    `<button class="pill rchip${on(r) ? "" : " add"}" data-r="${r}" aria-pressed="${on(r)}">${on(r) ? CK : PLUS}${r}</button>`;
  const rest = regs.filter((r) => !on(r));
  const pct = (k) => {
    const m = mastery(k, R0);
    return m.t ? Math.round((m.n / m.t) * 100) : 0;
  };
  const dt = dailyTask();
  const daily = dd
    ? ""
    : `<button class="dcard" data-daily><span class="dc-ic">${I.daily}</span><span class="dc-tx"><span class="dc-k">Daily challenge</span><b>${dt.text}</b><span class="dc-s">${dt.where}, +${DAILY_XP} bonus XP</span></span><span class="dc-go">Play</span></button>`;
  const desc = (k) =>
    sc ? MDESC[k].replace("country's", SB.unit + "'s").replace("country", SB.unit) : MDESC[k];
  const row = (k, tag, attrs) =>
    `<${tag} ${attrs}><span class="gp-ic">${I[k]}</span><span class="gp-tx"><b>${MODES[k].t}</b><span>${desc(k)}</span></span><span class="gp-p">${pct(k)}%</span>`;
  const top = `<div class="row-x"><h2 class="title">Play</h2><button class="x" data-close aria-label="Close">${I.x}</button></div>`;

  const others = Object.keys(MODES).filter((k) => k !== st.pick && !gOff(k));
  const tile = (k, i) => {
    const off = gOff(k),
      wide = others.length % 3 === 1 && i === others.length - 1;
    return `<button class="gtile${wide ? " wide" : ""}" role="option" ${off ? `disabled aria-disabled="true" title="${offTxt}"` : `data-pick="${k}"`} aria-selected="false">${cardArt(k)}<span class="gt-ic">${I[k]}</span><span class="gt-tx"><b>${MODES[k].t}</b>${wide ? `<span>${off ? offTxt : desc(k)}</span>` : ""}</span><span class="gt-p">${off ? "n/a" : pct(k) + "%"}</span></button>`;
  };
  const nUnits = SB ? SB.cs.filter((c) => inRegion(c, R0)).length : 0;
  const unitTxt = SB
    ? SB.extra && st.subx !== false
      ? (SB.units.includes(" and ")
          ? SB.units.replace(" and ", ", ") + " and "
          : SB.units + " and ") + SB.extra.txt
      : SB.units
    : "";
  const body = `${daily ? daily + '<div class="gap"></div>' : ""}
    <div class="scope" role="radiogroup" aria-label="Quiz on" style="--i:${sc ? 1 : 0}"><button role="radio" data-sc="world" aria-checked="${!sc}">${IC.globe}Countries</button><button role="radio" data-sc="sub" aria-checked="${sc}"><svg class="i" viewBox="0 0 24 24"><path d="M4 5h7v6H4zM13 5h7v9h-7zM4 13h7v6H4zM13 16h7v3h-7z"/></svg>States</button><span class="sc-k" aria-hidden="true"></span></div>
    <div class="gap"></div>
    <div class="cap gcap">Game type</div>
    <div class="gbox${pickOpen ? " open" : ""}" id="gbox">${row(st.pick, "button", `class="gpick" id="gpick" aria-expanded="${pickOpen}" aria-controls="glist"`)}${cardArt(st.pick)}<span class="gp-ch">${CHEV}</span></button>
    <div class="glist" id="glist" role="listbox" aria-label="Other game types" ${pickOpen ? "" : "hidden"}><div class="ggrid">${others.map(tile).join("")}</div></div></div>
    <div class="gap"></div>
    <div class="popts">
      ${
        sc
          ? `<span class="plabel">Country</span><div class="prow"><button class="cpick" data-cpick aria-haspopup="dialog" aria-label="Country: ${esc(SB.name)}, change">${flag(C.get(st.sub) || { a2: "" })}<b>${esc(SB.name)}</b><span class="gp-ch">${CHEV}</span></button></div>
      <div class="pnote">${esc(subCount(SB, st.subx !== false))}</div>
      ${SB.extra ? `<span class="plabel">Include</span><div class="prow" role="group" aria-label="Include"><button class="pill rchip${st.subx !== false ? "" : " off"}" data-subx aria-pressed="${st.subx !== false}">${st.subx !== false ? CK : PLUS}${esc(SB.extra.label)}</button></div>` : ""}`
          : `<span class="plabel">Region</span><div class="prow wrap" role="group" aria-label="Selected region">${regs.filter(on).map(chip).join("")}</div>
      ${rest.length ? `<div class="prow wrap ravail" role="group" aria-label="Add a region">${rest.map(chip).join("")}</div>` : ""}
      <div class="pnote">${isl ? `${G.countries.filter((c) => inRegion(c, "Islands")).length} islands worldwide${st.terr ? ", territories included" : ""}` : `${G.countries.filter((c) => inRegion(c, st.region)).length} countries${sel.length ? ` in ${sel.length === 1 ? sel[0] : sel.slice(0, -1).join(", ") + " and " + sel[sel.length - 1]}` : ", whole world"}`}</div>
      <span class="plabel">Include</span><div class="prow" role="group" aria-label="Include">${[
        ["isl", "Small islands", st.isl !== false],
        ["terr", "Territories", !!st.terr],
      ]
        .map(
          ([k, t, v]) =>
            `${k === "isl" && isl ? `<button class="pill rchip lock" disabled aria-disabled="true" aria-pressed="true" title="Always on for Islands">${CK}${t}</button>` : `<button class="pill rchip${v ? "" : " off"}" data-inc="${k}" aria-pressed="${v}">${v ? CK : PLUS}${t}</button>`}`,
        )
        .join("")}</div>`
      }
      <span class="plabel">Questions</span><div class="prow"><div class="seg" role="radiogroup" aria-label="Number of questions" style="--i:${Math.max(0, [10, 20, 30].indexOf(st.len))}">${[10, 20, 30].map((n) => `<button role="radio" data-l="${n}" aria-checked="${n === st.len}" aria-label="${n} questions">${n}</button>`).join("")}<span class="seg-k" aria-hidden="true"></span></div>
      <span class="tgl"><span class="plabel">Timer</span><button class="sw tsw" role="switch" data-t aria-checked="${!!st.timer}" aria-label="Timer"><span class="knob"><span class="on">${I.timer}</span><span class="off">${I.timerOff}</span></span></button></span></div>
    </div>`;
  const foot = `<button class="cta primary go" id="goPlay"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg><span>Start Game</span></button>`;
  sheetOpen("play", top, body, {
    snap: "full",
    foot,
    onClose: () =>
      setTimeout(() => {
        if (SH.kind === "play") return;
        document.body.classList.remove("psheet");
        if (!Q) {
          M.focus = null;
          M.sub = null;
          M.sched();
        }
        if (playMoved && !Q && !SH.kind) {
          playMoved = false;
          M.toRegion(S.settings.region, 700);
        }
      }, 40),
  });
  SH.body.scrollTop = keep;
  M.sub = sc ? st.sub : null;
  M.focus = sc ? null : isl ? new Set(["Islands"]) : sel.length ? new Set(sel) : null;
  M.sched();
  document.body.classList.add("psheet");
  if (!again && sc) {
    playMoved = true;
    setTimeout(
      () =>
        ensureSub(st.sub).then(() => {
          if (SH.kind === "play") {
            setInset();
            M.toRegion(R0);
          }
        }),
      120,
    );
  }
  if (prev && !reduced()) {
    [...SH.body.querySelectorAll(FL)].forEach((b, i) => {
      const a = prev.get(fk(b, i));
      if (!a) return;
      const n = b.getBoundingClientRect(),
        dx = a.left - n.left,
        dy = a.top - n.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      b.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], {
        duration: 380,
        easing: EASE,
      });
    });
    sheetResize(h0);
  }
  SH.foot.onclick = (e) => {
    if (e.target.closest("#goPlay"))
      startQuiz({ mode: st.pick, region: R0, n: st.len, timer: st.timer });
  };
  SH.body.onclick = (e) => {
    if (e.target.closest("[data-daily]")) {
      startDaily();
      return;
    }
    const scb = e.target.closest("[data-sc]");
    if (scb) {
      const v = scb.dataset.sc;
      if (v === st.scope || (v === "world" && !sc)) return;
      st.scope = v;
      save();
      const g = scb.parentNode;
      g.style.setProperty("--i", v === "sub" ? 1 : 0);
      g.querySelectorAll("[data-sc]").forEach((b) => b.setAttribute("aria-checked", b === scb));
      const R1 = v === "sub" ? "@" + st.sub : st.region;
      if (v === "sub" && poolFor(st.pick === "mixed" ? "locate" : st.pick, R1).length < 4) {
        st.pick = "locate";
        toast("Switched to Locate, that game type has no state version");
      }
      playMoved = true;
      setTimeout(() => {
        if (SH.kind === "play") openPlay();
        (v === "sub" ? ensureSub(st.sub) : Promise.resolve()).then(() => M.toRegion(R1));
      }, 200);
      return;
    }
    if (e.target.closest("[data-cpick]")) {
      countryPicker(st.sub, (k) => {
        if (k === st.sub) return;
        st.sub = k;
        save();
        playMoved = true;
        openPlay();
        ensureSub(k).then(() => {
          if (SH.kind === "play") M.toRegion("@" + k);
        });
      });
      return;
    }
    if (e.target.closest("[data-subx]")) {
      st.subx = st.subx === false;
      save();
      openPlay();
      return;
    }
    if (e.target.closest("#gpick")) {
      glist(!pickOpen);
      return;
    }
    const pk = e.target.closest("[data-pick]");
    if (pk) {
      st.pick = pk.dataset.pick;
      save();
      $$("[data-pick]", SH.body).forEach((o) => o.setAttribute("aria-selected", o === pk));
      glist(false, () => openPlay());
      return;
    }
    const r = e.target.closest("[data-r]"),
      l = e.target.closest("[data-l]"),
      t = e.target.closest("[data-t]");
    if (r) {
      const v = r.dataset.r;
      if (v === "World") st.region = "World";
      else if (v === "Islands") {
        st.region = isl ? "World" : "Islands";
        if (!isl && st.pick === "neighbours") {
          st.pick = "locate";
          toast("Islands have few land borders, switched to Locate");
        }
      } else {
        const s2 = new Set(sel);
        s2.has(v) ? s2.delete(v) : s2.add(v);
        st.region =
          !s2.size || s2.size === REGIONS.length
            ? "World"
            : REGIONS.filter((x) => s2.has(x)).join(",");
      }
      playMoved = true;
      save();
      openPlay();
      M.toRegion(st.region);
      return;
    }
    if (l) {
      st.len = +l.dataset.l;
      save();
      const g = l.parentNode;
      g.style.setProperty("--i", [10, 20, 30].indexOf(st.len));
      g.querySelectorAll("[data-l]").forEach((b) => b.setAttribute("aria-checked", b === l));
      return;
    }
    const inc = e.target.closest("[data-inc]");
    if (inc) {
      const k = inc.dataset.inc;
      st[k] = k === "isl" ? st.isl === false : !st[k];
      save();
      openPlay();
      return;
    }
    if (t) {
      st.timer = !st.timer;
      save();
      t.setAttribute("aria-checked", !!st.timer);
      return;
    }
  };
}

function coverage(on) {
  M.clear(["m1", "m2", "m3", "m4"]);
  M.dim = on;
  if (!on) {
    M.sched();
    return;
  }
  for (const c of sovereign) {
    const s = countryScore(c.id);
    if (s > 0) M.cls(c.id, "m" + Math.min(4, Math.ceil((s / 7) * 4)));
  }
}
const IC = {
  globe:
    '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  target:
    '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  check:
    '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></svg>',
  bolt: '<svg class="i" viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>',
  star: '<svg class="i" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  compass:
    '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  trophy:
    '<svg class="i" viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4"/></svg>',
  sun: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="i" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  gear: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  back: '<svg class="i" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
};
const ME_FOOT = () => {
  return `<a class="cta primary" href="${LINKS.support}" target="_blank" rel="noopener"><svg class="i" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="var(--pink)" stroke="none"/></svg>Support</a><a class="cta ghost" href="${LINKS.repo}" target="_blank" rel="noopener"><svg class="i" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" fill="currentColor" stroke="none"/></svg>GitHub</a>`;
};
const bIc = (b) => IC[b.ic] || I[b.ic] || IC.star;

const SHAPE = (() => {
  const poly = (n, r, rot = 0, rr = 7) => {
    const P = d3.range(n).map((i) => {
      const a = rot + (i * 2 * Math.PI) / n;
      return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
    });
    return roundPath(P, rr);
  };
  function roundPath(P, r) {
    let d = "";
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[(i + n - 1) % n],
        b = P[i],
        c = P[(i + 1) % n];
      const u = (p, q) => {
        const dx = q[0] - p[0],
          dy = q[1] - p[1],
          l = Math.hypot(dx, dy);
        return [dx / l, dy / l, l];
      };
      const [ux, uy, l1] = u(b, a),
        [vx, vy, l2] = u(b, c);
      const k = Math.min(r, l1 / 2, l2 / 2);
      const p1 = [b[0] + ux * k, b[1] + uy * k],
        p2 = [b[0] + vx * k, b[1] + vy * k];
      d +=
        (i ? "L" : "M") +
        p1.map((x) => x.toFixed(2)) +
        "Q" +
        b.map((x) => x.toFixed(2)) +
        " " +
        p2.map((x) => x.toFixed(2));
    }
    return d + "Z";
  }
  const seal = () => {
    const P = [];
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12 - Math.PI / 2,
        r = i % 2 ? 44 : 49;
      P.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
    }
    return roundPath(P, 3.5);
  };
  return {
    circle: "M50 2a48 48 0 1 0 .01 0Z",
    hex: poly(6, 49, -Math.PI / 2, 9),
    oct: poly(8, 49, Math.PI / 8, 7),
    pent: poly(5, 50, -Math.PI / 2, 10),
    diamond: poly(4, 51, -Math.PI / 2, 12),
    square: roundPath(
      [
        [6, 6],
        [94, 6],
        [94, 94],
        [6, 94],
      ],
      20,
    ),
    seal: seal(),
    shield: "M50 2C64 9 78 11 92 11V48C92 74 73 90 50 98C27 90 8 74 8 48V11C22 11 36 9 50 2Z",
  };
})();
const icInner = (b) =>
  bIc(b)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
let BID = 0;
const medal = (b, t, cls = "") => {
  const d = SHAPE[b.sh] || SHAPE.circle,
    id = "bc" + ++BID;
  return `<span class="medal t${t} ${cls}" aria-hidden="true"><svg viewBox="-4 -4 108 108"><defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>
  <path class="o" d="${d}"/><path class="f" d="${d}" transform="translate(50 50) scale(.84) translate(-50 -50)"/>
  <svg class="gi" x="27" y="27" width="46" height="46" viewBox="0 0 24 24">${icInner(b)}</svg>
  ${t ? `<g clip-path="url(#${id})"><g class="shn"><rect x="-20" y="-20" width="26" height="140" transform="skewX(-18)"/></g></g>` : ""}</svg>${t ? `<span class="tp">${TIERS[t - 1]}</span>` : ""}</span>`;
};
function openMe() {
  const L = lvlInfo(S.xp);
  const acc = S.tot.a ? Math.round((S.tot.c / S.tot.a) * 100) : 0;
  const R = ["World", ...REGIONS, "Islands"];
  const top = `<div class="row-x"><div><h2 class="title">Level ${L.n}</h2><div class="cap" style="margin-top:3px">${L.into} / ${L.need} XP</div></div><span class="hbtns end"><button class="x" id="toTheme" aria-label="${S.settings.night ? "Switch to light theme" : "Switch to dark theme"}">${S.settings.night ? IC.sun : IC.moon}</button><button class="x" id="toSet" aria-label="Settings">${IC.gear}</button><button class="x" data-close aria-label="Close">${I.x}</button></span></div><div class="xpbar" style="margin-top:12px"><i style="width:${L.pct}%"></i></div>`;
  const stat = (ic, v, t) => `<div><span class="si">${ic}</span><b>${v}</b><span>${t}</span></div>`;
  const body = `<div class="grid-stats">
      ${stat(IC.star, nf.format(S.xp), "XP")}${stat(IC.target, acc + "%", "Accuracy")}${stat(I.flame, dayStreak(), "Day streak")}
    </div>
    <div class="gap"></div><div class="cap">Mastery %</div>
    <div class="mx" role="table" aria-label="Mastery by mode and region"><span></span>${R.map((r) => `<span class="mx-h" title="${r}">${RSHORT[r]}</span>`).join("")}
    ${SKILLS.map(
      (m) =>
        `<span class="mt-m">${I[m]}${MODES[m].t}</span>${R.map((r) => {
          const x = mastery(m, r);
          const p = x.t ? Math.round((x.n / x.t) * 100) : 0;
          return `<span class="hc${p ? "" : " z"}${p >= 55 ? " hi" : ""}" style="--h:${p}%" title="${MODES[m].t}, ${r}: ${p}%">${p}</span>`;
        }).join("")}`,
    ).join("")}
    </div>
    <div class="mt-leg"><span>0</span><i style="--h:0%"></i><i style="--h:25%"></i><i style="--h:50%"></i><i style="--h:75%"></i><i style="--h:100%"></i><span>100%</span></div>
    <div class="mt-key">${R.map((r) => `<span><b>${RSHORT[r]}</b> ${r}</span>`).join("")}</div>
    <div class="gap"></div><div class="cap">Achievements ${BADGES.filter((b) => badgeTier(b) > 0).length}/${BADGES.length}</div>
    <div class="achg">${BADGES.map((b) => ({ b, t: badgeTier(b), v: b.v() }))
      .sort((x, y) => y.t - x.t || y.v / y.b.at[Math.min(y.t, 2)] - x.v / x.b.at[Math.min(x.t, 2)])
      .map(({ b, t, v }, i) => {
        const nx = b.at[t];
        return `<button class="achc${t ? " on" : ""}" style="--i:${i}" data-badge="${b.id}" aria-label="${b.t}, ${t ? TIERS[t - 1] : "locked"}">${medal(b, t)}<span class="at">${b.t}</span><span class="ap">${nx ? `${nf.format(Math.min(v, nx))}/${nf.format(nx)}` : "Maxed"}</span></button>`;
      })
      .join("")}</div>`;
  sheetOpen("me", top, body, { snap: "full", onClose: () => coverage(false) });
  coverage(true);
  SH.top.onclick = (e) => {
    if (e.target.closest("#toSet")) {
      openSettings();
      return;
    }
    const th = e.target.closest("#toTheme");
    if (th) {
      S.settings.night = !S.settings.night;
      save();
      applyTheme();
      th.innerHTML = S.settings.night ? IC.sun : IC.moon;
      th.setAttribute(
        "aria-label",
        S.settings.night ? "Switch to light theme" : "Switch to dark theme",
      );
    }
  };
  SH.body.onclick = (e) => {
    const c = e.target.closest("[data-badge]");
    if (c) badgeInfo(BADGES.find((b) => b.id === c.dataset.badge));
  };
  if (!reduced())
    for (const el of SH.body.querySelectorAll(".achc.on")) {
      el.onpointermove = (e) => {
        const r = el.querySelector(".medal").getBoundingClientRect();
        el.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 18 + "deg");
        el.style.setProperty("--rx", (0.5 - (e.clientY - r.top) / r.height) * 18 + "deg");
        el.classList.add("tilt");
      };
      el.onpointerleave = () => {
        el.classList.remove("tilt");
        el.style.removeProperty("--rx");
        el.style.removeProperty("--ry");
      };
    }
}
function openSettings() {
  const st = S.settings;
  const sw = (k, label, on, sub = "") =>
    `<div class="set"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><button class="sw" role="switch" data-s="${k}" aria-checked="${on}" aria-label="${label}"></button></div>`;
  const top = `<div class="row-x"><span class="hbtns"><button class="x" data-back aria-label="Back to level">${IC.back}</button><h2 class="title">Settings</h2></span><button class="x" data-close aria-label="Close">${I.x}</button></div>`;
  const body = `<div class="cap">Display</div>
    ${sw("night", "Night", !!st.night)}
    ${sw("labels", "Map labels", st.labels !== false, "Turn off to practise on a blank map")}
    ${sw("calm", "Reduce motion", !!st.calm, "Fewer animations and instant map moves")}
    <div class="set"><span>Units</span><span class="pills"><button class="pill" data-u="km" aria-pressed="${st.units !== "mi"}">km</button><button class="pill" data-u="mi" aria-pressed="${st.units === "mi"}">miles</button></span></div>
    <div class="gap"></div><div class="cap">Sound</div>
    ${sw("sound", "Sound effects", !!st.sound)}
    <div class="gap"></div><div class="cap">Progress</div>
    <div class="set"><span>Back up<small>Save your progress to a file</small></span><button class="pill" id="bkUp">Download</button></div>
    <div class="set"><span>Restore<small>Load progress from a backup file</small></span><button class="pill" id="bkIn">Choose file</button><input type="file" id="bkFile" accept=".json,application/json" hidden></div>
    <div class="set"><span>Reset<small>Erase XP, mastery and achievements</small></span><span id="rs" style="display:flex;gap:6px"><button class="pill" id="rsGo">Reset</button></span></div>
    <div class="gap"></div><div class="cap" style="text-transform:none;letter-spacing:0;line-height:1.5">Borders: Natural Earth. Capitals: SimpleMaps (CC BY 4.0). Population: World Bank (latest year shown per country). Pronunciation: AI4Bharat Indic-TTS, Kokoro, Piper, Mimic 3, Coqui and Meta MMS voices, with eSpeak NG as a fallback; IPA from eSpeak NG. Geoid: EGM96. Flags: Wikimedia Commons.</div>`;
  sheetOpen("settings", top, body, { snap: "full", foot: ME_FOOT() });
  SH.top.onclick = (e) => {
    if (e.target.closest("[data-back]")) openMe();
  };
  $("#bkFile").onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (typeof o.xp !== "number" || typeof o.prog !== "object") throw 0;
        const d = defaults();
        S = Object.assign(d, o, { settings: Object.assign(d.settings, o.settings || {}) });
        save();
        applyTheme();
        applySound();
        renderChrome();
        openSettings();
        toast("Progress restored");
      } catch (err) {
        toast("That file is not a GeoZest backup");
      }
    };
    rd.readAsText(f);
  };
  SH.body.onclick = (e) => {
    const s2 = e.target.closest("[data-s]");
    if (s2) {
      const k = s2.dataset.s;
      const cur = k === "labels" ? st.labels !== false : !!st[k];
      st[k] = !cur;
      if (k === "night") applyTheme();
      if (k === "sound") applySound();
      if (k === "labels") {
        M.labels = st.labels;
        M.sched();
        applyLbl();
      }
      if (k === "calm") document.documentElement.classList.toggle("calm", st.calm);
      save();
      s2.setAttribute("aria-checked", !cur);
      return;
    }
    const u = e.target.closest("[data-u]");
    if (u) {
      st.units = u.dataset.u;
      save();
      $$("[data-u]", SH.body).forEach((b) => b.setAttribute("aria-pressed", b === u));
      M.lastSig = null;
      return;
    }
    if (e.target.closest("#bkUp")) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" }));
      a.download = `geozest-progress-${todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
      toast("Backup downloaded");
      return;
    }
    if (e.target.closest("#bkIn")) {
      $("#bkFile").click();
      return;
    }
    if (e.target.closest("#rsGo")) {
      $("#rs").innerHTML =
        `<button class="pill" id="rsNo">Keep</button><button class="pill" id="rsYes" style="background:var(--pink);color:#fff">Erase all</button>`;
      return;
    }
    if (e.target.closest("#rsNo")) {
      $("#rs").innerHTML = `<button class="pill" id="rsGo">Reset</button>`;
      return;
    }
    if (e.target.closest("#rsYes")) {
      const keep = S.settings;
      S = defaults();
      S.settings = keep;
      save();
      renderChrome();
      openSettings();
      toast("Progress erased");
    }
  };
}
function setProj(p) {
  if (M.busy || p === M.current()) return;
  S.settings.proj = p;
  if (p === "geoid") {
    S.settings.geoHeat = true;
    M.geoHeatOn = true;
    M.geoHeat = 1;
  }
  save();
  renderChrome();
  M.setProjection(p);
  toast(
    {
      globe: "Globe: no stretching, no distortion",
      geoid: "Geoid: Earth's true gravity shape, heights exaggerated",
      ee: "Equal Earth: every country at its true size",
      merc: "Mercator: true shapes, areas swell toward the poles",
    }[p],
  );
  if (SH.kind === "settings")
    $$("[data-pj]", SH.body).forEach((b) => b.setAttribute("aria-pressed", b.dataset.pj === p));
}
