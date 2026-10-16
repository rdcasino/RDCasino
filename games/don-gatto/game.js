(function () {
"use strict";
var O = "#1a1026", FUR = "#3b3f5c", FUR2 = "#2b2e46", WH = "#f4f1ea", SUIT = "#2c2f4a";
var uid = 0; function U(p) { return p + (++uid); }
function P(d, fill, sw, extra) { return '<path d="' + d + '" fill="' + fill + '" stroke="' + O + '" stroke-width="' + (sw == null ? 6 : sw) + '" stroke-linejoin="round" stroke-linecap="round"' + (extra || "") + "/>"; }
function shaded(d, base, shadowD, shadow, hiD) {
  var c = U("c");
  return '<clipPath id="' + c + '"><path d="' + d + '"/></clipPath><path d="' + d + '" fill="' + base + '"/>' +
    (shadowD ? '<path d="' + shadowD + '" fill="' + shadow + '" clip-path="url(#' + c + ')"/>' : "") +
    (hiD ? '<path d="' + hiD + '" fill="#fff" opacity=".3" clip-path="url(#' + c + ')"/>' : "") +
    '<path d="' + d + '" fill="none" stroke="' + O + '" stroke-width="6" stroke-linejoin="round"/>';
}
function $(id) { return document.getElementById(id); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function money(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function rnd(a, b) { return a + Math.random() * (b - a); }

/* ================= PERSONAGEM ================= */
function eyeParts(x, y, side, mode) {
  function al(w, top, bot) { return "M" + (x - w) + " " + y + "Q" + x + " " + (y - top) + " " + (x + w) + " " + y + "Q" + x + " " + (y + bot) + " " + (x - w) + " " + y + "Z"; }
  if (mode === "closed") return ["", null, "", '<path d="M' + (x - 22) + " " + (y - 2) + "Q" + x + " " + (y + 12) + " " + (x + 22) + " " + (y - 2) + '" stroke="' + O + '" stroke-width="6" fill="none" stroke-linecap="round"/>'];
  var d, pupil, over = "", hl = '<circle cx="' + (x - 8) + '" cy="' + (y - 8) + '" r="3.5" fill="#fff"/>';
  if (mode === "angry") {
    d = side > 0 ? "M" + (x - 24) + " " + (y - 6) + "L" + (x + 22) + " " + (y + 4) + "Q" + x + " " + (y + 22) + " " + (x - 24) + " " + (y - 6) + "Z" : "M" + (x + 24) + " " + (y - 6) + "L" + (x - 22) + " " + (y + 4) + "Q" + x + " " + (y + 22) + " " + (x + 24) + " " + (y - 6) + "Z";
    pupil = '<ellipse cx="' + x + '" cy="' + (y + 7) + '" rx="4" ry="7" fill="' + O + '"/>';
    over = '<path d="M' + (x - 26 * side) + " " + (y - 22) + "L" + (x + 22 * side) + " " + (y - 5) + '" stroke="' + O + '" stroke-width="9" stroke-linecap="round"/>';
  } else if (mode === "smug") {
    d = al(24, 16, 20);
    pupil = '<ellipse cx="' + x + '" cy="' + (y + 2) + '" rx="4.5" ry="12" fill="' + O + '"/>';
    over = P("M" + (x - 26) + " " + (y - 1) + "Q" + x + " " + (y - 20) + " " + (x + 26) + " " + (y - 1) + "L" + (x + 24) + " " + (y + 2) + "Q" + x + " " + (y - 2) + " " + (x - 24) + " " + (y + 2) + "Z", FUR, 5) +
      '<path d="M' + (x - 22 * side) + " " + (y - 22) + "L" + (x + 20 * side) + " " + (y - 14) + '" stroke="' + O + '" stroke-width="6" stroke-linecap="round"/>';
  } else if (mode === "wide") {
    d = al(25, 30, 28);
    pupil = '<circle cx="' + x + '" cy="' + y + '" r="9" fill="' + O + '"/><circle cx="' + (x - 4) + '" cy="' + (y - 5) + '" r="3.5" fill="#fff"/>';
    over = '<path d="M' + (x - 22 * side) + " " + (y - 42) + "Q" + x + " " + (y - 52) + " " + (x + 20 * side) + " " + (y - 42) + '" stroke="' + O + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
  } else {
    d = al(24, 26, 24);
    pupil = mode === "dollar" ? '<text x="' + x + '" y="' + (y + 11) + '" text-anchor="middle" font-family="Luckiest Guy, Arial Black, sans-serif" font-size="32" fill="#22b35e" stroke="' + O + '" stroke-width="2.5" paint-order="stroke">$</text>' : '<ellipse cx="' + x + '" cy="' + y + '" rx="5" ry="14" fill="' + O + '"/>' + hl;
    over = '<path d="M' + (x - 22 * side) + " " + (y - 31) + "Q" + x + " " + (y - 41) + " " + (x + 20 * side) + " " + (y - 31) + '" stroke="' + O + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
  }
  return ['<path d="' + d + '" fill="#ffd447"/>', d, pupil, '<path d="' + d + '" fill="none" stroke="' + O + '" stroke-width="5" stroke-linejoin="round"/>' + over];
}
function eyesSVG(mL, mR) {
  var s = "";
  [[114, 1, mL], [186, -1, mR]].forEach(function (e) {
    var p = eyeParts(e[0], 168, e[1], e[2]);
    if (p[1]) { var c = U("ec"); s += p[0] + '<clipPath id="' + c + '"><path d="' + p[1] + '"/></clipPath><g clip-path="url(#' + c + ')"><g class="pup">' + p[2] + "</g></g>"; }
    s += p[3];
  });
  return s;
}
function mouthSVG(m) {
  if (m === "grin") return P("M118 214Q150 258 182 214Z", "#7a1f3d", 5) + '<path d="M124 217H176" stroke="#fff" stroke-width="7"/><path d="M138 238q12 9 24 0" fill="#ff7a9c"/>';
  if (m === "angry") return P("M126 233Q150 215 174 233", "none", 6) + P("M164 226 168 237 172 224Z", "#fff", 3);
  if (m === "o") return P("M150 206V213", "none", 5) + '<ellipse cx="150" cy="228" rx="9" ry="11" fill="#7a1f3d" stroke="' + O + '" stroke-width="5"/>';
  if (m === "smile") return P("M150 208V216M150 216Q138 229 125 216M150 216Q162 229 175 216", "none", 5);
  return P("M150 208V216M150 216Q138 226 128 218M150 216Q166 222 178 210", "none", 5) +
    '<path d="M176 214 214 230" stroke="' + O + '" stroke-width="9" stroke-linecap="round"/><path d="M177 214.5 212 229" stroke="#e8c78f" stroke-width="4.5" stroke-linecap="round"/><path d="M201 225 206 227" stroke="#d22f3f" stroke-width="5"/><circle id="ember" cx="214" cy="230" r="4" fill="#ff7a2e"/>';
}
function headSVG() {
  var hd = "M66 178C66 120 102 90 150 90C198 90 234 120 234 178C234 232 198 262 150 262C102 262 66 232 66 178Z";
  return '<g id="earL">' + P("M84 126 74 58 128 96Z", FUR, 6) + P("M90 112 86 76 114 98Z", "#ff9fb4", 0) + "</g>" +
    '<g id="earR">' + P("M216 126 226 58 172 96Z", FUR, 6) + P("M210 112 214 76 186 98Z", "#ff9fb4", 0) + "</g>" +
    shaded(hd, FUR, "M150 90C198 90 234 120 234 178C234 232 198 262 150 262C184 232 196 200 194 166C192 130 176 104 150 90Z", FUR2, "M92 140C100 116 120 100 142 96C124 108 108 126 100 148Z") +
    shaded("M106 214C106 190 126 182 150 182C174 182 194 190 194 214C194 242 174 258 150 258C126 258 106 242 106 214Z", WH, "M150 182C174 182 194 190 194 214C194 242 174 258 150 258C168 240 174 214 166 186Z", "#d9d4ca") +
    '<g id="eyes"></g>' + P("M140 196H160L150 208Z", "#ff8aa5", 4) + '<g id="mouth"></g>' +
    '<path d="M104 212H62M104 222 66 236M196 212h42M196 222l38 14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>' +
    '<g id="hat">' + shaded("M90 104C90 62 112 40 150 40C188 40 210 62 210 104Z", "#22243a", "M150 40C188 40 210 62 210 104H164C172 80 166 56 150 40Z", "#17182a", "M104 96C104 70 116 54 132 48C120 62 114 78 114 96Z") +
    '<path d="M150 42C142 54 142 62 150 70C158 62 158 54 150 42Z" fill="#17182a"/><path d="M92 92H208" stroke="' + O + '" stroke-width="17"/><path d="M92 92H208" stroke="#d22f3f" stroke-width="10"/>' +
    P("M38 108Q150 82 262 108Q236 120 150 118Q64 120 38 108Z", SUIT, 6) + "</g>" +
    '<circle id="tip" cx="214" cy="230" r="1" fill="none"/>';
}
function bodySVG() {
  var suit = "M14 430V360C14 292 70 256 150 254C230 256 286 292 286 360V430Z", sc = U("sc");
  return shaded(suit, SUIT, "M150 254C230 256 286 292 286 360V430H196V340C200 310 190 276 150 254Z", "#1e2036") +
    '<clipPath id="' + sc + '"><path d="' + suit + '"/></clipPath><g clip-path="url(#' + sc + ')" stroke="#4b4f74" stroke-width="2.5">' + [40, 70, 100, 200, 230, 260].map(function (x) { return '<path d="M' + x + ' 250V430"/>'; }).join("") + "</g>" +
    '<path d="' + suit + '" fill="none" stroke="' + O + '" stroke-width="6"/>' +
    P("M120 256 150 360 180 256C170 252 160 250 150 250C140 250 130 252 120 256Z", WH, 5) +
    P("M142 266 158 266 162 340 150 352 138 340Z", "#d22f3f", 5) + P("M138 260H162L156 272H144Z", "#a8202e", 4) +
    P("M120 256 140 336 150 296Z", "#383c5e", 5) + P("M180 256 160 336 150 296Z", "#383c5e", 5) +
    '<path d="M86 302h22" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M85 298l7 8 7-10 7 10" stroke="#ff5470" stroke-width="3" fill="none"/>';
}
function tailSVG() {
  var d = "M236 352C296 354 322 300 302 246C294 222 302 204 322 200";
  return '<path d="' + d + '" fill="none" stroke="' + O + '" stroke-width="34" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="' + FUR + '" stroke-width="22" stroke-linecap="round"/><path d="M306 214C308 206 314 202 322 200" fill="none" stroke="' + FUR2 + '" stroke-width="22" stroke-linecap="round"/>';
}
function armSVG(id, px, py, ex, ey) {
  var mx = px + (ex - px) * 0.72, my = py + (ey - py) * 0.72;
  return '<g id="' + id + '"><path d="M' + px + " " + py + "L" + ex + " " + ey + '" stroke="' + O + '" stroke-width="46" stroke-linecap="round"/><path d="M' + px + " " + py + "L" + ex + " " + ey + '" stroke="' + SUIT + '" stroke-width="34" stroke-linecap="round"/>' +
    '<path d="M' + mx + " " + my + "L" + ex + " " + ey + '" stroke="' + WH + '" stroke-width="34" stroke-linecap="round"/>' +
    '<circle cx="' + ex + '" cy="' + (ey + 8) + '" r="20" fill="' + WH + '" stroke="' + O + '" stroke-width="6"/><path d="M' + (ex - 7) + " " + (ey + 17) + "v7M" + (ex + 7) + " " + (ey + 17) + 'v7" stroke="' + O + '" stroke-width="3.5" stroke-linecap="round"/>' +
    '<circle class="pawpt" cx="' + ex + '" cy="' + (ey + 8) + '" r="1" fill="none"/></g>';
}
function deskSVG() {
  var s = '<path d="M-80 352H380V500H-80Z" fill="url(#gWood)" stroke="' + O + '" stroke-width="6"/>' +
    '<path d="M-80 352H380V382H-80Z" fill="#6a3322" stroke="' + O + '" stroke-width="6"/><path d="M-72 360H372" stroke="#9a5638" stroke-width="3" opacity=".8"/>' +
    '<path d="M-80 392H380" stroke="#c9973c" stroke-width="4"/>' +
    [-20, 80, 220, 320].map(function (x) { return '<rect x="' + x + '" y="406" width="76" height="80" rx="6" fill="none" stroke="#2a120c" stroke-width="4" opacity=".7"/>'; }).join("") +
    '<ellipse cx="-26" cy="362" rx="110" ry="20" fill="url(#gLamp)"/>';
  // dinheiro
  s += [0, 1, 2].map(function (i) { return '<rect x="' + (94 + i * 3) + '" y="' + (334 - i * 9) + '" width="62" height="18" rx="3" fill="' + ["#2f9e5a", "#38b268", "#43c777"][i] + '" stroke="' + O + '" stroke-width="4"/>'; }).join("") +
    '<rect x="119" y="314" width="16" height="40" fill="#ffcf3f" stroke="' + O + '" stroke-width="4"/>';
  // copo de whisky
  s += '<path d="M280 304H326L321 352Q303 357 285 352Z" fill="rgba(210,235,255,.28)" stroke="' + O + '" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M283 326H323L320.5 350Q303 354 285.5 350Z" fill="url(#gAmber)"/><rect x="290" y="318" width="14" height="14" rx="3" fill="#e8f7ff" stroke="' + O + '" stroke-width="3" transform="rotate(-14 297 325)"/>' +
    '<rect x="303" y="322" width="12" height="12" rx="3" fill="#e8f7ff" stroke="' + O + '" stroke-width="3" transform="rotate(12 309 328)"/><path d="M286 310l2 34" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>' +
    '<path d="M280 304H326L321 352Q303 357 285 352Z" fill="none" stroke="' + O + '" stroke-width="5" stroke-linejoin="round"/>';
  // luminária de banqueiro
  s += '<ellipse cx="-28" cy="352" rx="32" ry="9" fill="#c9973c" stroke="' + O + '" stroke-width="5"/><rect x="-33" y="282" width="10" height="68" fill="#c9973c" stroke="' + O + '" stroke-width="4"/>' +
    '<path d="M-78 288Q-78 250 -28 248Q22 250 22 288Z" fill="#1f7a4d" stroke="' + O + '" stroke-width="6" stroke-linejoin="round"/><path d="M-64 280Q-62 260 -40 256" stroke="#7fe0a8" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>' +
    '<path d="M-78 288H22" stroke="#c9973c" stroke-width="7" stroke-linecap="round"/><path d="M-78 288H22" stroke="' + O + '" stroke-width="2"/>';
  return s;
}
function charSVG() {
  return '<svg viewBox="-80 -20 460 500" aria-label="Don Gatto">' +
    '<circle cx="-26" cy="300" r="250" fill="url(#gLamp)"/>' +
    '<g id="root"><g id="tail">' + tailSVG() + '</g><g id="body">' + bodySVG() + '</g><g id="head">' + headSVG() + "</g></g>" +
    deskSVG() + '<g id="arms">' + armSVG("armL", 54, 300, 66, 350) + armSVG("armR", 246, 300, 234, 350) + "</g></svg>";
}

var CH = (function () {
  var el = {}, sp = {}, st = "idle", until = 0, expr = ["smug", "smug", "smirk"], blinkUntil = 0, nextBlink = 0, nextIdle = 0, nextPuff = 0, shakeT = 0, bounceUntil = 0, nextBounce = 0, pups = [], tapping = false;
  function S(k, c) { return { x: 0, v: 0, t: 0, k: k || 140, c: c || 16 }; }
  ["lean", "hr", "hx", "hy", "armR", "armL", "earL", "earR", "px", "py", "hatY", "hatR", "tail"].forEach(function (n) { sp[n] = S(); });
  sp.jump = S(220, 11); sp.hy = S(200, 12); sp.hatY = S(200, 10); sp.hatR = S(200, 10); sp.tail = S(60, 6);
  sp.armR = S(160, 15); sp.armL = S(160, 15); sp.earL = S(260, 12); sp.earR = S(260, 12);
  var T = {
    idle: { t: { lean: 0, hr: 0, hx: 0, armR: 0, armL: 0, earL: 0, earR: 0, px: 0, py: 0 }, e: ["smug", "smug", "smirk"] },
    spin: { t: { lean: 1.5, hr: 3, hx: 2, px: 5, py: 1, armR: -10, armL: 0, earL: 0, earR: 0 }, e: ["smug", "smug", "smirk"] },
    antic: { t: { lean: 5, hr: 8, hx: 8, px: 7, py: 0, armR: -24, armL: 6, earL: 7, earR: -7 }, e: ["wide", "wide", "o"] },
    win: { t: { lean: 0, hr: -3, hx: 0, px: 0, py: 0, armR: 0, armL: 0, earL: 4, earR: -4 }, e: ["open", "open", "smile"] },
    collect: { t: { lean: 4, hr: 5, hx: 6, px: 7, py: 0, armR: -108, armL: 0, earL: 4, earR: -4 }, e: ["smug", "smug", "smile"] },
    big: { t: { lean: 0, hr: 0, hx: 0, px: 0, py: -2, armR: -150, armL: 150, earL: 8, earR: -8 }, e: ["dollar", "dollar", "grin"] },
    angry: { t: { lean: -2, hr: 0, hx: -3, px: 0, py: 3, armR: 0, armL: 0, earL: -28, earR: 28 }, e: ["angry", "angry", "angry"] },
    wink: { t: { hr: -6, px: 0, py: 0 }, e: ["smug", "closed", "smirk"] }
  };
  function renderEyes() {
    var e = performance.now() < blinkUntil ? ["closed", "closed"] : [expr[0], expr[1]];
    el.eyes.innerHTML = eyesSVG(e[0], e[1]);
    pups = el.eyes.querySelectorAll(".pup");
  }
  function setExpr(l, r, m) {
    var mc = m !== expr[2];
    expr = [l, r, m]; renderEyes();
    if (mc) { el.mouth.innerHTML = mouthSVG(m); el.ember = $("ember"); }
  }
  function set(s, ms) {
    st = s; until = ms ? performance.now() + ms : 0;
    var d = T[s]; for (var k in d.t) sp[k].t = d.t[k];
    setExpr(d.e[0], d.e[1], d.e[2]);
    tapping = s === "spin";
    if (s === "spin") { sp.hatY.v = -150; sp.hatR.v = -70; }
    if (s === "win") { sp.hy.v = 160; sp.tail.v = 120; }
    if (s === "collect") { sp.tail.v = 90; }
    if (s === "big") { bounceUntil = performance.now() + (ms || 3000); nextBounce = 0; sp.tail.v = 200; }
    if (s === "angry") { shakeT = performance.now(); sp.armR.v = 260; sp.armL.v = -260; sp.jump.v = 60; }
    if (s === "antic") { sp.earL.v = 200; sp.earR.v = -200; }
  }
  function idleAct(now) {
    var r = Math.random();
    if (r < .26) { sp.px.t = 6; sp.py.t = 1; sp.hr.t = 3; setTimeout(function () { if (st === "idle") { sp.px.t = 0; sp.py.t = 0; sp.hr.t = 0; } }, 1400); }
    else if (r < .44) { puff(4); }
    else if (r < .58) { (Math.random() < .5 ? sp.earL : sp.earR).v = (Math.random() < .5 ? -1 : 1) * 420; }
    else if (r < .7) { sp.tail.v = 160; }
    else if (r < .8) { sp.hatY.v = -90; sp.hatR.v = 50; }
    else if (r < .88 && st === "idle") { set("wink", 700); }
    else { sp.px.t = -3; sp.py.t = 2; setTimeout(function () { if (st === "idle") { sp.px.t = 0; sp.py.t = 0; } }, 1100); }
    nextIdle = now + rnd(2600, 5200);
  }
  function puff(n) { for (var i = 0; i < n; i++) setTimeout(function () { var p = tipPt(); if (p) FX.smoke(p[0], p[1]); }, i * 110); }
  function tipPt() { return expr[2] === "smirk" && el.tip ? stagePt(el.tip) : null; }
  function init(host) {
    host.innerHTML = charSVG();
    ["root", "tail", "body", "head", "earL", "earR", "eyes", "mouth", "hat", "armL", "armR", "tip"].forEach(function (k) { el[k] = $(k); });
    el.mouth.innerHTML = mouthSVG("smirk"); el.ember = $("ember");
    renderEyes();
    el.pawR = el.armR.querySelector(".pawpt");
  }
  function tick(now, dt) {
    var t = now / 1000;
    if (until && now > until) set("idle");
    if (st === "idle" && now > nextIdle) idleAct(now);
    if (now > nextBlink) { blinkUntil = now + 120; renderEyes(); setTimeout(renderEyes, 125); nextBlink = now + (Math.random() < .2 ? 260 : rnd(2200, 4800)); }
    if (now > nextPuff && expr[2] === "smirk") { puff(1); nextPuff = now + rnd(700, 1500); }
    if (bounceUntil > now && now > nextBounce) { sp.jump.v = -300; nextBounce = now + 420; }
    for (var k in sp) { var s = sp[k]; s.v += (s.k * (s.t - s.x) - s.c * s.v) * dt; s.x += s.v * dt; }
    var b = Math.sin(t * 2.1), shake = 0;
    if (st === "angry" && now - shakeT < 800) shake = Math.sin(now / 26) * 7 * (1 - (now - shakeT) / 800);
    var tap = tapping ? Math.sin(t * 22) * 5 : 0;
    el.root.setAttribute("transform", "translate(0 " + sp.jump.x.toFixed(2) + ") rotate(" + sp.lean.x.toFixed(2) + " 150 440)");
    el.body.setAttribute("transform", "translate(150 440) scale(1 " + (1 + 0.013 * b).toFixed(4) + ") translate(-150 -440)");
    el.head.setAttribute("transform", "translate(" + sp.hx.x.toFixed(2) + " " + (sp.hy.x * 0.06 - 2.4 * b).toFixed(2) + ") rotate(" + (sp.hr.x + Math.sin(t * 0.9) * 1.6 + shake).toFixed(2) + " 150 255)");
    el.earL.setAttribute("transform", "rotate(" + sp.earL.x.toFixed(2) + " 100 118)");
    el.earR.setAttribute("transform", "rotate(" + sp.earR.x.toFixed(2) + " 200 118)");
    el.hat.setAttribute("transform", "translate(0 " + (sp.hatY.x * 0.05).toFixed(2) + ") rotate(" + (sp.hatR.x * 0.06).toFixed(2) + " 150 100)");
    el.tail.setAttribute("transform", "rotate(" + (Math.sin(t * 1.4) * 7 + sp.tail.x * 0.08).toFixed(2) + " 236 352)");
    el.armR.setAttribute("transform", "translate(0 " + (sp.jump.x * 0.6).toFixed(2) + ") rotate(" + (sp.armR.x + tap + b * 0.8).toFixed(2) + " 246 300)");
    el.armL.setAttribute("transform", "translate(0 " + (sp.jump.x * 0.6).toFixed(2) + ") rotate(" + (sp.armL.x - b * 0.8).toFixed(2) + " 54 300)");
    var tr = "translate(" + sp.px.x.toFixed(2) + " " + sp.py.x.toFixed(2) + ")";
    for (var i = 0; i < pups.length; i++) pups[i].setAttribute("transform", tr);
    if (el.ember && el.ember.isConnected) { el.ember.setAttribute("r", (3.6 + Math.sin(t * 9) * .8 + Math.random() * .6).toFixed(2)); }
  }
  return { init: init, tick: tick, set: set, puff: puff, paw: function () { return stagePt(el.pawR); }, get state() { return st; } };
})();

/* ================= SÍMBOLOS ================= */
function outl(parts, fill, sw) { return parts.map(function (p) { return p.replace("/>", ' fill="' + O + '" stroke="' + O + '" stroke-width="' + (sw || 10) + '" stroke-linejoin="round"/>'); }).join("") + parts.map(function (p) { return p.replace("/>", ' fill="' + fill + '"/>'); }).join(""); }
var SYM = {
  sp: '<svg viewBox="0 0 100 100">' + outl(['<path d="M50 10C40 30 13 40 13 61C13 75 28 82 41 73C39 81 35 86 28 90H72C65 86 61 81 59 73C72 82 87 75 87 61C87 40 60 30 50 10Z"/>'], "#4f8cff") + '<path d="M30 52C32 42 40 35 46 30" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".55"/></svg>',
  he: '<svg viewBox="0 0 100 100">' + outl(['<path d="M50 88C30 72 10 58 10 37C10 22 22 12 34 12C42 12 48 18 50 25C52 18 58 12 66 12C78 12 90 22 90 37C90 58 70 72 50 88Z"/>'], "#ff4f6d") + '<path d="M22 36C22 28 27 22 34 21" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".55"/></svg>',
  di: '<svg viewBox="0 0 100 100">' + outl(['<path d="M50 8C60 24 72 38 86 50C72 62 60 76 50 92C40 76 28 62 14 50C28 38 40 24 50 8Z"/>'], "#ffb02e") + '<path d="M30 46C36 40 41 34 46 26" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".55"/></svg>',
  cl: '<svg viewBox="0 0 100 100">' + outl(['<circle cx="50" cy="30" r="18"/>', '<circle cx="29" cy="56" r="18"/>', '<circle cx="71" cy="56" r="18"/>', '<path d="M50 44L38 90H62Z"/>'], "#3fd28a") + '<path d="M40 24C42 19 46 16 50 15" stroke="#fff" stroke-width="5.5" fill="none" stroke-linecap="round" opacity=".55"/></svg>',
  ci: '<svg viewBox="0 0 100 100"><path d="M80 24C86 14 80 8 86 2" stroke="#d8cfd6" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/><path d="M14 78 78 30" stroke="' + O + '" stroke-width="28" stroke-linecap="round"/><path d="M14 78 78 30" stroke="#8a4b2a" stroke-width="18" stroke-linecap="round"/><path d="M20 70 70 32" stroke="#b06a3e" stroke-width="5" stroke-linecap="round" opacity=".7"/><path d="M30 66 40 58.5" stroke="#d22f3f" stroke-width="18"/><path d="M33.5 63.5 37 60.8" stroke="#ffcf3f" stroke-width="18"/><path d="M73 33.7 81 27.7" stroke="#9a9aa6" stroke-width="18" stroke-linecap="round"/><circle cx="83" cy="26" r="7" fill="#ff7a2e" stroke="' + O + '" stroke-width="4"/><circle cx="83" cy="26" r="3" fill="#ffd26b"/></svg>',
  wh: '<svg viewBox="0 0 100 100"><path d="M20 16H80L72 86Q50 94 28 86Z" fill="rgba(210,235,255,.35)" stroke="' + O + '" stroke-width="6" stroke-linejoin="round"/><path d="M23.6 44H76.4L72.6 84Q50 91 27.4 84Z" fill="url(#gAmber)"/><rect x="32" y="32" width="20" height="20" rx="5" fill="#eaf8ff" stroke="' + O + '" stroke-width="4" transform="rotate(-16 42 42)"/><rect x="52" y="37" width="17" height="17" rx="4" fill="#eaf8ff" stroke="' + O + '" stroke-width="4" transform="rotate(14 60 45)"/><path d="M27 24 31 78" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/><path d="M20 16H80L72 86Q50 94 28 86Z" fill="none" stroke="' + O + '" stroke-width="6" stroke-linejoin="round"/><ellipse cx="50" cy="16" rx="30" ry="4" fill="none" stroke="' + O + '" stroke-width="4"/></svg>',
  vi: '<svg viewBox="0 0 100 100"><g transform="rotate(-32 50 50)"><path d="M50 4C66 4 68 18 63 29C77 38 80 60 72 74C67 86 60 96 50 96C40 96 33 86 28 74C20 60 23 38 37 29C32 18 34 4 50 4Z" fill="#2b2233" stroke="' + O + '" stroke-width="6" stroke-linejoin="round"/><path d="M50 10C60 10 61 20 57 29" stroke="#5a4a68" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M35 40C30 52 30 64 35 74" stroke="#5a4a68" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="66" y="48" width="9" height="16" rx="2" fill="url(#gGold)" stroke="' + O + '" stroke-width="3"/><rect x="25" y="48" width="9" height="16" rx="2" fill="url(#gGold)" stroke="' + O + '" stroke-width="3"/><path d="M42 96v-6h16v6" fill="none" stroke="url(#gGold)" stroke-width="5"/></g></svg>',
  ca: '<svg viewBox="0 0 100 100">' + [0, 1, 2, 3].map(function (i) { var y = 66 - i * 12; return '<rect x="10" y="' + y + '" width="80" height="24" rx="4" fill="' + ["#287f4a", "#2f9e5a", "#38b268", "#43c777"][i] + '" stroke="' + O + '" stroke-width="5"/>'; }).join("") + '<ellipse cx="50" cy="42" rx="11" ry="8" fill="none" stroke="#1d6b3b" stroke-width="3.5"/><rect x="40" y="26" width="20" height="66" fill="url(#gGold)" stroke="' + O + '" stroke-width="4"/><text x="50" y="66" text-anchor="middle" font-family="Luckiest Guy, Arial Black, sans-serif" font-size="18" fill="' + O + '">$</text></svg>',
  fi: '<svg viewBox="0 0 100 100"><circle cx="50" cy="56" r="40" fill="url(#gWater)" stroke="' + O + '" stroke-width="6"/><path d="M26 38C30 30 38 24 46 22" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/><path d="M34 60C42 46 62 46 70 60C62 74 42 74 34 60Z" fill="#ff8a1f" stroke="' + O + '" stroke-width="5"/><path d="M33 60 20 50V70Z" fill="#ffb347" stroke="' + O + '" stroke-width="5" stroke-linejoin="round"/><circle cx="61" cy="57" r="4" fill="' + O + '"/><path d="M50 50Q53 60 50 70" stroke="#d46a0c" stroke-width="3.5" fill="none"/><circle cx="76" cy="40" r="4" fill="none" stroke="#fff" stroke-width="3"/><circle cx="70" cy="30" r="2.5" fill="none" stroke="#fff" stroke-width="2.5"/><ellipse cx="50" cy="17" rx="26" ry="7" fill="#bfeaff" stroke="' + O + '" stroke-width="5"/></svg>',
  en: '<svg viewBox="0 0 100 100"><rect x="8" y="22" width="84" height="58" rx="6" fill="#e3b06e" stroke="' + O + '" stroke-width="6"/><path d="M10 26 50 56 90 26" fill="#c98f4c" stroke="' + O + '" stroke-width="6" stroke-linejoin="round"/><path d="M16 74 40 54M84 74 60 54" stroke="#b07a3c" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="55" r="12" fill="#c8102e" stroke="' + O + '" stroke-width="5"/><text x="50" y="61.5" text-anchor="middle" font-family="Luckiest Guy, Arial Black, sans-serif" font-size="15" fill="#ffd6d6">G</text><rect x="24" y="12" width="26" height="16" rx="2" fill="#43c777" stroke="' + O + '" stroke-width="4" transform="rotate(-10 37 20)"/></svg>',
  ri: '<svg viewBox="0 0 100 100"><g stroke="#fff6c4" stroke-width="4" stroke-linecap="round"><path d="M12 22v10M7 27h10M88 18v8M84 22h8"/></g><ellipse cx="50" cy="64" rx="31" ry="27" fill="none" stroke="' + O + '" stroke-width="20"/><ellipse cx="50" cy="64" rx="31" ry="27" fill="none" stroke="url(#gGold)" stroke-width="11"/><path d="M26 54C28 46 34 42 40 40" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/><path d="M30 34H70L62 46H38Z" fill="url(#gGold)" stroke="' + O + '" stroke-width="5" stroke-linejoin="round"/><path d="M50 6 68 20 50 40 32 20Z" fill="url(#gRuby)" stroke="' + O + '" stroke-width="5" stroke-linejoin="round"/><path d="M42 18 48 12" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>',
  va: '<svg viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" rx="14" fill="url(#gSteel)" stroke="' + O + '" stroke-width="6"/><rect x="13" y="13" width="74" height="74" rx="9" fill="none" stroke="#5d6782" stroke-width="3"/><circle cx="17" cy="17" r="3" fill="#5d6782"/><circle cx="83" cy="17" r="3" fill="#5d6782"/><circle cx="17" cy="83" r="3" fill="#5d6782"/><circle cx="83" cy="83" r="3" fill="#5d6782"/><circle cx="50" cy="50" r="29" fill="#c9d0de" stroke="' + O + '" stroke-width="5"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) { var r = a * Math.PI / 180; return '<path d="M' + (50 + Math.cos(r) * 22).toFixed(1) + " " + (50 + Math.sin(r) * 22).toFixed(1) + "L" + (50 + Math.cos(r) * 27).toFixed(1) + " " + (50 + Math.sin(r) * 27).toFixed(1) + '" stroke="' + O + '" stroke-width="3"/>'; }).join("") + '<circle cx="50" cy="50" r="15" fill="url(#gGold)" stroke="' + O + '" stroke-width="5"/><path d="M50 37V63M37 50H63" stroke="' + O + '" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="50" r="5" fill="#d22f3f" stroke="' + O + '" stroke-width="3"/><path d="M28 28C32 24 38 22 42 22" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/></svg>'
};
var CODES = ["sp", "he", "di", "cl", "ci", "wh", "vi", "ca", "fi"];
/* tabela igual à do servidor (rd_gatto), em centavos de aposta: 100 = 1x. Índice = tamanho do cluster - 5 (15+ usa o último) */
var PAYT = [
  [60, 80, 100, 130, 160, 200, 250, 330, 500, 650, 1300], [60, 80, 100, 130, 160, 200, 250, 330, 500, 650, 1300],
  [80, 100, 120, 160, 200, 240, 320, 400, 600, 800, 1600], [80, 100, 120, 160, 200, 240, 320, 400, 600, 800, 1600],
  [100, 130, 160, 200, 260, 320, 420, 530, 800, 1050, 2100], [130, 160, 200, 260, 330, 400, 530, 660, 1000, 1300, 2600],
  [200, 250, 300, 400, 500, 600, 800, 1000, 1500, 2000, 4000], [260, 330, 400, 530, 660, 800, 1050, 1300, 2000, 2600, 5300],
  [400, 500, 600, 800, 1000, 1200, 1600, 2000, 3000, 4000, 8000]];
var NAMES = { sp: "Spade", he: "Heart", di: "Diamond", cl: "Club", ci: "Cigar", wh: "Whiskey", vi: "Violin case", ca: "Cash stack", fi: "Goldfish" };
var LADDER = [1, 2, 3, 5, 10];
var COST = { base: 1, hunt: 3, buy: 100, super: 300 };
var ALLBETS = [0.2, 0.4, 0.6, 0.8, 1, 2, 3, 5, 10, 20, 50, 100], BETS = ALLBETS.filter(function (b) { return b <= 10; });
function pay(s, n) { return PAYT[CODES.indexOf(s)][Math.min(n, 15) - 5] / 100; }
function cellOf(code) { if (code >= 100) return { s: "en", v: code - 100 }; if (code === 10) return { s: "ri" }; if (code === 11) return { s: "va" }; return { s: CODES[code] }; }
/* ================= LAYOUT ================= */
var LAY = {
  L: { W: 1280, H: 720, logo: [44, 10, 336, 158], char: [2, 150, 410, 446], hud: [420, 6, 628, 42], grid: [420, 52, 100], win: [420, 588, 628, 52], buy: [1072, 64, 176, 96], spin: [1160, 322], auto: [1160, 196], turbo: [1160, 448], bet: [1072, 520, 176, 74], bar: [0, 662, 1280, 58], win0: [36, 36, 380, 520] },
  P: { W: 720, H: 1280, logo: [372, 96, 328, 154], char: [-6, 18, 384, 418], hud: [28, 424, 664, 40], grid: [28, 470, 106], win: [28, 1034, 664, 52], buy: [28, 1100, 180, 96], spin: [360, 1148], auto: [262, 1148], turbo: [458, 1148], bet: [520, 1112, 172, 74], bar: [0, 1222, 720, 58], win0: [24, 24, 344, 392] }
};
var P0 = JSON.parse(JSON.stringify(LAY.P));
function setPortraitH(H) {
  var ex = H - 1280, P = JSON.parse(JSON.stringify(P0)); P.H = H;
  P.char[1] += ex * .3; P.logo[1] += ex * .3; P.win0[1] += ex * .3;
  ["hud", "grid", "win"].forEach(function (k) { P[k][1] += ex * .5; });
  ["buy", "bet"].forEach(function (k) { P[k][1] += ex * .72; });
  P.spin[1] += ex * .72; P.auto[1] += ex * .72; P.turbo[1] += ex * .72; P.bar[1] += ex;
  LAY.P = P;
}
var mode = "L", cs = 100, scale = 1, stage = $("stage");
function box(id, r) { var e = $(id); e.style.left = r[0] + "px"; e.style.top = r[1] + "px"; if (r[2] != null) e.style.width = r[2] + "px"; if (r[3] != null) e.style.height = r[3] + "px"; }
function layout(force) {
  var w = $("wrap").clientWidth - parseFloat(getComputedStyle($("wrap")).paddingLeft) - parseFloat(getComputedStyle($("wrap")).paddingRight), h = $("wrap").clientHeight;
  var m = w / h < 0.95 ? "P" : "L";
  if (m === "P") { var H2 = Math.round(Math.max(1280, Math.min(1600, 720 * h / w))); if (H2 !== LAY.P.H) { if (busy) pendingLayout = true; else { setPortraitH(H2); force = true; } } }
  if (m !== mode || force) {
    if (busy && !force) { pendingLayout = true; } else {
      mode = m; var L = LAY[m]; stage.className = m; stage.style.width = L.W + "px"; stage.style.height = L.H + "px";
      box("logo", L.logo); box("char", L.char); box("hud", L.hud); box("winline", L.win); box("buy", L.buy); box("betbox", L.bet); box("bar", L.bar);
      $("spin").style.left = L.spin[0] + "px"; $("spin").style.top = L.spin[1] + "px";
      $("auto").style.left = L.auto[0] + "px"; $("auto").style.top = L.auto[1] + "px";
      $("turbo").style.left = L.turbo[0] + "px"; $("turbo").style.top = L.turbo[1] + "px";
      cs = L.grid[2]; var gw = cs * 6 + 28, gh = cs * 5 + 28; box("grid", [L.grid[0], L.grid[1], gw, gh]);
      $("cells").style.width = cs * 6 + "px"; $("cells").style.height = cs * 5 + "px";
      $("cells").style.backgroundImage = "radial-gradient(circle at 50% 50%, rgba(255,255,255,.045) 0 " + (cs * .42) + "px, transparent " + (cs * .42 + 1) + "px)";
      $("cells").style.backgroundSize = cs + "px " + cs + "px";
      $("glows").style.width = cs * 6 + "px"; $("glows").style.height = cs * 5 + "px";
      $("glows").innerHTML = [0, 1, 2, 3, 4, 5].map(function (c) { return '<div class="glow" style="left:' + c * cs + "px;width:" + cs + 'px"></div>'; }).join("");
      document.querySelectorAll(".tag").forEach(function (t) { t.style.fontSize = (cs * .19) + "px"; });
      drawBG(); FX.size(L.W, L.H); renderGrid();
    }
  }
  var L2 = LAY[mode]; scale = Math.min(w / L2.W, h / L2.H);
  stage.style.transform = "translate(-50%,-50%) scale(" + scale + ")";
}
function stagePt(el) { var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return [(r.left + r.width / 2 - s.left) / scale, (r.top + r.height / 2 - s.top) / scale]; }

/* ================= CENÁRIO ================= */
function seeded(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function drawBG() {
  var L = LAY[mode], W = L.W, H = L.H, cv = $("bg"), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  var R = seeded(7);
  var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#2c0f20"); gr.addColorStop(.6, "#1c0915"); gr.addColorStop(1, "#10050c");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // papel de parede listrado + losangos discretos
  for (var x = 0; x < W; x += 44) { g.fillStyle = "rgba(255,190,210,.025)"; g.fillRect(x, 0, 22, H); }
  g.fillStyle = "rgba(255,200,150,.035)";
  for (var y = 20; y < H; y += 56) for (x = (y / 56 % 2) * 22 + 11; x < W; x += 44) { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x, y + 7); g.lineTo(x - 5, y); g.fill(); }
  // janela com persiana atrás do gato
  var wx = L.win0[0], wy = L.win0[1], ww = L.win0[2], wh = L.win0[3];
  g.save(); g.beginPath(); g.roundRect ? g.roundRect(wx, wy, ww, wh, 10) : g.rect(wx, wy, ww, wh); g.clip();
  var sk = g.createLinearGradient(0, wy, 0, wy + wh); sk.addColorStop(0, "#0a1630"); sk.addColorStop(.55, "#1a1240"); sk.addColorStop(1, "#3a1636");
  g.fillStyle = sk; g.fillRect(wx, wy, ww, wh);
  g.filter = "blur(2px)";
  for (var i = 0; i < 9; i++) { var bw = rnd(40, 80), bh = wh * rnd(.35, .8), bx = wx + i * ww / 8 - 20; g.fillStyle = "#0d0a1e"; g.fillRect(bx, wy + wh - bh, bw, bh); }
  g.filter = "blur(5px)";
  for (i = 0; i < 70; i++) { var c = ["#ffcf6b", "#ffcf6b", "#ff6fae", "#5fe0d0", "#ffa64d"][Math.floor(R() * 5)]; g.globalAlpha = .35 + R() * .5; g.fillStyle = c; g.beginPath(); g.arc(wx + R() * ww, wy + wh * (.3 + R() * .7), 2 + R() * 7, 0, 7); g.fill(); }
  g.globalAlpha = .55; g.fillStyle = "#ff3d7f"; g.fillRect(wx + ww * .74, wy + wh * .18, 16, wh * .42);
  g.filter = "blur(26px)"; g.globalAlpha = .6; g.fillRect(wx + ww * .66, wy + wh * .1, 70, wh * .6);
  g.filter = "none"; g.globalAlpha = 1;
  for (y = wy + 6; y < wy + wh; y += 26) { var sl = g.createLinearGradient(0, y, 0, y + 15); sl.addColorStop(0, "rgba(70,34,46,.95)"); sl.addColorStop(1, "rgba(28,12,20,.95)"); g.fillStyle = sl; g.fillRect(wx, y, ww, 15); g.fillStyle = "rgba(255,170,190,.12)"; g.fillRect(wx, y, ww, 2); }
  g.restore();
  g.lineWidth = 14; g.strokeStyle = "#2a130d"; g.beginPath(); g.roundRect ? g.roundRect(wx, wy, ww, wh, 10) : g.rect(wx, wy, ww, wh); g.stroke();
  g.lineWidth = 4; g.strokeStyle = "#1a1026"; g.beginPath(); g.roundRect ? g.roundRect(wx - 7, wy - 7, ww + 14, wh + 14, 14) : g.rect(wx - 7, wy - 7, ww + 14, wh + 14); g.stroke();
  g.fillStyle = "#3a1b12"; g.fillRect(wx + ww * .5, wy, 6, wh); g.fillRect(wx, wy + wh * .5, ww, 6);
  // faixas de luz da persiana projetadas na parede
  g.save(); g.globalCompositeOperation = "lighter";
  for (i = 0; i < 9; i++) { var yy = wy + 40 + i * 42; g.fillStyle = "rgba(255,120,170,.028)"; g.beginPath(); g.moveTo(wx + ww, yy); g.lineTo(W, yy + 120); g.lineTo(W, yy + 140); g.lineTo(wx + ww, yy + 16); g.fill(); }
  g.restore();
  // lambri
  var ly = mode === "L" ? 600 : LAY.P.win[1] + 10;
  var wd = g.createLinearGradient(0, ly, 0, H); wd.addColorStop(0, "#3d1c14"); wd.addColorStop(1, "#1f0d09"); g.fillStyle = wd; g.fillRect(0, ly, W, H - ly);
  g.fillStyle = "#c9973c"; g.globalAlpha = .55; g.fillRect(0, ly, W, 4); g.globalAlpha = 1;
  g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 3; for (x = 20; x < W; x += 120) { g.strokeRect(x, ly + 18, 96, H - ly - 30); }
  // vinheta
  var vg = g.createRadialGradient(W * .5, H * .45, Math.min(W, H) * .3, W * .5, H * .5, Math.max(W, H) * .75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.6)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

/* ================= EFEITOS (canvas) ================= */
var FX = (function () {
  var cv = $("fx"), g = cv.getContext("2d"), parts = [], W = 1280, H = 720, dpr = 1, reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function size(w, h) { W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px"; }
  function add(p) { if (reduce && parts.length > 60) return; p.age = 0; parts.push(p); }
  function smoke(x, y) { add({ k: "smoke", x: x, y: y, vx: rnd(4, 14), vy: rnd(-32, -20), r: rnd(3, 6), life: rnd(2.2, 3.2) }); }
  function dust() { var L = LAY[mode]; add({ k: "dust", x: L.win0[0] + Math.random() * (L.W - L.win0[0]), y: Math.random() * L.H, vx: rnd(-4, 4), vy: rnd(-6, -1), r: rnd(.8, 2), life: rnd(5, 9) }); }
  function burst(x, y, n, kind, power) {
    for (var i = 0; i < n; i++) { var a = rnd(0, Math.PI * 2), s = rnd(.3, 1) * (power || 300); add({ k: kind, x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === "spark" ? 0 : 260), g: kind === "spark" ? 0 : 900, rot: rnd(0, 6), vr: rnd(-8, 8), fl: rnd(0, 6), r: kind === "spark" ? rnd(3, 7) : 1, life: kind === "spark" ? rnd(.35, .7) : rnd(1.4, 2.4) }); }
  }
  function rain(n) { for (var i = 0; i < n; i++) add({ k: Math.random() < .55 ? "bill" : "coin", x: rnd(0, W), y: rnd(-H * .6, -20), vx: rnd(-40, 40), vy: rnd(80, 240), g: 160, rot: rnd(0, 6), vr: rnd(-5, 5), fl: rnd(0, 6), r: 1, life: 4.5 }); }
  function star(x, y, r) { g.beginPath(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? r * .35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  function tick(dt) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (!reduce && parts.length < 400 && Math.random() < dt * 8) dust();
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; }
      var f = p.age / p.life;
      if (p.g) p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt; if (p.fl != null) p.fl += dt * 7;
      if (p.k === "dust") { g.globalAlpha = Math.sin(f * Math.PI) * .45; g.fillStyle = "#ffd9a8"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
      else if (p.k === "smoke") { p.vx *= .99; g.globalAlpha = (1 - f) * .22; g.fillStyle = "#e6dce4"; g.beginPath(); g.arc(p.x + Math.sin(p.age * 2.5) * 6, p.y, p.r + f * 22, 0, 7); g.fill(); }
      else if (p.k === "spark") { g.globalAlpha = 1 - f; g.fillStyle = f < .4 ? "#ffffff" : "#ffd34d"; star(p.x, p.y, p.r * (1 - f * .5)); }
      else {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(Math.cos(p.fl), 1); g.globalAlpha = f > .85 ? (1 - f) / .15 : 1;
        if (p.k === "bill") { g.fillStyle = "#38b268"; g.strokeStyle = O; g.lineWidth = 3; g.fillRect(-17, -9, 34, 18); g.strokeRect(-17, -9, 34, 18); g.fillStyle = "#1d6b3b"; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill(); }
        else { g.fillStyle = "#ffcf3f"; g.strokeStyle = O; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill(); g.stroke(); g.strokeStyle = "#d98a0b"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 6.5, 0, 7); g.stroke(); }
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }
  return { size: size, smoke: smoke, burst: burst, rain: rain, tick: tick };
})();

/* ================= SOM ================= */
var AC = null, muted = false;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } if (AC && AC.state === "suspended") AC.resume(); return AC; }
function tone(f, d, type, vol, slide, delay) {
  var a = ac(); if (!a || muted) return; var t = a.currentTime + (delay || 0), o = a.createOscillator(), gn = a.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol || .1, t + .012); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(gn); gn.connect(a.destination); o.start(t); o.stop(t + d + .03);
}
function semis(base, arr, gap, type, vol, d) { arr.forEach(function (n, i) { tone(base * Math.pow(2, n / 12), d || .25, type || "triangle", vol || .08, null, i * (gap || .07)); }); }
var SND = {
  spin: function () { tone(240, .14, "triangle", .07, 480); },
  land: function () { tone(120, .1, "sine", .16, 62); },
  pop: function (i) { tone(520 + i * 70, .14, "square", .04, 980 + i * 70); },
  win: function (i) { semis(523 * Math.pow(2, (i || 0) * 2 / 12), [0, 4, 7], .06); },
  vault: function () { tone(200, .3, "sawtooth", .05, 100); tone(988, .28, "triangle", .07, null, .03); },
  antic: function () { tone(280, 1.0, "sawtooth", .035, 840); },
  ring: function () { semis(784, [0, 7, 12, 19], .05, "sine", .09, .32); },
  coin: function () { tone(1320, .12, "square", .035, 1760); },
  big: function () { semis(392, [0, 4, 7, 12, 16, 19], .09, "triangle", .09, .4); },
  angry: function () { tone(170, .32, "sawtooth", .05, 85); },
  click: function () { tone(700, .05, "square", .025); }
};

/* ================= JOGO =================
   Quem sorteia é o servidor (slot_spin). Aqui só animamos o registro que ele devolve:
   grade inicial, clusters de cada cascata, símbolos novos de cada coluna, coleta do anel e cofres. */
var grid = [], bal = 0, betI = 4, busy = false, pendingLayout = false, turbo = false, auto = 0, hunt = false, roundWin = 0, roundBet = 1;
var signed = false, pendingBal = null;
var FS = { active: false, left: 0, m: 0, total: 0, done: 0 };
function bet() { return BETS[betI]; }
function TT(ms) { return ms * (turbo ? 0.5 : 1); }
function cash(centi) { return Math.round(roundBet * centi) / 100; }
function rows(arr) { var g = []; for (var c = 0; c < 6; c++) { g[c] = []; for (var r = 0; r < 5; r++) g[c][r] = { s: arr[r].split(" ")[c] }; } return g; }

/* ponte com o site (mesma origem): pedidos de giro e saldo */
var reqs = {}, rid = 0, embedded = window.parent !== window;
function ask(msg) {
  return new Promise(function (res) {
    if (!embedded) return res({ error: "Open Don Gatto from RDCasino to play." });
    var id = ++rid; reqs[id] = res; msg.id = id; parent.postMessage(msg, location.origin);
    setTimeout(function () { if (reqs[id]) { delete reqs[id]; res({ error: "Connection lost. Check your bet history before spinning again." }); } }, 25000);
  });
}
window.addEventListener("message", function (e) {
  if (e.origin !== location.origin || e.source !== parent) return;
  var d = e.data || {};
  if (d.t === "state") {
    signed = !!d.signed; var dm = document.querySelector("#bar .demo"); if (dm) dm.textContent = d.live ? "PROVABLY FAIR" : "DEMO · NO REAL MONEY";
    if (d.maxBet) { BETS = ALLBETS.filter(function (b) { return b <= d.maxBet; }); if (betI > BETS.length - 1) betI = BETS.length - 1; }
    if (busy) pendingBal = +d.balance || 0; else bal = +d.balance || 0;
    ui();
  } else if (d.t === "result" && reqs[d.id]) { var f = reqs[d.id]; delete reqs[d.id]; f(d); }
});

function mkSym(cell, c, r) {
  var e = document.createElement("div"); e.className = "sym s-" + cell.s;
  e.style.left = c * cs + "px"; e.style.top = r * cs + "px"; e.style.width = cs + "px"; e.style.height = cs + "px";
  e.innerHTML = '<div class="art">' + SYM[cell.s] + "</div>" + (cell.s === "en" ? '<b class="tag" style="font-size:' + (cs * .19) + 'px">' + money(cell.v * (busy ? roundBet : bet())) + "</b>" : "");
  $("cells").appendChild(e); cell.el = e; return e;
}
function renderGrid() { $("cells").innerHTML = ""; for (var c = 0; c < grid.length; c++) for (var r = 0; r < 5; r++) mkSym(grid[c][r], c, r); }
function refreshTags() { grid.forEach(function (col) { col.forEach(function (x) { if (x.s === "en" && x.el) { var t = x.el.querySelector(".tag"); if (t) t.textContent = money(x.v * bet()); } }); }); }
function anim(e, kf, o) { try { return e.animate(kf, o).finished; } catch (err) { return Promise.resolve(); } }

async function dropOut() {
  var ps = [];
  grid.forEach(function (col, c) { col.forEach(function (x, r) { if (x.el) ps.push(anim(x.el, [{ transform: "translateY(0)" }, { transform: "translateY(" + (cs * 6) + "px)" }], { duration: TT(240), delay: TT(c * 30 + (4 - r) * 14), easing: "cubic-bezier(.55,0,.9,.5)", fill: "forwards" })); }); });
  await Promise.all(ps); $("cells").innerHTML = "";
}
async function dropIn(g) {
  grid = g; var acc = 0, seen = 0, delays = [], anticCols = [];
  for (var c = 0; c < 6; c++) {
    if (seen >= 2) { acc += TT(c === 0 ? 0 : 1000); anticCols.push(c); } else acc += c ? TT(80) : 0;
    delays[c] = acc; seen += g[c].filter(function (x) { return x.s === "va"; }).length;
  }
  var ps = [], glows = $("glows").children;
  anticCols.forEach(function (c, i) {
    setTimeout(function () { glows[c].classList.add("on"); SND.antic(); if (i === 0) CH.set("antic"); }, delays[c] - TT(950));
    setTimeout(function () { glows[c].classList.remove("on"); }, delays[c] + TT(380));
  });
  g.forEach(function (col, c) {
    setTimeout(function () { SND.land(); }, delays[c] + TT(300));
    col.forEach(function (x, r) {
      var e = mkSym(x, c, r);
      e.style.transform = "translateY(" + (-cs * 6) + "px)";
      ps.push(anim(e, [{ transform: "translateY(" + (-cs * 6) + "px)" }, { transform: "translateY(0)" }], { duration: TT(400), delay: delays[c] + TT((4 - r) * 30), easing: "cubic-bezier(.3,1.3,.55,1)", fill: "forwards" })
        .then(function () { e.style.transform = ""; if (x.s === "va") { SND.vault(); anim(e.querySelector(".art"), [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 360 }); } }));
    });
  });
  await Promise.all(ps);
  return anticCols.length > 0;
}
function setWin(v) { $("winv").textContent = money(v); }
function winLine(txt, small) { $("winline").innerHTML = txt ? (small ? "<small>" + small + "</small>" : "") + "<span>" + txt + "</span>" : ""; if (txt) anim($("winline").lastElementChild, [{ transform: "scale(.6)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" }); }
function showWin() { setWin(FS.active ? cash(FS.totalC + roundWin) : cash(roundWin)); }
async function showClusters(cls, chain) {
  cls.forEach(function (cl) {
    var w = cash(cl.p), cx = 0, cy = 0;
    cl.c.forEach(function (i) { var x = grid[Math.floor(i / 5)][i % 5]; if (x.el) x.el.classList.add("hit"); cx += Math.floor(i / 5); cy += i % 5; });
    cx = (cx / cl.c.length + .5) * cs; cy = (cy / cl.c.length + .5) * cs;
    var lb = document.createElement("div"); lb.className = "wl"; lb.textContent = money(w); lb.style.left = cx + "px"; lb.style.top = cy + "px"; $("cells").appendChild(lb);
    anim(lb, [{ transform: "translate(-50%,-30%) scale(.4)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.15)", opacity: 1, offset: .3 }, { transform: "translate(-50%,-60%) scale(1)", opacity: 1, offset: .8 }, { transform: "translate(-50%,-75%) scale(1)", opacity: 0 }], { duration: TT(1100), fill: "forwards" }).then(function () { lb.remove(); });
    roundWin += cl.p;
  });
  showWin(); winLine(money(cash(roundWin)), "WIN");
  SND.win(chain); if (CH.state !== "big") CH.set("win", 1300);
  await sleep(TT(720));
}
async function tumble(cls, add) {
  var hit = {}, ps = [], k = 0;
  cls.forEach(function (cl) { cl.c.forEach(function (i) { hit[i] = 1; }); });
  Object.keys(hit).forEach(function (key) {
    var i = +key, cell = grid[Math.floor(i / 5)][i % 5], e = cell.el; if (!e) return;
    var pt = stagePt(e); FX.burst(pt[0], pt[1], 5, "spark", 160);
    ps.push(anim(e, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.25)", opacity: 1, offset: .4 }, { transform: "scale(0)", opacity: 0 }], { duration: TT(260), fill: "forwards" }).then(function () { e.remove(); }));
    if (k++ % 3 === 0) setTimeout(function () { SND.pop(k % 6); }, k * 18);
  });
  await Promise.all(ps);
  var moves = [];
  for (var c = 0; c < 6; c++) {
    var keep = []; for (var r = 0; r < 5; r++) if (!hit[c * 5 + r]) keep.push({ cell: grid[c][r], r0: r });
    var fresh = (add[c] || []).map(cellOf), n = fresh.length; if (!n) continue;
    var col = fresh.concat(keep.map(function (o) { return o.cell; }));
    grid[c] = col;
    (function (c, n, keep, col) {
      keep.forEach(function (o, j) { var rn = n + j; if (rn !== o.r0 && o.cell.el) { o.cell.el.style.top = rn * cs + "px"; moves.push(anim(o.cell.el, [{ transform: "translateY(" + ((o.r0 - rn) * cs) + "px)" }, { transform: "translateY(0)" }], { duration: TT(320), delay: TT(c * 22), easing: "cubic-bezier(.4,1.25,.6,1)" })); } });
      for (var i = 0; i < n; i++) { var e = mkSym(col[i], c, i); moves.push(anim(e, [{ transform: "translateY(" + (-(n + 1) * cs) + "px)" }, { transform: "translateY(0)" }], { duration: TT(360), delay: TT(c * 22 + (n - 1 - i) * 30), easing: "cubic-bezier(.3,1.3,.55,1)", fill: "backwards" })); }
    })(c, n, keep, col);
  }
  await Promise.all(moves); SND.land();
}
function cellsOf(s) { var o = []; grid.forEach(function (col) { col.forEach(function (x) { if (x.s === s) o.push(x); }); }); return o; }
async function collect(kk) {
  var rings = cellsOf("ri"), envs = cellsOf("en");
  CH.set("collect", 9000);
  rings.forEach(function (x) { x.el && x.el.classList.add("pulse"); }); SND.ring(); await sleep(TT(650));
  var paw = CH.paw();
  for (var i = 0; i < envs.length; i++) {
    var x = envs[i]; if (!x.el) continue;
    var from = stagePt(x.el), fly = x.el.cloneNode(true);
    fly.style.left = (from[0] - cs / 2) + "px"; fly.style.top = (from[1] - cs / 2) + "px"; fly.style.zIndex = 35; fly.classList.remove("hit");
    stage.appendChild(fly); x.el.classList.add("done");
    (function (fly, from) {
      anim(fly, [{ transform: "translate(0,0) scale(1)" }, { transform: "translate(" + ((paw[0] - from[0]) * .5) + "px," + ((paw[1] - from[1]) * .5 - 120) + "px) scale(.9) rotate(-20deg)", offset: .5 }, { transform: "translate(" + (paw[0] - from[0]) + "px," + (paw[1] - from[1]) + "px) scale(.35) rotate(-40deg)" }], { duration: TT(560), easing: "ease-in" })
        .then(function () { fly.remove(); FX.burst(paw[0], paw[1], 8, "spark", 220); SND.coin(); });
    })(fly, from);
    await sleep(TT(200));
  }
  await sleep(TT(450));
  roundWin += kk.p; showWin(); winLine(money(cash(roundWin)), kk.m > 1 ? "COLLECT x" + kk.m : "COLLECT");
  FX.burst(paw[0], paw[1] - 30, 14, "coin", 260);
  rings.forEach(function (x) { x.el && x.el.classList.remove("pulse"); });
  if (FS.active && FS.m < LADDER.length - 1) { FS.m++; hud(); }
  await sleep(TT(500));
}
/* um giro do registro: devolve o prêmio (centavos de aposta) */
async function playSpin(sp) {
  roundWin = 0; if (!FS.active) setWin(0); winLine("");
  CH.set("spin"); SND.spin();
  var g = []; for (var c = 0; c < 6; c++) { g[c] = []; for (var r = 0; r < 5; r++) g[c][r] = cellOf(sp.g[c * 5 + r]); }
  await dropOut();
  var antic = await dropIn(g);
  for (var i = 0; i < sp.t.length; i++) { await showClusters(sp.t[i].c, i); await tumble(sp.t[i].c, sp.t[i].a); }
  if (sp.k) await collect(sp.k);
  return { w: sp.w, near: antic && sp.v < 3 };
}
async function bigWin(v) {
  var b = roundBet, tier = v >= 100 * b ? ["EPIC WIN", "epic"] : v >= 50 * b ? ["MEGA WIN", "mega"] : ["BIG WIN", ""];
  var ov = $("big"), t = $("bigT"), a = $("bigA"); t.textContent = tier[0]; t.className = "t " + tier[1]; ov.hidden = false;
  t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
  CH.set("big", 4200); SND.big(); FX.rain(70);
  var skip = false; ov.onclick = function () { skip = true; };
  var dur = TT(2600), t0 = performance.now();
  await new Promise(function (res) {
    (function step() { var f = Math.min(1, (performance.now() - t0) / dur); if (skip) f = 1; a.textContent = money(v * (1 - Math.pow(1 - f, 3))); if (f < 1) requestAnimationFrame(step); else res(); })();
  });
  SND.coin(); FX.burst(LAY[mode].W / 2, LAY[mode].H / 2, 30, "coin", 420);
  await new Promise(function (res) { var tm = setTimeout(res, skip ? 400 : TT(1600)); ov.onclick = function () { clearTimeout(tm); res(); }; });
  ov.hidden = true; ov.onclick = null;
}
function hud() {
  $("hud").classList.toggle("on", FS.active); $("grid").classList.toggle("fs", FS.active);
  $("fsLeft").textContent = FS.left;
  $("ladder").innerHTML = LADDER.map(function (m, i) { return '<i class="' + (i === FS.m ? "on" : "") + '">x' + m + "</i>"; }).join("");
}
function vaultSVG() {
  return '<svg viewBox="0 0 230 230"><rect x="10" y="10" width="210" height="210" rx="24" fill="#2a1626" stroke="' + O + '" stroke-width="8"/><rect x="30" y="30" width="170" height="170" rx="14" fill="#0e060c"/>' +
    '<g fill="#ffcf3f" stroke="' + O + '" stroke-width="4">' + [[62, 160], [92, 168], [122, 162], [150, 168], [78, 140], [108, 146], [138, 142]].map(function (p) { return '<rect x="' + p[0] + '" y="' + p[1] + '" width="34" height="16" rx="3"/>'; }).join("") + "</g>" +
    '<g fill="#43c777" stroke="' + O + '" stroke-width="4"><rect x="70" y="110" width="44" height="22" rx="3"/><rect x="118" y="104" width="44" height="22" rx="3"/></g>' +
    '<g class="door"><rect x="18" y="18" width="194" height="194" rx="18" fill="url(#gSteel)" stroke="' + O + '" stroke-width="8"/><rect x="34" y="34" width="162" height="162" rx="12" fill="none" stroke="#5d6782" stroke-width="5"/>' +
    '<g class="dial"><circle cx="115" cy="115" r="52" fill="#c9d0de" stroke="' + O + '" stroke-width="7"/><circle cx="115" cy="115" r="26" fill="url(#gGold)" stroke="' + O + '" stroke-width="6"/><path d="M115 70V160M70 115H160M83 83 147 147M147 83 83 147" stroke="' + O + '" stroke-width="7" stroke-linecap="round"/><circle cx="115" cy="115" r="10" fill="#d22f3f" stroke="' + O + '" stroke-width="4"/></g>' +
    '<rect x="190" y="70" width="14" height="30" rx="4" fill="#5d6782" stroke="' + O + '" stroke-width="4"/><rect x="190" y="130" width="14" height="30" rx="4" fill="#5d6782" stroke="' + O + '" stroke-width="4"/></g></svg>';
}
function fsIntro(n, m) {
  return new Promise(function (res) {
    var ov = $("fsov"); ov.classList.remove("open");
    $("fsBox").innerHTML = '<div class="vd">' + vaultSVG() + '</div><h2>THE VAULT</h2><h3>' + n + ' FREE SPINS</h3><p>Every Ring collect raises the multiplier: x1 → x2 → x3 → x5 → x10.' + (m ? " Starts at x" + LADDER[m] + "." : "") + '</p><button class="btn" id="fsGo">START</button>';
    ov.hidden = false; SND.vault();
    setTimeout(function () { ov.classList.add("open"); SND.ring(); }, 350);
    var go = function () { SND.click(); ov.hidden = true; res(); };
    $("fsGo").onclick = go; if (auto) setTimeout(function () { if (!ov.hidden) go(); }, 2600);
  });
}
function fsOutro(v) {
  return new Promise(function (res) {
    var ov = $("fsov"); ov.classList.add("open");
    $("fsBox").innerHTML = '<h3>VAULT CLEANED OUT</h3><h2>' + money(v) + '</h2><p>' + (v > 0 ? "Don Gatto keeps his cut. You keep the rest." : "The vault was empty this time.") + '</p><button class="btn" id="fsGo">COLLECT</button>';
    ov.hidden = false; if (v > 0) { FX.rain(60); SND.big(); CH.set(v >= 20 * roundBet ? "big" : "win", 3000); }
    var go = function () { SND.click(); ov.hidden = true; res(); };
    $("fsGo").onclick = go; if (auto) setTimeout(function () { if (!ov.hidden) go(); }, 3000);
  });
}
/* giros grátis: espelha o contador do servidor (10 giros, +5 com 3 cofres, máximo 50) */
async function runFS(res, start) {
  FS = { active: true, left: 10, m: res.m0 || 0, totalC: 0, done: 0 }; hud(); ui();
  await fsIntro(10, FS.m);
  for (var i = start; i < res.s.length; i++) {
    FS.left--; FS.done++; hud();
    var sp = res.s[i], o = await playSpin(sp);
    FS.totalC += sp.w; setWin(cash(FS.totalC));
    if (sp.v >= 3 && FS.done + FS.left < 50) { FS.left = Math.min(FS.left + 5, 50 - FS.done); hud(); toast("+5 FREE SPINS"); SND.vault(); }
    if (sp.w >= 2000) await bigWin(cash(sp.w)); else if (sp.w > 0) CH.set("win", 1200); else CH.set("idle");
    await sleep(TT(420));
  }
  var tot = cash(FS.totalC); FS.active = false; hud();
  await fsOutro(tot);
}
async function play(m) {
  if (busy) return;
  if (!signed) { if (embedded) parent.postMessage({ t: "login" }, location.origin); else toast("Open Don Gatto from RDCasino to play."); auto = 0; ui(); return; }
  var md = m || (hunt ? "hunt" : "base"), b = bet(), cost = Math.round(b * COST[md] * 100) / 100;
  if (bal < cost - 1e-9) { toast("Not enough balance"); auto = 0; ui(); return; }
  busy = true; roundBet = b; var before = bal; bal = Math.round((bal - cost) * 100) / 100; ui();
  var r = await ask({ t: "spin", mode: md, bet: b });
  if (r.error) { bal = pendingBal != null ? pendingBal : before; pendingBal = null; busy = false; auto = 0; ui(); toast(r.error); CH.set("angry", 1200); return; }
  var res = r.result;
  try {
    var start = md === "buy" || md === "super" ? 0 : 1;
    if (start === 1) {
      var first = res.s[0], o = await playSpin(first);
      if (res.s.length === 1) {
        if (first.w >= 2000) await bigWin(cash(first.w)); else if (first.w > 0) CH.set("win", 1600); else if (o.near) { CH.set("angry", 1600); SND.angry(); } else CH.set("idle");
      } else { cellsOf("va").forEach(function (x) { x.el && x.el.classList.add("pulse"); }); SND.vault(); await sleep(TT(1300)); }
    }
    if (res.s.length > start) await runFS(res, start);
    if (res.cap) toast("MAX WIN 5,000x REACHED");
    if (res.limited) toast("Max profit per bet applied");
    setWin(r.payout);
  } catch (err) { console.error(err); }
  finally {
    bal = pendingBal != null ? pendingBal : r.balance; pendingBal = null;
    busy = false; ui();
    if (embedded) parent.postMessage({ t: "done", id: r.id }, location.origin);
    if (pendingLayout) { pendingLayout = false; layout(true); }
  }
  if (auto > 0) { auto--; ui(); if (auto > 0) { await sleep(TT(300)); play(); } }
}
function buyBonus(kind) { closeModal(); play(kind === "super" ? "super" : "buy"); }
/* ================= UI ================= */
function ui() {
  bal = Math.round(bal * 100) / 100;
  $("balv").textContent = money(bal); $("betv").textContent = money(bet());
  var lock = busy || FS.active;
  $("buy").disabled = lock; $("minus").disabled = lock || betI === 0; $("plus").disabled = lock || betI === BETS.length - 1;
  $("spin").classList.toggle("busy", busy && !auto); $("spin").disabled = FS.active;
  var cnt = $("spin").querySelector(".cnt"), svg = $("spin").querySelector("svg");
  cnt.hidden = !auto; cnt.textContent = auto; svg.style.visibility = auto ? "hidden" : "visible";
  $("auto").classList.toggle("on", auto > 0); $("auto").disabled = FS.active;
  $("turbo").classList.toggle("on", turbo);
  $("buy").querySelector("small").textContent = hunt ? "HUNT ON" : "BONUS";
}
var tmT; function toast(t) { var e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(tmT); tmT = setTimeout(function () { e.classList.remove("on"); }, 1600); }
function closeModal() { $("modal").hidden = true; }
function openBuy() {
  if (busy || FS.active) return; SND.click();
  var b = bet(), items = [
    { k: "hunt", t: "BONUS HUNT", d: "3x more likely to land the Vault. Costs 3x bet per spin.", p: b * 3, u: "PER SPIN", ico: '<svg viewBox="0 0 100 100">' + SYM.va.replace(/^<svg[^>]*>|<\/svg>$/g, "") + '<circle cx="80" cy="80" r="18" fill="#2fd47a" stroke="' + O + '" stroke-width="5"/><text x="80" y="87" text-anchor="middle" font-family="Luckiest Guy, Arial Black" font-size="18" fill="' + O + '">3x</text></svg>' },
    { k: "vault", t: "THE VAULT", d: "10 Free Spins. Ring collects climb x1 to x10.", p: b * 100, u: "100x BET", ico: '<svg viewBox="0 0 100 100">' + SYM.va.replace(/^<svg[^>]*>|<\/svg>$/g, "") + "</svg>" },
    { k: "super", t: "SUPER VAULT", d: "10 Free Spins. Multiplier starts at x5.", p: b * 300, u: "300x BET", ico: '<svg viewBox="0 0 100 100">' + SYM.va.replace(/^<svg[^>]*>|<\/svg>$/g, "") + '<g transform="translate(52 -6) scale(.5)">' + SYM.ri.replace(/^<svg[^>]*>|<\/svg>$/g, "") + "</g></svg>" }
  ];
  $("modalBody").innerHTML = '<div class="mh"><h2>BONUS BUY</h2><button class="x" id="mx" aria-label="Close">×</button></div><div class="buys">' + items.map(function (it) {
    var act = it.k === "hunt" ? '<button class="btn' + (hunt ? " on" : "") + '" data-k="hunt">' + (hunt ? "ON" : "ACTIVATE") + "</button>" : '<button class="btn" data-k="' + it.k + '"' + (bal < it.p ? " disabled" : "") + ">BUY</button>";
    return '<div class="bcard' + (it.k === "super" ? " hot" : "") + '"><div class="ico">' + it.ico + "</div><h3>" + it.t + "</h3><p>" + it.d + '</p><div class="price">' + money(it.p) + "<small>" + it.u + "</small></div>" + act + "</div>";
  }).join("") + "</div>";
  $("modal").hidden = false;
  $("mx").onclick = function () { SND.click(); closeModal(); };
  $("modalBody").querySelectorAll("[data-k]").forEach(function (btn) {
    btn.onclick = function () {
      SND.click(); var k = btn.getAttribute("data-k");
      if (k === "hunt") { hunt = !hunt; ui(); openBuy(); return; }
      var price = bet() * (k === "super" ? 300 : 100);
      var wrap = document.createElement("div"); wrap.className = "confirm";
      wrap.innerHTML = '<button class="btn ghost">BACK</button><button class="btn">' + money(price) + "</button>";
      btn.replaceWith(wrap);
      wrap.children[0].onclick = function () { SND.click(); openBuy(); };
      wrap.children[1].onclick = function () { SND.click(); buyBonus(k); };
    };
  });
}
function openInfo() {
  SND.click();
  var high = ["fi", "ca", "vi", "wh", "ci"], low = ["di", "cl", "sp", "he"];
  function row(s) { return '<div class="pt"><div class="ico">' + SYM[s] + "</div><div>5 · <b>" + pay(s, 5).toFixed(2) + "x</b><br>10 · <b>" + pay(s, 10).toFixed(2) + "x</b><br>15+ · <b>" + pay(s, 15).toFixed(2) + "x</b></div></div>"; }
  $("modalBody").innerHTML = '<div class="mh"><h2>HOW IT PAYS</h2><button class="x" id="mx" aria-label="Close">×</button></div><div class="info">' +
    "<p>Clusters of 5 or more matching symbols touching up, down, left or right pay. Winning symbols vanish and new ones tumble in until no more clusters form.</p>" +
    '<div class="ptab">' + high.concat(low).map(row).join("") + "</div>" +
    '<h4>ENVELOPES AND THE RING</h4><div class="ptab"><div class="pt"><div class="ico">' + SYM.en + '</div><div>Carries a cash value from <b>1x</b> to <b>100x</b> your bet.</div></div><div class="pt"><div class="ico">' + SYM.ri + "</div><div>When the Ring lands, Don Gatto collects <b>every envelope</b> on the grid.</div></div></div>" +
    '<h4>THE VAULT</h4><div class="ptab"><div class="pt"><div class="ico">' + SYM.va + "</div><div>3 Vaults give <b>10 Free Spins</b>. Each collect raises the multiplier x1 → x2 → x3 → x5 → x10. 3 more Vaults give +5 spins.</div></div></div>" +
    "<h4>MATH</h4><p>RTP 96.50% in every mode: base game, Bonus Hunt, The Vault and Super Vault. Max win 5,000x the bet; the round ends when it is reached. Every spin is decided on our server with your provably fair seeds and can be checked in your bet history.</p></div>";
  $("modal").hidden = false; $("mx").onclick = function () { SND.click(); closeModal(); };
}

$("spin").addEventListener("click", function () { ac(); if (auto) { auto = 0; ui(); return; } play(); });
$("auto").addEventListener("click", function () { ac(); SND.click(); if (auto) { auto = 0; ui(); return; } auto = 10; ui(); if (!busy) play(); });
$("turbo").addEventListener("click", function () { SND.click(); turbo = !turbo; ui(); toast(turbo ? "TURBO ON" : "TURBO OFF"); });
$("minus").addEventListener("click", function () { SND.click(); if (betI > 0) { betI--; refreshTags(); ui(); } });
$("plus").addEventListener("click", function () { SND.click(); if (betI < BETS.length - 1) { betI++; refreshTags(); ui(); } });
$("buy").addEventListener("click", openBuy);
$("infoBtn").addEventListener("click", openInfo);
$("sndBtn").addEventListener("click", function () { muted = !muted; $("sndW").style.display = muted ? "none" : ""; if (!muted) SND.click(); toast(muted ? "SOUND OFF" : "SOUND ON"); });
$("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeModal(); });
document.addEventListener("keydown", function (e) { if (e.code === "Space" && $("modal").hidden && $("fsov").hidden && $("big").hidden) { e.preventDefault(); $("spin").click(); } if (e.key === "Escape") closeModal(); });
$("buyIco").innerHTML = SYM.va.replace(/^<svg[^>]*>|<\/svg>$/g, "");

/* orelhas do logo em cima do G, depois que a fonte carrega */
function logoEars() {
  try {
    var t = document.querySelectorAll("#logo text.lg-t")[2], e = t.getExtentOfChar(0), x = e.x, w = e.width, top = 140 - 92 * 0.74 + 7;
    var ear = function (cx, dir) { return '<path d="M' + (cx - 15) + " " + (top + 8) + "L" + (cx + dir * 4) + " " + (top - 26) + "L" + (cx + 15) + " " + (top + 8) + 'Z" fill="#3b3f5c" stroke="#1a1026" stroke-width="7" stroke-linejoin="round"/><path d="M' + (cx - 7) + " " + (top + 4) + "L" + (cx + dir * 3) + " " + (top - 14) + "L" + (cx + 7) + " " + (top + 4) + 'Z" fill="#ff9fb4"/>'; };
    $("lgEars").innerHTML = ear(x + w * .3, -1) + ear(x + w * .76, 1);
  } catch (err) { }
}

/* ================= INÍCIO ================= */
grid = rows(["he sp ci di cl wh", "di ca cl sp vi he", "cl he fi wh sp di", "sp vi di cl ca sp", "ci cl he di sp fi"]);
CH.init($("char"));
layout(true); ui();
window.addEventListener("resize", function () { layout(false); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { logoEars(); layout(true); }); else logoEars();
var last = performance.now();
(function loop(now) { var dt = Math.min(.033, (now - last) / 1000); last = now; CH.tick(now, dt); FX.tick(dt); requestAnimationFrame(loop); })(last);
if (embedded) parent.postMessage({ t: "hello" }, location.origin);
})();
