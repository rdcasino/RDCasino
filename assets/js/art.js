/* ==========================================================================
   RDCasino — Arte ilustrada em SVG (capas dos jogos, banners e promoções).
   Usada automaticamente quando não existe uma foto/arte em assets/img/.
   Para trocar por uma arte final (3D, IA, designer), basta salvar o arquivo
   .jpg com o mesmo nome: ele aparece por cima desta ilustração.
   ========================================================================== */
window.RD = window.RD || {};
(function () {
  "use strict";
  var seq = 0;
  function U(p) { seq++; return p + seq; }
  function lin(id, stops, x1, y1, x2, y2) {
    return '<linearGradient id="' + id + '" x1="' + (x1 || 0) + '" y1="' + (y1 || 0) + '" x2="' + (x2 == null ? 0 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : "") + "/>"; }).join("") + "</linearGradient>";
  }
  function rad(id, stops, cx, cy, r) {
    return '<radialGradient id="' + id + '" cx="' + (cx == null ? 0.5 : cx) + '" cy="' + (cy == null ? 0.5 : cy) + '" r="' + (r || 0.5) + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : "") + "/>"; }).join("") + "</radialGradient>";
  }
  function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }

  /* ---------- Objetos reutilizáveis ---------- */
  // Dado isométrico. faces: {top:[pips], left:[...], right:[...]} em coordenadas 0..1
  var PIPS = { 1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.27, 0.22], [0.27, 0.5], [0.27, 0.78], [0.73, 0.22], [0.73, 0.5], [0.73, 0.78]] };
  function die(cx, cy, s, top, left, right, pip) {
    var k = 0.866 * s, h = s / 2;
    var face = function (A, u, v, n, fill) {
      return '<polygon points="' + pts([A, [A[0] + u[0], A[1] + u[1]], [A[0] + u[0] + v[0], A[1] + u[1] + v[1]], [A[0] + v[0], A[1] + v[1]]]) + '" fill="' + fill + '"/>' +
        '<g transform="matrix(' + [u[0], u[1], v[0], v[1], A[0], A[1]].map(function (x) { return x.toFixed(2); }).join(" ") + ')">' +
        PIPS[n].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="0.085" fill="' + pip + '"/>'; }).join("") + "</g>";
    };
    return '<ellipse cx="' + cx + '" cy="' + (cy + s + 8) + '" rx="' + (k * 1.05) + '" ry="' + (s * 0.22) + '" fill="#000" opacity=".28"/>' +
      face([cx, cy - s], [k, h], [-k, h], top, "#ffffff") +
      face([cx - k, cy - h], [k, h], [0, s], left, "#dfe6f5") +
      face([cx, cy], [k, -h], [0, s], right, "#b6c2de") +
      '<polyline points="' + pts([[cx - k, cy - h], [cx, cy], [cx + k, cy - h]]) + '" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>';
  }
  function coin(cx, cy, r, g, mark) {
    var id = U("cn"), id2 = U("ce");
    return "<defs>" + lin(id, [[0, "#fff4c2"], [0.45, "#ffd23f"], [1, "#e99a00"]], 0, 0, 1, 1) + lin(id2, [[0, "#d98a00"], [1, "#9a5a00"]]) + "</defs>" +
      '<ellipse cx="' + cx + '" cy="' + (cy + r * 0.16) + '" rx="' + r + '" ry="' + (r * 0.36) + '" fill="url(#' + id2 + ')"/>' +
      '<rect x="' + (cx - r) + '" y="' + cy + '" width="' + (r * 2) + '" height="' + (r * 0.16) + '" fill="url(#' + id2 + ')"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r + '" ry="' + (r * 0.36) + '" fill="url(#' + id + ')"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (r * 0.74) + '" ry="' + (r * 0.26) + '" fill="none" stroke="#c98200" stroke-opacity=".55" stroke-width="' + (r * 0.05) + '"/>' +
      (mark ? '<text x="' + cx + '" y="' + (cy + r * 0.11) + '" text-anchor="middle" font-size="' + (r * 0.34) + '" font-weight="900" fill="#b46f00" transform="translate(0 ' + (cy * 0.64) + ') scale(1 .36)" style="font-family:var(--font-display,Arial)">' + mark + "</text>" : "");
  }
  function coinFront(cx, cy, r, mark) {
    var id = U("cf"), id2 = U("cr");
    return "<defs>" + rad(id, [[0, "#fff7cc"], [0.55, "#ffd23f"], [1, "#e89a00"]], 0.35, 0.3, 0.8) + lin(id2, [[0, "#ffe27a"], [1, "#b86e00"]], 0, 0, 1, 1) + "</defs>" +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + id2 + ')"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.86) + '" fill="url(#' + id + ')"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.7) + '" fill="none" stroke="#c98200" stroke-opacity=".45" stroke-width="' + (r * 0.05) + '"/>' +
      '<text x="' + cx + '" y="' + (cy + r * 0.3) + '" text-anchor="middle" font-size="' + (r * 0.85) + '" font-weight="900" fill="#b46f00" style="font-family:var(--font-display,Arial)">' + (mark || "$") + "</text>";
  }
  function spark(x, y, s, color, op) {
    return '<path d="M' + x + " " + (y - s) + " Q" + x + " " + y + " " + (x + s) + " " + y + " Q" + x + " " + y + " " + x + " " + (y + s) + " Q" + x + " " + y + " " + (x - s) + " " + y + " Q" + x + " " + y + " " + x + " " + (y - s) + 'Z" fill="' + (color || "#fff") + '" opacity="' + (op == null ? 0.9 : op) + '"/>';
  }
  function card(x, y, w, rot, rank, suit, red) {
    var h = w * 1.4, col = red ? "#e11d48" : "#111827", id = U("cd");
    return '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ')">' +
      "<defs>" + lin(id, [[0, "#ffffff"], [1, "#e8edf7"]]) + "</defs>" +
      '<rect x="' + (-w / 2 + 6) + '" y="' + (-h / 2 + 10) + '" width="' + w + '" height="' + h + '" rx="' + (w * 0.1) + '" fill="#000" opacity=".25"/>' +
      '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="' + (w * 0.1) + '" fill="url(#' + id + ')"/>' +
      '<text x="' + (-w / 2 + w * 0.12) + '" y="' + (-h / 2 + w * 0.3) + '" font-size="' + (w * 0.26) + '" font-weight="800" fill="' + col + '" style="font-family:var(--font-display,Arial)">' + rank + "</text>" +
      '<text x="' + (-w / 2 + w * 0.13) + '" y="' + (-h / 2 + w * 0.52) + '" font-size="' + (w * 0.2) + '" fill="' + col + '">' + suit + "</text>" +
      '<text x="0" y="' + (w * 0.2) + '" text-anchor="middle" font-size="' + (w * 0.62) + '" fill="' + col + '">' + suit + "</text>" +
      '<g transform="rotate(180)"><text x="' + (-w / 2 + w * 0.12) + '" y="' + (-h / 2 + w * 0.3) + '" font-size="' + (w * 0.26) + '" font-weight="800" fill="' + col + '" style="font-family:var(--font-display,Arial)">' + rank + "</text></g></g>";
  }
  function chip(cx, cy, r, color, n) {
    var out = "";
    for (var i = (n || 1) - 1; i >= 0; i--) {
      var y = cy - i * r * 0.22;
      out += '<ellipse cx="' + cx + '" cy="' + (y + r * 0.12) + '" rx="' + r + '" ry="' + (r * 0.42) + '" fill="#000" opacity=".25"/>' +
        '<ellipse cx="' + cx + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 0.42) + '" fill="' + color + '"/>' +
        '<ellipse cx="' + cx + '" cy="' + y + '" rx="' + (r * 0.8) + '" ry="' + (r * 0.32) + '" fill="none" stroke="#fff" stroke-width="' + (r * 0.14) + '" stroke-dasharray="' + (r * 0.32) + " " + (r * 0.32) + '"/>' +
        '<ellipse cx="' + cx + '" cy="' + y + '" rx="' + (r * 0.55) + '" ry="' + (r * 0.22) + '" fill="' + color + '" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>';
    }
    return out;
  }
  function gem(cx, cy, s, shades) {
    var S = shades || ["#7dffd6", "#3cf0b4", "#1dd396", "#12b57d", "#10a774", "#0c8c61", "#0a7a55", "#086646"];
    var P = function (x, y) { return [cx + x * s, cy + y * s]; };
    var T1 = P(-0.5, -0.85), T2 = P(0, -0.85), T3 = P(0.5, -0.85), G1 = P(-1, -0.35), G2 = P(-0.5, -0.35), G3 = P(0, -0.35), G4 = P(0.5, -0.35), G5 = P(1, -0.35), A = P(0, 1.05);
    var f = [[G1, T1, G2], [T1, T2, G3, G2], [T2, T3, G4, G3], [T3, G5, G4], [G1, G2, A], [G2, G3, A], [G3, G4, A], [G4, G5, A]];
    return f.map(function (p, i) { return '<polygon points="' + pts(p) + '" fill="' + S[i] + '" stroke="#ffffff" stroke-opacity=".25" stroke-width="1"/>'; }).join("") +
      '<polygon points="' + pts([P(-0.42, -0.8), P(-0.1, -0.8), P(-0.3, -0.42)]) + '" fill="#fff" opacity=".55"/>';
  }
  function bomb(cx, cy, r) {
    var id = U("bm");
    return "<defs>" + rad(id, [[0, "#6b7280"], [0.5, "#1f2937"], [1, "#0b0f19"]], 0.35, 0.3, 0.75) + "</defs>" +
      '<path d="M' + (cx + r * 0.5) + " " + (cy - r * 0.8) + " q" + r * 0.3 + " " + -r * 0.5 + " " + r * 0.75 + " " + -r * 0.35 + '" fill="none" stroke="#a16207" stroke-width="' + r * 0.12 + '" stroke-linecap="round"/>' +
      '<rect x="' + (cx + r * 0.25) + '" y="' + (cy - r * 0.98) + '" width="' + r * 0.45 + '" height="' + r * 0.35 + '" rx="' + r * 0.06 + '" transform="rotate(35 ' + (cx + r * 0.47) + " " + (cy - r * 0.8) + ')" fill="#374151"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + id + ')"/>' + spark(cx + r * 1.28, cy - r * 1.22, r * 0.38, "#ffd23f", 1) + spark(cx + r * 1.28, cy - r * 1.22, r * 0.18, "#fff", 1);
  }
  function trophy(cx, cy, s) {
    var id = U("tr"), id2 = U("tb");
    return "<defs>" + lin(id, [[0, "#fff1b8"], [0.4, "#ffcf33"], [1, "#d68a00"]], 0, 0, 1, 1) + lin(id2, [[0, "#7c3aed"], [1, "#3b0f8a"]]) + "</defs>" +
      '<g transform="translate(' + cx + " " + cy + ") scale(" + s + ')">' +
      '<path d="M-58 -70 h-34 a40 40 0 0 0 40 52" fill="none" stroke="#e5a400" stroke-width="12"/><path d="M58 -70 h34 a40 40 0 0 1 -40 52" fill="none" stroke="#e5a400" stroke-width="12"/>' +
      '<path d="M-62 -88 h124 v20 c0 52 -26 86 -62 92 c-36 -6 -62 -40 -62 -92z" fill="url(#' + id + ')"/>' +
      '<path d="M-40 -80 c-2 44 10 70 26 80" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="8" stroke-linecap="round"/>' +
      '<rect x="-12" y="4" width="24" height="34" fill="#e5a400"/><rect x="-46" y="36" width="92" height="22" rx="6" fill="url(#' + id + ')"/>' +
      '<rect x="-58" y="56" width="116" height="30" rx="8" fill="url(#' + id2 + ')"/>' +
      '<text x="0" y="-26" text-anchor="middle" font-size="38" font-weight="900" fill="#b46f00" style="font-family:var(--font-display,Arial)">1</text></g>';
  }
  function gift(cx, cy, s) {
    var id = U("gf"), id2 = U("gl");
    return "<defs>" + lin(id, [[0, "#ff5c7a"], [1, "#c8103a"]], 0, 0, 1, 1) + lin(id2, [[0, "#ff8aa0"], [1, "#e11d48"]]) + "</defs>" +
      '<g transform="translate(' + cx + " " + cy + ") scale(" + s + ')">' +
      '<ellipse cx="0" cy="92" rx="100" ry="16" fill="#000" opacity=".25"/>' +
      '<rect x="-80" y="-10" width="160" height="100" rx="10" fill="url(#' + id + ')"/><rect x="-92" y="-44" width="184" height="40" rx="10" fill="url(#' + id2 + ')"/>' +
      '<rect x="-14" y="-44" width="28" height="134" fill="#ffd23f"/><rect x="-80" y="-10" width="160" height="8" fill="#000" opacity=".15"/>' +
      '<path d="M0 -44 c-30 -50 -78 -40 -66 -14 c8 16 46 14 66 14z" fill="#ffd23f"/><path d="M0 -44 c30 -50 78 -40 66 -14 c-8 16 -46 14 -66 14z" fill="#ffc400"/>' +
      '<circle cx="0" cy="-46" r="13" fill="#ffb800"/><rect x="-60" y="2" width="10" height="70" rx="5" fill="#fff" opacity=".25"/></g>';
  }
  function stars(seed, n, w, h, color) {
    var out = "", x = seed;
    for (var i = 0; i < n; i++) { x = (x * 9301 + 49297) % 233280; var a = x / 233280; x = (x * 9301 + 49297) % 233280; var b = x / 233280; x = (x * 9301 + 49297) % 233280; out += '<circle cx="' + (a * w).toFixed(1) + '" cy="' + (b * h).toFixed(1) + '" r="' + (0.6 + (x / 233280) * 1.6).toFixed(2) + '" fill="' + (color || "#fff") + '" opacity="' + (0.25 + (x / 233280) * 0.6).toFixed(2) + '"/>'; }
    return out;
  }

  /* ---------- Capas (300×400) ---------- */
  var COVERS = {
    dice: { a: "#3b6cff", b: "#0b1a4a", draw: function () { return die(118, 168, 64, 5, 2, 3, "#e11d48") + die(196, 222, 50, 6, 1, 4, "#2f6bff") + spark(232, 92, 12) + spark(70, 96, 8, "#fff", 0.6); } },
    limbo: { a: "#ffb020", b: "#7a2e00", draw: function () {
      var id = U("lr");
      return "<defs>" + rad(id, [[0, "#fff"], [0.35, "#ffe08a"], [1, "#ff9d00", 0]]) + "</defs>" +
        '<circle cx="150" cy="170" r="104" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="10"/><circle cx="150" cy="170" r="76" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="10"/><circle cx="150" cy="170" r="48" fill="#fff" fill-opacity=".9"/><circle cx="150" cy="170" r="26" fill="#ff7a00"/>' +
        '<path d="M70 262 L196 112" stroke="#1e3a8a" stroke-width="12" stroke-linecap="round"/><path d="M226 78 L178 98 L206 126 Z" fill="#1e3a8a"/><path d="M64 270 l-18 -4 l10 -14 z M74 278 l-6 18 l-12 -12z" fill="#1e3a8a"/>' +
        '<rect x="188" y="208" width="88" height="40" rx="12" fill="#1e3a8a"/><text x="232" y="235" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">100×</text>' + spark(80, 90, 12) + spark(240, 60, 8);
    } },
    crash: { a: "#1aa3ff", b: "#05213f", draw: function () {
      var f1 = U("fl"), f2 = U("fi"), bd = U("rb");
      return "<defs>" + lin(f1, [[0, "#ffe259"], [0.5, "#ff8a00"], [1, "#ff3d00", 0]]) + lin(f2, [[0, "#ffffff"], [1, "#ffe259", 0]]) + lin(bd, [[0, "#ffffff"], [1, "#cfd8ea"]], 0, 0, 1, 0) + "</defs>" +
        stars(7, 40, 300, 300) +
        '<path d="M20 300 C 90 290 150 250 250 90" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="7" stroke-linecap="round"/>' +
        '<g transform="translate(176 168) rotate(38)">' +
        '<path d="M-17 52 C-16 92 0 128 0 150 C0 128 16 92 17 52Z" fill="url(#' + f1 + ')"/><path d="M-8 52 C-8 78 0 96 0 108 C0 96 8 78 8 52Z" fill="url(#' + f2 + ')"/>' +
        '<path d="M-30 6 L-58 58 L-28 48Z M30 6 L58 58 L28 48Z" fill="#e11d48"/>' +
        '<path d="M0 -92 C32 -62 36 -10 30 44 L-30 44 C-36 -10 -32 -62 0 -92Z" fill="url(#' + bd + ')"/>' +
        '<path d="M0 -92 C18 -76 25 -60 28 -48 L-28 -48 C-25 -60 -18 -76 0 -92Z" fill="#e11d48"/>' +
        '<circle cx="0" cy="-12" r="16" fill="#1e3a8a" stroke="#94a3b8" stroke-width="6"/><circle cx="-5" cy="-17" r="5" fill="#fff" opacity=".7"/>' +
        '<rect x="-20" y="42" width="40" height="12" rx="3" fill="#64748b"/><path d="M-6 -48 L-6 40" stroke="#fff" stroke-opacity=".6" stroke-width="5"/></g>';
    } },
    mines: { a: "#8b5cf6", b: "#22094a", draw: function () { var g = U("mg"); return "<defs>" + rad(g, [[0, "#5fffd0", 0.6], [1, "#5fffd0", 0]]) + '</defs><circle cx="150" cy="190" r="110" fill="url(#' + g + ')"/>' + bomb(222, 104, 28) + gem(146, 196, 72) + spark(78, 108, 12) + spark(248, 250, 9); } },
    plinko: { a: "#ff4fa0", b: "#4a0429", draw: function () {
      var out = "", ball = U("pb");
      for (var i = 0; i < 6; i++) for (var j = 0; j < i + 3; j++) out += '<circle cx="' + (150 + (j - (i + 2) / 2) * 32) + '" cy="' + (90 + i * 30) + '" r="5.5" fill="#fff" opacity=".95"/>';
      var cols = ["#ff3b3b", "#ff7a1a", "#ffb31a", "#ffe03a", "#ffb31a", "#ff7a1a", "#ff3b3b"];
      cols.forEach(function (c, k) { out += '<rect x="' + (150 + (k - 3) * 32 - 13) + '" y="262" width="26" height="20" rx="5" fill="' + c + '"/>'; });
      return "<defs>" + rad(ball, [[0, "#fff8c4"], [0.5, "#ffd23f"], [1, "#ff9d00"]], 0.35, 0.3, 0.7) + "</defs>" + out +
        '<circle cx="134" cy="132" r="13" fill="url(#' + ball + ')"/><circle cx="182" cy="196" r="13" fill="url(#' + ball + ')"/>' + spark(240, 80, 10) + spark(60, 230, 8);
    } },
    hilo: { a: "#14c8e6", b: "#053344", draw: function () {
      return card(112, 182, 108, -12, "A", "♠", false) + card(190, 172, 108, 10, "K", "♥", true) +
        '<circle cx="244" cy="86" r="24" fill="#16a34a"/><path d="M244 74 l12 14 h-8 v12 h-8 v-12 h-8z" fill="#fff"/>' +
        '<circle cx="58" cy="270" r="24" fill="#e11d48"/><path d="M58 282 l12 -14 h-8 v-12 h-8 v12 h-8z" fill="#fff"/>';
    } },
    blackjack: { a: "#22b35e", b: "#063a1c", draw: function () {
      return card(116, 168, 104, -10, "A", "♠", false) + card(186, 162, 104, 9, "K", "♥", true) + chip(230, 274, 30, "#e11d48", 4) + chip(78, 286, 24, "#1d4ed8", 3) +
        '<circle cx="66" cy="84" r="30" fill="#ffd23f"/><text x="66" y="95" text-anchor="middle" font-size="30" font-weight="900" fill="#7a4a00" style="font-family:var(--font-display,Arial)">21</text>';
    } },
    roulette: { a: "#5b5bf0", b: "#15124a", draw: function () {
      var cx = 150, cy = 178, out = "", rim = U("rr"), hub = U("rh");
      var ord = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
      for (var i = 0; i < 37; i++) {
        var a0 = (i / 37) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 37) * Math.PI * 2 - Math.PI / 2, R = 100, r = 74;
        var c = i === 0 ? "#16a34a" : i % 2 ? "#dc2626" : "#111827";
        out += '<path d="M' + (cx + R * Math.cos(a0)).toFixed(1) + " " + (cy + R * Math.sin(a0)).toFixed(1) + " A" + R + " " + R + " 0 0 1 " + (cx + R * Math.cos(a1)).toFixed(1) + " " + (cy + R * Math.sin(a1)).toFixed(1) + " L" + (cx + r * Math.cos(a1)).toFixed(1) + " " + (cy + r * Math.sin(a1)).toFixed(1) + " A" + r + " " + r + " 0 0 0 " + (cx + r * Math.cos(a0)).toFixed(1) + " " + (cy + r * Math.sin(a0)).toFixed(1) + 'Z" fill="' + c + '" stroke="#e5c07b" stroke-width=".8"/>';
      }
      return "<defs>" + lin(rim, [[0, "#f6d58a"], [1, "#9a6a1f"]], 0, 0, 1, 1) + rad(hub, [[0, "#fff1c2"], [0.6, "#e5b13c"], [1, "#8a5a10"]], 0.4, 0.35, 0.7) + "</defs>" +
        '<ellipse cx="150" cy="292" rx="110" ry="16" fill="#000" opacity=".3"/><circle cx="150" cy="178" r="114" fill="url(#' + rim + ')"/><circle cx="150" cy="178" r="104" fill="#3b1d0a"/>' + out +
        '<circle cx="150" cy="178" r="74" fill="#5a2d0c"/><circle cx="150" cy="178" r="52" fill="#7a3d12"/><circle cx="150" cy="178" r="24" fill="url(#' + hub + ')"/>' +
        '<path d="M150 136 v84 M108 178 h84" stroke="#e5b13c" stroke-width="6" stroke-linecap="round"/><circle cx="150" cy="178" r="10" fill="url(#' + hub + ')"/>' +
        '<circle cx="214" cy="112" r="8" fill="#fff"/><circle cx="212" cy="110" r="3" fill="#fff" opacity=".9"/>';
    } },
    wheel: { a: "#ff7a1a", b: "#4a1203", draw: function () {
      var cx = 150, cy = 182, R = 104, out = "", cols = ["#2f6bff", "#7c3aed", "#14c8e6", "#ffd23f", "#e11d48", "#22c55e"];
      for (var i = 0; i < 12; i++) {
        var a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
        out += '<path d="M' + cx + " " + cy + " L" + (cx + R * Math.cos(a0)).toFixed(1) + " " + (cy + R * Math.sin(a0)).toFixed(1) + " A" + R + " " + R + " 0 0 1 " + (cx + R * Math.cos(a1)).toFixed(1) + " " + (cy + R * Math.sin(a1)).toFixed(1) + 'Z" fill="' + cols[i % 6] + '"/>';
      }
      for (var j = 0; j < 16; j++) { var a = (j / 16) * Math.PI * 2; out += '<circle cx="' + (cx + (R + 9) * Math.cos(a)).toFixed(1) + '" cy="' + (cy + (R + 9) * Math.sin(a)).toFixed(1) + '" r="4" fill="#fff4c2"/>'; }
      return '<ellipse cx="150" cy="300" rx="100" ry="14" fill="#000" opacity=".3"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 16) + '" fill="#1f1235"/>' + out +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/><circle cx="' + cx + '" cy="' + cy + '" r="22" fill="#fff"/><circle cx="' + cx + '" cy="' + cy + '" r="10" fill="#1f1235"/>' +
        '<path d="M150 92 l-16 -30 h32z" fill="#fff" stroke="#1f1235" stroke-width="4" stroke-linejoin="round"/>';
    } },
    keno: { a: "#ff3d6e", b: "#4a0518", draw: function () {
      var out = "";
      for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) out += '<rect x="' + (52 + j * 40) + '" y="' + (70 + i * 40) + '" width="32" height="32" rx="7" fill="#fff" opacity="' + ((i * 5 + j) % 7 === 0 ? 0.35 : 0.1) + '"/>';
      var ball = function (x, y, r, n, band) { var id = U("kb"); return "<defs>" + rad(id, [[0, "#ffffff"], [0.7, "#e8edf7"], [1, "#9aa6c2"]], 0.35, 0.3, 0.75) + '</defs><ellipse cx="' + x + '" cy="' + (y + r + 6) + '" rx="' + r * 0.8 + '" ry="' + r * 0.2 + '" fill="#000" opacity=".25"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#' + id + ')"/><circle cx="' + x + '" cy="' + y + '" r="' + r * 0.58 + '" fill="' + band + '"/><text x="' + x + '" y="' + (y + r * 0.22) + '" text-anchor="middle" font-size="' + r * 0.62 + '" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">' + n + "</text>"; };
      return out + ball(108, 218, 46, 7, "#2f6bff") + ball(204, 176, 40, 21, "#e11d48") + ball(170, 262, 30, 40, "#16a34a") + spark(244, 86, 10);
    } }
  };

  function cover(id) {
    var c = COVERS[id]; if (!c) return "";
    var bg = U("bg"), gl = U("gw"), fd = U("fd"), name = { dice: "DICE", limbo: "LIMBO", crash: "CRASH", mines: "MINES", plinko: "PLINKO", hilo: "HI-LO", blackjack: "BLACKJACK", roulette: "ROULETTE", wheel: "WHEEL", keno: "KENO" }[id];
    return '<svg class="art" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + name + '"><defs>' +
      lin(bg, [[0, c.a], [1, c.b]]) + rad(gl, [[0, "#ffffff", 0.35], [1, "#ffffff", 0]]) + lin(fd, [[0, "#000", 0], [1, "#000", 0.55]]) + "</defs>" +
      '<rect width="300" height="400" fill="url(#' + bg + ')"/>' +
      '<g opacity=".08" fill="#fff"><rect x="-60" y="40" width="420" height="22" transform="rotate(-24 150 200)"/><rect x="-60" y="120" width="420" height="8" transform="rotate(-24 150 200)"/><rect x="-60" y="300" width="420" height="40" transform="rotate(-24 150 200)"/></g>' +
      '<circle cx="150" cy="180" r="150" fill="url(#' + gl + ')"/>' + c.draw() +
      '<rect y="270" width="300" height="130" fill="url(#' + fd + ')"/>' +
      '<text x="150" y="356" text-anchor="middle" font-size="' + (name.length > 7 ? 34 : 40) + '" font-weight="900" fill="#fff" letter-spacing="-0.5" style="font-family:var(--font-display,Arial)">' + name + "</text>" +
      '<text x="150" y="381" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" fill-opacity=".7" letter-spacing="3" style="font-family:var(--font,Arial)">RD ORIGINALS</text></svg>';
  }

  /* ---------- Banners e promoções (1200×600, arte no lado direito) ---------- */
  function scene(a, b, body, w, h) {
    w = w || 1200; h = h || 600;
    var bg = U("bb"), gl = U("bgl");
    return '<svg class="art" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' + lin(bg, [[0, a], [1, b]], 0, 0, 1, 1) + rad(gl, [[0, "#ffffff", 0.32], [1, "#ffffff", 0]]) + "</defs>" +
      '<rect width="' + w + '" height="' + h + '" fill="url(#' + bg + ')"/>' +
      '<g opacity=".07" fill="#fff"><rect x="' + (w * 0.4) + '" y="-200" width="70" height="1200" transform="rotate(28 ' + w * 0.6 + " " + h / 2 + ')"/><rect x="' + (w * 0.55) + '" y="-200" width="26" height="1200" transform="rotate(28 ' + w * 0.6 + " " + h / 2 + ')"/><rect x="' + (w * 0.66) + '" y="-200" width="120" height="1200" transform="rotate(28 ' + w * 0.6 + " " + h / 2 + ')"/></g>' +
      '<circle cx="' + (w - h * 0.62) + '" cy="' + h * 0.5 + '" r="' + h * 0.55 + '" fill="url(#' + gl + ')"/>' + body + "</svg>";
  }
  var SCENES = {
    welcome: function (p) { p = p || {}; return scene(p.a || "#ff2e55", p.b || "#4a0716", gift(890, 300, 1.75) + coinFront(1080, 170, 58) + coinFront(720, 470, 42) + coin(1070, 470, 52) + spark(760, 140, 22) + spark(1120, 330, 14) + spark(990, 90, 12)); },
    leaderboard: function (p) { p = p || {}; return scene(p.a || "#8a1f5c", p.b || "#1f0618", trophy(900, 300, 1.85) + coinFront(1090, 450, 50, "1") + coinFront(715, 180, 36) + stars(3, 30, 1200, 600, "#ffd23f") + spark(1080, 150, 20) + spark(740, 450, 16)); },
    affiliate: function (p) { p = p || {};
      var id = U("ch");
      return scene(p.a || "#5b2a86", p.b || "#170a2e", "<defs>" + lin(id, [[0, "#ffffff"], [1, "#b9e9f5"]], 0, 0, 1, 1) + "</defs>" +
        '<g transform="translate(880 300) rotate(-35)"><rect x="-210" y="-58" width="230" height="116" rx="58" fill="none" stroke="url(#' + id + ')" stroke-width="34"/><rect x="-20" y="-58" width="230" height="116" rx="58" fill="none" stroke="#ffd23f" stroke-width="34"/></g>' +
        coinFront(1090, 150, 50) + coinFront(700, 470, 40) + coin(1060, 480, 46) + spark(760, 130, 18) + spark(1140, 330, 12));
    },
    reload: function (p) { p = p || {}; return scene(p.a || "#e0457b", p.b || "#3d0a24", '<g transform="translate(900 300)"><path d="M-150 -20 A150 150 0 0 1 120 -90" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round"/><path d="M150 20 A150 150 0 0 1 -120 90" fill="none" stroke="#ffd23f" stroke-width="34" stroke-linecap="round"/><path d="M150 -150 l14 92 l-88 -30z" fill="#fff"/><path d="M-150 150 l-14 -92 l88 30z" fill="#ffd23f"/></g>' + coinFront(900, 300, 70) + spark(1110, 120, 18)); },
    rakeback: function (p) { p = p || {}; return scene(p.a || "#6b21a8", p.b || "#1f0638", coinFront(900, 300, 150, "") + '<path d="M915 180 L840 320 h55 l-25 110 l95 -150 h-58 z" fill="#b46f00"/><path d="M910 170 L835 310 h55 l-25 110 l95 -150 h-58 z" fill="#fff5c2"/>' + spark(1100, 140, 20) + spark(720, 470, 16)); },
    race: function (p) { p = p || {}; return scene(p.a || "#ffb020", p.b || "#6b2100", trophy(900, 300, 1.75) + spark(1080, 140, 22) + spark(720, 160, 14) + stars(9, 22, 1200, 600, "#fff")); },
    hero: function (p) { p = p || {}; var bars = ""; [120, 180, 150, 240, 300, 380].forEach(function (hh, i) { bars += '<rect x="' + (1180 + i * 90) + '" y="' + (700 - hh) + '" width="62" height="' + hh + '" rx="10" fill="#fff" opacity="' + (0.25 + i * 0.12) + '"/>'; });
      return scene(p.a || "#ff2e55", p.b || "#22040c", bars + '<path d="M1170 560 L1300 470 L1390 500 L1480 380 L1570 330 L1680 210" fill="none" stroke="#ffd23f" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>' + coinFront(1700, 200, 60) + coinFront(1100, 250, 44) + coin(1560, 640, 56) + spark(1300, 160, 20), 1920, 800); }
  };

  /* Ilustração genérica para jogos de provedores (sem arte oficial ainda) */
  function generic(o) {
    var bg = U("gb"), gl = U("gg");
    return '<svg class="art" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>' + lin(bg, [[0, o.c1 || "#1e2f3d"], [1, o.c2 || "#0a121a"]]) + rad(gl, [[0, "#fff", 0.22], [1, "#fff", 0]]) + "</defs>" +
      '<rect width="300" height="400" fill="url(#' + bg + ')"/><circle cx="150" cy="170" r="140" fill="url(#' + gl + ')"/>' +
      '<g opacity=".08" fill="#fff"><rect x="-60" y="60" width="420" height="18" transform="rotate(-24 150 200)"/><rect x="-60" y="260" width="420" height="40" transform="rotate(-24 150 200)"/></g></svg>';
  }

  RD.art = {
    cover: cover,
    has: function (key) { var k = String(key).split(":"); return k[0] === "cover" ? !!COVERS[k[1]] : k[0] === "scene" ? !!SCENES[k[1]] : false; },
    render: function (key, o) {
      var k = String(key).split(":");
      if (k[0] === "cover" && COVERS[k[1]]) return cover(k[1]);
      if (k[0] === "scene" && SCENES[k[1]]) return SCENES[k[1]](o);
      return generic(o || {});
    },
    games: Object.keys(COVERS)
  };
})();
