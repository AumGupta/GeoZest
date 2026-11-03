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

const ACH = [
  { id: "first", t: "Finish a quiz", p: () => [Math.min(1, S.sessions.length), 1] },
  {
    id: "flawless",
    t: "100% on 10+ questions",
    p: () => [S.sessions.some((s) => s.total >= 10 && s.correct === s.total) ? 1 : 0, 1],
  },
  { id: "hot10", t: "10 correct in a row", p: () => [Math.min(S.best, 10), 10] },
  { id: "hot25", t: "25 correct in a row", p: () => [Math.min(S.best, 25), 25] },
  { id: "explorer", t: "Open 25 countries", p: () => [Math.min(S.viewed.length, 25), 25] },
  { id: "vex", t: "Master 50 flags", p: () => [Math.min(mastery("flags").n, 50), 50] },
  {
    id: "capitals",
    t: "Master 100 capitals",
    p: () => [Math.min(mastery("capitals").n, 100), 100],
  },
  {
    id: "cartog",
    t: "Locate all of one region",
    p: () => {
      const b = Math.max(
        ...REGIONS.map((r) => {
          const m = mastery("locate", r);
          return m.n / m.t;
        }),
      );
      return [Math.round(b * 100), 100];
    },
  },
  { id: "poly", t: "Master 30 in Languages", p: () => [Math.min(mastery("languages").n, 30), 30] },
  { id: "days3", t: "3-day streak", p: () => [Math.min(dayStreak(), 3), 3] },
  { id: "days7", t: "7-day streak", p: () => [Math.min(dayStreak(), 7), 7] },
  { id: "lvl5", t: "Reach level 5", p: () => [Math.min(lvlInfo(S.xp).n, 5), 5] },
];
function checkAch() {
  const got = [];
  for (const a of ACH) {
    if (S.ach[a.id]) continue;
    const [v, m] = a.p();
    if (v >= m) {
      S.ach[a.id] = todayKey();
      got.push(a);
    }
  }
  if (got.length) {
    save();
    got.forEach((a, i) => setTimeout(() => toast(a.t), i * 2000 + 400));
  }
}

function renderChrome() {
  const L = lvlInfo(S.xp);
  $("#meLvl").textContent = L.n;
  $("#meRing").style.setProperty("--p", L.pct);
  $("#btnProj").textContent =
    { globe: "3D", geoid: "GEO", ee: "EE", merc: "MRC" }[S.settings.proj] || "3D";
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
      <div><div class="k">Area</div><div class="v mono">${fmtArea(c.ar)} km²</div></div>
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
function openCountry(id) {
  const c = C.get(id);
  if (!c) return;
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

function openPlay() {
  const st = S.settings;
  const dd = S.daily[todayKey()];
  const keep = SH.kind === "play" ? SH.body.scrollTop : 0;
  const top = `<div class="row-x"><h2 class="title">Play</h2><button class="x" data-close aria-label="Close">${I.x}</button></div>`;
  const body = `<div class="scroller">${["World", ...REGIONS].map((r) => `<button class="pill" data-r="${r}" aria-pressed="${r === st.region}">${r}</button>`).join("")}</div>
    <div style="display:flex;gap:6px;margin-top:8px;align-items:center">${[10, 20, 30].map((n) => `<button class="pill mono" data-l="${n}" aria-pressed="${n === st.len}">${n}</button>`).join("")}
      <button class="pill" data-t aria-pressed="${st.timer}" style="margin-left:auto">${I.timer}Timer</button></div>
    <div class="gap"></div>
    <ul class="list">
      <li><button class="li" data-daily ${dd ? "disabled" : ""}><span class="ic">${I.daily}</span><span class="n">Daily</span><span class="r">${dd ? `${dd.c}/${dd.t}` : `<span class="ydot"></span>`}</span></button></li>
      ${Object.keys(MODES)
        .map((k) => {
          const m = mastery(k, st.region);
          const p = m.t ? Math.round((m.n / m.t) * 100) : 0;
          return `<li><button class="li" data-m="${k}"><span class="ic">${I[k]}</span><span class="n">${MODES[k].t}</span><span class="r">${p}%</span></button></li>`;
        })
        .join("")}
    </ul>`;
  sheetOpen("play", top, body, { snap: "full" });
  SH.body.scrollTop = keep;
  SH.body.onclick = (e) => {
    const r = e.target.closest("[data-r]"),
      l = e.target.closest("[data-l]"),
      t = e.target.closest("[data-t]"),
      m = e.target.closest("[data-m]"),
      d = e.target.closest("[data-daily]");
    if (r) {
      st.region = r.dataset.r;
      save();
      openPlay();
      M.toRegion(st.region);
      return;
    }
    if (l) {
      st.len = +l.dataset.l;
      save();
      openPlay();
      return;
    }
    if (t) {
      st.timer = !st.timer;
      save();
      openPlay();
      return;
    }
    if (d && !d.disabled) {
      startDaily();
      return;
    }
    if (m) startQuiz({ mode: m.dataset.m, region: st.region, n: st.len, timer: st.timer });
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
function openMe() {
  const L = lvlInfo(S.xp);
  const acc = S.tot.a ? Math.round((S.tot.c / S.tot.a) * 100) : 0;
  const known = sovereign.filter((c) => countryScore(c.id) > 0).length;
  const R = ["World", ...REGIONS];
  const top = `<div class="row-x"><div><h2 class="title">Level ${L.n}</h2><div class="cap" style="margin-top:3px">${L.into} / ${L.need} XP</div></div><button class="x" data-close aria-label="Close">${I.x}</button></div><div class="xpbar" style="margin-top:12px"><i style="width:${L.pct}%"></i></div>`;
  const body = `<div class="grid-stats">
      <div><b>${known}</b><span>Known</span></div><div><b>${acc}%</b><span>Accuracy</span></div><div><b>${dayStreak()}</b><span>Day streak</span></div>
      <div><b>${nf.format(S.tot.a)}</b><span>Answers</span></div><div><b>${S.best}</b><span>Best run</span></div><div><b>${nf.format(S.xp)}</b><span>XP</span></div>
    </div>
    <div class="gap"></div><div class="cap">Mastery %</div>
    <table class="mt"><thead><tr><th></th>${R.map((r) => `<th>${RSHORT[r]}</th>`).join("")}</tr></thead><tbody>
    ${SKILLS.map(
      (m) =>
        `<tr><td>${MODES[m].t}</td>${R.map((r) => {
          const x = mastery(m, r);
          const p = x.t ? Math.round((x.n / x.t) * 100) : 0;
          return `<td class="${p ? "" : "z"}">${p}</td>`;
        }).join("")}</tr>`,
    ).join("")}
    </tbody></table>
    <div class="gap"></div><div class="cap">Achievements ${Object.keys(S.ach).length}/${ACH.length}</div>
    ${ACH.map((a) => {
      const [v, m] = a.p();
      const on = !!S.ach[a.id];
      return `<div class="ach ${on ? "on" : ""}"><i></i><span>${a.t}</span><span class="mono" style="flex:none;font-size:12px;color:var(--muted)">${on ? "" : v + "/" + m}</span></div>`;
    }).join("")}
    <div class="gap"></div><div class="cap">Settings</div>
    <div class="set"><span>Night</span><button class="sw" role="switch" data-s="night" aria-checked="${!!S.settings.night}" aria-label="Night"></button></div>
    <div class="set"><span>Sound</span><button class="sw" role="switch" data-s="sound" aria-checked="${!!S.settings.sound}" aria-label="Sound"></button></div>
    <div class="set" style="align-items:flex-start"><span style="padding-top:5px">Map</span><span class="pills" style="justify-content:flex-end">${[
      ["globe", "Globe"],
      ["geoid", "Geoid"],
      ["ee", "Equal Earth"],
      ["merc", "Mercator"],
    ]
      .map(
        ([k, t]) =>
          `<button class="pill" data-pj="${k}" aria-pressed="${S.settings.proj === k}">${t}</button>`,
      )
      .join("")}</span></div>
    <div class="set"><span>Territories in quizzes</span><button class="sw" role="switch" data-s="terr" aria-checked="${!!S.settings.terr}" aria-label="Territories in quizzes"></button></div>
    <div class="set"><span>Timer</span><button class="sw" role="switch" data-s="timer" aria-checked="${!!S.settings.timer}" aria-label="Timer"></button></div>
    <div class="set"><span>Progress</span><span id="rs" style="display:flex;gap:6px"><button class="pill" id="rsGo">Reset</button></span></div>
    <div class="gap"></div><div class="cap" style="text-transform:none;letter-spacing:0;line-height:1.5">Borders: Natural Earth. Capitals: SimpleMaps (CC BY 4.0). Population: World Bank (latest year shown per country). Pronunciation: AI4Bharat Indic-TTS, Kokoro, Piper, Mimic 3, Coqui and Meta MMS voices, with eSpeak NG as a fallback; IPA from eSpeak NG. Geoid: EGM96. Flags: Wikimedia Commons.</div>`;
  const foot = `<a class="cta primary" href="${LINKS.support}" target="_blank" rel="noopener"><svg class="i" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="var(--pink)" stroke="none"/></svg>Support</a><a class="cta ghost" href="${LINKS.repo}" target="_blank" rel="noopener"><svg class="i" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" fill="currentColor" stroke="none"/></svg>GitHub</a>`;
  sheetOpen("me", top, body, { snap: "full", foot, onClose: () => coverage(false) });
  coverage(true);
  SH.body.onclick = (e) => {
    const pj = e.target.closest("[data-pj]");
    if (pj) {
      setProj(pj.dataset.pj);
      return;
    }
    const s = e.target.closest("[data-s]");
    if (s) {
      const k = s.dataset.s;
      if (k === "night") {
        S.settings.night = !S.settings.night;
        applyTheme();
      } else if (k === "merc") {
        setProj(S.settings.proj === "merc" ? "ee" : "merc");
      } else {
        S.settings[k] = !S.settings[k];
        if (k === "sound") applySound();
      }
      save();
      s.setAttribute("aria-checked", k === "merc" ? S.settings.proj === "merc" : !!S.settings[k]);
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
      openMe();
      toast("Progress erased");
    }
  };
}
function setProj(p) {
  if (M.busy || p === M.current()) return;
  S.settings.proj = p;
  save();
  renderChrome();
  M.setProjection(p);
  toast(
    {
      globe: "Globe: the Earth as it really is",
      geoid: "Geoid: Earth's true gravity shape, heights exaggerated",
      ee: "Equal Earth: every area true to scale",
      merc: "Mercator: true shapes, areas swell toward the poles",
    }[p],
  );
  if (SH.kind === "me")
    $$("[data-pj]", SH.body).forEach((b) => b.setAttribute("aria-pressed", b.dataset.pj === p));
}
