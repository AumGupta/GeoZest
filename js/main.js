"use strict";

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input")) return;
  if (Q && !Q.answered && Q.qs[Q.i].kind === "mc") {
    const i = "1234".indexOf(e.key);
    if (i >= 0 && Q.qs[Q.i].opts[i]) answer(Q.qs[Q.i].opts[i].id);
    return;
  }
  if (
    Q &&
    Q.answered &&
    (e.key === "Enter" || e.key === " ") &&
    document.activeElement?.id !== "nx"
  ) {
    e.preventDefault();
    next();
    return;
  }
  if (e.key === "Escape") {
    if (Q || $("#qp")) endQuiz();
    else sheetClose();
  }
  if (e.key === "/" && !Q && !$("#qp")) {
    e.preventDefault();
    openSearch();
  }
});
$("#btnSearch").onclick = openSearch;
$("#btnPlay").onclick = openPlay;
$("#btnMe").onclick = () => (SH.kind === "me" ? sheetClose() : openMe());
$("#btnBrand").onclick = () => (SH.kind === "settings" ? sheetClose() : openSettings());
function pjOpen(on) {
  const f = $("#pjFly"),
    b = $("#btnProj");
  if (on)
    f.innerHTML = PJ.filter(([k]) => k !== S.settings.proj)
      .map(
        ([k, a, t]) =>
          `<button role="menuitem" data-pjo="${k}"><b>${a}</b><span>${t}</span></button>`,
      )
      .join("");
  $("#vbox").classList.toggle("open", on);
  b.setAttribute("aria-expanded", on);
}
$("#btnProj").onclick = (e) => {
  e.stopPropagation();
  pjOpen(!$("#vbox").classList.contains("open"));
};
$("#pjFly").onclick = (e) => {
  const o = e.target.closest("[data-pjo]");
  if (!o) return;
  pjOpen(false);
  setProj(o.dataset.pjo);
};
document.addEventListener(
  "pointerdown",
  (e) => {
    if ($("#vbox").classList.contains("open") && !e.target.closest("#pjFly,#btnProj"))
      pjOpen(false);
  },
  true,
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") pjOpen(false);
});
$("#btnSound").onclick = () => {
  S.settings.sound = !S.settings.sound;
  save();
  applySound();
  if (S.settings.sound) SND.play("tap");
};
$("#btnLoc").onclick = recenter;
$("#btnLbl").onclick = () => {
  const on = S.settings.labels === false;
  S.settings.labels = on;
  save();
  applyLbl();
  M.labels = on;
  M.sched();
  toast(on ? "Map labels on" : "Blank map: labels off");
};
$("#zIn").onclick = () => M.zoomBy(2);
$("#zOut").onclick = () => M.zoomBy(0.5);
addEventListener("resize", () => {
  if (!SH.el.hidden && SH.state !== "closed") {
    if (isPhone()) {
      SH.el.style.left = SH.el.style.top = "";
      SH.el.style.maxHeight = "";
      snapTo(SH.state || "full");
    } else {
      SH.el.style.transform = "";
      if (!SH.pos) SH.pos = { x: 16, y: 68 };
      placeDesk();
      setInset();
    }
  }
});
function recenter() {
  if (selected) {
    M.toId(selected, 0.7, 800);
    return;
  }
  if (Q && Q.answered) {
    M.toId(Q.qs[Q.i].ans, 0.82, 800);
    return;
  }
  if (Q) {
    const q = Q.qs[Q.i];
    if (q.kind !== "map" && q.hint) M.toId(q.id, 0.6, 800);
    else regionView();
    return;
  }
  goHome();
}
function goHome() {
  if (!HOME) {
    M.world();
    return;
  }
  if (!Q) {
    M.cls(HOME, "home");
    setTimeout(() => M.cls(HOME, "home", false), 2200);
  }
  M.toId(HOME, M.mode === "globe" ? 0.8 : isPhone() ? 0.42 : 0.38, 1000);
}

M.init();
M.onClick = exploreClick;
renderChrome();
M.geoLegend();
$("#geoSw").onclick = () => {
  const on = !M.geoHeatOn;
  S.settings.geoHeat = on;
  save();
  M.setHeat(on);
};
if (M.mode === "globe") {
  M.gs = M.gR0();
  M.gR0Last = M.gs;
  const a = M.avail();
  M.gtx = a.x + a.w / 2;
  M.gty = a.y + a.h / 2;
  M.cv.__zoom = d3.zoomIdentity.scale(100);
}
requestAnimationFrame(() => {
  if (M.mode === "globe") M.world(0);
  else if (HOME) M.toId(HOME, isPhone() ? 0.28 : 0.3, 0);
  else M.world(0);
});
if (!S.badges2) checkBadges();
