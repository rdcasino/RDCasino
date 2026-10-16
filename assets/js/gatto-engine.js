/* Motor do Don Gatto: a mesma lógica de rd_gatto (supabase/migrations/0037_don_gatto.sql), número por número.
   No modo real quem sorteia é o servidor; aqui ele roda só no modo demonstração e para conferir rodadas. */
// Valores em "centavos de aposta" (inteiros): 100 = 1x a aposta.
// Células: 0..8 símbolos normais, 10 anel, 11 cofre, >=100 envelope (valor = código - 100, em x aposta).
(function (root) {
  var CAP = 500000;
  function wpick(w, tot, f) { var x = f * tot; for (var i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return w.length - 1; }
  function reg(v) { return v >= 0 && v <= 8; }
  function make(P) {
    var WT = P.W.reduce(function (a, b) { return a + b; }, 0);
    var EV = P.ENV.map(function (e) { return e[0]; }), EW = P.ENV.map(function (e) { return e[1]; }), EWT = EW.reduce(function (a, b) { return a + b; }, 0);
    function env(f) { return 100 + EV[wpick(EW, EWT, f)]; }
    function place(g, rng, code, envf) {
      for (var t = 0; t < 10; t++) { var c = Math.floor(rng() * 6), r = Math.floor(rng() * 5); if (reg(g[c * 5 + r])) { g[c * 5 + r] = envf ? env(rng()) : code; return; } }
    }
    function gen(rng, M) {
      var g = new Array(30), c, r;
      for (c = 0; c < 6; c++) for (r = 0; r < 5; r++) {
        var f1 = rng(), f2 = rng(), a = c > 0 && reg(g[(c - 1) * 5 + r]) ? g[(c - 1) * 5 + r] : -1, b = r > 0 && reg(g[c * 5 + r - 1]) ? g[c * 5 + r - 1] : -1, s;
        if (f1 < P.q && (a >= 0 || b >= 0)) s = a >= 0 && b >= 0 ? (f2 < 0.5 ? a : b) : (a >= 0 ? a : b);
        else s = wpick(P.W, WT, f2);
        g[c * 5 + r] = s;
      }
      for (c = 0; c < 6; c++) { var fv = rng(), fr = rng(); if (fv < M.vp) g[c * 5 + Math.floor(fr * 5)] = 11; }
      var fe = rng(), fn = rng(), n = fe < M.eP ? 1 + Math.floor(fn * M.eMax) : 0;
      for (var i = 0; i < n; i++) place(g, rng, 0, true);
      if (n > 0 && rng() < M.rP) place(g, rng, 10, false);
      return g;
    }
    function clusters(g) {
      var seen = new Array(30), out = [];
      for (var i = 0; i < 30; i++) {
        if (seen[i] || !reg(g[i])) continue;
        var s = g[i], st = [i], cl = []; seen[i] = 1;
        while (st.length) {
          var p = st.pop(); cl.push(p); var c = Math.floor(p / 5), r = p % 5;
          var nb = [r > 0 ? p - 1 : -1, r < 4 ? p + 1 : -1, c > 0 ? p - 5 : -1, c < 5 ? p + 5 : -1];
          for (var k = 0; k < 4; k++) { var q = nb[k]; if (q >= 0 && !seen[q] && g[q] === s) { seen[q] = 1; st.push(q); } }
        }
        if (cl.length >= 5) { cl.sort(function (x, y) { return x - y; }); out.push({ s: s, c: cl, p: P.PAY[s][Math.min(cl.length, 15) - 5] }); }
      }
      return out;
    }
    function tumble(g, cls, rng, M) {
      var hit = {}, add = [];
      cls.forEach(function (cl) { cl.c.forEach(function (i) { hit[i] = 1; }); });
      for (var c = 0; c < 6; c++) {
        var keep = []; for (var r = 0; r < 5; r++) if (!hit[c * 5 + r]) keep.push(g[c * 5 + r]);
        var n = 5 - keep.length, nw = [];
        for (var i = 0; i < n; i++) { var f1 = rng(), f2 = rng(), f3 = rng(); nw.push(f1 < M.reP ? env(f3) : wpick(P.W, WT, f2)); }
        var col = nw.concat(keep); for (r = 0; r < 5; r++) g[c * 5 + r] = col[r];
        add.push(nw);
      }
      return add;
    }
    // uma rodada: devolve o registro completo para o cliente animar
    function spin(rng, M, st) {
      var g = gen(rng, M), sp = { g: g.slice(), t: [], w: 0 };
      while (st.tot < CAP) {
        var cls = clusters(g); if (!cls.length) break;
        var pw = 0; cls.forEach(function (x) { pw += x.p; });
        pw = Math.min(pw, CAP - st.tot); st.tot += pw; sp.w += pw;
        var add = tumble(g, cls, rng, M);
        sp.t.push({ c: cls, a: add });
      }
      var rings = 0, es = 0, vaults = 0;
      for (var i = 0; i < 30; i++) { if (g[i] === 10) rings++; else if (g[i] === 11) vaults++; else if (g[i] >= 100) es += g[i] - 100; }
      if (rings && es && st.tot < CAP) {
        var m = P.LAD[st.m], pc = Math.min(es * 100 * rings * m, CAP - st.tot);
        st.tot += pc; sp.w += pc; sp.k = { r: rings, e: es, m: m, p: pc };
        if (st.fs && st.m < P.LAD.length - 1) st.m++;
      }
      sp.v = vaults;
      return sp;
    }
    function round(rng, mode) {
      var st = { tot: 0, m: 0, fs: false }, out = { mode: mode, s: [], fs: 0 };
      var base = mode === "hunt" ? P.hunt : P.base;
      if (mode === "base" || mode === "hunt") {
        var sp = spin(rng, base, st); out.s.push(sp);
        if (sp.v < 3 || st.tot >= CAP) { out.tot = st.tot; out.cap = st.tot >= CAP; return out; }
      }
      st.fs = true; st.m = mode === "super" ? P.superM : 0;
      var left = P.fsN, done = 0; out.fs = out.s.length || 0; out.m0 = st.m;
      while (left > 0 && st.tot < CAP) {
        left--; done++;
        var f = spin(rng, mode === "super" && P.fsmS ? P.fsmS : P.fsm, st); out.s.push(f);
        if (f.v >= 3 && done + left < P.fsMax) left = Math.min(left + P.fsRe, P.fsMax - done);
      }
      out.tot = st.tot; out.cap = st.tot >= CAP; return out;
    }
    return { round: round, gen: gen, clusters: clusters };
  }
  // Parâmetros finais do Don Gatto (RTP alvo 96,5% em todos os modos; ganho máximo 5.000x)
  var P = {
    W: [15, 15, 14, 14, 10, 9, 7, 5, 3], q: 0.14,
    PAY: [
      [60, 80, 100, 130, 160, 200, 250, 330, 500, 650, 1300],
      [60, 80, 100, 130, 160, 200, 250, 330, 500, 650, 1300],
      [80, 100, 120, 160, 200, 240, 320, 400, 600, 800, 1600],
      [80, 100, 120, 160, 200, 240, 320, 400, 600, 800, 1600],
      [100, 130, 160, 200, 260, 320, 420, 530, 800, 1050, 2100],
      [130, 160, 200, 260, 330, 400, 530, 660, 1000, 1300, 2600],
      [200, 250, 300, 400, 500, 600, 800, 1000, 1500, 2000, 4000],
      [260, 330, 400, 530, 660, 800, 1050, 1300, 2000, 2600, 5300],
      [400, 500, 600, 800, 1000, 1200, 1600, 2000, 3000, 4000, 8000]],
    ENV: [[1, 300], [2, 250], [3, 180], [5, 120], [10, 80], [15, 30], [20, 20], [25, 12], [50, 6], [100, 2]],
    LAD: [1, 2, 3, 5, 10], superM: 3,
    base: { vp: 0.059, eP: 0.25, eMax: 3, rP: 0.084, reP: 0.02 },
    hunt: { vp: 0.1161, eP: 0.25, eMax: 3, rP: 0.084, reP: 0.02 },
    fsm: { vp: 0.04, eP: 0.65, eMax: 4, rP: 0.455, reP: 0.04 },
    fsmS: { vp: 0.04, eP: 0.65, eMax: 4, rP: 0.4635, reP: 0.04 },
    fsN: 10, fsRe: 5, fsMax: 50
  };
  var E = make(P);
  var api = { make: make, CAP: CAP, P: P, round: E.round, COST: { base: 1, hunt: 3, buy: 100, super: 300 } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GattoEngine = api;
})(typeof window !== "undefined" ? window : this);
