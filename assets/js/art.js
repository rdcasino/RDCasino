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
  function cardBack(x, y, w, rot) {
    var h = w * 1.4, id = U("cb"), pt = U("cp");
    return '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ')"><defs>' + lin(id, [[0, "#2a7bff"], [1, "#0d3fb0"]], 0, 0, 1, 1) +
      '<pattern id="' + pt + '" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="none"/><path d="M0 6 H12" stroke="#fff" stroke-opacity=".12" stroke-width="3"/></pattern></defs>' +
      '<rect x="' + (-w / 2 + 5) + '" y="' + (-h / 2 + 9) + '" width="' + w + '" height="' + h + '" rx="' + w * 0.09 + '" fill="#000" opacity=".28"/>' +
      '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="' + w * 0.09 + '" fill="#fff"/>' +
      '<rect x="' + (-w / 2 + w * 0.07) + '" y="' + (-h / 2 + w * 0.07) + '" width="' + w * 0.86 + '" height="' + (h - w * 0.14) + '" rx="' + w * 0.06 + '" fill="url(#' + id + ')"/>' +
      '<rect x="' + (-w / 2 + w * 0.07) + '" y="' + (-h / 2 + w * 0.07) + '" width="' + w * 0.86 + '" height="' + (h - w * 0.14) + '" rx="' + w * 0.06 + '" fill="url(#' + pt + ')"/>' +
      '<rect x="' + (-w * 0.26) + '" y="' + (-w * 0.16) + '" width="' + w * 0.52 + '" height="' + w * 0.32 + '" rx="' + w * 0.06 + '" fill="#fff"/>' +
      '<text x="0" y="' + w * 0.09 + '" text-anchor="middle" font-size="' + w * 0.24 + '" font-weight="900" fill="#1656d6" style="font-family:Arial Black,Arial">RD</text></g>';
  }
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
    var f = t && RD.vipFamilies ? RD.vipFamilies[t.family] : null, c1 = f ? f.c1 : "#5a6478", c2 = f ? f.c2 : "#262c3a", rim = U("tb"), face = U("tf"), gem = U("tg"), sh = U("th");
    var n = t && /(\d+)$/.exec(t.name), roman = n ? ["", "I", "II", "III", "IV", "V"][+n[1]] || n[1] : "";
    return '<svg class="tier-badge" width="' + size + '" height="' + size + '" viewBox="0 0 40 40" aria-hidden="true"><defs>' +
      lin(rim, [[0, c1], [0.5, c2], [1, c1]], 0, 0, 1, 1) + lin(face, [[0, c2, 0.55], [1, "#0b0f1a"]], 0, 0, 0, 1) + lin(gem, [[0, "#ffffff"], [0.5, c1], [1, c2]], 0, 0, 1, 1) + lin(sh, [[0, "#fff", 0.35], [1, "#fff", 0]]) + "</defs>" +
      '<rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="url(#' + rim + ')"/><rect x="2.2" y="2.2" width="35.6" height="35.6" rx="9.4" fill="#0b0f1a"/><rect x="2.2" y="2.2" width="35.6" height="35.6" rx="9.4" fill="url(#' + face + ')"/>' +
      '<path d="M4 11 Q4 4 11 4 H29 Q36 4 36 11 V13 Q20 8 4 15Z" fill="url(#' + sh + ')"/>' +
      (f ? '<path d="M20 7 L29.5 14 L20 ' + (roman ? 27 : 31) + ' L10.5 14Z" fill="url(#' + gem + ')"/><path d="M10.5 14 H29.5 M20 7 L16.2 14 L20 ' + (roman ? 27 : 31) + ' L23.8 14 Z" fill="none" stroke="' + c2 + '" stroke-opacity=".6" stroke-width=".9" stroke-linejoin="round"/>'
         : '<path d="M20 9 L28 15 L20 28 L12 15Z" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.8" stroke-linejoin="round"/>') +
      (roman ? '<text x="20" y="35" text-anchor="middle" font-size="6.6" font-weight="800" letter-spacing="1" fill="' + c1 + '" style="font-family:Inter,Arial,sans-serif">' + roman + "</text>" : "") + "</svg>";
  }


  /* Tag do dono/equipe: diamante brilhante (no lugar do nível VIP) */


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
    hilo: { a: "#16c8ea", b: "#04283a", draw: function () {
      // duas cartas em leque (K de espadas atrás, 7 de copas na frente) e setas 3D de maior e menor
      var gl = U("hg"), ray = "";
      for (var i = 0; i < 10; i++) ray += '<path d="M150 170 L' + (150 + 260 * Math.cos(i * 0.628)).toFixed(0) + " " + (170 + 260 * Math.sin(i * 0.628)).toFixed(0) + " L" + (150 + 260 * Math.cos(i * 0.628 + 0.2)).toFixed(0) + " " + (170 + 260 * Math.sin(i * 0.628 + 0.2)).toFixed(0) + 'Z" fill="#fff" opacity=".05"/>';
      var arr = function (x, y, up, c1, c2) {
        var g = U("ha"), h = U("hh");
        return "<defs>" + lin(g, [[0, c1], [1, c2]]) + rad(h, [[0, "#fff", 0.75], [1, "#fff", 0]], 0.35, 0.25, 0.6) + "</defs>" +
          '<g transform="translate(' + x + " " + y + ')"><circle cy="5" r="27" fill="' + c2 + '" opacity=".9"/><circle r="27" fill="url(#' + g + ')"/><circle r="27" fill="url(#' + h + ')"/>' +
          '<circle r="25.5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>' +
          '<path transform="' + (up ? "" : "rotate(180)") + '" d="M0 -15 L14 2 H6 V14 H-6 V2 H-14 Z" fill="#fff" stroke="' + c2 + '" stroke-width="1.5" stroke-linejoin="round"/></g>';
      };
      return "<defs>" + rad(gl, [[0, "#c8f6ff", 0.6], [1, "#c8f6ff", 0]]) + "</defs>" + ray + '<circle cx="150" cy="168" r="118" fill="url(#' + gl + ')"/>' +
        '<ellipse cx="150" cy="276" rx="92" ry="11" fill="#000" opacity=".3"/>' +
        card(116, 176, 104, -15, "K", "♠", false) + card(180, 168, 116, 9, "7", "♥", true) +
        arr(246, 80, true, "#3cf08a", "#0b8a45") + arr(54, 252, false, "#ff6b86", "#b0102e") +
        spark(60, 76, 11) + spark(256, 252, 9) + spark(214, 40, 7, "#fff", 0.7);
    } },
    blackjack: { a: "#22b35e", b: "#063a1c", draw: function () {
      // mesa: o arco do feltro, o verso da carta do dealer e o Ás virado, fichas altas
      var g = U("bj");
      return "<defs>" + lin(g, [[0, "#fff1b8"], [0.5, "#ffd23f"], [1, "#d98a00"]]) + "</defs>" +
        '<path d="M-10 300 Q150 150 310 300" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3"/><path d="M-10 320 Q150 176 310 320" fill="none" stroke="#ffd23f" stroke-opacity=".35" stroke-width="2" stroke-dasharray="4 8"/>' +
        cardBack(124, 150, 100, -14) + card(180, 164, 100, 10, "A", "♠", false) +
        chip(56, 270, 30, "#e11d48", 5) + chip(250, 274, 26, "#1d4ed8", 4) + chip(250, 230, 22, "#ffd23f", 1) +
        '<g transform="translate(150 54)"><rect x="-38" y="-20" width="76" height="40" rx="20" fill="#062a16" stroke="url(#' + g + ')" stroke-width="3"/><text x="0" y="11" text-anchor="middle" font-size="27" font-weight="900" fill="url(#' + g + ')" style="font-family:var(--font-display,Arial)">21</text></g>';
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
      // roda com borda dourada em relevo, segmentos com brilho, lâmpadas acesas, ponteiro 3D e moedas saltando
      var cx = 150, cy = 156, R = 100, r = 50, N = 16, cols = ["#ff2e55", "#ffd23f", "#2f7bff", "#22e08a", "#a06bff", "#ff8a1a", "#14c8e6", "#ffd23f"], seg = "", bulbs = "", rim = U("wr"), gl = U("wg"), hub = U("wh"), bg = U("wb");
      var P = function (rr, a) { return (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1); };
      for (var i = 0; i < N; i++) {
        var a0 = (i / N) * 2 * Math.PI - Math.PI / 2, a1 = a0 + 2 * Math.PI / N;
        seg += '<path d="M' + P(R, a0) + " A" + R + " " + R + " 0 0 1 " + P(R, a1) + " L" + P(r, a1) + " A" + r + " " + r + " 0 0 0 " + P(r, a0) + 'Z" fill="' + cols[i % cols.length] + '" stroke="#2a0d05" stroke-width="2"/>';
        var b = (i / N) * 2 * Math.PI - Math.PI / 2;
        bulbs += '<circle cx="' + (cx + 113 * Math.cos(b)).toFixed(1) + '" cy="' + (cy + 113 * Math.sin(b)).toFixed(1) + '" r="' + (i % 2 ? 3.2 : 4) + '" fill="#fff6c9"/>' + (i % 2 ? "" : '<circle cx="' + (cx + 113 * Math.cos(b)).toFixed(1) + '" cy="' + (cy + 113 * Math.sin(b)).toFixed(1) + '" r="9" fill="#ffe27a" opacity=".35"/>');
      }
      return "<defs>" + lin(rim, [[0, "#fff1b8"], [0.35, "#ffc23a"], [0.7, "#c97a00"], [1, "#ffe08a"]], 0, 0, 1, 1) + rad(gl, [[0, "#fff", 0.45], [0.6, "#fff", 0.08], [1, "#fff", 0]], 0.32, 0.22, 0.75) +
        rad(hub, [[0, "#4a2a1a"], [1, "#1c0d06"]]) + rad(bg, [[0, "#ffd08a", 0.55], [1, "#ffd08a", 0]]) + "</defs>" +
        '<circle cx="150" cy="156" r="146" fill="url(#' + bg + ')"/>' +
        '<ellipse cx="150" cy="284" rx="100" ry="12" fill="#000" opacity=".32"/>' +
        '<circle cx="' + cx + '" cy="' + (cy + 9) + '" r="124" fill="#7a3a00"/><circle cx="' + cx + '" cy="' + cy + '" r="124" fill="url(#' + rim + ')"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="106" fill="#2a0d05"/>' + seg + bulbs +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="url(#' + gl + ')"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 2) + '" fill="url(#' + rim + ')"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 5) + '" fill="url(#' + hub + ')"/>' +
        '<text x="' + cx + '" y="' + (cy + 10) + '" text-anchor="middle" font-size="28" font-weight="900" fill="#ffd23f" style="font-family:var(--font-display,Arial)">RD</text>' +
        '<g transform="translate(150 26)"><path d="M-17 0 H17 L0 34 Z" fill="#7a0d1f"/><path d="M-17 -4 H17 L0 30 Z" fill="#ff2e55" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><circle cy="2" r="4" fill="#fff"/></g>' +
        coinFront(254, 238, 20) + coinFront(42, 214, 15) + spark(262, 60, 11) + spark(36, 92, 9);
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
      // estrada em perspectiva até o horizonte, farol do carro vindo, bueiros dourados com multiplicador e a galinha na frente
      var road = U("cr"), beam = U("cb"), out = "";
      out += "<defs>" + lin(road, [[0, "#1d1824"], [1, "#3a3046"]]) + lin(beam, [[0, "#fff6c8", 0.7], [1, "#fff6c8", 0]]) + "</defs>";
      out += '<path d="M118 0 H182 L300 300 H0 Z" fill="url(#' + road + ')"/>';
      out += '<path d="M118 0 L0 300" stroke="#ffd23f" stroke-width="5"/><path d="M182 0 L300 300" stroke="#ffd23f" stroke-width="5"/>';
      [[0.35, 4], [0.62, 6], [0.88, 8]].forEach(function (l) { out += '<path d="M' + (118 + 64 * l[0]) + " 0 L" + (300 * l[0]) + ' 300" stroke="#fff" stroke-opacity=".55" stroke-width="' + l[1] * 0.6 + '" stroke-dasharray="' + (l[1] * 3) + " " + (l[1] * 3) + '"/>'; });
      // carro ao longe com o facho de luz vindo
      out += '<path d="M138 46 L82 230 H218 L162 46 Z" fill="url(#' + beam + ')"/>' +
        '<g transform="translate(150 40)"><rect x="-20" y="-16" width="40" height="30" rx="7" fill="#ff2e55"/><rect x="-15" y="-11" width="30" height="10" rx="3" fill="#2a1a24"/><circle cx="-12" cy="9" r="4.5" fill="#fff6c8"/><circle cx="12" cy="9" r="4.5" fill="#fff6c8"/><circle cx="-12" cy="9" r="10" fill="#fff6c8" opacity=".35"/><circle cx="12" cy="9" r="10" fill="#fff6c8" opacity=".35"/></g>';
      var mh = function (x, y, s, m, on) { return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')"><ellipse cy="4" rx="34" ry="13" fill="#000" opacity=".4"/><ellipse rx="34" ry="13" fill="' + (on ? "#ffd23f" : "#4a4458") + '" stroke="' + (on ? "#b46f00" : "#2e2838") + '" stroke-width="3"/><text y="5" text-anchor="middle" font-size="13" font-weight="900" fill="' + (on ? "#5a3400" : "#cfc8dc") + '" style="font-family:Arial Black,Arial">' + m + "</text></g>"; };
      out += mh(112, 120, 0.5, "", false) + mh(188, 120, 0.5, "", false) + mh(84, 196, 0.82, "1.51×", false) + mh(216, 196, 0.82, "2.46×", false) + mh(150, 268, 1.3, "1.09×", true);
      return out + '<g transform="translate(66 128) scale(1.42)">' + chick() + "</g>" + spark(270, 40, 10, "#fff") + spark(30, 64, 8, "#fff");
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
      // pedra, papel e tesoura de verdade (objetos com volume), ligados por raios de energia, com o VS no meio
      var st = U("rs"), sh = U("rh"), pp = U("rp"), bl = U("rb"), gw = U("rg"), vs = U("rv");
      var rock = '<g transform="translate(78 224) scale(1.05)"><ellipse cy="40" rx="50" ry="9" fill="#000" opacity=".3"/>' +
        '<path d="M-48 18 L-36 -22 L-6 -40 L30 -32 L50 -4 L44 30 L10 42 L-30 38 Z" fill="url(#' + st + ')"/>' +
        '<path d="M-36 -22 L-6 -40 L30 -32 L8 -10 Z" fill="#fff" opacity=".28"/><path d="M8 -10 L30 -32 L50 -4 L24 6 Z" fill="#fff" opacity=".12"/><path d="M-48 18 L-36 -22 L8 -10 L-8 20 Z" fill="#000" opacity=".1"/><path d="M-8 20 L24 6 L44 30 L10 42 Z" fill="#000" opacity=".22"/><path d="M-30 38 L-8 20 L10 42 Z" fill="#000" opacity=".3"/></g>';
      var paper = '<g transform="translate(150 96) rotate(-8) scale(.92)"><rect x="-40" y="-50" width="84" height="104" rx="6" fill="#000" opacity=".25" transform="translate(6 8)"/>' +
        '<path d="M-40 -50 H24 L44 -30 V54 H-40 Z" fill="url(#' + pp + ')"/><path d="M24 -50 V-30 H44 Z" fill="#c9d3e8"/>' +
        '<path d="M-28 -24 H28 M-28 -10 H28 M-28 4 H28 M-28 18 H14 M-28 32 H22" stroke="#9aa7c4" stroke-width="3.5" stroke-linecap="round"/></g>';
      var scis = '<g transform="translate(224 236) rotate(-28) scale(1.15)"><ellipse cx="6" cy="46" rx="40" ry="7" fill="#000" opacity=".25" transform="rotate(32)"/>' +
        '<path d="M-4 -8 L-10 -84 Q-6 -92 0 -84 L6 -10 Z" fill="url(#' + bl + ')" stroke="#5a6578" stroke-width="1.5"/>' +
        '<path d="M4 -8 L40 -76 Q46 -80 46 -72 L12 -4 Z" fill="url(#' + bl + ')" stroke="#5a6578" stroke-width="1.5"/>' +
        '<circle cx="3" cy="-6" r="6" fill="#d7dee9" stroke="#5a6578" stroke-width="2"/>' +
        '<ellipse cx="-14" cy="22" rx="15" ry="19" fill="none" stroke="#ff3d64" stroke-width="10" transform="rotate(14 -14 22)"/><ellipse cx="20" cy="20" rx="15" ry="19" fill="none" stroke="#1f8fff" stroke-width="10" transform="rotate(-20 20 20)"/>' +
        '<ellipse cx="-18" cy="12" rx="5" ry="3" fill="#fff" opacity=".5"/><ellipse cx="14" cy="10" rx="5" ry="3" fill="#fff" opacity=".5"/></g>';
      var zap = function (d) { return '<path d="' + d + '" fill="none" stroke="#ffe27a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/><path d="' + d + '" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>'; };
      return "<defs>" + lin(st, [[0, "#c3c9d6"], [1, "#6b7384"]], 0, 0, 1, 1) + lin(pp, [[0, "#ffffff"], [1, "#e3e9f6"]]) + lin(bl, [[0, "#ffffff"], [0.5, "#c5cfdd"], [1, "#8792a6"]], 0, 0, 1, 0) +
        rad(gw, [[0, "#d8ccff", 0.55], [1, "#d8ccff", 0]]) + lin(vs, [[0, "#fff6c8"], [1, "#ffb020"]]) + "</defs>" +
        '<circle cx="150" cy="168" r="130" fill="url(#' + gw + ')"/>' +
        zap("M96 178 L112 160 L106 152 L124 134") + zap("M204 136 L188 152 L196 158 L180 176") + zap("M124 246 L144 240 L142 250 L166 244") +
        paper + rock + scis +
        '<g transform="translate(150 178)"><circle r="27" fill="#5a2a00" opacity=".5" cy="4"/><circle r="27" fill="url(#' + vs + ')" stroke="#fff" stroke-width="3"/><text y="8" text-anchor="middle" font-size="21" font-weight="900" fill="#5a2a00" style="font-family:var(--font-display,Arial)">VS</text></g>' +
        spark(48, 70, 11) + spark(262, 262, 9) + spark(150, 52, 8);
    } },
    baccarat: { a: "#ff2e55", b: "#4a0716", draw: function () {
      // Player × Banker: duas torres de fichas frente a frente e o 9 dourado (a mão perfeita) no meio
      var g = U("bn"), gl = U("bg9");
      var tag = function (x, txt, c) { return '<g transform="translate(' + x + ' 252)"><rect x="-40" y="-13" width="80" height="26" rx="13" fill="' + c + '"/><text x="0" y="5" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" letter-spacing="1" style="font-family:Arial">' + txt + "</text></g>"; };
      return "<defs>" + lin(g, [[0, "#fff6c9"], [0.45, "#ffd23f"], [1, "#c97a00"]]) + rad(gl, [[0, "#ffd23f", 0.55], [1, "#ffd23f", 0]]) + "</defs>" +
        '<circle cx="150" cy="150" r="100" fill="url(#' + gl + ')"/>' +
        chip(62, 214, 32, "#1d4ed8", 6) + chip(238, 214, 32, "#e11d48", 6) +
        '<text x="154" y="210" text-anchor="middle" font-size="150" font-weight="900" fill="#5a0010" opacity=".45" style="font-family:var(--font-display,Arial)">9</text>' +
        '<text x="150" y="204" text-anchor="middle" font-size="150" font-weight="900" fill="url(#' + g + ')" stroke="#7a3f00" stroke-width="3" style="font-family:var(--font-display,Arial)">9</text>' +
        tag(62, "PLAYER", "#1d4ed8") + tag(238, "BANKER", "#e11d48") + spark(150, 46, 12) + spark(40, 90, 8) + spark(262, 96, 9);
    } },
    double: { a: "#ff2e55", b: "#2a0710", draw: function () {
      var t = function (x, y, w, fill, stroke, txt, rot, op) { return '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ')" opacity="' + (op || 1) + '"><rect x="' + (-w / 2) + '" y="' + (-w * 0.62) + '" width="' + w + '" height="' + (w * 1.24) + '" rx="' + (w * 0.18) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="5"/>' + txt + "</g>"; };
      var gem = '<path d="M0 -26 L22 -8 L0 26 L-22 -8 Z" fill="#ff2e55"/><path d="M0 -26 L10 -8 L0 26 L-10 -8 Z" fill="#ff7d96"/>';
      return '<path d="M150 58 l-14 -22 h28z" fill="#fff" opacity=".9"/>' + t(58, 186, 70, "#1b1220", "#3a2a3a", "", -10, 0.9) + t(242, 186, 70, "#b0102e", "#ff6b86", "", 10, 0.9) + t(150, 176, 96, "#ffffff", "#ffd6de", gem, 0, 1) + chip(70, 290, 24, "#ffd23f", 4) + chip(232, 292, 26, "#ff2e55", 3) + spark(250, 80, 12) + spark(52, 92, 9);
    } },
    soccer: { a: "#22b35e", b: "#062a16", draw: function () {
      // gol em perspectiva, goleiro voando para um lado e a bola entrando no ângulo do outro, no fim da linha do chute
      var net = ""; for (var x = 54; x <= 246; x += 16) net += '<path d="M' + x + ' 64 V176" stroke="#fff" stroke-opacity=".16"/>'; for (var y = 74; y <= 176; y += 14) net += '<path d="M48 ' + y + ' H252" stroke="#fff" stroke-opacity=".16"/>';
      var keeper = '<g transform="translate(96 132) rotate(-24)">' +
        '<path d="M-6 26 L-30 54 M8 26 L-6 60" stroke="#111827" stroke-width="12" stroke-linecap="round"/><path d="M-30 54 l-10 4 M-6 60 l-6 8" stroke="#ffd23f" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M-18 -18 Q0 -26 18 -18 L22 26 Q0 34 -22 26 Z" fill="#1f6fff"/><path d="M-18 -18 Q0 -26 18 -18 L19 -8 Q0 -14 -19 -8 Z" fill="#0d3fb0"/>' +
        '<text x="0" y="12" text-anchor="middle" font-size="15" font-weight="900" fill="#fff" style="font-family:Arial Black,Arial">RD</text>' +
        '<path d="M-16 -14 Q-40 -30 -52 -58 M16 -14 Q30 -40 26 -70" stroke="#1f6fff" stroke-width="11" stroke-linecap="round" fill="none"/>' +
        '<circle cx="-54" cy="-64" r="10" fill="#ffd23f" stroke="#c98a00" stroke-width="2"/><circle cx="26" cy="-78" r="10" fill="#ffd23f" stroke="#c98a00" stroke-width="2"/>' +
        '<circle cx="0" cy="-40" r="15" fill="#f1c19a"/><path d="M-15 -44 Q-14 -60 0 -60 Q14 -60 15 -44 Q0 -50 -15 -44Z" fill="#3a2418"/><circle cx="5" cy="-40" r="2" fill="#2a1a12"/><path d="M2 -33 q4 2 7 -1" stroke="#a5634a" stroke-width="2" fill="none" stroke-linecap="round"/></g>';
      var ball = '<g transform="translate(222 92) rotate(18)"><circle r="21" fill="#fff" stroke="#d4dbe6" stroke-width="2"/><path d="M0 -8 L8 -2 L5 8 H-5 L-8 -2 Z" fill="#111"/><path d="M0 -21 V-8 M8 -2 L20 -6 M5 8 L12 18 M-5 8 L-12 18 M-8 -2 L-20 -6" stroke="#111" stroke-width="2.5"/></g>';
      return '<rect x="48" y="62" width="204" height="116" fill="#000" opacity=".22"/>' + net + '<path d="M44 182 V58 H256 V182" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>' +
        '<path d="M150 292 Q 214 210 222 112" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round" fill="none"/>' +
        '<ellipse cx="150" cy="294" rx="16" ry="5" fill="#fff" opacity=".35"/>' + keeper + ball +
        '<path d="M236 78 l14 -10 M240 92 l16 -2 M232 66 l6 -14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>' + spark(40, 240, 10) + spark(266, 244, 12);
    } },
    lake: { a: "#1fb6ff", b: "#0a3a7a", draw: function () {
      // sapo no meio do pulo entre duas vitórias-régias, rastro do salto, água com reflexos e juncos
      var wv = U("lw"), gw = U("lg"), out = "";
      var pad = function (x, y, s, m, flower) { return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')"><ellipse cy="7" rx="50" ry="18" fill="#063a6a" opacity=".55"/><path d="M0 0 L46 -6 A50 18 0 1 1 30 -14 Z" fill="#3fbf4a"/><path d="M0 0 L46 -6 A50 18 0 1 1 30 -14 Z" fill="none" stroke="#2a9a38" stroke-width="2.5"/><path d="M0 0 L-30 -8 M0 0 L-34 6 M0 0 L-6 16 M0 0 L22 12" stroke="#2a9a38" stroke-width="2" stroke-linecap="round"/>' +
        (flower ? '<g transform="translate(-24 -10)"><circle r="9" fill="#ffb3f0"/><circle r="4" fill="#ffe27a"/></g>' : "") +
        (m ? '<g transform="translate(6 -22)"><rect x="-26" y="-12" width="52" height="24" rx="12" fill="#0b2a52" opacity=".85"/><text y="5" text-anchor="middle" font-size="14" font-weight="900" fill="#ffe27a" style="font-family:Arial Black,Arial">' + m + "</text></g>" : "") + "</g>"; };
      for (var i = 0; i < 7; i++) out += '<path d="M' + (20 + i * 40) + " " + (60 + (i % 3) * 70) + " q14 -6 28 0" + '" stroke="#fff" stroke-opacity=".28" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
      var reed = function (x, h, k) { return '<path d="M' + x + " 300 Q" + (x + k) + " " + (300 - h / 2) + " " + (x + k * 1.6) + " " + (300 - h) + '" stroke="#1f7a3a" stroke-width="5" fill="none" stroke-linecap="round"/>'; };
      return "<defs>" + lin(wv, [[0, "#ffffff", 0], [1, "#ffffff", 0.18]]) + rad(gw, [[0, "#9fe8ff", 0.5], [1, "#9fe8ff", 0]]) + "</defs>" + out +
        '<circle cx="150" cy="170" r="130" fill="url(#' + gw + ')"/>' +
        pad(214, 92, 0.62, "2.40×", false) + pad(232, 166, 0.82, "1.66×", true) + pad(112, 250, 1.45, "", false) +
        '<path d="M150 184 Q 190 120 226 148 M228 140 Q 236 104 218 84" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-dasharray="3 9" stroke-linecap="round" fill="none"/>' +
        '<ellipse cx="112" cy="252" rx="62" ry="12" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>' +
        '<g transform="translate(36 112) scale(1.4)">' + frog() + "</g>" +
        '<circle cx="196" cy="128" r="3" fill="#dff7ff"/><circle cx="208" cy="118" r="2" fill="#dff7ff"/>' + spark(40, 70, 10, "#fff") + spark(272, 40, 8, "#fff");
    } },
    pump: { a: "#33d14a", b: "#0b3d1a", draw: function () {
      // um balão grande e brilhante enchendo pela bomba, com balões menores desfocados atrás
      var g = U("pg"), hl = U("ph"), sm = U("ps"), gw = U("pw"), bd = U("pb");
      var small = function (x, y, s, op) { return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')" opacity="' + op + '"><ellipse rx="40" ry="46" fill="url(#' + sm + ')"/><path d="M-4 46 L4 46 L0 54 Z" fill="#1b8a2e"/><path d="M0 54 C -6 74 6 90 -2 110" stroke="#e9ffe0" stroke-opacity=".5" stroke-width="2" fill="none"/></g>'; };
      return "<defs>" + rad(g, [[0, "#e9ffc9"], [0.35, "#62e870"], [0.8, "#13a334"], [1, "#0a6a20"]], 0.36, 0.3, 0.8) + rad(hl, [[0, "#fff", 0.9], [1, "#fff", 0]]) + rad(sm, [[0, "#b6ff9a"], [1, "#1b8a2e"]], 0.35, 0.3, 0.8) +
        rad(gw, [[0, "#b6ff7a", 0.5], [1, "#b6ff7a", 0]]) + lin(bd, [[0, "#e6ecf5"], [0.5, "#ffffff"], [1, "#9aa6b8"]], 0, 0, 1, 0) + "</defs>" +
        '<circle cx="150" cy="128" r="140" fill="url(#' + gw + ')"/>' +
        small(52, 118, 0.85, 0.55) + small(250, 100, 0.75, 0.5) +
        // bomba de ar e mangueira
        '<path d="M150 214 C 150 244 210 236 220 262" stroke="#1b2540" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M150 214 C 150 244 210 236 220 262" stroke="#3a4a6a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<g transform="translate(232 238)"><rect x="-14" y="-2" width="28" height="44" rx="6" fill="url(#' + bd + ')" stroke="#5a6578" stroke-width="2"/><rect x="-3" y="-26" width="6" height="26" fill="#9aa6b8"/><rect x="-18" y="-32" width="36" height="9" rx="4.5" fill="#ff2e55"/><rect x="-20" y="40" width="40" height="7" rx="3" fill="#5a6578"/></g>' +
        // balão principal
        '<ellipse cx="150" cy="282" rx="58" ry="8" fill="#000" opacity=".25"/>' +
        '<path d="M142 206 L158 206 L150 220 Z" fill="#0a6a20"/>' +
        '<ellipse cx="150" cy="124" rx="80" ry="88" fill="url(#' + g + ')"/>' +
        '<ellipse cx="118" cy="80" rx="26" ry="34" fill="url(#' + hl + ')" transform="rotate(-24 118 80)"/><ellipse cx="196" cy="168" rx="14" ry="8" fill="#fff" opacity=".25" transform="rotate(-40 196 168)"/>' +
        '<text x="152" y="140" text-anchor="middle" font-size="46" font-weight="900" fill="#0a5a1a" opacity=".35" style="font-family:var(--font-display,Arial)">RD</text>' +
        '<text x="150" y="137" text-anchor="middle" font-size="46" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">RD</text>' +
        '<path transform="translate(36 40) scale(2.4)" d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#eaff7a"/><path transform="translate(244 196) scale(1.7)" d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#eaff7a"/>' + spark(262, 44, 10) + spark(40, 236, 8);
    } },
    spill: { a: "#1f8fff", b: "#071a44", draw: function () {
      // torneira cromada enchendo um copo de vidro até transbordar, com respingos e o multiplicador
      var w = U("sw"), m = U("sm"), gl = U("sg"), cp = U("sc"), gs = U("sv"), tag = U("st");
      var glass = "M96 112 L204 112 L194 270 Q193 278 185 278 L115 278 Q107 278 106 270 Z";
      var drops = ""; [[86, 150, 5], [72, 184, 3.5], [222, 168, 4.5], [236, 204, 3], [80, 230, 3]].forEach(function (d) { drops += '<path d="M' + d[0] + " " + (d[1] - d[2] * 1.8) + " Q" + (d[0] + d[2]) + " " + d[1] + " " + d[0] + " " + (d[1] + d[2]) + " Q" + (d[0] - d[2]) + " " + d[1] + " " + d[0] + " " + (d[1] - d[2] * 1.8) + 'Z" fill="#bfeaff"/>'; });
      return "<defs>" + lin(w, [[0, "#b9ecff"], [0.5, "#4fb8ff"], [1, "#1f7ae0"]]) + lin(m, [[0, "#6b7688"], [0.45, "#f2f5fa"], [0.6, "#c3ccda"], [1, "#4a5466"]], 0, 0, 1, 0) + rad(gl, [[0, "#7dd3fc", 0.55], [1, "#7dd3fc", 0]]) +
        lin(gs, [[0, "#ffffff", 0.5], [0.25, "#ffffff", 0.08], [0.8, "#ffffff", 0.04], [1, "#ffffff", 0.35]], 0, 0, 1, 0) + lin(tag, [[0, "#3cf08a"], [1, "#0b8a45"]]) +
        '<clipPath id="' + cp + '"><path d="' + glass + '"/></clipPath></defs>' +
        '<circle cx="150" cy="170" r="132" fill="url(#' + gl + ')"/>' +
        // torneira
        '<rect x="132" y="14" width="36" height="30" rx="4" fill="url(#' + m + ')"/><rect x="110" y="40" width="80" height="16" rx="8" fill="url(#' + m + ')"/><rect x="138" y="54" width="24" height="16" rx="4" fill="url(#' + m + ')"/><rect x="141" y="68" width="18" height="6" rx="2" fill="#3c4556"/>' +
        '<rect x="144" y="72" width="12" height="56" rx="6" fill="url(#' + w + ')"/><rect x="146" y="74" width="3" height="50" rx="1.5" fill="#fff" opacity=".6"/>' +
        // poça e água transbordando
        '<ellipse cx="150" cy="284" rx="84" ry="10" fill="#4fb8ff" opacity=".45"/><ellipse cx="150" cy="284" rx="66" ry="6" fill="#000" opacity=".2"/>' +
        '<path d="M198 112 Q220 118 214 164 Q210 214 224 280 L204 280 Q196 220 200 164 Z" fill="#8fdcff"/><path d="M206 120 Q214 150 210 190" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7" fill="none"/>' +
        '<path d="M102 112 Q82 122 88 170 Q94 222 78 280 L96 280 Q104 222 100 170 Z" fill="#8fdcff" opacity=".85"/>' +
        // copo
        '<g clip-path="url(#' + cp + ')"><rect x="90" y="112" width="120" height="170" fill="url(#' + w + ')"/><path d="M90 126 Q120 116 150 124 T210 120 V112 H90Z" fill="#dff7ff" opacity=".8"/>' +
        '<circle cx="128" cy="210" r="4" fill="#fff" opacity=".5"/><circle cx="168" cy="236" r="3" fill="#fff" opacity=".5"/><circle cx="146" cy="180" r="2.5" fill="#fff" opacity=".5"/></g>' +
        '<path d="' + glass + '" fill="url(#' + gs + ')" stroke="#e8f6ff" stroke-opacity=".9" stroke-width="3"/>' +
        '<ellipse cx="150" cy="112" rx="54" ry="7" fill="#dff7ff" stroke="#fff" stroke-width="2.5"/>' +
        '<path d="M104 110 q-8 -14 -2 -22 M118 106 q-2 -12 4 -18 M184 106 q4 -12 -2 -18 M198 110 q8 -14 2 -22" stroke="#bfeaff" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="96" cy="84" r="3.5" fill="#bfeaff"/><circle cx="206" cy="82" r="3.5" fill="#bfeaff"/><circle cx="124" cy="82" r="2.5" fill="#bfeaff"/>' +
        '<path d="M108 130 L116 262" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>' + drops +
        '<g transform="translate(236 64)"><rect x="-32" y="-15" width="64" height="30" rx="15" fill="#0a5a2c" transform="translate(0 3)"/><rect x="-32" y="-15" width="64" height="30" rx="15" fill="url(#' + tag + ')" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/><text y="6" text-anchor="middle" font-size="16" font-weight="900" fill="#fff" style="font-family:Arial Black,Arial">24.5×</text></g>' +
        spark(52, 80, 11) + spark(256, 250, 8);
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
    cover: cover, frog: frog, chick: chick,
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
