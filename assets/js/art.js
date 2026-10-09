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
  var SUITP = {
    "♠": "M12 2C9 6.5 3.5 9.5 3.5 14a4.5 4.5 0 0 0 7.6 3.2L10 22h4l-1.1-4.8A4.5 4.5 0 0 0 20.5 14C20.5 9.5 15 6.5 12 2z",
    "♥": "M12 21s-7.5-4.6-9.6-9.2C.9 8 3.2 4 7 4c2.1 0 3.6 1.1 5 2.9C13.4 5.1 14.9 4 17 4c3.8 0 6.1 4 4.6 7.8C19.5 16.4 12 21 12 21z",
    "♦": "M12 2 L20 12 L12 22 L4 12 Z",
    "♣": "M12 2.5a4.3 4.3 0 0 0-3.6 6.7A4.3 4.3 0 1 0 10.6 17L10 22h4l-.6-5a4.3 4.3 0 1 0 2.2-7.8A4.3 4.3 0 0 0 12 2.5z"
  };
  function suitAt(suit, x, y, size, col) { return '<path d="' + SUITP[suit] + '" fill="' + col + '" transform="translate(' + (x - size / 2) + " " + (y - size / 2) + ") scale(" + (size / 24) + ')"/>'; }
  function card(x, y, w, rot, rank, suit, red) {
    var h = w * 1.4, col = red ? "#e11d48" : "#141a2b", id = U("cd"), fs = w * 0.24, r = w * 0.09;
    var corner = '<text x="' + (-w / 2 + w * 0.1) + '" y="' + (-h / 2 + w * 0.27) + '" font-size="' + fs + '" font-weight="900" fill="' + col + '" style="font-family:Arial Black,Arial,sans-serif" letter-spacing="-1">' + rank + "</text>" + suitAt(suit, -w / 2 + w * 0.17, -h / 2 + w * 0.41, w * 0.15, col);
    return '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ')">' +
      "<defs>" + lin(id, [[0, "#ffffff"], [1, "#e9eef7"]]) + "</defs>" +
      '<rect x="' + (-w / 2 + 5) + '" y="' + (-h / 2 + 9) + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="#000" opacity=".28"/>' +
      '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="url(#' + id + ')"/>' +
      '<rect x="' + (-w / 2 + w * 0.05) + '" y="' + (-h / 2 + w * 0.05) + '" width="' + (w * 0.9) + '" height="' + (h - w * 0.1) + '" rx="' + (r * 0.7) + '" fill="none" stroke="' + col + '" stroke-opacity=".12" stroke-width="1.5"/>' +
      corner + suitAt(suit, 0, w * 0.1, w * 0.5, col) + '<g transform="rotate(180)">' + corner + "</g></g>";
  }

  function chip(cx, cy, r, color, n) {
    var out = "", ry = r * 0.42, th = r * 0.2;
    for (var i = 0; i < (n || 1); i++) {
      var y = cy - i * th, top = i === (n || 1) - 1;
      out += '<path d="M' + (cx - r) + " " + y + " v" + th + " a" + r + " " + ry + " 0 0 0 " + (2 * r) + " 0 v" + (-th) + 'Z" fill="' + color + '"/>' +
        '<path d="M' + (cx - r) + " " + y + " v" + th + " a" + r + " " + ry + " 0 0 0 " + (2 * r) + " 0 v" + (-th) + 'Z" fill="#000" opacity=".32"/>' +
        '<path d="M' + (cx - r) + " " + (y + th / 2) + " a" + r + " " + ry + " 0 0 0 " + (2 * r) + ' 0" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="' + th * 0.5 + '" stroke-dasharray="' + r * 0.22 + " " + r * 0.3 + '"/>';
      if (i === 0) out = '<ellipse cx="' + cx + '" cy="' + (cy + th + ry * 0.2) + '" rx="' + r * 1.05 + '" ry="' + ry * 1.05 + '" fill="#000" opacity=".28"/>' + out;
      if (top) out += '<ellipse cx="' + cx + '" cy="' + y + '" rx="' + r + '" ry="' + ry + '" fill="' + color + '"/>' +
        '<ellipse cx="' + cx + '" cy="' + y + '" rx="' + r * 0.9 + '" ry="' + ry * 0.9 + '" fill="none" stroke="#fff" stroke-width="' + r * 0.16 + '" stroke-dasharray="' + r * 0.26 + " " + r * 0.36 + '"/>' +
        '<ellipse cx="' + cx + '" cy="' + y + '" rx="' + r * 0.6 + '" ry="' + ry * 0.6 + '" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/>' +
        '<text x="' + cx + '" y="' + (y + r * 0.08) + '" text-anchor="middle" font-size="' + r * 0.42 + '" font-weight="900" fill="#fff" transform="translate(0 ' + (y * 0.58) + ') scale(1 .42)" style="font-family:Arial Black,Arial">RD</text>';
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

  /* Ícones dos cards de recompensa (VIP): rakeback, diário, semanal, mensal, recarga */
  function giftBox(c1, c2, rib) {
    var g = U("rb"), l = U("rl");
    return "<defs>" + lin(g, [[0, c1], [1, c2]], 0, 0, 1, 1) + lin(l, [[0, c1], [1, c2]]) + "</defs>" +
      '<ellipse cx="50" cy="88" rx="30" ry="5" fill="#000" opacity=".3"/>' +
      '<rect x="24" y="46" width="52" height="38" rx="5" fill="url(#' + g + ')"/><rect x="20" y="34" width="60" height="15" rx="5" fill="url(#' + l + ')"/>' +
      '<rect x="45" y="34" width="10" height="50" fill="' + rib + '"/><rect x="24" y="49" width="52" height="3" fill="#000" opacity=".18"/>' +
      '<path d="M50 34 c-10 -16 -27 -14 -23 -4 c3 6 16 4 23 4z" fill="' + rib + '"/><path d="M50 34 c10 -16 27 -14 23 -4 c-3 6 -16 4 -23 4z" fill="' + rib + '" opacity=".85"/><circle cx="50" cy="33" r="4.5" fill="' + rib + '"/>' +
      '<rect x="29" y="54" width="4" height="24" rx="2" fill="#fff" opacity=".25"/>';
  }
  function rewardIcon(kind, size) {
    size = size || 56; var body = "";
    if (kind === "rakeback") body = coinFront(50, 52, 32, "") + '<path d="M54 30 L38 56 h11 l-5 20 l18 -28 h-11 z" fill="#fff5c2" stroke="#b46f00" stroke-width="2" stroke-linejoin="round"/>' + spark(82, 22, 7) + spark(18, 76, 5);
    else if (kind === "daily") body = giftBox("#ff5c7a", "#b0102e", "#ffd23f") + spark(84, 24, 7) + spark(16, 40, 5);
    else if (kind === "weekly") body = giftBox("#ffd86b", "#d68a00", "#ff2e55") + coinFront(80, 72, 10, "") + spark(16, 30, 6);
    else if (kind === "monthly") body = giftBox("#b07cff", "#5b21b6", "#ffd23f") + spark(82, 20, 8) + spark(16, 26, 6) + spark(86, 60, 5);
    else if (kind === "reload") body = giftBox("#3ff0a6", "#0b8a57", "#fff") + '<path d="M78 24 a18 18 0 1 1 -14 -8" fill="none" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/><path d="M60 10 l8 7 l-9 5z" fill="#ffd23f"/>';
    return '<svg class="rw-ic" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">' + body + "</svg>";
  }

  /* Moeda do Coinflip. Cara: moeda dourada com RD em relevo.
     Coroa: moeda prateada com a joia RD. viewBox -110 -110 220 220 */
  function coinBuild(gold) {
    var P = gold ? { hi: "#fff4c4", mid: "#f2c040", lo: "#a8700a", deep: "#6e4504", ink: "#7a4d05", rimA: "#ffe7a0", rimB: "#c48a12", rimC: "#7a4e06" }
                 : { hi: "#ffffff", mid: "#cfd6e0", lo: "#8a95a6", deep: "#4a5363", ink: "#465060", rimA: "#f4f7fb", rimB: "#a7b1c0", rimC: "#5c6676" };
    var ticks = ""; for (var i = 0; i < 120; i++) { var a = i * Math.PI / 60, c = Math.cos(a), s = Math.sin(a); ticks += "M" + (c * 93).toFixed(1) + " " + (s * 93).toFixed(1) + "L" + (c * 99).toFixed(1) + " " + (s * 99).toFixed(1); }
    var label = gold ? "RDCASINO • PROVABLY FAIR • HEADS •" : "RDCASINO • PROVABLY FAIR • TAILS •";
    var emblem = gold
      ? '<text y="21" text-anchor="middle" font-size="56" font-weight="900" fill="#fff6d6" opacity=".7" transform="translate(-1.5 -2)" style="font-family:var(--font-display,Arial)">RD</text>' +
        '<text y="21" text-anchor="middle" font-size="56" font-weight="900" fill="url(#emb)" style="font-family:var(--font-display,Arial)">RD</text>'
      : '<g transform="translate(0 3)"><path d="M0 -40 L32 -11 L0 38 L-32 -11Z" fill="#000" opacity=".22" transform="translate(2 4)"/><path d="M0 -40 L32 -11 L0 38 L-32 -11Z" fill="url(#emb)"/>' +
        '<path d="M-32 -11 H32 M0 -40 L-11 -11 L0 38 L11 -11Z" fill="none" stroke="#7a0a22" stroke-opacity=".55" stroke-width="1.6" stroke-linejoin="round"/><path d="M0 -40 L-11 -11 H-32Z" fill="#fff" opacity=".45"/><path d="M0 -40 L11 -11 H32Z" fill="#fff" opacity=".15"/></g>';
    var embG = gold ? '<stop offset="0" stop-color="#d89a1c"/><stop offset="1" stop-color="#8a5806"/>' : '<stop offset="0" stop-color="#ff6b88"/><stop offset=".55" stop-color="#ff2e55"/><stop offset="1" stop-color="#a30d2c"/>';
    return '<defs><radialGradient id="cg" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="' + P.hi + '"/><stop offset=".5" stop-color="' + P.mid + '"/><stop offset="1" stop-color="' + P.lo + '"/></radialGradient>' +
      '<linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + P.rimA + '"/><stop offset=".5" stop-color="' + P.rimB + '"/><stop offset="1" stop-color="' + P.rimC + '"/></linearGradient>' +
      '<linearGradient id="emb" x1="0" y1="0" x2="0" y2="1">' + embG + "</linearGradient>" +
      '<radialGradient id="gl" cx=".3" cy=".22" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<path id="tp" d="M-71 0a71 71 0 1 1 142 0a71 71 0 1 1 -142 0"/></defs>' +
      '<circle r="100" fill="url(#rim)"/><path d="' + ticks + '" stroke="' + P.rimC + '" stroke-opacity=".55" stroke-width="1.6"/>' +
      '<circle r="91" fill="' + P.rimC + '" opacity=".35"/><circle r="89" fill="url(#cg)"/>' +
      '<circle r="82" fill="none" stroke="' + P.ink + '" stroke-opacity=".35" stroke-width="1.4"/><circle r="60" fill="none" stroke="' + P.ink + '" stroke-opacity=".35" stroke-width="1.4"/>' +
      '<text font-size="11.5" font-weight="800" letter-spacing="2.2" fill="' + P.ink + '" opacity=".75" style="font-family:var(--font-display,Arial)"><textPath href="#tp" startOffset="0">' + label + "</textPath></text>" +
      emblem + '<circle r="89" fill="url(#gl)"/>';
  }
  var HEADS = coinBuild(true), TAILS = coinBuild(false);
  function uniq(svg, ids) { var k = U("cf"); ids.forEach(function (id) { svg = svg.split('id="' + id + '"').join('id="' + id + k + '"').split("url(#" + id + ")").join("url(#" + id + k + ")").split('href="#' + id + '"').join('href="#' + id + k + '"'); }); return svg; }
  function coinSide(side) { return uniq(side === "tails" ? TAILS : HEADS, ["cg", "rim", "emb", "gl", "tp"]); }

  /* Selo de nível VIP: quadrado arredondado na cor da família, com a joia RD no centro */
  function tierBadge(t, size) {
    size = size || 40;
    var f = t && RD.vipFamilies ? RD.vipFamilies[t.family] : null, c1 = f ? f.c1 : "#4a3a44", c2 = f ? f.c2 : "#241a20", g = U("tb"), h = U("th");
    var sub = t && /\d$/.test(t.name) ? t.name.slice(-1) : "";
    return '<svg class="tier-badge" width="' + size + '" height="' + size + '" viewBox="0 0 40 40" aria-hidden="true"><defs>' + lin(g, [[0, c1], [1, c2]], 0, 0, 1, 1) + lin(h, [[0, "#fff", 0.55], [1, "#fff", 0]]) + "</defs>" +
      '<rect x="1" y="1" width="38" height="38" rx="11" fill="url(#' + g + ')"/><rect x="1" y="1" width="38" height="38" rx="11" fill="none" stroke="#fff" stroke-opacity=".35"/>' +
      '<path d="M4 12 Q4 3 13 3 H27 Q36 3 36 12 V16 Q20 10 4 18Z" fill="url(#' + h + ')"/>' +
      (f ? '<path d="M20 9 L29 16 L20 31 L11 16Z" fill="#fff" fill-opacity=".92"/><path d="M11 16 H29 M20 9 L16 16 L20 31 L24 16 Z" fill="none" stroke="' + c2 + '" stroke-opacity=".55" stroke-width="1.1" stroke-linejoin="round"/>' : '<path d="M20 11 L27 17 L20 29 L13 17Z" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linejoin="round"/>') +
      (sub ? '<circle cx="31.5" cy="31.5" r="7" fill="#0e090d" stroke="' + c1 + '" stroke-width="1.5"/><text x="31.5" y="35" text-anchor="middle" font-size="9.5" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">' + sub + "</text>" : "") + "</svg>";
  }

  /* Tag do dono/equipe: diamante brilhante (no lugar do nível VIP) */
  function ownerBadge(size) {
    size = size || 40; var g = U("ob"), d = U("od"), h = U("oh");
    return '<svg class="tier-badge owner-badge" width="' + size + '" height="' + size + '" viewBox="0 0 40 40" aria-label="Owner"><defs>' + lin(g, [[0, "#1b2a4a"], [1, "#0b0f22"]], 0, 0, 1, 1) + lin(d, [[0, "#e8fbff"], [0.45, "#7de3ff"], [1, "#b48bff"]], 0, 0, 1, 1) + lin(h, [[0, "#fff", 0.5], [1, "#fff", 0]]) + "</defs>" +
      '<rect x="1" y="1" width="38" height="38" rx="11" fill="url(#' + g + ')"/><rect x="1" y="1" width="38" height="38" rx="11" fill="none" stroke="#7de3ff" stroke-opacity=".75"/>' +
      '<path d="M4 12 Q4 3 13 3 H27 Q36 3 36 12 V16 Q20 10 4 18Z" fill="url(#' + h + ')"/>' +
      '<path d="M20 31 L8 16 L13 9 H27 L32 16 Z" fill="url(#' + d + ')"/><path d="M8 16 H32 M13 9 L17 16 L20 31 L23 16 L27 9 M17 16 L20 9 L23 16" fill="none" stroke="#2a3f73" stroke-opacity=".55" stroke-width="1" stroke-linejoin="round"/>' +
      '<path d="M33 5 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z" fill="#fff"/></svg>';
  }

  /* Mascote do Chicken: galinha com boné e lenço RD (viewBox 0 0 48 48) */

  /* Pedra, papel e tesoura como objetos (ícones lisos, uma cor + recortes): limpos e iguais em qualquer aparelho */
  function rpsHand(k) {
    var cut = "var(--rps-cut, #111e35)", body;
    if (k === "paper") body = '<path d="M27 12 H61 L77 28 V88 H27 Z" fill="currentColor"/><path d="M61 12 V28 H77" fill="none" stroke="' + cut + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M36 44 H68 M36 54 H68 M36 64 H68 M36 74 H56" stroke="' + cut + '" stroke-width="4" stroke-linecap="round"/>';
    else if (k === "scissors") body = '<g stroke="currentColor" stroke-linecap="round"><path d="M41 64 L66 11 M59 64 L34 11" stroke-width="9"/><circle cx="33" cy="78" r="11" fill="none" stroke-width="7"/><circle cx="67" cy="78" r="11" fill="none" stroke-width="7"/><path d="M41 64 L37 70 M59 64 L63 70" stroke-width="7"/></g><circle cx="50" cy="45" r="4.5" fill="' + cut + '"/>';
    else body = '<path d="M17 62 L25 33 L47 18 L73 24 L86 47 L80 74 L53 86 L27 81 Z" fill="currentColor"/>' +
      '<path d="M25 33 L45 47 L47 18 M45 47 L73 24 M45 47 L86 47 M45 47 L53 86 M45 47 L17 62" fill="none" stroke="' + cut + '" stroke-width="3" stroke-linejoin="round" stroke-opacity=".55"/>' +
      '<path d="M45 47 L86 47 L80 74 L53 86 Z" fill="#000" opacity=".14"/><path d="M25 33 L47 18 L45 47 Z" fill="#fff" opacity=".25"/>';
    return '<svg viewBox="0 0 100 100" class="rps-svg" aria-hidden="true">' + body + "</svg>";
  }
  /* Pedra, papel e tesoura ilustrados (com volume e luz), para o jogo e a capa. viewBox 0 0 120 120 */
  function rpsArt(k) {
    var a = U("ra"), b = U("rb"), c = U("rc"), body;
    if (k === "paper") body = "<defs>" + lin(a, [[0, "#ffffff"], [1, "#d6dfee"]], 0, 0, 0, 1) + '</defs><g transform="translate(60 60) rotate(-8)"><path d="M-36 -46 H22 L40 -28 V48 H-36 Z" fill="#000" opacity=".25" transform="translate(4 6)"/>' +
      '<path d="M-36 -46 H22 L40 -28 V48 H-36 Z" fill="url(#' + a + ')"/><path d="M22 -46 V-28 H40 Z" fill="#b9c5da"/><path d="M-25 -24 H24 M-25 -12 H28 M-25 0 H28 M-25 12 H28 M-25 24 H28 M-25 36 H8" stroke="#aebcd3" stroke-width="3.4" stroke-linecap="round"/></g>';
    else if (k === "scissors") body = "<defs>" + lin(a, [[0, "#ffffff"], [0.5, "#c3cbd8"], [1, "#7f8a9c"]], 0, 0, 1, 1) + lin(b, [[0, "#4ea8ff"], [1, "#1f5fd6"]], 0, 0, 1, 1) + '</defs><g transform="translate(60 66) rotate(-18)">' +
      '<path d="M-5 3 L-26 -62 Q-20 -68 -15 -62 L6 -3 Z" fill="url(#' + a + ')"/><path d="M5 3 L26 -62 Q20 -68 15 -62 L-6 -3 Z" fill="url(#' + a + ')"/>' +
      '<path d="M-5 2 L-13 18 M5 2 L13 18" stroke="url(#' + b + ')" stroke-width="8" stroke-linecap="round"/><ellipse cx="-17" cy="32" rx="12" ry="15" fill="none" stroke="url(#' + b + ')" stroke-width="7.5"/><ellipse cx="17" cy="32" rx="12" ry="15" fill="none" stroke="url(#' + b + ')" stroke-width="7.5"/>' +
      '<circle r="5.5" fill="#e6eaf1" stroke="#7d8798" stroke-width="1.6"/><circle r="1.8" fill="#7d8798"/></g>';
    else body = "<defs>" + rad(a, [[0, "#d3d8e2"], [0.6, "#8f97a6"], [1, "#565d6b"]], 0.35, 0.3, 0.85) + '</defs><g transform="translate(60 64)"><ellipse cx="2" cy="36" rx="44" ry="7" fill="#000" opacity=".28"/>' +
      '<path d="M-44 16 L-34 -18 L-8 -36 L22 -31 L44 -8 L41 20 L14 34 L-22 33 Z" fill="url(#' + a + ')"/><path d="M-8 -36 L-5 -4 L22 -31 Z" fill="#fff" opacity=".25"/><path d="M-34 -18 L-5 -4 L-8 -36 Z" fill="#fff" opacity=".12"/>' +
      '<path d="M-5 -4 L44 -8 L41 20 L14 34 Z" fill="#000" opacity=".2"/><path d="M-5 -4 L14 34 L-22 33 L-44 16 Z" fill="#000" opacity=".1"/><path d="M6 8 l8 6 -3 7" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.8" stroke-linecap="round"/></g>';
    return '<svg viewBox="0 0 120 120" class="rps-art" aria-hidden="true">' + body + "</svg>";
  }
  function hen() { return '<ellipse cx="24" cy="44.5" rx="11" ry="2.3" fill="#000" opacity=".3"/> <path d="M19.5 38v5.5M27.5 38v5.5M17.3 43.6h4.4M25.3 43.6h4.4" stroke="#ff9d1a" stroke-width="2.2" stroke-linecap="round"/> <ellipse cx="24" cy="30" rx="12.5" ry="10.8" fill="#fff"/> <path d="M11.8 29.5c-3.4-1.2-5.6 1.2-5.2 4.4 3.2.2 5.4-1 6.6-2.4z" fill="#e8edf7"/> <path d="M16.5 30.5c3 4.2 9.6 4.4 12.6 1" stroke="#dfe6f5" stroke-width="2" fill="none" stroke-linecap="round"/> <circle cx="27" cy="16.5" r="8.2" fill="#fff"/> <path d="M34.6 17.8l5.2 1.7-5.2 1.6z" fill="#ffb020"/> <circle cx="30.2" cy="17.4" r="1.6" fill="#1a1205"/><circle cx="30.7" cy="16.9" r=".5" fill="#fff"/>  <path d="M19.4 21.6c4.6 2.6 10 2.6 14.6-.3l.4 3.1c-5 3-10.6 3-15.4.3z" fill="#ff2e55"/> <path d="M22 23.6l3.6 6.2 3.4-6.4z" fill="#ff2e55"/> <path d="M22.6 24.4l3 4.8 2.8-5" fill="none" stroke="#c2133a" stroke-width=".6"/> <circle cx="23.4" cy="22.9" r=".45" fill="#fff" opacity=".8"/><circle cx="28.6" cy="23.4" r=".45" fill="#fff" opacity=".8"/><circle cx="32" cy="22.4" r=".45" fill="#fff" opacity=".8"/><circle cx="25.6" cy="26.2" r=".4" fill="#fff" opacity=".8"/> <path d="M19.6 22.4l-3.6 2.6 2.4 1.6z M19.8 23.6l-2 4.2 2.8-1z" fill="#c2133a"/>  <path d="M18.9 15.2c-.2-5.6 3.6-8.4 8.1-8.4s8.3 2.8 8.1 8.2z" fill="#ff2e55"/> <path d="M18.9 15.2h16.2" stroke="#c2133a" stroke-width="1.2"/> <path d="M33.6 14.4h7.2c1.4 0 1.4 2.2 0 2.2h-7.4z" fill="#c2133a"/> <circle cx="27" cy="6.9" r="1" fill="#c2133a"/> <path d="M21.5 9.5c1.6-1.6 3.4-2.1 5.5-2.1" stroke="#ff8fa3" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/> <text x="27.4" y="13.6" text-anchor="middle" font-size="5" font-weight="900" fill="#ffc85c" style="font-family:var(--font-display,Arial)" letter-spacing="-.2">RD</text>'; }

  function frog() {
    return '<ellipse cx="60" cy="108" rx="34" ry="6" fill="#000" opacity=".25"/>' +
      '<path d="M24 96 Q14 104 30 106 L46 104 Z M96 96 Q106 104 90 106 L74 104 Z" fill="#3fae3a"/>' +
      '<ellipse cx="60" cy="82" rx="32" ry="24" fill="#4cc44a"/><ellipse cx="62" cy="88" rx="20" ry="14" fill="#c9f2a0"/>' +
      '<path d="M40 74 Q60 92 82 74" stroke="#f6c945" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="61" cy="85" r="6" fill="#f6c945" stroke="#c9961c" stroke-width="1.5"/><text x="61" y="87.6" text-anchor="middle" font-size="6.5" font-weight="900" fill="#7a5600" style="font-family:Arial">RD</text>' +
      '<ellipse cx="60" cy="54" rx="34" ry="26" fill="#55d052"/>' +
      '<circle cx="44" cy="38" r="12" fill="#55d052"/><circle cx="76" cy="38" r="12" fill="#55d052"/>' +
      '<rect x="31" y="34" width="26" height="14" rx="6" fill="#10131c"/><rect x="63" y="34" width="26" height="14" rx="6" fill="#10131c"/><rect x="55" y="38" width="10" height="3" rx="1.5" fill="#10131c"/>' +
      '<path d="M35 37 L44 37" stroke="#7ad7ff" stroke-width="2" stroke-linecap="round" opacity=".8"/><path d="M67 37 L76 37" stroke="#7ad7ff" stroke-width="2" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M46 64 Q62 72 76 62" stroke="#1f6b1d" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M28 30 Q30 8 60 8 Q90 8 92 30 Q60 22 28 30 Z" fill="#1f6fff"/><path d="M28 30 Q60 22 92 30 L92 33 Q60 25 28 33 Z" fill="#0d3fb0"/>' +
      '<path d="M30 28 Q14 30 6 38 Q20 38 32 33 Z" fill="#0d3fb0"/>' +
      '<text x="62" y="25" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" style="font-family:Arial Black,Arial">RD</text>';
  }
  function chick() {
    return '<ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity=".3"/>' +
      '<path d="M50 96 v14 M66 96 v14 M44 110 h12 M60 110 h12" stroke="#ff9d1a" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M22 66 Q14 40 40 34 Q48 18 68 22 Q92 26 94 52 Q100 84 74 98 Q48 106 32 92 Q20 82 22 66Z" fill="#fff"/>' +
      '<path d="M30 70 Q40 84 56 78 Q46 66 30 70Z" fill="#e6ecf5"/>' +
      '<path d="M58 14 q4 -10 10 -4 q4 -8 10 0 q6 -4 6 6 q-2 6 -10 6 h-12z" fill="#ff2e55"/>' +
      '<circle cx="76" cy="40" r="4.5" fill="#111827"/><circle cx="77.5" cy="38.5" r="1.5" fill="#fff"/>' +
      '<path d="M90 44 L106 50 L90 56 Z" fill="#ff9d1a"/><path d="M88 58 q4 8 -2 12 q-6 -2 -4 -10z" fill="#ff2e55"/>' +
      '<path d="M40 28 Q44 8 66 10 Q86 12 86 30 Q62 22 40 28Z" fill="#1f6fff"/><path d="M40 28 Q62 22 86 30 L86 33 Q62 25 40 31Z" fill="#0d3fb0"/><path d="M42 27 Q28 26 22 33 Q34 34 44 31Z" fill="#0d3fb0"/>' +
      '<text x="66" y="25" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" style="font-family:Arial Black,Arial">RD</text>';
  }

  /* ---------- Capas (300×400) ---------- */
  var COVERS = {
    dice: { a: "#3b6cff", b: "#0b1a4a", draw: function () { return die(118, 168, 64, 5, 2, 3, "#e11d48") + die(196, 222, 50, 6, 1, 4, "#2f6bff") + spark(232, 92, 12) + spark(70, 96, 8, "#fff", 0.6); } },
    limbo: { a: "#ffb020", b: "#7a2e00", draw: function () {
      // campo magnético do jogo: órbitas girando em volta do multiplicador
      var g = U("lg"), out = "";
      for (var i = 0; i < 3; i++) out += '<ellipse cx="150" cy="170" rx="118" ry="44" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3" transform="rotate(' + (i * 60 - 20) + ' 150 170)"/>';
      return "<defs>" + rad(g, [[0, "#fff6c9", 0.95], [0.4, "#ffd23f", 0.5], [1, "#ff8a00", 0]]) + "</defs>" +
        '<circle cx="150" cy="170" r="120" fill="url(#' + g + ')"/>' + out +
        '<circle cx="150" cy="170" r="140" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 9"/>' +
        '<circle cx="262" cy="150" r="8" fill="#fff"/><circle cx="66" cy="232" r="6" fill="#fff"/><circle cx="196" cy="58" r="5" fill="#fff"/>' +
        '<text x="150" y="190" text-anchor="middle" font-size="58" font-weight="900" fill="#7a2e00" opacity=".35" style="font-family:var(--font-display,Arial)" transform="translate(3 4)">100×</text>' +
        '<text x="150" y="190" text-anchor="middle" font-size="58" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">100×</text>' + spark(56, 80, 12) + spark(250, 262, 9);
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
      var out = "", ball = U("pb"), tr = U("pt");
      for (var i = 0; i < 6; i++) for (var j = 0; j < i + 3; j++) out += '<circle cx="' + (150 + (j - (i + 2) / 2) * 32) + '" cy="' + (88 + i * 30) + '" r="5" fill="#fff" opacity=".95"/>';
      var cols = ["#ff2e55", "#ff6a2e", "#ffa21a", "#ffd23f", "#ffa21a", "#ff6a2e", "#ff2e55"], lab = ["9×", "2×", "1×", ".5", "1×", "2×", "9×"];
      cols.forEach(function (c, k) { out += '<rect x="' + (150 + (k - 3) * 32 - 14) + '" y="262" width="28" height="22" rx="6" fill="' + c + '"/><text x="' + (150 + (k - 3) * 32) + '" y="277.5" text-anchor="middle" font-size="9.5" font-weight="900" fill="#3a0716" style="font-family:Arial">' + lab[k] + "</text>"; });
      return "<defs>" + rad(ball, [[0, "#ffffff"], [0.55, "#ffd6ec"], [1, "#ff4fa0"]], 0.35, 0.3, 0.75) + lin(tr, [[0, "#ffffff", 0], [1, "#ffffff", 0.55]]) + "</defs>" + out +
        '<path d="M150 64 C 140 92 162 120 150 150 C 140 176 172 196 178 214" stroke="url(#' + tr + ')" stroke-width="12" fill="none" stroke-linecap="round"/>' +
        '<circle cx="178" cy="214" r="28" fill="#ff4fa0" opacity=".35"/><circle cx="178" cy="214" r="19" fill="url(#' + ball + ')"/><circle cx="171" cy="207" r="5.5" fill="#fff" opacity=".9"/>' + spark(250, 80, 10) + spark(56, 120, 8);
    } },
    hilo: { a: "#14c8e6", b: "#053344", draw: function () {
      return card(112, 182, 108, -12, "A", "♠", false) + card(190, 172, 108, 10, "K", "♥", true) +
        '<circle cx="244" cy="86" r="24" fill="#16a34a"/><path d="M244 74 l12 14 h-8 v12 h-8 v-12 h-8z" fill="#fff"/>' +
        '<circle cx="58" cy="270" r="24" fill="#e11d48"/><path d="M58 282 l12 -14 h-8 v-12 h-8 v12 h-8z" fill="#fff"/>';
    } },
    blackjack: { a: "#22b35e", b: "#063a1c", draw: function () {
      var g = U("bj");
      return "<defs>" + lin(g, [[0, "#fff1b8"], [0.5, "#ffd23f"], [1, "#d98a00"]]) + "</defs>" +
        card(118, 164, 104, -10, "A", "♠", false) + card(188, 158, 104, 9, "K", "♥", true) + chip(236, 262, 28, "#e11d48", 4) + chip(70, 272, 24, "#1d4ed8", 3) +
        '<g transform="translate(150 54)"><rect x="-44" y="-22" width="88" height="44" rx="22" fill="#062a16" stroke="url(#' + g + ')" stroke-width="3"/><text x="0" y="12" text-anchor="middle" font-size="30" font-weight="900" fill="url(#' + g + ')" style="font-family:var(--font-display,Arial)">21</text></g>';
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
      // roda igual à do jogo: moldura escura com lâmpadas, segmentos coloridos e centro com RD
      var cx = 150, cy = 160, R = 104, r = 72, cols = ["#3a2a35", "#22e08a", "#3a2a35", "#ffc85c", "#3a2a35", "#7aa7ff", "#3a2a35", "#22e08a", "#3a2a35", "#a07bff", "#3a2a35", "#ffc85c"], out = "", bulbs = "", N = 24;
      for (var i = 0; i < N; i++) {
        var a0 = (i / N) * 2 * Math.PI - Math.PI / 2 - Math.PI / N, a1 = a0 + 2 * Math.PI / N, P = function (rr, a) { return (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1); };
        out += '<path d="M' + P(R, a0) + " A" + R + " " + R + " 0 0 1 " + P(R, a1) + " L" + P(r, a1) + " A" + r + " " + r + " 0 0 0 " + P(r, a0) + 'Z" fill="' + cols[i % cols.length] + '" stroke="#140f17" stroke-width="1.4"/>';
        bulbs += '<circle cx="' + (cx + 114 * Math.cos(a0)).toFixed(1) + '" cy="' + (cy + 114 * Math.sin(a0)).toFixed(1) + '" r="3" fill="#ffe9a8" opacity="' + (i % 2 ? 0.5 : 1) + '"/>';
      }
      return '<ellipse cx="150" cy="286" rx="96" ry="12" fill="#000" opacity=".3"/><circle cx="' + cx + '" cy="' + cy + '" r="122" fill="#2a1f30"/><circle cx="' + cx + '" cy="' + cy + '" r="122" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>' + bulbs +
        '<circle cx="' + cx + '" cy="' + cy + '" r="107" fill="#140f17"/>' + out + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#1c1520"/><circle cx="' + cx + '" cy="' + cy + '" r="54" fill="#2a1f30" stroke="#fff" stroke-opacity=".15" stroke-width="2"/>' +
        '<text x="' + cx + '" y="' + (cy + 9) + '" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">RD</text>' +
        '<g transform="translate(150 30)"><path d="M0 34 C-6 24 -13 17 -13 9 A13 13 0 0 1 13 9 C13 17 6 24 0 34Z" fill="#ff2e55"/><circle cy="9" r="4.5" fill="#fff"/></g>' + spark(262, 60, 11) + spark(40, 252, 9);
    } },
    tower: { a: "#12c48b", b: "#04291f", draw: function () {
      // torre em blocos 3D afunilando até o topo, um caminho de ovos acesos e o ovo dourado brilhando lá em cima
      var out = "", eg = U("te"), gw = U("tw"), rows = [[4, 256], [4, 218], [3, 180], [3, 142], [2, 104]], lit = [1, 2, 0, 1, 0];
      rows.forEach(function (r, k) {
        var n = r[0], w = 46, gap = 8, x0 = 150 - (n * w + (n - 1) * gap) / 2;
        for (var i = 0; i < n; i++) {
          var x = x0 + i * (w + gap), y = r[1] - 22, on = lit[k] === i, skull = k === 1 && i === 3;
          out += '<rect x="' + x + '" y="' + (y + 6) + '" width="' + w + '" height="26" rx="7" fill="#02160f" opacity=".55"/>' +
            '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="24" rx="7" fill="' + (on ? "#ffe08a" : skull ? "#ff7a59" : "#0f5a42") + '"/>' +
            '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="' + (w - 6) + '" height="8" rx="4" fill="#fff" opacity="' + (on ? 0.55 : 0.12) + '"/>';
          if (on) out += '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + 13) + '" rx="6" ry="7.5" fill="#f2a100"/>';
          if (skull) out += '<circle cx="' + (x + w / 2 - 5) + '" cy="' + (y + 12) + '" r="2.6" fill="#3a0f08"/><circle cx="' + (x + w / 2 + 5) + '" cy="' + (y + 12) + '" r="2.6" fill="#3a0f08"/>';
        }
      });
      return "<defs>" + rad(eg, [[0, "#fff8d6"], [0.45, "#ffd23f"], [1, "#d98a00"]], 0.38, 0.3, 0.75) + rad(gw, [[0, "#ffe27a", 0.75], [1, "#ffe27a", 0]]) + "</defs>" +
        '<circle cx="150" cy="48" r="64" fill="url(#' + gw + ')"/>' + out +
        '<ellipse cx="150" cy="46" rx="24" ry="30" fill="url(#' + eg + ')"/><ellipse cx="141" cy="34" rx="7" ry="10" fill="#fff" opacity=".65"/>' +
        '<path d="M133 54 q8.5 6 17 0 t17 0" stroke="#c97800" stroke-width="2.5" fill="none" opacity=".7"/>' + spark(214, 44, 12) + spark(80, 78, 9) + spark(236, 120, 7);
    } },
    chicken: { a: "#ffc23a", b: "#8a3300", draw: function () {
      // estrada vista de cima: tampas de bueiro com multiplicador, carro vindo e a galinha de boné RD
      var out = '<rect x="40" y="0" width="220" height="300" fill="#2a2230"/>';
      [100, 160, 220].forEach(function (x) { out += '<path d="M' + x + ' 0 V300" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-dasharray="18 14"/>'; });
      out += '<rect x="40" y="0" width="6" height="300" fill="#ffd23f"/><rect x="254" y="0" width="6" height="300" fill="#ffd23f"/>';
      var cover = function (x, y, m, on) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="26" ry="26" fill="' + (on ? "#ffd23f" : "#4a4458") + '"/><ellipse cx="' + x + '" cy="' + y + '" rx="20" ry="20" fill="none" stroke="' + (on ? "#b46f00" : "#3a3446") + '" stroke-width="3"/><text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-size="13" font-weight="900" fill="' + (on ? "#5a3300" : "#cfc8dc") + '" style="font-family:Arial">' + m + "</text>"; };
      out += cover(70, 236, "1.09×", true) + cover(130, 236, "1.51×", false) + cover(190, 236, "2.46×", false);
      out += '<g transform="translate(190 70)"><path d="M-18 40 L-40 140 L40 140 L18 40Z" fill="#fff4c2" opacity=".14"/><rect x="-22" y="-34" width="44" height="74" rx="10" fill="#ff2e55"/><rect x="-16" y="-24" width="32" height="16" rx="4" fill="#2a1a24"/><rect x="-16" y="16" width="32" height="12" rx="4" fill="#2a1a24"/><circle cx="-13" cy="38" r="4" fill="#fff8d6"/><circle cx="13" cy="38" r="4" fill="#fff8d6"/></g>';
      return out + '<g transform="translate(-4 108) scale(1.3)">' + chick() + "</g>" + spark(276, 40, 10, "#fff") + spark(24, 60, 8, "#fff");
    } },
    coinflip: { a: "#ffc23a", b: "#7a4a00", draw: function () {
      // moeda girando no ar (inclinada, com a espessura da borda), moeda de prata atrás e rastro de movimento
      var gl = U("cfg"), side = function (k, sc) { return coinSide(k).replace(/^/, ""); };
      return "<defs>" + rad(gl, [[0, "#fff6c8", 0.8], [1, "#fff6c8", 0]]) + "</defs>" + '<circle cx="150" cy="150" r="120" fill="url(#' + gl + ')"/>' +
        '<g transform="translate(230 82) rotate(20) scale(.36 .3)"><ellipse cx="0" cy="16" rx="100" ry="100" fill="#5c6676"/>' + coinSide("tails") + "</g>" +
        '<path d="M60 240 q-30 -60 10 -130 M78 250 q-22 -50 8 -112" stroke="#fff" stroke-opacity=".45" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="150" cy="282" rx="80" ry="12" fill="#000" opacity=".28"/>' +
        '<g transform="translate(150 168) rotate(-14) scale(.92 .78)"><ellipse cx="0" cy="18" rx="100" ry="100" fill="#7a4e06"/><ellipse cx="0" cy="11" rx="100" ry="100" fill="#a8700a"/>' + coinSide("heads") + "</g>" + spark(68, 72, 12) + spark(246, 220, 10) + spark(104, 40, 7);
    } },
    rps: { a: "#7c5cff", b: "#1d0f4a", draw: function () {
      // batalha de luvas (estilo ilustração de jogo): soco à esquerda contra tesoura à direita, impacto no meio
      var gw = U("gw"), sh = U("gs"), bz = U("bz"), O = "#1b2540", SW = 3.6;
      var R = function (x, y, w, h, extra) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + Math.min(w, h) / 2 + '" fill="url(#' + sh + ')" stroke="' + O + '" stroke-width="' + SW + '"' + (extra || "") + "/>"; };
      var fist = function (cuff) {
        return '<rect x="-78" y="-27" width="30" height="54" rx="9" fill="' + cuff + '" stroke="' + O + '" stroke-width="' + SW + '"/><path d="M-72 -18 v36 M-63 -18 v36" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>' +
          R(-52, -36, 72, 72) + R(10, -34, 32, 17) + R(12, -16, 32, 17) + R(12, 2, 32, 17) + R(8, 20, 30, 16) +
          R(-34, 8, 50, 19, ' transform="rotate(-8 -9 17)"') + '<path d="M-40 -22 q10 -6 22 -2 M-42 -8 q12 -5 24 -1" fill="none" stroke="' + O + '" stroke-opacity=".35" stroke-width="2.4" stroke-linecap="round"/>';
      };
      var scissors = function (cuff) {
        return '<rect x="-78" y="-27" width="30" height="54" rx="9" fill="' + cuff + '" stroke="' + O + '" stroke-width="' + SW + '"/><path d="M-72 -18 v36 M-63 -18 v36" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>' +
          R(0, -40, 74, 18, ' transform="rotate(-16 0 -31)"') + R(0, -18, 78, 18, ' transform="rotate(10 0 -9)"') +
          R(-52, -32, 66, 66) + R(6, 4, 28, 16) + R(4, 20, 26, 15) + R(-36, 10, 46, 18, ' transform="rotate(-6 -13 19)"');
      };
      var burst = ""; for (var i = 0; i < 12; i++) { var an = i * Math.PI / 6, r1 = i % 2 ? 22 : 34; burst += (i ? " L" : "M") + (150 + r1 * Math.cos(an)).toFixed(1) + " " + (172 + r1 * Math.sin(an)).toFixed(1); }
      return "<defs>" + rad(gw, [[0, "#c4b5fd", 0.6], [1, "#c4b5fd", 0]]) + lin(sh, [[0, "#ffffff"], [0.62, "#f1f4fa"], [1, "#cfd8e8"]], 0, 0, 0, 1) + lin(bz, [[0, "#fff6c8"], [1, "#ffb020"]], 0, 0, 0, 1) + "</defs>" +
        '<circle cx="150" cy="170" r="128" fill="url(#' + gw + ')"/>' +
        '<g transform="translate(96 196) rotate(-8) scale(.92)">' + fist("#1f8fff") + "</g>" +
        '<g transform="translate(206 150) rotate(172) scale(.92)">' + scissors("#ff3d64") + "</g>" +
        '<g transform="translate(152 98)"><circle r="23" fill="url(#' + bz + ')" stroke="#fff" stroke-width="3"/><text y="7" text-anchor="middle" font-size="18" font-weight="900" fill="#5a2a00" style="font-family:var(--font-display,Arial)">VS</text></g>' +
        '<path d="M150 136 v-6 M150 238 v8 M138 246 l-6 8 M162 246 l6 8" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>' + spark(262, 58, 12) + spark(36, 98, 9) + spark(266, 270, 8);
    } },
    baccarat: { a: "#ff2e55", b: "#4a0716", draw: function () {
      return card(112, 172, 104, -12, "9", "♦", true) + card(190, 166, 104, 10, "K", "♠", false) + chip(238, 282, 28, "#ffd23f", 4) + chip(70, 290, 24, "#1d4ed8", 3) +
        '<rect x="34" y="62" width="74" height="34" rx="17" fill="#fff" fill-opacity=".92"/><text x="71" y="85" text-anchor="middle" font-size="18" font-weight="900" fill="#b0102e" style="font-family:var(--font-display,Arial)">9 : 0</text>';
    } },
    double: { a: "#ff2e55", b: "#2a0710", draw: function () {
      var t = function (x, y, w, fill, stroke, txt, rot, op) { return '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ')" opacity="' + (op || 1) + '"><rect x="' + (-w / 2) + '" y="' + (-w * 0.62) + '" width="' + w + '" height="' + (w * 1.24) + '" rx="' + (w * 0.18) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="5"/>' + txt + "</g>"; };
      var gem = '<path d="M0 -26 L22 -8 L0 26 L-22 -8 Z" fill="#ff2e55"/><path d="M0 -26 L10 -8 L0 26 L-10 -8 Z" fill="#ff7d96"/>';
      return '<path d="M150 58 l-14 -22 h28z" fill="#fff" opacity=".9"/>' + t(58, 186, 70, "#1b1220", "#3a2a3a", "", -10, 0.9) + t(242, 186, 70, "#b0102e", "#ff6b86", "", 10, 0.9) + t(150, 176, 96, "#ffffff", "#ffd6de", gem, 0, 1) + chip(70, 290, 24, "#ffd23f", 4) + chip(232, 292, 26, "#ff2e55", 3) + spark(250, 80, 12) + spark(52, 92, 9);
    } },
    soccer: { a: "#22b35e", b: "#062a16", draw: function () {
      var net = ""; for (var x = 50; x <= 250; x += 20) net += '<path d="M' + x + ' 74 V190" stroke="#fff" stroke-opacity=".18"/>'; for (var y = 84; y <= 190; y += 18) net += '<path d="M44 ' + y + ' H256" stroke="#fff" stroke-opacity=".18"/>';
      return '<rect x="44" y="70" width="212" height="122" fill="#000" opacity=".25"/>' + net + '<path d="M40 194 V66 H260 V194" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>' +
        '<g transform="translate(110 150) rotate(-28)"><rect x="-20" y="-22" width="40" height="40" rx="11" fill="#3b82f6"/><circle cx="0" cy="-36" r="13" fill="#e8b48a"/><path d="M-13 -40 a13 11 0 0 1 26 0 v-1 h8 v4 h-34z" fill="#ff2e55"/><text x="0" y="-42" text-anchor="middle" font-size="7" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">RD</text><path d="M-20 -14 L-44 -40 M20 -14 L40 -44" stroke="#3b82f6" stroke-width="9" stroke-linecap="round"/><circle cx="-46" cy="-43" r="8" fill="#ffd23f"/><circle cx="42" cy="-48" r="8" fill="#ffd23f"/></g>' +
        '<g transform="translate(206 112)"><circle r="24" fill="#fff"/><path d="M0 -9 l9 6 -3 10 h-12 l-3 -10z" fill="#111"/><path d="M0 -24 v15 M9 -3 l14 -4 M6 7 l8 12 M-6 7 l-8 12 M-9 -3 l-14 -4" stroke="#111" stroke-width="3"/></g>' +
        '<path d="M206 140 q-40 70 -70 120" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round" fill="none"/>' + spark(60, 240, 10) + spark(250, 240, 12);
    } },
    lake: { a: "#1fb6ff", b: "#0a3a7a", draw: function () {
      var w = U("lw"), pad = function (x, y, s, m, c) { return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')"><ellipse cx="0" cy="6" rx="46" ry="30" fill="#0b4a8a" opacity=".5"/><path d="M0 0 L44 -8 A44 34 0 1 1 16 -32 Z" fill="#3fbf4a" stroke="#2a9a38" stroke-width="3"/><path d="M0 0 L-28 -18 M0 0 L-30 12 M0 0 L-6 30 M0 0 L28 24" stroke="#2f9e3a" stroke-width="3" stroke-linecap="round"/>' + (m ? '<text x="0" y="8" text-anchor="middle" font-size="24" font-weight="900" fill="' + c + '" stroke="#0b3a20" stroke-width="5" paint-order="stroke" style="font-family:var(--font-display,Arial)">' + m + "</text>" : "") + "</g>"; };
      var rip = ""; [[60, 70, 30], [240, 120, 40], [90, 250, 34], [230, 250, 26]].forEach(function (r) { rip += '<ellipse cx="' + r[0] + '" cy="' + r[1] + '" rx="' + r[2] + '" ry="' + r[2] * 0.35 + '" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2"/>'; });
      return "<defs>" + rad(w, [[0, "#7fe0ff", 0.5], [1, "#7fe0ff", 0]]) + "</defs>" + rip + '<circle cx="150" cy="190" r="120" fill="url(#' + w + ')"/>' +
        pad(228, 90, 0.95, "1.66×", "#ffb3f0") + pad(232, 206, 0.95, "1.23×", "#ffe0a8") + pad(122, 214, 1.25, "", "") +
        '<g transform="translate(64 112) scale(1.2)">' + frog() + "</g>" + spark(44, 66, 10, "#fff") + spark(278, 160, 8, "#fff");
    } },
    pump: { a: "#33d14a", b: "#0b3d1a", draw: function () {
      var bal = function (x, y, s, rot) { var g = U("pg"); return "<defs>" + rad(g, [[0, "#d6ffb0"], [0.45, "#4ee05a"], [1, "#0c7a24"]], 0.35, 0.3, 0.8) + "</defs>" + '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ") scale(" + s + ')"><path d="M0 64 C -10 96 10 120 -4 150" stroke="#e9ffe0" stroke-opacity=".7" stroke-width="2.5" fill="none"/><ellipse cx="0" cy="0" rx="52" ry="60" fill="url(#' + g + ')"/><path d="M-7 58 L7 58 L0 66Z" fill="#0c7a24"/><ellipse cx="-20" cy="-26" rx="11" ry="18" fill="#fff" opacity=".4" transform="rotate(-22 -20 -26)"/></g>'; };
      var bolt = function (x, y, s) { return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#eaff7a"/>'; };
      return '<circle cx="150" cy="160" r="130" fill="#b6ff7a" opacity=".12"/>' + bolt(30, 60, 2.6) + bolt(240, 40, 2) + bolt(250, 220, 1.6) +
        bal(74, 168, 0.85, -16) + bal(226, 158, 0.9, 14) + bal(150, 112, 1.15, 0) +
        '<text x="150" y="124" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" fill-opacity=".92" style="font-family:var(--font-display,Arial)">RD</text>';
    } },
    spill: { a: "#1f8fff", b: "#071a44", draw: function () {
      // copo quase transbordando embaixo da torneira, com gotas e o multiplicador
      var w = U("sw"), m = U("sm"), gl = U("sg"), cp = U("sc");
      var glass = "M92 98 L208 98 L197 268 Q196 276 188 276 L112 276 Q104 276 103 268 Z";
      return "<defs>" + lin(w, [[0, "#9fe2ff"], [1, "#2f9cf0"]], 0, 0, 0, 1) + lin(m, [[0, "#5a6578"], [0.5, "#b4bfd0"], [1, "#4a5466"]], 0, 0, 1, 0) + rad(gl, [[0, "#7dd3fc", 0.55], [1, "#7dd3fc", 0]]) +
        '<clipPath id="' + cp + '"><path d="' + glass + '"/></clipPath></defs>' +
        '<circle cx="150" cy="170" r="130" fill="url(#' + gl + ')"/>' +
        '<rect x="136" y="20" width="28" height="30" fill="url(#' + m + ')"/><rect x="124" y="46" width="52" height="14" rx="5" fill="url(#' + m + ')"/><rect x="140" y="58" width="20" height="12" rx="3" fill="#3c4556"/>' +
        '<rect x="145" y="68" width="10" height="44" rx="5" fill="url(#' + w + ')"/>' +
        '<ellipse cx="150" cy="282" rx="66" ry="9" fill="#000" opacity=".3"/>' +
        '<g clip-path="url(#' + cp + ')"><rect x="80" y="112" width="140" height="180" fill="url(#' + w + ')"/><path d="M80 112 q15 -7 30 0 t30 0 t30 0 t30 0 t30 0 v6 h-150z" fill="#d6f4ff"/></g>' +
        '<path d="' + glass + '" fill="rgba(255,255,255,.08)" stroke="#fff" stroke-opacity=".7" stroke-width="3.5" stroke-linejoin="round"/><path d="M104 112 L113 254" stroke="#fff" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M92 98 q-12 4 -14 26 q-1 14 6 18 q4 -8 3 -20 q-1 -14 9 -22z M208 98 q12 6 13 30 q1 14 -6 18 q-4 -8 -3 -22 q1 -14 -8 -24z" fill="url(#' + w + ')"/>' +
        '<circle cx="74" cy="168" r="5" fill="#9fe2ff"/><circle cx="230" cy="180" r="4" fill="#9fe2ff"/><circle cx="66" cy="196" r="3" fill="#9fe2ff"/>' +
        '<g transform="translate(206 38)"><rect width="70" height="30" rx="15" fill="#22e08a"/><text x="35" y="21" text-anchor="middle" font-size="15" font-weight="900" fill="#05301c" style="font-family:var(--font-display,Arial)">24.5×</text></g>' +
        spark(48, 76, 11) + spark(256, 236, 9);
    } },
    door: { a: "#6a4bd8", b: "#170a3a", draw: function () {
      // três portas vermelhas com número e luz; a do meio aberta mostrando o diamante
      var gl = U("dg");
      var d = function (x, num, open) {
        var frame = '<rect x="' + (x - 6) + '" y="80" width="80" height="176" rx="8" fill="#2a1d14"/><rect x="' + (x - 3) + '" y="83" width="74" height="172" rx="6" fill="#4a3524"/>';
        var lamp = '<rect x="' + (x + 24) + '" y="58" width="20" height="8" rx="4" fill="#ffe0a8"/><circle cx="' + (x + 34) + '" cy="66" r="22" fill="#ffd99a" opacity=".18"/>';
        if (open) return lamp + frame + '<rect x="' + x + '" y="86" width="68" height="166" rx="5" fill="url(#' + gl + ')"/>' +
          '<g transform="translate(' + (x + 34) + ' 170) scale(1.15)"><path d="M-16 -18h32l12 14-28 34L-28 -4z" fill="#ff2e55"/><path d="M-16 -18h32l12 14h-56z" fill="#ff8fa3"/><path d="M-28 -4h56M-16 -18l8 14 8-14 8 14 8-14M-8 -4l8 34 8-34" fill="none" stroke="#9e0b2b" stroke-opacity=".5" stroke-width="1.4"/></g>' +
          '<path d="M' + x + ' 86 L' + (x - 22) + ' 76 V266 L' + x + ' 252 Z" fill="#b3122f"/><path d="M' + x + ' 86 L' + (x - 22) + ' 76 V266 L' + x + ' 252 Z" fill="#000" opacity=".25"/>';
        return lamp + frame + '<rect x="' + x + '" y="86" width="68" height="166" rx="5" fill="#c8183f"/><rect x="' + (x + 10) + '" y="112" width="48" height="50" rx="4" fill="#000" opacity=".15"/><rect x="' + (x + 10) + '" y="172" width="48" height="66" rx="4" fill="#000" opacity=".15"/>' +
          '<rect x="' + (x + 24) + '" y="93" width="20" height="13" rx="3" fill="#f2c040"/><text x="' + (x + 34) + '" y="103.5" text-anchor="middle" font-size="10" font-weight="900" fill="#4a2d00" style="font-family:var(--font-display,Arial)">' + num + "</text>" +
          '<rect x="' + (x + 50) + '" y="166" width="12" height="4" rx="2" fill="#f2c040"/>';
      };
      return "<defs>" + rad(gl, [[0, "#fff3c4"], [0.6, "#ffb020"], [1, "#a85f00"]], 0.5, 0.45, 0.8) + "</defs>" + d(14, 1) + d(204, 3) + d(116, 2, true) + spark(268, 52, 11) + spark(30, 56, 8);
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
    var bg = U("bg"), gl = U("gw"), fd = U("fd"), name = { dice: "DICE", limbo: "LIMBO", crash: "CRASH", mines: "MINES", plinko: "PLINKO", hilo: "HI-LO", blackjack: "BLACKJACK", roulette: "ROULETTE", wheel: "WHEEL", keno: "KENO", tower: "TOWER", chicken: "CHICKEN", coinflip: "COINFLIP", rps: "ROCK PAPER SCISSORS", spill: "SPILL", lake: "CROSS THE LAKE", pump: "PUMP", baccarat: "BACCARAT", double: "DOUBLE", soccer: "SOCCER", door: "DOOR" }[id];
    return '<svg class="art" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + name + '"><defs>' +
      lin(bg, [[0, c.a], [1, c.b]]) + rad(gl, [[0, "#ffffff", 0.35], [1, "#ffffff", 0]]) + lin(fd, [[0, "#000", 0], [1, "#000", 0.55]]) + "</defs>" +
      '<rect width="300" height="400" fill="url(#' + bg + ')"/>' +
      '<g opacity=".08" fill="#fff"><rect x="-60" y="40" width="420" height="22" transform="rotate(-24 150 200)"/><rect x="-60" y="120" width="420" height="8" transform="rotate(-24 150 200)"/><rect x="-60" y="300" width="420" height="40" transform="rotate(-24 150 200)"/></g>' +
      '<circle cx="150" cy="180" r="150" fill="url(#' + gl + ')"/>' + c.draw() +
      '<rect y="270" width="300" height="130" fill="url(#' + fd + ')"/>' +
      (name.indexOf(" ") > -1 ? '<text x="150" y="328" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" letter-spacing="-0.5" style="font-family:var(--font-display,Arial)">' + name.split(" ").slice(0, -1).join(" ") + '</text><text x="150" y="363" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" letter-spacing="-0.5" style="font-family:var(--font-display,Arial)">' + name.split(" ").slice(-1)[0] + "</text>"
        : '<text x="150" y="356" text-anchor="middle" font-size="' + (name.length > 7 ? 34 : 40) + '" font-weight="900" fill="#fff" letter-spacing="-0.5" style="font-family:var(--font-display,Arial)">' + name + "</text>") +
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
    welcome: function (p) { p = p || {}; return scene(p.a || "#1f6fff", p.b || "#071a44", gift(890, 300, 1.75) + coinFront(1080, 170, 58) + coinFront(720, 470, 42) + coin(1070, 470, 52) + spark(760, 140, 22) + spark(1120, 330, 14) + spark(990, 90, 12)); },
    leaderboard: function (p) { p = p || {}; return scene(p.a || "#1d4ed8", p.b || "#0a1640", trophy(900, 300, 1.85) + coinFront(1090, 450, 50, "1") + coinFront(715, 180, 36) + stars(3, 30, 1200, 600, "#ffd23f") + spark(1080, 150, 20) + spark(740, 450, 16)); },
    affiliate: function (p) { p = p || {};
      var id = U("ch");
      return scene(p.a || "#0e7490", p.b || "#06263a", "<defs>" + lin(id, [[0, "#ffffff"], [1, "#b9e9f5"]], 0, 0, 1, 1) + "</defs>" +
        '<g transform="translate(880 300) rotate(-35)"><rect x="-210" y="-58" width="230" height="116" rx="58" fill="none" stroke="url(#' + id + ')" stroke-width="34"/><rect x="-20" y="-58" width="230" height="116" rx="58" fill="none" stroke="#ffd23f" stroke-width="34"/></g>' +
        coinFront(1090, 150, 50) + coinFront(700, 470, 40) + coin(1060, 480, 46) + spark(760, 130, 18) + spark(1140, 330, 12));
    },
    reload: function (p) { p = p || {}; return scene(p.a || "#2563eb", p.b || "#0b1d4f", '<g transform="translate(900 300)"><path d="M-150 -20 A150 150 0 0 1 120 -90" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round"/><path d="M150 20 A150 150 0 0 1 -120 90" fill="none" stroke="#ffd23f" stroke-width="34" stroke-linecap="round"/><path d="M150 -150 l14 92 l-88 -30z" fill="#fff"/><path d="M-150 150 l-14 -92 l88 30z" fill="#ffd23f"/></g>' + coinFront(900, 300, 70) + spark(1110, 120, 18)); },
    rakeback: function (p) { p = p || {}; return scene(p.a || "#4338ca", p.b || "#120f45", coinFront(900, 300, 150, "") + '<path d="M915 180 L840 320 h55 l-25 110 l95 -150 h-58 z" fill="#b46f00"/><path d="M910 170 L835 310 h55 l-25 110 l95 -150 h-58 z" fill="#fff5c2"/>' + spark(1100, 140, 20) + spark(720, 470, 16)); },
    vip: function (p) { p = p || {};
      var crown = '<g transform="translate(900 300)"><path d="M-170 90 L-190 -90 L-90 0 L0 -130 L90 0 L190 -90 L170 90 Z" fill="#ffd23f" stroke="#b46f00" stroke-width="10" stroke-linejoin="round"/><rect x="-175" y="90" width="350" height="46" rx="14" fill="#ffb020" stroke="#b46f00" stroke-width="10"/><circle cx="-190" cy="-96" r="20" fill="#fff5c2"/><circle cx="190" cy="-96" r="20" fill="#fff5c2"/><circle cx="0" cy="-138" r="22" fill="#fff5c2"/><path d="M0 -40 L32 0 L0 52 L-32 0 Z" fill="#ff2e55"/><path d="M0 -40 L14 0 L0 52 L-14 0 Z" fill="#ff7d96"/></g>';
      return scene(p.a || "#1d4ed8", p.b || "#0a1640", crown + coinFront(1100, 470, 46) + coinFront(700, 160, 34) + spark(1110, 140, 20) + spark(720, 470, 14) + stars(5, 24, 1200, 600, "#ffd23f")); },
    rain: function (p) { p = p || {};
      var drops = ""; [[780, 380], [860, 450], [940, 400], [1020, 470], [1100, 410]].forEach(function (d, i) { drops += coinFront(d[0], d[1], 26 - (i % 2) * 4); });
      var cloud = '<g transform="translate(940 230)"><ellipse cx="0" cy="40" rx="250" ry="70" fill="#000" opacity=".18"/><path d="M-200 60 a80 80 0 0 1 30 -150 a130 130 0 0 1 240 -40 a100 100 0 0 1 140 110 a70 70 0 0 1 -30 80 z" fill="#e8f1ff"/><path d="M-200 60 a80 80 0 0 1 30 -150 a130 130 0 0 1 240 -40" fill="none" stroke="#fff" stroke-width="10" opacity=".7"/></g>';
      return scene(p.a || "#2f6bff", p.b || "#0b1d4f", cloud + drops + spark(720, 150, 18) + spark(1140, 160, 14)); },
    codes: function (p) { p = p || {};
      var tk = '<g transform="translate(920 300) rotate(-12)"><path d="M-230 -110 H230 V-36 a36 36 0 0 0 0 72 V110 H-230 V36 a36 36 0 0 0 0 -72 Z" fill="#fff" stroke="#ffd6de" stroke-width="8"/><path d="M-120 -110 V110" stroke="#ff2e55" stroke-width="6" stroke-dasharray="14 12"/><text x="50" y="22" text-anchor="middle" font-size="76" font-weight="900" fill="#ff2e55" style="font-family:var(--font-display,Arial)">CODE</text><text x="-176" y="20" text-anchor="middle" font-size="44" font-weight="900" fill="#ff2e55" style="font-family:var(--font-display,Arial)" transform="rotate(-90 -176 8)">RD</text></g>';
      return scene(p.a || "#1f6fff", p.b || "#071a44", tk + coinFront(1110, 470, 44) + coinFront(700, 150, 32) + spark(1120, 120, 18) + spark(730, 470, 14)); },
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
    cover: cover, ownerBadge: ownerBadge, frog: frog, chick: chick,
    has: function (key) { var k = String(key).split(":"); return k[0] === "cover" ? !!COVERS[k[1]] : k[0] === "scene" ? !!SCENES[k[1]] : false; },
    render: function (key, o) {
      var k = String(key).split(":");
      if (k[0] === "cover" && COVERS[k[1]]) return cover(k[1]);
      if (k[0] === "scene" && SCENES[k[1]]) return SCENES[k[1]](o);
      return generic(o || {});
    },
    hen: hen,
    rpsHand: rpsHand,
    rpsArt: rpsArt,
    tierBadge: tierBadge,
    rewardIcon: rewardIcon,
    coinSide: coinSide,
    games: Object.keys(COVERS)
  };
})();
