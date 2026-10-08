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
  var HEADS = '<defs><radialGradient id="cg" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#f3c547"/><stop offset="1" stop-color="#b47a0c"/></radialGradient><linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#d9a21c"/><stop offset="1" stop-color="#8a5a06"/></linearGradient><linearGradient id="emb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d0"/><stop offset="1" stop-color="#e2ab2e"/></linearGradient></defs>' +
    '<circle r="99" fill="url(#rim)"/><circle r="92" fill="none" stroke="#7a4f05" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="2 3"/><circle r="86" fill="url(#cg)"/><circle r="86" fill="none" stroke="#fff6cf" stroke-opacity=".6" stroke-width="2"/>' +
    '<circle r="66" fill="none" stroke="#b47a0c" stroke-opacity=".55" stroke-width="2.5"/><circle r="62" fill="none" stroke="#fff6cf" stroke-opacity=".45" stroke-width="1.2"/>' +
    '<path d="M-58 -70 L70 60" stroke="#fff" stroke-opacity=".14" stroke-width="22"/>' +
    '<text y="22" text-anchor="middle" font-size="66" font-weight="900" fill="#9a6408" opacity=".55" transform="translate(2 3)" style="font-family:var(--font-display,Arial)">RD</text>' +
    '<text y="22" text-anchor="middle" font-size="66" font-weight="900" fill="url(#emb)" style="font-family:var(--font-display,Arial)">RD</text>' +
    '<path d="M0 -50 l3 7 7 0 -5.5 4.5 2 7 -6.5 -4 -6.5 4 2 -7 -5.5 -4.5 7 0z M0 38 l2 5 5 0 -4 3 1.5 5 -4.5 -3 -4.5 3 1.5 -5 -4 -3 5 0z" fill="#fff6d0" opacity=".85"/>';
  var TAILS = '<defs><radialGradient id="tg" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#d6dde8"/><stop offset="1" stop-color="#7d8898"/></radialGradient><linearGradient id="trim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fb"/><stop offset=".5" stop-color="#a9b4c4"/><stop offset="1" stop-color="#5b6575"/></linearGradient><linearGradient id="tgem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8fa3"/><stop offset=".5" stop-color="#ff2e55"/><stop offset="1" stop-color="#9e0f2c"/></linearGradient><path id="tarc" d="M-62 30 A68 68 0 0 0 62 30" fill="none"/></defs>' +
    '<circle r="99" fill="url(#trim)"/><circle r="92" fill="none" stroke="#4a5363" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="2 3"/><circle r="86" fill="url(#tg)"/><circle r="86" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>' +
    '<path d="M-58 -70 L70 60" stroke="#fff" stroke-opacity=".18" stroke-width="22"/>' +
    '<path d="M0 -58 L36 -28 L0 30 L-36 -28Z" fill="url(#tgem)" stroke="#5b0718" stroke-width="2" stroke-linejoin="round"/><path d="M-36 -28 H36 M0 -58 L-14 -28 L0 30 L14 -28Z" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-linejoin="round"/><path d="M0 -58 L-14 -28 H14Z" fill="#fff" fill-opacity=".25"/>' +
    '<text y="-22" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">RD</text>';
  function uniq(svg, ids) { var k = U("cf"); ids.forEach(function (id) { svg = svg.split('id="' + id + '"').join('id="' + id + k + '"').split("url(#" + id + ")").join("url(#" + id + k + ")").split('href="#' + id + '"').join('href="#' + id + k + '"'); }); return svg; }
  function coinSide(side) { return side === "tails" ? uniq(TAILS, ["tg", "trim", "tgem", "tarc"]) : uniq(HEADS, ["cg", "rim", "emb"]); }

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

  /* Mascote do Chicken: galinha com boné e lenço RD (viewBox 0 0 48 48) */
  function hen() { return '<ellipse cx="24" cy="44.5" rx="11" ry="2.3" fill="#000" opacity=".3"/> <path d="M19.5 38v5.5M27.5 38v5.5M17.3 43.6h4.4M25.3 43.6h4.4" stroke="#ff9d1a" stroke-width="2.2" stroke-linecap="round"/> <ellipse cx="24" cy="30" rx="12.5" ry="10.8" fill="#fff"/> <path d="M11.8 29.5c-3.4-1.2-5.6 1.2-5.2 4.4 3.2.2 5.4-1 6.6-2.4z" fill="#e8edf7"/> <path d="M16.5 30.5c3 4.2 9.6 4.4 12.6 1" stroke="#dfe6f5" stroke-width="2" fill="none" stroke-linecap="round"/> <circle cx="27" cy="16.5" r="8.2" fill="#fff"/> <path d="M34.6 17.8l5.2 1.7-5.2 1.6z" fill="#ffb020"/> <circle cx="30.2" cy="17.4" r="1.6" fill="#1a1205"/><circle cx="30.7" cy="16.9" r=".5" fill="#fff"/>  <path d="M19.4 21.6c4.6 2.6 10 2.6 14.6-.3l.4 3.1c-5 3-10.6 3-15.4.3z" fill="#ff2e55"/> <path d="M22 23.6l3.6 6.2 3.4-6.4z" fill="#ff2e55"/> <path d="M22.6 24.4l3 4.8 2.8-5" fill="none" stroke="#c2133a" stroke-width=".6"/> <circle cx="23.4" cy="22.9" r=".45" fill="#fff" opacity=".8"/><circle cx="28.6" cy="23.4" r=".45" fill="#fff" opacity=".8"/><circle cx="32" cy="22.4" r=".45" fill="#fff" opacity=".8"/><circle cx="25.6" cy="26.2" r=".4" fill="#fff" opacity=".8"/> <path d="M19.6 22.4l-3.6 2.6 2.4 1.6z M19.8 23.6l-2 4.2 2.8-1z" fill="#c2133a"/>  <path d="M18.9 15.2c-.2-5.6 3.6-8.4 8.1-8.4s8.3 2.8 8.1 8.2z" fill="#ff2e55"/> <path d="M18.9 15.2h16.2" stroke="#c2133a" stroke-width="1.2"/> <path d="M33.6 14.4h7.2c1.4 0 1.4 2.2 0 2.2h-7.4z" fill="#c2133a"/> <circle cx="27" cy="6.9" r="1" fill="#c2133a"/> <path d="M21.5 9.5c1.6-1.6 3.4-2.1 5.5-2.1" stroke="#ff8fa3" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/> <text x="27.4" y="13.6" text-anchor="middle" font-size="5" font-weight="900" fill="#ffc85c" style="font-family:var(--font-display,Arial)" letter-spacing="-.2">RD</text>'; }

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
    tower: { a: "#16c98d", b: "#06352a", draw: function () {
      var out = "", egg = U("eg"), glow = U("tg");
      var rows = [[3, 252], [3, 206], [3, 160], [3, 114]];
      rows.forEach(function (r, k) {
        for (var i = 0; i < r[0]; i++) {
          var x = 150 + (i - 1) * 58 - 25, y = r[1], hot = k === 3 && i === 1, bad = k === 2 && i === 0;
          out += '<rect x="' + x + '" y="' + y + '" width="50" height="36" rx="8" fill="' + (hot ? "#ffffff" : "#0b3a2c") + '" fill-opacity="' + (hot ? 0.18 : 0.75) + '" stroke="#5fffd0" stroke-opacity="' + (k < 2 ? 0.55 : 0.25) + '" stroke-width="2"/>';
          if (k < 2 && i === (k ? 2 : 1)) out += '<ellipse cx="' + (x + 25) + '" cy="' + (y + 19) + '" rx="9" ry="11" fill="#ffc85c"/>';
          if (bad) out += '<circle cx="' + (x + 25) + '" cy="' + (y + 17) + '" r="10" fill="#ff7a59"/><circle cx="' + (x + 21) + '" cy="' + (y + 16) + '" r="2.4" fill="#2a0d10"/><circle cx="' + (x + 29) + '" cy="' + (y + 16) + '" r="2.4" fill="#2a0d10"/>';
        }
      });
      return "<defs>" + rad(egg, [[0, "#fff8d6"], [0.5, "#ffd23f"], [1, "#e08a00"]], 0.38, 0.3, 0.75) + rad(glow, [[0, "#5fffd0", 0.55], [1, "#5fffd0", 0]]) + "</defs>" +
        '<circle cx="150" cy="78" r="70" fill="url(#' + glow + ')"/>' + out +
        '<ellipse cx="150" cy="86" rx="30" ry="38" fill="url(#' + egg + ')"/><ellipse cx="140" cy="72" rx="8" ry="12" fill="#fff" opacity=".6"/>' +
        '<path d="M128 96c8 6 14 0 22 4s14 2 22-4" stroke="#e08a00" stroke-width="3" fill="none"/>' + spark(222, 58, 11) + spark(74, 92, 8);
    } },
    chicken: { a: "#ffc23a", b: "#7a2e00", draw: function () {
      var lanes = "";
      for (var i = 0; i < 4; i++) lanes += '<rect x="' + (18 + i * 70) + '" y="64" width="64" height="226" rx="10" fill="#2a1a12" opacity="' + (0.55 + i * 0.08) + '"/><path d="M' + (85 + i * 70) + ' 74 v206" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-dasharray="14 12"/>';
      var car = '<g transform="translate(232 70)"><rect x="0" y="0" width="40" height="66" rx="11" fill="#ff2e55"/><rect x="6" y="12" width="28" height="14" rx="4" fill="#2a1a24"/><rect x="6" y="44" width="28" height="10" rx="3" fill="#2a1a24"/><rect x="6" y="1" width="8" height="4" rx="2" fill="#fff4c2"/><rect x="26" y="1" width="8" height="4" rx="2" fill="#fff4c2"/></g>';
      var chick = '<g transform="translate(88 118) scale(2.6)">' + hen() + '</g>';
      return lanes + car + '<rect x="160" y="236" width="56" height="26" rx="13" fill="#22e08a"/><text x="188" y="254" text-anchor="middle" font-size="14" font-weight="900" fill="#05301c" style="font-family:var(--font-display,Arial)">2.46×</text>' + chick + coinFront(252, 210, 18) + spark(54, 62, 10);
    } },
    coinflip: { a: "#ffc23a", b: "#7a4a00", draw: function () {
      return '<ellipse cx="150" cy="300" rx="92" ry="14" fill="#000" opacity=".3"/><g transform="translate(150 178) scale(.95)">' + coinSide("heads") + "</g>" +
        '<g transform="translate(250 92) scale(.22) rotate(18)">' + coinSide("tails") + "</g>" + spark(56, 84, 12) + spark(246, 270, 9);
    } },
    rps: { a: "#7c5cff", b: "#21124f", draw: function () {
      var t = function (x, y, e, sz, r) { return '<text x="' + x + '" y="' + y + '" font-size="' + sz + '" text-anchor="middle" dominant-baseline="central" transform="rotate(' + r + " " + x + " " + y + ')">' + e + "</text>"; };
      return '<circle cx="150" cy="180" r="92" fill="#fff" opacity=".08"/>' + t(150, 112, "✌️", 84, 180) + t(150, 236, "✊", 96, 0) +
        '<path d="M96 168 L126 176 L104 192 M204 168 L174 176 L196 192" stroke="#ffd23f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' + spark(70, 90, 12) + spark(236, 260, 10);
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
        '<g transform="translate(110 150) rotate(-28)"><rect x="-20" y="-22" width="40" height="40" rx="11" fill="#ff2e55"/><text x="0" y="4" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">RD</text><circle cx="0" cy="-36" r="13" fill="#e8b48a"/><path d="M-20 -14 L-44 -40 M20 -14 L40 -44" stroke="#ff2e55" stroke-width="9" stroke-linecap="round"/><circle cx="-46" cy="-43" r="8" fill="#ffd23f"/><circle cx="42" cy="-48" r="8" fill="#ffd23f"/></g>' +
        '<g transform="translate(206 112)"><circle r="24" fill="#fff"/><path d="M0 -9 l9 6 -3 10 h-12 l-3 -10z" fill="#111"/><path d="M0 -24 v15 M9 -3 l14 -4 M6 7 l8 12 M-6 7 l-8 12 M-9 -3 l-14 -4" stroke="#111" stroke-width="3"/></g>' +
        '<path d="M206 140 q-40 70 -70 120" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round" fill="none"/>' + spark(60, 240, 10) + spark(250, 240, 12);
    } },
    door: { a: "#8a3ffc", b: "#1d0b3d", draw: function () {
      var d = function (x, open, glow) { return '<g transform="translate(' + x + ' 92)"><rect x="-4" y="-4" width="76" height="174" rx="8" fill="#000" opacity=".35"/>' + (open ? '<rect width="68" height="166" rx="6" fill="' + glow + '"/><circle cx="34" cy="84" r="20" fill="#fff" opacity=".5"/>' + '<path d="M0 0 L22 10 V176 L0 166 Z" fill="#3b2061"/>' : '<rect width="68" height="166" rx="6" fill="#5a2fa0"/><rect x="10" y="12" width="48" height="58" rx="4" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/><rect x="10" y="86" width="48" height="64" rx="4" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/><circle cx="56" cy="82" r="5" fill="#ffd23f"/>') + "</g>"; };
      return d(22, false) + d(116, true, "#ffd23f") + d(210, false) + '<g transform="translate(150 250)"><circle r="18" fill="#ffd23f"/><text y="6" text-anchor="middle" font-size="15" font-weight="900" fill="#7a4a00" style="font-family:var(--font-display,Arial)">RD</text></g>' + spark(262, 74, 12) + spark(36, 70, 9);
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
    var bg = U("bg"), gl = U("gw"), fd = U("fd"), name = { dice: "DICE", limbo: "LIMBO", crash: "CRASH", mines: "MINES", plinko: "PLINKO", hilo: "HI-LO", blackjack: "BLACKJACK", roulette: "ROULETTE", wheel: "WHEEL", keno: "KENO", tower: "TOWER", chicken: "CHICKEN", coinflip: "COINFLIP", rps: "RPS", baccarat: "BACCARAT", double: "DOUBLE", soccer: "SOCCER", door: "DOOR" }[id];
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
    hen: hen,
    tierBadge: tierBadge,
    rewardIcon: rewardIcon,
    coinSide: coinSide,
    games: Object.keys(COVERS)
  };
})();
