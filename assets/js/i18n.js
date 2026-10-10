/* ==========================================================================
   Tradução do site (es, pt, de, fr, tr, ja). O site é escrito em inglês; com outro
   idioma escolhido, este arquivo baixa só o dicionário daquele idioma
   (assets/dist/i18n-xx.<hash>.js, gerado por tools/bundle.mjs a partir de tools/i18n/)
   e troca os textos na tela à medida que aparecem (MutationObserver).
   Ordem da busca: frase exata → padrões com números/nomes → trechos conhecidos dentro do texto.
   Texto que não tem tradução continua em inglês. Nunca traduz: chat, nomes de usuário
   (elementos com translate="no" ou .notranslate), campos de texto e desenhos (SVG).
   ========================================================================== */
(function () {
  "use strict";
  var LANGS = [["en", "English"], ["es", "Español"], ["pt", "Português"], ["de", "Deutsch"], ["fr", "Français"], ["tr", "Türkçe"], ["ja", "日本語"]];
  var has = function (l) { return LANGS.some(function (x) { return x[0] === l; }); };
  var saved = null; try { saved = localStorage.getItem("rd_lang"); } catch (e) {}
  var nav = String(navigator.language || "en").slice(0, 2).toLowerCase();
  var lang = saved && has(saved) ? saved : has(nav) ? nav : "en";
  RD.LANGS = LANGS; RD.lang = lang;
  RD.setLang = function (l) { if (!has(l)) return; try { localStorage.setItem("rd_lang", l); } catch (e) {} location.reload(); };
  RD.t = function (s) { return s; };
  if (lang === "en" || RD.isAdminPage) return;

  var root = document.documentElement, dict = null, months = null, pats = [], phraseRe = null, done = new WeakMap();
  root.lang = lang; root.classList.add("i18n-wait");
  function show() { root.classList.remove("i18n-wait"); }
  setTimeout(show, 2500); // dicionário demorou: mostra em inglês mesmo

  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], monRe = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b(?=\s\d)/g;
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function core(t) {
    var r = dict[t]; if (r != null) return r;
    var m = t.match(/^([^A-Za-z]*)([\s\S]*?)([^A-Za-z]*)$/); // "$50,000 Leaderboard", "Balance $10.00"
    if (m && m[2] && m[2] !== t && dict[m[2]] != null) return m[1] + dict[m[2]] + m[3];
    var out = t, hit = false;
    for (var i = 0; i < pats.length; i++) {
      var p = pats[i];
      if (p[0].test(out)) { hit = true; out = out.replace(p[0], function () { var a = arguments; return p[1].replace(/\$(\d)/g, function (x, n) { var v = a[+n] || ""; return dict[v] != null ? dict[v] : v; }); }); }
    }
    if (dict[out] != null) return dict[out];
    if (phraseRe) out = out.replace(phraseRe, function (x, pre, k) { hit = true; return pre + dict[k]; });
    if (months && monRe.test(out)) { monRe.lastIndex = 0; out = out.replace(monRe, function (x) { hit = true; return months[MON.indexOf(x)]; }); }
    monRe.lastIndex = 0;
    return hit ? out : null;
  }
  function tr(s) {
    if (!s || !/[A-Za-z]/.test(s)) return null;
    var t = s.trim(), r = core(t);
    if (r == null || r === t) return null;
    return s.slice(0, s.indexOf(t)) + r + s.slice(s.indexOf(t) + t.length);
  }
  RD.t = function (s) { return dict ? tr(s) || s : s; };
  function skip(el) {
    for (var e = el; e && e !== document.body; e = e.parentNode) {
      if (e.nodeType !== 1) continue;
      var tag = e.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "svg" || tag === "SVG" || e.namespaceURI === "http://www.w3.org/2000/svg") return true;
      if (e.getAttribute("translate") === "no" || (e.classList && e.classList.contains("notranslate"))) return true;
    }
    return false;
  }
  function text(n) {
    if (done.get(n) === n.data) return;
    var r = tr(n.data); if (r == null) return;
    var p = n.parentNode; if (!p || skip(p)) return;
    if (p.tagName === "OPTION" && !p.hasAttribute("value")) p.setAttribute("value", n.data.trim()); // o valor enviado continua o original
    n.data = r; done.set(n, r);
  }
  var ATTR = ["placeholder", "title", "aria-label"];
  var NOPHRASE = { "on the": 1 }; // genéricos demais para trocar dentro de frases: só valem como texto exato
  RD.i18nDone = function (n) { return done.has(n); };
  function attrs(el) {
    var mine = el.__i18n || (el.__i18n = {});
    for (var i = 0; i < ATTR.length; i++) {
      var a = ATTR[i], v = el.getAttribute(a); if (!v || mine[a] === v) continue;
      var r = tr(v); if (r != null && !skip(el)) { mine[a] = r; el.setAttribute(a, r); }
    }
  }
  function walk(node) {
    if (node.nodeType === 3) return text(node);
    if (node.nodeType !== 1 || skip(node)) return;
    if (node.hasAttribute && (node.hasAttribute("placeholder") || node.hasAttribute("title") || node.hasAttribute("aria-label"))) attrs(node);
    var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null), x;
    while ((x = w.nextNode())) { if (x.nodeType === 3) text(x); else if (x.hasAttribute("placeholder") || x.hasAttribute("title") || x.hasAttribute("aria-label")) attrs(x); }
  }
  RD.i18nLoad = function (l, d, opt) {
    if (l !== lang || dict) return;
    dict = d; opt = opt || {}; months = opt.months || null;
    pats = (opt.pats || []).map(function (p) { return [new RegExp(p[0]), p[1]]; });
    /* trechos conhecidos dentro de textos maiores: só frases com espaço e 6+ letras, as maiores primeiro */
    var keys = Object.keys(d).filter(function (k) { return k.length >= 6 && /\s/.test(k.trim()) && d[k] !== k && !NOPHRASE[k]; }).sort(function (a, b) { return b.length - a.length; });
    if (keys.length) phraseRe = new RegExp("(^|[^A-Za-z])(" + keys.map(esc).join("|") + ")(?![A-Za-z])", "g");
    if (d[document.title]) document.title = d[document.title];
    walk(document.body);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === "characterData") text(m.target);
        else if (m.type === "attributes") attrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
    show();
  };
  var src = window.RD_I18N && window.RD_I18N[lang];
  if (!src) return show();
  var s = document.createElement("script"); s.src = src; s.onerror = show; document.head.appendChild(s);
})();
