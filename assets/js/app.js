/* ==========================================================================
   RDCasino — Site do jogador (SPA, rotas em hash: #/rota)
   Sem dados falsos: tudo que aparece vem de RD.db (store.js).
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ic = RD.ic, fmt = RD.fmt, esc = RD.esc, media = RD.media, db = RD.db;
  /* Lucro máximo por aposta: definido no admin (Configurações). 0 = sem limite. */
  function maxProfit() { return +RD.config.maxProfit || 0; }

  var state = { walletTab: "deposit", coin: "USDT", net: "TRC20", betsTab: "all" };
  function me() { return db.current(); }

  /* troca <span data-ic> pelo SVG mantendo as classes do span (o CSS depende delas) */
  function hydrateIcons(root) {
    $$("[data-ic]", root).forEach(function (el) {
      var cls = el.className, t = document.createElement("div"); t.innerHTML = ic(el.getAttribute("data-ic"));
      var svg = t.firstElementChild; if (!svg) return; if (cls) svg.setAttribute("class", ((svg.getAttribute("class") || "") + " " + cls).trim());
      el.replaceWith(svg);
    });
  }
  function gameOf(id) { return RD.games.filter(function (g) { return g.id === id; })[0]; }
  function initials(u) { return String(u || "?").slice(0, 2).toUpperCase(); }
  function errorBox(msg, extra) { return '<div class="notice form-error" style="background:var(--danger-soft);border-color:rgba(255,122,89,.3);color:var(--danger)">' + ic("alert", 16) + "<span>" + esc(msg) + (extra || "") + "</span></div>"; }
  function empty(title, text, cta) { return '<div class="empty"><h3>' + title + "</h3><p>" + text + "</p>" + (cta ? '<div style="margin-top:16px">' + cta + "</div>" : "") + "</div>"; }

  /* ---------- Sidebar ---------- */
  var NAV = [
    [{ route: "", label: "Lobby", icon: "home" }, { route: "casino/originals", label: "RD Originals", icon: "star" }, { route: "casino/slots", label: "Slots", icon: "cherry" }, { route: "casino/live", label: "Live Casino", icon: "play" }, { route: "casino/gameshows", label: "Game Shows", icon: "tv" }],
    [{ route: "promotions", label: "Promotions", icon: "gift" }, { route: "vip", label: "VIP Club", icon: "crown" }, { route: "leaderboard", label: "Leaderboard", icon: "trophy" }],
    [{ route: "affiliate", label: "Affiliate", icon: "link" }, { route: "fairness", label: "Provably Fair", icon: "shield" }, { route: "responsible", label: "Responsible Gaming", icon: "help" }, { action: "open-support", label: "Live Support", icon: "headset" }]
  ];
  function renderSidebar() {
    var h = vipWidget() + '<a class="sb-promo" href="#/leaderboard" title="Monthly leaderboard">' + ic("trophy", 18) + '<span class="eyebrow">Monthly leaderboard</span><strong>' + fmt.usd(RD.config.leaderboardPrize, { dec: 0 }) + '</strong><small>Ends in <span data-countdown-short></span></small></a>';
    NAV.forEach(function (box) {
      h += '<div class="sb-box">' + box.map(function (n) {
        if (n.action) return '<a class="sb-link" href="#" data-action="' + n.action + '" title="' + n.label + '">' + ic(n.icon) + "<span>" + n.label + '</span><span class="badge badge-brand hidden" data-sup-badge></span></a>';
        return '<a class="sb-link" href="#/' + n.route + '" data-route="' + n.route + '" title="' + n.label + '">' + ic(n.icon) + "<span>" + n.label + "</span>" + (n.badge ? '<span class="badge badge-brand">' + n.badge + "</span>" : "") + "</a>";
      }).join("") + "</div>";
    });
    $("#sb-nav").innerHTML = h; if (typeof supBadge === "function" && $("#sup-fab")) supBadge();
  }
  function markActive(path) {
    var parts = path.split("/"), base = parts[0] === "casino" ? parts.slice(0, 2).join("/") : parts[0];
    if (parts[0] === "game") { var g = gameOf(parts[1]); base = g ? "casino/" + g.cat : ""; }
    $$(".sb-link").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-route") === base); });
    $$(".sb-switch a").forEach(function (a) { a.classList.toggle("active", (a.getAttribute("data-switch") === "sports") === (base === "sports")); });
    $$(".bottom-nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#/" + path); });
  }

  /* ---------- Header ---------- */
  /* Saldo mostrado = saldo real menos os prêmios de apostas cuja animação ainda não terminou.
     Assim a aposta sai na hora e o prêmio só "entra" quando a bolinha cai / a roda para. */
  var inFlight = {};
  /* Dono/equipe (lista vem do servidor) ganha a tag de diamante no lugar do nível */
  function isStaff(name) { return !!name && (RD.staff || []).some(function (x) { return x.toLowerCase() === String(name).toLowerCase(); }); }
  function uBadge(name, wagered, size) { return isStaff(name) ? RD.art.ownerBadge(size) : RD.art.tierBadge(db.tierOf(wagered || 0), size); }
  function shownBal(u) { var t = 0; for (var k in inFlight) t += inFlight[k]; return Math.round((u.balance - t) * 100) / 100; }
  function hold(b) { if (b && !b.error && b.payout > 0) inFlight[b.id] = b.payout; renderHeader(); }
  function release(b) {
    if (!b || !(b.id in inFlight)) return; delete inFlight[b.id];
    var el = $("#hdr-bal"); if (el && b.payout > 0) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  }
  /* Saldo por moeda (estilo Razed): cada cripto tem o seu saldo; as apostas usam a moeda ativa.
     Os valores ficam em dólar no servidor; aqui mostramos em unidades da moeda ou em fiat (USD, BRL, ARS...). */
  var disp = { cur: "USD", fiat: true, hideZero: false };
  try { var dj = JSON.parse(localStorage.getItem("rd_cur") || "null"); if (dj && dj.cur) { disp.cur = dj.cur; disp.fiat = dj.fiat !== false; disp.hideZero = !!dj.hideZero; } } catch (e) {}
  function saveDisp() { try { localStorage.setItem("rd_cur", JSON.stringify(disp)); } catch (e) {} }
  function fxRate(c) { return c === "USD" ? 1 : RD.prices["FX:" + c] || 0; }
  function curInfo(c) { return RD.fiats.filter(function (f) { return f[0] === c; })[0] || RD.fiats[0]; }
  function inCur(usd, c) {
    var r = fxRate(c); if (!r) { c = "USD"; r = 1; }
    var f = curInfo(c), dec = f[3] === 0 ? 0 : 2;
    return f[1] + (usd * r).toLocaleString(f[4] || "en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  /* Valores do painel do jogo na moeda de exibição (a mesma do topo). O servidor continua em dólar:
     o que o jogador digita é convertido para USD antes da aposta. */
  function dispRate() { return fxRate(disp.cur) || 1; }
  function curSym() { return fxRate(disp.cur) ? curInfo(disp.cur)[1] : "$"; }
  function curDec() { return fxRate(disp.cur) && curInfo(disp.cur)[3] === 0 ? 0 : 2; }
  function money(usd, opts) {
    opts = opts || {}; var v = (usd || 0) * dispRate(), c = fxRate(disp.cur) ? disp.cur : "USD", f = curInfo(c), dec = opts.dec === 0 || curDec() === 0 ? 0 : 2;
    return (v < 0 ? "-" : opts.sign && v > 0 ? "+" : "") + f[1] + Math.abs(v).toLocaleString(f[4] || "en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function amtIn(usd) { return ((usd || 0) * dispRate()).toFixed(curDec()); }
  function amtOut(v) { return Math.round((parseFloat(v) || 0) / dispRate() * 100) / 100; }
  function coinDec(c) { var p = RD.prices[c] || 1; return p >= 1000 ? 8 : p >= 50 ? 6 : p >= 5 ? 4 : 2; }
  function inCoin(usd, c) { var p = RD.prices[c] || 1; return (usd / p).toLocaleString("en-US", { minimumFractionDigits: coinDec(c), maximumFractionDigits: coinDec(c) }); }
  function showAmt(usd, c) { return disp.fiat ? inCur(usd, disp.cur) : inCoin(usd, c); }
  function coinDot(c) { return '<span class="coin-dot" style="background:' + (COIN_COLORS[c] || "#666") + '">' + (c === "USDT" ? "₮" : c === "BTC" ? "₿" : c === "ETH" ? "Ξ" : c[0]) + "</span>"; }
  function walletOf(u) { var w = {}; if (u.wallet) for (var k in u.wallet) w[k] = +u.wallet[k] || 0; w[u.coin || "USDT"] = u.balance; return w; }
  var BAL_IC = '<svg viewBox="0 0 24 24" class="bal-ic"><circle cx="9" cy="9" r="6.5" fill="#22d3ee"/><circle cx="9" cy="9" r="4.2" fill="none" stroke="#0b3d91" stroke-width="1.4"/><circle cx="15" cy="15" r="6.5" fill="#1f8fff" stroke="#0d1a30" stroke-width="1.5"/><path d="M15 11.5v7M13 13.2h3a1.3 1.3 0 0 1 0 2.6h-2a1.3 1.3 0 0 0 0 2.6h3" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>';
  function paintBal(u) {
    var v = shownBal(u), el = $("#hdr-bal"), tag = $("#hdr-coin");
    if (!fxRate(disp.cur)) disp.cur = "USD";
    el.textContent = inCur(v, disp.cur);
    if (tag && !tag.firstChild) tag.innerHTML = BAL_IC;
    if (!$("#bal-menu").classList.contains("hidden")) renderBalMenu();
  }
  /* um saldo só (como na Shuffle), mostrado na moeda que o jogador escolher */
  function renderBalMenu() {
    var u = me(); if (!u) return;
    $("#bal-menu").innerHTML = '<div class="bm-one">' + BAL_IC + '<b class="num">' + inCur(shownBal(u), disp.cur) + "</b></div>" +
      '<div class="bm-title">Display currency</div><div class="bm-cur"><select class="select" data-disp-cur>' + RD.fiats.filter(function (f) { return fxRate(f[0]); }).map(function (f) { return '<option value="' + f[0] + '"' + (f[0] === disp.cur ? " selected" : "") + ">" + f[0] + " · " + f[2] + "</option>"; }).join("") + "</select></div>";
  }
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-txcat]"); if (!b) return; state.txCat = b.getAttribute("data-txcat"); route(true); });
  document.addEventListener("input", function (e) {
    if (e.target.id !== "tx-q") return; var v = e.target.value.trim().toLowerCase(), shown = 0;
    $$(".tx-row").forEach(function (r) { var ok = !v || r.getAttribute("data-q").indexOf(v) > -1; r.classList.toggle("hidden", !ok); if (ok) shown++; });
    var none = $(".tx-none"); if (none) none.classList.toggle("hidden", shown > 0);
  });
  document.addEventListener("change", function (e) {
    var t = e.target; if (!t.hasAttribute) return;
    if (t.hasAttribute("data-disp-fiat")) { disp.fiat = t.checked; saveDisp(); renderHeader(); renderBalMenu(); }
    else if (t.hasAttribute("data-disp-zero")) { disp.hideZero = t.checked; saveDisp(); renderBalMenu(); }
    else if (t.hasAttribute("data-disp-cur")) {
      var keep = $$(".ogx-input input").map(function (x) { return [x, amtOut(x.value)]; });
      disp.cur = t.value; saveDisp(); renderHeader(); renderBalMenu();
      keep.forEach(function (k) { k[0].value = amtIn(k[1]); }); $$(".ogx-input .cur").forEach(function (x) { x.textContent = curSym(); });
      if (typeof ogRefresh === "function") ogRefresh();
    }
  });
  RD.onPrices = function () { var u = me(); if (u) paintBal(u); };
  function renderHeader() {
    var u = me();
    $("#hdr-guest").classList.toggle("hidden", !!u);
    $("#hdr-user").classList.toggle("hidden", !u);
    $("#hdr-wallet").classList.toggle("hidden", !u);
    if (!u) return;
    paintBal(u);
    if (typeof vipDot === "function") vipDot();
    var t = db.tierOf(u.wagered);
    $("#user-menu").innerHTML =
      '<div class="menu-head row" style="gap:10px">' + uBadge(u.username, u.wagered, 30) + '<div><strong>' + esc(u.username) + '</strong><small class="faint">' + (isStaff(u.username) ? "Owner" : t ? t.name : "Unranked") + "</small></div></div>" +
      '<button data-open="wallet">' + ic("wallet", 16) + "Wallet</button>" +
      '<a href="#/account">' + ic("user", 16) + "Account & verification</a>" +
      '<a href="#/account/bets">' + ic("chart", 16) + "My bets</a>" +
      '<a href="#/vip">' + ic("crown", 16) + "VIP Club</a>" +
      '<a href="#/affiliate">' + ic("link", 16) + "Affiliate</a>" +
      '<button class="danger" data-action="logout">' + ic("logout", 16) + "Sign out</button>";
  }

  /* ---------- Modals & drawers ---------- */
  function openModal(id) { closeAll(); var m = $("#modal-" + id); if (m) { m.classList.add("open"); document.body.style.overflow = "hidden"; } }
  function openGeneric(html) { $("#modal-generic-box").innerHTML = html; openModal("generic"); }
  function closeAll() {
    $$(".overlay.open").forEach(function (m) { m.classList.remove("open"); });
    $$(".drawer.open").forEach(function (d) { d.classList.remove("open"); });
    $("#user-menu").classList.add("hidden");
    document.body.classList.remove("sb-open");
    document.body.style.overflow = "";
  }
  function openAuth(tab) {
    openModal("auth");
    $$("#auth-tabs button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-auth") === tab); });
    $("#form-login").classList.toggle("hidden", tab !== "login");
    $("#form-register").classList.toggle("hidden", tab !== "register");
    $("#login-error").innerHTML = ""; $("#reg-error").innerHTML = "";
  }
  function needLogin() { if (me()) return false; openAuth("register"); return true; }
  function fillCountries() {
    var list = ["Argentina", "Austria", "Brazil", "Canada", "Chile", "Colombia", "Finland", "Germany", "India", "Ireland", "Japan", "Mexico", "New Zealand", "Norway", "Peru", "Portugal", "Turkey", "United Arab Emirates", "United Kingdom", "United States", "Other"];
    $("#reg-country").innerHTML = '<option value="">Select…</option>' + list.map(function (c) { return "<option>" + c + "</option>"; }).join("");
  }

  /* ---------- Wallet ---------- */
  function coin() { return RD.wallet.coins.filter(function (c) { return c.sym === state.coin; })[0]; }
  /* Tip: manda parte do saldo para outro jogador (chega na hora) */
  function tipForm(u) {
    return '<div class="tip-box"><div id="tip-msg"></div>' +
      '<div class="field"><label>Recipient username</label><input class="input" id="tip-to" placeholder="username" autocomplete="off" value="' + esc(state.tipTo || "") + '"></div>' +
      '<div class="field"><label>Amount (USD)</label><div class="input-group"><input type="number" min="1" step="0.01" id="tip-amt" placeholder="Min. $1"><button class="btn btn-ghost btn-sm" data-action="tip-max">Max</button></div>' +
      '<div class="tip-quick">' + [1, 5, 10, 25, 50].map(function (v) { return '<button class="chip" data-action="tip-set" data-v="' + v + '">$' + v + "</button>"; }).join("") + "</div>" +
      '<span class="hint">Available: ' + fmt.usd(u.balance) + "</span></div>" +
      '<label class="check tip-pub"><input type="checkbox" id="tip-pub" checked><span>Show in chat</span></label>' +
      '<button class="btn btn-primary btn-block btn-lg" data-action="tip">Send tip</button></div>';
  }
  /* Caixa no modo real: endereços da casa (cadastrados no banco) e pedido com hash da transação */
  var COIN_COLORS = { USDT: "#26a17b", USDC: "#2775ca", BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", LTC: "#345d9d", DOGE: "#c2a633", TRX: "#ff060a", BNB: "#f3ba2f" };
  function renderLiveWallet() {
    var u = me(), ws = db.wallets(), coinsL = [];
    ws.forEach(function (w) { if (coinsL.indexOf(w.coin) < 0) coinsL.push(w.coin); });
    if (coinsL.indexOf(state.coin) < 0) state.coin = coinsL[0];
    var nets = ws.filter(function (w) { return w.coin === state.coin; });
    var w = nets.filter(function (x) { return x.network === state.net; })[0] || nets[0]; if (w) state.net = w.network;
    $$("#wallet-tabs .tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-wtab") === state.walletTab); });
    if (state.walletTab === "tip") { $("#wallet-body").innerHTML = tipForm(u); hydrateIcons($("#wallet-body")); return; }
    if (!w) { $("#wallet-body").innerHTML = empty("Wallet loading", "Try again in a moment."); return; }
    var stable = /^(USDT|USDC)$/.test(w.coin), min = Math.max(+w.min_deposit || 0, RD.config.minDeposit || 0);
    var h = '<div class="coin-select">' + coinsL.map(function (x) { return '<button class="coin-opt' + (x === state.coin ? " active" : "") + '" data-coin="' + x + '"><span class="coin-dot" style="background:' + (COIN_COLORS[x] || "#666") + '">' + x[0] + "</span>" + x + "</button>"; }).join("") + "</div>" +
      '<div class="field"><label>Network</label><div class="net-row">' + nets.map(function (x) { return '<button class="chip' + (x.network === state.net ? " active" : "") + '" data-net="' + esc(x.network) + '">' + esc(x.network) + "</button>"; }).join("") + "</div></div>";
    if (state.walletTab === "deposit") {
      h += '<div class="dep-box"><div class="notice" style="margin-bottom:12px;border-color:rgba(255,200,92,.35);background:var(--gold-soft)">' + ic("alert", 16) + "<span>Send only <b>" + esc(w.coin) + "</b> on the <b>" + esc(w.network) + "</b> network. Other coins or networks may be lost.</span></div>" +
        '<div class="field"><label>Deposit address</label><div class="addr-row"><code class="addr">' + esc(w.address) + '</code><button class="btn btn-secondary btn-sm" data-copy="' + esc(w.address) + '">' + ic("copy", 14) + "Copy</button></div></div>" +
        (w.memo ? '<div class="field"><label>Memo / tag (required)</label><div class="addr-row"><code class="addr">' + esc(w.memo) + '</code><button class="btn btn-secondary btn-sm" data-copy="' + esc(w.memo) + '">' + ic("copy", 14) + "Copy</button></div></div>" : "") +
        '<p class="faint" style="font-size:12.5px;margin:-4px 0 4px">Minimum deposit: ' + fmt.usd(min, { dec: 0 }) + (stable ? "" : " in " + esc(w.coin)) + "</p></div>";
    } else {
      h += '<div id="wd-msg"></div><div class="field"><label>Your ' + esc(w.coin) + " address (" + esc(w.network) + ')</label><input class="input" id="wd-addr" placeholder="Paste your ' + esc(w.coin) + ' address"></div>' +
        '<div class="field"><label>Amount (USD)</label><div class="input-group"><input type="number" min="0" step="0.01" placeholder="0.00" id="wd-amt"><button class="btn btn-ghost btn-sm" data-action="wd-max">Max</button></div><span class="hint">Available: ' + fmt.usd(u.balance) + "</span></div>" +
        '<button class="btn btn-primary btn-block btn-lg" data-action="withdraw">Request withdrawal</button>';
    }
    $("#wallet-body").innerHTML = h; hydrateIcons($("#wallet-body"));
  }
  function renderWallet() {
    if (RD.live) return renderLiveWallet();
    var u = me(), c = coin();
    if (c.nets.indexOf(state.net) < 0) state.net = c.nets[0];
    $$("#wallet-tabs .tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-wtab") === state.walletTab); });
    var coins = '<div class="coin-select">' + RD.wallet.coins.map(function (x) {
      return '<button class="coin-opt' + (x.sym === state.coin ? " active" : "") + '" data-coin="' + x.sym + '"><span class="coin-dot" style="background:' + x.color + '">' + x.sym[0] + "</span>" + x.sym + "</button>";
    }).join("") + "</div>";
    var nets = '<div class="field"><label>Network</label><div class="net-row">' + c.nets.map(function (n) { return '<button class="chip' + (n === state.net ? " active" : "") + '" data-net="' + n + '">' + n + "</button>"; }).join("") + "</div></div>";
    var h;
    if (state.walletTab === "deposit") {
      h = coins + nets +
        '<div class="notice info" style="margin-bottom:16px">' + ic("help", 16) + "<span>Your personal " + c.sym + " (" + state.net + ") deposit address appears here once the crypto payment processor is connected.</span></div>" +
        '<div class="field"><label>Test mode: simulate a confirmed deposit</label><div class="input-group"><input type="number" min="' + RD.config.minDeposit + '" step="0.01" placeholder="Min. $' + RD.config.minDeposit + '" id="dep-amt"><button class="btn btn-primary btn-sm" data-action="sim-deposit">Deposit</button></div><span class="hint">Minimum deposit: $' + RD.config.minDeposit + '. Credits your balance instantly, as the processor would after the blockchain confirms.</span></div><div id="dep-msg"></div>';
    } else if (state.walletTab === "withdraw") {
      h = coins + nets + '<div id="wd-msg"></div>' +
        '<div class="field"><label>Destination address</label><input class="input" id="wd-addr" placeholder="Paste your ' + c.sym + ' address"></div>' +
        '<div class="field"><label>Amount (USD)</label><div class="input-group"><input type="number" min="0" step="0.01" placeholder="0.00" id="wd-amt"><button class="btn btn-ghost btn-sm" data-action="wd-max">Max</button></div><span class="hint">Available: ' + fmt.usd(u.balance) + "</span></div>" +
        '<button class="btn btn-primary btn-block btn-lg" data-action="withdraw">Request withdrawal</button>' +
        '<div class="wallet-foot">' + ic("lock", 14) + "Reviewed by our team. Above " + fmt.usd(RD.config.kycWithdrawLimit, { dec: 0 }) + " requires identity verification.</div>";
    } else {
      h = tipForm(u);
    }
    $("#wallet-body").innerHTML = h;
  }

  /* ---------- Fragments ---------- */
  function gameCard(g) {
    var tag = g.tag === "hot" ? '<span class="badge badge-danger g-tag">Hot</span>' : g.tag === "new" ? '<span class="badge badge-brand g-tag">New</span>' : "";
    return '<a class="game" href="#/game/' + g.id + '">' + tag +
      media(g, "", '<span class="gf-name">' + esc(g.name) + '</span><span class="gf-prov">' + esc(g.provider) + "</span>") +
      '<div class="game-meta">' + gameMeta(g) + "</div></a>";
  }
  /* Embaixo da capa: jogadores reais nos últimos 15 min (das apostas recentes); sem ninguém, o RTP */
  var playCache = { t: 0, map: {} };
  function playingMap() {
    var now = Date.now();
    if (now - playCache.t > 5000) {
      var m = {}, cut = now - 15 * 60e3;
      (db.recentBets ? db.recentBets(2000) : []).forEach(function (b) { if (new Date(b.date).getTime() < cut) return; (m[b.game] = m[b.game] || {})[b.user] = 1; });
      playCache = { t: now, map: m };
    }
    return playCache.map;
  }
  function gameMeta(g) {
    if (!g.playable) return esc(g.provider);
    var n = Object.keys(playingMap()[g.id] || {}).length;
    return n ? '<span class="dot"></span>' + n + " playing" : '<span class="g-rtp">RTP ' + g.rtp + "%</span>";
  }
  function gamesOf(cat) { return RD.games.filter(function (g) { return g.enabled && (cat === "all" || g.cat === cat); }); }
  /* Fichas para escolher o valor (Roleta e Baccarat) */
  var CHIPS = [[0.1, "#8a93a6"], [1, "#3b82f6"], [5, "#e11d48"], [10, "#16a34a"], [25, "#f59e0b"], [100, "#1f1a24"], [500, "#8b5cf6"]];
  function chipColor(v) { var c = CHIPS[0][1]; CHIPS.forEach(function (x) { if (v >= x[0] - 0.001) c = x[1]; }); return c; }
  function chipRack() { return '<div class="chip-rack">' + CHIPS.map(function (c) { return '<button type="button" class="chip-r" data-chip="' + c[0] + '" style="--cc:' + c[1] + '"><span>' + (c[0] < 1 ? "0.1" : c[0]) + "</span></button>"; }).join("") + "</div>"; }
  /* Escada de multiplicadores (Door, Soccer, Rock Paper Scissors): um cartão por etapa */
  function ladderWin(mults, done, live) { var start = Math.max(0, Math.min(done - 1, mults.length - 7)); return mults.slice(start, start + 7).map(function (m, k) { var i = start + k; return ladderStep(i + 1, m, i < done ? "done" : i === done && live ? "next" : ""); }).join(""); }
  function ladderStep(n, m, cls) { return '<span class="lstep' + (cls ? " " + cls : "") + '"><i>' + (cls === "done" ? '<svg viewBox="0 0 24 24" width="11" height="11"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : n) + "</i><b>" + (m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + "k" : m.toFixed(2)) + "×</b></span>"; }
  function sectionHead(title, icon, link) {
    return '<div class="section-head"><h2>' + (icon ? ic(icon, 18) : "") + title + "</h2>" + (link ? '<a class="see-all" href="' + link + '">View all' + ic("chevronRight") + "</a>" : "") + "</div>";
  }
  function catTabs(cur) {
    var icons = { all: "home", originals: "star", slots: "cherry", live: "play", gameshows: "tv" };
    return '<div class="pill-tabs">' + RD.categories.map(function (c) { return '<a class="' + (c.id === cur ? "active" : "") + '" href="#/casino/' + c.id + '">' + ic(icons[c.id]) + c.label + "</a>"; }).join("") + "</div>";
  }
  function betRow(b) {
    var g = gameOf(b.game) || { name: b.game };
    return '<tr><td><a href="#/game/' + b.game + '" class="row" style="gap:10px">' + media(g, "thumb-28", "") + esc(g.name) + '</a></td><td class="hide-sm-cell">' + esc(b.user) + '</td><td class="right num">' + fmt.usd(b.amount) + '</td><td class="right num">' + b.multiplier.toFixed(2) + 'x</td><td class="right num ' + (b.payout > 0 ? "pos" : "faint") + '">' + (b.payout > 0 ? "+" + fmt.usd(b.payout - b.amount) : "-" + fmt.usd(b.amount)) + "</td></tr>";
  }
  function betsTable(list, emptyMsg) {
    if (!list.length) return empty("No bets yet", emptyMsg || "Bets appear here in real time as soon as someone plays.", '<a class="btn btn-primary btn-sm" href="#/game/dice">Play Dice</a>');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Game</th><th>Player</th><th class="right">Bet</th><th class="right">Multiplier</th><th class="right">Profit</th></tr></thead><tbody>' + list.map(betRow).join("") + "</tbody></table></div>";
  }
  function feedList() {
    var u = me(), all = db.recentBets(200);
    if (state.betsTab === "mine") return u ? db.betsOf(u.id).slice(0, 10) : [];
    if (state.betsTab === "high") return all.filter(function (b) { return b.amount >= 100; }).slice(0, 10);
    return all.slice(0, 10);
  }
  function renderFeed() {
    var box = $("#feed"); if (!box) return;
    box.innerHTML = state.betsTab === "mine" && !me() ? empty("Sign in to see your bets", "", '<button class="btn btn-primary btn-sm" data-open="login">Sign in</button>') : betsTable(feedList());
    $$("[data-btab]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-btab") === state.betsTab); });
  }
  function renderTicker() {
    var t = $("#ticker"); if (!t) return;
    var wins = db.recentBets(200).filter(function (b) { return b.payout > b.amount; }).slice(0, 15);
    if (!wins.length) { t.innerHTML = '<div class="ticker-empty">No wins yet today. The first one shows up here.</div>'; return; }
    var chips = wins.map(function (b) { var g = gameOf(b.game); return '<a class="win-chip" href="#/game/' + b.game + '">' + media(g, "", "") + "<div><small>" + esc(b.user) + "</small><strong>" + fmt.usd(b.payout) + "</strong></div></a>"; }).join("");
    t.innerHTML = '<div class="ticker-inner' + (wins.length < 6 ? " static" : "") + '">' + chips + (wins.length < 6 ? "" : chips) + "</div>";
  }

  /* ---------- Pages ---------- */
  var pages = {};

  pages.home = function () {
    return '<div class="container">' +
      '<div class="promo-row">' + RD.banners.map(function (b) {
        return '<a class="promo-card" href="#/' + b.route + '">' + media(b, "", "") + '<div class="shade"></div><div class="copy"><span class="tag">' + esc(b.tag) + "</span><h2>" + esc(b.title) + "</h2><p>" + esc(b.sub) + '</p><span class="btn btn-sm">' + esc(b.cta) + "</span></div></a>";
      }).join("") + "</div>" +
      '<div class="ticker"><div class="ticker-label"><span class="live-dot"></span>LIVE WINS</div><div class="ticker-track" id="ticker"></div></div>' +
      '<div class="section"><div class="input-search" style="margin-bottom:16px">' + ic("search") + '<input class="input" id="home-search" type="search" placeholder="Search your game" style="height:46px;background:var(--bg-2);border-color:transparent"></div>' + catTabs("all") + '<div id="search-results"></div></div>' +
      '<div id="home-rows">' +
      '<div class="section">' + sectionHead("RD Originals", "star", "#/casino/originals") + '<div class="game-row">' + gamesOf("originals").map(gameCard).join("") + "</div></div>" +
      '<div class="section">' + sectionHead("Slots", "cherry", "#/casino/slots") + '<div class="game-row">' + gamesOf("slots").map(gameCard).join("") + "</div></div>" +
      '<div class="section">' + sectionHead("Live Casino", "play", "#/casino/live") + '<div class="game-row">' + gamesOf("live").concat(gamesOf("gameshows")).map(gameCard).join("") + "</div></div></div>" +
      '<div class="section"><div class="section-head"><div class="pill-tabs"><button data-btab="all">All bets</button><button data-btab="high">High rollers</button><button data-btab="mine">My bets</button></div></div><div class="card bets-card" id="feed"></div></div>' +
      "</div>";
  };
  pages.home.after = function () {
    renderTicker(); renderFeed();
    var inp = $("#home-search");
    inp.addEventListener("input", function () {
      var q = inp.value.trim().toLowerCase();
      $("#home-rows").classList.toggle("hidden", q.length > 1);
      $("#search-results").innerHTML = q.length > 1 ? '<div class="section"><div class="game-grid">' + (RD.games.filter(function (g) { return g.enabled && (g.name + g.provider).toLowerCase().indexOf(q) > -1; }).map(gameCard).join("") || '<div class="empty">No games found.</div>') + "</div></div>" : "";
    });
  };

  pages.casino = function (cat) {
    cat = cat || "all";
    var c = RD.categories.filter(function (x) { return x.id === cat; })[0] || RD.categories[0];
    return '<div class="container"><div class="page-head"><h1>' + c.label + "</h1></div>" + catTabs(cat) +
      '<div class="game-grid" style="margin-top:20px">' + gamesOf(cat).map(gameCard).join("") + "</div></div>";
  };

  /* ---------- Jogos ---------- */
  pages.game = function (id) {
    var g = gameOf(id);
    if (!g || !g.enabled) return pages.notfound();
    if (g.playable) return originalPage(g);
    return '<div class="container">' +
      '<div class="game-frame">' + media(g, "", "") + '<div class="game-frame-cta"><h2>' + esc(g.name) + '</h2><p class="muted">' + esc(g.provider) + '</p><span class="badge">Coming soon</span>' +
      '<p class="muted" style="max-width:420px">' + (g.provider === "RD Originals" ? "This RD Original is in development. Try Dice, Mines or Chicken in the meantime." : "Third-party games go live once the game aggregator is integrated.") + '</p><a class="btn btn-primary" href="#/game/dice">Play Dice now</a></div></div>' +
      '<div class="section">' + sectionHead("More like this", "", "#/casino/" + g.cat) + '<div class="game-row">' + gamesOf(g.cat).filter(function (x) { return x.id !== g.id; }).map(gameCard).join("") + "</div></div></div>";
  };
  pages.game.after = function (id) { var g = gameOf(id); if (g && g.playable) bindOriginal(g); };

  /* ==========================================================================
     RD Originals — moldura compartilhada (padrão Shuffle/Rainbet) + 6 jogos.
     Dice, Limbo, Plinko e Crash aceitam modo Auto; Mines e Hi-Lo são por etapas.
     ========================================================================== */
  var ogPrefs = (function () { try { return JSON.parse(localStorage.getItem("rd_og_prefs")) || {}; } catch (e) { return {}; } })();
  function savePrefs() { try { localStorage.setItem("rd_og_prefs", JSON.stringify(ogPrefs)); } catch (e) {} }
  var session = {};
  function sess(gid) { return session[gid] = session[gid] || { profit: 0, wagered: 0, wins: 0, losses: 0, series: [0] }; }
  var ogKeys = null, ogTabRefresh = null;
  document.addEventListener("keydown", function (e) {
    if (!ogKeys || !ogPrefs.hotkeys || !$("#og-bet")) return;
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); ogKeys.bet(); }
    if (k === "s") ogKeys.half();
    if (k === "d") ogKeys.double();
  });

  /* ---------- Provably fair ---------- */
  function hexOf(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function hmac(key, msg) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      .then(function (k) { return crypto.subtle.sign("HMAC", k, enc.encode(msg)); });
  }
  function sha256(s) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(hexOf); }
  function floatFrom(buf) { var b = new Uint8Array(buf); return b[0] / 256 + b[1] / 65536 + b[2] / 16777216 + b[3] / 4294967296; }
  function outcome(game, f) { return game === "dice" ? Math.floor(f * 10001) / 100 : Math.max(1, Math.floor((0.98 / Math.max(f, 1e-8)) * 100) / 100); }
  /* Vários números por aposta: HMAC(server, client:nonce:cursor), 8 números por cursor */
  function floats(server, client, nonce, count) {
    var ps = [];
    for (var r = 0; r < Math.ceil(count / 8); r++) ps.push(hmac(server, client + ":" + nonce + ":" + r));
    return Promise.all(ps).then(function (bufs) {
      var out = [];
      bufs.forEach(function (buf) { var b = new Uint8Array(buf); for (var i = 0; i < 32; i += 4) out.push(b[i] / 256 + b[i + 1] / 65536 + b[i + 2] / 16777216 + b[i + 3] / 4294967296); });
      return out.slice(0, count);
    });
  }
  function minesFrom(fs, m) { var a = []; for (var i = 0; i < 25; i++) a.push(i); for (var j = 0; j < 24; j++) { var k = j + Math.floor(fs[j] * (25 - j)), t = a[j]; a[j] = a[k]; a[k] = t; } return a.slice(0, m); }
  function cardFrom(f) { var i = Math.floor(f * 52); return { rank: (i % 13) + 1, suit: Math.floor(i / 13) }; }
  RD.fair = { hmac: hmac, sha256: sha256, floatFrom: floatFrom, outcome: outcome, floats: floats, minesFrom: minesFrom, cardFrom: cardFrom };
  /* Aposta de um clique: pega os números sorteados e devolve place() para gravar.
     Modo demonstração: sorteia aqui com a seed local.
     Modo real: o servidor sorteia, calcula e grava antes (db.playBet); place()
     só aplica o resultado que veio do servidor. */
  /* Rodada (Mines, Tower...): modo real começa no servidor; demonstração começa aqui */
  function rStart(u, G, a, state, params) { return RD.live ? db.roundStart(G, a, params || state) : Promise.resolve(db.startRound(u.id, G, a, state)); }
  function roll(u, game, amount, params, count, single) {
    if (db.playBet) return db.playBet(game, amount, params).then(function (r) {
      if (r.error) { var z = []; for (var i = 0; i < count; i++) z.push(0); return { fs: z, nonce: 0, client: "", place: function () { return { error: r.error }; } }; }
      return r;
    });
    var s = db.reserve(u.id);
    var p = single ? hmac(s.server, s.client + ":" + s.nonce).then(function (buf) { return [floatFrom(buf)]; }) : floats(s.server, s.client, s.nonce, count);
    return p.then(function (fs) { return { fs: fs, nonce: s.nonce, client: s.client, place: function (mult, win, detail) { return db.placeBet(u.id, game, amount, mult, win, detail); } }; });
  }

  /* ---------- Tabelas e fórmulas ---------- */
  /* Plinko: mesmo formato das tabelas da Stake, calibradas para RTP 98% (nunca acima) */
  var PLINKO = {
    8: { low: [5.5, 1.95, 1.1, 1, 0.5, 1, 1.1, 1.95, 5.5], medium: [13, 2.85, 1.3, 0.7, 0.4, 0.7, 1.3, 2.85, 13], high: [29, 4, 1.45, 0.3, 0.2, 0.3, 1.45, 4, 29] },
    9: { low: [5.3, 1.75, 1.6, 1, 0.7, 0.7, 1, 1.6, 1.75, 5.3], medium: [15.5, 3.95, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 3.95, 15.5], high: [42.5, 6.75, 2, 0.6, 0.2, 0.2, 0.6, 2, 6.75, 42.5] },
    10: { low: [8.75, 2.5, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 2.5, 8.75], medium: [22, 4.75, 1.95, 1.4, 0.6, 0.4, 0.6, 1.4, 1.95, 4.75, 22], high: [76, 9.45, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 9.45, 76] },
    11: { low: [8, 2.85, 1.9, 1.25, 1, 0.7, 0.7, 1, 1.25, 1.9, 2.85, 8], medium: [19, 6, 2.9, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 2.9, 6, 19], high: [108, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 108] },
    12: { low: [10, 2.7, 1.35, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.35, 2.7, 10], medium: [32.5, 11, 3.7, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 3.7, 11, 32.5], high: [169, 23, 7.95, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 7.95, 23, 169] },
    13: { low: [8.1, 3.6, 3, 1.9, 1.15, 0.9, 0.7, 0.7, 0.9, 1.15, 1.9, 3, 3.6, 8.1], medium: [38, 13, 6, 3, 1.25, 0.7, 0.4, 0.4, 0.7, 1.25, 3, 6, 13, 38], high: [257, 36, 11, 3.9, 1, 0.2, 0.2, 0.2, 0.2, 1, 3.9, 11, 36, 257] },
    14: { low: [7.05, 4, 1.8, 1.2, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.2, 1.8, 4, 7.05], medium: [52.5, 9.9, 6.95, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 6.95, 9.9, 52.5], high: [414, 52, 18, 4.95, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 4.95, 18, 52, 414] },
    15: { low: [10, 8, 3, 1.65, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 1.65, 3, 8, 10], medium: [83.5, 18, 11, 4.65, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 4.65, 11, 18, 83.5], high: [611, 83, 27, 7.65, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 7.65, 27, 83, 611] },
    16: { low: [16, 8.65, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.45, 1, 1.1, 1.2, 1.4, 1.4, 2, 8.65, 16], medium: [110, 40, 10, 4.45, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 4.45, 10, 40, 110], high: [1000, 130, 24.5, 8.75, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 8.75, 24.5, 130, 1000] }
  };

  RD.fair.plinko = PLINKO;
  function minesMult(k, m) { var x = 0.98; for (var i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return Math.floor(x * 100) / 100; }
  var RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], SUITS = ["♠", "♥", "♦", "♣"];
  /* Carta de baralho (Blackjack, Hi-Lo, Baccarat): naipes desenhados em SVG, frente/verso com virada 3D */
  var SUIT_D = ["M12 2C9 6.5 3.5 9.5 3.5 14a4.5 4.5 0 0 0 7.6 3.2L10 22h4l-1.1-4.8A4.5 4.5 0 0 0 20.5 14C20.5 9.5 15 6.5 12 2z",
    "M12 21.2s-7.6-4.7-9.7-9.4C.8 8.3 3 4.4 6.8 4.4c2.1 0 3.6 1.2 5.2 3.2 1.6-2 3.1-3.2 5.2-3.2 3.8 0 6 3.9 4.5 7.4-2.1 4.7-9.7 9.4-9.7 9.4z",
    "M12 1.8 20.2 12 12 22.2 3.8 12z",
    "M12 2.4a4.4 4.4 0 0 0-4 6.2A4.4 4.4 0 1 0 10.9 16L10 22h4l-.9-6a4.4 4.4 0 1 0 2.9-7.4 4.4 4.4 0 0 0-4-6.2z"];
  function suitSvg(su, cls) { return '<svg viewBox="0 0 24 24" class="' + (cls || "") + '"><path d="' + SUIT_D[su] + '" fill="currentColor"/></svg>'; }
  function pcard(c, o) {
    o = o || {}; var red = c && (c.suit === 1 || c.suit === 2);
    var front = c ? '<div class="pc-f"><span class="pc-r">' + RANKS[c.rank] + "</span>" + suitSvg(c.suit, "pc-s") + suitSvg(c.suit, "pc-big") + "</div>" : '<div class="pc-f"></div>';
    return '<div class="pc' + (red ? " red" : "") + (o.hidden ? " hid" : "") + (o.cls ? " " + o.cls : "") + '"><div class="pc-in">' + front + '<div class="pc-b"><span>RD</span></div></div></div>';
  }
  function hiloOpts(r) {
    if (r === 1) return { up: { label: "Higher", p: 12 / 13, ok: function (x) { return x > 1; } }, down: { label: "Same", p: 1 / 13, ok: function (x) { return x === 1; } } };
    if (r === 13) return { up: { label: "Same", p: 1 / 13, ok: function (x) { return x === 13; } }, down: { label: "Lower", p: 12 / 13, ok: function (x) { return x < 13; } } };
    return { up: { label: "Higher or same", p: (14 - r) / 13, ok: function (x) { return x >= r; } }, down: { label: "Lower or same", p: r / 13, ok: function (x) { return x <= r; } } };
  }
  function capMult(amount, mult) { var M = maxProfit(); return M && amount * (mult - 1) > M ? Math.floor(((amount + M) / amount) * 100) / 100 : mult; }

  /* ---------- Moldura ---------- */
  var ogRefresh = null;
  function profitField(label) { return '<div><div class="ogx-label">' + (label || "Profit on win") + '<small id="og-mult-lbl"></small></div><div class="ogx-input ro"><span class="cur">' + curSym() + '</span><input id="og-profit" readonly value="0.00"></div></div>'; }
  function autoRule(k, label) {
    return '<div><div class="ogx-label">' + label + '</div><div class="ogx-split" style="margin-bottom:6px"><button class="active" data-rule="' + k + '" data-val="reset">Reset</button><button data-rule="' + k + '" data-val="inc">Increase by</button></div>' +
      '<div class="ogx-input"><input type="number" id="au-' + k + '" min="0" step="1" value="0" disabled><span class="sfx">' + ic("percent", 14) + "</span></div></div>";
  }
  function selectField(id, label, opts, val) {
    return '<div><div class="ogx-label">' + label + '</div><select class="ogx-select" id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(val) ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>";
  }
  function originalPage(g) {
    var mod = OG[g.id], cfg = mod.cfg(), u = me(), fav = (ogPrefs.favs || []).indexOf(g.id) > -1;
    var side = '<aside class="ogx-side">' +
      (cfg.auto ? '<div class="ogx-mode"><button class="active" data-mode="manual">Manual</button><button data-mode="auto">Auto</button></div>' : "") +
      '<div><div class="ogx-label">' + (cfg.amountLabel || "Bet amount") + '<small id="og-bal"></small></div><div class="ogx-input"><span class="cur">' + curSym() + '</span><input type="number" id="og-amt" min="0" step="0.01" value="1.00" inputmode="decimal"><button class="mini" data-og="half">½</button><button class="mini" data-og="double">2×</button></div>' + (cfg.amountLabel === "Chip value" ? chipRack() : "") + "</div>" +
      (cfg.side || "") +
      (cfg.auto ? '<div id="og-auto" class="hidden" style="display:flex;flex-direction:column;gap:14px">' +
        '<div><div class="ogx-label">Number of bets<small>0 = infinite</small></div><div class="ogx-input"><input type="number" id="au-n" min="0" step="1" value="10"><span class="sfx">∞</span></div></div>' +
        autoRule("win", "On win") + autoRule("loss", "On loss") +
        '<div><div class="ogx-label">Stop on profit</div><div class="ogx-input"><span class="cur">' + curSym() + '</span><input type="number" id="au-sp" min="0" step="0.01" value="0"></div></div>' +
        '<div><div class="ogx-label">Stop on loss</div><div class="ogx-input"><span class="cur">' + curSym() + '</span><input type="number" id="au-sl" min="0" step="0.01" value="0"></div></div></div>' : "") +
      '<button class="btn btn-primary btn-block ogx-bet" id="og-bet">' + (u ? "Bet" : "Sign in to play") + "</button>" + (cfg.after || "") +
      '<div class="ogx-msg" id="og-msg"></div></aside>';
    var stage = '<section class="ogx-stage"><div class="ogx-hist" id="og-hist"></div><div class="ogx-stats' + (ogPrefs.stats ? "" : " hidden") + '" id="og-stats"></div><div class="ogx-center">' + cfg.center + "</div>" + (cfg.fields || "") + "</section>";
    var bar = '<div class="ogx-bar">' +
      '<button class="icon-btn' + (ogPrefs.theatre ? " active" : "") + '" data-ogx="theatre" title="Theatre mode">' + ic("maximize", 18) + "</button>" +
      '<button class="icon-btn' + (ogPrefs.stats ? " active" : "") + '" data-ogx="stats" title="Live stats">' + ic("bars", 18) + "</button>" +
      '<button class="icon-btn' + (ogPrefs.hotkeys ? " active" : "") + '" data-ogx="hotkeys" title="Hotkeys">' + ic("keyboard", 18) + "</button>" +
      '<button class="icon-btn' + (fav ? " fav" : "") + '" data-ogx="fav" title="Favorite">' + ic("star", 18) + "</button>" +
      '<button class="icon-btn" data-ogx="sound" title="Sound">' + ic(RD.sfx.muted() ? "volumeX" : "volume", 18) + "</button>" +
      '<div class="ogx-brand">RDCASINO</div><button class="ogx-fair" data-action="seeds">' + ic("shield", 15) + "Provably fair</button></div>";
    return '<div class="container' + (ogPrefs.theatre ? " wide" : "") + '">' +
      '<div class="row" style="margin-bottom:14px;gap:8px"><a class="icon-btn" href="#/casino/originals" aria-label="Back">' + ic("chevronLeft") + '</a><h2 style="font-size:18px">' + esc(g.name) + '</h2><span class="badge">RD Originals</span></div>' +
      '<div class="ogx' + (ogPrefs.theatre ? " theatre" : "") + '" id="ogx"><div class="ogx-main">' + side + stage + "</div>" + bar + "</div>" +
      '<div class="card og-info"><div class="card-head"><div class="pill-tabs" id="og-tabs"><button data-ogtab="mine">My bets</button><button data-ogtab="recent">Recent bets</button><button data-ogtab="high">High rollers</button></div></div><div id="og-tab-body"></div></div></div>';
  }

  function statsHtml(gid) {
    var s = sess(gid), pts = s.series, n = pts.length;
    var min = Math.min.apply(null, pts.concat([0])), max = Math.max.apply(null, pts.concat([0])), span = (max - min) || 1;
    var y = function (v) { return 38 - ((v - min) / span) * 36; }, x = function (i) { return n < 2 ? 0 : (i / (n - 1)) * 100; };
    var line = pts.map(function (v, i) { return x(i).toFixed(2) + "," + y(v).toFixed(2); }).join(" ");
    var color = s.profit >= 0 ? "var(--success)" : "var(--danger)";
    return '<div class="row between"><h4>Live stats</h4><div class="row" style="gap:4px"><button class="btn btn-ghost btn-sm" data-ogx="reset-stats">Reset</button><button class="icon-btn" style="width:28px;height:28px" data-ogx="stats">' + ic("x", 14) + "</button></div></div>" +
      '<dl><div><dt>Profit</dt><dd class="' + (s.profit >= 0 ? "pos" : "neg") + '">' + money(s.profit, { sign: true }) + "</dd></div><div><dt>Wagered</dt><dd>" + money(s.wagered) + '</dd></div><div><dt>Wins</dt><dd class="pos">' + s.wins + '</dd></div><div><dt>Losses</dt><dd class="neg">' + s.losses + "</dd></div></dl>" +
      '<div class="ogx-chart"><svg viewBox="0 0 100 40" preserveAspectRatio="none"><line x1="0" x2="100" y1="' + y(0) + '" y2="' + y(0) + '" stroke="rgba(255,255,255,.15)" stroke-width="0.4" stroke-dasharray="1.5 1.5"/>' +
      (n > 1 ? '<polygon points="0,' + y(0) + " " + line + " 100," + y(0) + '" fill="' + color + '" fill-opacity="0.15"/><polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' : "") + "</svg></div>";
  }

  var ABOUT = {
    dice: "<p><strong>Dice</strong> is the classic crypto casino game. Set your win chance anywhere from 0.01% to 97% and roll over or under the target. The lower your win chance, the higher the multiplier — up to 9,800×.</p><p>Every roll lands between 0.00 and 100.00.</p>",
    limbo: "<p><strong>Limbo</strong>: set a target multiplier and bet. If the result reaches your target, you win your bet times the target. Targets go from 1.01× to 1,000,000×.</p>",
    plinko: "<p><strong>Plinko</strong>: drop the ball and watch it bounce down the pegs. Where it lands sets your multiplier. Choose 8 to 16 rows and low, medium or high risk — 16 rows on high risk pays up to 1,000× on the edges.</p>",
    crash: "<p><strong>Crash</strong>: the multiplier starts at 1.00× and climbs until it crashes. Cash out before the crash to win your bet times the multiplier. Set an automatic cashout to lock in a target.</p>",
    mines: "<p><strong>Mines</strong>: a 5×5 grid hides gems and mines. Choose how many mines (1–24), then reveal tiles. Every gem raises your multiplier — cash out any time, but hit a mine and the round is lost.</p>",
    wheel: "<p><strong>Wheel</strong>: spin the wheel and win the multiplier it stops on. Choose 10 to 50 segments and low, medium or high risk — high risk has a single big segment worth up to 49×.</p>",
    keno: "<p><strong>Keno</strong>: pick 1 to 10 numbers from 40. We draw 10. The more of your numbers are drawn, the bigger the multiplier — up to 1,140×. Choose Classic, Low, Medium or High risk; the payout table updates as you pick.</p>",
    blackjack: "<p><strong>Blackjack</strong>: get closer to 21 than the dealer without going over. Blackjack pays 3 to 2, the dealer hits soft 17 and stands on hard 17, you can double on your first two cards or split a pair once (no doubling after a split), and when the dealer shows an Ace you can take insurance (half your bet, pays 2 to 1 if the dealer has Blackjack). Cards are dealt from an infinite deck. RTP shown assumes basic strategy (approximate).</p>",
    roulette: "<p><strong>Roulette</strong>: European wheel with a single zero. Place chips on numbers or outside bets — a number pays 36.26×, dozens and columns 3.02×, and red/black, even/odd and 1–18/19–36 pay 2.01× (your bet included). RTP 98% on every bet.</p>",
    tower: "<p><strong>Tower</strong>: climb 9 floors. On every floor pick a tile — find the egg and you go up, hit the skull and the round ends. Cash out whenever you want. Five difficulties, from Easy (3 eggs in 4 tiles) to Master (1 egg in 4 tiles, up to 256,901×).</p>",
    spill: "<p><strong>Spill</strong>: fill the cup one pour at a time. Every pour raises your multiplier, but a hidden pour makes the cup spill over. Cash out any time. Low hides 1 spill in 25 pours, Medium 3, High 5 and Degen 10.</p>",
    chicken: "<p><strong>Chicken</strong>: help the chicken cross the road, one lane at a time. Every lane you cross raises your multiplier, but some lanes hide a car. Cash out before you get hit. Easy hides 1 car in 20 lanes, Expert hides 10.</p>",
    coinflip: "<p><strong>Coinflip</strong>: pick Heads or Tails and flip. <b>Classic</b> is one flip at 1.96×. <b>Target</b> asks for 2 to 10 flips in a row on your side — every extra flip doubles the multiplier, up to 1,003.52×. Heads is the gold RD coin, Tails the silver one.</p>",
    rps: "<p><strong>Rock Paper Scissors</strong>: beat the house hand to climb the ladder — 1.96×, 3.92×, 7.84× and up to 1,003.52× after 10 wins. A tie gives you another throw at no cost. Cash out after any win. Scissors cut paper, rock smashes scissors, paper wraps rock.</p>",
    baccarat: "<p><strong>Baccarat</strong>: bet on Player, Banker or Tie. The hand closest to 9 wins. Player pays 1:1, Banker pays 0.95:1 and Tie pays 8:1 (on a tie, Player and Banker bets are returned). Standard third-card rules, infinite deck. House edge: 1.24% on Player, 1.06% on Banker, 14.4% on Tie.</p>",
    double: "<p><strong>Double</strong>: pick a color and spin. 15 tiles: 7 red and 7 black pay 2.1×, the white RD tile pays 14.7×. RTP 98%.</p>",
    soccer: "<p><strong>Soccer</strong>: choose a corner and shoot. The keeper covers 1 to 4 of the 5 corners depending on difficulty. Every goal multiplies your win — cash out any time, or keep shooting for up to 15,000×.</p>",
    door: "<p><strong>Door</strong>: pick one door on each of 10 floors. Behind most doors is a coin, behind the trap door you lose. Every floor raises your multiplier — cash out whenever you want.</p>",
    hilo: "<p><strong>Hi-Lo</strong>: guess whether the next card is higher or lower than the current one. Each correct guess multiplies your win. Skip cards you don't like and cash out whenever you want. The last card stays on the table for your next round, win or lose. Aces are low, kings are high.</p>"
  };
  var HIGH_ROLLER = 100; // aposta mínima (USD) para aparecer em "High rollers"
  function ogTab(g, tab) {
    var box = $("#og-tab-body"); if (!box) return;
    $$("#og-tabs [data-ogtab]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-ogtab") === tab); });
    var u = me(), mod = OG[g.id], mine = function (b) { return b.game === g.id; };
    if (tab === "mine" && !u) { box.innerHTML = empty("Sign in to see your bets", "", '<button class="btn btn-primary btn-sm" data-open="register">Register</button>'); return; }
    var all = db.recentBets(2000).filter(mine), list;
    if (tab === "recent") list = all.slice(0, 12);
    if (tab === "mine") list = all.filter(function (b) { return b.userId === u.id; }).slice(0, 12);
    if (tab === "high") list = all.filter(function (b) { return b.amount >= HIGH_ROLLER; }).slice(0, 12);
    box.innerHTML = list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Player</th><th>Time</th><th class="right">Bet</th><th class="right">Result</th><th class="right">Multiplier</th><th class="right">Profit</th></tr></thead><tbody>' +
      list.map(function (b) {
        return '<tr><td class="strong">' + esc(b.user) + '</td><td class="faint">' + b.date.slice(11, 16) + '</td><td class="right num">' + money(b.amount) + '</td><td class="right num">' + mod.label(b) + '</td><td class="right num">' + b.multiplier.toFixed(2) + '×</td><td class="right num strong ' + (b.payout > b.amount ? "pos" : "faint") + '">' + money(b.payout - b.amount, { sign: true }) + "</td></tr>";
      }).join("") + "</tbody></table></div>" : empty("Nothing here yet", tab === "mine" ? "Your bets on " + g.name + " show up here." : tab === "recent" ? "Plays on " + g.name + " show up here in real time." : "Bets of " + money(HIGH_ROLLER, { dec: 0 }) + " or more on " + g.name + " show up here.");
  }

  function bindOriginal(g) {
    var mod = OG[g.id], amt = $("#og-amt"), mode = "manual", auto = false, busy = false, tab = me() ? "mine" : "recent", rules = { win: "reset", loss: "reset" };
    var ctx = {
      g: g,
      amount: function () { return Math.max(0, amtOut(amt.value)); },
      setAmt: function (v) { amt.value = amtIn(Math.max(0, v)); ctx.refresh(); },
      msg: function (t, extra) { if (!$("#og-msg")) return; $("#og-msg").innerHTML = t ? errorBox(t, extra) : ""; },
      btn: function () { return $("#og-bet"); },
      refresh: function () { var u = me(); if (!$("#og-bal")) return; $("#og-bal").textContent = u ? "Balance " + money(shownBal(u)) : ""; if (api.refresh) api.refresh(); },
      setProfit: function (mult, label) { var p = $("#og-profit"); if (!p) return; p.value = amtIn(ctx.amount() * (mult - 1)); $("#og-mult-lbl").textContent = (label || mult.toFixed(2)) + "×"; },
      validate: function (a, maxMult) {
        var u = me(); ctx.msg("");
        if (!u) { openAuth("register"); return null; }
        if (u.status !== "Active") { ctx.msg("Your account is suspended."); return null; }
        if (a < 0.01) { ctx.msg("Minimum bet is $0.01."); return null; }
        if (a > u.balance) { ctx.msg("Insufficient balance.", ' <a href="#" class="link-sm" data-open="wallet">Deposit</a>'); return null; }
        if (maxMult && maxProfit() && a * (maxMult - 1) > maxProfit()) { ctx.msg("Max profit per bet is " + money(maxProfit(), { dec: 0 }) + "."); return null; }
        return u;
      },
      hold: function (b) { hold(b); ctx.refresh(); },
      lock: function (on) {
        if (!document.contains(amt)) return;
        amt.disabled = on; $$("[data-og]").forEach(function (b) { b.disabled = on; });
        $$(".ogx-side select").forEach(function (s) { s.disabled = on; });
        $$("[data-mode]").forEach(function (b) { b.disabled = on; });
      },
      record: function (b) {
        if (!b || b.error) return;
        release(b);
        RD.sfx.play(b.payout > b.amount ? (b.payout >= b.amount * 5 ? "win" : "small") : "lose", 90);
        var me0 = me(); if (me0) { var t1 = db.tierOf(me0.wagered), lk = "rd_lvl_" + me0.id, seen = null; try { seen = localStorage.getItem(lk); } catch (e) {} if (t1 && seen !== t1.name && (seen || db.tierOf(me0.wagered - b.amount) !== t1)) { try { localStorage.setItem(lk, t1.name); } catch (e) {} RD.toast("Level up! You reached " + t1.name + " — claim " + fmt.usd(t1.reward, { dec: 0 }) + " on the VIP page"); renderSidebar(); markActive(currentPath); } }
        var st = sess(g.id), delta = b.payout - b.amount;
        st.profit = Math.round((st.profit + delta) * 100) / 100; st.wagered += b.amount; st[b.payout > b.amount ? "wins" : "losses"]++; st.series.push(st.profit); if (st.series.length > 200) st.series.shift();
        renderHeader(); ctx.refresh(); history(); stats(); ogTab(g, tab);
        if (b.payout > b.amount && g.id !== "plinko") winPop(b);
      }
    };
    /* Aviso de vitória no centro do jogo (multiplicador + valor recebido) */
    var popTimer = null;
    function winPop(b) {
      var stage = $(".ogx-stage"); if (!stage) return;
      var old = stage.querySelector(".ogx-win"); if (old) old.remove();
      var el = document.createElement("div"); el.className = "ogx-win";
      el.innerHTML = '<div class="m">' + b.multiplier.toFixed(2) + '×</div><div class="v"><span class="coin-dot" style="background:#26a17b">₮</span>' + money(b.payout) + "</div>";
      el.addEventListener("click", function () { el.remove(); });
      stage.appendChild(el); clearTimeout(popTimer);
      popTimer = setTimeout(function () { el.classList.add("out"); setTimeout(function () { el.remove(); }, 250); }, 1700);
    }
    var api = mod.bind(ctx);
    ogRefresh = ctx.refresh;
    function history() {
      var u = me(), h = $("#og-hist"); if (!h) return;
      h.innerHTML = u ? db.betsOf(u.id).filter(function (b) { return b.game === g.id; }).slice(0, 7).reverse().map(function (b) {
        return '<span class="' + (b.payout > b.amount ? "w" : "") + '">' + mod.label(b) + "</span>";
      }).join("") : "";
    }
    function stats() { var el = $("#og-stats"); if (el && !el.classList.contains("hidden")) { el.innerHTML = statsHtml(g.id); bindStatsButtons(); } }
    function manual() {
      if (api.click) return api.click();
      if (busy) return; busy = true; ctx.btn().disabled = true;
      api.play().then(function () { setTimeout(function () { busy = false; var b = ctx.btn(); if (b) b.disabled = false; }, api.cooldown || 180); });
    }
    function startAuto() {
      var base = ctx.amount(), count = 0, total = parseInt($("#au-n").value, 10) || 0, start = sess(g.id).profit;
      var sp = amtOut($("#au-sp").value), sl = amtOut($("#au-sl").value), btn = ctx.btn();
      auto = true; btn.textContent = "Stop autobet"; btn.classList.add("stop"); ctx.lock(true);
      (function loop() {
        if (!auto || !document.contains(btn)) return stopAuto();
        api.play().then(function (r) {
          if (!r) return stopAuto();
          count++;
          var rule = rules[r.win ? "win" : "loss"], pct = parseFloat($("#au-" + (r.win ? "win" : "loss")).value) || 0;
          amt.value = amtIn(rule === "reset" ? base : ctx.amount() * (1 + pct / 100)); ctx.refresh();
          var run = sess(g.id).profit - start;
          if ((total && count >= total) || (sp && run >= sp) || (sl && -run >= sl)) return stopAuto();
          setTimeout(loop, 300);
        });
      })();
    }
    function stopAuto() { auto = false; ctx.lock(false); var btn = ctx.btn(); if (btn) { btn.textContent = mode === "auto" ? "Start autobet" : "Bet"; btn.classList.remove("stop"); } }

    amt.addEventListener("input", ctx.refresh);
    /* 2×: dobra, mas nunca passa do saldo (como na Shuffle) */
    function doubled() { var u = me(), x = ctx.amount() * 2; if (!u) return x; var bal = Math.floor(shownBal(u) * 100) / 100; return bal > 0 ? Math.min(x, bal) : ctx.amount(); }
    $$("[data-og]").forEach(function (b) { b.addEventListener("click", function () { ctx.setAmt(b.getAttribute("data-og") === "half" ? ctx.amount() / 2 : doubled()); }); });
    function chipActive() { var v = ctx.amount(); $$("[data-chip]").forEach(function (c) { c.classList.toggle("on", Math.abs(+c.getAttribute("data-chip") - v) < 0.001); }); }
    $$("[data-chip]").forEach(function (c) { c.addEventListener("click", function () { if (c.closest("fieldset:disabled")) return; ctx.setAmt(+c.getAttribute("data-chip")); RD.sfx.play("tick", 0); chipActive(); }); });
    if ($("#og-amt")) { $("#og-amt").addEventListener("input", chipActive); chipActive(); }
    $$("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (auto) return; mode = b.getAttribute("data-mode");
        $$("[data-mode]").forEach(function (x) { x.classList.toggle("active", x === b); });
        $("#og-auto").classList.toggle("hidden", mode !== "auto");
        $$(".og-manual-only").forEach(function (x) { x.classList.toggle("hidden", mode === "auto"); });
        if (me()) ctx.btn().textContent = mode === "auto" ? "Start autobet" : "Bet";
      });
    });
    $$("[data-rule]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-rule"); rules[k] = b.getAttribute("data-val");
        $$('[data-rule="' + k + '"]').forEach(function (x) { x.classList.toggle("active", x === b); });
        $("#au-" + k).disabled = rules[k] === "reset";
      });
    });
    ctx.btn().addEventListener("click", function () {
      if (!me()) return openAuth("register");
      RD.sfx.play("bet");
      if (mode === "auto") return auto ? stopAuto() : startAuto();
      manual();
    });
    $$("[data-ogtab]").forEach(function (b) { b.addEventListener("click", function () { tab = b.getAttribute("data-ogtab"); ogTab(g, tab); }); });
    $$(".ogx-bar [data-ogx]").forEach(function (b) { b.addEventListener("click", function () { ogBar(b.getAttribute("data-ogx")); }); });
    function ogBar(a) {
      if (a === "theatre") { ogPrefs.theatre = !ogPrefs.theatre; savePrefs(); $("#ogx").classList.toggle("theatre", ogPrefs.theatre); $("#ogx").closest(".container").classList.toggle("wide", ogPrefs.theatre); if (api.resize) setTimeout(api.resize, 50); }
      if (a === "stats") { ogPrefs.stats = !ogPrefs.stats; savePrefs(); $("#og-stats").classList.toggle("hidden", !ogPrefs.stats); stats(); }
      if (a === "reset-stats") { session[g.id] = null; stats(); }
      if (a === "hotkeys") { ogPrefs.hotkeys = !ogPrefs.hotkeys; savePrefs(); RD.toast(ogPrefs.hotkeys ? "Hotkeys on: Space bet · S half · D double" : "Hotkeys off"); }
      if (a === "sound") { var mu = RD.sfx.toggle(), sb = $(".ogx-bar [data-ogx=sound]"); if (sb) sb.innerHTML = ic(mu ? "volumeX" : "volume", 18); return; }
      if (a === "fav") { var f = ogPrefs.favs = ogPrefs.favs || [], i = f.indexOf(g.id); if (i > -1) f.splice(i, 1); else f.push(g.id); savePrefs(); RD.toast(i > -1 ? "Removed from favorites" : "Added to favorites"); }
      $$(".ogx-bar [data-ogx]").forEach(function (x) {
        var k = x.getAttribute("data-ogx");
        if (k === "fav") x.classList.toggle("fav", (ogPrefs.favs || []).indexOf(g.id) > -1); else x.classList.toggle("active", !!ogPrefs[k]);
      });
    }
    function bindStatsButtons() {
      $$("#og-stats [data-ogx]").forEach(function (b) { b.addEventListener("click", function () { ogBar(b.getAttribute("data-ogx")); }); });
      var panel = $("#og-stats"), handle = panel && panel.querySelector(".row.between");
      if (!handle || window.innerWidth <= 960) return;
      if (ogPrefs.statsPos) panel.style.transform = "translate(" + ogPrefs.statsPos[0] + "px," + ogPrefs.statsPos[1] + "px)";
      handle.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button")) return;
        var s0 = [e.clientX, e.clientY], base = ogPrefs.statsPos || [0, 0];
        function move(ev) { ogPrefs.statsPos = [base[0] + ev.clientX - s0[0], base[1] + ev.clientY - s0[1]]; panel.style.transform = "translate(" + ogPrefs.statsPos[0] + "px," + ogPrefs.statsPos[1] + "px)"; }
        function up() { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); savePrefs(); }
        document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
      });
    }
    ogKeys = { bet: function () { if (mode === "manual") manual(); }, half: function () { if (!amt.disabled) ctx.setAmt(ctx.amount() / 2); }, double: function () { if (!amt.disabled) ctx.setAmt(doubled()); } };
    ctx.refresh(); history(); stats(); ogTab(g, tab);
    ogTabRefresh = function () { if ($("#og-tab-body") && tab !== "about") ogTab(g, tab); };
    if (api.resume) api.resume();
  }

  var OG = {};

  /* ---------- DICE ---------- */
  OG.dice = {
    label: function (b) { return Number(b.detail.result).toFixed(2); },
    cfg: function () {
      return {
        auto: true, side: '<div class="og-manual-only">' + profitField() + "</div>",
        center: '<div class="dx" id="dx" style="--t:50.5%"><div class="dx-frame"><span class="dx-res hidden" id="dx-res">0.00</span><div class="dx-bar"></div><input type="range" id="dx-range" min="0.01" max="99.99" step="0.01" value="50.5" aria-label="Roll target"></div>' +
          '<div class="dx-ticks">' + [0, 25, 50, 75, 100].map(function (v) { return '<span style="left:' + v + '%">' + v + "</span>"; }).join("") + "</div></div>",
        fields: '<div class="ogx-fields"><div><div class="ogx-label">Multiplier</div><div class="ogx-input"><input id="dx-mult" inputmode="decimal"><span class="sfx">×</span></div></div>' +
          '<div><div class="ogx-label" id="dx-mode-lbl">Roll over</div><button class="ogx-input" id="dx-mode" title="Switch over / under"><span id="dx-target">50.50</span><span class="sfx">' + ic("swap", 16) + "</span></button></div>" +
          '<div><div class="ogx-label">Win chance</div><div class="ogx-input"><input id="dx-chance" inputmode="decimal"><span class="sfx">%</span></div></div></div>'
      };
    },
    bind: function (ctx) {
      var dr = $("#dx-range"), over = true;
      /* RTP 98%: chance de 0,01% a 97% (multiplicador de 1,0103× a 9.800×) */
      function clampT() { var t = parseFloat(dr.value), lo = over ? 3 : 0.01, hi = over ? 99.99 : 97; if (t < lo || t > hi) dr.value = Math.max(lo, Math.min(hi, t)).toFixed(2); }
      function params() { clampT(); var t = parseFloat(dr.value), c = Math.round((over ? 100 - t : t) * 100) / 100; return { target: t, chance: c, mult: Math.floor((98 / c) * 10000) / 10000 }; }
      function refresh() {
        var p = params(); ctx.setProfit(p.mult);
        $("#dx").style.setProperty("--t", p.target + "%"); $("#dx").classList.toggle("under", !over);
        $("#dx-mode-lbl").textContent = over ? "Roll over" : "Roll under"; $("#dx-target").textContent = p.target.toFixed(2);
        if (document.activeElement !== $("#dx-mult")) $("#dx-mult").value = p.mult.toFixed(4);
        if (document.activeElement !== $("#dx-chance")) $("#dx-chance").value = p.chance.toFixed(4);
      }
      dr.addEventListener("input", refresh);
      $("#dx-mode").addEventListener("click", function () { over = !over; dr.value = (100 - parseFloat(dr.value)).toFixed(2); refresh(); });
      $("#dx-mult").addEventListener("change", function () { var m = Math.max(1.0103, Math.min(9800, parseFloat(this.value) || 2)), c = Math.round((98 / m) * 100) / 100; dr.value = (over ? 100 - c : c).toFixed(2); this.blur(); refresh(); });
      $("#dx-chance").addEventListener("change", function () { var c = Math.max(0.01, Math.min(97, parseFloat(this.value) || 49.5)); dr.value = (over ? 100 - c : c).toFixed(2); this.blur(); refresh(); });
      return {
        refresh: refresh,
        play: function () {
          var a = ctx.amount(), p = params(), u = ctx.validate(a, p.mult); if (!u) return Promise.resolve(null);
          return roll(u, "dice", a, { target: p.target, mode: over ? "over" : "under" }, 1, true).then(function (s) {
            var nonce = s.nonce, client = s.client, res = outcome("dice", s.fs[0]), win = over ? res > p.target : res < p.target;
            var b = s.place(p.mult, win, { result: res, target: p.target, mode: over ? "over" : "under", nonce: nonce, client: client }); if (b.error) { ctx.msg(b.error); return null; }
            var r = $("#dx-res"); if (r) { r.classList.remove("hidden", "w", "l", "pop"); void r.offsetWidth; r.textContent = res.toFixed(2); r.style.left = "calc(var(--pad) + (100% - 2 * var(--pad)) * " + (res / 100) + ")"; r.classList.add(win ? "w" : "l", "pop"); }
            ctx.record(b); return { win: win };
          });
        }
      };
    }
  };

  /* ---------- LIMBO ---------- */
  /* Limbo: campo magnético (linhas de campo girando, anéis tracejados e partículas em órbita) */
  function limboStage() {
    var lines = "", i;
    for (i = 0; i < 6; i++) lines += '<ellipse cx="200" cy="200" rx="178" ry="' + (46 + i * 8) + '" transform="rotate(' + i * 30 + ' 200 200)"/>';
    var L = function (cls, inner) { return '<div class="lb-layer ' + cls + '"><svg viewBox="0 0 400 400" aria-hidden="true">' + inner + "</svg></div>"; };
    // cada camada gira como um <div> (transform no compositor, sem recalcular o SVG a cada quadro)
    return '<div class="lb" id="lb"><div class="lb-field">' +
      L("lb-glow", '<defs><radialGradient id="lbGlow"><stop offset="0" stop-color="currentColor" stop-opacity=".38"/><stop offset=".55" stop-color="currentColor" stop-opacity=".08"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><circle cx="200" cy="200" r="200" fill="url(#lbGlow)"/>') +
      L("lb-lines", '<g fill="none" stroke="currentColor" stroke-opacity=".16" stroke-width="1.2">' + lines + "</g>") +
      L("lb-ring1", '<circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="2" stroke-dasharray="3 9"/>') +
      L("lb-ring2", '<circle cx="200" cy="200" r="118" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="1.5" stroke-dasharray="40 14 4 14"/>') +
      L("lb-orb1", '<circle cx="200" cy="50" r="9" fill="currentColor" opacity=".18"/><circle cx="200" cy="50" r="4" fill="currentColor"/><circle cx="200" cy="350" r="2.5" fill="currentColor"/>') +
      L("lb-orb2", '<circle cx="82" cy="200" r="7" fill="currentColor" opacity=".18"/><circle cx="82" cy="200" r="3" fill="currentColor"/><circle cx="318" cy="200" r="2" fill="currentColor"/>') +
      L("lb-burst", '<circle cx="200" cy="200" r="96" fill="none" stroke="currentColor" stroke-width="3"/>') +
      '</div><div class="lb-core"><div class="lb-num" id="lb-num">1.00×</div><div class="lb-tgt">Target <b id="lb-tgt">2.00×</b></div></div></div>';
  }

  OG.limbo = {
    label: function (b) { return Number(b.detail.result).toFixed(2) + "×"; },
    cfg: function () {
      return {
        auto: true, side: '<div class="og-manual-only">' + profitField() + "</div>",
        center: limboStage(),
        fields: '<div class="ogx-fields two"><div><div class="ogx-label">Target multiplier</div><div class="ogx-input"><input id="lb-target" type="number" min="1.01" step="0.01" value="2.00" inputmode="decimal"><span class="sfx">×</span></div></div>' +
          '<div><div class="ogx-label">Win chance</div><div class="ogx-input"><input id="lb-chance" inputmode="decimal"><span class="sfx">%</span></div></div></div>'
      };
    },
    bind: function (ctx) {
      function target() { return Math.max(1.01, Math.min(1000000, parseFloat($("#lb-target").value) || 1.01)); }
      function refresh() {
        var m = target(), c = 98 / m; ctx.setProfit(m); var tg = $("#lb-tgt"); if (tg) tg.textContent = m.toFixed(2) + "×";
        if (document.activeElement !== $("#lb-chance")) $("#lb-chance").value = c.toFixed(4);
      }
      $("#lb-target").addEventListener("input", refresh);
      $("#lb-chance").addEventListener("change", function () { var c = Math.max(0.0001, Math.min(97.02, parseFloat(this.value) || 49)); $("#lb-target").value = (98 / c).toFixed(2); this.blur(); refresh(); });
      return {
        refresh: refresh, cooldown: 320,
        play: function () {
          var a = ctx.amount(), m = target(), u = ctx.validate(a, m); if (!u) return Promise.resolve(null);
          return roll(u, "limbo", a, { target: m }, 1, true).then(function (s) {
            var nonce = s.nonce, client = s.client, res = outcome("limbo", s.fs[0]), win = res >= m;
            var b = s.place(m, win, { result: res, target: m, nonce: nonce, client: client }); if (b.error) { ctx.msg(b.error); return null; }
            var el = $("#lb-num"), st = $("#lb"), t0 = performance.now(), dur = res > 10 ? 520 : 380;
            if (el && st) {
              el.classList.remove("w", "l"); st.classList.remove("win", "lose"); void st.offsetWidth; st.classList.add("rolling");
              (function step(t) {
                var k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
                el.textContent = (1 + (res - 1) * e).toFixed(2) + "×";
                if (k < 1) return requestAnimationFrame(step);
                st.classList.remove("rolling"); st.classList.add(win ? "win" : "lose"); el.classList.add(win ? "w" : "l");
              })(t0);
            }
            ctx.record(b); return { win: win };
          });
        }
      };
    }
  };

  /* ---------- PLINKO ---------- */
  OG.plinko = {
    label: function (b) { return Number(b.multiplier || b.detail.result || 0).toFixed(b.multiplier >= 100 ? 0 : 1) + "×"; },
    cfg: function () {
      return {
        auto: true,
        side: selectField("pk-risk", "Risk", [["low", "Low"], ["medium", "Medium"], ["high", "High"]], ogPrefs.pkRisk || "medium") +
          selectField("pk-rows", "Rows", [8, 9, 10, 11, 12, 13, 14, 15, 16].map(function (r) { return [r, r]; }), ogPrefs.pkRows || 16),
        center: '<div class="pk" id="pk"></div>'
      };
    },
    bind: function (ctx) {
      var W = 600, live = 0;
      function rows() { return +$("#pk-rows").value; }
      function risk() { return $("#pk-risk").value; }
      function table() { return PLINKO[rows()][risk()]; }
      function geo(R) { var dx = W / (R + 2), dy = dx * 0.86, top = dy * 0.9; return { dx: dx, dy: dy, top: top, H: top + R * dy + dx * 1.1 }; }
      function color(i, R) { var t = Math.abs(i - R / 2) / (R / 2); return "hsl(" + Math.round(48 - 48 * t) + ",95%," + Math.round(56 - 6 * t) + "%)"; }
      function draw() {
        var R = rows(), G = geo(R), t = table(), svg = '<svg viewBox="0 0 ' + W + " " + G.H.toFixed(1) + '" id="pk-svg">';
        for (var i = 0; i < R; i++) for (var j = 0; j < i + 3; j++) svg += '<circle cx="' + (W / 2 + (j - (i + 2) / 2) * G.dx).toFixed(2) + '" cy="' + (G.top + i * G.dy).toFixed(2) + '" r="' + (G.dx * 0.09).toFixed(2) + '" fill="#e8eef9"/>';
        var sy = G.top + (R - 1) * G.dy + G.dy * 0.75, sw = G.dx * 0.92, sh = G.dx * 0.62, fs = Math.min(13, G.dx * 0.33);
        t.forEach(function (m, k) {
          var cx = W / 2 + (k - R / 2) * G.dx;
          svg += '<g class="slot" id="pk-s' + k + '"><rect x="' + (cx - sw / 2).toFixed(2) + '" y="' + sy.toFixed(2) + '" width="' + sw.toFixed(2) + '" height="' + sh.toFixed(2) + '" rx="' + (sh * 0.2).toFixed(2) + '" fill="' + color(k, R) + '"/><text x="' + cx.toFixed(2) + '" y="' + (sy + sh / 2 + fs * 0.36).toFixed(2) + '" text-anchor="middle" font-size="' + fs.toFixed(1) + '" font-weight="800" fill="#1a1205" font-family="Inter,sans-serif">' + (m >= 100 ? m : m) + "</text></g>";
        });
        $("#pk").innerHTML = svg + "</svg>";
        ctx.setProfit(Math.max.apply(null, t), "max " + Math.max.apply(null, t));
      }
      function drop(path, slot) {
        return new Promise(function (resolve) {
          var R = path.length, G = geo(R), svg = $("#pk-svg"); if (!svg) return resolve();
          var ball = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          ball.setAttribute("r", (G.dx * 0.2).toFixed(2)); ball.setAttribute("fill", "#ff2e55"); ball.setAttribute("stroke", "#ffb3c1"); ball.setAttribute("stroke-width", (G.dx * 0.04).toFixed(2)); svg.appendChild(ball);
          var pts = [[W / 2, G.top - G.dy * 0.9]], sum = 0;
          for (var i = 0; i < R; i++) { sum += path[i]; pts.push([W / 2 + (sum - (i + 1) / 2) * G.dx, G.top + i * G.dy + G.dy * 0.55]); }
          /* trajetória suave: em cada pino a bola quica um pouco para cima e cai com "gravidade" (parábola contínua) */
          var per = 120, t0 = performance.now(), lastSeg = -1;
          (function step(t) {
            var e = Math.max(0, (t - t0) / per), i = Math.min(Math.floor(e), pts.length - 2), k = Math.min(1, e - i);
            var a = pts[i], b = pts[i + 1], dyS = b[1] - a[1], v0 = i === 0 ? 0 : -0.35 * dyS;
            var x = a[0] + (b[0] - a[0]) * (k * (1.5 - 0.5 * k)), y = a[1] + v0 * k + (dyS - v0) * k * k;
            ball.setAttribute("cx", x.toFixed(2)); ball.setAttribute("cy", y.toFixed(2));
            if (i !== lastSeg) { if (i > 0) RD.sfx.play("pin", 25); lastSeg = i; }
            if (e < pts.length - 1) return requestAnimationFrame(step);
            ball.remove(); var s = $("#pk-s" + slot); if (s) { s.classList.add("hit"); setTimeout(function () { s.classList.remove("hit"); }, 200); }
            resolve();
          })(t0);
        });
      }
      function change() { if (live) { ctx.msg("Wait for the balls to land."); return; } ogPrefs.pkRows = rows(); ogPrefs.pkRisk = risk(); savePrefs(); draw(); }
      $("#pk-rows").addEventListener("change", change); $("#pk-risk").addEventListener("change", change);
      draw();
      function play() {
        var a = ctx.amount(), t = table(), R = rows(), rk = risk(), u = ctx.validate(a, Math.max.apply(null, t)); if (!u) return Promise.resolve(null);
        live++;
        return roll(u, "plinko", a, { rows: R, risk: rk }, R).then(function (s) {
          var fs = s.fs, nonce = s.nonce, client = s.client;
          var path = fs.map(function (f) { return Math.floor(f * 2); }), slot = path.reduce(function (x, y) { return x + y; }, 0), m = t[slot];
          var b = s.place(m, true, { result: m, rows: R, risk: rk, slot: slot, path: path.join(""), nonce: nonce, client: client });
          if (b.error) { live--; ctx.msg(b.error); return null; }
          ctx.hold(b);
          return drop(path, slot).then(function () { live--; ctx.record(b); return { win: m > 1 }; });
        });
      }
      return {
        refresh: function () { var t = table(); ctx.setProfit(Math.max.apply(null, t), "max " + Math.max.apply(null, t)); },
        click: function () { play(); }, play: play
      };
    }
  };

  /* ---------- CRASH (rodada individual) ---------- */
  OG.crash = {
    label: function (b) { return Number(b.detail.crash || 0).toFixed(2) + "×"; },
    cfg: function () {
      return {
        auto: true,
        side: '<div><div class="ogx-label">Cashout at</div><div class="ogx-input"><input type="number" id="cr-target" min="1.01" step="0.01" value="2.00" inputmode="decimal"><span class="sfx">×</span></div></div>' + '<div class="og-manual-only">' + profitField("Profit at cashout") + "</div>",
        center: '<div class="cr" id="cr"><canvas id="cr-canvas"></canvas><div class="cr-over"><div class="cr-num" id="cr-num">1.00×</div><div class="cr-sub" id="cr-sub"></div></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "crash", K = 0.00015, run = null;
      function target() { return Math.max(1.01, Math.min(1000000, parseFloat($("#cr-target").value) || 2)); }
      function multAt(ms) { return Math.floor(Math.exp(K * ms) * 100) / 100; }
      function canvas() {
        var c = $("#cr-canvas"); if (!c) return null;
        var r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
        if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
        return { c: c, x: c.getContext("2d"), w: c.width, h: c.height, d: d };
      }
      function paint(ms, crashed, cashedAt) {
        var cv = canvas(); if (!cv) return;
        var x = cv.x, w = cv.w, h = cv.h, d = cv.d, padL = 44 * d, padB = 26 * d, padT = 18 * d, padR = 18 * d;
        var tMax = Math.max(8000, ms * 1.2), m = Math.exp(K * ms), mMax = Math.max(2, m * 1.25);
        var X = function (t) { return padL + (w - padL - padR) * (t / tMax); }, Ym = function (v) { return h - padB - (h - padB - padT) * ((v - 1) / (mMax - 1)); }, Y = function (t) { return Ym(Math.exp(K * t)); };
        x.clearRect(0, 0, w, h);
        // grade discreta: linhas horizontais pontilhadas + rótulos de multiplicador e de tempo
        x.font = "600 " + 11 * d + "px Inter,sans-serif"; x.textBaseline = "middle";
        for (var i = 0; i <= 4; i++) {
          var v = 1 + (mMax - 1) * i / 4, y = Ym(v);
          x.setLineDash([3 * d, 6 * d]); x.strokeStyle = "rgba(255,255,255,0.07)"; x.lineWidth = d;
          x.beginPath(); x.moveTo(padL, y); x.lineTo(w - padR, y); x.stroke(); x.setLineDash([]);
          x.fillStyle = "rgba(255,255,255,0.38)"; x.textAlign = "right"; x.fillText(v.toFixed(v < 10 ? 1 : 0) + "×", padL - 8 * d, y);
        }
        x.textAlign = "center"; x.textBaseline = "alphabetic";
        var step = tMax > 30000 ? 10000 : tMax > 14000 ? 4000 : 2000;
        for (var tt = step; tt < tMax; tt += step) x.fillText(Math.round(tt / 1000) + "s", X(tt), h - 7 * d);
        var tg = parseFloat(($("#cr-target") || {}).value);
        if (tg > 1 && tg < mMax) { var yt = Ym(tg); x.setLineDash([6 * d, 6 * d]); x.strokeStyle = "rgba(255,200,92,0.45)"; x.beginPath(); x.moveTo(padL, yt); x.lineTo(w - padR, yt); x.stroke(); x.setLineDash([]); x.fillStyle = "rgba(255,200,92,0.8)"; x.textAlign = "right"; x.fillText(tg.toFixed(2) + "×", w - padR, yt - 6 * d); }
        if (ms <= 0) return;
        var path = function () { x.beginPath(); x.moveTo(X(0), Y(0)); for (var s2 = 1; s2 <= 80; s2++) { var t2 = ms * s2 / 80; x.lineTo(X(t2), Y(t2)); } };
        var c1 = crashed ? "#ff5a5a" : "#ff2e55", c2 = crashed ? "#ff8a5c" : "#ff9f43";
        // área preenchida
        path(); x.lineTo(X(ms), h - padB); x.lineTo(X(0), h - padB); x.closePath();
        var fill = x.createLinearGradient(0, Y(ms), 0, h - padB); fill.addColorStop(0, crashed ? "rgba(255,90,90,.28)" : "rgba(255,46,85,.30)"); fill.addColorStop(1, "rgba(255,46,85,0)");
        x.fillStyle = fill; x.fill();
        // linha com degradê e brilho
        var stroke = x.createLinearGradient(X(0), 0, X(ms), 0); stroke.addColorStop(0, c1); stroke.addColorStop(1, c2);
        path(); x.lineWidth = 4 * d; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = stroke; x.shadowColor = c1; x.shadowBlur = 14 * d; x.stroke(); x.shadowBlur = 0;
        if (cashedAt) { var tc = Math.log(cashedAt) / K; if (tc <= ms) { x.beginPath(); x.arc(X(tc), Y(tc), 5 * d, 0, Math.PI * 2); x.fillStyle = "#22e08a"; x.fill(); } }
        // ponta
        x.beginPath(); x.arc(X(ms), Y(ms), 11 * d, 0, Math.PI * 2); x.fillStyle = crashed ? "rgba(255,90,90,.25)" : "rgba(255,159,67,.25)"; x.fill();
        x.beginPath(); x.arc(X(ms), Y(ms), 5.5 * d, 0, Math.PI * 2); x.fillStyle = "#fff"; x.fill();
      }
      function setNum(text, cls, sub) { var n = $("#cr-num"); if (!n) return; n.textContent = text; n.className = "cr-num" + (cls ? " " + cls : ""); var sb = $("#cr-sub"); sb.textContent = sub || ""; sb.className = "cr-sub" + (sub ? " on" : ""); }
      var box = null;
      function finish(resolveRound, auto) {
        if (!auto && document.contains(box)) { ctx.lock(false); $("#cr-target").disabled = false; var b = ctx.btn(); if (b) { b.disabled = false; b.classList.remove("stop"); b.textContent = "Bet"; } }
        resolveRound();
      }
      /* Modo real: o ponto do crash fica no servidor. O site anima pelo tempo e pergunta o estado
         algumas vezes por segundo; o servidor paga no alvo, no "Cash out" ou registra o crash. */
      function startLive(a, tg, u) {
        if (run) return Promise.resolve(null);
        run = { starting: true };
        return db.roundStart(G, a, { target: tg }).then(function (r) {
          if (r.error) { run = null; ctx.msg(r.error); return null; }
          renderHeader(); ctx.refresh(); ctx.lock(true); $("#cr-target").disabled = true;
          box = $("#cr");
          return new Promise(function (resolve) {
            var t0 = performance.now(), cashed = null, crash = null, recorded = false, polling = false, lastPoll = 0, auto = !!$("[data-mode=auto].active");
            var btn = ctx.btn(); if (!auto) { btn.textContent = "Cash out"; btn.classList.add("stop"); }
            function apply(x) {
              if (!x || x.error || !x.done) return;
              crash = x.crash; if (x.cashout) cashed = capMult(a, x.cashout);
              if (x.bet && !recorded) { recorded = true; if (run) run.endBet = x.bet; if (cashed) { renderHeader(); RD.sfx.play("cash"); if (!auto && document.contains(box)) { btn.disabled = true; btn.textContent = "Cashed out @ " + cashed.toFixed(2) + "×"; btn.classList.remove("stop"); } } }
            }
            run = { cashout: function () {
              if (cashed || crash || run.busy) return; run.busy = true;
              db.roundAct(G, "cashout", { m: multAt(performance.now() - t0) }).then(function (x) { if (run) run.busy = false; if (x.error) return ctx.msg(x.error); apply(x); });
            } };
            (function step(now) {
              if (!document.contains(box)) { run = null; return resolve({ win: !!cashed }); }
              var ms = now - t0, m = multAt(ms);
              if (!crash && !polling && now - lastPoll > 200) { polling = true; lastPoll = now; db.roundAct(G, "status").then(function (x) { polling = false; apply(x); }); }
              if (crash && m >= crash) {
                paint(Math.log(crash) / K, true, cashed); setNum(crash.toFixed(2) + "×", "l", "Crashed"); RD.sfx.play("boom");
                if (run && run.endBet) ctx.record(run.endBet); /* só agora: o histórico não entrega onde ia crashar */
                run = null; return setTimeout(function () { finish(function () { resolve({ win: !!cashed }); }, auto); }, auto ? 300 : 700);
              }
              paint(ms, false, cashed); setNum(m.toFixed(2) + "×", cashed ? "w" : "");
              requestAnimationFrame(step);
            })(t0);
          });
        });
      }
      function start() {
        var a = ctx.amount(), tg = target(), u = ctx.validate(a, tg); if (!u) return Promise.resolve(null);
        if (RD.live) return startLive(a, tg, u);
        var r = db.startRound(u.id, G, a, { target: tg }); if (r.error) { ctx.msg(r.error); return Promise.resolve(null); }
        renderHeader(); ctx.refresh(); ctx.lock(true); $("#cr-target").disabled = true;
        box = $("#cr");
        return hmac(r.round.server, r.round.client + ":" + r.round.nonce).then(function (buf) {
          var crash = outcome("crash", floatFrom(buf));
          db.updateRound(u.id, G, { target: tg, crash: crash });
          return new Promise(function (resolve) {
            var t0 = performance.now(), cashed = null, auto = !!$("[data-mode=auto].active");
            var btn = ctx.btn(); if (!auto) { btn.textContent = "Cash out"; btn.classList.add("stop"); }
            run = { cashout: function () {
              if (cashed) return; var m = multAt(performance.now() - t0); if (m >= crash) return;
              cashed = capMult(a, m); run.endBet = db.settleRound(u.id, G, cashed, true, { crash: crash, cashout: cashed, target: tg });
              renderHeader(); RD.sfx.play("cash"); btn.disabled = true; btn.textContent = "Cashed out @ " + cashed.toFixed(2) + "×";
            } };
            (function step(now) {
              if (!document.contains(box)) { if (!cashed) { var w2 = tg < crash; db.settleRound(u.id, G, w2 ? capMult(a, tg) : 0, w2, { crash: crash, cashout: w2 ? tg : null, target: tg }); } run = null; return resolve({ win: !!cashed }); }
              var ms = now - t0, m = multAt(ms);
              if (!cashed && m >= tg && tg < crash) { cashed = capMult(a, tg); run.endBet = db.settleRound(u.id, G, cashed, true, { crash: crash, cashout: cashed, target: tg }); renderHeader(); RD.sfx.play("cash"); if (!auto) { btn.disabled = true; btn.textContent = "Cashed out @ " + cashed.toFixed(2) + "×"; btn.classList.remove("stop"); } }
              if (m >= crash) {
                paint(Math.log(crash) / K, true, cashed); setNum(crash.toFixed(2) + "×", "l", "Crashed"); RD.sfx.play("boom");
                ctx.record(cashed ? run.endBet : db.settleRound(u.id, G, 0, false, { crash: crash, target: tg }));
                run = null; return setTimeout(function () { finish(function () { resolve({ win: !!cashed }); }, auto); }, auto ? 300 : 700);
              }
              paint(ms, false, cashed); setNum(m.toFixed(2) + "×", cashed ? "w" : "");
              requestAnimationFrame(step);
            })(t0);
          });
        });
      }
      paint(0, false);
      return {
        refresh: function () { ctx.setProfit(target()); },
        resize: function () { paint(0, false); },
        click: function () { if (run) return run.cashout && run.cashout(); start(); },
        play: start,
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (!r || run) return;
          if (RD.live) return (function poll() {
            db.roundAct(G, "status").then(function (x) {
              if (x.error) return;
              if (!x.done) return setTimeout(poll, 1000);
              ctx.record(x.bet); RD.toast("Previous round settled: crashed at " + x.crash.toFixed(2) + "×" + (x.cashout ? " · cashed out at " + x.cashout.toFixed(2) + "×" : ""));
            });
          })();
          hmac(r.server, r.client + ":" + r.nonce).then(function (buf) {
            var crash = outcome("crash", floatFrom(buf)), tg = r.state.target, win = tg < crash, m = capMult(r.amount, tg);
            if (!db.activeRound(u.id, G)) return;
            var b = db.settleRound(u.id, G, win ? m : 0, win, { crash: crash, cashout: win ? m : null, target: tg }); ctx.record(b);
            RD.toast("Previous round settled: crashed at " + crash.toFixed(2) + "×" + (win ? " · cashed out at " + tg.toFixed(2) + "×" : ""));
          });
        }
      };
    }
  };

  /* ---------- MINES ---------- */
  /* Ícones do Mines: diamante lapidado e mina naval com a marca RD (desenho próprio, sem emoji) */
  var GEM = '<svg viewBox="0 0 64 64" class="mn-ic"><defs><linearGradient id="mnGa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dffd2"/><stop offset="1" stop-color="#14c98a"/></linearGradient><linearGradient id="mnGb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1fd99a"/><stop offset="1" stop-color="#0a8a5c"/></linearGradient></defs>' +
    '<ellipse cx="32" cy="58" rx="15" ry="2.6" fill="#000" opacity=".25"/><path d="M18 10h28l12 14-26 32L6 24z" fill="url(#mnGb)"/><path d="M18 10h28l12 14H6z" fill="url(#mnGa)"/>' +
    '<path d="M6 24h52M18 10l8 14 6-14 6 14 8-14M26 24l6 32 6-32" fill="none" stroke="#0b6e4b" stroke-opacity=".55" stroke-width="1.4" stroke-linejoin="round"/><path d="M20 13l-6 9h9z" fill="#fff" opacity=".55"/></svg>';
  var MINE = '<svg viewBox="0 0 64 64" class="mn-ic"><defs><radialGradient id="mnMb" cx=".38" cy=".34" r=".75"><stop offset="0" stop-color="#5a4a63"/><stop offset=".55" stop-color="#2a2030"/><stop offset="1" stop-color="#120c16"/></radialGradient></defs>' +
    '<ellipse cx="32" cy="59" rx="16" ry="2.6" fill="#000" opacity=".3"/>' +
    '<g stroke="#8d7c98" stroke-width="4.5" stroke-linecap="round"><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.6 13.6l5.6 5.6M44.8 44.8l5.6 5.6M50.4 13.6l-5.6 5.6M19.2 44.8l-5.6 5.6"/></g>' +
    '<g fill="#ff2e55"><circle cx="32" cy="6" r="3.4"/><circle cx="32" cy="58" r="3.4"/><circle cx="6" cy="32" r="3.4"/><circle cx="58" cy="32" r="3.4"/><circle cx="13.6" cy="13.6" r="3.2"/><circle cx="50.4" cy="50.4" r="3.2"/><circle cx="50.4" cy="13.6" r="3.2"/><circle cx="13.6" cy="50.4" r="3.2"/></g>' +
    '<circle cx="32" cy="32" r="19" fill="url(#mnMb)"/><path d="M13.4 32a18.6 6.4 0 0 0 37.2 0" fill="none" stroke="#ff2e55" stroke-width="3"/>' +
    '<text x="32" y="30" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" style="font-family:var(--font-display,Arial)">RD</text><ellipse cx="25" cy="23" rx="5" ry="3" fill="#fff" opacity=".22" transform="rotate(-30 25 23)"/></svg>';
  OG.mines = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      var opts = []; for (var i = 1; i <= 24; i++) opts.push([i, i]);
      return {
        side: '<div class="ogx-row2">' + selectField("mn-count", "Mines", opts, ogPrefs.mines || 3) + '<div><div class="ogx-label">Gems</div><div class="ogx-input ro"><input id="mn-gems" readonly></div></div></div>' +
          '<div id="mn-live" class="hidden">' + profitField("Total profit") + "</div>",
        after: '<button class="btn btn-secondary btn-block hidden" id="mn-random" style="height:42px">Pick random tile</button>',
        center: '<div class="mn-grid idle" id="mn-grid">' + Array.apply(null, Array(25)).map(function (_, i) { return '<button class="mn-tile" data-tile="' + i + '" aria-label="Tile ' + (i + 1) + '"></button>'; }).join("") + "</div>"
      };
    },
    bind: function (ctx) {
      var G = "mines", round = null, pending = false; // { amount, m, revealed:[] }
      function m() { return +$("#mn-count").value; }
      function refresh() {
        if (!$("#mn-gems")) return;
        $("#mn-gems").value = 25 - m();
        if (round) { var k = round.revealed.length, cur = k ? minesMult(k, round.m) : 1; ctx.setProfit(cur, cur.toFixed(2)); $("#og-profit").value = amtIn(round.amount * (cur - 1)); }
      }
      function tiles() { return $$("#mn-grid .mn-tile"); }
      function paint(final) {
        if (!$("#mn-grid")) return;
        tiles().forEach(function (t, i) {
          var open = round && round.revealed.indexOf(i) > -1, isMine = final && final.mines.indexOf(i) > -1;
          t.classList.toggle("open", open || !!final); t.classList.toggle("dim", !!final && !open);
          if (!final) t.classList.remove("boom");
          t.innerHTML = open ? GEM : final ? (isMine ? MINE : GEM) : "";
          t.disabled = !round || open;
        });
        $("#mn-grid").classList.toggle("idle", !round);
      }
      function setLive(on) {
        if (!$("#mn-live")) return;
        $("#mn-live").classList.toggle("hidden", !on); $("#mn-random").classList.toggle("hidden", !on); ctx.lock(on);
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.classList.toggle("stop", false);
        b.disabled = on && (!round || !round.revealed.length);
      }
      function end(win, minesPos) {
        var u = me(), k = round.revealed.length, mult = win ? capMult(round.amount, minesMult(k, round.m)) : 0;
        var b = db.settleRound(u.id, G, mult, win, { mines: round.m, revealed: round.revealed.slice(), minePos: minesPos });
        var shown = round; round = null; paint({ mines: minesPos }); round = null;
        tiles().forEach(function (t, i) { if (shown.revealed.indexOf(i) > -1) { t.classList.remove("dim"); t.innerHTML = GEM; } });
        if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#mn-grid")) document.activeElement.blur();
        setLive(false); ctx.record(b);
        if (win) ctx.msg(""); 
      }
      function reveal(i) {
        if (!round || pending || round.revealed.indexOf(i) > -1) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        pending = true;
        if (RD.live) return db.roundAct(G, "reveal", { tile: i }).then(function (x) {
          pending = false; if (x.error) return ctx.msg(x.error); if (!round) return;
          round.revealed.push(i);
          RD.sfx.play(x.mine ? "boom" : "gem");
          if (x.mine) { var t = tiles()[i]; end(false, x.minePos); if (!t || !document.contains(t)) return; t.classList.remove("dim"); t.innerHTML = MINE; t.classList.add("boom"); return; }
          if (x.bet) return end(true, x.minePos);
          if (!$("#mn-grid")) return;
          paint(); refresh(); ctx.btn().disabled = false;
        });
        floats(r.server, r.client, r.nonce, 24).then(function (fs) {
          pending = false; if (!round) return;
          var pos = minesFrom(fs, round.m);
          RD.sfx.play(pos.indexOf(i) > -1 ? "boom" : "gem");
          if (pos.indexOf(i) > -1) { round.revealed.push(i); var t = tiles()[i]; end(false, pos); if (!t || !document.contains(t)) return; t.classList.remove("dim"); t.innerHTML = MINE; t.classList.add("boom"); return; }
          round.revealed.push(i); db.updateRound(u.id, G, { m: round.m, revealed: round.revealed });
          if (round.revealed.length === 25 - round.m) return end(true, pos);
          if (!$("#mn-grid")) return;
          paint(); refresh(); ctx.btn().disabled = false;
        });
      }
      $("#mn-grid").addEventListener("click", function (e) { var t = e.target.closest("[data-tile]"); if (t && !t.disabled) reveal(+t.getAttribute("data-tile")); });
      $("#mn-random").addEventListener("click", function () { if (!round) return; var free = []; for (var i = 0; i < 25; i++) if (round.revealed.indexOf(i) < 0) free.push(i); reveal(free[Math.floor(Math.random() * free.length)]); });
      $("#mn-count").addEventListener("change", function () { ogPrefs.mines = m(); savePrefs(); refresh(); });
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u || pending) return;
        var mm = m(); pending = true;
        rStart(u, G, a, { m: mm, revealed: [] }).then(function (r) {
          pending = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, m: mm, revealed: [] }; renderHeader(); ctx.refresh(); paint(); setLive(true); refresh();
        });
      }
      refresh(); paint();
      return {
        refresh: refresh,
        click: function () {
          if (!round) return start();
          if (!round.revealed.length || pending) return;
          var u = me(), r = db.activeRound(u.id, G); if (!r) return;
          pending = true;
          if (RD.live) return db.roundAct(G, "cashout").then(function (x) { pending = false; if (x.error) return ctx.msg(x.error); if (round) end(true, x.minePos); });
          floats(r.server, r.client, r.nonce, 24).then(function (fs) { pending = false; if (round) end(true, minesFrom(fs, round.m)); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, m: r.state.m, revealed: r.state.revealed.slice() }; $("#mn-count").value = r.state.m; $("#og-amt").value = amtIn(r.amount); paint(); setLive(true); refresh(); }
        }
      };
    }
  };

  /* ---------- HI-LO ---------- */
  function cardHtml(c, cls) { return pcard(c, { cls: "hl-big" + (cls ? " " + cls : "") }); }
  var HL_ARW = { good: '<i class="hl-res good">' + '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></i>', bad: '<i class="hl-res bad"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></i>', skip: '<i class="hl-res skip"><svg viewBox="0 0 24 24"><path d="M6 6l6 6-6 6M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i>' };
  function miniCard(c, cls) { return '<div class="hl-mwrap">' + pcard(c, { cls: "hl-mini" + (cls ? " " + cls : "") }) + (HL_ARW[cls] || "") + "</div>"; }
  var HL_UP = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', HL_DN = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  OG.hilo = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: '<div id="hl-live" class="hidden">' + profitField("Total profit") + "</div>",
        after: '<button class="btn btn-secondary btn-block" id="hl-skip" style="height:42px" disabled>Skip card</button>',
        center: '<div class="hl"><div class="hl-hist" id="hl-hist"></div><div class="hl-table"><div class="hl-deck">' + pcard(null, { hidden: true, cls: "hl-big" }) + pcard(null, { hidden: true, cls: "hl-big" }) + pcard(null, { hidden: true, cls: "hl-big" }) + '</div><div class="hl-slot" id="hl-card"></div><div class="hl-scale"><span>K</span><i></i><span>A</span></div></div>' +
          '<div class="hl-btns"><button class="hl-btn up" id="hl-up" disabled><span class="hl-ic">' + HL_UP + '</span><span class="hl-tx"><b id="hl-up-l">Higher</b><small id="hl-up-p"></small></span><em id="hl-up-m"></em></button><button class="hl-btn down" id="hl-down" disabled><span class="hl-ic">' + HL_DN + '</span><span class="hl-tx"><b id="hl-down-l">Lower</b><small id="hl-down-p"></small></span><em id="hl-down-m"></em></button></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "hilo", round = null, preview = null, busyCard = false; // round: {amount, cards:[{rank,suit,res}], mult, idx}
      function current() { return round ? round.cards[round.cards.length - 1] : preview; }
      /* carta nova sai do baralho, desliza para o centro e vira */
      function dealCard(c, res) {
        var slot = $("#hl-card"); if (!slot) return;
        slot.insertAdjacentHTML("beforeend", pcard(c, { hidden: true, cls: "hl-big hl-in" }));
        var el = slot.lastElementChild; setTimeout(function () { el.classList.remove("hid"); }, 170);
        slot.className = "hl-slot";
        setTimeout(function () { if (!document.contains(el)) return; while (slot.firstElementChild !== el) slot.firstElementChild.remove(); el.classList.remove("hl-in"); if (res) { void slot.offsetWidth; slot.className = "hl-slot " + res; } }, 620);
      }
      function show(anim) {
        var c = current(); if (!c || !$("#hl-card")) return;
        if (anim) dealCard(c, c.res); else { $("#hl-card").innerHTML = cardHtml(c); $("#hl-card").className = "hl-slot"; }
        var o = hiloOpts(c.rank), live = !!round;
        [["up", o.up], ["down", o.down]].forEach(function (x) {
          $("#hl-" + x[0] + "-l").textContent = x[1].label;
          $("#hl-" + x[0] + "-p").textContent = (x[1].p * 100).toFixed(2) + "%";
          $("#hl-" + x[0] + "-m").textContent = (0.98 / x[1].p).toFixed(2) + "×";
          $("#hl-" + x[0]).disabled = !live;
        });
        $("#hl-skip").disabled = live ? false : !me();
        $("#hl-hist").innerHTML = round ? round.cards.map(function (k, i) { return miniCard(k, i === 0 ? "" : k.res); }).slice(-8).join("") : "";
        $("#hl-live").classList.toggle("hidden", !live);
        if (live) { ctx.setProfit(round.mult, round.mult.toFixed(2)); $("#og-profit").value = amtIn(round.amount * (round.mult - 1)); }
        var b = ctx.btn(); b.textContent = live ? "Cashout" : "Bet"; b.disabled = live && round.mult <= 1;
      }
      /* A carta da mesa continua de uma rodada para a outra (ganhando ou perdendo).
         Ela é só o ponto de partida: as próximas cartas vêm das suas seeds. */
      function randomCard() { var a = new Uint32Array(1); crypto.getRandomValues(a); return cardFrom(a[0] / 4294967296); }
      function loadPreview() {
        var u = me(); if (!u) { preview = { rank: 7, suit: 0 }; return show(); }
        var last = db.betsOf(u.id).filter(function (b) { return b.game === G && b.detail && b.detail.last; })[0], saved = (ogPrefs.hlCard || {})[u.id];
        preview = saved || (last ? { rank: last.detail.last.rank, suit: last.detail.last.suit } : randomCard()); keepCard(preview); show();
      }
      function keepCard(c) { var u = me(); if (!u) return; ogPrefs.hlCard = ogPrefs.hlCard || {}; ogPrefs.hlCard[u.id] = { rank: c.rank, suit: c.suit }; savePrefs(); }
      function cardsDetail(cards, extra) {
        var d = { cards: cards.map(function (c) { return RANKS[c.rank] + SUITS[c.suit]; }).join(" "), start: { rank: cards[0].rank, suit: cards[0].suit }, last: { rank: cards[cards.length - 1].rank, suit: cards[cards.length - 1].suit } };
        for (var k in extra) d[k] = extra[k]; return d;
      }
      function draw(kind) {
        if (!round) { if (kind === "skip" && !busyCard && me()) { preview = randomCard(); keepCard(preview); RD.sfx.play("card"); show(true); } return; }
        if (busyCard) return; busyCard = true;
        var u = me(), r = db.activeRound(u.id, G), idx = round.cards.length;
        // carta nº idx da rodada = número (idx − 1) das seeds (a 1ª carta é a que já estava na mesa)
        var got = RD.live ? db.roundAct(G, kind).then(function (x) { if (x.error) { busyCard = false; ctx.msg(x.error); return null; } return x; })
          : floats(r.server, r.client, r.nonce, idx).then(function (fs) { var c = cardFrom(fs[idx - 1]); return { card: c }; });
        got.then(function (x) {
          if (!x || !round) { busyCard = false; return; }
          var next = { rank: x.card.rank, suit: x.card.suit }, cur = current(), o = hiloOpts(cur.rank);
          RD.sfx.play("card");
          if (kind === "skip") { next.res = "skip"; round.cards.push(next); }
          else {
            var opt = kind === "up" ? o.up : o.down, ok = RD.live ? x.ok : opt.ok(next.rank);
            next.res = ok ? "good" : "bad"; round.cards.push(next);
            if (!ok) {
              var b = db.settleRound(u.id, G, 0, false, cardsDetail(round.cards, { mult: round.mult }));
              var last = round; round = null; busyCard = false; keepCard(next); preview = { rank: next.rank, suit: next.suit };
              if (!$("#hl-card")) return;
              ctx.lock(false);
              dealCard(next, "bad"); $("#hl-hist").innerHTML = last.cards.map(function (k, i) { return miniCard(k, i === 0 ? "" : k.res); }).slice(-8).join("");
              ["up", "down"].forEach(function (x) { $("#hl-" + x).disabled = true; }); $("#hl-skip").disabled = true; $("#hl-live").classList.add("hidden");
              ctx.btn().textContent = "Bet"; ctx.btn().disabled = false; ctx.record(b); busyCard = false;
              setTimeout(function () { if (!round && $("#hl-card")) { loadPreview(); } }, 1600);
              return;
            }
            round.mult = RD.live ? x.state.mult : Math.floor(round.mult * (0.98 / opt.p) * 100) / 100;
          }
          db.updateRound(u.id, G, { cards: round.cards, mult: round.mult }); keepCard(next); busyCard = false; show(true);
        });
      }
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u) return;
        if (!preview) loadPreview();
        var first = { rank: preview.rank, suit: preview.suit };
        if (busyCard) return; busyCard = true;
        rStart(u, G, a, { cards: [first], mult: 1 }, { start: first }).then(function (r) {
          busyCard = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, cards: [first], mult: 1 }; renderHeader(); ctx.refresh(); ctx.lock(true); show();
        });
      }
      $("#hl-up").addEventListener("click", function () { draw("up"); });
      $("#hl-down").addEventListener("click", function () { draw("down"); });
      $("#hl-skip").addEventListener("click", function () { draw("skip"); });
      loadPreview();
      return {
        refresh: function () {},
        click: function () {
          if (!round) return start();
          if (round.mult <= 1 || busyCard) return;
          var u = me(), mult = capMult(round.amount, round.mult);
          var done = function () {
            var b = db.settleRound(u.id, G, mult, true, cardsDetail(round.cards, { mult: mult }));
            var lastCard = round.cards[round.cards.length - 1]; round = null; ctx.lock(false); keepCard(lastCard); preview = { rank: lastCard.rank, suit: lastCard.suit }; ctx.record(b); show();
          };
          if (!RD.live) return done();
          busyCard = true; db.roundAct(G, "cashout").then(function (x) { busyCard = false; if (x.error) return ctx.msg(x.error); if (round) done(); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r && !RD.live && !(r.state.cards && r.state.cards.length)) { r.state.cards = [preview || randomCard()]; r.state.mult = 1; db.updateRound(u.id, G, r.state); }
          if (r) { round = { amount: r.amount, cards: r.state.cards.slice(), mult: r.state.mult }; $("#og-amt").value = amtIn(r.amount); ctx.lock(true); show(); }
        }
      };
    }
  };

  /* ---------- Tabelas: Wheel e Keno (RTP 98%, conferidas) ---------- */
  /* Wheel: RTP 98% em todas as combinações */
  var WHEEL_MED = {"10":[0,1.8,0,1.5,0,2,0,1.5,0,3],"20":[1.4,0,2,0,2,0,2,0,1.4,0,3,0,1.8,0,2,0,2,0,2,0],"30":[1.5,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.4,0,4,0,1.5,0,2,0],"40":[2,0,3,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0],"50":[2,0,1.5,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,1.5,0,4.5,0,1.5,0,2,0,1.5,0]};
  function wheelTable(n, risk) {
    if (risk === "medium") return WHEEL_MED[n].slice();
    var low = [1.4, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0], t = [];
    for (var i = 0; i < n; i++) t.push(risk === "high" ? (i === n - 1 ? Math.round(0.98 * n * 100) / 100 : 0) : low[i % 10]);
    return t;
  }
  function comb(n, k) { if (k < 0 || k > n) return 0; var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
  /* Keno: multiplicador por acertos, RTP 98% (nunca acima) */
  var KENO = {"low":[[0.69,1.85],[0,2,3.65],[0,1.1,1.32,25.96],[0,0,2.19,7.72,90],[0,0,1.5,4.11,13,295],[0,0,1.1,1.93,6.2,100,678],[0,0,1.1,1.6,3.5,14.84,200,700],[0,0,1.1,1.5,1.88,5.42,39,100,800],[0,0,1.1,1.3,1.63,2.38,7.5,50,250,1000],[0,0,1.1,1.2,1.3,1.62,3.5,13,50,250,1000]],"high":[[0,3.92],[0,0,16.98],[0,0,0,80.68],[0,0,0,9.77,259],[0,0,0,4.5,47.99,427],[0,0,0,0,10.58,350,710],[0,0,0,0,6.93,90,381,800],[0,0,0,0,5,19.28,270,600,900],[0,0,0,0,4,10.86,56,468,800,1000],[0,0,0,0,3.5,7.77,12.95,63,500,800,1000]],"medium":[[0.39,2.75],[0,1.79,5.05],[0,0,2.74,49.86],[0,0,1.68,9.91,100],[0,0,1.4,3.9,14,386],[0,0,0,3,8.98,176,710],[0,0,0,2,6.93,30,381,800],[0,0,0,2,3.88,10.98,67,400,900],[0,0,0,2,2.43,4.93,15,100,500,1000],[0,0,0,1.6,2,3.77,7,26,100,500,1000]],"classic":[[0,3.92],[0,1.9,4.32],[0,1,3.1,9.56],[0,0.8,1.8,4.76,22.43],[0,0.23,1.4,4.1,16.34,36],[0,0,0.97,3.68,7,16.48,40],[0,0,0.47,2.95,4.5,13.83,31,60],[0,0,0,2.2,4,12.23,22,55,70],[0,0,0,1.53,3,7.82,15,44,60,85],[0,0,0,1.4,2.18,4.5,8,16.86,50,80,100]]};
  function kenoTable(k, risk) { return (KENO[risk] || KENO.classic)[k - 1].slice(); }
  function kenoFrom(fs) { var a = []; for (var i = 1; i <= 40; i++) a.push(i); for (var j = 0; j < 10; j++) { var k = j + Math.floor(fs[j] * (40 - j)), t = a[j]; a[j] = a[k]; a[k] = t; } return a.slice(0, 10); }
  RD.fair.wheelTable = wheelTable; RD.fair.kenoTable = kenoTable; RD.fair.kenoFrom = kenoFrom;
  function multColor(m, high) { return m === 0 ? "#22324c" : high ? "#ff2e55" : m < 1.4 ? "#c9b8c2" : m < 1.6 ? "#22e08a" : m < 1.95 ? "#7aa7ff" : m < 2.5 ? "#ffc85c" : "#a07bff"; }

  /* ---------- WHEEL ---------- */
  OG.wheel = {
    label: function (b) { return b.multiplier.toFixed(2) + "×"; },
    cfg: function () {
      return {
        auto: true,
        side: '<div class="ogx-row2">' + selectField("wh-risk", "Risk", [["low", "Low"], ["medium", "Medium"], ["high", "High"]], ogPrefs.whRisk || "medium") + selectField("wh-seg", "Segments", [[10, "10"], [20, "20"], [30, "30"], [40, "40"], [50, "50"]], ogPrefs.whSeg || 30) + "</div>",
        center: '<div class="wh"><div class="wh-wrap" id="wh-wrap"><div class="wh-pin"></div><svg viewBox="-122 -122 244 244" id="wh-svg"><defs>' +
          '<linearGradient id="whBz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a4670"/><stop offset=".5" stop-color="#122040"/><stop offset="1" stop-color="#1d3356"/></linearGradient>' +
          '<radialGradient id="whHub" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#1d3356"/><stop offset="1" stop-color="#091426"/></radialGradient></defs>' +
          '<circle r="121" fill="url(#whBz)"/><circle r="121" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/><g class="wh-bulbs"><circle class="wb0" cx="113.00" cy="0.00" r="2.6"/><circle class="wb1" cx="109.15" cy="29.25" r="2.6"/><circle class="wb0" cx="97.86" cy="56.50" r="2.6"/><circle class="wb1" cx="79.90" cy="79.90" r="2.6"/><circle class="wb0" cx="56.50" cy="97.86" r="2.6"/><circle class="wb1" cx="29.25" cy="109.15" r="2.6"/><circle class="wb0" cx="0.00" cy="113.00" r="2.6"/><circle class="wb1" cx="-29.25" cy="109.15" r="2.6"/><circle class="wb0" cx="-56.50" cy="97.86" r="2.6"/><circle class="wb1" cx="-79.90" cy="79.90" r="2.6"/><circle class="wb0" cx="-97.86" cy="56.50" r="2.6"/><circle class="wb1" cx="-109.15" cy="29.25" r="2.6"/><circle class="wb0" cx="-113.00" cy="0.00" r="2.6"/><circle class="wb1" cx="-109.15" cy="-29.25" r="2.6"/><circle class="wb0" cx="-97.86" cy="-56.50" r="2.6"/><circle class="wb1" cx="-79.90" cy="-79.90" r="2.6"/><circle class="wb0" cx="-56.50" cy="-97.86" r="2.6"/><circle class="wb1" cx="-29.25" cy="-109.15" r="2.6"/><circle class="wb0" cx="-0.00" cy="-113.00" r="2.6"/><circle class="wb1" cx="29.25" cy="-109.15" r="2.6"/><circle class="wb0" cx="56.50" cy="-97.86" r="2.6"/><circle class="wb1" cx="79.90" cy="-79.90" r="2.6"/><circle class="wb0" cx="97.86" cy="-56.50" r="2.6"/><circle class="wb1" cx="109.15" cy="-29.25" r="2.6"/></g><circle r="107" fill="#091426"/>' +
          '<g id="wh-rot"></g><circle r="74" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="7"/><circle r="58" fill="url(#whHub)" stroke="rgba(255,255,255,.14)" stroke-width="2"/>' +
          '<text id="wh-res" y="8" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" style="font-family:var(--font-display)"></text><text id="wh-logo" y="7" text-anchor="middle" font-size="20" font-weight="900" fill="#fff" opacity=".85" style="font-family:var(--font-display)">RD</text></svg></div><div class="wh-legend" id="wh-legend"></div></div>'
      };
    },
    bind: function (ctx) {
      var rot = 0, spinning = false, spun = false;
      function n() { return +$("#wh-seg").value; }
      function risk() { return $("#wh-risk").value; }
      function draw() {
        var t = wheelTable(n(), risk()), N = t.length, R = 105, r = 77, out = "", hi = risk() === "high";
        t.forEach(function (m, i) {
          var a0 = (i / N) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2;
          out += '<path d="M' + (R * Math.cos(a0)).toFixed(2) + " " + (R * Math.sin(a0)).toFixed(2) + " A" + R + " " + R + " 0 0 1 " + (R * Math.cos(a1)).toFixed(2) + " " + (R * Math.sin(a1)).toFixed(2) + " L" + (r * Math.cos(a1)).toFixed(2) + " " + (r * Math.sin(a1)).toFixed(2) + " A" + r + " " + r + " 0 0 0 " + (r * Math.cos(a0)).toFixed(2) + " " + (r * Math.sin(a0)).toFixed(2) + 'Z" fill="' + multColor(m, hi && m > 0) + '" stroke="#0e090d" stroke-width="1.2"/>';
        });
        $("#wh-rot").innerHTML = out + '<circle r="' + r + '" fill="#0d182b"/>';
        if (!spun) rot = -180 / N; // parado: um segmento inteiro sob o ponteiro
        $("#wh-rot").style.transform = "rotate(" + rot + "deg)";
        var uniq = []; t.forEach(function (m) { if (uniq.indexOf(m) < 0) uniq.push(m); }); uniq.sort(function (a, b) { return a - b; });
        $("#wh-legend").innerHTML = uniq.map(function (m) { var c = t.filter(function (x) { return x === m; }).length; return '<div style="--c:' + multColor(m, hi && m > 0) + '"><b>' + m.toFixed(2) + "×</b></div>"; }).join("");
        ctx.setProfit(Math.max.apply(null, t), "max " + Math.max.apply(null, t).toFixed(2));
      }
      function change() { if (spinning) return; ogPrefs.whSeg = n(); ogPrefs.whRisk = risk(); savePrefs(); draw(); }
      $("#wh-seg").addEventListener("change", change); $("#wh-risk").addEventListener("change", change);
      draw();
      function play() {
        var a = ctx.amount(), t = wheelTable(n(), risk()), N = t.length, u = ctx.validate(a, Math.max.apply(null, t)); if (!u || spinning) return Promise.resolve(null);
        spinning = true; ctx.lock(true);
        return roll(u, "wheel", a, { segments: N, risk: risk() }, 1).then(function (s) {
          var fs = s.fs, nonce = s.nonce, client = s.client, seg = Math.floor(fs[0] * N), m = t[seg];
          var b = s.place(m, m > 0, { result: m, segment: seg, segments: N, risk: risk(), nonce: nonce, client: client });
          if (b.error) { spinning = false; ctx.lock(false); ctx.msg(b.error); return null; }
          ctx.hold(b);
          var segA = 360 / N, jitter = (Math.random() - 0.5) * segA * 0.6, target = -((seg + 0.5) * segA) + jitter;
          rot = rot - (rot % 360) + 360 * 4 + target; if (rot <= 0) rot += 360 * 5;
          var g = $("#wh-rot"); g.style.transition = "transform 2.4s cubic-bezier(.12,.75,.12,1)"; g.style.transform = "rotate(" + rot + "deg)";
          $("#wh-res").textContent = ""; $("#wh-logo").style.display = ""; $("#wh-wrap").classList.add("spin"); spun = true;
          return new Promise(function (res) {
            setTimeout(function () {
              spinning = false; ctx.lock(false); if (!$("#wh-res")) return res({ win: m > 1 });
              g.style.transition = "none"; $("#wh-wrap").classList.remove("spin"); $("#wh-logo").style.display = "none";
              $("#wh-res").textContent = m.toFixed(2) + "×"; $("#wh-res").setAttribute("fill", m > 0 ? multColor(m, risk() === "high") : "#ff7a59");
              ctx.record(b); res({ win: m > 1 });
            }, 2450);
          });
        });
      }
      return { refresh: function () { var t = wheelTable(n(), risk()); ctx.setProfit(Math.max.apply(null, t), "max " + Math.max.apply(null, t).toFixed(2)); }, play: play, cooldown: 100 };
    }
  };

  /* ---------- KENO ---------- */
  OG.keno = {
    label: function (b) { return b.detail.hits + "/" + b.detail.picks; },
    cfg: function () {
      var tiles = ""; for (var i = 1; i <= 40; i++) tiles += '<button class="kn-tile" data-kn="' + i + '">' + i + "</button>";
      return {
        auto: true,
        side: selectField("kn-risk", "Risk", [["classic", "Classic"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]], ogPrefs.knRisk || "classic") +
          '<label class="og-turbo"><span>' + ic("zap", 15) + 'Turbo</span><input type="checkbox" id="kn-turbo"' + (ogPrefs.knTurbo ? " checked" : "") + '><i class="sw"></i></label>',
        after: '<div class="ogx-row2"><button class="btn btn-secondary" style="height:42px" id="kn-auto">Auto pick</button><button class="btn btn-secondary" style="height:42px" id="kn-clear">Clear</button></div>',
        center: '<div class="kn"><div class="kn-grid" id="kn-grid">' + tiles + '</div><div class="kn-pay" id="kn-pay"></div></div>'
      };
    },
    bind: function (ctx) {
      var picks = (ogPrefs.knPicks || []).slice(0, 10), busyK = false;
      $("#kn-turbo").addEventListener("change", function () { ogPrefs.knTurbo = this.checked; savePrefs(); });
      function risk() { return $("#kn-risk").value; }
      function paint(drawn, hitsShown) {
        if (!$("#kn-pay")) return;
        $$("#kn-grid .kn-tile").forEach(function (t) {
          var n = +t.getAttribute("data-kn"), sel = picks.indexOf(n) > -1, d = drawn && drawn.indexOf(n) > -1;
          t.className = "kn-tile" + (sel ? " sel" : "") + (d && sel ? " hit" : d ? " drawn" : "");
        });
        var k = picks.length, box = $("#kn-pay");
        if (!k) { box.innerHTML = '<div class="kn-empty">Select 1 to 10 numbers</div>'; ctx.setProfit(1, "0.00"); return; }
        var t = kenoTable(k, risk());
        box.innerHTML = t.map(function (m, h) { return '<div class="' + (hitsShown === h ? "on" : "") + '"><b>' + (m >= 100 ? Math.round(m) : m.toFixed(2)) + "×</b><small>" + h + " hits</small></div>"; }).join("");
        ctx.setProfit(Math.max.apply(null, t), "max " + Math.max.apply(null, t));
      }
      function save() { ogPrefs.knPicks = picks; savePrefs(); }
      $("#kn-grid").addEventListener("click", function (e) {
        var t = e.target.closest("[data-kn]"); if (!t || busyK) return;
        var n = +t.getAttribute("data-kn"), i = picks.indexOf(n);
        if (i > -1) picks.splice(i, 1); else if (picks.length < 10) picks.push(n); else return ctx.msg("You can pick up to 10 numbers.");
        ctx.msg(""); save(); paint();
      });
      $("#kn-clear").addEventListener("click", function () { if (busyK) return; picks = []; save(); paint(); });
      $("#kn-auto").addEventListener("click", function () {
        if (busyK) return; var pool = []; for (var i = 1; i <= 40; i++) pool.push(i);
        picks = []; while (picks.length < 10) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); save(); paint();
      });
      $("#kn-risk").addEventListener("change", function () { ogPrefs.knRisk = risk(); savePrefs(); paint(); });
      paint();
      function play() {
        if (busyK) return Promise.resolve(null);
        if (!picks.length) { ctx.msg("Select at least 1 number."); return Promise.resolve(null); }
        var a = ctx.amount(), t = kenoTable(picks.length, risk()), u = ctx.validate(a); if (!u) return Promise.resolve(null);
        busyK = true; ctx.lock(true);
        return roll(u, "keno", a, { picks: picks.slice(), risk: risk() }, 10).then(function (s) {
          var fs = s.fs, nonce = s.nonce, client = s.client, drawn = kenoFrom(fs), hits = drawn.filter(function (n) { return picks.indexOf(n) > -1; }).length, m = capMult(a, t[hits]);
          var b = s.place(m, m > 0, { result: hits, hits: hits, picks: picks.length, drawn: drawn, risk: risk(), nonce: nonce, client: client });
          if (b.error) { busyK = false; ctx.lock(false); ctx.msg(b.error); return null; }
          ctx.hold(b);
          paint([]);
          return new Promise(function (res) {
            var i = 0;
            (function next() {
              if (!$("#kn-grid")) { busyK = false; return res({ win: m > 1 }); }
              i++; paint(drawn.slice(0, i), i === 10 ? hits : null); RD.sfx.play(picks.indexOf(drawn[i - 1]) > -1 ? "gem" : "tick", 0);
              if (i < 10) return setTimeout(next, ogPrefs.knTurbo ? 45 : 190); // ritmo normal parecido com a Stake; Turbo = rápido
              busyK = false; ctx.lock(false); ctx.record(b); res({ win: m > 1 });
            })();
          });
        });
      }
      return { refresh: function () { if (picks.length) { var t = kenoTable(picks.length, risk()); ctx.setProfit(Math.max.apply(null, t), "max " + Math.max.apply(null, t)); } }, play: play, cooldown: 120 };
    }
  };

  /* ---------- BLACKJACK (baralho infinito, dealer para em 17, BJ paga 3:2) ---------- */
  function bjVal(r) { return r === 1 ? 11 : r > 10 ? 10 : r; }
  function bjTotal(cards) { var t = 0, aces = 0; cards.forEach(function (c) { t += bjVal(c.rank); if (c.rank === 1) aces++; }); while (t > 21 && aces) { t -= 10; aces--; } return { t: t, soft: aces > 0 }; }
  function bjCard(c, hidden) { return pcard(c, { hidden: hidden, cls: "bj-card" }); }
  OG.blackjack = {
    label: function (b) { return b.detail.outcome || b.multiplier.toFixed(2) + "×"; },
    cfg: function () {
      return {
        after: '<div class="bj-actions"><button class="btn btn-secondary" id="bj-hit" disabled>' + ic("plus", 16) + 'Hit</button><button class="btn btn-secondary" id="bj-stand" disabled>' + ic("ban", 16) + 'Stand</button><button class="btn btn-secondary" id="bj-split" disabled>' + ic("swap", 16) + 'Split</button><button class="btn btn-secondary" id="bj-double" disabled>' + ic("coins", 16) + "Double</button></div>",
        center: '<div class="bj"><div class="bj-side"><div class="bj-cards" id="bj-dealer"></div><span class="bj-val" id="bj-dval"></span></div><div class="bj-mid"><div class="bj-rules">Blackjack pays 3 to 2 · Dealer hits soft 17 · Insurance pays 2 to 1</div><div class="bj-ins hidden" id="bj-ins"><span>Dealer shows an Ace. <b>Insurance?</b><small id="bj-ins-cost"></small></span><div><button class="btn btn-gold btn-sm" id="bj-ins-yes">Accept</button><button class="btn btn-secondary btn-sm" id="bj-ins-no">No thanks</button></div></div><div class="bj-result hidden" id="bj-result"></div></div><div class="bj-hands" id="bj-hands"></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "blackjack", S = null, busyB = false; // S: {cursor, dealer, hands:[{cards,bet,done,doubled}], active, over}
      function u() { return me(); }
      function draw(n) { var r = db.activeRound(u().id, G); return floats(r.server, r.client, r.nonce, S.cursor + n).then(function (fs) { var out = []; for (var i = 0; i < n; i++) out.push(cardFrom(fs[S.cursor + i])); S.cursor += n; return out; }); }
      /* Mesa animada: as cartas entram uma de cada vez (fila), a do dealer vira no fim.
         render() só agenda; o que já está na mesa não é redesenhado (sem piscar). */
      var view = null, q = Promise.resolve(), animating = 0;
      function snap(reveal) { return S ? { reveal: !!reveal, dealer: S.dealer.map(function (c) { return { rank: c.rank, suit: c.suit }; }), hands: S.hands.map(function (h) { return { cards: h.cards.slice(), res: h.res }; }), active: S.active, over: S.over } : null; }
      function render(reveal) { var sn = snap(reveal); animating++; buttons(); q = q.then(function () { return sync(sn); }).then(function () { animating--; buttons(); }); return q; }
      function valTxt(cards) { var v = bjTotal(cards); return v.soft && v.t < 21 ? v.t - 10 + "/" + v.t : String(v.t); }
      function handHtml(cards) { return '<div class="bj-hand"><div class="bj-cards">' + cards.map(function (c) { return bjCard(c); }).join("") + '</div><span class="bj-val' + (cards.length ? "" : " hidden") + '">' + (cards.length ? valTxt(cards) : "") + "</span></div>"; }
      function paintVals(sn) {
        var dv = $("#bj-dval"); if (!dv) return;
        var dShown = view.hole && view.dealer.length > 1 ? [view.dealer[0]] : view.dealer;
        dv.textContent = dShown.length ? valTxt(dShown) : ""; dv.classList.toggle("hidden", !dShown.length);
        $$("#bj-hands .bj-hand").forEach(function (el, i) {
          var cards = view.hands[i] || [], v = el.querySelector(".bj-val");
          v.textContent = cards.length ? valTxt(cards) : ""; v.classList.toggle("hidden", !cards.length);
          var res = sn && sn.over !== undefined && sn.hands[i] ? sn.hands[i].res : null;
          el.className = "bj-hand" + (sn && view.hands.length > 1 && i === sn.active && !sn.over ? " active" : "") + (res ? " " + res : "") + (cards.length && bjTotal(cards).t > 21 ? " bust" : "");
        });
      }
      function sync(sn) {
        return new Promise(function (resolve) {
          var dEl = $("#bj-dealer"), hEl = $("#bj-hands"); if (!dEl) return resolve();
          if (!sn) { if (!view) { dEl.innerHTML = '<div class="bj-card pc ghost"></div><div class="bj-card pc ghost"></div>'; hEl.innerHTML = '<div class="bj-hand"><div class="bj-cards"><div class="bj-card pc ghost"></div><div class="bj-card pc ghost"></div></div></div>'; $("#bj-dval").classList.add("hidden"); } return resolve(); }
          if (!view) { view = { dealer: [], hole: true, hands: sn.hands.map(function () { return []; }) }; dEl.innerHTML = ""; hEl.innerHTML = view.hands.map(handHtml).join(""); }
          if (view.hands.length !== sn.hands.length) { // split: cada mão começa com uma das cartas que já estavam na mesa
            view.hands = sn.hands.map(function (h) { return [h.cards[0]]; }); hEl.innerHTML = view.hands.map(handHtml).join("");
          }
          var steps = [], i, k;
          if (!view.dealer.length && view.hands.every(function (h) { return !h.length; })) {
            for (k = 0; k < 2; k++) { sn.hands.forEach(function (h, hi) { if (h.cards[k]) steps.push({ h: hi, c: h.cards[k] }); }); if (sn.dealer[k]) steps.push({ d: k, c: sn.dealer[k] }); }
            sn.hands.forEach(function (h, hi) { for (var x = 2; x < h.cards.length; x++) steps.push({ h: hi, c: h.cards[x] }); });
            for (k = 2; k < sn.dealer.length; k++) steps.push({ d: k, c: sn.dealer[k] });
          } else {
            sn.hands.forEach(function (h, hi) { for (var x = view.hands[hi].length; x < h.cards.length; x++) steps.push({ h: hi, c: h.cards[x] }); });
            if (sn.reveal && view.hole && view.dealer.length > 1) steps.push({ flip: true, c: sn.dealer[1] });
            for (k = view.dealer.length; k < sn.dealer.length; k++) steps.push({ d: k, c: sn.dealer[k] });
          }
          if (sn.reveal && view.hole && view.dealer.length < 2 && sn.dealer.length > 1) view.hole = false;
          (function run(n) {
            if (!$("#bj-dealer")) return resolve();
            if (n >= steps.length) { paintVals(sn); return resolve(); }
            var st = steps[n];
            if (st.flip) {
              var hole = $$("#bj-dealer .pc")[1]; if (hole) { hole.outerHTML = pcard(st.c, { hidden: true, cls: "bj-card" }); hole = $$("#bj-dealer .pc")[1]; void hole.offsetWidth; hole.classList.remove("hid"); }
              view.hole = false; view.dealer[1] = st.c; RD.sfx.play("card");
            } else {
              var box = st.d !== undefined ? dEl : hEl.querySelectorAll(".bj-cards")[st.h], hidden = st.d === 1 && !sn.reveal;
              if (box) { box.insertAdjacentHTML("beforeend", pcard(st.c, { hidden: true, cls: "bj-card deal" })); var el = box.lastElementChild; if (!hidden) setTimeout(function () { el.classList.remove("hid"); }, 140); }
              if (st.d !== undefined) { view.dealer.push(st.c); if (st.d === 1) view.hole = hidden; } else view.hands[st.h].push(st.c);
              RD.sfx.play("card", 0);
            }
            paintVals(sn);
            setTimeout(function () { run(n + 1); }, n + 1 < steps.length ? 420 : 300);
          })(0);
        });
      }
      function buttons() {
        if (!$("#bj-dealer")) return;
        var insOpen = !!(S && S.ins === "offer" && !S.over && !animating), box = $("#bj-ins");
        box.classList.toggle("hidden", !insOpen);
        if (insOpen) { $("#bj-ins-cost").textContent = "Costs " + money(insCost()) + " · pays " + money(insCost() * 3) + " if the dealer has Blackjack"; $("#bj-ins-yes").disabled = (u() ? u().balance : 0) < insCost(); }
        var h = S && !S.over && !insOpen && !animating && !busyB ? S.hands[S.active] : null, bal = u() ? u().balance : 0;
        $("#bj-hit").disabled = !h; $("#bj-stand").disabled = !h;
        $("#bj-double").disabled = !(h && S.hands.length === 1 && h.cards.length === 2 && bal >= h.bet);
        $("#bj-split").disabled = !(h && S.hands.length === 1 && h.cards.length === 2 && bjVal(h.cards[0].rank) === bjVal(h.cards[1].rank) && bal >= h.bet);
        var b = ctx.btn(); if (b) b.disabled = animating > 0 || !!(S && !S.over);
      }
      function newTable() { view = null; var r0 = $("#bj-result"); if (r0) r0.className = "bj-result hidden"; }
      function showResult(outcome, total, amount) {
        var r = $("#bj-result"); if (!r) return;
        r.className = "bj-result " + (total > amount ? "w" : total === amount ? "p" : "l");
        r.textContent = outcome === "Blackjack" ? "Blackjack! +" + money(total - amount) : outcome === "Insured" ? "Dealer Blackjack — insurance paid" + (total > amount ? " +" + money(total - amount) : "") : outcome === "Win" ? "You win +" + money(total - amount) : outcome === "Push" ? "Push" : "Dealer wins";
      }
      function persist() { db.updateRound(u().id, G, S); }
      /* Seguro: metade da aposta, paga 2:1 se o dealer tiver Blackjack */
      function insCost() { return Math.round(S.hands[0].bet * 50) / 100; }
      function peek() {
        var p = bjTotal(S.hands[0].cards).t, d = bjTotal(S.dealer).t;
        if (p === 21 || (d === 21 && (S.dealer[0].rank === 1 || bjVal(S.dealer[0].rank) === 10))) { busyB = true; persist(); render(); return setTimeout(finish, 500); }
        if (S.ins === "taken") { S.ins = "lost"; ctx.msg(""); RD.toast("Dealer doesn't have Blackjack — insurance lost"); }
        persist(); render();
      }
      /* ---- Modo real: o servidor tem o baralho e a carta escondida do dealer; aqui só mostramos ---- */
      function fromServer(x) {
        S = { dealer: x.over ? x.dealer : [x.dealer[0], { rank: 1, suit: 0 }], active: x.active, ins: x.ins, insBet: +x.insBet || 0, over: !!x.over, live: true,
          hands: x.hands.map(function (h) { return { cards: h.cards, bet: +h.bet, done: h.done }; }) };
      }
      function liveDo(action, params) {
        busyB = true;
        return db.roundAct(G, action, params).then(function (x) {
          if (x.error) { busyB = false; ctx.msg(x.error); render(); return; }
          renderHeader(); ctx.refresh(); liveShow(x);
        });
      }
      function liveShow(x) {
        if (!x.over) { fromServer(x); busyB = false; if (x.ins === "lost") RD.toast("Dealer doesn't have Blackjack — insurance lost"); render(); return; }
        busyB = true; liveFinish(x);
      }
      function liveFinish(x) {
        var bet = db.settleRound(u().id, G) || x.bet; fromServer(x); S.over = true; S.dealer = x.dealer; S.hands.forEach(function (h, i) { h.res = x.hands[i].res; });
        var shown = render(true); S = null; busyB = false;
        shown.then(function () { showResult(bet.detail.outcome, bet.payout, bet.amount); ctx.lock(false); buttons(); ctx.record(bet); });
      }
      function insurance(take) {
        if (!S || S.ins !== "offer" || busyB) return;
        if (RD.live) return liveDo("insurance", { take: !!take });
        if (take) {
          var c = insCost(), r = db.addToRound(u().id, G, c); if (r.error) return ctx.msg(r.error);
          S.insBet = c; S.ins = "taken"; renderHeader(); ctx.refresh();
        } else S.ins = "declined";
        peek();
      }
      $("#bj-ins-yes").addEventListener("click", function () { insurance(true); });
      $("#bj-ins-no").addEventListener("click", function () { insurance(false); });
      function finish() {
        S.over = true;
        var d = bjTotal(S.dealer).t, total = 0, base = S.hands[0].bet, natural = S.hands.length === 1 && S.hands[0].cards.length === 2 && bjTotal(S.hands[0].cards).t === 21;
        var dealerBJ = S.dealer.length === 2 && d === 21;
        S.hands.forEach(function (h) {
          var v = bjTotal(h.cards).t, pay = 0;
          if (v > 21) { pay = 0; h.res = "lose"; }
          else if (natural && !dealerBJ) { pay = h.bet * 2.5; h.res = "win"; }
          else if (dealerBJ && !natural) { pay = 0; h.res = "lose"; }
          else if (d > 21 || v > d) { pay = h.bet * 2; h.res = "win"; }
          else if (v === d) { pay = h.bet; h.res = "push"; }
          else { pay = 0; h.res = "lose"; }
          total += pay;
        });
        var ins = S.insBet || 0, insWon = ins > 0 && dealerBJ;
        if (insWon) total += ins * 3;
        var amount = S.hands.reduce(function (a, h) { return a + h.bet; }, 0) + ins, mult = capMult(amount, Math.round((total / amount) * 10000) / 10000);
        var outcome = natural && !dealerBJ ? "Blackjack" : insWon ? "Insured" : total > amount ? "Win" : total === amount ? "Push" : "Lose";
        var bet = db.settleRound(u().id, G, mult, total > 0, { outcome: outcome, player: S.hands.map(function (h) { return bjTotal(h.cards).t; }).join("/"), dealer: d, insurance: ins || undefined });
        var shown = render(true); S = null; busyB = false;
        shown.then(function () { showResult(outcome, total, amount); ctx.lock(false); buttons(); ctx.record(bet); });
      }
      function dealerPlay() {
        render(true);
        var allBust = S.hands.every(function (h) { return bjTotal(h.cards).t > 21; });
        if (allBust) return finish();
        (function step() {
          var dt = bjTotal(S.dealer); if (dt.t > 17 || (dt.t === 17 && !dt.soft)) return finish();
          draw(1).then(function (c) { S.dealer.push(c[0]); persist(); render(true); setTimeout(step, 420); });
        })();
      }
      function nextHand() {
        while (S.hands[S.active].done && S.active < S.hands.length - 1) S.active++;
        if (S.hands[S.active].done) { busyB = true; persist(); return dealerPlay(); }
        persist(); render();
      }
      function act(kind) {
        if (!S || S.over || busyB || animating || S.ins === "offer") return; busyB = true;
        if (RD.live) return liveDo(kind);
        var h = S.hands[S.active];
        if (kind === "stand") { h.done = true; busyB = false; return nextHand(); }
        if (kind === "double" && S.hands.length > 1) { busyB = false; return ctx.msg("You can't double after a split."); }
        if (kind === "double") { var r1 = db.addToRound(u().id, G, h.bet); if (r1.error) { busyB = false; return ctx.msg(r1.error); } h.bet *= 2; renderHeader(); ctx.refresh(); }
        if (kind === "split") {
          var r2 = db.addToRound(u().id, G, h.bet); if (r2.error) { busyB = false; return ctx.msg(r2.error); } renderHeader(); ctx.refresh();
          var aces = h.cards[0].rank === 1;
          return draw(2).then(function (cs) {
            S.hands = [{ cards: [h.cards[0], cs[0]], bet: h.bet, done: aces }, { cards: [h.cards[1], cs[1]], bet: h.bet, done: aces }];
            S.hands.forEach(function (x) { if (bjTotal(x.cards).t === 21) x.done = true; });
            busyB = false; if (S.hands[0].done) { S.active = 0; return nextHand(); } persist(); render();
          });
        }
        draw(1).then(function (c) {
          h.cards.push(c[0]); var v = bjTotal(h.cards).t;
          if (kind === "double" || v >= 21) h.done = true;
          busyB = false; nextHand();
        });
      }
      ["hit", "stand", "double", "split"].forEach(function (k) { $("#bj-" + k).addEventListener("click", function () { act(k); }); });
      function start() {
        var a = ctx.amount(), us = ctx.validate(a); if (!us || busyB) return;
        if (RD.live) {
          busyB = true;
          return db.roundStart(G, a, {}).then(function (x) {
            busyB = false; if (x.error) return ctx.msg(x.error);
            renderHeader(); ctx.refresh(); ctx.lock(true); newTable(); liveShow(x);
          });
        }
        var r = db.startRound(us.id, G, a, {}); if (r.error) return ctx.msg(r.error);
        renderHeader(); ctx.refresh(); deal(a);
      }
      function deal(a) {
        ctx.lock(true); newTable(); busyB = true;
        S = { cursor: 0, dealer: [], hands: [{ cards: [], bet: a, done: false }], active: 0, over: false };
        draw(4).then(function (c) {
          busyB = false;
          S.hands[0].cards = [c[0], c[2]]; S.dealer = [c[1], c[3]];
          if (S.dealer[0].rank === 1) { S.ins = "offer"; persist(); return render(); }
          peek();
        });
      }
      render();
      return {
        refresh: function () {},
        click: function () { if (!S && !animating) start(); },
        resume: function () {
          var us = u(), r = us && db.activeRound(us.id, G);
          if (!r) return;
          if (RD.live) { busyB = true; return db.roundAct(G, "view").then(function (x) { busyB = false; if (x.error) return; $("#og-amt").value = amtIn((+x.hands[0].bet)); ctx.lock(true); liveShow(x); }); }
          if (!(r.state && r.state.hands && r.state.hands[0].cards.length)) { $("#og-amt").value = amtIn(r.amount); return deal(r.amount); }
          S = r.state; $("#og-amt").value = amtIn(S.hands[0].bet); ctx.lock(true); render();
          if (S.ins === "offer") return;
          var p0 = bjTotal(S.hands[0].cards).t, d0 = bjTotal(S.dealer).t;
          if (S.hands.length === 1 && S.hands[0].cards.length === 2 && S.dealer.length === 2 && (p0 === 21 || (d0 === 21 && (S.dealer[0].rank === 1 || bjVal(S.dealer[0].rank) === 10)))) { busyB = true; return setTimeout(finish, 400); }
          if (S.hands.every(function (h) { return h.done; })) { busyB = true; dealerPlay(); }
        }
      };
    }
  };

  /* ---------- ROULETTE (europeia, um zero) ---------- */
  var RL_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var RL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  function rlWins(key, n) {
    if (key.indexOf("n:") === 0) return +key.slice(2) === n;
    if (n === 0) return false;
    if (key === "red") return RL_RED.indexOf(n) > -1; if (key === "black") return RL_RED.indexOf(n) < 0;
    if (key === "even") return n % 2 === 0; if (key === "odd") return n % 2 === 1;
    if (key === "low") return n <= 18; if (key === "high") return n >= 19;
    if (key.indexOf("doz:") === 0) return Math.ceil(n / 12) === +key.slice(4);
    if (key.indexOf("col:") === 0) return ((n - 1) % 3) + 1 === +key.slice(4);
    return false;
  }
  function rlPays(key) { return key.indexOf("n:") === 0 ? 36.26 : key.indexOf("doz:") === 0 || key.indexOf("col:") === 0 ? 3.0216 : 2.0144; } // RTP 98%
  function rlColor(n) { return n === 0 ? "g" : RL_RED.indexOf(n) > -1 ? "r" : "b"; }
  OG.roulette = {
    label: function (b) { var n = b.detail.result; return '<b class="rl-n ' + rlColor(n) + '">' + n + "</b>"; },
    cfg: function () {
      var cell = function (key, txt, cls, st) { return '<button class="rl-cell ' + (cls || "") + '" data-rl="' + key + '"' + (st ? ' style="' + st + '"' : "") + "><span>" + txt + '</span><i class="rl-chip hidden"></i></button>'; };
      var grid = cell("n:0", "0", "g", "grid-row:1/4;grid-column:1");
      for (var c = 0; c < 12; c++) for (var r = 0; r < 3; r++) { var n = c * 3 + (3 - r); grid += cell("n:" + n, n, rlColor(n), "grid-row:" + (r + 1) + ";grid-column:" + (c + 2)); }
      for (var k = 0; k < 3; k++) grid += cell("col:" + (3 - k), "2:1", "o", "grid-row:" + (k + 1) + ";grid-column:14");
      for (var d = 1; d <= 3; d++) grid += cell("doz:" + d, ["1 to 12", "13 to 24", "25 to 36"][d - 1], "o", "grid-row:4;grid-column:" + (2 + (d - 1) * 4) + "/span 4");
      [["low", "1 to 18"], ["even", "Even"], ["red", "", "r"], ["black", "", "b"], ["odd", "Odd"], ["high", "19 to 36"]].forEach(function (x, i) { grid += cell(x[0], x[1], "o " + (x[2] || ""), "grid-row:5;grid-column:" + (2 + i * 2) + "/span 2"); });
      return {
        auto: true, amountLabel: "Chip value",
        side: '<div><div class="ogx-label">Total bet</div><div class="ogx-input ro"><span class="cur">' + curSym() + '</span><input id="rl-total" readonly value="0.00"></div></div>',
        after: '<div class="ogx-row2"><button class="btn btn-secondary" style="height:42px" id="rl-undo">Undo</button><button class="btn btn-secondary" style="height:42px" id="rl-clear">Clear</button></div>',
        center: '<div class="rl"><div class="rl-top"><div class="rl-wheel"><div class="wh-pointer"></div><svg viewBox="-112 -112 224 224"><defs><linearGradient id="rlWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4a24"/><stop offset=".5" stop-color="#4a2a12"/><stop offset="1" stop-color="#2a170a"/></linearGradient><radialGradient id="rlTrack" r=".5"><stop offset=".88" stop-color="#1a1410"/><stop offset="1" stop-color="#3a2a1c"/></radialGradient></defs><circle r="111" fill="url(#rlWood)"/><circle r="111" fill="none" stroke="#c9a24a" stroke-width="1.5"/><circle r="109" fill="url(#rlTrack)"/><circle r="101.5" fill="none" stroke="#c9a24a" stroke-opacity=".7" stroke-width="1"/><g id="rl-rot"></g><g id="rl-ball" class="hidden"><circle r="5.2" fill="#000" opacity=".35" cx="1" cy="1.5"/><circle r="5.2" fill="#f4f1ee"/><circle r="1.8" cx="-1.6" cy="-1.6" fill="#fff"/></g></svg><div class="rl-out" id="rl-out"></div></div></div><div class="rl-table" id="rl-table">' + grid + "</div></div>"
      };
    },
    bind: function (ctx) {
      var bets = {}, hist = [], rot = -180 / 37, spinning = false; // parado: o 0 fica centralizado sob o ponteiro
      /* Bolinha: gira no sentido contrário da roda, perde velocidade, desce para os números e para no topo (onde fica o ponteiro) */
      function ballAt(angle, radius) { var b = $("#rl-ball"); if (!b) return; var a = (angle - 90) * Math.PI / 180; b.setAttribute("transform", "translate(" + (radius * Math.cos(a)).toFixed(2) + " " + (radius * Math.sin(a)).toFixed(2) + ")"); }
      function spinBall(ms) {
        var b = $("#rl-ball"); if (!b) return; b.classList.remove("hidden");
        var t0 = performance.now(), turns = 6;
        (function step(now) {
          if (!document.contains(b)) return;
          var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
          var angle = -360 * turns * (1 - e), radius = k < 0.62 ? 106 : k < 0.86 ? 106 - (k - 0.62) / 0.24 * 32 + Math.sin(k * 60) * 2.2 * (0.86 - k) / 0.24 : 74;
          ballAt(angle, radius);
          if (k < 1) requestAnimationFrame(step);
        })(t0);
      }
      (function wheel() {
        /* roda realista: casas numeradas com divisórias douradas, anel interno, cone de madeira e torre dourada */
        var out = "", frets = "", N = 37, R = 100, r = 79, r2 = 68;
        RL_ORDER.forEach(function (n, i) {
          var a0 = (i / N) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2, am = (a0 + a1) / 2;
          var col = n === 0 ? "#16a34a" : RL_RED.indexOf(n) > -1 ? "#d61f45" : "#15121a";
          var P = function (rr, a) { return (rr * Math.cos(a)).toFixed(2) + " " + (rr * Math.sin(a)).toFixed(2); };
          out += '<path d="M' + P(R, a0) + " A" + R + " " + R + " 0 0 1 " + P(R, a1) + " L" + P(r, a1) + " A" + r + " " + r + " 0 0 0 " + P(r, a0) + 'Z" fill="' + col + '"/>' +
            '<path d="M' + P(r, a0) + " A" + r + " " + r + " 0 0 1 " + P(r, a1) + " L" + P(r2, a1) + " A" + r2 + " " + r2 + " 0 0 0 " + P(r2, a0) + 'Z" fill="' + col + '" opacity=".55"/>' +
            '<text x="' + (90 * Math.cos(am)).toFixed(2) + '" y="' + (90 * Math.sin(am)).toFixed(2) + '" font-size="7.4" font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="central" transform="rotate(' + ((am * 180) / Math.PI + 90).toFixed(1) + " " + (90 * Math.cos(am)).toFixed(2) + " " + (90 * Math.sin(am)).toFixed(2) + ')" style="font-family:var(--font-display,Arial)">' + n + "</text>";
          frets += '<path d="M' + P(R, a0) + " L" + P(r2, a0) + '"/>';
        });
        $("#rl-rot").innerHTML = '<defs><radialGradient id="rlCone" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#8a5a32"/><stop offset=".6" stop-color="#5a3519"/><stop offset="1" stop-color="#2e1a0b"/></radialGradient><linearGradient id="rlGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a6"/><stop offset=".5" stop-color="#d4a73c"/><stop offset="1" stop-color="#8a6416"/></linearGradient></defs>' +
          '<circle r="' + R + '" fill="#0d0a10"/>' + out + '<g stroke="url(#rlGold)" stroke-width="1.1" opacity=".9">' + frets + "</g>" +
          '<circle r="' + R + '" fill="none" stroke="url(#rlGold)" stroke-width="1.6"/><circle r="' + r + '" fill="none" stroke="url(#rlGold)" stroke-width="1.2"/><circle r="' + r2 + '" fill="none" stroke="url(#rlGold)" stroke-width="1.6"/>' +
          '<circle r="' + (r2 - 1) + '" fill="url(#rlCone)"/><circle r="44" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/>' +
          '<g fill="url(#rlGold)"><rect x="-3" y="-34" width="6" height="68" rx="3"/><rect x="-34" y="-3" width="68" height="6" rx="3"/><circle cx="0" cy="-34" r="5"/><circle cx="0" cy="34" r="5"/><circle cx="-34" cy="0" r="5"/><circle cx="34" cy="0" r="5"/><circle r="11"/></g><circle r="5" fill="#fff6d6" opacity=".8"/>';
        $("#rl-rot").style.transform = "rotate(" + rot + "deg)";
      })();
      function total() { var t = 0; for (var k in bets) t += bets[k]; return Math.round(t * 100) / 100; }
      function paintChips(winKeys) {
        $$("#rl-table [data-rl]").forEach(function (c) {
          var k = c.getAttribute("data-rl"), v = bets[k], chipEl = c.querySelector(".rl-chip");
          chipEl.classList.toggle("hidden", !v); if (v) chipEl.style.setProperty("--cc", chipColor(v)); chipEl.textContent = v ? (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v >= 10 ? Math.round(v) : v.toFixed(v < 1 ? 2 : 1)) : "";
          c.classList.toggle("win", !!winKeys && winKeys.indexOf(k) > -1);
        });
        $("#rl-total").value = amtIn(total());
      }
      $("#rl-table").addEventListener("click", function (e) {
        var c = e.target.closest("[data-rl]"); if (!c || spinning) return;
        var k = c.getAttribute("data-rl"), v = ctx.amount(); if (v < 0.01) return ctx.msg("Set a chip value first.");
        bets[k] = Math.round(((bets[k] || 0) + v) * 100) / 100; hist.push([k, v]); ctx.msg(""); paintChips();
      });
      $("#rl-undo").addEventListener("click", function () { if (spinning) return; var h = hist.pop(); if (!h) return; bets[h[0]] = Math.round((bets[h[0]] - h[1]) * 100) / 100; if (bets[h[0]] <= 0) delete bets[h[0]]; paintChips(); });
      $("#rl-clear").addEventListener("click", function () { if (spinning) return; bets = {}; hist = []; paintChips(); });
      function play() {
        var t = total(); if (!t) { ctx.msg("Place chips on the table first."); return Promise.resolve(null); }
        var u = ctx.validate(t); if (!u || spinning) return Promise.resolve(null);
        spinning = true; ctx.lock(true);
        return roll(u, "roulette", t, { bets: JSON.parse(JSON.stringify(bets)) }, 1).then(function (s) {
          var fs = s.fs, nonce = s.nonce, client = s.client, n = Math.floor(fs[0] * 37), payout = 0, wins = [];
          for (var k in bets) if (rlWins(k, n)) { payout += bets[k] * rlPays(k); wins.push(k); }
          var mult = capMult(t, Math.round((payout / t) * 10000) / 10000);
          var b = s.place(mult, payout > 0, { result: n, bets: JSON.parse(JSON.stringify(bets)), nonce: nonce, client: client });
          if (b.error) { spinning = false; ctx.lock(false); ctx.msg(b.error); return null; }
          ctx.hold(b);
          var i = RL_ORDER.indexOf(n), segA = 360 / 37, target = -((i + 0.5) * segA);
          rot = rot - (rot % 360) + 360 * 4 + target; if (rot <= 0) rot += 360 * 5;
          var g = $("#rl-rot"); g.style.transition = "transform 3.4s cubic-bezier(.12,.75,.12,1)"; g.style.transform = "rotate(" + rot + "deg)";
          spinBall(3400);
          $("#rl-out").className = "rl-out"; $("#rl-out").textContent = "";
          return new Promise(function (res) {
            setTimeout(function () {
              spinning = false; ctx.lock(false); if (!$("#rl-out")) return res({ win: payout > t });
              g.style.transition = "none"; $("#rl-out").className = "rl-out show " + rlColor(n); $("#rl-out").textContent = n;
              paintChips(wins); ctx.record(b); res({ win: payout > t });
            }, 3450);
          });
        });
      }
      paintChips();
      return { refresh: function () { if ($("#og-mult-lbl")) ctx.setProfit(1); }, play: play, cooldown: 100 };
    }
  };

  /* ---------- TOWER (tabelas da Stake: 9 andares, RTP 98%) ---------- */
  var TOWER = {
    easy: { tiles: 4, eggs: 3, mult: [1.3, 1.74, 2.32, 3.09, 4.12, 5.5, 7.34, 9.78, 13.05] },
    medium: { tiles: 3, eggs: 2, mult: [1.47, 2.2, 3.3, 4.96, 7.44, 11.16, 16.74, 25.11, 37.67] },
    hard: { tiles: 2, eggs: 1, mult: [1.96, 3.92, 7.84, 15.68, 31.36, 62.72, 125.44, 250.88, 501.76] },
    expert: { tiles: 3, eggs: 1, mult: [2.94, 8.82, 26.46, 79.38, 238.14, 714.42, 2143.26, 6429.78, 19289.3] },
    master: { tiles: 4, eggs: 1, mult: [3.92, 15.68, 62.72, 250.88, 1003.52, 4014.08, 16056.3, 64225.3, 256901.12] }
  };
  /* Cada andar: embaralha as casas (Fisher–Yates) com (casas − 1) números; as primeiras "eggs" são seguras */
  function towerFrom(fs, level) {
    var L = TOWER[level], out = [], c = 0;
    for (var row = 0; row < 9; row++) {
      var a = []; for (var i = 0; i < L.tiles; i++) a.push(i);
      for (var j = 0; j < L.tiles - 1; j++) { var k = j + Math.floor(fs[c++] * (L.tiles - j)), t = a[j]; a[j] = a[k]; a[k] = t; }
      out.push(a.slice(0, L.eggs));
    }
    return out;
  }
  RD.fair.tower = TOWER; RD.fair.towerFrom = towerFrom;
  var EGG = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13.5" rx="7" ry="8.5" fill="#ffc85c"/><ellipse cx="9.5" cy="10" rx="2.2" ry="3" fill="#fff4cf" opacity=".85"/><path d="M6.5 15c2 1.6 4 .2 5.5 1.4s3.6.6 5.5-1" stroke="#e58f00" stroke-width="1.2" fill="none"/></svg>';
  var SKULL = '<svg viewBox="0 0 24 24"><path d="M12 3C7.6 3 4.5 6.1 4.5 10.2c0 2.6 1.2 4.4 3 5.4V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3.4c1.8-1 3-2.8 3-5.4C19.5 6.1 16.4 3 12 3z" fill="#ff7a59"/><circle cx="9" cy="11" r="2" fill="#2a0d10"/><circle cx="15" cy="11" r="2" fill="#2a0d10"/><path d="M10.5 16.5v2M13.5 16.5v2" stroke="#2a0d10" stroke-width="1.4"/></svg>';
  OG.tower = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: selectField("tw-level", "Difficulty", [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"], ["master", "Master"]], ogPrefs.twLevel || "easy") +
          '<div id="tw-live" class="hidden">' + profitField("Total profit") + "</div>",
        after: '<button class="btn btn-secondary btn-block hidden" id="tw-random" style="height:42px">Pick random tile</button>',
        center: '<div class="tw" id="tw"></div>'
      };
    },
    bind: function (ctx) {
      var G = "tower", round = null, pending = false; // round: { amount, level, picks:[] }
      function level() { return $("#tw-level").value; }
      function cur() { return round ? round.picks.length : 0; }
      function multNow() { return round && round.picks.length ? TOWER[round.level].mult[round.picks.length - 1] : 1; }
      function paint(final) {
        var box = $("#tw"); if (!box) return;
        var lv = round ? round.level : (final ? final.level : level()), L = TOWER[lv], rows = "";
        for (var r = 8; r >= 0; r--) {
          var src = round || final, safeRows = src ? src.picks.length - (final && final.lost ? 1 : 0) : 0;
          var active = round && r === cur(), passed = r < safeRows, cells = "";
          for (var i = 0; i < L.tiles; i++) {
            var picked = !!src && src.picks[r] === i, safe = final && final.eggs[r].indexOf(i) > -1, cls = "tw-tile";
            var inner = "";
            if (passed && picked) { cls += " open"; inner = EGG; }
            else if (final && picked) { cls += " open boom"; inner = SKULL; }
            else if (final) { cls += " dim"; inner = safe ? EGG : SKULL; }
            cells += '<button class="' + cls + '" data-tw="' + r + ":" + i + '"' + (active && !pending ? "" : " disabled") + ">" + inner + "</button>";
          }
          rows += '<div class="tw-row' + (active ? " active" : "") + (passed ? " passed" : "") + '"><span class="tw-m">' + L.mult[r].toFixed(2) + '×</span><div class="tw-cells" style="grid-template-columns:repeat(' + L.tiles + ',minmax(0,1fr))">' + cells + "</div></div>";
        }
        box.innerHTML = rows;
      }
      function refresh() {
        if (round) { var m = multNow(); ctx.setProfit(m, m.toFixed(2)); var p = $("#og-profit"); if (p) p.value = amtIn(round.amount * (m - 1)); }
        else ctx.setProfit(TOWER[level()].mult[0], TOWER[level()].mult[0].toFixed(2));
      }
      function setLive(on) {
        if (!$("#tw-live")) return;
        $("#tw-live").classList.toggle("hidden", !on); $("#tw-random").classList.toggle("hidden", !on); ctx.lock(on);
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.disabled = on && (!round || !round.picks.length);
      }
      function layout(r) { return floats(r.server, r.client, r.nonce, 27).then(function (fs) { return towerFrom(fs, round.level); }); }
      function end(win, eggs) {
        var u = me(), k = round.picks.length, mult = win ? capMult(round.amount, TOWER[round.level].mult[k - 1]) : 0;
        var b = db.settleRound(u.id, G, mult, win, { level: round.level, picks: round.picks.slice(), rows: k - (win ? 0 : 1) });
        var shown = { level: round.level, picks: round.picks.slice(), eggs: eggs, lost: !win }; round = null;
        paint(shown); setLive(false); refresh(); ctx.record(b);
      }
      function pick(i) {
        if (!round || pending) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        pending = true;
        if (RD.live) return db.roundAct(G, "pick", { col: i }).then(function (x) {
          pending = false; if (x.error) return ctx.msg(x.error); if (!round) return;
          round.picks.push(i);
          RD.sfx.play(x.safe ? "step" : "boom");
          if (!x.safe) return end(false, x.eggs);
          if (x.bet) return end(true, x.eggs);
          if (!$("#tw")) return;
          paint(); refresh(); ctx.btn().disabled = false;
        });
        layout(r).then(function (eggs) {
          pending = false; if (!round) return;
          var row = round.picks.length; round.picks.push(i);
          RD.sfx.play(eggs[row].indexOf(i) < 0 ? "boom" : "step");
          if (eggs[row].indexOf(i) < 0) return end(false, eggs);
          db.updateRound(u.id, G, { level: round.level, picks: round.picks });
          if (round.picks.length === 9) return end(true, eggs);
          if (!$("#tw")) return;
          paint(); refresh(); ctx.btn().disabled = false;
        });
      }
      $("#tw").addEventListener("click", function (e) { var t = e.target.closest("[data-tw]"); if (t && !t.disabled) pick(+t.getAttribute("data-tw").split(":")[1]); });
      $("#tw-random").addEventListener("click", function () { if (round) pick(Math.floor(Math.random() * TOWER[round.level].tiles)); });
      $("#tw-level").addEventListener("change", function () { ogPrefs.twLevel = level(); savePrefs(); paint(); refresh(); });
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u || pending) return;
        var lv = level(); pending = true;
        rStart(u, G, a, { level: lv, picks: [] }).then(function (r) {
          pending = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, level: lv, picks: [] }; renderHeader(); ctx.refresh(); paint(); setLive(true); refresh();
        });
      }
      paint(); refresh();
      return {
        refresh: refresh,
        click: function () {
          if (!round) return start();
          if (!round.picks.length || pending) return;
          var r = db.activeRound(me().id, G); if (!r) return;
          pending = true;
          if (RD.live) return db.roundAct(G, "cashout").then(function (x) { pending = false; if (x.error) return ctx.msg(x.error); if (round) end(true, x.eggs); });
          layout(r).then(function (eggs) { pending = false; if (round) end(true, eggs); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, level: r.state.level, picks: r.state.picks.slice() }; $("#tw-level").value = r.state.level; $("#og-amt").value = amtIn(r.amount); paint(); setLive(true); refresh(); }
        }
      };
    }
  };

  /* ---------- CHICKEN (tabelas da Stake: 20 faixas, RTP 98%) ---------- */
  var CHICKEN = {
    easy: { bones: 1, mult: [1, 1.03, 1.08, 1.15, 1.22, 1.3, 1.4, 1.5, 1.63, 1.78, 1.96, 2.17, 2.45, 2.8, 3.26, 3.92, 4.9, 6.53, 9.8, 19.6] },
    medium: { bones: 3, mult: [1, 1.15, 1.36, 1.64, 1.99, 2.45, 3.06, 3.9, 5.07, 6.77, 9.31, 13.3, 19.95, 31.92, 55.86, 111.72, 279.3, 1117.2] },
    hard: { bones: 5, mult: [1, 1.3, 1.77, 2.45, 3.47, 5.05, 7.58, 11.8, 19.18, 32.88, 60.29, 120.58, 271.32, 723.52, 2532.32, 15193.9] },
    expert: { bones: 10, mult: [1, 1.96, 4.13, 9.31, 22.61, 60.29, 180.88, 633.08, 2743.34, 16460.1, 181060.88] }
  };
  /* Embaralha as 20 faixas (Fisher–Yates, 19 números); as primeiras "bones" escondem um carro */
  function chickenFrom(fs, diff) { var a = []; for (var i = 0; i < 20; i++) a.push(i); for (var j = 0; j < 19; j++) { var k = j + Math.floor(fs[j] * (20 - j)), t = a[j]; a[j] = a[k]; a[k] = t; } return a.slice(0, CHICKEN[diff].bones); }
  RD.fair.chicken = CHICKEN; RD.fair.chickenFrom = chickenFrom;
  var HEN = '<svg viewBox="0 0 48 48" class="ck-hen">' + RD.art.hen() + "</svg>";
  var CAR = '<svg viewBox="0 0 48 64" class="ck-car"><rect x="8" y="4" width="32" height="56" rx="9" fill="#ff2e55"/><rect x="12" y="14" width="24" height="12" rx="3" fill="#2a1a24"/><rect x="12" y="40" width="24" height="9" rx="3" fill="#2a1a24"/><rect x="5" y="12" width="4" height="10" rx="2" fill="#111"/><rect x="39" y="12" width="4" height="10" rx="2" fill="#111"/><rect x="5" y="44" width="4" height="10" rx="2" fill="#111"/><rect x="39" y="44" width="4" height="10" rx="2" fill="#111"/><rect x="13" y="5" width="6" height="3" rx="1.5" fill="#fff4c2"/><rect x="29" y="5" width="6" height="3" rx="1.5" fill="#fff4c2"/></svg>';
  /* penas que voam quando o carro pega a galinha */
  var CK_FEATHERS = [[-46, -64, -40], [38, -72, 30], [-62, -18, -70], [58, -26, 80], [-22, -86, 10], [20, -48, -20], [-36, 6, 50], [44, 2, -60]].map(function (f, i) {
    return '<i class="ck-fth" style="--dx:' + f[0] + "px;--dy:" + f[1] + "px;--r:" + f[2] + "deg;animation-delay:" + (0.34 + i * 0.015).toFixed(3) + 's"><svg viewBox="0 0 12 24"><path d="M6 1C2 6 1.5 14 6 23 10.5 14 10 6 6 1z" fill="#fff"/><path d="M6 4v18" stroke="#d8dce6" stroke-width="1"/></svg></i>';
  }).join("");
  OG.chicken = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: selectField("ck-diff", "Difficulty", [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]], ogPrefs.ckDiff || "easy") +
          '<div id="ck-live" class="hidden">' + profitField("Total profit") + "</div>",
        after: '<button class="btn btn-secondary btn-block hidden" id="ck-go" style="height:42px">Cross next lane</button>',
        center: '<div class="ck"><div class="ck-road" id="ck-road"></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "chicken", round = null, pending = false; // round: { amount, diff, steps }
      function diff() { return $("#ck-diff").value; }
      function multNow() { return round ? CHICKEN[round.diff].mult[round.steps] : 1; }
      function paint(final) {
        var road = $("#ck-road"); if (!road) return;
        var d = round ? round.diff : final ? final.diff : diff(), T = CHICKEN[d], lanes = T.mult.length - 1, steps = round ? round.steps : final ? final.steps : 0, html = '<div class="ck-lane ck-start">' + (steps === 0 && !(final && final.dead) ? HEN : "") + "</div>";
        for (var i = 1; i <= lanes; i++) {
          var here = i === steps, done = i < steps, dead = final && final.dead && i === final.steps, bone = final && final.bones.indexOf(i - 1) > -1;
          var next = round && !pending && i === steps + 1;
          html += '<button class="ck-lane' + (done ? " done" : "") + (here ? " here" : "") + (next ? " next" : "") + (dead ? " dead" : "") + (final && bone && !dead ? " reveal" : "") + '" data-ck="' + i + '"' + (next ? "" : " disabled") + ">" +
            '<span class="ck-m">' + T.mult[i].toFixed(2) + "×</span>" + (dead ? '<span class="ck-hit">' + HEN + '<i class="ck-boom"></i>' + CK_FEATHERS + "</span>" + '<i class="ck-skid"></i>' + CAR : here ? HEN : final && bone ? CAR : "") + "</button>";
        }
        road.innerHTML = html + '<div class="ck-lane ck-end"><span class="ck-flag">RD FINISH</span></div>';
        var at = road.querySelector(".here, .dead") || road.querySelector(".ck-start");
        if (at && road.scrollWidth > road.clientWidth) road.scrollTo({ left: Math.max(0, at.offsetLeft - road.clientWidth / 2 + at.offsetWidth / 2), behavior: "smooth" });
      }
      function refresh() {
        if (round) { var m = multNow(); ctx.setProfit(m, m.toFixed(2)); var p = $("#og-profit"); if (p) p.value = amtIn(round.amount * (m - 1)); }
        else { var T = CHICKEN[diff()]; ctx.setProfit(T.mult[1], T.mult[1].toFixed(2)); }
      }
      function setLive(on) {
        if (!$("#ck-live")) return;
        $("#ck-live").classList.toggle("hidden", !on); $("#ck-go").classList.toggle("hidden", !on); ctx.lock(on);
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.disabled = on && (!round || !round.steps);
        $("#ck-go").disabled = !on;
      }
      function layout(r) { return floats(r.server, r.client, r.nonce, 19).then(function (fs) { return chickenFrom(fs, round.diff); }); }
      function end(win, bones, dead) {
        var u = me(), k = round.steps, mult = win ? capMult(round.amount, CHICKEN[round.diff].mult[k]) : 0;
        var b = db.settleRound(u.id, G, mult, win, { diff: round.diff, lanes: win ? k : k - 1, bones: bones.map(function (x) { return x + 1; }) });
        var shown = { diff: round.diff, steps: k, bones: bones, dead: dead }; round = null;
        paint(shown); setLive(false); refresh(); ctx.record(b);
      }
      function go() {
        if (!round || pending) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        pending = true; paint();
        if (RD.live) return db.roundAct(G, "go").then(function (x) {
          pending = false; if (x.error) { paint(); return ctx.msg(x.error); } if (!round) return;
          round.steps++; RD.sfx.play(x.dead ? "boom" : "step");
          if (x.dead) return end(false, x.bones, true);
          if (x.bet) return end(true, x.bones, false);
          if (!$("#ck-road")) return;
          paint(); refresh(); ctx.btn().disabled = false;
        });
        layout(r).then(function (bones) {
          pending = false; if (!round) return;
          round.steps++; RD.sfx.play(bones.indexOf(round.steps - 1) > -1 ? "boom" : "step");
          if (bones.indexOf(round.steps - 1) > -1) return end(false, bones, true);
          db.updateRound(u.id, G, { diff: round.diff, steps: round.steps });
          if (round.steps === CHICKEN[round.diff].mult.length - 1) return end(true, bones, false);
          if (!$("#ck-road")) return;
          paint(); refresh(); ctx.btn().disabled = false;
        });
      }
      $("#ck-road").addEventListener("click", function (e) { var t = e.target.closest("[data-ck]"); if (t && !t.disabled) go(); });
      $("#ck-go").addEventListener("click", go);
      $("#ck-diff").addEventListener("change", function () { ogPrefs.ckDiff = diff(); savePrefs(); paint(); refresh(); });
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u || pending) return;
        var df = diff(); pending = true;
        rStart(u, G, a, { diff: df, steps: 0 }).then(function (r) {
          pending = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, diff: df, steps: 0 }; renderHeader(); ctx.refresh(); paint(); setLive(true); refresh();
        });
      }
      paint(); refresh();
      return {
        refresh: refresh,
        click: function () {
          if (!round) return start();
          if (!round.steps || pending) return;
          var r = db.activeRound(me().id, G); if (!r) return;
          pending = true;
          if (RD.live) return db.roundAct(G, "cashout").then(function (x) { pending = false; if (x.error) return ctx.msg(x.error); if (round) end(true, x.bones, false); });
          layout(r).then(function (bones) { pending = false; if (round) end(true, bones, false); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, diff: r.state.diff, steps: r.state.steps }; $("#ck-diff").value = r.state.diff; $("#og-amt").value = amtIn(r.amount); paint(); setLive(true); refresh(); }
        }
      };
    }
  };

  /* ---------- SPILL (estilo Pump: 25 enchidas de 4%; posições escondidas derramam; RTP 98%) ---------- */
  var SPILL_BAD = { low: 1, medium: 3, high: 5, degen: 10 };
  function spillMult(bad, k) { var sv = 1; for (var i = 0; i < bad; i++) sv *= (25 - k - i) / (25 - i); return sv > 0 ? Math.floor(0.98 / sv * 100) / 100 : 0; }
  RD.fair.spillMult = spillMult;
  function spillScene() {
    // estilo da referência: bico simples no topo (com detalhe neon), copo 3D com borda em elipse, base em perspectiva e caixa do multiplicador
    var ticks = ""; for (var i = 0; i <= 4; i++) { var y = 282 - i * 50; ticks += '<path class="sp-tk" data-v="' + i * 25 + '" d="M100 ' + y + ' H118" stroke="#8a97b3" stroke-opacity=".55" stroke-width="2"/><text class="sp-tl" data-v="' + i * 25 + '" x="92" y="' + (y + 4) + '" text-anchor="end" font-size="12" font-weight="700" fill="#8a97b3">' + i * 25 + "%</text>" + (i < 4 ? '<path d="M108 ' + (y - 25) + ' H118" stroke="#8a97b3" stroke-opacity=".3" stroke-width="2"/>' : ""); }
    var glass = "M130 80 A70 12 0 0 0 270 80 L254 282 A54 9 0 0 1 146 282 Z";
    return '<svg viewBox="0 0 400 330" class="sp-svg"><defs><clipPath id="spClip"><path d="M130 80 L270 80 L254 282 A54 9 0 0 1 146 282 Z"/></clipPath>' +
      '<linearGradient id="spWater" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3fb7f5"/><stop offset=".5" stop-color="#8fdcff"/><stop offset="1" stop-color="#2f9cf0"/></linearGradient>' +
      '<linearGradient id="spGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".3" stop-color="#fff" stop-opacity=".04"/><stop offset=".8" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/></linearGradient>' +
      '<linearGradient id="spSlabT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4256"/><stop offset="1" stop-color="#2a3042"/></linearGradient></defs>' +
      ticks +
      // bico
      '<rect x="182" y="0" width="36" height="36" rx="6" fill="#262c3d"/><rect x="186" y="34" width="28" height="10" rx="4" fill="#1b2030"/><rect x="190" y="43" width="20" height="3" rx="1.5" fill="#22d3ee" class="sp-neon"/>' +
      '<rect id="sp-stream" x="194.5" y="46" width="11" height="236" rx="5.5" fill="url(#spWater)" opacity="0"/>' +
      // base 3D
      '<path d="M118 292 L282 292 L296 312 L104 312 Z" fill="url(#spSlabT)"/><rect x="104" y="312" width="192" height="12" fill="#1c2130"/>' +
      // água
      '<g clip-path="url(#spClip)"><g id="sp-water" style="transform:translateY(210px)"><rect x="120" y="80" width="160" height="230" fill="url(#spWater)" opacity=".9"/><ellipse cx="200" cy="80" rx="80" ry="11" fill="#c9f0ff" opacity=".9"/></g></g>' +
      // copo
      '<path d="' + glass + '" fill="url(#spGlass)" stroke="#e8f2ff" stroke-opacity=".55" stroke-width="2.5"/>' +
      '<ellipse cx="200" cy="80" rx="70" ry="12" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.5"/>' +
      '<path d="M146 98 L158 268" stroke="#fff" stroke-opacity=".22" stroke-width="7" stroke-linecap="round"/><path d="M246 104 L238 250" stroke="#fff" stroke-opacity=".1" stroke-width="4" stroke-linecap="round"/>' +
      // caixa do multiplicador
      '<g class="sp-mbox"><rect x="300" y="150" width="88" height="56" rx="12" fill="#151a28" stroke="#2c3550" stroke-width="3"/><text id="sp-mbox" x="344" y="185" text-anchor="middle" font-size="18" font-weight="800" fill="#cfd8ea" style="font-family:var(--font-display,Arial)">—</text></g>' +
      '<g id="sp-over" opacity="0"><path d="M130 80 q-14 4 -18 30 q-3 22 6 30 q6 -10 4 -26 q-2 -18 12 -26z M270 80 q14 4 18 34 q3 22 -6 32 q-6 -12 -4 -28 q2 -18 -12 -30z" fill="url(#spWater)"/><ellipse cx="200" cy="78" rx="74" ry="13" fill="#c9f0ff"/></g>' +
      "</svg>";
  }

  OG.spill = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      var d = ogPrefs.spDiff || "low";
      return {
        side: '<div><div class="ogx-label">Difficulty</div><div class="ogx-split sp-diff">' + ["low", "medium", "high", "degen"].map(function (k) { return '<button data-spd="' + k + '"' + (k === d ? ' class="active"' : "") + ">" + k[0].toUpperCase() + k.slice(1) + "</button>"; }).join("") + "</div></div>" +
          '<div id="sp-live" class="hidden">' + profitField("Total profit") + "</div>" +
          '<div class="sp-next"><span>Next pour</span><b id="sp-next">—</b></div>',
        after: '<button class="btn btn-secondary btn-block hidden" id="sp-pour" style="height:46px">' + ic("droplet", 16) + "Pour</button>",
        center: '<div class="sp"><div class="sp-stage"><div class="sp-badge hidden" id="sp-badge"></div>' + spillScene() + '</div><div class="ladder no-n" id="sp-ladder"></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "spill", round = null, pending = false, diffSel = ogPrefs.spDiff || "low"; // round: { amount, diff, steps }
      function D() { return round ? round.diff : diffSel; }
      function bad() { return SPILL_BAD[D()]; }
      function maxSteps() { return 25 - bad(); }
      function setLevel(steps, over) {
        var w = $("#sp-water"); if (!w) return;
        w.style.transform = "translateY(" + (210 - Math.min(steps, 25) * 8.08) + "px)";
        var pct = Math.min(steps, 25) / 25 * 100;
        $$(".sp-tl, .sp-tk").forEach(function (el) { var v = +el.getAttribute("data-v"), on = v <= pct && pct < v + 25 || (v === 100 && pct >= 100); el.classList.toggle("on", on); });
        var o = $("#sp-over"); if (o) { o.style.opacity = over ? 1 : 0; o.classList.toggle("on", !!over); }
      }
      function paint() {
        var k = round ? round.steps : 0, ms = []; for (var i = 1; i <= maxSteps(); i++) ms.push(spillMult(bad(), i));
        var box = $("#sp-ladder"); if (box) box.innerHTML = ladderWin(ms, k, !!round);
        var nx = $("#sp-next"); if (nx) nx.textContent = k < maxSteps() ? spillMult(bad(), k + 1).toFixed(2) + "×" : "—";
        var mb = $("#sp-mbox"); if (mb) { mb.textContent = round && k ? spillMult(bad(), k).toFixed(2) + "×" : "—"; mb.classList.toggle("on", !!(round && k)); }
        if (round) { var m = k ? spillMult(bad(), k) : 1; ctx.setProfit(m, m.toFixed(2)); var p = $("#og-profit"); if (p) p.value = amtIn(round.amount * (m - 1)); }
        else ctx.setProfit(spillMult(bad(), 1), spillMult(bad(), 1).toFixed(2));
      }
      function setLive(on) {
        if (!$("#sp-live")) return;
        $("#sp-live").classList.toggle("hidden", !on); $("#sp-pour").classList.toggle("hidden", !on); ctx.lock(on);
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.disabled = on && (!round || !round.steps);
        $("#sp-pour").disabled = !on || pending; $$(".sp-diff button").forEach(function (x) { x.disabled = on; });
      }
      function badge(txt, cls) { var b = $("#sp-badge"); if (!b) return; b.className = "sp-badge " + cls; b.textContent = txt; }
      function end(win, detail) {
        var u = me(), k = round.steps, mult = win ? capMult(round.amount, spillMult(bad(), k)) : 0;
        var b = db.settleRound(u.id, G, mult, win, detail);
        round = null; setLive(false); paint(); ctx.record(b);
        if (win) { badge("+" + mult.toFixed(2) + "×", "win"); RD.sfx.play("cash"); }
      }
      function pour() {
        if (!round || pending) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        pending = true; $("#sp-pour").disabled = true; ctx.btn().disabled = true;
        var st = $("#sp-stream"); if (st) { st.classList.remove("on"); void st.getBoundingClientRect(); st.classList.add("on"); }
        RD.sfx.play("step");
        var got = RD.live ? db.roundAct(G, "pour").then(function (x) { if (x.error) { pending = false; setLive(true); ctx.msg(x.error); return null; } return { ok: x.ok, bad: x.bad || [], done: !!x.bet && x.ok }; })
          : floats(r.server, r.client, r.nonce, 24).then(function (fs) { var pos = minesFrom(fs, bad()); return { ok: pos.indexOf(round.steps) < 0, bad: pos }; });
        got.then(function (x) {
          if (!x || !round) { pending = false; return; }
          setTimeout(function () {
            pending = false; if (!round) return;
            round.steps++;
            var detail = { diff: round.diff, steps: round.steps, bad: x.bad };
            if (!x.ok) { setLevel(25, true); badge("Spilled!", "lose"); RD.sfx.play("boom"); detail.spill = round.steps; return end(false, detail); }
            setLevel(round.steps); RD.sfx.play("gem");
            if (!RD.live) db.updateRound(u.id, G, { diff: round.diff, steps: round.steps });
            if (round.steps >= maxSteps()) return end(true, detail);
            if (!$("#sp-pour")) return;
            paint(); setLive(true);
          }, 420);
        });
      }
      $("#sp-pour").addEventListener("click", pour);
      $$(".sp-diff button").forEach(function (b) { b.addEventListener("click", function () { if (round) return; diffSel = b.getAttribute("data-spd"); ogPrefs.spDiff = diffSel; savePrefs(); $$(".sp-diff button").forEach(function (x) { x.classList.toggle("active", x === b); }); paint(); }); });
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u || pending) return;
        var df = diffSel; pending = true;
        rStart(u, G, a, { diff: df, steps: 0 }).then(function (r) {
          pending = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, diff: df, steps: 0 }; badge("", "hidden"); setLevel(0); renderHeader(); ctx.refresh(); paint(); setLive(true);
        });
      }
      setLevel(0); paint();
      return {
        refresh: paint,
        click: function () {
          if (!round) return start();
          if (!round.steps || pending) return;
          var u = me(), r = db.activeRound(u.id, G); if (!r) return;
          pending = true;
          if (RD.live) return db.roundAct(G, "cashout").then(function (x) { pending = false; if (x.error) return ctx.msg(x.error); if (round) end(true, { diff: round.diff, steps: round.steps, bad: x.bad || [] }); });
          floats(r.server, r.client, r.nonce, 24).then(function (fs) { pending = false; if (round) end(true, { diff: round.diff, steps: round.steps, bad: minesFrom(fs, bad()) }); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, diff: r.state.diff, steps: r.state.steps || 0 }; diffSel = round.diff; $$(".sp-diff button").forEach(function (x) { x.classList.toggle("active", x.getAttribute("data-spd") === round.diff); }); $("#og-amt").value = amtIn(r.amount); setLevel(round.steps); paint(); setLive(true); }
        }
      };
    }
  };  /* ---------- CROSS THE LAKE: o sapo rapper atravessa o lago pulando nas vitórias-régias ----------
     Em cada coluna o jogador escolhe a folha: branca (96% de não afundar), laranja (80%) ou rosa (59%).
     Multiplicador = 0,98 ÷ chance acumulada (RTP 98%). Pulo k usa o k-ésimo número das seeds: afunda se número ≥ chance. */
  var LAKE_COLS = 20, LAKE_PADS = [{ k: "risky", p: 0.59, cls: "r" }, { k: "safe", p: 0.96, cls: "s" }, { k: "mid", p: 0.8, cls: "m" }];
  function lakeMult(raw) { return Math.floor(raw * 100 + 1e-9) / 100; }
  RD.fair.lakePads = LAKE_PADS;
  function frogSVG() { return '<svg viewBox="0 0 120 120" class="lk-frog-svg" aria-hidden="true">' + RD.art.frog() + "</svg>"; }

  function lilySVG() { return '<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="58" rx="46" ry="34" fill="#0b5a2a" opacity=".55"/><path d="M50 50 L92 40 A46 40 0 1 1 64 14 Z" fill="#3fbf4a"/><path d="M50 50 L92 40 A46 40 0 1 1 64 14 Z" fill="none" stroke="#2a9a38" stroke-width="3"/><path d="M50 50 L20 30 M50 50 L18 62 M50 50 L44 86 M50 50 L78 76" stroke="#2f9e3a" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="40" r="2.5" fill="#2a8a33"/><circle cx="66" cy="68" r="2" fill="#2a8a33"/></svg>'; }
  OG.lake = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: '<div id="lk-live" class="hidden">' + profitField("Total profit") + "</div>" +
          '<div class="lk-help"><span><i class="s"></i>White 96%</span><span><i class="m"></i>Orange 80%</span><span><i class="r"></i>Pink 59%</span><small>Chance of the pad holding the frog. Pick a pad in the next column to jump.</small></div>',
        center: '<div class="lk"><div class="lk-view" id="lk-view"><div class="lk-world" id="lk-world"></div>' +
          '<button class="lk-music" id="lk-music" title="Music" aria-label="Music"></button><div class="sp-badge hidden" id="lk-badge"></div></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "lake", round = null, pending = false, CW = 120, BANK = 120, ROWY = [22, 50, 78];
      var world = $("#lk-world"), view = $("#lk-view");
      function colX(c) { return BANK + (c - 0.5) * CW; }
      var h = '<div class="lk-bank l"><span class="lk-flower" style="left:18px;top:14%"></span><span class="lk-flower" style="left:52px;top:80%"></span><span class="lk-shroom" style="left:24px;top:64%"></span><span class="lk-stone" style="left:60px;top:30%"></span></div>';
      for (var c = 1; c <= LAKE_COLS; c++) for (var r = 0; r < 3; r++) h += '<button class="lk-pad" data-c="' + c + '" data-r="' + r + '" style="left:' + colX(c) + 'px;top:' + ROWY[r] + '%">' + lilySVG() + '<b></b></button>';
      h += '<div class="lk-bank r" style="left:' + (BANK + LAKE_COLS * CW) + 'px"><span class="lk-flag">' + ic("flag", 22) + '</span><span class="lk-flower" style="left:40px;top:70%"></span></div>';
      h += '<div class="lk-frog" id="lk-frog">' + frogSVG() + '</div><div class="lk-splash" id="lk-splash"></div>';
      world.innerHTML = h; world.style.width = (BANK * 2 + LAKE_COLS * CW) + "px";
      function frogAt(col, row, instant) {
        var f = $("#lk-frog"); if (!f) return;
        var x = col ? colX(col) : 62, y = col ? ROWY[row] : 50;
        if (instant) f.style.transition = "none";
        f.style.left = x + "px"; f.style.top = y + "%";
        if (instant) { void f.offsetWidth; f.style.transition = ""; }
        var vw = view.clientWidth, off = Math.max(0, Math.min(x - vw * 0.32, BANK * 2 + LAKE_COLS * CW - vw));
        world.style.transform = "translateX(" + (-off) + "px)";
      }
      function paint() {
        var k = round ? round.steps : 0, raw = round ? round.raw : 0.98;
        $$(".lk-pad", world).forEach(function (el) {
          var c = +el.getAttribute("data-c"), r = +el.getAttribute("data-r"), pad = LAKE_PADS[r], lab = el.querySelector("b");
          el.className = "lk-pad"; lab.textContent = "";
          if (c === k + 1) { el.classList.add("next", pad.cls); lab.textContent = lakeMult(raw / pad.p).toFixed(2) + "×"; el.disabled = !round || pending; }
          else { el.disabled = true; if (round && c <= k) el.classList.add(round.path[c - 1] === pad.k ? "path" : "dim"); }
        });
        var m = round && k ? lakeMult(raw) : 1;
        if (round) { ctx.setProfit(m, m.toFixed(2)); var pf = $("#og-profit"); if (pf) pf.value = amtIn(round.amount * (m - 1)); }
      }
      function setLive(on) {
        if (!$("#lk-live")) return;
        $("#lk-live").classList.toggle("hidden", !on); ctx.lock(on);
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.disabled = on && (!round || !round.steps || pending);
      }
      function badge(txt, cls) { var b = $("#lk-badge"); if (!b) return; b.className = "sp-badge " + cls; b.textContent = txt; }
      function end(win, detail) {
        var u = me(), mult = win ? capMult(round.amount, lakeMult(round.raw)) : 0;
        var b = db.settleRound(u.id, G, mult, win, detail);
        round = null; setLive(false); paint(); ctx.record(b);
        if (win) { badge("+" + mult.toFixed(2) + "×", "win"); RD.sfx.play("cash"); }
      }
      function jump(row) {
        if (!round || pending) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        var pad = LAKE_PADS[row], col = round.steps + 1; pending = true; paint(); setLive(true);
        var f = $("#lk-frog"); f.classList.remove("hop"); void f.offsetWidth; f.classList.add("hop"); RD.sfx.play("step");
        frogAt(col, row);
        var got = RD.live ? db.roundAct(G, "jump", { pad: pad.k }).then(function (x) { if (x.error) { ctx.msg(x.error); return null; } return { ok: x.ok, roll: x.roll }; })
          : floats(r.server, r.client, r.nonce, col).then(function (fs) { return { ok: fs[col - 1] < pad.p, roll: fs[col - 1] }; });
        got.then(function (x) {
          setTimeout(function () {
            pending = false;
            if (!round) return;
            if (!x) { frogAt(round.steps, round.path.length ? LAKE_PADS.map(function (q) { return q.k; }).indexOf(round.path[round.path.length - 1]) : 1); paint(); setLive(true); return; }
            round.steps = col; round.path.push(pad.k);
            var detail = { steps: col, path: round.path.slice(), roll: x.roll };
            if (!x.ok) {
              var el = world.querySelector('.lk-pad[data-c="' + col + '"][data-r="' + row + '"]'); if (el) el.classList.add("sunk");
              f.classList.add("drown"); var sp = $("#lk-splash"); if (sp) { sp.style.left = colX(col) + "px"; sp.style.top = ROWY[row] + "%"; sp.classList.remove("on"); void sp.offsetWidth; sp.classList.add("on"); }
              badge("Splash!", "lose"); RD.sfx.play("boom"); detail.sank = col; return end(false, detail);
            }
            round.raw = round.raw / pad.p; RD.sfx.play("gem");
            if (!RD.live) db.updateRound(u.id, G, { steps: round.steps, mult: round.raw, path: round.path.slice() });
            if (round.steps >= LAKE_COLS) { frogAt(LAKE_COLS + 1.1, 1); return end(true, detail); }
            paint(); setLive(true);
          }, 460);
        });
      }
      world.addEventListener("click", function (e) { var b = e.target.closest(".lk-pad"); if (!b || b.disabled) return; jump(+b.getAttribute("data-r")); });
      function musicBtn() { var b = $("#lk-music"); if (b) { var on = RD.sfx.music.on(); b.innerHTML = ic(on ? "volume" : "volumeX", 16); b.classList.toggle("off", !on); } }
      $("#lk-music").addEventListener("click", function () { RD.sfx.music.toggle(); musicBtn(); });
      RD.sfx.music.start(); musicBtn();
      function reset() { var f = $("#lk-frog"); if (f) f.classList.remove("drown", "hop"); frogAt(0, 1, true); }
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u || pending) return;
        pending = true; RD.sfx.music.start();
        rStart(u, G, a, { steps: 0, mult: 0.98, path: [] }, {}).then(function (r) {
          pending = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, steps: 0, raw: 0.98, path: [] }; badge("", "hidden"); reset(); renderHeader(); ctx.refresh(); paint(); setLive(true);
        });
      }
      reset(); paint();
      window.addEventListener("resize", function () { if (round) frogAt(round.steps, round.path.length ? LAKE_PADS.map(function (q) { return q.k; }).indexOf(round.path[round.path.length - 1]) : 1, true); });
      return {
        refresh: paint,
        click: function () {
          if (!round) return start();
          if (!round.steps || pending) return;
          pending = true; setLive(true);
          if (RD.live) return db.roundAct(G, "cashout").then(function (x) { pending = false; if (x.error) { setLive(true); return ctx.msg(x.error); } if (round) end(true, { steps: round.steps, path: round.path.slice() }); });
          pending = false; end(true, { steps: round.steps, path: round.path.slice() });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) {
            var st = r.state || {}; round = { amount: r.amount, steps: st.steps || 0, raw: +st.mult || 0.98, path: (st.path || []).slice() };
            $("#og-amt").value = amtIn(r.amount);
            var last = round.path.length ? LAKE_PADS.map(function (q) { return q.k; }).indexOf(round.path[round.path.length - 1]) : 1;
            frogAt(round.steps, last, true); paint(); setLive(true);
          }
        }
      };
    }
  };
  /* Pump: balão sobre a bomba de ar; cresce a cada bombada e estoura no ponto escondido */
  function pumpScene() {
    var bits = "", i;
    for (i = 0; i < 12; i++) { var ang = i * 30 * Math.PI / 180; bits += '<path class="pm-bit" style="--dx:' + Math.round(Math.cos(ang) * 130) + 'px;--dy:' + Math.round(Math.sin(ang) * 130) + 'px;--r:' + (i * 47 % 360) + 'deg" d="M246 122 l12 -7 l9 14 l-14 7z"/>'; }
    return '<svg viewBox="0 0 400 340" class="pm-svg" id="pm-stage-svg"><defs>' +
      '<radialGradient id="pmBal" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#c6ff9a"/><stop offset=".45" stop-color="#3fdc4a"/><stop offset="1" stop-color="#0c7a24"/></radialGradient>' +
      '<linearGradient id="pmMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b3550"/><stop offset=".5" stop-color="#6070a0"/><stop offset="1" stop-color="#262f47"/></linearGradient></defs>' +
      '<ellipse cx="170" cy="320" rx="150" ry="10" fill="#000" opacity=".28"/>' +
      '<path d="M128 292 C 200 312 252 300 250 236" stroke="#141a2a" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M128 292 C 200 312 252 300 250 236" stroke="#3a4566" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="2 8"/>' +
      '<g class="pm-pump"><g id="pm-handle" class="pm-handle"><rect x="96" y="196" width="8" height="52" rx="3" fill="#9aa6c4"/><rect x="70" y="186" width="60" height="14" rx="7" fill="#ff5a7a"/></g>' +
      '<rect x="72" y="240" width="56" height="72" rx="10" fill="url(#pmMetal)"/><rect x="80" y="252" width="40" height="6" rx="3" fill="#ff5a7a" opacity=".85"/><rect x="62" y="306" width="76" height="12" rx="5" fill="#1a2134"/></g>' +
      '<rect x="243" y="226" width="14" height="14" rx="3" fill="#141a2a"/>' +
      '<g id="pm-bal" class="pm-bal" style="transform:scale(.5)">' +
      '<ellipse cx="250" cy="130" rx="80" ry="92" fill="url(#pmBal)"/><path d="M242 222 L258 222 L250 212 Z" fill="#0c7a24"/>' +
      '<ellipse cx="220" cy="92" rx="17" ry="28" fill="#fff" opacity=".38" transform="rotate(-24 220 92)"/>' +
      '<text x="250" y="146" text-anchor="middle" font-size="42" font-weight="900" fill="#fff" fill-opacity=".92" style="font-family:var(--font-display,Arial)">RD</text></g>' +
      '<g class="pm-bits">' + bits + "</g></svg>";
  }

  OG.pump = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      var d = ogPrefs.pmDiff || "low";
      return {
        side: '<div><div class="ogx-label">Difficulty</div><div class="ogx-split pm-diff">' + ["low", "medium", "high", "degen"].map(function (k) { return '<button data-pmd="' + k + '"' + (k === d ? ' class="active"' : "") + ">" + k[0].toUpperCase() + k.slice(1) + "</button>"; }).join("") + "</div></div>" +
          '<div id="pm-live" class="hidden">' + profitField("Total profit") + "</div>" +
          '<div class="pm-next"><span>Next pump</span><b id="pm-next">—</b></div>',
        after: '<button class="btn btn-secondary btn-block hidden" id="pm-pump" style="height:46px">' + ic("zap", 16) + "Pump</button>",
        center: '<div class="pm"><div class="pm-stage"><div class="sp-badge hidden" id="pm-badge"></div>' + pumpScene() + '</div><div class="ladder no-n" id="pm-ladder"></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "pump", round = null, pending = false, diffSel = ogPrefs.pmDiff || "low"; // round: { amount, diff, steps }
      function D() { return round ? round.diff : diffSel; }
      function bad() { return SPILL_BAD[D()]; }
      function maxSteps() { return 25 - bad(); }
      function setLevel(steps, over) {
        var bl = $("#pm-bal"); if (!bl) return;
        var k = Math.min(steps, 25) / 25;
        bl.style.transform = "scale(" + (0.5 + k * 0.62).toFixed(3) + ")";
        var st = $("#pm-stage-svg"); if (st) st.classList.toggle("popped", !!over);
      }
      function paint() {
        var k = round ? round.steps : 0, ms = []; for (var i = 1; i <= maxSteps(); i++) ms.push(spillMult(bad(), i));
        var box = $("#pm-ladder"); if (box) box.innerHTML = ladderWin(ms, k, !!round);
        var nx = $("#pm-next"); if (nx) nx.textContent = k < maxSteps() ? spillMult(bad(), k + 1).toFixed(2) + "×" : "—";
        if (round) { var m = k ? spillMult(bad(), k) : 1; ctx.setProfit(m, m.toFixed(2)); var p = $("#og-profit"); if (p) p.value = amtIn(round.amount * (m - 1)); }
        else ctx.setProfit(spillMult(bad(), 1), spillMult(bad(), 1).toFixed(2));
      }
      function setLive(on) {
        if (!$("#pm-live")) return;
        $("#pm-live").classList.toggle("hidden", !on); $("#pm-pump").classList.toggle("hidden", !on); ctx.lock(on);
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.disabled = on && (!round || !round.steps);
        $("#pm-pump").disabled = !on || pending; $$(".pm-diff button").forEach(function (x) { x.disabled = on; });
      }
      function badge(txt, cls) { var b = $("#pm-badge"); if (!b) return; b.className = "sp-badge " + cls; b.textContent = txt; }
      function end(win, detail) {
        var u = me(), k = round.steps, mult = win ? capMult(round.amount, spillMult(bad(), k)) : 0;
        var b = db.settleRound(u.id, G, mult, win, detail);
        round = null; setLive(false); paint(); ctx.record(b);
        if (win) { badge("+" + mult.toFixed(2) + "×", "win"); RD.sfx.play("cash"); }
      }
      function pump() {
        if (!round || pending) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        pending = true; $("#pm-pump").disabled = true; ctx.btn().disabled = true;
        var hd = $("#pm-handle"); if (hd) { hd.classList.remove("on"); void hd.getBoundingClientRect(); hd.classList.add("on"); }
        RD.sfx.play("step");
        var got = RD.live ? db.roundAct(G, "pour").then(function (x) { if (x.error) { pending = false; setLive(true); ctx.msg(x.error); return null; } return { ok: x.ok, bad: x.bad || [], done: !!x.bet && x.ok }; })
          : floats(r.server, r.client, r.nonce, 24).then(function (fs) { var pos = minesFrom(fs, bad()); return { ok: pos.indexOf(round.steps) < 0, bad: pos }; });
        got.then(function (x) {
          if (!x || !round) { pending = false; return; }
          setTimeout(function () {
            pending = false; if (!round) return;
            round.steps++;
            var detail = { diff: round.diff, steps: round.steps, bad: x.bad };
            if (!x.ok) { setLevel(25, true); badge("Popped!", "lose"); RD.sfx.play("boom"); detail.pop = round.steps; return end(false, detail); }
            setLevel(round.steps); RD.sfx.play("gem");
            if (!RD.live) db.updateRound(u.id, G, { diff: round.diff, steps: round.steps });
            if (round.steps >= maxSteps()) return end(true, detail);
            if (!$("#pm-pump")) return;
            paint(); setLive(true);
          }, 420);
        });
      }
      $("#pm-pump").addEventListener("click", pump);
      $$(".pm-diff button").forEach(function (b) { b.addEventListener("click", function () { if (round) return; diffSel = b.getAttribute("data-pmd"); ogPrefs.pmDiff = diffSel; savePrefs(); $$(".pm-diff button").forEach(function (x) { x.classList.toggle("active", x === b); }); paint(); }); });
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u || pending) return;
        var df = diffSel; pending = true;
        rStart(u, G, a, { diff: df, steps: 0 }).then(function (r) {
          pending = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, diff: df, steps: 0 }; badge("", "hidden"); setLevel(0); renderHeader(); ctx.refresh(); paint(); setLive(true);
        });
      }
      setLevel(0); paint();
      return {
        refresh: paint,
        click: function () {
          if (!round) return start();
          if (!round.steps || pending) return;
          var u = me(), r = db.activeRound(u.id, G); if (!r) return;
          pending = true;
          if (RD.live) return db.roundAct(G, "cashout").then(function (x) { pending = false; if (x.error) return ctx.msg(x.error); if (round) end(true, { diff: round.diff, steps: round.steps, bad: x.bad || [] }); });
          floats(r.server, r.client, r.nonce, 24).then(function (fs) { pending = false; if (round) end(true, { diff: round.diff, steps: round.steps, bad: minesFrom(fs, bad()) }); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, diff: r.state.diff, steps: r.state.steps || 0 }; diffSel = round.diff; $$(".pm-diff button").forEach(function (x) { x.classList.toggle("active", x.getAttribute("data-pmd") === round.diff); }); $("#og-amt").value = amtIn(r.amount); setLevel(round.steps); paint(); setLive(true); }
        }
      };
    }
  };

  /* ---------- DOUBLE (estilo Blaze: 15 casas — 7 vermelhas 2,1×, 7 pretas 2,1×, 1 branca RD 14,7×; RTP 98%) ---------- */
  var DBL_ORDER = [0, 11, 5, 10, 6, 9, 7, 8, 1, 14, 2, 13, 3, 12, 4];
  var DBL_PAY = { red: 2.1, black: 2.1, white: 14.7 }; // RTP 98%
  function dblColor(n) { return n === 0 ? "white" : n <= 7 ? "red" : "black"; }
  function dblFrom(f) { return Math.floor(f * 15); }
  RD.fair.doubleFrom = dblFrom;
  function dblTile(n) { var c = dblColor(n); return '<div class="dbl-t ' + c + '">' + (c === "white" ? '<svg viewBox="0 0 40 40"><path d="M20 4 L34 14 L20 36 L6 14 Z" fill="#ff2e55"/><path d="M20 4 L27 14 L20 36 L13 14 Z" fill="#ff6b86"/></svg>' : "<span>" + n + "</span>") + "</div>"; }
  function dblDot(n) { return '<span class="dbl-dot ' + dblColor(n) + '">' + (n === 0 ? "RD" : n) + "</span>"; }
  OG.double = {
    label: function (b) { return dblDot(b.detail.result); },
    cfg: function () {
      return {
        auto: true,
        side: '<div><div class="ogx-label">Color</div><div class="dbl-pick"><button class="dbl-c red" data-dbl="red">2.1×</button><button class="dbl-c white" data-dbl="white">14.7×</button><button class="dbl-c black" data-dbl="black">2.1×</button></div></div>' +
          '<div class="og-manual-only">' + profitField() + "</div>",
        center: '<div class="dbl"><div class="dbl-stage" id="dbl-stage"><div class="dbl-ptr"></div><div class="dbl-strip" id="dbl-strip"></div></div></div>'
      };
    },
    bind: function (ctx) {
      var pick = ogPrefs.dblPick || "red", spinning = false, pos = 30 + Math.floor(Math.random() * 15), jit = 0;
      function strip() { var h = ""; for (var c = 0; c < 10; c++) DBL_ORDER.forEach(function (n) { h += dblTile(n); }); $("#dbl-strip").innerHTML = h; }
      function tileW() { var t = $("#dbl-strip .dbl-t"); if (!t) return 92; var cs = getComputedStyle(t); return t.getBoundingClientRect().width + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight); }
      function place(i, ms) {
        var s = $("#dbl-strip"), st = $("#dbl-stage"); if (!s || !st) return;
        var w = tileW(), x = st.clientWidth / 2 - (i * w + w / 2) + jit * w;
        s.style.transition = ms ? "transform " + ms + "ms cubic-bezier(.1,.75,.12,1)" : "none"; s.style.transform = "translateX(" + x.toFixed(1) + "px)";
      }
      function hist() {
        var u = me(), box = $("#dbl-hist"); if (!box) return;
        var list = u ? db.betsOf(u.id).filter(function (b) { return b.game === "double" && b.detail && b.detail.result != null; }).slice(0, 16) : [];
        box.innerHTML = list.length ? list.map(function (b) { return dblDot(b.detail.result); }).join("") : '<small class="faint">Your last rolls show up here</small>';
      }
      function refresh() { $$("[data-dbl]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-dbl") === pick); }); ctx.setProfit(DBL_PAY[pick]); }
      $$("[data-dbl]").forEach(function (b) { b.addEventListener("click", function () { if (spinning) return; pick = b.getAttribute("data-dbl"); ogPrefs.dblPick = pick; savePrefs(); refresh(); }); });
      strip(); place(pos, 0); hist(); refresh();
      function play() {
        if (spinning) return Promise.resolve(null);
        var col = pick, m = DBL_PAY[col], a = ctx.amount(), u = ctx.validate(a, m); if (!u) return Promise.resolve(null);
        var unlock = function () { spinning = false; ctx.lock(false); $$("[data-dbl]").forEach(function (x) { x.disabled = false; }); };
        spinning = true; ctx.lock(true); $$("[data-dbl]").forEach(function (b) { b.disabled = true; });
        $$("#dbl-strip .dbl-t.hit").forEach(function (t) { t.classList.remove("hit"); });
        return roll(u, "double", a, { color: col }, 1).then(function (s) {
          var n = dblFrom(s.fs[0]), c = dblColor(n), win = c === col, mult = win ? capMult(a, m) : 0;
          var b = s.place(mult, win, { result: n, color: c, pick: col, nonce: s.nonce, client: s.client });
          if (b.error) { unlock(); ctx.msg(b.error); return null; }
          ctx.hold(b);
          var k = DBL_ORDER.indexOf(n), ms = 4200;
          jit = (Math.random() - 0.5) * 0.7; place(15 * 7 + k, ms);
          return new Promise(function (done) {
            setTimeout(function () {
              if (!$("#dbl-strip")) { unlock(); ctx.record(b); return done({ win: win }); }
              pos = 30 + k; place(pos, 0);
              var t = $$("#dbl-strip .dbl-t")[pos]; if (t) t.classList.add("hit");
              unlock(); ctx.record(b); hist(); done({ win: win });
            }, ms + 80);
          });
        });
      }
      return { refresh: refresh, play: play, cooldown: 300, resize: function () { place(pos, 0); } };
    }
  };

  /* ---------- SOCCER (pênalti: 5 alvos, o goleiro defende 1–4; cada gol multiplica, RTP 98%) ---------- */
  var SOCCER = {"easy":{"mult":[1,1.22,1.53,1.91,2.39,2.99,3.73,4.67,5.84,7.3,9.12],"block":1,"kicks":10},"hard":{"mult":[1,2.45,6.12,15.31,38.28,95.7,239.25,598.14,1495.36],"block":3,"kicks":8},"expert":{"mult":[1,4.9,24.5,122.5,612.5,3062.5,15312.5],"block":4,"kicks":6},"medium":{"mult":[1,1.63,2.72,4.53,7.56,12.6,21,35,58.34,97.24,162.07],"block":2,"kicks":10}};
  /* Chute nº k: embaralha os 5 alvos com os números 4k…4k+3 (Fisher–Yates); os primeiros "block" são defendidos */
  function soccerFrom(fs, kick, block) { var a = [0, 1, 2, 3, 4], f = fs.slice(kick * 4, kick * 4 + 4); for (var j = 0; j < 4; j++) { var x = j + Math.floor(f[j] * (5 - j)), t = a[j]; a[j] = a[x]; a[x] = t; } return a.slice(0, block); }
  RD.fair.soccer = SOCCER; RD.fair.soccerFrom = soccerFrom;
  var SC_KIT = { easy: "#22c55e", medium: "#3b82f6", hard: "#f59e0b", expert: "#a855f7" }; // cor do uniforme do goleiro por dificuldade
  var SC_Z = [[160, 78], [300, 66], [440, 78], [160, 164], [440, 164]]; // centro de cada alvo no gol (viewBox 600×360)
  function soccerScene() {
    var net = ""; for (var x = 96; x <= 504; x += 24) net += '<path d="M' + x + ' 34 V212" stroke="#fff" stroke-opacity=".09"/>'; for (var y = 46; y <= 212; y += 22) net += '<path d="M96 ' + y + ' H504" stroke="#fff" stroke-opacity=".09"/>';
    var tg = SC_Z.map(function (z, i) { return '<g class="sc-tg" data-sc="' + i + '" transform="translate(' + z[0] + " " + z[1] + ')"><circle r="30" class="sc-ring"/><circle r="19" class="sc-dot"/><g class="sc-glove"><path d="M-12 8 v-16 a4 4 0 0 1 8 0 v6 v-9 a4 4 0 0 1 8 0 v9 v-6 a4 4 0 0 1 8 0 v16 a10 10 0 0 1 -10 10 h-4 a10 10 0 0 1 -10 -10z" fill="#ffd23f"/></g></g>'; }).join("");
    var keeper = '<g class="sc-keeper" id="sc-keeper"><g transform="translate(300 172) scale(.82)"><ellipse cx="0" cy="40" rx="34" ry="6" fill="#000" opacity=".35"/><rect x="-14" y="8" width="11" height="30" rx="5" fill="#1b1220"/><rect x="3" y="8" width="11" height="30" rx="5" fill="#1b1220"/><rect x="-22" y="-26" width="44" height="40" rx="12" style="fill:var(--kit,#3b82f6)"/><path d="M-22 -18 L-44 -40 M22 -18 L44 -40" stroke-width="10" stroke-linecap="round" style="stroke:var(--kit,#3b82f6)"/><circle cx="-46" cy="-43" r="8" fill="#ffd23f"/><circle cx="46" cy="-43" r="8" fill="#ffd23f"/><circle cx="0" cy="-42" r="15" fill="#e8b48a"/><path d="M-16 -46 a16 14 0 0 1 32 0 v-2 h6 v4 h-38z" fill="#ff2e55"/><text x="0" y="-48" text-anchor="middle" font-size="7" font-weight="900" fill="#fff">RD</text></g></g>';
    var ball = '<g class="sc-ball" id="sc-ball"><g transform="translate(300 312)"><ellipse cx="0" cy="16" rx="16" ry="4" fill="#000" opacity=".35"/><circle r="15" fill="#fff"/><path d="M0 -6 l6 4 -2 7 h-8 l-2 -7z" fill="#1b1220"/><path d="M0 -15 v9 M6 -2 l9 -3 M4 5 l5 8 M-4 5 l-5 8 M-6 -2 l-9 -3" stroke="#1b1220" stroke-width="2"/></g></g>';
    return '<svg viewBox="0 0 600 360" class="sc-svg" id="sc-svg" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="sc-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1d2b"/><stop offset="1" stop-color="#160f17"/></linearGradient></defs>' +
      '<rect y="212" width="600" height="148" fill="url(#sc-grass)"/><path d="M40 360 L170 212 H430 L560 360" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="3"/><ellipse cx="300" cy="312" rx="5" ry="2" fill="#fff" opacity=".4"/>' +
      '<rect x="96" y="34" width="408" height="178" fill="#1d1420"/>' + net + '<path d="M90 214 V28 H510 V214" fill="none" stroke="#e9e2ea" stroke-width="10" stroke-linejoin="round"/>' + tg + keeper + ball + "</svg>";
  }
  OG.soccer = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: selectField("sc-diff", "Difficulty", [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]], ogPrefs.scDiff || "medium") +
          '<div id="sc-live" class="hidden">' + profitField("Total profit") + "</div>",
        after: '<button class="btn btn-secondary btn-block hidden" id="sc-random" style="height:42px">Random shot</button>',
        center: '<div class="sc"><div class="sc-pitch">' + soccerScene() + '<div class="sc-flash hidden" id="sc-flash"></div></div><div class="ladder" id="sc-ladder"></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "soccer", round = null, pending = false; // round: { amount, diff, goals }
      function diff() { return $("#sc-diff").value; }
      function T() { return SOCCER[round ? round.diff : diff()]; }
      function ladder() {
        var t = T(), g = round ? round.goals : 0, box = $("#sc-ladder"), kp = $("#sc-keeper"); if (!box) return;
        if (kp) kp.style.setProperty("--kit", SC_KIT[round ? round.diff : diff()]);
        box.innerHTML = ladderWin(t.mult.slice(1), g, !!round);
        var nx = box.querySelector(".next") || box.querySelector(".done:last-of-type"); if (nx && box.scrollWidth > box.clientWidth) box.scrollTo({ left: Math.max(0, nx.offsetLeft - box.clientWidth / 2), behavior: "smooth" });
      }
      function refresh() {
        var t = T();
        if (round) { var m = t.mult[round.goals]; ctx.setProfit(m, m.toFixed(2)); var p = $("#og-profit"); if (p) p.value = amtIn(round.amount * (m - 1)); }
        else ctx.setProfit(t.mult[1], t.mult[1].toFixed(2));
        ladder();
      }
      function setLive(on) {
        if (!$("#sc-live")) return;
        $("#sc-live").classList.toggle("hidden", !on); $("#sc-random").classList.toggle("hidden", !on); ctx.lock(on);
        $("#sc-svg").classList.toggle("live", on);
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.disabled = on && (!round || !round.goals);
      }
      function resetShot() {
        var svg = $("#sc-svg"); if (!svg) return;
        $("#sc-ball").style.transition = "none"; $("#sc-ball").style.transform = ""; $("#sc-keeper").style.transition = "none"; $("#sc-keeper").style.transform = "";
        $$(".sc-tg", svg).forEach(function (g) { g.classList.remove("blocked", "goal", "saved"); });
      }
      /* Anima o chute: bola vai ao alvo, goleiro mergulha; defendidos ficam com a luva */
      function animate(zone, blocked, goal) {
        return new Promise(function (done) {
          var svg = $("#sc-svg"); if (!svg) return done();
          resetShot(); void svg.getBoundingClientRect();
          var z = SC_Z[zone], dive = goal ? blocked[0] : zone, d = SC_Z[dive];
          var ball = $("#sc-ball"), kp = $("#sc-keeper");
          ball.style.transition = "transform .55s cubic-bezier(.25,.7,.3,1)"; ball.style.transform = "translate(" + (z[0] - 300) + "px," + (z[1] - 312) + "px) scale(.62)";
          kp.style.transition = "transform .45s cubic-bezier(.3,.8,.3,1) .08s"; kp.style.transform = "translate(" + ((d[0] - 300) * 0.82) + "px," + ((d[1] - 150) * 0.5) + "px) rotate(" + (d[0] < 300 ? -32 : d[0] > 300 ? 32 : 0) + "deg)";
          setTimeout(function () {
            if (!document.contains(svg)) return done();
            blocked.forEach(function (i) { var g = svg.querySelector('[data-sc="' + i + '"]'); if (g) g.classList.add("blocked"); });
            var tg = svg.querySelector('[data-sc="' + zone + '"]'); if (tg) tg.classList.add(goal ? "goal" : "saved");
            var fl = $("#sc-flash"); fl.className = "sc-flash " + (goal ? "goal" : "saved"); fl.textContent = goal ? "GOAL!" : "SAVED";
            setTimeout(function () { if (fl) fl.className = "sc-flash hidden"; done(); }, goal ? 650 : 900);
          }, 600);
        });
      }
      function layout(r) { return floats(r.server, r.client, r.nonce, 4 * (round.goals + 1)).then(function (fs) { return soccerFrom(fs, round.goals, SOCCER[round.diff].block); }); }
      function end(win) {
        var u = me(), k = round.goals, mult = win ? capMult(round.amount, SOCCER[round.diff].mult[k]) : 0;
        var b = db.settleRound(u.id, G, mult, win, { diff: round.diff, goals: k, shots: round.shots.join("") });
        round = null; setLive(false); refresh(); ctx.record(b);
      }
      function shoot(zone) {
        if (!round || pending) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        pending = true; ctx.btn().disabled = true; $("#sc-random").disabled = true;
        var got = RD.live ? db.roundAct(G, "shoot", { zone: zone }).then(function (x) { if (x.error) { ctx.msg(x.error); return null; } return x; })
          : layout(r).then(function (bl) { return { blocked: bl, goal: bl.indexOf(zone) < 0 }; });
        got.then(function (x) {
          if (!x || !round) { pending = false; return; }
          round.shots.push(zone);
          animate(zone, x.blocked, x.goal).then(function () {
            pending = false; if (!round) return; $("#sc-random").disabled = false;
            if (!x.goal) return end(false);
            round.goals++;
            if (RD.live ? !!x.bet : round.goals === SOCCER[round.diff].kicks) return end(true);
            if (!RD.live) db.updateRound(u.id, G, { diff: round.diff, goals: round.goals, shots: round.shots });
            resetShot(); refresh(); ctx.btn().disabled = false;
          });
        });
      }
      $("#sc-svg").addEventListener("click", function (e) { var t = e.target.closest("[data-sc]"); if (t) shoot(+t.getAttribute("data-sc")); });
      $("#sc-random").addEventListener("click", function () { shoot(Math.floor(Math.random() * 5)); });
      $("#sc-diff").addEventListener("change", function () { ogPrefs.scDiff = diff(); savePrefs(); refresh(); });
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u || pending) return;
        var df = diff(); pending = true;
        rStart(u, G, a, { diff: df, goals: 0, shots: [] }).then(function (r) {
          pending = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, diff: df, goals: 0, shots: [] }; renderHeader(); ctx.refresh(); resetShot(); setLive(true); refresh();
        });
      }
      refresh();
      return {
        refresh: refresh,
        click: function () {
          if (!round) return start();
          if (!round.goals || pending) return;
          pending = true;
          if (RD.live) return db.roundAct(G, "cashout").then(function (x) { pending = false; if (x.error) return ctx.msg(x.error); if (round) end(true); });
          pending = false; end(true);
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, diff: r.state.diff, goals: r.state.goals || 0, shots: (r.state.shots || []).slice() }; $("#sc-diff").value = round.diff; $("#og-amt").value = amtIn(r.amount); setLive(true); refresh(); }
        }
      };
    }
  };

  /* ---------- DOOR (escolha uma porta por andar, 10 andares, RTP 98%) ---------- */
  var DOOR = {"easy":{"bad":1,"mult":[1,1.3,1.74,2.32,3.09,4.12,5.5,7.34,9.78,13.05,17.4],"doors":4},"hard":{"bad":1,"mult":[1,1.96,3.92,7.84,15.68,31.36,62.72,125.44,250.88,501.76,1003.52],"doors":2},"expert":{"bad":2,"mult":[1,2.94,8.82,26.46,79.38,238.14,714.42,2143.25,6429.78,19289.34,57868.02],"doors":3},"medium":{"bad":1,"mult":[1,1.47,2.2,3.3,4.96,7.44,11.16,16.74,25.11,37.67,56.51],"doors":3}};
  /* Andar nº k: embaralha as portas com os números 3k…3k+2; as primeiras "bad" são armadilha */
  function doorFrom(fs, level, cfg) { var a = [], f = fs.slice(level * 3, level * 3 + 3); for (var i = 0; i < cfg.doors; i++) a.push(i); for (var j = 0; j < cfg.doors - 1; j++) { var x = j + Math.floor(f[j] * (cfg.doors - j)), t = a[j]; a[j] = a[x]; a[x] = t; } return a.slice(0, cfg.bad); }
  RD.fair.door = DOOR; RD.fair.doorFrom = doorFrom;
  var DOOR_KID = '<svg viewBox="0 0 60 110" class="dr-kid"><ellipse cx="30" cy="106" rx="20" ry="4" fill="#000" opacity=".4"/><rect x="18" y="66" width="10" height="38" rx="5" fill="#3b2a48"/><rect x="32" y="66" width="10" height="38" rx="5" fill="#3b2a48"/><rect x="14" y="34" width="32" height="38" rx="10" fill="#ff2e55"/><path d="M22 36 L30 46 L38 36" fill="none" stroke="#c8103a" stroke-width="2.5" stroke-linejoin="round"/><circle cx="30" cy="22" r="13" fill="#e8b48a"/><path d="M15 20 a15 13 0 0 1 30 0 v-1 h8 v4 h-38z" fill="#ff2e55"/><text x="30" y="17" text-anchor="middle" font-size="7" font-weight="900" fill="#fff">RD</text></svg>';
  var DR_GEM = '<svg viewBox="0 0 64 64" class="dr-prize"><path d="M18 12h28l12 14-26 32L6 26z" fill="#ff2e55"/><path d="M18 12h28l12 14H6z" fill="#ff7d96"/><path d="M6 26h52M18 12l8 14 6-14 6 14 8-14M26 26l6 32 6-32" fill="none" stroke="#9e0b2b" stroke-opacity=".5" stroke-width="1.6" stroke-linejoin="round"/><path d="M20 15l-6 9h9z" fill="#fff" opacity=".6"/></svg>';
  var DR_SKULL = '<svg viewBox="0 0 24 24" class="dr-prize bad"><path d="M12 3C7.6 3 4.5 6.1 4.5 10.2c0 2.6 1.2 4.4 3 5.4V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3.4c1.8-1 3-2.8 3-5.4C19.5 6.1 16.4 3 12 3z" fill="#fff"/><circle cx="9" cy="11" r="2" fill="#5a0a18"/><circle cx="15" cy="11" r="2" fill="#5a0a18"/><path d="M10.5 16.5v2M13.5 16.5v2" stroke="#5a0a18" stroke-width="1.4"/></svg>';
  OG.door = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: selectField("dr-diff", "Difficulty", [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]], ogPrefs.drDiff || "medium") +
          '<div id="dr-live" class="hidden">' + profitField("Total profit") + "</div>",
        after: '<button class="btn btn-secondary btn-block hidden" id="dr-random" style="height:42px">Random door</button>',
        center: '<div class="dr"><div class="dr-room" id="dr-room"><div class="dr-level" id="dr-level"></div><div class="dr-doors" id="dr-doors"></div>' + DOOR_KID + '</div><div class="ladder" id="dr-ladder"></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "door", round = null, pending = false; // round: { amount, diff, level }
      function diff() { return $("#dr-diff").value; }
      function C() { return DOOR[round ? round.diff : diff()]; }
      function doors(state) {
        var c = C(), box = $("#dr-doors"); if (!box) return;
        var h = ""; for (var i = 0; i < c.doors; i++) {
          var cls = state && state.bad.indexOf(i) > -1 ? " open bad" : state && state.open === i ? " open good" : state && state.reveal ? " open good dim" : "";
          h += '<button class="dr-door' + cls + '" data-dr="' + i + '"' + (round && !pending && !state ? "" : " disabled") + '><span class="dr-in">' + (cls.indexOf("bad") > -1 ? DR_SKULL : cls ? DR_GEM : "") + '</span><span class="dr-leaf"><i class="dr-num">' + (i + 1) + '</i><i class="dr-p1"></i><i class="dr-p2"></i><i class="dr-knob"></i></span><i class="dr-glow"></i></button>';
        }
        box.innerHTML = h; box.style.setProperty("--n", c.doors);
        var lv = round ? round.level : 0; $("#dr-level").textContent = "Floor " + (Math.min(lv + 1, 10)) + " / 10 · next " + (c.mult[lv + 1] ? c.mult[lv + 1].toFixed(2) + "×" : "—");
      }
      function ladder() {
        var c = C(), lv = round ? round.level : 0, box = $("#dr-ladder"); if (!box) return;
        box.innerHTML = ladderWin(c.mult.slice(1), lv, !!round);
        var nx = box.querySelector(".next"); if (nx && box.scrollWidth > box.clientWidth) box.scrollTo({ left: Math.max(0, nx.offsetLeft - box.clientWidth / 2), behavior: "smooth" });
      }
      function refresh() {
        var c = C();
        if (round) { var m = c.mult[round.level]; ctx.setProfit(m, m.toFixed(2)); var p = $("#og-profit"); if (p) p.value = amtIn(round.amount * (m - 1)); }
        else ctx.setProfit(c.mult[1], c.mult[1].toFixed(2));
        ladder();
      }
      function setLive(on) {
        if (!$("#dr-live")) return;
        $("#dr-live").classList.toggle("hidden", !on); $("#dr-random").classList.toggle("hidden", !on); ctx.lock(on);
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.disabled = on && (!round || !round.level);
      }
      function layout(r, level) { return floats(r.server, r.client, r.nonce, 3 * (level + 1)).then(function (fs) { return doorFrom(fs, level, DOOR[round.diff]); }); }
      function end(win, badShown) {
        var u = me(), k = round.level, mult = win ? capMult(round.amount, DOOR[round.diff].mult[k]) : 0;
        var b = db.settleRound(u.id, G, mult, win, { diff: round.diff, floors: k, picks: round.picks.join("") });
        round = null; setLive(false); refresh(); ctx.record(b);
        if (badShown) doors(badShown);
      }
      function pick(i) {
        if (!round || pending) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        pending = true; ctx.btn().disabled = true; doors();
        var lvl = round.level;
        var got = RD.live ? db.roundAct(G, "pick", { door: i }).then(function (x) { if (x.error) { ctx.msg(x.error); return null; } return x; })
          : layout(r, lvl).then(function (bad) { return { bad: bad, safe: bad.indexOf(i) < 0 }; });
        got.then(function (x) {
          if (!x || !round) { pending = false; doors(); return; }
          round.picks.push(i);
          var st = x.safe ? { bad: [], open: i } : { bad: x.bad, open: i };
          doors(st); var d = $$("#dr-doors .dr-door")[i]; if (d) d.classList.add("picked");
          setTimeout(function () {
            pending = false; if (!round) return;
            if (!x.safe) return end(false, { bad: x.bad, open: i, reveal: true });
            round.level++;
            if (RD.live ? !!x.bet : round.level === 10) return end(true, null);
            if (!RD.live) db.updateRound(u.id, G, { diff: round.diff, level: round.level, picks: round.picks });
            doors(); refresh(); ctx.btn().disabled = false;
          }, x.safe ? 650 : 900);
        });
      }
      $("#dr-doors").addEventListener("click", function (e) { var t = e.target.closest("[data-dr]"); if (t && !t.disabled) pick(+t.getAttribute("data-dr")); });
      $("#dr-random").addEventListener("click", function () { if (round) pick(Math.floor(Math.random() * DOOR[round.diff].doors)); });
      $("#dr-diff").addEventListener("change", function () { ogPrefs.drDiff = diff(); savePrefs(); doors(); refresh(); });
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u || pending) return;
        var df = diff(); pending = true;
        rStart(u, G, a, { diff: df, level: 0, picks: [] }).then(function (r) {
          pending = false; if (r.error) return ctx.msg(r.error);
          round = { amount: a, diff: df, level: 0, picks: [] }; renderHeader(); ctx.refresh(); doors(); setLive(true); refresh();
        });
      }
      doors(); refresh();
      return {
        refresh: refresh,
        click: function () {
          if (!round) return start();
          if (!round.level || pending) return;
          pending = true;
          if (RD.live) return db.roundAct(G, "cashout").then(function (x) { pending = false; if (x.error) return ctx.msg(x.error); if (round) end(true, null); });
          pending = false; end(true, null);
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, diff: r.state.diff, level: r.state.level || 0, picks: (r.state.picks || []).slice() }; $("#dr-diff").value = round.diff; $("#og-amt").value = amtIn(r.amount); doors(); setLive(true); refresh(); }
        }
      };
    }
  };

  /* ---------- COINFLIP (RTP 98%) ---------- */
  function coinMult(k) { return Math.floor(0.98 * Math.pow(2, k) * 100) / 100; }
  function coinFrom(fs) { return fs.map(function (f) { return f < 0.5 ? "heads" : "tails"; }); }
  RD.fair.coinFrom = coinFrom;
  OG.coinflip = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      var flips = []; for (var i = 1; i <= 10; i++) flips.push([i, i + (i === 1 ? " flip" : " flips")]);
      return {
        auto: true,
        side: '<div><div class="ogx-label">Modality</div><div class="ogx-split cf-mode"><button data-cfm="classic" class="active">Classic</button><button data-cfm="target">Target</button></div></div>' +
          '<div class="hidden" id="cf-target-wrap">' + selectField("cf-n", "Flips in a row", flips, ogPrefs.cfN || 3) + "</div>" +
          '<div class="ogx-row2 cf-pick"><button class="cf-side active" data-cfs="heads"><span class="cf-dot h"></span>Heads</button><button class="cf-side" data-cfs="tails"><span class="cf-dot t"></span>Tails</button></div>' +
          '<div class="og-manual-only">' + profitField("Payout") + "</div>",
        center: '<div class="cf"><div class="cf-coin" id="cf-coin"><div class="cf-face front"><svg viewBox="-110 -110 220 220">' + RD.art.coinSide("heads") + '</svg></div><div class="cf-face back"><svg viewBox="-110 -110 220 220">' + RD.art.coinSide("tails") + '</svg></div></div><div class="cf-row" id="cf-row"></div></div>',
        fields: '<div class="ogx-fields two"><div><div class="ogx-label">Multiplier</div><div class="ogx-input ro"><input id="cf-mult" readonly><span class="sfx">×</span></div></div><div><div class="ogx-label">Chance</div><div class="ogx-input ro"><input id="cf-chance" readonly><span class="sfx">%</span></div></div></div>'
      };
    },
    bind: function (ctx) {
      var mode = "classic", side = ogPrefs.cfSide || "heads", rot = 0, flipping = false;
      function n() { return mode === "classic" ? 1 : +$("#cf-n").value; }
      function refresh() {
        if (!$("#cf-mult")) return;
        var k = n(), m = coinMult(k); ctx.setProfit(m);
        $("#cf-mult").value = m.toFixed(2); $("#cf-chance").value = (100 / Math.pow(2, k)).toFixed(k > 6 ? 4 : 2);
        $$("[data-cfs]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-cfs") === side); });
      }
      $$("[data-cfm]").forEach(function (b) { b.addEventListener("click", function () { if (flipping) return; mode = b.getAttribute("data-cfm"); $$("[data-cfm]").forEach(function (x) { x.classList.toggle("active", x === b); }); $("#cf-target-wrap").classList.toggle("hidden", mode !== "target"); refresh(); }); });
      $$("[data-cfs]").forEach(function (b) { b.addEventListener("click", function () { if (flipping) return; side = b.getAttribute("data-cfs"); ogPrefs.cfSide = side; savePrefs(); refresh(); }); });
      $("#cf-n").addEventListener("change", function () { ogPrefs.cfN = n(); savePrefs(); refresh(); });
      function spin(face, ms) {
        var c = $("#cf-coin"); if (!c) return Promise.resolve();
        var base = rot - (rot % 360) + 360 * 3, target = base + (face === "tails" ? 180 : 0); if (target <= rot) target += 720; rot = target;
        c.classList.remove("land"); c.style.transition = "transform " + ms + "ms cubic-bezier(.2,.7,.2,1)"; c.style.transform = "rotateY(" + rot + "deg)";
        return new Promise(function (res) { setTimeout(function () { if (c && document.contains(c)) { c.classList.add("land"); } res(); }, ms); });
      }
      function play() {
        if (flipping) return Promise.resolve(null);
        var k = n(), m = coinMult(k), a = ctx.amount(), u = ctx.validate(a, m); if (!u) return Promise.resolve(null);
        var pick = side; flipping = true; ctx.lock(true);
        $$("[data-cfm],[data-cfs]").forEach(function (b) { b.disabled = true; });
        return roll(u, "coinflip", a, { flips: k, pick: pick }, k).then(function (s) {
          var fs = s.fs, nonce = s.nonce, client = s.client, res = coinFrom(fs), hits = 0; while (hits < k && res[hits] === pick) hits++;
          var shown = res.slice(0, Math.min(k, hits + 1)), win = hits === k, mult = win ? capMult(a, m) : 0;
          var b = s.place(mult, win, { result: shown.join(","), pick: pick, flips: k, hits: hits, nonce: nonce, client: client });
          if (b.error) { flipping = false; ctx.lock(false); ctx.msg(b.error); return null; }
          ctx.hold(b);
          var row = $("#cf-row"); if (row) row.innerHTML = k > 1 ? res.slice(0, k).map(function (_, i) { return '<span class="cf-mini" data-i="' + i + '"></span>'; }).join("") : "";
          var i = 0, per = k > 1 ? 650 : 900;
          return new Promise(function (done) {
            (function next() {
              if (i >= shown.length) {
                flipping = false; ctx.lock(false); $$("[data-cfm],[data-cfs]").forEach(function (x) { x.disabled = false; });
                ctx.record(b); return done({ win: win });
              }
              var face = shown[i];
              spin(face, per).then(function () {
                var mini = $('#cf-row [data-i="' + i + '"]'); if (mini) mini.className = "cf-mini " + (face === "heads" ? "h" : "t") + (face === pick ? " ok" : " bad");
                i++; setTimeout(next, 120);
              });
            })();
          });
        });
      }
      refresh();
      return { refresh: refresh, play: play, cooldown: 150 };
    }
  };

  /* ---------- PEDRA, PAPEL E TESOURA (sequência de vitórias, RTP 98%) ---------- */
  var RPS = ["rock", "paper", "scissors"], RPS_E = { rock: RD.art.rpsHand("rock"), paper: RD.art.rpsHand("paper"), scissors: RD.art.rpsHand("scissors") };
  function rpsMult(k) { return Math.round(0.98 * Math.pow(2, k) * 100) / 100; }
  function rpsBeats(a, b) { return (a === "rock" && b === "scissors") || (a === "scissors" && b === "paper") || (a === "paper" && b === "rock"); }
  function rpsFrom(f) { return RPS[Math.floor(f * 3)]; }
  RD.fair.rpsFrom = rpsFrom;
  OG.rps = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: '<div id="rps-live" class="hidden">' + profitField("Total profit") + "</div>",
        center: '<div class="rps"><div class="rps-ladder" id="rps-ladder"></div>' +
          '<div class="rps-duel" id="rps-arena"><div class="rps-side you" id="rps-you"><span class="rps-who">You</span><div class="rps-obj">' + RD.art.rpsArt("rock") + '</div></div><div class="rps-vs" id="rps-vs">VS</div><div class="rps-side house" id="rps-house"><span class="rps-who">House</span><div class="rps-obj">' + RD.art.rpsArt("rock") + "</div></div></div>" +
          '<div class="rps-picks">' + RPS.map(function (k) { return '<button class="rps-pick" data-rps="' + k + '" disabled><span class="rps-pic">' + RD.art.rpsArt(k) + "</span><small>" + k[0].toUpperCase() + k.slice(1) + "</small></button>"; }).join("") + "</div>" +
          '<div class="rps-hist" id="rps-hist"></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "rps", round = null, busy = false; // round: { amount, throws:[{p,h,r}], wins }
      function hand(el, k, cls) { if (!el) return; el.className = "rps-side " + (el.id === "rps-house" ? "house" : "you") + (cls ? " " + cls : ""); var o = el.querySelector(".rps-obj"); if (o) o.innerHTML = RD.art.rpsArt(k || "rock"); }
      function ladder() {
        var box = $("#rps-ladder"); if (!box) return; var w = round ? round.wins : 0, html = "";
        var ms = []; for (var i = 1; i <= 10; i++) ms.push(rpsMult(i)); html = ladderWin(ms, w, !!round);
        box.innerHTML = html;
        var cur = box.querySelector(".next") || box.querySelector(".done:last-of-type"); if (cur && box.scrollWidth > box.clientWidth) box.scrollLeft = cur.offsetLeft - box.clientWidth / 2;
      }
      function hist() { var h = $("#rps-hist"); if (!h) return; h.innerHTML = round ? round.throws.map(function (t) { return '<span class="' + t.r + '" title="' + t.p + " vs " + t.h + '">' + RD.art.rpsArt(t.r === "lose" ? t.h : t.p) + "</span>"; }).join("") : ""; } /* só o sinal que venceu: verde = você, vermelho = casa, amarelo = empate */
      function setLive(on) {
        if (!$("#rps-live")) return;
        $("#rps-live").classList.toggle("hidden", !on); ctx.lock(on);
        $$("[data-rps]").forEach(function (b) { b.disabled = !on || busy; });
        var b = ctx.btn(); b.textContent = on ? "Cashout" : "Bet"; b.disabled = on && (!round || !round.wins);
        if (on) { var m = round.wins ? rpsMult(round.wins) : 1; ctx.setProfit(m, m.toFixed(2)); $("#og-profit").value = amtIn(round.amount * (m - 1)); }
        ladder(); hist();
      }
      function settle(win) {
        var u = me(), k = round.wins, mult = win ? capMult(round.amount, rpsMult(k)) : 0;
        var b = db.settleRound(u.id, G, mult, win, { wins: k, throws: round.throws.map(function (t) { return t.p[0] + t.h[0]; }).join(" ") });
        round = null; setLive(false); ctx.record(b);
      }
      /* Animação: as duas mãos batem 3 vezes como punho, mostram a jogada e o vencedor ataca:
         tesoura corta o papel, pedra esmaga a tesoura, papel embrulha a pedra. */
      /* Duelo: os dois lados embaralham pedra/papel/tesoura, param na jogada e o vencedor brilha */
      function animate(p, h, res) {
        var you = $("#rps-you"), house = $("#rps-house"), arena = $("#rps-arena"); if (!arena) return Promise.resolve();
        var vs = $("#rps-vs"); vs.className = "rps-vs"; vs.textContent = "VS";
        return new Promise(function (done) {
          var n = 0, seq = ["rock", "paper", "scissors"];
          (function roll() {
            if (!document.contains(arena)) return done();
            if (n < 9) { hand(you, seq[n % 3], "rolling"); hand(house, seq[(n + 1) % 3], "rolling"); RD.sfx.play("tick", 0); n++; return setTimeout(roll, 85 + n * 9); }
            hand(you, p, "show"); hand(house, h, "show"); RD.sfx.play("card");
            setTimeout(function () {
              if (!document.contains(arena)) return done();
              if (res === "tie") { hand(you, p, "tie"); hand(house, h, "tie"); vs.className = "rps-vs tie"; vs.textContent = "TIE"; return setTimeout(done, 700); }
              hand(you, p, res === "win" ? "win" : "lose"); hand(house, h, res === "win" ? "lose" : "win");
              vs.className = "rps-vs " + res; vs.textContent = res === "win" ? "WIN" : "LOSE";
              setTimeout(done, 800);
            }, 260);
          })();
        });
      }
      function pick(p) {
        if (!round || busy) return; busy = true; $$("[data-rps]").forEach(function (b) { b.disabled = true; }); ctx.btn().disabled = true;
        var u = me(), r = db.activeRound(u.id, G); if (!r) { busy = false; return; }
        var i = round.throws.length;
        var got = RD.live ? db.roundAct(G, "throw", { hand: p }).then(function (x) { if (x.error) { busy = false; ctx.msg(x.error); setLive(true); return null; } return x; })
          : floats(r.server, r.client, r.nonce, i + 1).then(function (fs) { return { h: rpsFrom(fs[i]) }; });
        got.then(function (x) {
          if (!x || !round) return;
          var h = x.h, res = p === h ? "tie" : rpsBeats(p, h) ? "win" : "lose";
          round.throws.push({ p: p, h: h, r: res }); if (res === "win") round.wins++;
          if (res !== "lose") db.updateRound(u.id, G, { throws: round.throws, wins: round.wins });
          animate(p, h, res).then(function () {
            busy = false; if (!round) return;
            if (res === "lose") return settle(false);
            if (round.wins === 10) return settle(true);
            setLive(true);
          });
          if (res === "lose") db.updateRound(u.id, G, { throws: round.throws, wins: round.wins, lost: true });
        });
      }
      $$("[data-rps]").forEach(function (b) { b.addEventListener("click", function () { pick(b.getAttribute("data-rps")); }); });
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u) return;
        if (busy) return; busy = true;
        rStart(u, G, a, { throws: [], wins: 0 }).then(function (r) { busy = false; if (r.error) return ctx.msg(r.error); started(a); });
      }
      function started(a) {
        round = { amount: a, throws: [], wins: 0 }; renderHeader(); ctx.refresh(); hand($("#rps-you"), "rock"); hand($("#rps-house"), "rock"); $("#rps-vs").className = "rps-vs"; $("#rps-vs").textContent = "VS"; setLive(true);
      }
      hand($("#rps-you"), "rock"); hand($("#rps-house"), "rock"); ladder();
      return {
        refresh: function () {},
        click: function () {
          if (!round) return start(); if (busy || !round.wins) return;
          if (!RD.live) return settle(true);
          busy = true; db.roundAct(G, "cashout").then(function (x) { busy = false; if (x.error) return ctx.msg(x.error); if (round) settle(true); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G); if (!r) return;
          round = { amount: r.amount, throws: (r.state.throws || []).slice(), wins: r.state.wins || 0 };
          if (r.state.lost) return settle(false);
          $("#og-amt").value = amtIn(r.amount); setLive(true);
        }
      };
    }
  };

  /* ---------- BACCARAT (regras padrão, baralho infinito) ---------- */
  function bcVal(c) { return c.rank >= 10 ? 0 : c.rank; }
  function bcTot(cs) { return cs.reduce(function (a, c) { return a + bcVal(c); }, 0) % 10; }
  /* 6 números: P1 B1 P2 B2 e as terceiras cartas (do jogador e da banca) */
  function baccaratFrom(fs) {
    var c = fs.map(cardFrom), P = [c[0], c[2]], B = [c[1], c[3]], i = 4, p3 = null;
    var pt = bcTot(P), bt = bcTot(B);
    if (pt < 8 && bt < 8) {
      if (pt <= 5) { p3 = c[i++]; P.push(p3); }
      bt = bcTot(B);
      var draw = false;
      if (!p3) draw = bt <= 5;
      else { var x = bcVal(p3); draw = bt <= 2 || (bt === 3 && x !== 8) || (bt === 4 && x >= 2 && x <= 7) || (bt === 5 && x >= 4 && x <= 7) || (bt === 6 && (x === 6 || x === 7)); }
      if (draw) B.push(c[i++]);
    }
    var p = bcTot(P), b = bcTot(B);
    return { player: P, banker: B, p: p, b: b, winner: p > b ? "player" : b > p ? "banker" : "tie" };
  }
  var BC_PAY = { player: 2, banker: 1.95, tie: 9 };
  RD.fair.baccaratFrom = baccaratFrom;
  OG.baccarat = {
    label: function (b) { return '<b class="bc-w ' + b.detail.winner + '">' + (b.detail.winner === "tie" ? "T" : b.detail.winner[0].toUpperCase()) + " " + b.detail.p + "-" + b.detail.b + "</b>"; },
    cfg: function () {
      var spot = function (k, title, pays) { return '<button class="bc-spot ' + k + '" data-bc="' + k + '"><strong>' + title + "</strong><small>" + pays + '</small><i class="rl-chip hidden"></i></button>'; };
      return {
        auto: true, amountLabel: "Chip value",
        side: '<div><div class="ogx-label">Total bet</div><div class="ogx-input ro"><span class="cur">' + curSym() + '</span><input id="bc-total" readonly value="0.00"></div></div>',
        after: '<div class="ogx-row2"><button class="btn btn-secondary" style="height:42px" id="bc-undo">Undo</button><button class="btn btn-secondary" style="height:42px" id="bc-clear">Clear</button></div>',
        center: '<div class="bc"><div class="bc-hands"><div class="bc-hand player"><div class="bc-head"><span>Player</span><b id="bc-pt">0</b></div><div class="bj-cards" id="bc-pc"></div></div><div class="bc-hand banker"><div class="bc-head"><span>Banker</span><b id="bc-bt">0</b></div><div class="bj-cards" id="bc-bc"></div></div></div>' +
          '<div class="bc-result hidden" id="bc-result"></div><div class="bc-table">' + spot("player", "Player", "pays 1:1") + spot("tie", "Tie", "pays 8:1") + spot("banker", "Banker", "pays 0.95:1") + "</div></div>"
      };
    },
    bind: function (ctx) {
      var bets = {}, histB = [], dealing = false;
      function total() { var t = 0; for (var k in bets) t += bets[k]; return Math.round(t * 100) / 100; }
      function paint(win) {
        $$("[data-bc]").forEach(function (c) {
          var k = c.getAttribute("data-bc"), v = bets[k], chip = c.querySelector(".rl-chip");
          chip.classList.toggle("hidden", !v); if (v) chip.style.setProperty("--cc", chipColor(v)); chip.textContent = v ? (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v >= 10 ? Math.round(v) : v.toFixed(v < 1 ? 2 : 1)) : "";
          c.classList.toggle("win", win === k);
        });
        if ($("#bc-total")) $("#bc-total").value = amtIn(total());
      }
      function empty() { $("#bc-pc").innerHTML = '<div class="bj-card ghost"></div><div class="bj-card ghost"></div>'; $("#bc-bc").innerHTML = '<div class="bj-card ghost"></div><div class="bj-card ghost"></div>'; $("#bc-pt").textContent = "0"; $("#bc-bt").textContent = "0"; }
      $$("[data-bc]").forEach(function (c) { c.addEventListener("click", function () {
        if (dealing) return; var k = c.getAttribute("data-bc"), v = ctx.amount(); if (v < 0.01) return ctx.msg("Set a chip value first.");
        bets[k] = Math.round(((bets[k] || 0) + v) * 100) / 100; histB.push([k, v]); ctx.msg(""); $("#bc-result").className = "bc-result hidden"; paint();
      }); });
      $("#bc-undo").addEventListener("click", function () { if (dealing) return; var h = histB.pop(); if (!h) return; bets[h[0]] = Math.round((bets[h[0]] - h[1]) * 100) / 100; if (bets[h[0]] <= 0) delete bets[h[0]]; paint(); });
      $("#bc-clear").addEventListener("click", function () { if (dealing) return; bets = {}; histB = []; paint(); });
      function play() {
        var t = total(); if (!t) { ctx.msg("Place chips on Player, Banker or Tie first."); return Promise.resolve(null); }
        var u = ctx.validate(t); if (!u || dealing) return Promise.resolve(null);
        dealing = true; ctx.lock(true);
        return roll(u, "baccarat", t, { bets: JSON.parse(JSON.stringify(bets)) }, 6).then(function (s) {
          var fs = s.fs, nonce = s.nonce, client = s.client, g = baccaratFrom(fs), pay = 0;
          for (var k in bets) { if (k === g.winner) pay += bets[k] * BC_PAY[k]; else if (g.winner === "tie" && k !== "tie") pay += bets[k]; }
          var mult = capMult(t, Math.round((pay / t) * 10000) / 10000);
          var b = s.place(mult, pay > 0, { winner: g.winner, p: g.p, b: g.b, player: g.player.map(function (c) { return RANKS[c.rank] + SUITS[c.suit]; }).join(" "), banker: g.banker.map(function (c) { return RANKS[c.rank] + SUITS[c.suit]; }).join(" "), bets: JSON.parse(JSON.stringify(bets)), nonce: nonce, client: client });
          if (b.error) { dealing = false; ctx.lock(false); ctx.msg(b.error); return null; }
          ctx.hold(b);
          $("#bc-result").className = "bc-result hidden"; $("#bc-pc").innerHTML = ""; $("#bc-bc").innerHTML = ""; paint();
          var order = [["p", 0], ["b", 0], ["p", 1], ["b", 1]]; if (g.player[2]) order.push(["p", 2]); if (g.banker[2]) order.push(["b", 2]);
          return new Promise(function (done) {
            var i = 0;
            (function next() {
              if (!$("#bc-pc")) { dealing = false; return done({ win: pay > t }); }
              if (i < order.length) {
                var o = order[i], hand = o[0] === "p" ? g.player : g.banker, box = $(o[0] === "p" ? "#bc-pc" : "#bc-bc");
                box.insertAdjacentHTML("beforeend", bjCard(hand[o[1]]).replace("bj-card", "bj-card deal"));
                $(o[0] === "p" ? "#bc-pt" : "#bc-bt").textContent = bcTot(hand.slice(0, o[1] + 1));
                i++; return setTimeout(next, i === 4 ? 650 : 420);
              }
              var r = $("#bc-result"); r.className = "bc-result " + g.winner; r.textContent = g.winner === "tie" ? "Tie · " + g.p + " – " + g.b : (g.winner === "player" ? "Player" : "Banker") + " wins " + Math.max(g.p, g.b) + " – " + Math.min(g.p, g.b);
              paint(g.winner); dealing = false; ctx.lock(false); ctx.record(b); done({ win: pay > t });
            })();
          });
        });
      }
      empty(); paint();
      return { refresh: function () { if ($("#og-mult-lbl")) ctx.setProfit(1); }, play: play, cooldown: 150 };
    }
  };

  /* Provably fair (estilo Shuffle): aba Seeds (par ativo, próxima seed, trocar par, seeds reveladas) e aba Verify */
  function rndSeed() { var a = new Uint8Array(6); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function seedsModal(tabName, pre) {
    var u = me(); if (needLogin()) return;
    var s = db.seeds(u.id);
    Promise.all([s.hash ? s.hash : sha256(s.server), s.nextHash ? s.nextHash : s.next ? sha256(s.next) : null]).then(function (h) {
      var cp = function (label, val, extra) { return '<div class="pf-f"><label>' + label + '</label><div class="pf-copy"><code>' + esc(String(val)) + "</code>" + (extra === false ? "" : '<button class="pf-cbtn" data-copy="' + esc(String(val)) + '" aria-label="Copy">' + ic("copy", 15) + "</button>") + "</div></div>"; };
      var rev = s.revealed || [];
      var seedsPane = cp("Active client seed", s.client) + cp("Active server seed (hashed)", h[0]) + cp("Bets made with this pair", s.nonce, false) +
        '<h4 class="pf-h">Rotate seed pair</h4>' +
        '<div class="pf-f"><label>New client seed <span class="faint">*</span></label><div class="pf-row"><input class="input" id="new-client" value="' + rndSeed() + '" maxlength="64" spellcheck="false" autocomplete="off"><button class="btn btn-primary" data-action="rotate">Change</button></div></div>' +
        (h[1] ? cp("Next server seed (hashed)", h[1]) : "") +
        '<p class="pf-note">Changing the pair reveals your current server seed, so you can verify every bet made with it.</p>' +
        (rev.length ? '<h4 class="pf-h">Previous seeds</h4><div class="pf-prev">' + rev.slice(0, 8).map(function (r, i) {
          return '<div class="pf-prow"><div class="pf-pinfo"><code>' + esc(r.server.slice(0, 18)) + '…</code><small>Client ' + esc(r.client) + " · " + (Math.max(0, r.lastNonce) + 1) + ' bets</small></div><button class="pf-cbtn" data-copy="' + esc(r.server) + '" aria-label="Copy">' + ic("copy", 15) + '</button><button class="btn btn-secondary btn-sm" data-pf-verify="' + i + '">Verify</button></div>';
        }).join("") + "</div>" : "");
      openGeneric('<div class="pf"><div class="pf-head"><h3>Provably fair</h3><button class="icon-btn" data-close aria-label="Close">' + ic("x") + "</button></div>" +
        '<div class="pf-tabs"><button data-pf-tab="seeds">Seeds</button><button data-pf-tab="verify">Verify</button></div>' +
        '<div class="pf-pane" data-pane="seeds">' + seedsPane + "</div>" +
        '<div class="pf-pane" data-pane="verify">' + verifyForm(pre) + '<p class="pf-note">Only seeds that were rotated can be checked — the active server seed stays secret until you change the pair. <a class="link-sm" href="#/fairness" data-close>How it works</a></p></div></div>');
      var box = $("#modal-generic-box");
      var show = function (name) { $$("[data-pf-tab]", box).forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-pf-tab") === name); }); $$(".pf-pane", box).forEach(function (p) { p.classList.toggle("hidden", p.getAttribute("data-pane") !== name); }); };
      $$("[data-pf-tab]", box).forEach(function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-pf-tab")); }); });
      var gsel = box.querySelector(".vf-game"), cur = (currentPath || "").split("/");
      if (cur[0] === "game" && gsel.querySelector('option[value="' + cur[1] + '"]')) gsel.value = cur[1];
      bindVerify(box.querySelector(".vf"));
      $$("[data-pf-verify]", box).forEach(function (b) { b.addEventListener("click", function () {
        var r = rev[+b.getAttribute("data-pf-verify")], vf = box.querySelector(".vf");
        vf.querySelector(".vf-server").value = r.server; vf.querySelector(".vf-client").value = r.client; vf.querySelector(".vf-nonce").value = Math.max(0, r.lastNonce);
        show("verify");
      }); });
      show(tabName || "seeds");
    });
  }


  /* ---------- Promoções (estilo Shuffle: abas, destaque e grade; cada uma tem página própria) ---------- */
  var promoCat = "all";
  function promoEnds(p) {
    if (p.ends === "month") { var n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1) - 60000); }
    return p.ends ? new Date(p.ends) : null;
  }
  function promoArt(p, big) {
    return '<div class="pr-art' + (big ? " big" : "") + '">' + media(p, "", "") + '<div class="pr-copy"><span class="pr-chip">' + ic("spark", 13) + esc(p.badge || "") + "</span><h3>" + esc(p.value || p.title) + "</h3>" + (p.sub ? "<p>" + esc(p.sub) + "</p>" : "") + "</div></div>";
  }
  function promoMeta(p) {
    var e = promoEnds(p);
    return '<div class="pr-meta"><span class="pr-live">LIVE</span><span>' + (e ? "Ends " + e.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Always on") + "</span></div>";
  }
  pages.promotions = function (id) {
    var list = RD.promotions.filter(function (p) { return p.status !== "draft"; });
    if (id) {
      var p = list.filter(function (x) { return x.id === id; })[0]; if (!p) { location.hash = "#/promotions"; return ""; }
      return '<div class="container"><a class="pr-back" href="#/promotions">' + ic("chevronLeft", 16) + 'All promotions</a><div class="pr-feature">' + promoArt(p, true) +
        '<div class="pr-info"><h1>' + esc(p.title) + "</h1>" + promoMeta(p) + "<p>" + esc(p.desc) + '</p><div class="row wrap" style="gap:8px;margin-top:18px"><button class="btn btn-primary" data-promo="' + p.id + '">' + esc(p.cta || "Learn more") + '</button><a class="btn btn-secondary" href="#/legal/bonus">Terms</a></div></div></div></div>';
    }
    var shown = list.filter(function (p) { return promoCat === "all" || (p.cat || "casino") === promoCat; }), feat = shown.filter(function (p) { return p.featured; })[0] || shown[0], rest = shown.filter(function (p) { return p !== feat; });
    var tabs = '<div class="pr-tabs">' + [["all", "grid", "All"], ["casino", "cherry", "Casino"], ["sports", "ball", "Sports"]].map(function (t) { return '<button class="' + (promoCat === t[0] ? "active" : "") + '" data-prcat="' + t[0] + '">' + ic(t[1], 16) + t[2] + "</button>"; }).join("") + "</div>";
    return '<div class="container"><div class="page-head"><h1>Promotions</h1></div>' + tabs +
      (!feat ? '<div class="card empty" style="padding:56px 20px">' + ic("ball", 34) + '<h3 style="margin-top:12px">Sports promotions are coming</h3><p>They launch together with the sportsbook.</p></div>' :
        '<a class="pr-feature" href="#/promotions/' + feat.id + '">' + promoArt(feat, true) + '<div class="pr-info"><h2>' + esc(feat.title) + "</h2>" + promoMeta(feat) + "<p>" + esc(feat.desc) + "</p></div></a>" +
        (rest.length ? '<div class="pr-divider"></div><div class="pr-grid">' + rest.map(function (p) { return '<a class="pr-card" href="#/promotions/' + p.id + '">' + promoArt(p) + "<h3>" + esc(p.title) + "</h3></a>"; }).join("") + "</div>" : "")) + "</div>";
  };
  pages.promotions.after = function () {
    $$("[data-prcat]").forEach(function (b) { b.addEventListener("click", function () { promoCat = b.getAttribute("data-prcat"); route(true); }); });
  };


  /* ---------- VIP ---------- */
  function badge(t, size) { return RD.art.tierBadge(t, size); }
  function vipState(u) {
    var w = u ? u.wagered : 0, cur = db.tierOf(w), idx = cur ? RD.vipTiers.indexOf(cur) : -1, next = RD.vipTiers[idx + 1] || null, base = cur ? cur.wager : 0;
    var pct = next ? Math.max(0, Math.min(100, ((w - base) / (next.wager - base)) * 100)) : 100;
    var pending = u ? RD.vipTiers.filter(function (t) { return w >= t.wager && u.claimedTiers.indexOf(t.name) < 0; }) : [];
    return { w: w, cur: cur, idx: idx, next: next, pct: pct, pending: pending, pendingSum: pending.reduce(function (a, t) { return a + t.reward; }, 0) };
  }
  function vipWidget() {
    var u = me(); if (!u) return "";
    var v = vipState(u);
    return '<a class="sb-vip" href="#/vip">' + (isStaff(u.username) ? RD.art.ownerBadge(34) : badge(v.cur, 34)) + '<div class="grow"><div class="row between"><strong>' + (isStaff(u.username) ? "Owner" : v.cur ? v.cur.name : "Unranked") + "</strong><small>" + v.pct.toFixed(0) + '%</small></div><div class="progress sm"><span style="width:' + v.pct + '%"></span></div><small class="faint">' + (v.next ? fmt.usd(v.next.wager - v.w, { dec: 0 }) + " to " + v.next.name : "Top level reached") + "</small></div>" + (v.pending.length ? '<span class="sb-vip-dot" title="Reward ready"></span>' : "") + "</a>";
  }
  /* Cards de recompensa (iguais na janela VIP e na página VIP) */
  function untilTxt(iso) {
    var d = Math.max(0, new Date(iso).getTime() - Date.now()), h = Math.floor(d / 36e5), m = Math.floor((d % 36e5) / 6e4), sec = Math.floor((d % 6e4) / 1e3);
    return h >= 24 ? Math.floor(h / 24) + "d " + (h % 24) + "h" : h ? h + "h " + String(m).padStart(2, "0") + "m" : m + "m " + String(sec).padStart(2, "0") + "s";
  }
  function rewardCards(u) {
    var rb = u ? Math.floor(u.rakeback * 100) / 100 : 0, items = [{ key: "rakeback", label: "Instant Rakeback", amount: rb, status: rb >= 0.01 ? "ready" : "empty" }].concat(u ? db.bonusState(u.id) : []);
    if (!u) ["daily", "weekly", "monthly"].forEach(function (k) { var c = RD.config.bonuses[k]; items.push({ key: k, label: c.label, minTier: c.minTier, status: "locked", amount: 0 }); });
    return '<div class="rw-grid">' + items.map(function (it) {
      var top, btn, sub = "";
      if (it.status === "locked") { top = "Reach " + it.minTier; btn = '<button class="rw-btn" disabled>' + ic("lock", 14) + "Locked</button>"; }
      else if (it.status === "wait") { top = "Claim soon"; btn = '<span class="rw-btn outline" data-until="' + it.availableAt + '">' + untilTxt(it.availableAt) + "</span>"; }
      else if (it.status === "ready") { top = "Available"; sub = fmt.usd(it.amount); btn = '<button class="rw-btn ready" data-action="' + (it.key === "rakeback" ? "rakeback" : "claim-bonus") + '" data-key="' + it.key + '">Claim</button>'; }
      else { top = "Wager to unlock"; btn = '<button class="rw-btn" disabled>Claim</button>'; }
      if (it.key === "reload" && it.status !== "locked") top = "Remaining " + it.remaining + "/" + it.claims;
      return '<div class="rw' + (it.status === "ready" ? " is-ready" : "") + '"><div class="rw-top"><span>' + top + "</span>" + ic("gift", 15) + '</div><div class="rw-art">' + RD.art.rewardIcon(it.key, 58) + '</div><b>' + it.label + "</b>" + (sub ? '<small class="rw-amt">' + sub + "</small>" : "") + btn + "</div>";
    }).join("") + "</div>";
  }
  /* Códigos promocionais: o jogador digita e ganha o bônus na hora */
  function codeBox() {
    return '<form class="code-box" data-code-form><span class="code-ic">' + ic("gift", 18) + '</span><div class="grow"><b>Have a code?</b><small>Enter it to claim your bonus.</small></div>' +
      '<div class="code-row"><input class="input" name="code" placeholder="Code" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn btn-primary">Redeem</button></div></form>';
  }
  document.addEventListener("submit", function (e) {
    var f = e.target.closest && e.target.closest("[data-code-form]"); if (!f) return;
    e.preventDefault(); if (needLogin()) return;
    var inp = f.querySelector("input"), code = inp.value.trim(), btn = f.querySelector("button"); if (!code) return inp.focus();
    btn.disabled = true;
    Promise.resolve(db.redeemCode(me().id, code)).then(function (r) {
      btn.disabled = false;
      if (r.error) { RD.toast(r.error, "error"); return; }
      inp.value = ""; RD.toast("Code redeemed: +" + fmt.usd(r.amount)); renderHeader(); renderSidebar();
    });
  });
  function renderVipDrawer() {
    var u = me(), v = vipState(u), box = $("#vip-drawer-body"); if (!box) return;
    var tc = (v.cur && v.cur.color) || "#4da3ff";
    box.innerHTML = '<div class="vd-card"><div class="vd-banner" style="--tc:' + tc + '"><span class="vd-rays"></span><span class="vd-dots"></span>' +
      '<span class="vd-ped">' + badge(v.cur, 70) + "</span>" + (v.next ? '<span class="vd-track"><i></i><i></i><i></i>' + ic("chevronRight", 16) + '</span><span class="vd-ped next">' + badge(v.next, 50) + "</span>" : "") + "</div>" +
      '<div class="row between vd-prog-head"><span>Your VIP progress</span><strong>' + v.pct.toFixed(2) + "%</strong></div>" +
      '<div class="progress"><span style="width:' + v.pct + '%"></span></div>' +
      '<div class="row between vd-tiers"><span>' + badge(v.cur, 18) + (v.cur ? v.cur.name : "Unranked") + "</span><span>" + (v.next ? badge(v.next, 18) + v.next.name : "Max level") + "</span></div>" +
      '<a class="btn btn-primary btn-block" href="#/vip" data-close-drawer>View VIP program</a></div>' +
      '<h4 class="vd-h">' + ic("gift", 16) + "Available rewards</h4>" + rewardCards(u) + codeBox() +
      (!u ? '<button class="btn btn-secondary btn-block" style="margin-top:14px" data-open="register">Create an account to start earning</button>' : "");
    hydrateIcons(box);
  }
  function vipDot() { var u = me(), d = $("#vip-dot"); if (!d) return; var any = u && ((u.rakeback >= 0.01) || db.bonusState(u.id).some(function (b) { return b.status === "ready"; }) || vipState(u).pending.length); d.classList.toggle("hidden", !any); }
  setInterval(function () {
    var due = false;
    $$("[data-until]").forEach(function (el) { var iso = el.getAttribute("data-until"); if (new Date(iso).getTime() <= Date.now()) due = true; else el.textContent = untilTxt(iso); });
    if (due) { if ($("#drawer-vip").classList.contains("open")) renderVipDrawer(); else if (currentPath === "vip") route(true); renderRain(); }
  }, 1000);

  pages.vip = function () {
    var u = me(), v = vipState(u);
    var hero = '<div class="vip2-hero"><div class="vip2-me">' + badge(v.cur, 72) + '<div class="grow"><span class="eyebrow">' + (u ? "Your VIP level" : "RD VIP Club") + "</span><h2>" + (u ? (v.cur ? v.cur.name : "Unranked") : "Play. Level up. Get paid.") + "</h2>" +
      (u ? (v.next ? '<div class="vip2-prog"><div class="row between"><span>' + fmt.usd(v.w, { dec: 0 }) + ' <small class="faint">/ ' + fmt.usd(v.next.wager, { dec: 0 }) + '</small></span><strong>' + v.pct.toFixed(1) + '%</strong></div><div class="progress"><span style="width:' + v.pct + '%"></span></div><small class="faint">Wager ' + fmt.usd(v.next.wager - v.w) + " more to reach <b>" + v.next.name + "</b> and unlock " + fmt.usd(v.next.reward, { dec: 0 }) + "</small></div>" : '<p class="muted">You reached the highest level. Our team will contact you about bespoke rewards.</p>')
        : '<p class="muted" style="margin:6px 0 14px">Every dollar you wager counts toward your level. No opt-in, no hidden rules.</p><button class="btn btn-primary" data-open="register">Join now</button>') +
      "</div></div>" + (v.next ? '<div class="vip2-next">' + badge(v.next, 54) + '<small class="faint">Next level</small><strong>' + v.next.name + '</strong><span class="vip2-amt">' + fmt.usd(v.next.reward, { dec: 0 }) + "</span></div>" : "") + "</div>";
    var cards = '<div class="section">' + sectionHead("Rewards", "gift") + rewardCards(u) + codeBox() + "</div>";
    var table = '<div class="section">' + sectionHead("Wager rewards", "crown") + '<div class="card vip2-table">' +
      '<div class="vip2-row head"><span>Level</span><span>Wager required</span><span class="right">Reward</span><span></span></div>' +
      RD.vipTiers.map(function (t, i) {
        var reached = u && v.w >= t.wager, claimed = u && u.claimedTiers.indexOf(t.name) > -1, isNext = v.next === t;
        var btn = !u ? '<span class="vip2-st">Locked</span>' : claimed ? '<span class="vip2-st ok">' + ic("check", 13) + "Claimed</span>" : reached ? '<button class="btn btn-primary btn-sm" data-level="' + t.name + '">Claim</button>' : '<span class="vip2-st">' + (isNext ? v.pct.toFixed(0) + "%" : "Locked") + "</span>";
        return '<div class="vip2-row' + (i === v.idx ? " current" : "") + (reached ? " reached" : "") + '">' + '<span class="vip2-lvl">' + badge(t, 34) + "<b>" + t.name + "</b>" + (i === v.idx ? '<em>You</em>' : "") + '</span><span class="num muted">' + fmt.usd(t.wager, { dec: 0 }) + '</span><span class="right vip2-rw">' + fmt.usd(t.reward, { dec: 0 }) + '</span><span class="right">' + btn + "</span></div>";
      }).join("") + "</div></div>";
    var faq = '<div class="section"><details class="card vip2-how"><summary>' + ic("help", 18) + '<span>How it works</span>' + ic("chevronDown", 18) + '</summary><div class="vip2-faq">' + [
      ["How do I level up?", "Every bet you place counts toward your total wager. When it passes the amount of the next level, you move up automatically."],
      ["How are rewards paid?", "Each level has a one-time cash reward. Claim it on this page and it goes straight to your balance, with no wagering requirement."],
      ["What is rakeback?", "A share of the house edge of every bet you place comes back to you. It builds up as you play and you can claim it whenever you want."],
      ["Do levels expire?", "No. Your level is based on your lifetime wager and never goes down."],
      ["Daily, weekly and monthly bonuses", "They return part of the house edge from your recent play: daily every 24h from Bronze 2; weekly every Thursday at 12:00 (BRT) and monthly on the 1st at 12:00 (BRT) from Silver. The more you play, the bigger the bonus."],
      ["VIP Reload", "A special reload our VIP team gives to selected Gold players and above. When you have one, it shows up in your rewards with how many claims are left."]
    ].map(function (q) { return '<div class="vip2-qa"><h4>' + q[0] + "</h4><p>" + q[1] + "</p></div>"; }).join("") + "</div></details></div>";
    return '<div class="container">' + hero + cards + table + faq + "</div>";
  };

  pages.leaderboard = function () {
    var L = db.leaderboard(), u = me(), mine = u ? L.filter(function (r) { return r.userId === u.id || r.user === u.username; })[0] : null;
    var prizes = RD.config.leaderboardPrizes, rows = []; for (var ri = 0; ri < Math.max(prizes.length, Math.min(L.length, 50)); ri++) rows.push(L[ri] || null);
    var colors = ["#c0d0e0", "#f5c842", "#cd7f4e"], top = [L[1], L[0], L[2]];
    return '<div class="container"><div class="page-head"><h1>Monthly leaderboard</h1><p>Ranked by total wagered this calendar month (UTC). Top ' + RD.config.leaderboardPrizes.length + " get paid.</p></div>" +
      '<div class="lb-hero"><div class="card lb-pool"><span class="eyebrow">Prize pool</span><div class="big">' + fmt.usd(RD.config.leaderboardPrize, { dec: 0 }) + '</div><p class="muted">1st place: ' + fmt.usd(RD.config.leaderboardPrizes[0], { dec: 0 }) + "</p>" +
        '<div class="countdown"><div><strong data-cd="d">00</strong><small>days</small></div><div><strong data-cd="h">00</strong><small>hours</small></div><div><strong data-cd="m">00</strong><small>min</small></div><div><strong data-cd="s">00</strong><small>sec</small></div></div></div>' +
        '<div class="card podium">' + top.map(function (p, i) {
          var h = [80, 110, 60][i];
          return '<div class="podium-col">' + (p ? '<div class="avatar" style="background:' + colors[i] + ';color:#111">' + initials(p.user) + '</div><div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis">' + esc(p.user) + '</div><div class="faint" style="font-size:12px">' + fmt.usd(p.prize, { dec: 0 }) + "</div>" : '<div class="faint" style="font-size:12px">Open spot</div><div class="gold" style="font-size:12px;font-weight:700">' + fmt.usd(RD.config.leaderboardPrizes[[1, 0, 2][i]] || 0, { dec: 0 }) + "</div>") +
            '<div class="step" style="height:' + h + "px;background:" + colors[i] + "22;color:" + colors[i] + '">' + [2, 1, 3][i] + "</div></div>";
        }).join("") + "</div></div>" +
      '<div class="section"><div class="card"><div class="table-wrap"><table class="table lb-table"><thead><tr><th>Rank</th><th>Player</th><th class="right">Wagered</th><th class="right">Prize</th></tr></thead><tbody>' +
        rows.map(function (p, i) {
          var isMe = p && mine && p.userId === mine.userId;
          return "<tr" + (isMe ? ' style="background:var(--brand-soft)"' : "") + '><td><span class="rank-pill">' + (i + 1) + "</span></td>" +
            (p ? '<td class="strong"><span class="row" style="gap:8px">' + uBadge(p.user, db.player(p.userId) ? db.player(p.userId).wagered : 0, 22) + esc(p.user) + '</span></td><td class="right num">' + fmt.usd(p.wagered) + "</td>"
              : '<td class="faint">Open spot</td><td class="right faint">—</td>') +
            '<td class="right num strong' + (prizes[i] ? " gold" : " faint") + '">' + (prizes[i] ? fmt.usd(prizes[i], { dec: 0 }) : "—") + "</td></tr>";
        }).join("") + "</tbody></table></div></div></div></div>";
  };

  /* ---------- Affiliate ---------- */
  function refLink(code) { return location.origin + location.pathname + "?ref=" + code; }
  pages.affiliate = function (tab) {
    if (!me() || tab === "program") return affLanding();
    return affDashboard(tab || "overview");
  };
  pages.affiliate.after = function (tab) {
    if (!me() || tab === "program") return bindCalc();
    if (tab === "referrals") bindReferralFilter();
  };
  function affLanding() {
    var faqs = [
      ["How is commission calculated?", "You earn 15% of the Net Gaming Revenue (NGR) of every player you refer: what they bet minus what they won, minus the bonuses and rakeback they received."],
      ["What if a player wins?", "NGR is counted across all your players for life. When a player wins, it lowers your total until other play brings it back up. You never owe anything."],
      ["When do I get paid?", "Commission is calculated in real time. Collect it to your balance any time and withdraw in crypto."],
      ["Can I get a custom deal?", "Yes. Streamers and communities with proven traffic can get a custom revenue share. Contact us."],
      ["What traffic is not allowed?", "Brand bidding, incentivized or spam traffic, and any traffic from restricted countries. Players from restricted territories can't register and generate no commission."]
    ];
    return '<div class="container">' +
      '<section class="aff-hero">' + media({ img: RD.img.heroAffiliate, art: RD.img.heroArt }) + '<div class="shade"></div>' +
        '<div class="copy"><span class="badge" style="background:#fff;color:#160a10">RDCasino Partners</span><h1 style="margin-top:14px">Refer friends. Earn for life.</h1><p>15% revenue share for life and real-time stats for every player you bring.</p>' +
        '<div class="row wrap">' + (me() ? '<a class="btn btn-primary btn-lg" href="#/affiliate/overview">Open dashboard</a>' : '<button class="btn btn-primary btn-lg" data-open="register">Become a partner</button><button class="btn btn-secondary btn-lg" data-open="login">Sign in</button>') + "</div>" +
        '<div class="aff-hero-stats"><div><strong>15%</strong><small>revenue share</small></div><div><strong>Lifetime</strong><small>for every player</small></div><div><strong>Instant</strong><small>commission to balance</small></div></div></div></section>' +
      '<div class="section">' + sectionHead("How it works") + '<div class="steps">' +
        [["Get your link", "Every account has a referral link and code. Create extra codes for each channel."], ["Share it", "Players who register with your link or code are tied to you for life."], ["Collect", "Your commission grows as they play. Collect it to your balance any time."]].map(function (s, i) {
          return '<div class="card step"><div class="step-n">' + (i + 1) + "</div><h3>" + s[0] + "</h3><p>" + s[1] + "</p></div>";
        }).join("") + "</div></div>" +
      '<div class="section">' + sectionHead("Earnings calculator", "calc") + '<div class="card calc"><div class="calc-in">' +
        rangeRow("players", "New depositing players / month", 1, 200, 20, "") + rangeRow("deposit", "Average monthly deposit per player", 20, 2000, 250, "$") + rangeRow("months", "Months", 1, 24, 12, "") +
        '<small class="faint">Estimate assumes ~35% of deposits become NGR and 60% monthly player retention. Real results vary.</small></div>' +
        '<div class="calc-out"><span class="eyebrow">Estimated commission</span><div class="big num" id="calc-total">$0</div><div class="muted" id="calc-detail"></div></div></div></div>' +
      '<div class="section">' + sectionHead("Questions") + '<div class="card faq">' + faqs.map(function (f) { return "<details><summary>" + f[0] + ic("chevronDown", 16) + "</summary><p>" + f[1] + "</p></details>"; }).join("") + "</div></div></div>";
  }
  function rangeRow(id, label, min, max, val, pre) {
    return '<div class="range-row"><div class="row"><span class="muted">' + label + '</span><strong id="v-' + id + '">' + pre + val + '</strong></div><input type="range" id="r-' + id + '" min="' + min + '" max="' + max + '" value="' + val + '" data-pre="' + pre + '"></div>';
  }
  function bindCalc() {
    var r = ["players", "deposit", "months"].map(function (k) { return $("#r-" + k); });
    if (!r[0]) return;
    function calc() {
      r.forEach(function (el) { $("#v-" + el.id.slice(2)).textContent = el.getAttribute("data-pre") + Number(el.value).toLocaleString("en-US"); });
      var n = +r[0].value, dep = +r[1].value, months = +r[2].value;
      var plan = RD.affiliatePlans.filter(function (p) { return n >= p.min && n <= p.max; })[0];
      var active = 0, total = 0;
      for (var i = 0; i < months; i++) { active = active * 0.6 + n; total += active * dep * 0.35 * (plan.share / 100); }
      $("#calc-total").textContent = fmt.usd(total, { dec: 0 });
      $("#calc-detail").textContent = "at " + plan.share + "% · ~" + fmt.usd(total / months, { dec: 0 }) + " / month";
    }
    r.forEach(function (el) { el.addEventListener("input", calc); }); calc();
  }

  var AFF_TABS = [["overview", "Overview"], ["campaigns", "Campaigns"], ["referrals", "Referred players"]];
  function affDashboard(tab) {
    if (!AFF_TABS.some(function (t) { return t[0] === tab; })) tab = "overview";
    var u = me(), A = db.affiliate(u.id), link = refLink(A.code);
    var nextPlan = RD.affiliatePlans[A.plan.tier];
    var head = '<div class="aff-head"><div><span class="eyebrow">Affiliate</span><h1>Partner dashboard</h1></div><div class="row"><a class="btn btn-ghost btn-sm" href="#/affiliate/program">Program details</a><button class="btn btn-primary btn-sm" data-action="new-campaign">' + ic("plus", 16) + "New campaign</button></div></div>" +
      '<div class="card balance-card"><div><div class="kpi-label">Available to collect</div><div class="kpi-value num pos">' + fmt.usd(A.available) + '</div></div><div><div class="kpi-label">Commission (lifetime)</div><div class="kpi-value num">' + fmt.usd(A.commission) + '</div></div><div><div class="kpi-label">Your share</div><div class="kpi-value num">' + A.share + "%</div><small class=\"faint\">" + (A.custom ? "Custom deal" : A.plan.label + " tier") + '</small></div><div class="row bc-actions"><button class="btn btn-primary" data-action="collect"' + (A.available < 1 ? " disabled" : "") + ">" + ic("download", 16) + "Collect</button></div></div>" +
      '<div class="pill-tabs" style="margin:20px 0">' + AFF_TABS.map(function (t) { return '<a class="' + (t[0] === tab ? "active" : "") + '" href="#/affiliate/' + t[0] + '">' + t[1] + "</a>"; }).join("") + "</div>";
    var body = "";
    if (tab === "overview") {
      body = '<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Link clicks</div><div class="kpi-value num">' + fmt.int(A.clicks) + '</div></div><div class="kpi"><div class="kpi-label">Sign-ups</div><div class="kpi-value num">' + A.signups + '</div></div><div class="kpi"><div class="kpi-label">First deposits</div><div class="kpi-value num">' + A.ftds + '</div><div class="kpi-delta faint">' + A.ftdMonth + ' this month</div></div><div class="kpi"><div class="kpi-label">NGR (lifetime)</div><div class="kpi-value num">' + fmt.usd(A.ngr) + "</div></div></div>" +
        '<div class="grid-2" style="margin-top:16px"><div class="card"><div class="card-head"><h3>Commission — last 30 days</h3></div><div class="card-pad">' + (A.signups ? RD.bars(A.daily, "commission", function (v) { return fmt.usd(v); }) : empty("No referrals yet", "Share your link to start earning.")) + "</div></div>" +
        '<div class="card link-box"><h3>Your referral link</h3><p class="faint" style="font-size:13px;margin:4px 0 12px">Anyone who registers through it is linked to you for life.</p><div class="copy-field"><code>' + esc(link) + '</code><button class="btn btn-secondary btn-sm" data-copy="' + esc(link) + '">' + ic("copy", 14) + 'Copy</button></div>' +
          '<div class="row" style="margin-top:10px"><span class="faint" style="font-size:13px">Code</span><span class="badge">' + A.code + '</span><button class="btn btn-ghost btn-sm" data-copy="' + A.code + '">' + ic("copy", 14) + "</button></div>" +
          (nextPlan && !A.custom ? '<div class="divider"></div><div class="row between"><div><span class="eyebrow">Current tier</span><h3>' + A.plan.label + " · " + A.plan.share + '%</h3></div><span class="badge">Next: ' + nextPlan.share + '%</span></div><div class="tier-progress"><div class="progress"><span style="width:' + Math.min(100, (A.ftdMonth / nextPlan.min) * 100) + '%"></span></div><small class="faint">' + A.ftdMonth + " of " + nextPlan.min + " first deposits this month to reach " + nextPlan.label + "</small></div>" : "") + "</div></div>";
    }
    if (tab === "campaigns") {
      body = '<div class="card"><div class="card-head"><div><h3>Campaigns</h3><small class="faint">One code per channel shows you what converts.</small></div><button class="btn btn-primary btn-sm" data-action="new-campaign">' + ic("plus", 16) + "New campaign</button></div>" +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Campaign</th><th>Code</th><th class="right">Clicks</th><th class="right">Sign-ups</th><th class="right">FTDs</th><th class="right">NGR</th><th class="right">Commission</th><th></th></tr></thead><tbody>' +
        A.codes.map(function (c) { return '<tr><td class="strong">' + esc(c.name) + '</td><td><span class="badge">' + esc(c.code) + '</span></td><td class="right num">' + c.clicks + '</td><td class="right num">' + c.signups + '</td><td class="right num">' + c.ftds + '</td><td class="right num">' + fmt.usd(c.ngr) + '</td><td class="right num strong pos">' + fmt.usd(c.commission) + '</td><td class="right"><button class="btn btn-secondary btn-sm" data-copy="' + esc(refLink(c.code)) + '">' + ic("copy", 14) + "Link</button></td></tr>"; }).join("") +
        "</tbody></table></div></div>";
    }
    if (tab === "referrals") {
      body = '<div class="card"><div class="toolbar"><div class="input-search">' + ic("search") + '<input class="input" id="ref-q" placeholder="Search player"></div><select class="select" id="ref-camp" style="width:200px"><option value="">All codes</option>' + A.codes.map(function (c) { return "<option>" + esc(c.code) + "</option>"; }).join("") + '</select></div><div id="ref-body"></div></div>';
    }
    if (tab === "earnings") {
      body = '<div class="grid-2"><div class="card"><div class="card-head"><h3>Daily commission</h3></div><div class="card-pad">' + RD.bars(A.daily, "commission", function (v) { return fmt.usd(v); }) + "</div></div>" +
        '<div class="card card-pad"><h3>How it is calculated</h3><div class="stack" style="margin-top:14px;font-size:13px"><div class="row between"><span class="muted">Net gaming revenue (lifetime)</span><strong class="num">' + fmt.usd(A.ngr) + '</strong></div><div class="row between"><span class="muted">Your share</span><strong>' + A.share + '%</strong></div><div class="row between"><span class="muted">Commission</span><strong class="num">' + fmt.usd(A.commission) + '</strong></div><div class="row between"><span class="muted">Already collected</span><strong class="num">' + fmt.usd(A.paid) + '</strong></div><div class="divider" style="margin:6px 0"></div><div class="row between"><span>Available</span><strong class="num pos">' + fmt.usd(A.available) + "</strong></div></div>" +
        '<button class="btn btn-primary btn-block" style="margin-top:18px" data-action="collect"' + (A.available < 1 ? " disabled" : "") + ">Collect to balance</button></div></div>" +
        '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Collection history</h3></div>' + (A.payouts.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Date</th><th class="right">Amount</th></tr></thead><tbody>' + A.payouts.map(function (p) { return '<tr><td class="strong">' + p.id + "</td><td>" + fmt.date(p.date) + '</td><td class="right num strong">' + fmt.usd(p.amount) + "</td></tr>"; }).join("") + "</tbody></table></div>" : empty("Nothing collected yet", "")) + "</div>";
    }
    if (tab === "assets") {
      body = '<div class="asset-grid">' + RD.affiliateAssets.map(function (a) {
        return '<div class="card asset">' + media(a, "", "<span>" + a.name + '</span><small style="opacity:.7;font-size:12px">' + a.size + "</small>") + '<div class="asset-body"><div><strong style="font-size:13px">' + a.name + '</strong><br><small class="faint">' + a.size + '</small></div><a class="btn btn-secondary btn-sm btn-icon" title="Download" href="' + a.img + '" download>' + ic("download", 14) + "</a></div></div>";
      }).join("") + "</div>" +
        '<div class="section">' + sectionHead("Ready-to-use copy") + '<div class="card card-pad stack">' +
        ["Join me on RDCasino — provably fair originals and fast crypto withdrawals. Use code " + A.code + ": " + link, "Playing Dice on RDCasino. Sign up with my code " + A.code + " → " + link].map(function (t) {
          return '<div class="copy-field"><code style="white-space:normal">' + esc(t) + '</code><button class="btn btn-secondary btn-sm" data-copy="' + esc(t) + '">' + ic("copy", 14) + "Copy</button></div>";
        }).join("") + '<p class="faint" style="font-size:12px">Always add “18+ | Play responsibly” where the platform allows it.</p></div></div>';
    }
    return '<div class="container">' + head + body + "</div>";
  }
  function bindReferralFilter() {
    var q = $("#ref-q"), c = $("#ref-camp");
    function draw() {
      var rows = db.affiliate(me().id).referrals.filter(function (r) { return (!q.value || r.user.toLowerCase().indexOf(q.value.toLowerCase()) > -1) && (!c.value || r.code === c.value); });
      var share = db.affiliate(me().id).share;
      rows = rows.slice().sort(function (a, b) { return (b.ngr || 0) - (a.ngr || 0); });
      var tw = rows.reduce(function (a, r) { return a + (r.wagered || 0); }, 0), te = rows.reduce(function (a, r) { return a + Math.max(0, r.ngr || 0) * share / 100; }, 0);
      $("#ref-body").innerHTML = rows.length ? '<div class="ref-stats"><div><small>Players</small><b>' + rows.length + '</b></div><div><small>Active</small><b>' + rows.filter(function (r) { return r.wagered > 0; }).length + '</b></div><div><small>Total wagered</small><b>' + fmt.usd(tw) + '</b></div><div><small>You earned</small><b class="pos">' + fmt.usd(te) + '</b></div></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Rank</th><th>Player</th><th>Joined</th><th class="right">Deposits</th><th class="right">Wagered</th><th class="right">NGR</th><th class="right">You earned</th></tr></thead><tbody>' +
        rows.map(function (r, i) { var earned = Math.max(0, r.ngr || 0) * share / 100; return '<tr><td><span class="rank-pill">' + (i + 1) + '</span></td><td class="strong">' + esc(r.user) + "</td><td>" + String(r.joined).slice(0, 10) + '</td><td class="right num">' + fmt.usd(r.deposits) + '</td><td class="right num">' + fmt.usd(r.wagered) + '</td><td class="right num ' + (r.ngr < 0 ? "neg" : "") + '">' + fmt.usd(r.ngr) + '</td><td class="right num strong pos">' + fmt.usd(earned) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : empty("No referred players yet", "When someone registers with your link or code, they show up here.");
    }
    [q, c].forEach(function (el) { el.addEventListener("input", draw); }); draw();
  }
  function newCampaign() {
    openGeneric('<div class="modal-head"><h3>New campaign</h3><button class="icon-btn" data-close>' + ic("x") + '</button></div><form class="modal-body" id="camp-form"><div id="camp-error"></div>' +
      '<div class="field"><label>Campaign name</label><input class="input" name="name" required placeholder="e.g. YouTube channel"></div>' +
      '<div class="field"><label>Code</label><input class="input" name="code" required placeholder="3–16 letters or numbers" style="text-transform:uppercase"><span class="hint">Players can type this code at sign-up instead of using the link.</span></div>' +
      '<button class="btn btn-primary btn-block btn-lg">Create campaign</button></form>');
    $("#camp-form").addEventListener("submit", function (e) {
      e.preventDefault(); var f = e.target, r = db.addCampaign(me().id, f.name.value.trim(), f.code.value.trim());
      if (r.error) { $("#camp-error").innerHTML = errorBox(r.error); return; }
      closeAll(); RD.toast("Campaign created"); location.hash = "#/affiliate/campaigns"; route();
    });
  }

  /* ---------- Account ---------- */
  var KYC_LABEL = { "Not started": ["Not verified", ""], Pending: ["Under review", "badge-warn"], Verified: ["Verified", "badge-success"], Rejected: ["Rejected — resubmit", "badge-danger"] };
  /* ---------- Transações (estilo Rainbet/Razed): categorias, busca, CSV, status em ícone, hash com link ---------- */
  var TX_LABEL = { Deposit: "Deposit", Withdrawal: "Withdrawal", Adjustment: "Adjustment", Bonus: "Bonus", Rakeback: "Rakeback", "Level reward": "VIP reward", Commission: "Affiliate", "Tip sent": "Tip sent", "Tip received": "Tip received" };
  var TX_CATS = [["all", "All", "list"], ["dep", "Deposits", "download"], ["wd", "Withdrawals", "upload"], ["rw", "Rewards", "gift"], ["tip", "Tips", "send"], ["other", "Other", "more"]];
  function txCat(t) { return t.type === "Deposit" ? "dep" : t.type === "Withdrawal" ? "wd" : /Bonus|Rakeback|Level reward|Commission/.test(t.type) ? "rw" : /^Tip/.test(t.type) ? "tip" : "other"; }
  var EXPLORER = { TRC20: "https://tronscan.org/#/transaction/", ERC20: "https://etherscan.io/tx/", ETH: "https://etherscan.io/tx/", BEP20: "https://bscscan.com/tx/", BSC: "https://bscscan.com/tx/", BTC: "https://mempool.space/tx/", SOL: "https://solscan.io/tx/", SPL: "https://solscan.io/tx/", LTC: "https://blockchair.com/litecoin/transaction/", DOGE: "https://blockchair.com/dogecoin/transaction/" };
  function txExplorer(t) { var base = EXPLORER[(t.net || "").toUpperCase()] || EXPLORER[(t.coin || "").toUpperCase()]; return base && t.txHash ? base + encodeURIComponent(t.txHash) : null; }
  function txDate(iso) { var d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function txRow(t) {
    var out = t.type === "Withdrawal" || t.sign === -1, st = t.status === "Completed" ? ["ok", "check", t.type === "Withdrawal" ? "Sent" : "Complete"] : t.status === "Pending" ? ["wait", "clock", "Processing"] : ["bad", "x", "Rejected"];
    var link = txExplorer(t), mid;
    if (t.coin) mid = '<div class="tx-mid"><span class="tx-coin">' + coinDot(t.coin) + "<b>" + esc(t.coin) + "</b>" + (t.net ? '<small>' + esc(t.net) + "</small>" : "") + "</span>" +
      (t.txHash ? (link ? '<a class="tx-hash" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(t.txHash.slice(0, 22)) + "…" + ic("external", 13) + "</a>" : '<span class="tx-hash">' + esc(t.txHash.slice(0, 22)) + "…</span>") : '<span class="tx-hash faint">' + (t.address ? esc(t.address.slice(0, 22)) + "…" : "—") + "</span>") + "</div>";
    else mid = '<div class="tx-mid"><span class="tx-note">' + esc(t.note || "—") + "</span></div>";
    return '<div class="tx-row" data-q="' + esc((t.id + " " + (t.txHash || "") + " " + (t.note || "") + " " + (TX_LABEL[t.type] || t.type)).toLowerCase()) + '">' +
      '<span class="tx-st ' + st[0] + '" title="' + st[2] + '">' + ic(st[1], 15) + "</span>" +
      '<div class="tx-main"><b>' + esc(TX_LABEL[t.type] || t.type) + '</b><small>' + st[2] + " · " + esc(String(t.id).replace(/^TX-/, "#")) + "</small></div>" + mid +
      '<div class="tx-amt"><b class="' + (out ? "" : "pos") + '">' + (out ? "−" : "+") + money(t.amount) + "</b><small>" + txDate(t.date) + "</small></div></div>";
  }
  function txView(u, txs) {
    var cat = state.txCat || "all", list = txs.filter(function (t) { return cat === "all" || txCat(t) === cat; });
    var count = function (c) { return c === "all" ? txs.length : txs.filter(function (t) { return txCat(t) === c; }).length; };
    return '<div class="tx-wrap"><nav class="tx-nav">' + TX_CATS.map(function (c) { return '<button class="' + (c[0] === cat ? "active" : "") + '" data-txcat="' + c[0] + '">' + ic(c[2], 16) + "<span>" + c[1] + "</span><i>" + count(c[0]) + "</i></button>"; }).join("") + "</nav>" +
      '<div class="tx-body"><div class="tx-bar"><label class="tx-search">' + ic("search", 16) + '<input id="tx-q" placeholder="Search by ID, hash or note" autocomplete="off"></label><button class="btn btn-secondary" data-action="tx-csv">' + ic("download", 16) + "<span>Export CSV</span></button></div>" +
      (list.length ? '<div class="tx-list">' + list.map(txRow).join("") + '</div><div class="tx-none hidden">' + empty("No matches", "Try another ID or hash.") + "</div>"
        : empty("Nothing here yet", cat === "dep" || cat === "all" ? "Your deposits show up here as soon as they arrive." : "Transactions of this type show up here.", cat === "dep" || cat === "all" ? '<button class="btn btn-primary btn-sm" data-open="wallet">Deposit</button>' : "")) + "</div></div>";
  }
  function txCsv(u) {
    var cat = state.txCat || "all", rows = db.txOf(u.id).filter(function (t) { return cat === "all" || txCat(t) === cat; });
    var q = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = ["id,type,status,amount_usd,coin,network,tx_hash,note,date"].concat(rows.map(function (t) { return [t.id, TX_LABEL[t.type] || t.type, t.status, (t.type === "Withdrawal" || t.sign === -1 ? "-" : "") + t.amount, t.coin, t.net, t.txHash, t.note, t.date].map(q).join(","); })).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "rdcasino-transactions.csv"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  pages.account = function (tab) {
    var u = me();
    if (!u && RD.live && db.live && !db.live.ready) return '<div class="container"><div class="card empty" style="padding:60px 20px"><p>Loading your account…</p></div></div>'; /* sessão ainda carregando */
    if (!u) { setTimeout(function () { openAuth("login"); }, 0); return pages.home(); }
    tab = tab || "overview";
    var k = KYC_LABEL[u.kyc] || [u.kyc, ""], txs = db.txOf(u.id);
    var pendingWd = txs.filter(function (t) { return t.type === "Withdrawal" && t.status === "Pending"; }).reduce(function (a, t) { return a + t.amount; }, 0);
    var head = '<div class="page-head"><h1>' + esc(u.username) + '</h1><p>Member since ' + u.created.slice(0, 10) + "</p></div>" +
      '<div class="card balance-card"><div><div class="kpi-label">Balance</div><div class="kpi-value num">' + fmt.usd(u.balance) + '</div></div><div><div class="kpi-label">Pending withdrawals</div><div class="kpi-value num">' + fmt.usd(pendingWd) + "</div>" + (u.held > 0 ? '<small class="held-note">' + ic("lock", 12) + "On hold: " + fmt.usd(u.held) + " · contact support</small>" : "") + '</div><div><div class="kpi-label">Verification</div><div style="margin-top:6px"><span class="badge ' + k[1] + '">' + k[0] + '</span></div></div><div class="row bc-actions" style="gap:8px"><button class="btn btn-primary" data-open="wallet">Deposit</button><button class="btn btn-secondary" data-action="open-withdraw">Withdraw</button></div></div>' +
      '<div class="pill-tabs" style="margin:20px 0">' + [["overview", "Transactions"], ["bets", "Bets"], ["verification", "Verification"], ["stats", "Statistics"]].map(function (t) { return '<a class="' + (t[0] === tab ? "active" : "") + '" href="#/account/' + t[0] + '">' + t[1] + "</a>"; }).join("") + "</div>";
    var body;
    if (tab === "bets") body = '<div class="card">' + betsTable(db.betsOf(u.id).slice(0, 50), "Your bets show up here.") + "</div>";
    else if (tab === "verification") body = kycView(u, k);
    else if (tab === "stats") {
      var t = db.tierOf(u.wagered);
      body = '<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Total wagered</div><div class="kpi-value num">' + fmt.usd(u.wagered) + '</div></div><div class="kpi"><div class="kpi-label">Bets</div><div class="kpi-value num">' + fmt.int(u.bets) + '</div></div><div class="kpi"><div class="kpi-label">Profit</div><div class="kpi-value num ' + (u.profit >= 0 ? "pos" : "neg") + '">' + fmt.usd(u.profit) + '</div></div><div class="kpi"><div class="kpi-label">VIP level</div><div class="kpi-value">' + (t ? t.name : "Unranked") + "</div></div></div>";
    } else body = txView(u, txs);
    return '<div class="container">' + head + body + "</div>";
  };
  /* ---------- Verificação de identidade (KYC) ---------- */
  var KYC_FILES = {
    front: ["Front of document", "All four corners visible, no glare"],
    back: ["Back of document", "Needed for ID cards and driver's licenses"],
    selfie: ["Selfie with your document", "Hold the document next to your face"],
    address: ["Proof of address", "Utility bill or bank statement from the last 3 months"]
  };
  function kycView(u, k) {
    var info = u.kycInfo, steps = function (n) { return '<div class="kyc-steps">' + ["Personal details", "Documents", "Review"].map(function (t, i) { return '<div class="' + (i < n ? "done" : i === n ? "on" : "") + '"><span>' + (i < n ? ic("check", 13) : i + 1) + "</span>" + t + "</div>"; }).join("") + "</div>"; };
    var head = '<div class="row between kyc-head"><div><h3>Identity verification</h3><p class="faint">Required for withdrawals above ' + fmt.usd(RD.config.kycWithdrawLimit, { dec: 0 }) + ".</p></div><span class=\"badge " + k[1] + '">' + k[0] + "</span></div>";
    if (u.kyc === "Verified") return '<div class="card card-pad kyc">' + head + steps(3) + '<div class="kyc-state ok">' + ic("shield", 28) + "<div><b>You're verified</b><p class=\"muted\">No withdrawal limits apply to your account.</p></div></div></div>";
    if (u.kyc === "Pending") return '<div class="card card-pad kyc">' + head + steps(2) + '<div class="kyc-state wait">' + ic("clock", 28) + "<div><b>Documents under review</b><p class=\"muted\">Sent " + esc(info ? info.sent : "") + ". Reviews usually take less than 24 hours. We'll update this page when it's done.</p></div></div></div>";
    var f = info || {}, cc = f.country || u.country || "";
    return '<div class="card card-pad kyc">' + head + steps(0) +
      (u.kyc === "Rejected" ? errorBox("Your documents were rejected" + (u.kycReason ? ": " + esc(u.kycReason) : "") + ". Please send them again.") : "") +
      '<form id="kyc-form" novalidate><div id="kyc-msg"></div><h4 class="kyc-h">1. Personal details</h4><p class="faint kyc-sub">Exactly as written on your document.</p>' +
      '<div class="kyc-grid"><div class="field"><label>First name</label><input class="input" name="first_name" autocomplete="given-name" value="' + esc(f.first || "") + '"></div><div class="field"><label>Last name</label><input class="input" name="last_name" autocomplete="family-name" value="' + esc(f.last || "") + '"></div>' +
      '<div class="field"><label>Date of birth</label><input class="input" type="date" name="dob" value="' + esc(f.dob || "") + '"></div><div class="field"><label>Country of residence</label><input class="input" name="country" value="' + esc(cc) + '"></div>' +
      '<div class="field span2"><label>Address</label><input class="input" name="address" autocomplete="street-address" placeholder="Street and number" value="' + esc(f.address || "") + '"></div>' +
      '<div class="field"><label>City</label><input class="input" name="city" autocomplete="address-level2" value="' + esc(f.city || "") + '"></div><div class="field"><label>Postal code</label><input class="input" name="postal" autocomplete="postal-code" value="' + esc(f.postal || "") + '"></div></div>' +
      '<h4 class="kyc-h">2. Documents</h4><p class="faint kyc-sub">Clear photos or PDF, up to 10 MB each.</p>' +
      '<div class="kyc-doc">' + [["passport", "Passport"], ["id_card", "National ID"], ["driver_license", "Driver's license"]].map(function (d, i) { return '<button type="button" class="' + (i === 0 ? "active" : "") + '" data-kdoc="' + d[0] + '">' + ic(i === 0 ? "globe" : "id", 16) + d[1] + "</button>"; }).join("") + "</div>" +
      '<div class="kyc-files">' + Object.keys(KYC_FILES).map(function (key) { return '<label class="kyc-file' + (key === "back" ? " hidden" : "") + '" data-kfile="' + key + '"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" name="f_' + key + '"><span class="kyc-ic">' + ic(key === "selfie" ? "user" : key === "address" ? "home" : "id", 20) + '</span><span class="grow"><b>' + KYC_FILES[key][0] + "</b><small>" + KYC_FILES[key][1] + '</small></span><span class="kyc-pick">Upload</span></label>'; }).join("") + "</div>" +
      '<button class="btn btn-primary btn-lg btn-block" style="margin-top:18px">Submit for review</button>' +
      '<p class="kyc-safe">' + ic("lock", 14) + "Your documents are stored privately and only seen by our verification team.</p></form></div>";
  }
  pages.account.after = function () {
    var f = $("#kyc-form"); if (!f) return;
    var docType = "passport";
    $$("[data-kdoc]").forEach(function (b) { b.addEventListener("click", function () { docType = b.getAttribute("data-kdoc"); $$("[data-kdoc]").forEach(function (x) { x.classList.toggle("active", x === b); }); $('[data-kfile="back"]').classList.toggle("hidden", docType === "passport"); }); });
    $$(".kyc-file input").forEach(function (inp) { inp.addEventListener("change", function () {
      var box = inp.closest(".kyc-file"), file = inp.files[0];
      if (file && file.size > 10485760) { inp.value = ""; file = null; RD.toast("Each file must be 10 MB or less.", "error"); }
      box.classList.toggle("ok", !!file); box.querySelector(".kyc-pick").textContent = file ? (file.name.length > 18 ? file.name.slice(0, 15) + "…" : file.name) : "Upload";
    }); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var need = ["first_name", "last_name", "dob", "country", "address", "city"].filter(function (n) { return !f[n].value.trim(); });
      if (need.length) { $("#kyc-msg").innerHTML = errorBox("Fill in all personal details."); f[need[0]].focus(); return; }
      var keys = docType === "passport" ? ["front", "selfie", "address"] : ["front", "back", "selfie", "address"], files = {};
      var miss = keys.filter(function (k) { return !f["f_" + k].files[0]; });
      if (miss.length) { $("#kyc-msg").innerHTML = errorBox("Upload: " + miss.map(function (k) { return KYC_FILES[k][0].toLowerCase(); }).join(", ") + "."); return; }
      keys.forEach(function (k) { files[k] = f["f_" + k].files[0]; });
      var info = { first_name: f.first_name.value.trim(), last_name: f.last_name.value.trim(), dob: f.dob.value, country: f.country.value.trim(), address: f.address.value.trim(), city: f.city.value.trim(), postal: f.postal.value.trim(), doc_type: docType };
      var btn = f.querySelector("button.btn-primary"); btn.disabled = true; btn.textContent = "Uploading…";
      var demoInfo = { name: info.first_name + " " + info.last_name, first: info.first_name, last: info.last_name, dob: info.dob, doc: { passport: "Passport", id_card: "National ID", driver_license: "Driver's license" }[docType], sent: new Date().toISOString().slice(0, 10), country: info.country, address: info.address, city: info.city, postal: info.postal };
      Promise.resolve(RD.live ? db.submitKyc(me().id, info, files) : db.submitKyc(me().id, demoInfo)).then(function (r) {
        if (r && r.error) { btn.disabled = false; btn.textContent = "Submit for review"; $("#kyc-msg").innerHTML = errorBox(r.error); return; }
        RD.toast("Documents sent for review"); route(true);
      });
    });
  };

  /* ---------- Static pages ---------- */
  pages.sports = function () {
    var og = RD.games.filter(function (g) { return g.cat === "originals" && g.playable && g.enabled; });
    return '<div class="container"><section class="sports-soon"><div class="ss-art">' + ic("ball", 54) + '</div><span class="ss-tag">Coming soon</span><h1>Sports betting<br>is on the way</h1><p>Football, basketball, tennis, esports and more — with live odds. Until then, play RD Originals.</p><a class="btn btn-primary" href="#/casino/originals">Play RD Originals</a></section>' +
      '<div class="section">' + sectionHead("RD Originals", "star", "#/casino/originals") + '<div class="game-row">' + og.map(function (g) { return gameCard(g); }).join("") + "</div></div></div>";
  };
  /* Formulário de verificação (página Provably fair e aba Verify da janela) */
  var VF_GAMES = '<option value="dice">Dice</option><option value="limbo">Limbo</option><option value="crash">Crash</option><option value="plinko">Plinko</option><option value="mines">Mines</option><option value="hilo">Hi-Lo</option><option value="keno">Keno</option><option value="wheel">Wheel</option><option value="roulette">Roulette</option><option value="blackjack">Blackjack</option><option value="tower">Tower</option><option value="chicken">Chicken</option><option value="coinflip">Coinflip</option><option value="rps">Rock Paper Scissors</option><option value="baccarat">Baccarat</option><option value="double">Double</option><option value="spill">Spill</option><option value="soccer">Soccer</option><option value="door">Door</option>';
  var VF_EXTRA = { plinko: ["Rows / risk (e.g. 16 high)", "16 high"], mines: ["Number of mines", "3"], hilo: ["Cards drawn after the start card", "8"], blackjack: ["Cards to show", "8"], wheel: ["Segments / risk (e.g. 30 medium)", "30 medium"], tower: ["Difficulty", "easy"], chicken: ["Difficulty", "easy"], coinflip: ["Flips", "1"], rps: ["Throws to show", "5"], spill: ["Difficulty", "low"], soccer: ["Difficulty", "easy"], door: ["Difficulty", "easy"] };
  function verifyForm(pre) {
    pre = pre || {};
    return '<div class="vf"><div class="vf-row"><div class="field"><label>Game</label><select class="select vf-game">' + VF_GAMES + '</select></div>' +
      '<div class="field"><label class="vf-extra-l">Options</label><input class="input vf-extra" disabled></div></div>' +
      '<div class="field"><label>Server seed (revealed)</label><input class="input vf-server" value="' + esc(pre.server || "") + '" spellcheck="false" autocomplete="off"></div>' +
      '<div class="vf-row"><div class="field"><label>Client seed</label><input class="input vf-client" value="' + esc(pre.client || "") + '" spellcheck="false" autocomplete="off"></div><div class="field"><label>Nonce</label><input class="input vf-nonce" type="number" min="0" value="' + (pre.nonce || 0) + '"></div></div>' +
      '<button class="btn btn-primary btn-block" data-action="verify">Verify</button><div class="vf-out"></div></div>';
  }
  function bindVerify(root) {
    if (!root) return;
    var g = root.querySelector(".vf-game"), ex = root.querySelector(".vf-extra"), lb = root.querySelector(".vf-extra-l");
    function upd() { var cfg = VF_EXTRA[g.value]; ex.disabled = !cfg; lb.textContent = cfg ? cfg[0] : "Options"; ex.value = cfg ? cfg[1] : ""; }
    g.addEventListener("change", upd); upd();
  }
  pages.fairness = function () {
    return '<div class="container prose"><h1>Provably fair</h1><p class="muted" style="margin-top:8px">Every RD Originals result is generated by a process you can check yourself, bet by bet. You never have to take our word that a result was random — the proof is there on every round.</p>' +
      "<h2>What provably fair means</h2><p>The outcome of each game comes from a random process that neither RDCasino nor anyone else can change once you place your bet. You can confirm with simple math that every result was random, unpredictable and untouched. Provably fair guarantees randomness, not better odds: every game keeps the RTP shown on its page (98% on most RD Originals), the house edge simply works with no interference.</p>" +
      "<h2>How every bet is made fair</h2><p>Three values go into every result:</p><ul>" +
      "<li><strong>Server seed</strong> — a random value created by RDCasino. Before you bet you only see its SHA-256 hash, which locks it in: we can't swap it without the hash changing.</li>" +
      "<li><strong>Client seed</strong> — a value on your side. You can change it any time, so the result also depends on something we don't control.</li>" +
      "<li><strong>Nonce</strong> — a counter that goes up by one with every bet, so each result is unique.</li></ul>" +
      "<p>The three are combined with HMAC-SHA256 and the output decides the result. Because the server seed is committed before your client seed is used, nobody — including us — can predict or alter a result. When you rotate your seeds, the old server seed is revealed so you can check every bet you made with it.</p>" +
      '<h2>Verify any bet</h2><p>Open <button type="button" class="link-sm" data-action="seeds" style="background:none;border:0;padding:0;cursor:pointer;font:inherit">Fairness</button> (or the shield button under any game) to see the hash of your current server seed, change your client seed or rotate your seeds. After rotating, paste the revealed server seed, your client seed and the nonce of the bet into the checker at the bottom of this page — it rebuilds the result in seconds, right in your browser.</p>' +
      "<h2>Which games are provably fair?</h2><p>All RD Originals: Dice, Limbo, Crash, Plinko, Mines, Keno, Hi-Lo, Wheel, Roulette, Blackjack, Baccarat, Coinflip, Rock Paper Scissors, Tower, Chicken, Door, Soccer, Spill and Double. Every result is drawn on our server from your seeds and can be checked by you. Slots and live games from other studios use their own certified random number generators.</p>" +
      "<h2>FAQ</h2>" +
      "<p><strong>Does provably fair mean better odds?</strong><br>No. It proves results are random and untouched. The RTP of each game is shown on its page.</p>" +
      "<p><strong>Can I change my client seed?</strong><br>Yes, any time in Fairness. The change applies from your next bet.</p>" +
      "<p><strong>Do I need to understand cryptography?</strong><br>No. The checker below does the math: paste the seeds and the nonce and compare the result with the one you got.</p>" +
      "<p><strong>Why can't I see my current server seed?</strong><br>Showing it would let anyone predict the next results. You see its hash now and the seed itself as soon as you rotate.</p>" +
      "<p><strong>What if a result doesn't match?</strong><br>A valid bet always matches its seeds and nonce. If one doesn't, contact support with the bet ID.</p>" +
      "<h2>How results are made (technical)</h2><ul>" +
      "<li><strong>Dice / Limbo / Crash:</strong> <code>HMAC_SHA256(server_seed, client_seed:nonce)</code> → first 4 bytes → number between 0 and 1. Dice: <code>floor(n × 10001) / 100</code>. Limbo and Crash: <code>floor(0.98 / n × 100) / 100</code> (min 1.00×). Bets placed before 9 Oct 2026 used 0.99 (RTP 99%) in Dice, Limbo, Crash, Mines, Hi-Lo, Coinflip, Wheel, Plinko and Keno.</li>" +
      "<li><strong>All other games:</strong> need several numbers, made with <code>HMAC_SHA256(server_seed, client_seed:nonce:cursor)</code>, 8 numbers per cursor. Plinko: each row goes right if <code>n ≥ 0.5</code>. Mines: Fisher–Yates shuffle of the 25 tiles, the first N are mines. Hi-Lo and Blackjack: card = <code>floor(n × 52)</code> (infinite deck). In Hi-Lo the first card on the table is the last card of your previous round; every card after it comes from your seeds. Keno: shuffle of 1–40, first 10 are drawn. Wheel: segment = <code>floor(n × segments)</code>. Roulette: number = <code>floor(n × 37)</code>. Tower: on each of the 9 floors, Fisher–Yates shuffle of the tiles, the first ones are eggs. Chicken: Fisher–Yates shuffle of the 20 lanes, the first ones hide a car. Spill: Fisher–Yates shuffle of the 25 pours (like Mines), the first ones spill (1, 3, 5 or 10 by difficulty); multiplier after k pours = 0.98 ÷ chance of surviving k pours. Coinflip: heads if <code>n &lt; 0.5</code>. Rock Paper Scissors: house hand = <code>floor(n × 3)</code> (rock, paper, scissors), one number per throw. Baccarat: 6 cards in order P1 B1 P2 B2, then third cards when the standard rules ask for them.</li></ul>" +
      '<h2>Verify a bet</h2><div class="card card-pad">' + verifyForm() + '</div>' +
      '<p class="faint" style="font-size:13px;margin-top:12px">Open "Provably fair" in the bottom bar of any RD Original and rotate your seed to reveal the server seed used for your past bets.</p></div>';
  };
  pages.fairness.after = function () { bindVerify($(".vf")); };
  pages.responsible = function () {
    return '<div class="container prose"><h1>Responsible gaming</h1><p class="muted" style="margin-top:8px">Gambling should be entertainment, never a way to make money or escape problems.</p>' +
      "<h2>Tools</h2><ul><li>Deposit, loss and wager limits.</li><li>Session reminders.</li><li>Cool-off from 24 hours to 6 weeks.</li><li>Self-exclusion from 6 months to permanent.</li></ul>" +
      "<h2>Warning signs</h2><ul><li>Spending more than you can afford to lose.</li><li>Chasing losses.</li><li>Hiding gambling from people close to you.</li></ul>" +
      '<h2>Get help</h2><p><a class="link-sm" href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware</a> · <a class="link-sm" href="https://www.gamblersanonymous.org" target="_blank" rel="noopener">Gamblers Anonymous</a> · <a class="link-sm" href="https://www.gamblingtherapy.org" target="_blank" rel="noopener">Gambling Therapy</a></p></div>';
  };
  var LEGAL = { terms: "Terms of Service", privacy: "Privacy Policy", aml: "AML & KYC Policy", bonus: "Bonus Terms", cookies: "Cookie Policy" };
  pages.legal = function (doc) {
    return '<div class="container prose"><h1>' + (LEGAL[doc] || "Legal") + '</h1><div class="notice" style="margin:16px 0">' + ic("alert", 16) + "<span>Placeholder. This document must be drafted by a lawyer for the licensing jurisdiction before launch.</span></div>" +
      "<h2>Restricted territories</h2><p>Accounts may not be opened or used by residents of: " + RD.config.restrictedCountries.join(", ") + ".</p>" +
      "<h2>Other documents</h2><ul>" + Object.keys(LEGAL).map(function (k) { return '<li><a class="link-sm" href="#/legal/' + k + '">' + LEGAL[k] + "</a></li>"; }).join("") + "</ul></div>";
  };
  pages.notfound = function () {
    return '<div class="container"><div class="card empty" style="padding:72px 20px"><h2>Page not found</h2><p style="margin:8px 0 20px">The page you are looking for does not exist.</p><a class="btn btn-primary" href="#/">Back to lobby</a></div></div>';
  };

  function renderFooter() {
    var L = RD.config.license;
    var licenseLine = L.status === "active" && L.number
      ? esc(L.company) + " is licensed and regulated by " + esc(L.authority) + " under license no. " + esc(L.number) + ". " + esc(L.address)
      : "Licensing information will be published here.";
    $("#footer").innerHTML = '<div class="footer-in"><div class="footer-cols">' +
      '<div class="footer-about"><span class="brand-name">RD<span>Casino</span></span><p>Crypto casino with provably fair originals and fast withdrawals.</p><div class="footer-badges"><span class="age-badge">18+</span><span class="badge">' + ic("shield", 12) + 'Provably fair</span><span class="badge">' + ic("lock", 12) + "SSL</span></div></div>" +
      '<div><h4>Casino</h4><a href="#/casino/originals">RD Originals</a><a href="#/casino/slots">Slots</a><a href="#/casino/live">Live Casino</a><a href="#/casino/gameshows">Game Shows</a></div>' +
      '<div><h4>Rewards</h4><a href="#/promotions">Promotions</a><a href="#/vip">VIP Club</a><a href="#/leaderboard">Leaderboard</a><a href="#/affiliate">Affiliate</a></div>' +
      '<div><h4>Support</h4><a href="#" data-drawer="chat">Chat</a><a href="mailto:' + RD.config.supportEmail + '">Email us</a><a href="#/fairness">Provably fair</a><a href="#/responsible">Responsible gaming</a></div>' +
      '<div><h4>Legal</h4><a href="#/legal/terms">Terms of Service</a><a href="#/legal/privacy">Privacy Policy</a><a href="#/legal/aml">AML & KYC</a><a href="#/legal/bonus">Bonus Terms</a></div></div>' +
      '<div class="footer-legal"><div class="fl-row"><span class="fl-lbl">' + ic("shield", 13) + "License</span><span>" + licenseLine + '</span></div>' +
      '<div class="fl-row"><span class="fl-lbl">' + ic("ban", 13) + 'Not available in</span><span class="fl-chips">' + RD.config.restrictedCountries.map(function (c) { return "<i>" + esc(c) + "</i>"; }).join("") + "</span></div>" +
      '<div class="fl-copy">© ' + new Date().getFullYear() + " RDCasino. All rights reserved.</div></div></div>";
  }

  /* ---------- Chat ---------- */
  function renderRain() {
    var box = $("#rain-box"); if (!box) return;
    var r = RD.live && db.rain ? db.rain() : null;
    if (!r) { box.innerHTML = ""; return; }
    var left = new Date(r.ends_at).getTime() - Date.now();
    if (left <= 0) { box.innerHTML = '<div class="rain-card ending"><div class="rain-ic">' + rainIcon() + '</div><div class="grow"><b>Rain ending…</b><small>Splitting the pot</small></div></div>'; if (!renderRain.settling) { renderRain.settling = true; db.rainSettle().then(function () { renderRain.settling = false; renderRain(); }); } return; }
    box.innerHTML = '<div class="rain-card"><div class="rain-ic">' + rainIcon() + '</div><div class="grow"><b>Rain</b><div class="rain-stats"><span>' + ic("users", 13) + r.participants + '</span><span class="rain-timer">' + ic("clock", 13) + '<i data-until="' + r.ends_at + '">' + untilTxt(r.ends_at) + "</i></span></div>" + (+r.min_wager > 0 && !r.joined ? '<small class="rain-req">Wager ' + fmt.usd(+r.min_wager, { dec: 0 }) + ' in the last 7 days to join</small>' : '') + "</div>" +
      '<div class="rain-act">' + (r.joined ? '<button class="btn btn-sm rain-joined" disabled>' + ic("check", 14) + "Joined</button>" : '<button class="btn btn-primary btn-sm" data-rain="join">Join</button>') +
      '<div class="rain-pot"><span>' + fmt.usd(+r.amount) + '</span><button data-rain="add" aria-label="Add to rain">' + ic("plus", 13) + "</button></div></div></div>";
  }
  function rainIcon() { return '<svg viewBox="0 0 48 48" width="40" height="40"><path d="M14 30a9 9 0 0 1 1-18 12 12 0 0 1 22 4 7 7 0 0 1-1 14z" fill="#cfe3ff"/><path d="M14 30a9 9 0 0 1 1-18 12 12 0 0 1 22 4" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5" stroke="#4da3ff" stroke-width="3" stroke-linecap="round"/></svg>'; }
  function renderChat() {
    var list = db.chat(), box = $("#chat-list"), u = me();
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    var hue = function (name) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h; };
    renderRain();
    box.innerHTML = list.length ? list.map(function (m) {
      if (m.kind === "tip") return '<div class="chat-sys tip">' + ic("gift", 14) + "<span>" + esc(m.text) + "</span></div>";
      if (m.kind === "rain" || m.kind === "system") return '<div class="chat-sys">' + (m.kind === "rain" ? rainIcon().replace('width="40" height="40"', 'width="20" height="20"') : ic("alert", 14)) + "<span>" + esc(m.text) + "</span></div>";
      var pl = db.findByName(m.user), mine = u && u.username === m.user, h = hue(m.user || "?");
      return '<div class="chat-msg' + (mine ? " mine" : "") + (m.pending ? " pending" : "") + '"><div class="chat-bubble"><div class="chat-meta">' + uBadge(m.user, pl ? pl.wagered : 0, 16) + (mine || !u ? "<strong>" + esc(m.user) + "</strong>" : '<button class="chat-name" data-tip-user="' + esc(m.user) + '" title="Tip ' + esc(m.user) + '">' + esc(m.user) + "</button>") + '<time>' + (m.at ? new Date(m.at).toTimeString().slice(0, 5) : "") + "</time></div><p>" + esc(m.text) + "</p></div></div>";
    }).join("") : '<div class="empty" style="padding:40px 10px"><h3>No messages yet</h3><p>Say hi to the community.</p></div>';
    if (atBottom || !renderChat.seen) box.scrollTop = box.scrollHeight;
    renderChat.seen = true;
  }



  /* ---------- Suporte ao vivo (estilo Shuffle): Início · Mensagens · Ajuda ---------- */
  var HELP = [
    ["How do deposits work?", "Open Wallet → Deposit, choose the coin and network and send to the address shown. Send only that coin on that network. Our team confirms it on the blockchain and credits your balance — message us here with your transaction ID (TxID) if it takes longer than expected. Minimum deposit is $10."],
    ["How long do withdrawals take?", "Request it in Wallet → Withdraw with your address and the amount. The amount is reserved right away and our team sends it, usually within a few hours. Withdrawals above $2,000 need identity verification first."],
    ["How does the VIP program work?", "Every dollar you wager counts toward your level, from Bronze 1 to Amethyst 3. Each level pays a one-time reward you claim on the VIP page. Your level never goes down."],
    ["What is rakeback?", "A share of the house edge of every bet you place comes back to you instantly. It builds up as you play and you can claim it any time in Rewards."],
    ["Daily, weekly and monthly bonuses", "They return part of the house edge from your recent play: daily every 24h from Bronze 2; weekly every Thursday at 12:00 (BRT) and monthly on the 1st at 12:00 (BRT) from Silver. Claim them in Rewards when they are ready."],
    ["How do I redeem a code?", "Open the VIP Club (crown icon) and type the code in \"Have a code?\" under Rewards. Each code can be used once per account."],
    ["What is the Rain?", "Every hour a pot is split between everyone who clicks Join in the chat before the timer ends. To join you need $5,000 wagered in the last 7 days. Players can add to the pot too."],
    ["What is provably fair?", "Every RD Originals result comes from your seeds and our server seed. After you rotate your seeds you can check any bet on the Provably Fair page."],
    ["Why verify my identity?", "Identity verification (KYC) keeps accounts safe and is required for withdrawals above $2,000. Send it in Account → Verification; reviews usually take less than 24 hours."],
    ["Responsible gaming", "Only play with money you can afford to lose. If you want to take a break or close your account, message us here and we will help right away."]
  ];
  var sup = { open: false, tab: "home", article: null, q: "" };
  function supUnread() { return me() && db.supportUnread ? db.supportUnread(me().id) : 0; }
  function supBadge() {
    var n = supUnread();
    $$("[data-sup-badge]").forEach(function (b) { b.textContent = n; b.classList.toggle("hidden", !n); });
  }
  function supMount() {
    if ($("#sup-fab")) return;
    var fab = document.createElement("button"); fab.id = "sup-fab"; fab.className = "sup-fab"; fab.setAttribute("aria-label", "Live support");
    fab.innerHTML = ic("headset", 24) + '<span class="sup-dot hidden" data-sup-badge></span>';
    var pn = document.createElement("div"); pn.id = "sup-panel"; pn.className = "sup-panel"; pn.setAttribute("role", "dialog");
    document.body.appendChild(fab); document.body.appendChild(pn);
    fab.addEventListener("click", function () { supToggle(); });
    pn.addEventListener("click", supClick);
    pn.addEventListener("submit", function (e) {
      e.preventDefault(); var f = e.target, inp = f.querySelector("textarea, input");
      if (f.id === "sup-form") { var v = inp.value.trim(); if (!v || !me()) return; inp.value = ""; Promise.resolve(db.supportSend(me().id, v)).then(function (r) { if (r && r.error) { RD.toast(r.error, "error"); inp.value = v; } supRender(); }); }
    });
    pn.addEventListener("input", function (e) { if (e.target.id === "sup-q") { sup.q = e.target.value; var box = $("#sup-hits"); if (box) box.innerHTML = supHits(sup.tab === "home" && sup.article == null ? 4 : 0); } });
    pn.addEventListener("keydown", function (e) { if (e.target.id === "sup-text" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#sup-form").requestSubmit(); } });
    (db.onSupport || db.onChange)(function () { supBadge(); if (sup.open) { if (sup.tab === "messages" && me()) db.supportSeen(me().id); supRender(true); } });
    supBadge();
  }
  function supToggle(force, tab) {
    sup.open = force != null ? force : !sup.open; if (tab) { sup.tab = tab; sup.article = null; }
    $("#sup-panel").classList.toggle("open", sup.open); $("#sup-fab").classList.toggle("on", sup.open);
    $("#sup-fab").innerHTML = (sup.open ? ic("x", 22) : ic("headset", 24)) + '<span class="sup-dot hidden" data-sup-badge></span>';
    if (sup.open) { supRender(); if (sup.tab === "messages" && me()) db.supportSeen(me().id); }
    supBadge();
  }
  function supHits(limit) {
    var q = sup.q.trim().toLowerCase(), list = HELP.map(function (h, i) { return [h, i]; }).filter(function (x) { return !q || (x[0][0] + " " + x[0][1]).toLowerCase().indexOf(q) > -1; });
    if (limit && !q) list = list.slice(0, limit);
    return list.length ? list.map(function (x) { return '<button class="sup-art" data-sup-art="' + x[1] + '"><span>' + esc(x[0][0]) + "</span>" + ic("chevronRight", 16) + "</button>"; }).join("") : '<p class="faint sup-none">No articles found. Send us a message instead.</p>';
  }
  function supTime(iso) { var d = new Date(iso), diff = (Date.now() - d) / 6e4; return diff < 1 ? "now" : diff < 60 ? Math.floor(diff) + "m" : diff < 1440 ? Math.floor(diff / 60) + "h" : Math.floor(diff / 1440) + "d"; }
  function supRender(soft) {
    var pn = $("#sup-panel"); if (!pn || !sup.open) return;
    var u = me(), msgs = u && db.supportMessages ? db.supportMessages(u.id) : [], last = msgs[msgs.length - 1], body;
    if (sup.article != null) {
      var a = HELP[sup.article];
      body = '<div class="sup-body"><button class="sup-back" data-sup-tab="help">' + ic("chevronLeft", 16) + 'Help</button><article class="sup-article"><h3>' + esc(a[0]) + "</h3><p>" + esc(a[1]) + '</p></article><div class="sup-ask"><span>Still need help?</span><button class="btn btn-primary btn-sm" data-sup-tab="messages">Send us a message</button></div></div>';
    } else if (sup.tab === "messages") {
      if (soft && $("#sup-thread")) { var th = $("#sup-thread"), atB = th.scrollHeight - th.scrollTop - th.clientHeight < 60; th.innerHTML = supThread(msgs); if (atB) th.scrollTop = th.scrollHeight; return; }
      body = !u ? '<div class="sup-body sup-guest">' + ic("headset", 34) + "<h3>Chat with our team</h3><p class=\"muted\">Sign in to send us a message. We reply 24/7.</p><button class=\"btn btn-primary\" data-open=\"login\">Sign in</button></div>"
        : '<div class="sup-chat"><div class="sup-thread" id="sup-thread">' + supThread(msgs) + '</div><form class="sup-form" id="sup-form"><textarea id="sup-text" rows="1" maxlength="1000" placeholder="Write a message…"></textarea><button class="sup-send" aria-label="Send">' + ic("send", 18) + "</button></form></div>";
    } else if (sup.tab === "help") {
      body = '<div class="sup-body"><div class="sup-search">' + ic("search", 16) + '<input id="sup-q" placeholder="Search for help" value="' + esc(sup.q) + '"></div><div class="sup-list" id="sup-hits">' + supHits() + "</div></div>";
    } else {
      body = '<div class="sup-body">' +
        (u && last ? '<button class="sup-card sup-recent" data-sup-tab="messages"><small>Recent message</small><span class="row" style="gap:10px"><span class="sup-av">RD</span><span class="grow"><b>' + (last.fromStaff ? esc(last.staff || "RD Support") : "You") + '</b><span class="sup-prev">' + esc(last.text) + '</span></span><small class="faint">' + supTime(last.at) + "</small></span></button>" : "") +
        '<div class="sup-card"><div class="sup-search">' + ic("search", 16) + '<input id="sup-q" placeholder="Search for help" value="' + esc(sup.q) + '"></div><div class="sup-list" id="sup-hits">' + supHits(4) + "</div></div>" +
        '<button class="sup-card sup-cta" data-sup-tab="messages"><span><b>Send us a message</b><small>We usually reply in a few minutes</small></span>' + ic("send", 18) + "</button></div>";
    }
    var n = supUnread();
    pn.innerHTML = '<div class="sup-head' + (sup.tab === "home" && sup.article == null ? " big" : "") + '"><div class="row between"><span class="sup-logo">RD<span>Casino</span></span><button class="sup-x" data-sup-close aria-label="Close">' + ic("x", 18) + "</button></div>" +
      (sup.tab === "home" && sup.article == null ? "<h2>Hi " + esc(u ? u.username : "there") + ' 👋<br>How can we help?</h2>' : '<h3 class="sup-title">' + (sup.tab === "messages" ? "Messages" : "Help") + "</h3>") + "</div>" + body +
      '<nav class="sup-tabs">' + [["home", "home", "Home"], ["messages", "chat", "Messages"], ["help", "help", "Help"]].map(function (t) { return '<button class="' + (sup.tab === t[0] && sup.article == null ? "active" : "") + '" data-sup-tab="' + t[0] + '">' + ic(t[1], 20) + "<span>" + t[2] + "</span>" + (t[0] === "messages" && n ? '<i class="sup-count">' + n + "</i>" : "") + "</button>"; }).join("") + "</nav>";
    var th2 = $("#sup-thread"); if (th2) th2.scrollTop = th2.scrollHeight;
  }
  function supThread(msgs) {
    var intro = '<div class="sup-msg staff"><span class="sup-av">RD</span><div><b>RD Support</b><p>Hi! 👋 How can we help you today? Our team replies 24/7.</p></div></div>';
    return intro + msgs.map(function (m) {
      return m.fromStaff ? '<div class="sup-msg staff"><span class="sup-av">RD</span><div><b>' + esc(m.staff || "RD Support") + "</b><p>" + esc(m.text) + "</p><time>" + supTime(m.at) + "</time></div></div>"
        : '<div class="sup-msg me' + (m.pending ? " pending" : "") + '"><div><p>' + esc(m.text) + "</p><time>" + (m.pending ? "Sending…" : supTime(m.at)) + "</time></div></div>";
    }).join("");
  }
  function supClick(e) {
    var t = e.target.closest("[data-sup-tab],[data-sup-art],[data-sup-close]"); if (!t) return;
    if (t.hasAttribute("data-sup-close")) return supToggle(false);
    if (t.hasAttribute("data-sup-art")) { sup.article = +t.getAttribute("data-sup-art"); return supRender(); }
    sup.tab = t.getAttribute("data-sup-tab"); sup.article = null;
    if (sup.tab === "messages" && me()) db.supportSeen(me().id);
    supRender(); supBadge();
    if (sup.tab === "messages") { var tx = $("#sup-text"); if (tx) tx.focus(); }
  }
  supMount();

  /* ---------- Countdown ---------- */
  function countdown() {
    var now = new Date(), end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1), d = end - now.getTime();
    var v = { d: Math.floor(d / 864e5), h: Math.floor((d % 864e5) / 36e5), m: Math.floor((d % 36e5) / 6e4), s: Math.floor((d % 6e4) / 1e3) };
    $$("[data-cd]").forEach(function (el) { el.textContent = String(v[el.getAttribute("data-cd")]).padStart(2, "0"); });
    $$("[data-countdown-short]").forEach(function (el) { el.textContent = v.d + "d " + v.h + "h"; });
  }

  /* ---------- Router ---------- */
  var currentPath = "";
  function route(keep) {
    inFlight = {}; // trocar de página encerra animações pendentes: mostra o saldo real
    if (RD.sfx.music) RD.sfx.music.stop();
    var path = (location.hash || "#/").replace(/^#\/?/, "").replace(/\/$/, "");
    var parts = path.split("/"), name = parts[0] || "home", arg = parts[1];
    var fn = pages[name] || pages.notfound, u = me();
    document.body.classList.toggle("on-game", name === "game");
    currentPath = path;
    var banner = u && u.status !== "Active" ? '<div class="container" style="padding-bottom:0"><div class="notice" style="background:var(--danger-soft);border-color:rgba(255,122,89,.3);color:var(--danger)">' + ic("ban", 16) + "<span><strong>Your account is suspended.</strong> Deposits, bets and withdrawals are disabled. Contact support.</span></div></div>" : "";
    $("#view").innerHTML = banner + fn(arg);
    if (fn.after) fn.after(arg);
    closeAll(); markActive(path); countdown();
    if (!keep) window.scrollTo(0, 0);
  }

  /* ---------- Events ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open],[data-close],[data-drawer],[data-close-drawer],[data-action],[data-copy],[data-auth],[data-wtab],[data-coin],[data-net],[data-btab],[data-level],[data-promo],[data-tip-user],[data-disp-coin],#user-btn,#bal-btn,#burger,#bn-menu,#sb-backdrop");
    if (!t) {
      if (!e.target.closest(".menu-wrap")) $("#user-menu").classList.add("hidden");
      if (!e.target.closest("#bal-menu")) $("#bal-menu").classList.add("hidden");
      if (e.target.classList.contains("overlay")) closeAll();
      return;
    }
    if (t.hasAttribute("data-copy")) { e.preventDefault(); return RD.copy(t.getAttribute("data-copy")); }
    if (t.hasAttribute("data-open")) {
      e.preventDefault(); var w = t.getAttribute("data-open");
      if (w === "wallet") { if (needLogin()) return; openModal("wallet"); return renderWallet(); }
      return openAuth(w);
    }
    if (t.hasAttribute("data-close")) { closeAll(); return; }
    if (t.hasAttribute("data-drawer")) { e.preventDefault(); closeAll(); var dn = t.getAttribute("data-drawer"); if (dn === "vip") renderVipDrawer(); else renderChat(); $("#drawer-" + dn).classList.add("open"); return; }
    if (t.hasAttribute("data-close-drawer")) return closeAll();
    if (t.hasAttribute("data-auth")) { e.preventDefault(); return openAuth(t.getAttribute("data-auth")); }
    if (t.hasAttribute("data-tip-user")) { if (needLogin()) return; state.tipTo = t.getAttribute("data-tip-user"); state.walletTab = "tip"; closeAll(); openModal("wallet"); renderWallet(); var ia = $("#tip-amt"); if (ia) ia.focus(); return; }
    if (t.hasAttribute("data-wtab")) { state.walletTab = t.getAttribute("data-wtab"); return renderWallet(); }
    if (t.hasAttribute("data-coin")) { state.coin = t.getAttribute("data-coin"); return renderWallet(); }
    if (t.hasAttribute("data-net")) { state.net = t.getAttribute("data-net"); return renderWallet(); }
    if (t.hasAttribute("data-btab")) { state.betsTab = t.getAttribute("data-btab"); return renderFeed(); }
    if (t.hasAttribute("data-level")) { t.disabled = true; Promise.resolve(db.claimLevel(me().id, t.getAttribute("data-level"))).then(function (r1) { RD.toast(r1.error || "Claimed " + fmt.usd(r1.amount), r1.error ? "error" : ""); renderHeader(); renderSidebar(); markActive(currentPath); route(true); }); return; }
    if (t.hasAttribute("data-promo")) {
      var pid = t.getAttribute("data-promo");
      var pr = RD.promotions.filter(function (x) { return x.id === pid; })[0];
      if (pr && pr.route === "chat") { closeAll(); renderChat(); $("#drawer-chat").classList.add("open"); return; }
      if (pr && pr.route) { location.hash = "#/" + pr.route; return; }
      if (needLogin()) return;
      openModal("wallet"); state.walletTab = "deposit"; renderWallet();
      return RD.toast("Deposit to activate. Support credits the bonus after review.");
    }
    if (t.id === "user-btn") return $("#user-menu").classList.toggle("hidden");
    if (t.id === "bal-btn") { var bm = $("#bal-menu"); bm.classList.toggle("hidden"); if (!bm.classList.contains("hidden")) renderBalMenu(); return; }
    if (t.hasAttribute("data-disp-coin")) {
      var cc = t.getAttribute("data-disp-coin"), uu = me(); if (!uu || cc === uu.coin) { $("#bal-menu").classList.add("hidden"); return; }
      Promise.resolve(db.setCoin ? db.setCoin(cc) : null).then(function (r) { if (r && r.error) return RD.toast(r.error, "error"); $("#bal-menu").classList.add("hidden"); renderHeader(); });
      return;
    }
    if (t.id === "burger" || t.id === "bn-menu") return document.body.classList.toggle("sb-open");
    if (t.id === "sb-backdrop") return closeAll();

    var u = me(), a = t.getAttribute("data-action");
    switch (a) {
      case "logout": Promise.resolve(db.logout()).then(function () { renderHeader(); renderSidebar(); closeAll(); location.hash = "#/"; route(); RD.toast("Signed out"); }); return;
      case "new-campaign": return newCampaign();
      case "collect": { t.disabled = true; Promise.resolve(db.collectCommission(u.id)).then(function (c) { t.disabled = false; RD.toast(c.error || fmt.usd(c.amount) + " added to your balance", c.error ? "error" : ""); renderHeader(); route(true); }); return; }
      case "claim-bonus": {
        if (needLogin()) return; t.disabled = true;
        Promise.resolve(db.claimBonus(u.id, t.getAttribute("data-key"))).then(function (cb) {
          RD.toast(cb.error || "Claimed " + fmt.usd(cb.amount), cb.error ? "error" : ""); renderHeader(); renderSidebar(); markActive(currentPath);
          if ($("#drawer-vip").classList.contains("open")) renderVipDrawer();
          if (currentPath === "vip") route(true);
        });
        return;
      }
      case "vip-claim-all": {
        if (needLogin()) return; var got = 0;
        vipState(u).pending.reduce(function (pr, tr) { return pr.then(function () { return Promise.resolve(db.claimLevel(u.id, tr.name)).then(function (r2) { if (r2.amount) got += r2.amount; }); }); }, Promise.resolve()).then(function () {
          RD.toast(got ? "Claimed " + fmt.usd(got) + " in VIP rewards" : "Nothing to claim yet", got ? "" : "error"); renderHeader(); renderSidebar(); markActive(currentPath); route(true);
        });
        return;
      }
      case "rakeback": { if (needLogin()) return; t.disabled = true; Promise.resolve(db.claimRakeback(u.id)).then(function (rb) { if ($("#drawer-vip").classList.contains("open")) renderVipDrawer(); RD.toast(rb.error || "Claimed " + fmt.usd(rb.amount), rb.error ? "error" : ""); renderHeader(); route(true); }); return; }
      case "seeds": return seedsModal();
      case "tx-csv": return txCsv(u);
      case "rotate": { t.disabled = true; Promise.resolve(db.rotateSeed(u.id, ($("#new-client").value || "").trim())).then(function (rs) { t.disabled = false; if (rs && rs.error) return RD.toast(rs.error, "error"); RD.toast("Seed pair changed — previous server seed revealed"); seedsModal(); }); return; }
      case "open-withdraw": state.walletTab = "withdraw"; openModal("wallet"); return renderWallet();
      case "wd-max": $("#wd-amt").value = u.balance.toFixed(2); return;
      case "live-deposit": {
        var lw = db.wallets().filter(function (x) { return x.coin === state.coin && x.network === state.net; })[0], la = parseFloat($("#dep-amt").value), lh = $("#dep-hash").value.trim();
        if (!lw) return;
        if (!(la > 0)) { $("#dep-msg").innerHTML = errorBox("Enter the amount you sent."); return; }
        if (lh.length < 10) { $("#dep-msg").innerHTML = errorBox("Paste the transaction hash (TxID)."); return; }
        t.disabled = true;
        return db.requestDeposit(lw, la, lh).then(function (r) {
          t.disabled = false;
          if (r.error) { $("#dep-msg").innerHTML = errorBox(r.error); return; }
          closeAll(); RD.toast("Deposit submitted — we'll credit it after checking the blockchain"); route(true);
        });
      }
      case "sim-deposit": {
        var d = parseFloat($("#dep-amt").value), r = db.deposit(u.id, d, state.coin);
        if (r.error) { $("#dep-msg").innerHTML = errorBox(r.error); return; }
        closeAll(); renderHeader(); RD.toast(fmt.usd(d) + " credited to your balance"); return route(true);
      }
      case "withdraw": {
        var amt = parseFloat($("#wd-amt").value), addr = $("#wd-addr").value.trim();
        if (addr.length < 20) { $("#wd-msg").innerHTML = errorBox("Enter a valid wallet address."); return; }
        if (RD.live) {
          if (!(amt > 0)) { $("#wd-msg").innerHTML = errorBox("Enter an amount."); return; }
          return db.requestWithdrawal(u.id, amt, { coin: state.coin, network: state.net }, addr).then(function (r) {
            if (r.error) { $("#wd-msg").innerHTML = errorBox(r.error); return; }
            closeAll(); renderHeader(); RD.toast("Withdrawal of " + fmt.usd(amt) + " sent for review"); route(true);
          });
        }
        var w2 = db.requestWithdrawal(u.id, amt, state.coin, addr);
        if (w2.error) { $("#wd-msg").innerHTML = errorBox(w2.error, w2.kyc ? ' <a href="#/account/verification" class="link-sm" data-close>Verify now</a>' : ""); return; }
        closeAll(); renderHeader(); RD.toast("Withdrawal of " + fmt.usd(amt) + " sent for review"); return route(true);
      }
      case "tip": {
        var to = $("#tip-to").value.trim(), ta = Math.round(parseFloat($("#tip-amt").value) * 100) / 100;
        if (!to) { $("#tip-msg").innerHTML = errorBox("Type the username."); return; }
        if (!(ta >= 1)) { $("#tip-msg").innerHTML = errorBox("Minimum tip is $1."); return; }
        if (!confirm("Send " + fmt.usd(ta) + " to " + to + "? Tips can't be reversed.")) return;
        t.disabled = true;
        Promise.resolve(db.tip(u.id, to, ta, $("#tip-pub").checked)).then(function (tp) {
          t.disabled = false;
          if (tp.error) { $("#tip-msg").innerHTML = errorBox(tp.error); return; }
          state.tipTo = ""; closeAll(); renderHeader(); if ($("#drawer-chat") && $("#drawer-chat").classList.contains("open")) renderChat(); RD.toast("Tip sent to " + to);
        });
        return;
      }
      case "open-support": { e.preventDefault(); document.body.classList.remove("sb-open"); supToggle(true, "home"); return; }
      case "tip-max": { $("#tip-amt").value = Math.floor(u.balance * 100) / 100; return; }
      case "tip-set": { $("#tip-amt").value = t.getAttribute("data-v"); return; }
      case "verify": {
        var vf = t.closest(".vf"), q = function (c) { return vf.querySelector(c); }, vout = q(".vf-out");
        var game = q(".vf-game").value, sv = q(".vf-server").value.trim(), cl = q(".vf-client").value.trim(), n = parseInt(q(".vf-nonce").value, 10) || 0, extra = (q(".vf-extra").value || "").trim();
        if (!sv || !cl) { vout.innerHTML = errorBox("Fill in both seeds."); return; }
        var show = function (txt) { sha256(sv).then(function (h) { vout.innerHTML = '<div class="notice info">' + ic("check", 16) + "<span>" + txt + "<br>Server seed hash: <code>" + h + "</code></span></div>"; }); };
        if (game === "dice" || game === "limbo" || game === "crash") {
          hmac(sv, cl + ":" + n).then(function (buf) { var o = outcome(game, floatFrom(buf)); show("Result: <strong>" + (game === "dice" ? o.toFixed(2) : o.toFixed(2) + "×") + "</strong>"); });
        } else if (game === "plinko") {
          var pr = extra.split(/\s+/), rows = +pr[0] || 16, rk = (pr[1] || "high").toLowerCase();
          if (!PLINKO[rows] || !PLINKO[rows][rk]) { vout.innerHTML = errorBox("Use 8 to 16 rows and low, medium or high."); return; }
          floats(sv, cl, n, rows).then(function (fs) { var path = fs.map(function (f) { return Math.floor(f * 2); }), slot = path.reduce(function (a, b) { return a + b; }, 0); show("Path: <code>" + path.map(function (x) { return x ? "R" : "L"; }).join("") + "</code> → slot " + (slot + 1) + " of " + (rows + 1) + " → <strong>" + PLINKO[rows][rk][slot] + "×</strong>"); });
        } else if (game === "mines") {
          var mc = Math.max(1, Math.min(24, parseInt(extra, 10) || 3));
          floats(sv, cl, n, 24).then(function (fs) { show("Mines at tiles: <strong>" + minesFrom(fs, mc).map(function (x) { return x + 1; }).sort(function (a, b) { return a - b; }).join(", ") + "</strong> (1–25, left to right, top to bottom)"); });
        } else if (game === "keno") {
          floats(sv, cl, n, 10).then(function (fs) { show("Drawn numbers: <strong>" + kenoFrom(fs).sort(function (a, b) { return a - b; }).join(", ") + "</strong>"); });
        } else if (game === "wheel") {
          var wp = extra.split(/\s+/), segs = +wp[0] || 30, wr = (wp[1] || "medium").toLowerCase();
          if ([10, 20, 30, 40, 50].indexOf(segs) < 0 || ["low", "medium", "high"].indexOf(wr) < 0) { vout.innerHTML = errorBox("Use 10–50 segments and low, medium or high."); return; }
          floats(sv, cl, n, 1).then(function (fs) { var sg = Math.floor(fs[0] * segs); show("Segment " + (sg + 1) + " of " + segs + " → <strong>" + wheelTable(segs, wr)[sg].toFixed(2) + "×</strong>"); });
        } else if (game === "tower") {
          var tl = extra.toLowerCase(); if (!TOWER[tl]) { vout.innerHTML = errorBox("Use easy, medium, hard, expert or master."); return; }
          floats(sv, cl, n, 27).then(function (fs) { show("Egg tiles per floor (bottom to top, 1 = left): <strong>" + towerFrom(fs, tl).map(function (r) { return r.map(function (x) { return x + 1; }).sort().join("+"); }).join(" · ") + "</strong>"); });
        } else if (game === "chicken") {
          var cd = extra.toLowerCase(); if (!CHICKEN[cd]) { vout.innerHTML = errorBox("Use easy, medium, hard or expert."); return; }
          floats(sv, cl, n, 19).then(function (fs) { show("Cars in lanes: <strong>" + chickenFrom(fs, cd).map(function (x) { return x + 1; }).sort(function (a, b) { return a - b; }).join(", ") + "</strong> (1–20)"); });
        } else if (game === "coinflip") {
          var nf = Math.max(1, Math.min(10, parseInt(extra, 10) || 1));
          floats(sv, cl, n, nf).then(function (fs) { show("Flips: <strong>" + coinFrom(fs).join(", ") + "</strong>"); });
        } else if (game === "rps") {
          var nt = Math.max(1, Math.min(40, parseInt(extra, 10) || 5));
          floats(sv, cl, n, nt).then(function (fs) { show("House hands: <strong>" + fs.map(rpsFrom).join(", ") + "</strong>"); });
        } else if (game === "baccarat") {
          floats(sv, cl, n, 6).then(function (fs) { var g = baccaratFrom(fs), f = function (cs) { return cs.map(function (c) { return RANKS[c.rank] + SUITS[c.suit]; }).join(" "); }; show("Player: <strong>" + f(g.player) + " (" + g.p + ")</strong> · Banker: <strong>" + f(g.banker) + " (" + g.b + ")</strong> → <strong>" + g.winner + "</strong>"); });
        } else if (game === "double") {
          floats(sv, cl, n, 1).then(function (fs) { var dn = dblFrom(fs[0]); show("Tile: <strong>" + (dn === 0 ? "RD (white)" : dn + " (" + dblColor(dn) + ")") + "</strong>"); });
        } else if (game === "spill") {
          var sd = extra.toLowerCase(); if (!SPILL_BAD[sd]) { vout.innerHTML = errorBox("Use low, medium, high or degen."); return; }
          floats(sv, cl, n, 24).then(function (fs) { show("The cup spills on pour: <strong>" + minesFrom(fs, SPILL_BAD[sd]).map(function (x) { return x + 1; }).sort(function (a, b) { return a - b; }).join(", ") + "</strong> (1–25)"); });
        } else if (game === "soccer") {
          var scd = extra.toLowerCase(); if (!SOCCER[scd]) { vout.innerHTML = errorBox("Use easy, medium, hard or expert."); return; }
          floats(sv, cl, n, 4 * SOCCER[scd].kicks).then(function (fs) { var out = []; for (var k = 0; k < SOCCER[scd].kicks; k++) out.push(soccerFrom(fs, k, SOCCER[scd].block).map(function (x) { return x + 1; }).sort().join("+")); show("Corners the keeper covers, kick by kick (1–5): <strong>" + out.join(" · ") + "</strong>"); });
        } else if (game === "door") {
          var ddf = extra.toLowerCase(); if (!DOOR[ddf]) { vout.innerHTML = errorBox("Use easy, medium, hard or expert."); return; }
          floats(sv, cl, n, 30).then(function (fs) { var out = []; for (var l = 0; l < 10; l++) out.push(doorFrom(fs, l, DOOR[ddf]).map(function (x) { return x + 1; }).sort().join("+")); show("Trap doors per floor, bottom to top (1 = left): <strong>" + out.join(" · ") + "</strong>"); });
        } else if (game === "roulette") {
          floats(sv, cl, n, 1).then(function (fs) { show("Number: <strong>" + Math.floor(fs[0] * 37) + "</strong>"); });
        } else {
          var cnt = Math.max(1, Math.min(52, parseInt(extra, 10) || 8));
          floats(sv, cl, n, cnt).then(function (fs) { show("Cards: <strong>" + fs.map(function (f) { var c = cardFrom(f); return RANKS[c.rank] + SUITS[c.suit]; }).join(" ") + "</strong>"); });
        }
        return;
      }
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  function busyForm(f, on) { var b = f.querySelector("button[type=submit]"); if (b) { b.disabled = on; b.classList.toggle("loading", on); } }
  $("#form-login").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; busyForm(f, true);
    Promise.resolve(db.login(f.user.value.trim(), f.pass.value)).then(function (r) {
      busyForm(f, false);
      if (r.error) { $("#login-error").innerHTML = errorBox(r.error); return; }
      $("#login-error").innerHTML = ""; f.reset(); closeAll(); renderHeader(); renderSidebar(); RD.toast("Welcome back, " + r.player.username); route(true);
    });
  });
  $("#form-register").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; busyForm(f, true);
    Promise.resolve(db.register({ email: f.email.value, username: f.username.value, pass: f.pass.value, country: f.country.value, ref: f.ref.value, invite: f.invite ? f.invite.value : "" })).then(function (r) {
      busyForm(f, false);
      if (r.error) { $("#reg-error").innerHTML = errorBox(r.error); return; }
      $("#reg-error").innerHTML = ""; f.reset(); try { localStorage.removeItem("rd_ref"); } catch (x) {}
      closeAll(); renderHeader(); renderSidebar(); RD.toast("Welcome, " + r.player.username + "! Make a deposit to start playing."); route(true);
    });
  });
  $("#chat-form").addEventListener("submit", function (e) {
    e.preventDefault(); var inp = this.querySelector("input");
    if (!inp.value.trim()) return; if (needLogin()) return;
    var txt = inp.value; inp.value = "";
    Promise.resolve(db.chatSend(me().id, txt)).then(function (r) { if (r && r.error) { RD.toast(r.error, "error"); inp.value = txt; } renderChat(); });
  });
  /* Chuva (modo real): entrar e colocar dinheiro no pote */
  $("#rain-box").addEventListener("click", function (e) {
    var b = e.target.closest("[data-rain]"); if (!b) return;
    if (needLogin()) return;
    if (b.getAttribute("data-rain") === "join") {
      b.disabled = true;
      return db.rainJoin().then(function (r) { RD.toast(r.error || "You joined the rain!", r.error ? "error" : ""); renderRain(); });
    }
    openGeneric('<div class="modal-head"><h3>Add to the rain</h3><button class="icon-btn" data-close aria-label="Close">' + ic("x") + '</button></div><div class="modal-body"><p class="muted" style="margin-bottom:14px">The amount comes out of your balance and is split between everyone in the rain.</p><div id="rc-msg"></div><div class="field"><label>Amount (USD)</label><input class="input" type="number" id="rc-amt" min="1" step="1" value="5"></div><button class="btn btn-primary btn-block btn-lg" id="rc-go">Add to rain</button></div>');
    $("#rc-go").addEventListener("click", function () {
      var v = parseFloat($("#rc-amt").value); if (!(v >= 1)) { $("#rc-msg").innerHTML = errorBox("Minimum is $1."); return; }
      this.disabled = true;
      db.rainContribute(v).then(function (r) { if (r.error) { $("#rc-msg").innerHTML = errorBox(r.error); $("#rc-go").disabled = false; return; } closeAll(); renderHeader(); RD.toast("Added " + fmt.usd(v) + " to the rain"); });
    });
  });
  if (db.onChat) db.onChat(function () { if ($("#drawer-chat").classList.contains("open")) renderChat(); else renderRain(); });

  /* Link de afiliado: ?ref=CODE conta o clique e preenche o cadastro */
  (function () {
    var m = location.search.match(/[?&]ref=([A-Za-z0-9]+)/);
    if (m) {
      var code = m[1].toUpperCase(), seen;
      try { seen = sessionStorage.getItem("rd_clicked_" + code); sessionStorage.setItem("rd_clicked_" + code, "1"); localStorage.setItem("rd_ref", code); } catch (x) {}
      if (!seen) db.trackClick(code);
    }
    try { var ref = localStorage.getItem("rd_ref"); if (ref) $("#reg-ref").value = ref; } catch (x) {}
  })();

  /* ---------- Acesso secreto ao admin ----------
     Digite "rdadmin" (fora de campos de texto) ou toque 5x rápido no logo.
     É só um atalho: a proteção é o login do admin. */
  (function () {
    var buf = "", taps = 0, tapTimer;
    function go() { window.open("admin/index.html", "rdadmin"); }
    document.addEventListener("keydown", function (e) {
      if (/input|textarea|select/i.test(e.target.tagName) || !e.key || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-7);
      if (buf === "rdadmin") { buf = ""; go(); }
    });
    $$(".brand").forEach(function (b) {
      b.addEventListener("click", function () { taps++; clearTimeout(tapTimer); tapTimer = setTimeout(function () { taps = 0; }, 1200); if (taps >= 5) { taps = 0; go(); } });
    });
  })();

  /* ---------- Atualizações vindas de outra aba (admin ou outro jogador) ---------- */
  var lastMine = null;
  function snap() { var u = me(); if (!u) return null; var m = { bal: u.balance, kyc: u.kyc, st: u.status }; db.txOf(u.id).forEach(function (t) { m[t.id] = t.status; }); return m; }
  lastMine = snap();
  var lastUid = me() ? me().id : null;
  db.onChange(function () {
    var before = lastMine, after = snap(), u = me(); lastMine = after;
    renderHeader(); renderSidebar(); renderFooter(); markActive(currentPath);
    if (u && before && after) {
      var told = false;
      db.txOf(u.id).forEach(function (t) {
        if (before[t.id] === "Pending" && t.status === "Completed") { told = true; RD.toast("Your withdrawal of " + fmt.usd(t.amount) + " was sent"); }
        if (before[t.id] === "Pending" && t.status === "Rejected") { told = true; RD.toast("Withdrawal of " + fmt.usd(t.amount) + " was rejected and refunded", "error"); }
        if (!before[t.id] && t.type === "Bonus") { told = true; RD.toast("You received a bonus of " + fmt.usd(t.amount)); }
      });
      if (before.kyc !== after.kyc && after.kyc === "Verified") { told = true; RD.toast("Your identity is verified"); }
      if (before.kyc !== after.kyc && after.kyc === "Rejected") { told = true; RD.toast("Verification rejected — please resubmit", "error"); }
      db.txOf(u.id).forEach(function (t) { if (!before[t.id] && t.type === "Deposit" && t.status === "Completed") RD.toast("Deposit credited: " + fmt.usd(t.amount)); });
    }
    if ($(".overlay.open")) return;
    /* Login terminou de carregar (ou trocou de conta) com um jogo aberto: monta o jogo de novo para retomar a rodada */
    var uid = u ? u.id : null; if (uid !== lastUid) { lastUid = uid; if (/^game\//.test(currentPath)) return route(true); }
    if (/^game\//.test(currentPath)) { if (ogTabRefresh) ogTabRefresh(); return; } // não reinicia o jogo no meio da aposta
    if (currentPath === "" || currentPath === "home") { renderTicker(); renderFeed(); return; }
    route(true);
  });

  /* Idioma: menu próprio (por enquanto só inglês; os outros entram com a tradução) */
  var LANGS = [["en", "English"], ["es", "Español"], ["pt", "Português"], ["de", "Deutsch"], ["fr", "Français"], ["tr", "Türkçe"], ["ja", "日本語"]];
  function renderLang() {
    $("#lang-menu").innerHTML = LANGS.map(function (l) { return '<button data-lang="' + l[0] + '"' + (l[0] === "en" ? ' class="active"' : "") + "><span>" + l[1] + "</span>" + (l[0] === "en" ? ic("check", 15) : '<small>Soon</small>') + "</button>"; }).join("");
  }
  renderLang();
  $("#lang-btn").addEventListener("click", function (e) { e.stopPropagation(); $("#lang-menu").classList.toggle("hidden"); });
  $("#lang-menu").addEventListener("click", function (e) {
    var b = e.target.closest("[data-lang]"); if (!b) return;
    $("#lang-menu").classList.add("hidden");
    if (b.getAttribute("data-lang") !== "en") RD.toast(b.textContent.replace("Soon", "") + " is coming soon");
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".sb-lang-wrap")) $("#lang-menu").classList.add("hidden"); });

  /* Menu lateral: no computador encolhe para só ícones (lembra a escolha); no celular fecha a gaveta */
  try { if (localStorage.getItem("rd_sb_mini") === "1") document.body.classList.add("sb-mini"); } catch (x) {}
  $("#sb-toggle").addEventListener("click", function () {
    if (window.innerWidth <= 960) return document.body.classList.remove("sb-open");
    var on = document.body.classList.toggle("sb-mini");
    try { localStorage.setItem("rd_sb_mini", on ? "1" : "0"); } catch (x) {}
  });

  /* ---------- Boot ---------- */
  if (RD.live) {
    $("#login-user-label").textContent = "Email";
    // Cadastro aberto. O campo de código só aparece com link de convite (ex.: criar a conta de admin)
    var inv = location.search.match(/[?&]invite=([A-Za-z0-9]+)/);
    if (inv) { $("#reg-invite-wrap").classList.remove("hidden"); $("#reg-invite").value = inv[1].toUpperCase(); }
  }
  hydrateIcons(document);
  renderSidebar(); renderHeader(); renderFooter(); fillCountries();
  window.addEventListener("hashchange", function () { route(); });
  route();
  setInterval(countdown, 1000);
})();
