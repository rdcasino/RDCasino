/* ==========================================================================
   RDCasino — Site do jogador (SPA, rotas em hash: #/rota)
   Sem dados falsos: tudo que aparece vem de RD.db (store.js).
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ic = RD.ic, fmt = RD.fmt, esc = RD.esc, media = RD.media, db = RD.db;
  var MAX_PROFIT = 10000; // lucro máximo por aposta (proteção do caixa)

  var state = { walletTab: "deposit", coin: "USDT", net: "TRC20", betsTab: "all" };
  function me() { return db.current(); }

  function hydrateIcons(root) { $$("[data-ic]", root).forEach(function (el) { el.outerHTML = ic(el.getAttribute("data-ic")); }); }
  function gameOf(id) { return RD.games.filter(function (g) { return g.id === id; })[0]; }
  function initials(u) { return String(u || "?").slice(0, 2).toUpperCase(); }
  function errorBox(msg, extra) { return '<div class="notice form-error" style="background:var(--danger-soft);border-color:rgba(255,122,89,.3);color:var(--danger)">' + ic("alert", 16) + "<span>" + esc(msg) + (extra || "") + "</span></div>"; }
  function empty(title, text, cta) { return '<div class="empty"><h3>' + title + "</h3><p>" + text + "</p>" + (cta ? '<div style="margin-top:16px">' + cta + "</div>" : "") + "</div>"; }

  /* ---------- Sidebar ---------- */
  var NAV = [
    [{ route: "", label: "Lobby", icon: "home" }, { route: "casino/originals", label: "RD Originals", icon: "star" }, { route: "casino/slots", label: "Slots", icon: "cherry" }, { route: "casino/live", label: "Live Casino", icon: "play" }, { route: "casino/gameshows", label: "Game Shows", icon: "tv" }],
    [{ route: "promotions", label: "Promotions", icon: "gift" }, { route: "vip", label: "VIP Club", icon: "crown" }, { route: "leaderboard", label: "Leaderboard", icon: "trophy" }],
    [{ route: "affiliate", label: "Affiliate", icon: "link", badge: "50%" }, { route: "fairness", label: "Provably Fair", icon: "shield" }, { route: "responsible", label: "Responsible Gaming", icon: "help" }]
  ];
  function renderSidebar() {
    var h = '<a class="sb-promo" href="#/leaderboard"><span class="eyebrow">Monthly leaderboard</span><strong>' + fmt.usd(RD.config.leaderboardPrize, { dec: 0 }) + '</strong><small>Ends in <span data-countdown-short></span></small></a>';
    NAV.forEach(function (box) {
      h += '<div class="sb-box">' + box.map(function (n) {
        return '<a class="sb-link" href="#/' + n.route + '" data-route="' + n.route + '">' + ic(n.icon) + "<span>" + n.label + "</span>" + (n.badge ? '<span class="badge badge-brand">' + n.badge + "</span>" : "") + "</a>";
      }).join("") + "</div>";
    });
    $("#sb-nav").innerHTML = h;
  }
  function markActive(path) {
    var parts = path.split("/"), base = parts[0] === "casino" ? parts.slice(0, 2).join("/") : parts[0];
    if (parts[0] === "game") { var g = gameOf(parts[1]); base = g ? "casino/" + g.cat : ""; }
    $$(".sb-link").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-route") === base); });
    $$(".sb-switch a").forEach(function (a) { a.classList.toggle("active", (a.getAttribute("data-switch") === "sports") === (base === "sports")); });
    $$(".bottom-nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#/" + path); });
  }

  /* ---------- Header ---------- */
  function renderHeader() {
    var u = me();
    $("#hdr-guest").classList.toggle("hidden", !!u);
    $("#hdr-user").classList.toggle("hidden", !u);
    $("#hdr-wallet").classList.toggle("hidden", !u);
    if (!u) return;
    $("#hdr-bal").textContent = fmt.usd(u.balance);
    var t = db.tierOf(u.wagered);
    $("#user-menu").innerHTML =
      '<div class="menu-head"><strong>' + esc(u.username) + '</strong><small class="faint">' + (t ? t.name : "Unranked") + " · VIP</small></div>" +
      '<button data-open="wallet">' + ic("wallet", 16) + "Wallet</button>" +
      '<a href="#/account">' + ic("user", 16) + "Account & verification</a>" +
      '<a href="#/account/bets">' + ic("chart", 16) + "My bets</a>" +
      '<a href="#/vip">' + ic("crown", 16) + "VIP Club</a>" +
      '<a href="#/affiliate">' + ic("link", 16) + "Affiliate</a>" +
      '<a href="#/fairness">' + ic("shield", 16) + "Provably fair</a>" +
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
  function renderWallet() {
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
        '<div class="field"><label>Test mode: simulate a confirmed deposit</label><div class="input-group"><input type="number" min="1" step="0.01" placeholder="Amount in USD" id="dep-amt"><button class="btn btn-primary btn-sm" data-action="sim-deposit">Deposit</button></div><span class="hint">Credits your balance instantly, as the processor would after the blockchain confirms.</span></div><div id="dep-msg"></div>';
    } else if (state.walletTab === "withdraw") {
      h = coins + nets + '<div id="wd-msg"></div>' +
        '<div class="field"><label>Destination address</label><input class="input" id="wd-addr" placeholder="Paste your ' + c.sym + ' address"></div>' +
        '<div class="field"><label>Amount (USD)</label><div class="input-group"><input type="number" min="0" step="0.01" placeholder="0.00" id="wd-amt"><button class="btn btn-ghost btn-sm" data-action="wd-max">Max</button></div><span class="hint">Available: ' + fmt.usd(u.balance) + "</span></div>" +
        '<button class="btn btn-primary btn-block btn-lg" data-action="withdraw">Request withdrawal</button>' +
        '<div class="wallet-foot">' + ic("lock", 14) + "Reviewed by our team. Above " + fmt.usd(RD.config.kycWithdrawLimit, { dec: 0 }) + " requires identity verification.</div>";
    } else {
      h = '<div id="tip-msg"></div><div class="field"><label>Recipient username</label><input class="input" id="tip-to" placeholder="username"></div>' +
        '<div class="field"><label>Amount (USD)</label><input class="input" type="number" min="0.01" step="0.01" id="tip-amt" placeholder="0.00"><span class="hint">Available: ' + fmt.usd(u.balance) + "</span></div>" +
        '<button class="btn btn-primary btn-block btn-lg" data-action="tip">Send tip</button>';
    }
    $("#wallet-body").innerHTML = h;
  }

  /* ---------- Fragments ---------- */
  function gameCard(g) {
    var tag = g.tag === "hot" ? '<span class="badge badge-danger g-tag">Hot</span>' : g.tag === "new" ? '<span class="badge badge-brand g-tag">New</span>' : "";
    return '<a class="game" href="#/game/' + g.id + '">' + tag +
      media(g, "", '<span class="gf-name">' + esc(g.name) + '</span><span class="gf-prov">' + esc(g.provider) + "</span>") +
      '<div class="game-meta">' + (g.playable ? '<span class="dot"></span>Play now' : esc(g.provider)) + "</div></a>";
  }
  function gamesOf(cat) { return RD.games.filter(function (g) { return g.enabled && (cat === "all" || g.cat === cat); }); }
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
  var ogKeys = null;
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
  function outcome(game, f) { return game === "dice" ? Math.floor(f * 10001) / 100 : Math.max(1, Math.floor((0.99 / Math.max(f, 1e-8)) * 100) / 100); }
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

  /* ---------- Tabelas e fórmulas ---------- */
  /* Tabelas iguais às da Stake (8 a 16 linhas, RTP ≈ 99%) */
  var PLINKO = {
    8: { low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6], medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13], high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29] },
    9: { low: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6], medium: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18], high: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43] },
    10: { low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9], medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22], high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76] },
    11: { low: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4], medium: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24], high: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120] },
    12: { low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10], medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33], high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
    13: { low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1], medium: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43], high: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260] },
    14: { low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1], medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58], high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420] },
    15: { low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15], medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88], high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620] },
    16: { low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16], medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110], high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000] }
  };

  RD.fair.plinko = PLINKO;
  function minesMult(k, m) { var x = 0.99; for (var i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return Math.floor(x * 100) / 100; }
  var RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], SUITS = ["♠", "♥", "♦", "♣"];
  function hiloOpts(r) {
    if (r === 1) return { up: { label: "Higher", p: 12 / 13, ok: function (x) { return x > 1; } }, down: { label: "Same", p: 1 / 13, ok: function (x) { return x === 1; } } };
    if (r === 13) return { up: { label: "Same", p: 1 / 13, ok: function (x) { return x === 13; } }, down: { label: "Lower", p: 12 / 13, ok: function (x) { return x < 13; } } };
    return { up: { label: "Higher or same", p: (14 - r) / 13, ok: function (x) { return x >= r; } }, down: { label: "Lower or same", p: r / 13, ok: function (x) { return x <= r; } } };
  }
  function capMult(amount, mult) { return amount * (mult - 1) > MAX_PROFIT ? Math.floor(((amount + MAX_PROFIT) / amount) * 100) / 100 : mult; }

  /* ---------- Moldura ---------- */
  function profitField(label) { return '<div><div class="ogx-label">' + (label || "Profit on win") + '<small id="og-mult-lbl"></small></div><div class="ogx-input ro"><span class="cur">$</span><input id="og-profit" readonly value="0.00"></div></div>'; }
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
      '<div><div class="ogx-label">' + (cfg.amountLabel || "Bet amount") + '<small id="og-bal"></small></div><div class="ogx-input"><span class="cur">$</span><input type="number" id="og-amt" min="0" step="0.01" value="1.00" inputmode="decimal"><button class="mini" data-og="half">½</button><button class="mini" data-og="double">2×</button></div></div>' +
      (cfg.side || "") +
      (cfg.auto ? '<div id="og-auto" class="hidden" style="display:flex;flex-direction:column;gap:14px">' +
        '<div><div class="ogx-label">Number of bets<small>0 = infinite</small></div><div class="ogx-input"><input type="number" id="au-n" min="0" step="1" value="10"><span class="sfx">∞</span></div></div>' +
        autoRule("win", "On win") + autoRule("loss", "On loss") +
        '<div><div class="ogx-label">Stop on profit</div><div class="ogx-input"><span class="cur">$</span><input type="number" id="au-sp" min="0" step="0.01" value="0"></div></div>' +
        '<div><div class="ogx-label">Stop on loss</div><div class="ogx-input"><span class="cur">$</span><input type="number" id="au-sl" min="0" step="0.01" value="0"></div></div></div>' : "") +
      '<button class="btn btn-primary btn-block ogx-bet" id="og-bet">' + (u ? "Bet" : "Sign in to play") + "</button>" + (cfg.after || "") +
      '<div class="ogx-msg" id="og-msg"></div></aside>';
    var stage = '<section class="ogx-stage"><div class="ogx-hist" id="og-hist"></div><div class="ogx-stats' + (ogPrefs.stats ? "" : " hidden") + '" id="og-stats"></div><div class="ogx-center">' + cfg.center + "</div>" + (cfg.fields || "") + "</section>";
    var bar = '<div class="ogx-bar">' +
      '<button class="icon-btn' + (ogPrefs.theatre ? " active" : "") + '" data-ogx="theatre" title="Theatre mode">' + ic("maximize", 18) + "</button>" +
      '<button class="icon-btn' + (ogPrefs.stats ? " active" : "") + '" data-ogx="stats" title="Live stats">' + ic("bars", 18) + "</button>" +
      '<button class="icon-btn' + (ogPrefs.hotkeys ? " active" : "") + '" data-ogx="hotkeys" title="Hotkeys">' + ic("keyboard", 18) + "</button>" +
      '<button class="icon-btn' + (fav ? " fav" : "") + '" data-ogx="fav" title="Favorite">' + ic("star", 18) + "</button>" +
      '<div class="ogx-brand">RDCASINO</div><button class="ogx-fair" data-action="seeds">' + ic("shield", 15) + "Provably fair</button></div>";
    return '<div class="container' + (ogPrefs.theatre ? " wide" : "") + '">' +
      '<div class="row" style="margin-bottom:14px;gap:8px"><a class="icon-btn" href="#/casino/originals" aria-label="Back">' + ic("chevronLeft") + '</a><h2 style="font-size:18px">' + esc(g.name) + '</h2><span class="badge">RD Originals</span></div>' +
      '<div class="ogx' + (ogPrefs.theatre ? " theatre" : "") + '" id="ogx"><div class="ogx-main">' + side + stage + "</div>" + bar + "</div>" +
      '<div class="card og-info"><div class="card-head"><div class="pill-tabs" id="og-tabs"><button class="active" data-ogtab="about">Description</button><button data-ogtab="big">Big wins</button><button data-ogtab="lucky">Lucky wins</button><button data-ogtab="mine">My bets</button></div></div><div id="og-tab-body"></div></div></div>';
  }

  function statsHtml(gid) {
    var s = sess(gid), pts = s.series, n = pts.length;
    var min = Math.min.apply(null, pts.concat([0])), max = Math.max.apply(null, pts.concat([0])), span = (max - min) || 1;
    var y = function (v) { return 38 - ((v - min) / span) * 36; }, x = function (i) { return n < 2 ? 0 : (i / (n - 1)) * 100; };
    var line = pts.map(function (v, i) { return x(i).toFixed(2) + "," + y(v).toFixed(2); }).join(" ");
    var color = s.profit >= 0 ? "var(--success)" : "var(--danger)";
    return '<div class="row between"><h4>Live stats</h4><div class="row" style="gap:4px"><button class="btn btn-ghost btn-sm" data-ogx="reset-stats">Reset</button><button class="icon-btn" style="width:28px;height:28px" data-ogx="stats">' + ic("x", 14) + "</button></div></div>" +
      '<dl><div><dt>Profit</dt><dd class="' + (s.profit >= 0 ? "pos" : "neg") + '">' + fmt.usd(s.profit, { sign: true }) + "</dd></div><div><dt>Wagered</dt><dd>" + fmt.usd(s.wagered) + '</dd></div><div><dt>Wins</dt><dd class="pos">' + s.wins + '</dd></div><div><dt>Losses</dt><dd class="neg">' + s.losses + "</dd></div></dl>" +
      '<div class="ogx-chart"><svg viewBox="0 0 100 40" preserveAspectRatio="none"><line x1="0" x2="100" y1="' + y(0) + '" y2="' + y(0) + '" stroke="rgba(255,255,255,.15)" stroke-width="0.4" stroke-dasharray="1.5 1.5"/>' +
      (n > 1 ? '<polygon points="0,' + y(0) + " " + line + " 100," + y(0) + '" fill="' + color + '" fill-opacity="0.15"/><polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' : "") + "</svg></div>";
  }

  var ABOUT = {
    dice: "<p><strong>Dice</strong> is the classic crypto casino game. Set your win chance anywhere from 0.01% to 98% and roll over or under the target. The lower your win chance, the higher the multiplier — up to 9,900×.</p><p>Every roll lands between 0.00 and 100.00.</p>",
    limbo: "<p><strong>Limbo</strong>: set a target multiplier and bet. If the result reaches your target, you win your bet times the target. Targets go from 1.01× to 1,000,000×.</p>",
    plinko: "<p><strong>Plinko</strong>: drop the ball and watch it bounce down the pegs. Where it lands sets your multiplier. Choose 8 to 16 rows and low, medium or high risk — 16 rows on high risk pays up to 1,000× on the edges.</p>",
    crash: "<p><strong>Crash</strong>: the multiplier starts at 1.00× and climbs until it crashes. Cash out before the crash to win your bet times the multiplier. Set an automatic cashout to lock in a target.</p>",
    mines: "<p><strong>Mines</strong>: a 5×5 grid hides gems and mines. Choose how many mines (1–24), then reveal tiles. Every gem raises your multiplier — cash out any time, but hit a mine and the round is lost.</p>",
    wheel: "<p><strong>Wheel</strong>: spin the wheel and win the multiplier it stops on. Choose 10 to 50 segments and low, medium or high risk — high risk has a single big segment worth up to 49.5×.</p>",
    keno: "<p><strong>Keno</strong>: pick 1 to 10 numbers from 40. We draw 10. The more of your numbers are drawn, the bigger the multiplier — up to 1,000×. Choose Classic, Low, Medium or High risk; the payout table updates as you pick.</p>",
    blackjack: "<p><strong>Blackjack</strong>: get closer to 21 than the dealer without going over. Blackjack pays 3 to 2, the dealer stands on all 17s, you can double, or split a pair once, and when the dealer shows an Ace you can take insurance (half your bet, pays 2 to 1 if the dealer has Blackjack). Cards are dealt from an infinite deck. RTP shown assumes basic strategy (approximate).</p>",
    roulette: "<p><strong>Roulette</strong>: European wheel with a single zero. Place chips on numbers or outside bets — a number pays 35 to 1, dozens and columns 2 to 1, and red/black, even/odd and 1–18/19–36 pay 1 to 1.</p>",
    tower: "<p><strong>Tower</strong>: climb 9 floors. On every floor pick a tile — find the egg and you go up, hit the skull and the round ends. Cash out whenever you want. Five difficulties, from Easy (3 eggs in 4 tiles) to Master (1 egg in 4 tiles, up to 256,901×).</p>",
    chicken: "<p><strong>Chicken</strong>: help the chicken cross the road, one lane at a time. Every lane you cross raises your multiplier, but some lanes hide a car. Cash out before you get hit. Easy hides 1 car in 20 lanes, Expert hides 10.</p>",
    hilo: "<p><strong>Hi-Lo</strong>: guess whether the next card is higher or lower than the current one. Each correct guess multiplies your win. Skip cards you don't like and cash out whenever you want. Aces are low, kings are high.</p>"
  };
  function ogTab(g, tab) {
    var box = $("#og-tab-body"); if (!box) return;
    $$("#og-tabs [data-ogtab]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-ogtab") === tab); });
    var u = me(), mod = OG[g.id], mine = function (b) { return b.game === g.id; };
    if (tab === "about") {
      box.innerHTML = '<div class="og-info-body">' + ABOUT[g.id] + "<p>Every result is generated from your seeds and can be verified on the Provably Fair page.</p>" +
        '<div class="og-facts"><div><small>House edge</small><strong>' + (Math.round((100 - g.rtp) * 10) / 10) + '%</strong></div><div><small>RTP</small><strong>' + (g.id === "blackjack" ? "≈" : "") + g.rtp + '%</strong></div><div><small>Min bet</small><strong>$0.01</strong></div><div><small>Max profit</small><strong>' + fmt.usd(MAX_PROFIT, { dec: 0 }) + "</strong></div></div>" +
        '<p class="faint" style="font-size:12.5px;margin-top:14px">Hotkeys (turn on in the bottom bar): <span class="kbd">Space</span> bet · <span class="kbd">S</span> half · <span class="kbd">D</span> double</p></div>';
      return;
    }
    if (tab === "mine" && !u) { box.innerHTML = empty("Sign in to see your bets", "", '<button class="btn btn-primary btn-sm" data-open="register">Register</button>'); return; }
    var all = db.recentBets(2000).filter(mine), list;
    if (tab === "mine") list = all.filter(function (b) { return b.userId === u.id; }).slice(0, 15);
    if (tab === "big") list = all.filter(function (b) { return b.payout > b.amount; }).sort(function (a, b) { return (b.payout - b.amount) - (a.payout - a.amount); }).slice(0, 10);
    if (tab === "lucky") list = all.filter(function (b) { return b.payout > 0; }).sort(function (a, b) { return b.multiplier - a.multiplier; }).slice(0, 10);
    box.innerHTML = list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Player</th><th>Time</th><th class="right">Bet</th><th class="right">Result</th><th class="right">Multiplier</th><th class="right">Profit</th></tr></thead><tbody>' +
      list.map(function (b) {
        return '<tr><td class="strong">' + esc(b.user) + '</td><td class="faint">' + b.date.slice(11, 16) + '</td><td class="right num">' + fmt.usd(b.amount) + '</td><td class="right num">' + mod.label(b) + '</td><td class="right num">' + b.multiplier.toFixed(2) + '×</td><td class="right num strong ' + (b.payout > b.amount ? "pos" : "faint") + '">' + fmt.usd(b.payout - b.amount, { sign: true }) + "</td></tr>";
      }).join("") + "</tbody></table></div>" : empty("Nothing here yet", tab === "mine" ? "Your bets on " + g.name + " show up here." : "Wins on " + g.name + " show up here.");
  }

  function bindOriginal(g) {
    var mod = OG[g.id], amt = $("#og-amt"), mode = "manual", auto = false, busy = false, tab = "about", rules = { win: "reset", loss: "reset" };
    var ctx = {
      g: g,
      amount: function () { return Math.max(0, Math.round((parseFloat(amt.value) || 0) * 100) / 100); },
      setAmt: function (v) { amt.value = Math.max(0, v).toFixed(2); ctx.refresh(); },
      msg: function (t, extra) { if (!$("#og-msg")) return; $("#og-msg").innerHTML = t ? errorBox(t, extra) : ""; },
      btn: function () { return $("#og-bet"); },
      refresh: function () { var u = me(); if (!$("#og-bal")) return; $("#og-bal").textContent = u ? "Balance " + fmt.usd(u.balance) : ""; if (api.refresh) api.refresh(); },
      setProfit: function (mult, label) { var p = $("#og-profit"); if (!p) return; p.value = (ctx.amount() * (mult - 1)).toFixed(2); $("#og-mult-lbl").textContent = (label || mult.toFixed(2)) + "×"; },
      validate: function (a, maxMult) {
        var u = me(); ctx.msg("");
        if (!u) { openAuth("register"); return null; }
        if (u.status !== "Active") { ctx.msg("Your account is suspended."); return null; }
        if (a < 0.01) { ctx.msg("Minimum bet is $0.01."); return null; }
        if (a > u.balance) { ctx.msg("Insufficient balance.", ' <a href="#" class="link-sm" data-open="wallet">Deposit</a>'); return null; }
        if (maxMult && a * (maxMult - 1) > MAX_PROFIT) { ctx.msg("Max profit per bet is " + fmt.usd(MAX_PROFIT, { dec: 0 }) + "."); return null; }
        return u;
      },
      lock: function (on) {
        if (!document.contains(amt)) return;
        amt.disabled = on; $$("[data-og]").forEach(function (b) { b.disabled = on; });
        $$(".ogx-side select").forEach(function (s) { s.disabled = on; });
        $$("[data-mode]").forEach(function (b) { b.disabled = on; });
      },
      record: function (b) {
        if (!b || b.error) return;
        var st = sess(g.id), delta = b.payout - b.amount;
        st.profit = Math.round((st.profit + delta) * 100) / 100; st.wagered += b.amount; st[b.payout > b.amount ? "wins" : "losses"]++; st.series.push(st.profit); if (st.series.length > 200) st.series.shift();
        renderHeader(); ctx.refresh(); history(); stats(); if (tab !== "about") ogTab(g, tab);
      }
    };
    var api = mod.bind(ctx);
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
      var sp = parseFloat($("#au-sp").value) || 0, sl = parseFloat($("#au-sl").value) || 0, btn = ctx.btn();
      auto = true; btn.textContent = "Stop autobet"; btn.classList.add("stop"); ctx.lock(true);
      (function loop() {
        if (!auto || !document.contains(btn)) return stopAuto();
        api.play().then(function (r) {
          if (!r) return stopAuto();
          count++;
          var rule = rules[r.win ? "win" : "loss"], pct = parseFloat($("#au-" + (r.win ? "win" : "loss")).value) || 0;
          amt.value = (rule === "reset" ? base : ctx.amount() * (1 + pct / 100)).toFixed(2); ctx.refresh();
          var run = sess(g.id).profit - start;
          if ((total && count >= total) || (sp && run >= sp) || (sl && -run >= sl)) return stopAuto();
          setTimeout(loop, 300);
        });
      })();
    }
    function stopAuto() { auto = false; ctx.lock(false); var btn = ctx.btn(); if (btn) { btn.textContent = mode === "auto" ? "Start autobet" : "Bet"; btn.classList.remove("stop"); } }

    amt.addEventListener("input", ctx.refresh);
    $$("[data-og]").forEach(function (b) { b.addEventListener("click", function () { ctx.setAmt(b.getAttribute("data-og") === "half" ? ctx.amount() / 2 : ctx.amount() * 2); }); });
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
    ogKeys = { bet: function () { if (mode === "manual") manual(); }, half: function () { if (!amt.disabled) ctx.setAmt(ctx.amount() / 2); }, double: function () { if (!amt.disabled) ctx.setAmt(ctx.amount() * 2); } };
    ctx.refresh(); history(); stats(); ogTab(g, "about");
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
      /* Como na Stake: chance de 0,01% a 98% (multiplicador de 1,0102× a 9.900×) */
      function clampT() { var t = parseFloat(dr.value), lo = over ? 2 : 0.01, hi = over ? 99.99 : 98; if (t < lo || t > hi) dr.value = Math.max(lo, Math.min(hi, t)).toFixed(2); }
      function params() { clampT(); var t = parseFloat(dr.value), c = Math.round((over ? 100 - t : t) * 100) / 100; return { target: t, chance: c, mult: Math.floor((99 / c) * 10000) / 10000 }; }
      function refresh() {
        var p = params(); ctx.setProfit(p.mult);
        $("#dx").style.setProperty("--t", p.target + "%"); $("#dx").classList.toggle("under", !over);
        $("#dx-mode-lbl").textContent = over ? "Roll over" : "Roll under"; $("#dx-target").textContent = p.target.toFixed(2);
        if (document.activeElement !== $("#dx-mult")) $("#dx-mult").value = p.mult.toFixed(4);
        if (document.activeElement !== $("#dx-chance")) $("#dx-chance").value = p.chance.toFixed(4);
      }
      dr.addEventListener("input", refresh);
      $("#dx-mode").addEventListener("click", function () { over = !over; dr.value = (100 - parseFloat(dr.value)).toFixed(2); refresh(); });
      $("#dx-mult").addEventListener("change", function () { var m = Math.max(1.0102, Math.min(9900, parseFloat(this.value) || 2)), c = Math.round((99 / m) * 100) / 100; dr.value = (over ? 100 - c : c).toFixed(2); this.blur(); refresh(); });
      $("#dx-chance").addEventListener("change", function () { var c = Math.max(0.01, Math.min(98, parseFloat(this.value) || 49.5)); dr.value = (over ? 100 - c : c).toFixed(2); this.blur(); refresh(); });
      return {
        refresh: refresh,
        play: function () {
          var a = ctx.amount(), p = params(), u = ctx.validate(a, p.mult); if (!u) return Promise.resolve(null);
          var s = db.reserve(u.id), nonce = s.nonce, client = s.client;
          return hmac(s.server, client + ":" + nonce).then(function (buf) {
            var res = outcome("dice", floatFrom(buf)), win = over ? res > p.target : res < p.target;
            var b = db.placeBet(u.id, "dice", a, p.mult, win, { result: res, target: p.target, mode: over ? "over" : "under", nonce: nonce, client: client }); if (b.error) { ctx.msg(b.error); return null; }
            var r = $("#dx-res"); if (r) { r.classList.remove("hidden", "w", "l", "pop"); void r.offsetWidth; r.textContent = res.toFixed(2); r.style.left = "calc(var(--pad) + (100% - 2 * var(--pad)) * " + (res / 100) + ")"; r.classList.add(win ? "w" : "l", "pop"); }
            ctx.record(b); return { win: win };
          });
        }
      };
    }
  };

  /* ---------- LIMBO ---------- */
  OG.limbo = {
    label: function (b) { return Number(b.detail.result).toFixed(2) + "×"; },
    cfg: function () {
      return {
        auto: true, side: '<div class="og-manual-only">' + profitField() + "</div>",
        center: '<div class="lb"><div class="lb-num" id="lb-num">1.00×</div><div class="lb-sub" id="lb-sub"></div></div>',
        fields: '<div class="ogx-fields two"><div><div class="ogx-label">Target multiplier</div><div class="ogx-input"><input id="lb-target" type="number" min="1.01" step="0.01" value="2.00" inputmode="decimal"><span class="sfx">×</span></div></div>' +
          '<div><div class="ogx-label">Win chance</div><div class="ogx-input"><input id="lb-chance" inputmode="decimal"><span class="sfx">%</span></div></div></div>'
      };
    },
    bind: function (ctx) {
      function target() { return Math.max(1.01, Math.min(1000000, parseFloat($("#lb-target").value) || 1.01)); }
      function refresh() {
        var m = target(), c = 99 / m; ctx.setProfit(m);
        if (document.activeElement !== $("#lb-chance")) $("#lb-chance").value = c.toFixed(4);
        $("#lb-sub").textContent = "Target " + m.toFixed(2) + "× · " + c.toFixed(2) + "% chance";
      }
      $("#lb-target").addEventListener("input", refresh);
      $("#lb-chance").addEventListener("change", function () { var c = Math.max(0.0001, Math.min(98.02, parseFloat(this.value) || 49.5)); $("#lb-target").value = (99 / c).toFixed(2); this.blur(); refresh(); });
      return {
        refresh: refresh, cooldown: 320,
        play: function () {
          var a = ctx.amount(), m = target(), u = ctx.validate(a, m); if (!u) return Promise.resolve(null);
          var s = db.reserve(u.id), nonce = s.nonce, client = s.client;
          return hmac(s.server, client + ":" + nonce).then(function (buf) {
            var res = outcome("limbo", floatFrom(buf)), win = res >= m;
            var b = db.placeBet(u.id, "limbo", a, m, win, { result: res, target: m, nonce: nonce, client: client }); if (b.error) { ctx.msg(b.error); return null; }
            var el = $("#lb-num"), t0 = performance.now();
            if (el) { el.classList.remove("w", "l"); (function step(t) { var k = Math.min(1, (t - t0) / 280); el.textContent = (1 + (res - 1) * k).toFixed(2) + "×"; if (k < 1) requestAnimationFrame(step); else el.classList.add(win ? "w" : "l"); })(t0); }
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
          ball.setAttribute("r", (G.dx * 0.2).toFixed(2)); ball.setAttribute("fill", "#ff4d6d"); svg.appendChild(ball);
          var pts = [[W / 2, G.top - G.dy * 0.9]], sum = 0;
          for (var i = 0; i < R; i++) { sum += path[i]; pts.push([W / 2 + (sum - (i + 1) / 2) * G.dx, G.top + i * G.dy + G.dy * 0.55]); }
          var per = 115, t0 = performance.now();
          (function step(t) {
            var e = (t - t0) / per, i = Math.min(Math.floor(e), pts.length - 2), k = Math.min(1, e - i);
            var a = pts[i], b = pts[i + 1], x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * (k * k) - Math.sin(k * Math.PI) * G.dy * 0.35;
            ball.setAttribute("cx", x.toFixed(2)); ball.setAttribute("cy", y.toFixed(2));
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
        var s = db.reserve(u.id), nonce = s.nonce, client = s.client;
        live++;
        return floats(s.server, client, nonce, R).then(function (fs) {
          var path = fs.map(function (f) { return Math.floor(f * 2); }), slot = path.reduce(function (x, y) { return x + y; }, 0), m = t[slot];
          var b = db.placeBet(u.id, "plinko", a, m, true, { result: m, rows: R, risk: rk, slot: slot, path: path.join(""), nonce: nonce, client: client });
          if (b.error) { live--; ctx.msg(b.error); return null; }
          renderHeader(); ctx.refresh();
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
        center: '<div class="cr" id="cr"><canvas id="cr-canvas"></canvas><div class="cr-over"><div class="cr-num" id="cr-num">1.00×</div><div class="cr-sub" id="cr-sub">Place a bet to start a round</div></div></div>'
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
      function paint(ms, crashed) {
        var cv = canvas(); if (!cv) return;
        var x = cv.x, w = cv.w, h = cv.h, d = cv.d, pad = 34 * d, tMax = Math.max(6000, ms * 1.15), m = Math.exp(K * ms), mMax = Math.max(2, m * 1.15);
        x.clearRect(0, 0, w, h);
        x.strokeStyle = "rgba(255,255,255,0.06)"; x.lineWidth = d; x.fillStyle = "rgba(177,186,211,0.6)"; x.font = 11 * d + "px Inter,sans-serif";
        for (var i = 0; i <= 4; i++) { var v = 1 + (mMax - 1) * i / 4, y = h - pad - (h - 2 * pad) * (i / 4); x.beginPath(); x.moveTo(pad, y); x.lineTo(w - 10 * d, y); x.stroke(); x.fillText(v.toFixed(1) + "×", 4 * d, y + 4 * d); }
        if (ms <= 0) return;
        var X = function (t) { return pad + (w - pad - 14 * d) * (t / tMax); }, Y = function (t) { return h - pad - (h - 2 * pad) * ((Math.exp(K * t) - 1) / (mMax - 1)); };
        var col = crashed ? "#f0566a" : "#ff2e55";
        x.beginPath(); x.moveTo(X(0), Y(0));
        for (var s = 0; s <= 60; s++) { var t = ms * s / 60; x.lineTo(X(t), Y(t)); }
        x.lineWidth = 4 * d; x.strokeStyle = col; x.lineCap = "round"; x.stroke();
        x.lineTo(X(ms), h - pad); x.lineTo(X(0), h - pad); x.closePath();
        var gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, crashed ? "rgba(255,122,89,.35)" : "rgba(255,46,85,.35)"); gr.addColorStop(1, "rgba(255,46,85,0)");
        x.fillStyle = gr; x.fill();
        x.beginPath(); x.arc(X(ms), Y(ms), 6 * d, 0, Math.PI * 2); x.fillStyle = "#fff"; x.fill();
      }
      function setNum(text, cls, sub) { var n = $("#cr-num"); if (!n) return; n.textContent = text; n.className = "cr-num" + (cls ? " " + cls : ""); $("#cr-sub").textContent = sub || ""; }
      var box = null;
      function finish(resolveRound, auto) {
        if (!auto && document.contains(box)) { ctx.lock(false); $("#cr-target").disabled = false; var b = ctx.btn(); if (b) { b.disabled = false; b.classList.remove("stop"); b.textContent = "Bet"; } }
        resolveRound();
      }
      function start() {
        var a = ctx.amount(), tg = target(), u = ctx.validate(a, tg); if (!u) return Promise.resolve(null);
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
              cashed = capMult(a, m); var bet = db.settleRound(u.id, G, cashed, true, { crash: crash, cashout: cashed, target: tg });
              ctx.record(bet); btn.disabled = true; btn.textContent = "Cashed out @ " + cashed.toFixed(2) + "×";
            } };
            (function step(now) {
              if (!document.contains(box)) { if (!cashed) { var w2 = tg < crash; db.settleRound(u.id, G, w2 ? capMult(a, tg) : 0, w2, { crash: crash, cashout: w2 ? tg : null, target: tg }); } run = null; return resolve({ win: !!cashed }); }
              var ms = now - t0, m = multAt(ms);
              if (!cashed && m >= tg && tg < crash) { cashed = capMult(a, tg); var bw = db.settleRound(u.id, G, cashed, true, { crash: crash, cashout: cashed, target: tg }); ctx.record(bw); if (!auto) { btn.disabled = true; btn.textContent = "Cashed out @ " + cashed.toFixed(2) + "×"; btn.classList.remove("stop"); } }
              if (m >= crash) {
                paint(Math.log(crash) / K, true); setNum(crash.toFixed(2) + "×", "l", cashed ? "You cashed out at " + cashed.toFixed(2) + "× · +" + fmt.usd(a * cashed - a) : "Crashed");
                if (!cashed) { var bl = db.settleRound(u.id, G, 0, false, { crash: crash, target: tg }); ctx.record(bl); }
                run = null; return setTimeout(function () { finish(function () { resolve({ win: !!cashed }); }, auto); }, auto ? 300 : 700);
              }
              paint(ms, false); setNum(m.toFixed(2) + "×", cashed ? "w" : "", cashed ? "Cashed out at " + cashed.toFixed(2) + "×" : "Cash out before it crashes");
              requestAnimationFrame(step);
            })(t0);
          });
        });
      }
      paint(0, false);
      return {
        refresh: function () { ctx.setProfit(target()); },
        resize: function () { paint(0, false); },
        click: function () { if (run) return run.cashout(); start(); },
        play: start,
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (!r || run) return;
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
  var GEM = '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="#28e0a0"/><path d="M2 9h20M8 3l4 18 4-18M6 3l2 6 4-6 4 6 2-6" fill="none" stroke="#0b7a55" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  var MINE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" fill="#f0566a"/><circle cx="9.5" cy="10.5" r="2" fill="#ffb3bd"/><path d="M12 6V3M17 8l2-2M7 8 5 6" stroke="#f0566a" stroke-width="2" stroke-linecap="round"/></svg>';
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
        if (round) { var k = round.revealed.length, cur = k ? minesMult(k, round.m) : 1; ctx.setProfit(cur, cur.toFixed(2)); $("#og-profit").value = (round.amount * (cur - 1)).toFixed(2); }
      }
      function tiles() { return $$("#mn-grid .mn-tile"); }
      function paint(final) {
        if (!$("#mn-grid")) return;
        tiles().forEach(function (t, i) {
          var open = round && round.revealed.indexOf(i) > -1, isMine = final && final.mines.indexOf(i) > -1;
          t.classList.toggle("open", open || !!final); t.classList.toggle("dim", !!final && !open);
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
        setLive(false); ctx.record(b);
        if (win) ctx.msg(""); 
      }
      function reveal(i) {
        if (!round || pending || round.revealed.indexOf(i) > -1) return;
        var u = me(), r = db.activeRound(u.id, G); if (!r) return;
        pending = true;
        floats(r.server, r.client, r.nonce, 24).then(function (fs) {
          pending = false; if (!round) return;
          var pos = minesFrom(fs, round.m);
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
        var a = ctx.amount(), u = ctx.validate(a); if (!u) return;
        var r = db.startRound(u.id, G, a, { m: m(), revealed: [] }); if (r.error) return ctx.msg(r.error);
        round = { amount: a, m: m(), revealed: [] }; renderHeader(); ctx.refresh(); paint(); setLive(true); refresh();
      }
      refresh(); paint();
      return {
        refresh: refresh,
        click: function () {
          if (!round) return start();
          if (!round.revealed.length || pending) return;
          var u = me(), r = db.activeRound(u.id, G); if (!r) return;
          pending = true;
          floats(r.server, r.client, r.nonce, 24).then(function (fs) { pending = false; if (round) end(true, minesFrom(fs, round.m)); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, m: r.state.m, revealed: r.state.revealed.slice() }; $("#mn-count").value = r.state.m; $("#og-amt").value = r.amount.toFixed(2); paint(); setLive(true); refresh(); }
        }
      };
    }
  };

  /* ---------- HI-LO ---------- */
  function cardHtml(c, cls) { var red = c.suit === 1 || c.suit === 2; return '<div class="hl-card' + (red ? " red" : "") + (cls ? " " + cls : "") + '"><span class="r">' + RANKS[c.rank] + '</span><span class="s">' + SUITS[c.suit] + '</span><span class="r b">' + RANKS[c.rank] + "</span></div>"; }
  function miniCard(c, cls) { var red = c.suit === 1 || c.suit === 2; return '<div class="hl-mini' + (red ? " red" : "") + (cls ? " " + cls : "") + '">' + RANKS[c.rank] + "<span>" + SUITS[c.suit] + "</span></div>"; }
  OG.hilo = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: '<div id="hl-live" class="hidden">' + profitField("Total profit") + "</div>",
        after: '<button class="btn btn-secondary btn-block" id="hl-skip" style="height:42px" disabled>Skip card</button>',
        center: '<div class="hl"><div class="hl-hist" id="hl-hist"></div><div id="hl-card"></div><div class="hl-btns"><button class="hl-btn" id="hl-up" disabled><span id="hl-up-l">Higher</span><small id="hl-up-p"></small></button><button class="hl-btn" id="hl-down" disabled><span id="hl-down-l">Lower</span><small id="hl-down-p"></small></button></div><div class="hl-note">K is the highest card, A is the lowest</div></div>'
      };
    },
    bind: function (ctx) {
      var G = "hilo", round = null, preview = null, busyCard = false; // round: {amount, cards:[{rank,suit,res}], mult, idx}
      function current() { return round ? round.cards[round.cards.length - 1] : preview; }
      function show() {
        var c = current(); if (!c || !$("#hl-card")) return;
        $("#hl-card").innerHTML = cardHtml(c);
        var o = hiloOpts(c.rank), live = !!round;
        [["up", o.up], ["down", o.down]].forEach(function (x) {
          $("#hl-" + x[0] + "-l").textContent = x[1].label;
          $("#hl-" + x[0] + "-p").textContent = (x[1].p * 100).toFixed(2) + "% · " + (0.99 / x[1].p).toFixed(2) + "×";
          $("#hl-" + x[0]).disabled = !live;
        });
        $("#hl-skip").disabled = !live;
        $("#hl-hist").innerHTML = round ? round.cards.map(function (k, i) { return miniCard(k, i === 0 ? "" : k.res); }).join("") : "";
        $("#hl-live").classList.toggle("hidden", !live);
        if (live) { ctx.setProfit(round.mult, round.mult.toFixed(2)); $("#og-profit").value = (round.amount * (round.mult - 1)).toFixed(2); }
        var b = ctx.btn(); b.textContent = live ? "Cashout" : "Bet"; b.disabled = live && round.mult <= 1;
      }
      function loadPreview() {
        var u = me(); if (!u) { preview = { rank: 7, suit: 0 }; return show(); }
        var s = db.seeds(u.id); floats(s.server, s.client, s.nonce, 1).then(function (fs) { preview = cardFrom(fs[0]); show(); });
      }
      function draw(kind) {
        if (!round || busyCard) return; busyCard = true;
        var u = me(), r = db.activeRound(u.id, G), idx = round.cards.length;
        floats(r.server, r.client, r.nonce, idx + 1).then(function (fs) {
          var next = cardFrom(fs[idx]), cur = current(), o = hiloOpts(cur.rank);
          if (kind === "skip") { next.res = "skip"; round.cards.push(next); }
          else {
            var opt = kind === "up" ? o.up : o.down, ok = opt.ok(next.rank);
            next.res = ok ? "good" : "bad"; round.cards.push(next);
            if (!ok) {
              var b = db.settleRound(u.id, G, 0, false, { cards: round.cards.map(function (c) { return RANKS[c.rank] + SUITS[c.suit]; }).join(" "), mult: round.mult });
              var last = round; round = null; busyCard = false;
              if (!$("#hl-card")) return;
              ctx.lock(false);
              $("#hl-card").innerHTML = cardHtml(next, "lose"); $("#hl-hist").innerHTML = last.cards.map(function (k, i) { return miniCard(k, i === 0 ? "" : k.res); }).join("");
              ["up", "down"].forEach(function (x) { $("#hl-" + x).disabled = true; }); $("#hl-skip").disabled = true; $("#hl-live").classList.add("hidden");
              ctx.btn().textContent = "Bet"; ctx.btn().disabled = false; ctx.record(b); busyCard = false;
              setTimeout(function () { if (!round) loadPreview(); }, 1200);
              return;
            }
            round.mult = Math.floor(round.mult * (0.99 / opt.p) * 100) / 100;
          }
          db.updateRound(u.id, G, { cards: round.cards, mult: round.mult }); busyCard = false; show();
        });
      }
      function start() {
        var a = ctx.amount(), u = ctx.validate(a); if (!u) return;
        var r = db.startRound(u.id, G, a, { cards: [], mult: 1 }); if (r.error) return ctx.msg(r.error);
        renderHeader(); ctx.refresh(); ctx.lock(true); busyCard = true;
        floats(r.round.server, r.round.client, r.round.nonce, 1).then(function (fs) {
          var first = cardFrom(fs[0]); busyCard = false;
          round = { amount: a, cards: [first], mult: 1 }; db.updateRound(u.id, G, { cards: round.cards, mult: 1 }); show();
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
          if (round.mult <= 1) return;
          var u = me(), mult = capMult(round.amount, round.mult);
          var b = db.settleRound(u.id, G, mult, true, { cards: round.cards.map(function (c) { return RANKS[c.rank] + SUITS[c.suit]; }).join(" "), mult: mult });
          round = null; ctx.lock(false); ctx.record(b); loadPreview();
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r && !(r.state.cards && r.state.cards.length)) {
            busyCard = true; ctx.lock(true);
            return floats(r.server, r.client, r.nonce, 1).then(function (fs) { busyCard = false; round = { amount: r.amount, cards: [cardFrom(fs[0])], mult: 1 }; db.updateRound(u.id, G, { cards: round.cards, mult: 1 }); $("#og-amt").value = r.amount.toFixed(2); show(); });
          }
          if (r) { round = { amount: r.amount, cards: r.state.cards.slice(), mult: r.state.mult }; $("#og-amt").value = r.amount.toFixed(2); ctx.lock(true); show(); }
        }
      };
    }
  };

  /* ---------- Tabelas: Wheel e Keno (RTP ≈ 99%, conferidas) ---------- */
  /* Tabelas de Wheel iguais às da Stake (RTP 99% em todas as combinações) */
  var WHEEL_MED = {"10":[0,1.9,0,1.5,0,2,0,1.5,0,3],"20":[1.5,0,2,0,2,0,2,0,1.5,0,3,0,1.8,0,2,0,2,0,2,0],"30":[1.5,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.7,0,4,0,1.5,0,2,0],"40":[2,0,3,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.6,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0],"50":[2,0,1.5,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,1.5,0,5,0,1.5,0,2,0,1.5,0]};
  function wheelTable(n, risk) {
    if (risk === "medium") return WHEEL_MED[n].slice();
    var low = [1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0], t = [];
    for (var i = 0; i < n; i++) t.push(risk === "high" ? (i === n - 1 ? Math.round(0.99 * n * 100) / 100 : 0) : low[i % 10]);
    return t;
  }
  function comb(n, k) { if (k < 0 || k > n) return 0; var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
  /* Tabelas de Keno iguais às da Stake (multiplicador por acertos, RTP ≈ 99%) */
  var KENO = {"classic":[[0,3.96],[0,1.9,4.5],[0,1,3.1,10.4],[0,0.8,1.8,5,22.5],[0,0.25,1.4,4.1,16.5,36],[0,0,1,3.68,7,16.5,40],[0,0,0.47,3,4.5,14,31,60],[0,0,0,2.2,4,13,22,55,70],[0,0,0,1.55,3,8,15,44,60,85],[0,0,0,1.4,2.25,4.5,8,17,50,80,100]],"low":[[0.7,1.85],[0,2,3.8],[0,1.1,1.38,26],[0,0,2.2,7.9,90],[0,0,1.5,4.2,13,300],[0,0,1.1,2,6.2,100,700],[0,0,1.1,1.6,3.5,15,225,700],[0,0,1.1,1.5,2,5.5,39,100,800],[0,0,1.1,1.3,1.7,2.5,7.5,50,250,1000],[0,0,1.1,1.2,1.3,1.8,3.5,13,50,250,1000]],"medium":[[0.4,2.75],[0,1.8,5.1],[0,0,2.8,50],[0,0,1.7,10,100],[0,0,1.4,4,14,390],[0,0,0,3,9,180,710],[0,0,0,2,7,30,400,800],[0,0,0,2,4,11,67,400,900],[0,0,0,2,2.5,5,15,100,500,1000],[0,0,0,1.6,2,4,7,26,100,500,1000]],"high":[[0,3.96],[0,0,17.1],[0,0,0,81.5],[0,0,0,10,259],[0,0,0,4.5,48,450],[0,0,0,0,11,350,710],[0,0,0,0,7,90,400,800],[0,0,0,0,5,20,270,600,900],[0,0,0,0,4,11,56,500,800,1000],[0,0,0,0,3.5,8,13,63,500,800,1000]]};
  function kenoTable(k, risk) { return (KENO[risk] || KENO.classic)[k - 1].slice(); }
  function kenoFrom(fs) { var a = []; for (var i = 1; i <= 40; i++) a.push(i); for (var j = 0; j < 10; j++) { var k = j + Math.floor(fs[j] * (40 - j)), t = a[j]; a[j] = a[k]; a[k] = t; } return a.slice(0, 10); }
  RD.fair.wheelTable = wheelTable; RD.fair.kenoTable = kenoTable; RD.fair.kenoFrom = kenoFrom;
  function multColor(m, high) { return m === 0 ? "#3a2a35" : high ? "#ff2e55" : m < 1.4 ? "#c9b8c2" : m < 1.6 ? "#22e08a" : m < 1.95 ? "#7aa7ff" : m < 2.5 ? "#ffc85c" : "#a07bff"; }

  /* ---------- WHEEL ---------- */
  OG.wheel = {
    label: function (b) { return b.multiplier.toFixed(2) + "×"; },
    cfg: function () {
      return {
        auto: true,
        side: '<div class="ogx-row2">' + selectField("wh-risk", "Risk", [["low", "Low"], ["medium", "Medium"], ["high", "High"]], ogPrefs.whRisk || "medium") + selectField("wh-seg", "Segments", [[10, "10"], [20, "20"], [30, "30"], [40, "40"], [50, "50"]], ogPrefs.whSeg || 30) + "</div>",
        center: '<div class="wh"><div class="wh-wrap"><div class="wh-pointer"></div><svg viewBox="-120 -120 240 240" id="wh-svg"><g id="wh-rot"></g><circle r="22" fill="#170f16" stroke="rgba(255,255,255,.15)" stroke-width="2"/><text id="wh-res" y="5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" style="font-family:var(--font-display)"></text></svg></div><div class="wh-legend" id="wh-legend"></div></div>'
      };
    },
    bind: function (ctx) {
      var rot = 0, spinning = false;
      function n() { return +$("#wh-seg").value; }
      function risk() { return $("#wh-risk").value; }
      function draw() {
        var t = wheelTable(n(), risk()), N = t.length, R = 110, r = 70, out = "", hi = risk() === "high";
        t.forEach(function (m, i) {
          var a0 = (i / N) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2;
          out += '<path d="M' + (R * Math.cos(a0)).toFixed(2) + " " + (R * Math.sin(a0)).toFixed(2) + " A" + R + " " + R + " 0 0 1 " + (R * Math.cos(a1)).toFixed(2) + " " + (R * Math.sin(a1)).toFixed(2) + " L" + (r * Math.cos(a1)).toFixed(2) + " " + (r * Math.sin(a1)).toFixed(2) + " A" + r + " " + r + " 0 0 0 " + (r * Math.cos(a0)).toFixed(2) + " " + (r * Math.sin(a0)).toFixed(2) + 'Z" fill="' + multColor(m, hi && m > 0) + '" stroke="#0e090d" stroke-width="1.2"/>';
        });
        $("#wh-rot").innerHTML = '<circle r="116" fill="#170f16"/>' + out + '<circle r="70" fill="#0e090d"/>';
        $("#wh-rot").style.transform = "rotate(" + rot + "deg)";
        var uniq = []; t.forEach(function (m) { if (uniq.indexOf(m) < 0) uniq.push(m); }); uniq.sort(function (a, b) { return a - b; });
        $("#wh-legend").innerHTML = uniq.map(function (m) { var c = t.filter(function (x) { return x === m; }).length; return '<div style="--c:' + multColor(m, hi && m > 0) + '"><b>' + m.toFixed(2) + "×</b><small>" + ((c / N) * 100).toFixed(1) + "%</small></div>"; }).join("");
        ctx.setProfit(Math.max.apply(null, t), "max " + Math.max.apply(null, t).toFixed(2));
      }
      function change() { if (spinning) return; ogPrefs.whSeg = n(); ogPrefs.whRisk = risk(); savePrefs(); draw(); }
      $("#wh-seg").addEventListener("change", change); $("#wh-risk").addEventListener("change", change);
      draw();
      function play() {
        var a = ctx.amount(), t = wheelTable(n(), risk()), N = t.length, u = ctx.validate(a, Math.max.apply(null, t)); if (!u || spinning) return Promise.resolve(null);
        var s = db.reserve(u.id), nonce = s.nonce, client = s.client; spinning = true; ctx.lock(true);
        return floats(s.server, client, nonce, 1).then(function (fs) {
          var seg = Math.floor(fs[0] * N), m = t[seg];
          var b = db.placeBet(u.id, "wheel", a, m, m > 0, { result: m, segment: seg, segments: N, risk: risk(), nonce: nonce, client: client });
          if (b.error) { spinning = false; ctx.lock(false); ctx.msg(b.error); return null; }
          var segA = 360 / N, jitter = (Math.random() - 0.5) * segA * 0.6, target = -((seg + 0.5) * segA) + jitter;
          rot = rot - (rot % 360) + 360 * 4 + target; if (rot <= 0) rot += 360 * 5;
          var g = $("#wh-rot"); g.style.transition = "transform 2.4s cubic-bezier(.12,.75,.12,1)"; g.style.transform = "rotate(" + rot + "deg)";
          $("#wh-res").textContent = "";
          return new Promise(function (res) {
            setTimeout(function () {
              spinning = false; ctx.lock(false); if (!$("#wh-res")) return res({ win: m > 1 });
              g.style.transition = "none"; $("#wh-res").textContent = m.toFixed(2) + "×"; $("#wh-res").setAttribute("fill", m > 1 ? "#22e08a" : m > 0 ? "#fff" : "#ff7a59");
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
        side: selectField("kn-risk", "Risk", [["classic", "Classic"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]], ogPrefs.knRisk || "classic"),
        after: '<div class="ogx-row2"><button class="btn btn-secondary" style="height:42px" id="kn-auto">Auto pick</button><button class="btn btn-secondary" style="height:42px" id="kn-clear">Clear</button></div>',
        center: '<div class="kn"><div class="kn-grid" id="kn-grid">' + tiles + '</div><div class="kn-pay" id="kn-pay"></div></div>'
      };
    },
    bind: function (ctx) {
      var picks = (ogPrefs.knPicks || []).slice(0, 10), busyK = false;
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
        var s = db.reserve(u.id), nonce = s.nonce, client = s.client; busyK = true; ctx.lock(true);
        return floats(s.server, client, nonce, 10).then(function (fs) {
          var drawn = kenoFrom(fs), hits = drawn.filter(function (n) { return picks.indexOf(n) > -1; }).length, m = capMult(a, t[hits]);
          var b = db.placeBet(u.id, "keno", a, m, m > 0, { result: hits, hits: hits, picks: picks.length, drawn: drawn, risk: risk(), nonce: nonce, client: client });
          if (b.error) { busyK = false; ctx.lock(false); ctx.msg(b.error); return null; }
          paint([]);
          return new Promise(function (res) {
            var i = 0;
            (function next() {
              if (!$("#kn-grid")) { busyK = false; return res({ win: m > 1 }); }
              i++; paint(drawn.slice(0, i), i === 10 ? hits : null);
              if (i < 10) return setTimeout(next, 70);
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
  function bjCard(c, hidden) {
    if (hidden) return '<div class="bj-card back"></div>';
    var red = c.suit === 1 || c.suit === 2;
    return '<div class="bj-card' + (red ? " red" : "") + '"><span class="r">' + RANKS[c.rank] + '</span><span class="s">' + SUITS[c.suit] + "</span></div>";
  }
  OG.blackjack = {
    label: function (b) { return b.detail.outcome || b.multiplier.toFixed(2) + "×"; },
    cfg: function () {
      return {
        after: '<div class="bj-actions"><button class="btn btn-secondary" id="bj-hit" disabled>' + ic("plus", 16) + 'Hit</button><button class="btn btn-secondary" id="bj-stand" disabled>' + ic("ban", 16) + 'Stand</button><button class="btn btn-secondary" id="bj-split" disabled>' + ic("swap", 16) + 'Split</button><button class="btn btn-secondary" id="bj-double" disabled>' + ic("coins", 16) + "Double</button></div>",
        center: '<div class="bj"><div class="bj-side"><div class="bj-cards" id="bj-dealer"></div><span class="bj-val" id="bj-dval"></span></div><div class="bj-mid"><div class="bj-rules">Blackjack pays 3 to 2 · Dealer stands on 17 · Insurance pays 2 to 1</div><div class="bj-ins hidden" id="bj-ins"><span>Dealer shows an Ace. <b>Insurance?</b><small id="bj-ins-cost"></small></span><div><button class="btn btn-gold btn-sm" id="bj-ins-yes">Accept</button><button class="btn btn-secondary btn-sm" id="bj-ins-no">No thanks</button></div></div><div class="bj-result hidden" id="bj-result"></div></div><div class="bj-hands" id="bj-hands"></div></div>'
      };
    },
    bind: function (ctx) {
      var G = "blackjack", S = null, busyB = false; // S: {cursor, dealer, hands:[{cards,bet,done,doubled}], active, over}
      function u() { return me(); }
      function draw(n) { var r = db.activeRound(u().id, G); return floats(r.server, r.client, r.nonce, S.cursor + n).then(function (fs) { var out = []; for (var i = 0; i < n; i++) out.push(cardFrom(fs[S.cursor + i])); S.cursor += n; return out; }); }
      function render(reveal) {
        if (!$("#bj-dealer")) return;
        var dCards = S ? S.dealer : [];
        $("#bj-dealer").innerHTML = dCards.map(function (c, i) { return bjCard(c, i === 1 && !reveal); }).join("");
        $("#bj-dval").textContent = S ? (reveal ? bjTotal(dCards).t : bjTotal([dCards[0]]).t) : "";
        $("#bj-dval").classList.toggle("hidden", !S);
        $("#bj-hands").innerHTML = S ? S.hands.map(function (h, i) { var v = bjTotal(h.cards); return '<div class="bj-hand' + (S.hands.length > 1 && i === S.active && !S.over ? " active" : "") + (h.res ? " " + h.res : "") + '"><div class="bj-cards">' + h.cards.map(function (c) { return bjCard(c); }).join("") + '</div><span class="bj-val">' + (v.soft && v.t < 21 ? v.t - 10 + "/" + v.t : v.t) + "</span></div>"; }).join("") : '<div class="bj-hand"><div class="bj-cards"><div class="bj-card ghost"></div><div class="bj-card ghost"></div></div></div>';
        var insOpen = !!(S && S.ins === "offer" && !S.over), box = $("#bj-ins");
        box.classList.toggle("hidden", !insOpen);
        if (insOpen) { $("#bj-ins-cost").textContent = "Costs " + fmt.usd(insCost()) + " · pays " + fmt.usd(insCost() * 3) + " if the dealer has Blackjack"; $("#bj-ins-yes").disabled = (u() ? u().balance : 0) < insCost(); }
        var h = S && !S.over && !insOpen ? S.hands[S.active] : null, bal = u() ? u().balance : 0;
        $("#bj-hit").disabled = !h; $("#bj-stand").disabled = !h;
        $("#bj-double").disabled = !(h && h.cards.length === 2 && bal >= h.bet);
        $("#bj-split").disabled = !(h && S.hands.length === 1 && h.cards.length === 2 && bjVal(h.cards[0].rank) === bjVal(h.cards[1].rank) && bal >= h.bet);
        var b = ctx.btn(); b.disabled = !!(S && !S.over);
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
      function insurance(take) {
        if (!S || S.ins !== "offer" || busyB) return;
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
        render(true);
        var r = $("#bj-result"); if (!r) { S = null; busyB = false; return; } r.className = "bj-result " + (total > amount ? "w" : total === amount ? "p" : "l");
        r.textContent = outcome === "Blackjack" ? "Blackjack! +" + fmt.usd(total - amount) : outcome === "Insured" ? "Dealer Blackjack — insurance paid" + (total > amount ? " +" + fmt.usd(total - amount) : "") : outcome === "Win" ? "You win +" + fmt.usd(total - amount) : outcome === "Push" ? "Push" : "Dealer wins";
        S = null; busyB = false; ctx.lock(false); if (ctx.btn()) ctx.btn().disabled = false; ctx.record(bet);
      }
      function dealerPlay() {
        render(true);
        var allBust = S.hands.every(function (h) { return bjTotal(h.cards).t > 21; });
        if (allBust) return finish();
        (function step() {
          if (bjTotal(S.dealer).t >= 17) return finish();
          draw(1).then(function (c) { S.dealer.push(c[0]); persist(); render(true); setTimeout(step, 420); });
        })();
      }
      function nextHand() {
        while (S.hands[S.active].done && S.active < S.hands.length - 1) S.active++;
        if (S.hands[S.active].done) { busyB = true; persist(); return dealerPlay(); }
        persist(); render();
      }
      function act(kind) {
        if (!S || S.over || busyB || S.ins === "offer") return; busyB = true;
        var h = S.hands[S.active];
        if (kind === "stand") { h.done = true; busyB = false; return nextHand(); }
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
        var a = ctx.amount(), us = ctx.validate(a); if (!us) return;
        var r = db.startRound(us.id, G, a, {}); if (r.error) return ctx.msg(r.error);
        renderHeader(); ctx.refresh(); deal(a);
      }
      function deal(a) {
        ctx.lock(true); $("#bj-result").className = "bj-result hidden"; busyB = true;
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
        click: function () { if (!S) start(); },
        resume: function () {
          var us = u(), r = us && db.activeRound(us.id, G);
          if (!r) return;
          if (!(r.state && r.state.hands && r.state.hands[0].cards.length)) { $("#og-amt").value = r.amount.toFixed(2); return deal(r.amount); }
          S = r.state; $("#og-amt").value = S.hands[0].bet.toFixed(2); ctx.lock(true); render();
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
  function rlPays(key) { return key.indexOf("n:") === 0 ? 36 : key.indexOf("doz:") === 0 || key.indexOf("col:") === 0 ? 3 : 2; }
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
        side: '<div><div class="ogx-label">Total bet</div><div class="ogx-input ro"><span class="cur">$</span><input id="rl-total" readonly value="0.00"></div></div>',
        after: '<div class="ogx-row2"><button class="btn btn-secondary" style="height:42px" id="rl-undo">Undo</button><button class="btn btn-secondary" style="height:42px" id="rl-clear">Clear</button></div>',
        center: '<div class="rl"><div class="rl-top"><div class="rl-wheel"><div class="wh-pointer"></div><svg viewBox="-110 -110 220 220"><g id="rl-rot"></g></svg><div class="rl-out" id="rl-out"></div></div></div><div class="rl-table" id="rl-table">' + grid + "</div></div>"
      };
    },
    bind: function (ctx) {
      var bets = {}, hist = [], rot = 0, spinning = false;
      (function wheel() {
        var out = "", N = 37, R = 104, r = 74;
        RL_ORDER.forEach(function (n, i) {
          var a0 = (i / N) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2, am = (a0 + a1) / 2;
          out += '<path d="M' + (R * Math.cos(a0)).toFixed(2) + " " + (R * Math.sin(a0)).toFixed(2) + " A" + R + " " + R + " 0 0 1 " + (R * Math.cos(a1)).toFixed(2) + " " + (R * Math.sin(a1)).toFixed(2) + " L" + (r * Math.cos(a1)).toFixed(2) + " " + (r * Math.sin(a1)).toFixed(2) + " A" + r + " " + r + " 0 0 0 " + (r * Math.cos(a0)).toFixed(2) + " " + (r * Math.sin(a0)).toFixed(2) + 'Z" fill="' + (n === 0 ? "#16a34a" : RL_RED.indexOf(n) > -1 ? "#d61f45" : "#1a1218") + '" stroke="#c9a24a" stroke-width=".6"/>' +
            '<text x="' + (89 * Math.cos(am)).toFixed(2) + '" y="' + (89 * Math.sin(am)).toFixed(2) + '" font-size="7" font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="central" transform="rotate(' + ((am * 180) / Math.PI + 90).toFixed(1) + " " + (89 * Math.cos(am)).toFixed(2) + " " + (89 * Math.sin(am)).toFixed(2) + ')">' + n + "</text>";
        });
        $("#rl-rot").innerHTML = '<circle r="108" fill="#c9a24a"/><circle r="105" fill="#2a1a12"/>' + out + '<circle r="74" fill="#3a2214"/><circle r="50" fill="#4a2c1a"/><circle r="16" fill="#c9a24a"/>';
      })();
      function total() { var t = 0; for (var k in bets) t += bets[k]; return Math.round(t * 100) / 100; }
      function paintChips(winKeys) {
        $$("#rl-table [data-rl]").forEach(function (c) {
          var k = c.getAttribute("data-rl"), v = bets[k], chipEl = c.querySelector(".rl-chip");
          chipEl.classList.toggle("hidden", !v); chipEl.textContent = v ? (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v >= 10 ? Math.round(v) : v.toFixed(v < 1 ? 2 : 1)) : "";
          c.classList.toggle("win", !!winKeys && winKeys.indexOf(k) > -1);
        });
        $("#rl-total").value = total().toFixed(2);
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
        var s = db.reserve(u.id), nonce = s.nonce, client = s.client; spinning = true; ctx.lock(true);
        return floats(s.server, client, nonce, 1).then(function (fs) {
          var n = Math.floor(fs[0] * 37), payout = 0, wins = [];
          for (var k in bets) if (rlWins(k, n)) { payout += bets[k] * rlPays(k); wins.push(k); }
          var mult = capMult(t, Math.round((payout / t) * 10000) / 10000);
          var b = db.placeBet(u.id, "roulette", t, mult, payout > 0, { result: n, bets: JSON.parse(JSON.stringify(bets)), nonce: nonce, client: client });
          if (b.error) { spinning = false; ctx.lock(false); ctx.msg(b.error); return null; }
          var i = RL_ORDER.indexOf(n), segA = 360 / 37, target = -((i + 0.5) * segA);
          rot = rot - (rot % 360) + 360 * 4 + target; if (rot <= 0) rot += 360 * 5;
          var g = $("#rl-rot"); g.style.transition = "transform 2.6s cubic-bezier(.12,.75,.12,1)"; g.style.transform = "rotate(" + rot + "deg)";
          $("#rl-out").className = "rl-out"; $("#rl-out").textContent = "";
          return new Promise(function (res) {
            setTimeout(function () {
              spinning = false; ctx.lock(false); if (!$("#rl-out")) return res({ win: payout > t });
              g.style.transition = "none"; $("#rl-out").className = "rl-out show " + rlColor(n); $("#rl-out").textContent = n;
              paintChips(wins); ctx.record(b); res({ win: payout > t });
            }, 2650);
          });
        });
      }
      paintChips();
      return { refresh: function () { if ($("#og-mult-lbl")) ctx.setProfit(1); }, play: play, cooldown: 100 };
    }
  };

  /* ---------- TOWER (tabelas da Stake: 9 andares, RTP 98%) ---------- */
  var TOWER = {
    easy: { tiles: 4, eggs: 3, mult: [1.31, 1.74, 2.32, 3.1, 4.13, 5.51, 7.34, 9.79, 13.05] },
    medium: { tiles: 3, eggs: 2, mult: [1.47, 2.21, 3.31, 4.96, 7.44, 11.16, 16.74, 25.11, 37.67] },
    hard: { tiles: 2, eggs: 1, mult: [1.96, 3.92, 7.84, 15.68, 31.36, 62.72, 125.44, 250.88, 501.76] },
    expert: { tiles: 3, eggs: 1, mult: [2.94, 8.82, 26.46, 79.38, 238.14, 714.42, 2143.26, 6429.78, 19289.34] },
    master: { tiles: 4, eggs: 1, mult: [3.92, 15.68, 62.72, 250.88, 1003.52, 4014.08, 16056.32, 64225.28, 256901.12] }
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
        if (round) { var m = multNow(); ctx.setProfit(m, m.toFixed(2)); var p = $("#og-profit"); if (p) p.value = (round.amount * (m - 1)).toFixed(2); }
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
        layout(r).then(function (eggs) {
          pending = false; if (!round) return;
          var row = round.picks.length; round.picks.push(i);
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
        var a = ctx.amount(), u = ctx.validate(a); if (!u) return;
        var r = db.startRound(u.id, G, a, { level: level(), picks: [] }); if (r.error) return ctx.msg(r.error);
        round = { amount: a, level: level(), picks: [] }; renderHeader(); ctx.refresh(); paint(); setLive(true); refresh();
      }
      paint(); refresh();
      return {
        refresh: refresh,
        click: function () {
          if (!round) return start();
          if (!round.picks.length || pending) return;
          var r = db.activeRound(me().id, G); if (!r) return;
          pending = true; layout(r).then(function (eggs) { pending = false; if (round) end(true, eggs); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, level: r.state.level, picks: r.state.picks.slice() }; $("#tw-level").value = r.state.level; $("#og-amt").value = r.amount.toFixed(2); paint(); setLive(true); refresh(); }
        }
      };
    }
  };

  /* ---------- CHICKEN (tabelas da Stake: 20 faixas, RTP 98%) ---------- */
  var CHICKEN = {
    easy: { bones: 1, mult: [1, 1.03, 1.09, 1.15, 1.23, 1.31, 1.4, 1.51, 1.63, 1.78, 1.96, 2.18, 2.45, 2.8, 3.27, 3.92, 4.9, 6.53, 9.8, 19.6] },
    medium: { bones: 3, mult: [1, 1.15, 1.37, 1.64, 2, 2.46, 3.07, 3.91, 5.08, 6.77, 9.31, 13.3, 19.95, 31.92, 55.86, 111.72, 279.3, 1117.2] },
    hard: { bones: 5, mult: [1, 1.31, 1.77, 2.46, 3.48, 5.06, 7.59, 11.81, 19.18, 32.89, 60.29, 120.59, 271.32, 723.52, 2532.32, 15193.92] },
    expert: { bones: 10, mult: [1, 1.96, 4.14, 9.31, 22.61, 60.29, 180.88, 633.08, 2743.35, 16460.08, 181060.88] }
  };
  /* Embaralha as 20 faixas (Fisher–Yates, 19 números); as primeiras "bones" escondem um carro */
  function chickenFrom(fs, diff) { var a = []; for (var i = 0; i < 20; i++) a.push(i); for (var j = 0; j < 19; j++) { var k = j + Math.floor(fs[j] * (20 - j)), t = a[j]; a[j] = a[k]; a[k] = t; } return a.slice(0, CHICKEN[diff].bones); }
  RD.fair.chicken = CHICKEN; RD.fair.chickenFrom = chickenFrom;
  var HEN = '<svg viewBox="0 0 48 48" class="ck-hen">' + RD.art.hen() + "</svg>";
  var CAR = '<svg viewBox="0 0 48 64" class="ck-car"><rect x="8" y="4" width="32" height="56" rx="9" fill="#ff2e55"/><rect x="12" y="14" width="24" height="12" rx="3" fill="#2a1a24"/><rect x="12" y="40" width="24" height="9" rx="3" fill="#2a1a24"/><rect x="5" y="12" width="4" height="10" rx="2" fill="#111"/><rect x="39" y="12" width="4" height="10" rx="2" fill="#111"/><rect x="5" y="44" width="4" height="10" rx="2" fill="#111"/><rect x="39" y="44" width="4" height="10" rx="2" fill="#111"/><rect x="13" y="5" width="6" height="3" rx="1.5" fill="#fff4c2"/><rect x="29" y="5" width="6" height="3" rx="1.5" fill="#fff4c2"/></svg>';
  OG.chicken = {
    label: function (b) { return b.multiplier ? b.multiplier.toFixed(2) + "×" : "0.00×"; },
    cfg: function () {
      return {
        side: selectField("ck-diff", "Difficulty", [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]], ogPrefs.ckDiff || "easy") +
          '<div id="ck-live" class="hidden">' + profitField("Total profit") + "</div>",
        after: '<button class="btn btn-secondary btn-block hidden" id="ck-go" style="height:42px">Cross next lane</button>',
        center: '<div class="ck"><div class="ck-road" id="ck-road"></div><div class="ck-note" id="ck-note"></div></div>'
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
            '<span class="ck-m">' + T.mult[i].toFixed(2) + "×</span>" + (dead ? CAR : here ? HEN : final && bone ? CAR : "") + "</button>";
        }
        road.innerHTML = html + '<div class="ck-lane ck-end"><span class="ck-flag">RD FINISH</span></div>';
        var at = road.querySelector(".here, .dead") || road.querySelector(".ck-start");
        if (at && road.scrollWidth > road.clientWidth) road.scrollTo({ left: Math.max(0, at.offsetLeft - road.clientWidth / 2 + at.offsetWidth / 2), behavior: "smooth" });
        $("#ck-note").textContent = round ? "Next lane pays " + (T.mult[steps + 1] ? T.mult[steps + 1].toFixed(2) + "×" : "—") + " · " + T.bones + " of 20 lanes hide a car" : T.bones + " of 20 lanes hide a car · up to " + T.mult[lanes].toLocaleString("en-US") + "×";
      }
      function refresh() {
        if (round) { var m = multNow(); ctx.setProfit(m, m.toFixed(2)); var p = $("#og-profit"); if (p) p.value = (round.amount * (m - 1)).toFixed(2); }
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
        layout(r).then(function (bones) {
          pending = false; if (!round) return;
          round.steps++;
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
        var a = ctx.amount(), u = ctx.validate(a); if (!u) return;
        var r = db.startRound(u.id, G, a, { diff: diff(), steps: 0 }); if (r.error) return ctx.msg(r.error);
        round = { amount: a, diff: diff(), steps: 0 }; renderHeader(); ctx.refresh(); paint(); setLive(true); refresh();
      }
      paint(); refresh();
      return {
        refresh: refresh,
        click: function () {
          if (!round) return start();
          if (!round.steps || pending) return;
          var r = db.activeRound(me().id, G); if (!r) return;
          pending = true; layout(r).then(function (bones) { pending = false; if (round) end(true, bones, false); });
        },
        resume: function () {
          var u = me(), r = u && db.activeRound(u.id, G);
          if (r) { round = { amount: r.amount, diff: r.state.diff, steps: r.state.steps }; $("#ck-diff").value = r.state.diff; $("#og-amt").value = r.amount.toFixed(2); paint(); setLive(true); refresh(); }
        }
      };
    }
  };

  function seedsModal() {
    var u = me(); if (needLogin()) return;
    var s = db.seeds(u.id);
    sha256(s.server).then(function (hash) {
      openGeneric('<div class="modal-head"><h3>Fairness</h3><button class="icon-btn" data-close>' + ic("x") + '</button></div><div class="modal-body">' +
        '<p class="muted" style="font-size:13px;margin-bottom:16px">Each result = HMAC-SHA256(server seed, client seed:nonce). The server seed stays hidden (only its hash is shown) until you rotate it, so you can verify every past bet.</p>' +
        '<div class="field"><label>Active server seed (SHA-256 hash)</label><div class="copy-field"><code>' + hash + '</code></div></div>' +
        '<div class="field"><label>Active client seed</label><div class="input-group"><input id="new-client" value="' + esc(s.client) + '"></div></div>' +
        '<div class="field"><label>Next nonce</label><input class="input" value="' + s.nonce + '" disabled></div>' +
        '<button class="btn btn-primary" data-action="rotate">Rotate seeds (reveals current server seed)</button>' +
        (s.revealed.length ? '<div class="divider"></div><h3 style="margin-bottom:10px">Revealed server seeds</h3><div class="table-wrap"><table class="table"><thead><tr><th>Server seed</th><th>Client seed</th><th class="right">Nonces</th></tr></thead><tbody>' +
          s.revealed.map(function (r) { return '<tr><td><code style="font-size:11px">' + r.server.slice(0, 24) + '…</code> <button class="btn btn-ghost btn-sm" data-copy="' + r.server + '">' + ic("copy", 14) + "</button></td><td>" + esc(r.client) + '</td><td class="right">0–' + Math.max(0, r.lastNonce) + "</td></tr>"; }).join("") +
          '</tbody></table></div><p class="faint" style="font-size:12px;margin-top:8px">Paste a revealed seed on the <a href="#/fairness" class="link-sm" data-close>Provably fair</a> page to check any bet.</p>' : "") +
        "</div>");
    });
  }

  pages.promotions = function () {
    return '<div class="container"><div class="page-head"><h1>Promotions</h1><p>Clear terms, no hidden conditions.</p></div>' +
      '<div class="promo-grid">' + RD.promotions.filter(function (p) { return p.status !== "draft"; }).map(function (p) {
        return '<div class="card promo">' + media(p, "", esc(p.title)) +
          '<div class="promo-body"><div class="row between"><span class="badge">' + esc(p.badge) + "</span>" + (p.status === "scheduled" ? '<span class="badge badge-info">Coming soon</span>' : "") + "</div>" +
          "<h3>" + esc(p.title) + '</h3><div class="promo-value">' + esc(p.value) + "</div><p>" + esc(p.desc) + "</p>" +
          '<div class="promo-foot"><button class="btn btn-primary btn-sm grow" data-promo="' + p.id + '">Get it</button><a class="btn btn-secondary btn-sm" href="#/legal/bonus">Terms</a></div></div></div>';
      }).join("") + "</div></div>";
  };

  pages.vip = function () {
    var u = me(), w = u ? u.wagered : 0, cur = db.tierOf(w), idx = cur ? RD.vipTiers.indexOf(cur) : -1, next = RD.vipTiers[idx + 1];
    var pct = next ? Math.min(100, ((w - (cur ? cur.wager : 0)) / (next.wager - (cur ? cur.wager : 0))) * 100) : 100;
    var rb = u ? Math.floor(u.rakeback * 100) / 100 : 0;
    return '<div class="container"><div class="page-head"><h1>VIP Club</h1><p>From Wood to Amethyst. Every dollar wagered counts — no opt-in.</p></div>' +
      '<div class="vip-hero"><div class="card vip-card"><div class="row" style="gap:16px;align-items:flex-start"><div class="vip-tier-badge" style="color:' + (cur ? cur.color : "var(--text-3)") + '">' + ic("crown", 28) + '</div><div class="grow"><span class="eyebrow">Your level</span><h2>' + (u ? (cur ? cur.name : "Unranked") : "Sign in to start") + "</h2>" +
        (u && next ? '<div class="tier-progress"><div class="row between" style="font-size:13px;margin-bottom:8px"><span class="muted">' + fmt.usd(w) + ' wagered</span><strong>' + pct.toFixed(1) + '%</strong></div><div class="progress"><span style="width:' + pct + '%"></span></div><small class="faint">' + fmt.usd(next.wager - w) + " to " + next.name + "</small></div>" : "") +
        (!u ? '<button class="btn btn-primary" style="margin-top:14px" data-open="register">Register</button>' : "") + "</div></div></div>" +
        '<div class="card vip-card"><span class="eyebrow">Instant rakeback</span><div class="kpi-value" style="margin:8px 0">' + fmt.usd(rb) + '</div><p class="muted" style="font-size:13px;margin-bottom:14px">' + (RD.config.rakebackRate * 100) + "% of the house edge on every bet comes back to you.</p>" +
        '<button class="btn btn-primary" data-action="rakeback"' + (rb < 0.01 ? " disabled" : "") + ">Claim rakeback</button></div></div>" +
      '<div class="section">' + sectionHead("Levels & rewards", "crown") + '<div class="tier-grid">' + RD.vipTiers.map(function (t, i) {
        var reached = u && w >= t.wager, claimed = u && u.claimedTiers.indexOf(t.name) > -1;
        return '<div class="card tier' + (i === idx ? " current" : "") + '" style="--tc:' + t.color + '"><h3>' + t.name + '</h3><small class="faint">' + fmt.compact(t.wager) + ' wagered</small><div class="tv">' + fmt.usd(t.reward, { dec: 0 }) + '</div><small class="faint">level-up reward</small>' +
          (reached ? (claimed ? '<div><span class="badge badge-success" style="margin-top:10px">Claimed</span></div>' : '<button class="btn btn-primary btn-sm btn-block" data-level="' + t.name + '">Claim</button>') : "") + "</div>";
      }).join("") + "</div></div></div>";
  };

  pages.leaderboard = function () {
    var L = db.leaderboard(), u = me(), mine = u ? L.filter(function (r) { return r.userId === u.id; })[0] : null;
    var colors = ["#c0d0e0", "#f5c842", "#cd7f4e"], top = [L[1], L[0], L[2]];
    return '<div class="container"><div class="page-head"><h1>Monthly leaderboard</h1><p>Ranked by total wagered this calendar month (UTC). Top ' + RD.config.leaderboardPrizes.length + " get paid.</p></div>" +
      '<div class="lb-hero"><div class="card lb-pool"><span class="eyebrow">Prize pool</span><div class="big">' + fmt.usd(RD.config.leaderboardPrize, { dec: 0 }) + '</div><p class="muted">1st place: ' + fmt.usd(RD.config.leaderboardPrizes[0], { dec: 0 }) + "</p>" +
        '<div class="countdown"><div><strong data-cd="d">00</strong><small>days</small></div><div><strong data-cd="h">00</strong><small>hours</small></div><div><strong data-cd="m">00</strong><small>min</small></div><div><strong data-cd="s">00</strong><small>sec</small></div></div></div>' +
        '<div class="card podium">' + top.map(function (p, i) {
          var h = [80, 110, 60][i];
          return '<div class="podium-col">' + (p ? '<div class="avatar" style="background:' + colors[i] + ';color:#111">' + initials(p.user) + '</div><div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis">' + esc(p.user) + '</div><div class="faint" style="font-size:12px">' + fmt.usd(p.prize, { dec: 0 }) + "</div>" : '<div class="faint" style="font-size:12px">Open spot</div>') +
            '<div class="step" style="height:' + h + "px;background:" + colors[i] + "22;color:" + colors[i] + '">' + [2, 1, 3][i] + "</div></div>";
        }).join("") + "</div></div>" +
      '<div class="section"><div class="card">' + (L.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Rank</th><th>Player</th><th class="right">Wagered</th><th class="right">Prize</th></tr></thead><tbody>' +
        L.slice(0, 50).map(function (p) { return "<tr" + (mine && p.userId === mine.userId ? ' style="background:var(--brand-soft)"' : "") + '><td><span class="rank-pill">' + p.rank + '</span></td><td class="strong">' + esc(p.user) + '</td><td class="right num">' + fmt.usd(p.wagered) + '</td><td class="right num strong">' + (p.prize ? fmt.usd(p.prize, { dec: 0 }) : "—") + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : empty("The race just started", "Nobody has wagered this month yet. First place is open.", '<a class="btn btn-primary btn-sm" href="#/game/dice">Play Dice</a>')) + "</div></div></div>";
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
      ["How is commission calculated?", "You earn a share of the Net Gaming Revenue (NGR) of every player you refer: bets minus wins, minus bonuses and rakeback. Your share depends on how many new depositing players (FTDs) you bring each month."],
      ["Is there negative carryover?", "No. If a month closes negative, it does not carry into the next one."],
      ["When do I get paid?", "Commission is calculated in real time. Collect it to your balance any time and withdraw in crypto."],
      ["Can I get a custom deal?", "Yes. Streamers and communities with proven traffic can get a custom revenue share. Contact us."],
      ["What traffic is not allowed?", "Brand bidding, incentivized or spam traffic, and any traffic from restricted countries. Players from restricted territories can't register and generate no commission."]
    ];
    return '<div class="container">' +
      '<section class="aff-hero">' + media({ img: RD.img.heroAffiliate, art: RD.img.heroArt }) + '<div class="shade"></div>' +
        '<div class="copy"><span class="badge" style="background:#fff;color:#160a10">RDCasino Partners</span><h1 style="margin-top:14px">Refer friends. Earn for life.</h1><p>Up to 50% revenue share, no negative carryover and real-time stats for every link you share.</p>' +
        '<div class="row wrap">' + (me() ? '<a class="btn btn-primary btn-lg" href="#/affiliate/overview">Open dashboard</a>' : '<button class="btn btn-primary btn-lg" data-open="register">Become a partner</button><button class="btn btn-secondary btn-lg" data-open="login">Sign in</button>') + "</div>" +
        '<div class="aff-hero-stats"><div><strong>50%</strong><small>max revenue share</small></div><div><strong>$0</strong><small>negative carryover</small></div><div><strong>Instant</strong><small>commission to balance</small></div></div></div></section>' +
      '<div class="section">' + sectionHead("How it works") + '<div class="steps">' +
        [["Get your link", "Every account has a referral link and code. Create extra codes for each channel."], ["Share it", "Players who register with your link or code are tied to you for life."], ["Collect", "Your commission grows as they play. Collect it to your balance any time."]].map(function (s, i) {
          return '<div class="card step"><div class="step-n">' + (i + 1) + "</div><h3>" + s[0] + "</h3><p>" + s[1] + "</p></div>";
        }).join("") + "</div></div>" +
      '<div class="section">' + sectionHead("Commission tiers") + '<div class="plan-grid">' + RD.affiliatePlans.map(function (p) {
        return '<div class="card plan"><span class="eyebrow">' + p.label + '</span><div class="share">' + p.share + '%</div><small>' + p.range + "</small></div>";
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
      $("#calc-detail").textContent = "at " + plan.share + "% (" + plan.label + ") · ~" + fmt.usd(total / months, { dec: 0 }) + " / month";
    }
    r.forEach(function (el) { el.addEventListener("input", calc); }); calc();
  }

  var AFF_TABS = [["overview", "Overview"], ["campaigns", "Campaigns"], ["referrals", "Referred players"], ["earnings", "Earnings"], ["assets", "Marketing assets"]];
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
      $("#ref-body").innerHTML = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Player</th><th>Code</th><th>Joined</th><th class="right">Deposits</th><th class="right">Wagered</th><th class="right">NGR</th><th>Status</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td class="strong">' + esc(r.user.slice(0, 2)) + "***" + '</td><td>' + esc(r.code) + "</td><td>" + r.joined.slice(0, 10) + '</td><td class="right num">' + fmt.usd(r.deposits) + '</td><td class="right num">' + fmt.usd(r.wagered) + '</td><td class="right num strong">' + fmt.usd(r.ngr) + '</td><td><span class="badge ' + (r.active ? "badge-success" : r.ftd ? "badge-brand" : "") + '">' + (r.active ? "Active" : r.ftd ? "Deposited" : "Registered") + "</span></td></tr>"; }).join("") +
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
  pages.account = function (tab) {
    var u = me(); if (!u) { setTimeout(function () { openAuth("login"); }, 0); return pages.home(); }
    tab = tab || "overview";
    var k = KYC_LABEL[u.kyc] || [u.kyc, ""], txs = db.txOf(u.id);
    var pendingWd = txs.filter(function (t) { return t.type === "Withdrawal" && t.status === "Pending"; }).reduce(function (a, t) { return a + t.amount; }, 0);
    var head = '<div class="page-head"><h1>' + esc(u.username) + '</h1><p>Member since ' + u.created.slice(0, 10) + "</p></div>" +
      '<div class="card balance-card"><div><div class="kpi-label">Balance</div><div class="kpi-value num">' + fmt.usd(u.balance) + '</div></div><div><div class="kpi-label">Pending withdrawals</div><div class="kpi-value num">' + fmt.usd(pendingWd) + '</div></div><div><div class="kpi-label">Verification</div><div style="margin-top:6px"><span class="badge ' + k[1] + '">' + k[0] + '</span></div></div><div class="row bc-actions" style="gap:8px"><button class="btn btn-primary" data-open="wallet">Deposit</button><button class="btn btn-secondary" data-action="open-withdraw">Withdraw</button></div></div>' +
      '<div class="pill-tabs" style="margin:20px 0">' + [["overview", "Transactions"], ["bets", "Bets"], ["verification", "Verification"], ["stats", "Statistics"]].map(function (t) { return '<a class="' + (t[0] === tab ? "active" : "") + '" href="#/account/' + t[0] + '">' + t[1] + "</a>"; }).join("") + "</div>";
    var body;
    if (tab === "bets") body = '<div class="card">' + betsTable(db.betsOf(u.id).slice(0, 50), "Your bets show up here.") + "</div>";
    else if (tab === "verification") {
      var kb;
      if (u.kyc === "Verified") kb = '<p class="muted">Your identity is verified. No withdrawal limits apply.</p>';
      else if (u.kyc === "Pending") kb = '<p class="muted">We received your documents. Reviews usually take less than 24 hours.</p>';
      else kb = (u.kyc === "Rejected" ? errorBox("Your documents were rejected" + (u.kycReason ? ": " + u.kycReason : "") + ". Please send them again.") : '<p class="muted" style="margin-bottom:14px">Required for withdrawals above ' + fmt.usd(RD.config.kycWithdrawLimit, { dec: 0 }) + ".</p>") +
        '<form id="kyc-form"><div class="field"><label>Full legal name</label><input class="input" name="name" required></div>' +
        '<div class="row wrap" style="gap:0 12px;align-items:flex-start"><div class="field grow" style="min-width:150px"><label>Date of birth</label><input class="input" type="date" name="dob" required></div><div class="field grow" style="min-width:150px"><label>Document</label><select class="select" name="doc"><option>Passport</option><option>National ID</option><option>Driver\'s license</option></select></div></div>' +
        '<div class="field"><label>Document photo</label><input class="input" type="file" accept="image/*,.pdf" style="padding-top:9px"></div>' +
        '<div class="field"><label>Proof of address</label><input class="input" type="file" accept="image/*,.pdf" style="padding-top:9px"></div>' +
        '<button class="btn btn-primary">Submit for review</button></form>';
      body = '<div class="card card-pad" style="max-width:640px"><div class="row between" style="margin-bottom:12px"><h3>Identity verification</h3><span class="badge ' + k[1] + '">' + k[0] + "</span></div>" + kb + "</div>";
    } else if (tab === "stats") {
      var t = db.tierOf(u.wagered);
      body = '<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Total wagered</div><div class="kpi-value num">' + fmt.usd(u.wagered) + '</div></div><div class="kpi"><div class="kpi-label">Bets</div><div class="kpi-value num">' + fmt.int(u.bets) + '</div></div><div class="kpi"><div class="kpi-label">Profit</div><div class="kpi-value num ' + (u.profit >= 0 ? "pos" : "neg") + '">' + fmt.usd(u.profit) + '</div></div><div class="kpi"><div class="kpi-label">VIP level</div><div class="kpi-value">' + (t ? t.name : "Unranked") + "</div></div></div>";
    } else {
      var label = { Deposit: "Deposit", Withdrawal: "Withdrawal", Adjustment: "Balance adjustment", Bonus: "Bonus", Rakeback: "Rakeback", "Level reward": "VIP reward", Commission: "Affiliate commission", "Tip sent": "Tip sent", "Tip received": "Tip received" };
      body = '<div class="card">' + (txs.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Type</th><th>Date</th><th class="right">Amount</th><th>Status</th></tr></thead><tbody>' + txs.map(function (t) {
        var out = t.type === "Withdrawal" || t.sign === -1, st = t.status === "Completed" ? "badge-success" : t.status === "Pending" ? "badge-warn" : "badge-danger";
        return '<tr><td class="strong">' + (label[t.type] || t.type) + (t.note && t.type !== "Withdrawal" ? '<br><small class="faint">' + esc(t.note) + "</small>" : "") + '</td><td class="faint">' + fmt.date(t.date) + '</td><td class="right num strong ' + (out ? "" : "pos") + '">' + (out ? "-" : "+") + fmt.usd(t.amount) + '</td><td><span class="badge ' + st + '">' + (t.status === "Completed" ? (t.type === "Withdrawal" ? "Sent" : "Completed") : t.status === "Pending" ? "Processing" : "Rejected") + "</span></td></tr>";
      }).join("") + "</tbody></table></div>" : empty("No transactions yet", "Make a deposit to get started.", '<button class="btn btn-primary btn-sm" data-open="wallet">Deposit</button>')) + "</div>";
    }
    return '<div class="container">' + head + body + "</div>";
  };
  pages.account.after = function () {
    var f = $("#kyc-form"); if (!f) return;
    f.addEventListener("submit", function (e) { e.preventDefault(); db.submitKyc(me().id, { name: f.name.value, dob: f.dob.value, doc: f.doc.value, sent: new Date().toISOString().slice(0, 10) }); RD.toast("Documents sent for review"); route(true); });
  };

  /* ---------- Static pages ---------- */
  pages.sports = function () {
    return '<div class="container"><div class="card empty" style="padding:72px 20px">' + ic("ball", 40) + '<h2 style="margin-top:14px">Sportsbook is coming</h2><p style="max-width:420px;margin:8px auto 20px">We are integrating a sportsbook provider. Meanwhile, try RD Originals.</p><a class="btn btn-primary" href="#/game/dice">Play Dice</a></div></div>';
  };
  pages.fairness = function () {
    return '<div class="container prose"><h1>Provably fair</h1><p class="muted" style="margin-top:8px">Every RD Originals result can be verified by you. We commit to the server seed (showing its hash) before you bet, so nobody can change a result afterwards.</p>' +
      "<h2>How results are made</h2><ul>" +
      "<li><strong>Dice / Limbo / Crash:</strong> <code>HMAC_SHA256(server_seed, client_seed:nonce)</code> → first 4 bytes → number between 0 and 1. Dice: <code>floor(n × 10001) / 100</code>. Limbo and Crash: <code>floor(0.99 / n × 100) / 100</code> (min 1.00×).</li>" +
      "<li><strong>Plinko / Mines / Hi-Lo / Keno / Wheel / Roulette / Blackjack / Tower / Chicken:</strong> need several numbers, made with <code>HMAC_SHA256(server_seed, client_seed:nonce:cursor)</code>, 8 numbers per cursor. Plinko: each row goes right if <code>n ≥ 0.5</code>. Mines: Fisher–Yates shuffle of the 25 tiles, the first N are mines. Hi-Lo and Blackjack: card = <code>floor(n × 52)</code> (infinite deck). Keno: shuffle of 1–40, first 10 are drawn. Wheel: segment = <code>floor(n × segments)</code>. Roulette: number = <code>floor(n × 37)</code>. Tower: on each of the 9 floors, Fisher–Yates shuffle of the tiles, the first ones are eggs. Chicken: Fisher–Yates shuffle of the 20 lanes, the first ones hide a car.</li></ul>" +
      '<h2>Verify a bet</h2><div class="card card-pad"><div class="row wrap" style="gap:0 12px;align-items:flex-start"><div class="field grow" style="min-width:160px"><label>Game</label><select class="select" id="v-game"><option value="dice">Dice</option><option value="limbo">Limbo</option><option value="crash">Crash</option><option value="plinko">Plinko</option><option value="mines">Mines</option><option value="hilo">Hi-Lo</option><option value="keno">Keno</option><option value="wheel">Wheel</option><option value="roulette">Roulette</option><option value="blackjack">Blackjack</option><option value="tower">Tower</option><option value="chicken">Chicken</option></select></div>' +
      '<div class="field grow" style="min-width:160px" id="v-extra-wrap"><label id="v-extra-l">—</label><input class="input" id="v-extra" disabled></div></div>' +
      '<div class="field"><label>Server seed (revealed)</label><input class="input" id="v-server"></div><div class="field"><label>Client seed</label><input class="input" id="v-client"></div><div class="field"><label>Nonce</label><input class="input" id="v-nonce" type="number" value="0" min="0"></div><button class="btn btn-primary" data-action="verify">Verify</button><div id="v-out" style="margin-top:16px"></div></div>' +
      '<p class="faint" style="font-size:13px;margin-top:12px">Open "Provably fair" in the bottom bar of any RD Original and rotate your seed to reveal the server seed used for your past bets.</p></div>';
  };
  pages.fairness.after = function () {
    var g = $("#v-game"), ex = $("#v-extra"), lb = $("#v-extra-l");
    function upd() {
      var v = g.value, cfg = { plinko: ["Rows / risk (e.g. 16 high)", "16 high"], mines: ["Number of mines", "3"], hilo: ["Cards to show", "8"], blackjack: ["Cards to show", "8"], wheel: ["Segments / risk (e.g. 30 medium)", "30 medium"], tower: ["Difficulty", "easy"], chicken: ["Difficulty", "easy"] }[v];
      ex.disabled = !cfg; lb.textContent = cfg ? cfg[0] : "—"; ex.value = cfg ? cfg[1] : "";
    }
    g.addEventListener("change", upd); upd();
  };
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
      '<div class="footer-legal"><div>' + licenseLine + "</div><div>Restricted territories: " + RD.config.restrictedCountries.join(", ") + ".</div><div>Gambling can be addictive. Play responsibly. © " + new Date().getFullYear() + " RDCasino.</div></div></div>";
  }

  /* ---------- Chat ---------- */
  function renderChat() {
    var list = db.chat(), box = $("#chat-list");
    box.innerHTML = list.length ? list.map(function (m) { return '<div class="chat-msg"><span class="avatar">' + initials(m.user) + "</span><div><strong>" + esc(m.user) + "</strong><p>" + esc(m.text) + "</p></div></div>"; }).join("") : '<div class="empty" style="padding:40px 10px">No messages yet. Say hi!</div>';
    box.scrollTop = box.scrollHeight;
  }

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
    var path = (location.hash || "#/").replace(/^#\/?/, "").replace(/\/$/, "");
    var parts = path.split("/"), name = parts[0] || "home", arg = parts[1];
    var fn = pages[name] || pages.notfound, u = me();
    currentPath = path;
    var banner = u && u.status !== "Active" ? '<div class="container" style="padding-bottom:0"><div class="notice" style="background:var(--danger-soft);border-color:rgba(255,122,89,.3);color:var(--danger)">' + ic("ban", 16) + "<span><strong>Your account is suspended.</strong> Deposits, bets and withdrawals are disabled. Contact support.</span></div></div>" : "";
    $("#view").innerHTML = banner + fn(arg);
    if (fn.after) fn.after(arg);
    closeAll(); markActive(path); countdown();
    if (!keep) window.scrollTo(0, 0);
  }

  /* ---------- Events ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open],[data-close],[data-drawer],[data-close-drawer],[data-action],[data-copy],[data-auth],[data-wtab],[data-coin],[data-net],[data-btab],[data-level],[data-promo],#user-btn,#burger,#bn-menu,#sb-backdrop");
    if (!t) {
      if (!e.target.closest(".menu-wrap")) $("#user-menu").classList.add("hidden");
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
    if (t.hasAttribute("data-drawer")) { e.preventDefault(); closeAll(); renderChat(); $("#drawer-" + t.getAttribute("data-drawer")).classList.add("open"); return; }
    if (t.hasAttribute("data-close-drawer")) return closeAll();
    if (t.hasAttribute("data-auth")) { e.preventDefault(); return openAuth(t.getAttribute("data-auth")); }
    if (t.hasAttribute("data-wtab")) { state.walletTab = t.getAttribute("data-wtab"); return renderWallet(); }
    if (t.hasAttribute("data-coin")) { state.coin = t.getAttribute("data-coin"); return renderWallet(); }
    if (t.hasAttribute("data-net")) { state.net = t.getAttribute("data-net"); return renderWallet(); }
    if (t.hasAttribute("data-btab")) { state.betsTab = t.getAttribute("data-btab"); return renderFeed(); }
    if (t.hasAttribute("data-level")) { var r1 = db.claimLevel(me().id, t.getAttribute("data-level")); RD.toast(r1.error || "Claimed " + fmt.usd(r1.amount), r1.error ? "error" : ""); renderHeader(); return route(true); }
    if (t.hasAttribute("data-promo")) {
      var pid = t.getAttribute("data-promo");
      if (needLogin()) return;
      if (pid === "rakeback") { location.hash = "#/vip"; return; }
      if (pid === "race") { location.hash = "#/leaderboard"; return; }
      openModal("wallet"); state.walletTab = "deposit"; renderWallet();
      return RD.toast("Deposit to activate. Support credits the bonus after review.");
    }
    if (t.id === "user-btn") return $("#user-menu").classList.toggle("hidden");
    if (t.id === "burger" || t.id === "bn-menu") return document.body.classList.toggle("sb-open");
    if (t.id === "sb-backdrop") return closeAll();

    var u = me(), a = t.getAttribute("data-action");
    switch (a) {
      case "logout": db.logout(); renderHeader(); closeAll(); location.hash = "#/"; route(); return RD.toast("Signed out");
      case "new-campaign": return newCampaign();
      case "collect": { var c = db.collectCommission(u.id); RD.toast(c.error || fmt.usd(c.amount) + " added to your balance", c.error ? "error" : ""); renderHeader(); return route(true); }
      case "rakeback": { if (needLogin()) return; var rb = db.claimRakeback(u.id); RD.toast(rb.error || "Claimed " + fmt.usd(rb.amount), rb.error ? "error" : ""); renderHeader(); return route(true); }
      case "seeds": return seedsModal();
      case "rotate": { var rs = db.rotateSeed(u.id, ($("#new-client").value || "").trim()); if (rs && rs.error) return RD.toast(rs.error, "error"); RD.toast("Seeds rotated — previous server seed revealed"); return seedsModal(); }
      case "open-withdraw": state.walletTab = "withdraw"; openModal("wallet"); return renderWallet();
      case "wd-max": $("#wd-amt").value = u.balance.toFixed(2); return;
      case "sim-deposit": {
        var d = parseFloat($("#dep-amt").value), r = db.deposit(u.id, d, state.coin);
        if (r.error) { $("#dep-msg").innerHTML = errorBox(r.error); return; }
        closeAll(); renderHeader(); RD.toast(fmt.usd(d) + " credited to your balance"); return route(true);
      }
      case "withdraw": {
        var amt = parseFloat($("#wd-amt").value), addr = $("#wd-addr").value.trim();
        if (addr.length < 20) { $("#wd-msg").innerHTML = errorBox("Enter a valid wallet address."); return; }
        var w2 = db.requestWithdrawal(u.id, amt, state.coin, addr);
        if (w2.error) { $("#wd-msg").innerHTML = errorBox(w2.error, w2.kyc ? ' <a href="#/account/verification" class="link-sm" data-close>Verify now</a>' : ""); return; }
        closeAll(); renderHeader(); RD.toast("Withdrawal of " + fmt.usd(amt) + " sent for review"); return route(true);
      }
      case "tip": {
        var tp = db.tip(u.id, $("#tip-to").value.trim(), parseFloat($("#tip-amt").value));
        if (tp.error) { $("#tip-msg").innerHTML = errorBox(tp.error); return; }
        closeAll(); renderHeader(); return RD.toast("Tip sent");
      }
      case "verify": {
        var game = $("#v-game").value, sv = $("#v-server").value.trim(), cl = $("#v-client").value.trim(), n = parseInt($("#v-nonce").value, 10) || 0, extra = ($("#v-extra").value || "").trim();
        if (!sv || !cl) { $("#v-out").innerHTML = errorBox("Fill in both seeds."); return; }
        var show = function (txt) { sha256(sv).then(function (h) { $("#v-out").innerHTML = '<div class="notice info">' + ic("check", 16) + "<span>" + txt + "<br>Server seed hash: <code>" + h + "</code></span></div>"; }); };
        if (game === "dice" || game === "limbo" || game === "crash") {
          hmac(sv, cl + ":" + n).then(function (buf) { var o = outcome(game, floatFrom(buf)); show("Result: <strong>" + (game === "dice" ? o.toFixed(2) : o.toFixed(2) + "×") + "</strong>"); });
        } else if (game === "plinko") {
          var pr = extra.split(/\s+/), rows = +pr[0] || 16, rk = (pr[1] || "high").toLowerCase();
          if (!PLINKO[rows] || !PLINKO[rows][rk]) { $("#v-out").innerHTML = errorBox("Use 8 to 16 rows and low, medium or high."); return; }
          floats(sv, cl, n, rows).then(function (fs) { var path = fs.map(function (f) { return Math.floor(f * 2); }), slot = path.reduce(function (a, b) { return a + b; }, 0); show("Path: <code>" + path.map(function (x) { return x ? "R" : "L"; }).join("") + "</code> → slot " + (slot + 1) + " of " + (rows + 1) + " → <strong>" + PLINKO[rows][rk][slot] + "×</strong>"); });
        } else if (game === "mines") {
          var mc = Math.max(1, Math.min(24, parseInt(extra, 10) || 3));
          floats(sv, cl, n, 24).then(function (fs) { show("Mines at tiles: <strong>" + minesFrom(fs, mc).map(function (x) { return x + 1; }).sort(function (a, b) { return a - b; }).join(", ") + "</strong> (1–25, left to right, top to bottom)"); });
        } else if (game === "keno") {
          floats(sv, cl, n, 10).then(function (fs) { show("Drawn numbers: <strong>" + kenoFrom(fs).sort(function (a, b) { return a - b; }).join(", ") + "</strong>"); });
        } else if (game === "wheel") {
          var wp = extra.split(/\s+/), segs = +wp[0] || 30, wr = (wp[1] || "medium").toLowerCase();
          if ([10, 20, 30, 40, 50].indexOf(segs) < 0 || ["low", "medium", "high"].indexOf(wr) < 0) { $("#v-out").innerHTML = errorBox("Use 10–50 segments and low, medium or high."); return; }
          floats(sv, cl, n, 1).then(function (fs) { var sg = Math.floor(fs[0] * segs); show("Segment " + (sg + 1) + " of " + segs + " → <strong>" + wheelTable(segs, wr)[sg].toFixed(2) + "×</strong>"); });
        } else if (game === "tower") {
          var tl = extra.toLowerCase(); if (!TOWER[tl]) { $("#v-out").innerHTML = errorBox("Use easy, medium, hard, expert or master."); return; }
          floats(sv, cl, n, 27).then(function (fs) { show("Egg tiles per floor (bottom to top, 1 = left): <strong>" + towerFrom(fs, tl).map(function (r) { return r.map(function (x) { return x + 1; }).sort().join("+"); }).join(" · ") + "</strong>"); });
        } else if (game === "chicken") {
          var cd = extra.toLowerCase(); if (!CHICKEN[cd]) { $("#v-out").innerHTML = errorBox("Use easy, medium, hard or expert."); return; }
          floats(sv, cl, n, 19).then(function (fs) { show("Cars in lanes: <strong>" + chickenFrom(fs, cd).map(function (x) { return x + 1; }).sort(function (a, b) { return a - b; }).join(", ") + "</strong> (1–20)"); });
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

  $("#form-login").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target, r = db.login(f.user.value.trim(), f.pass.value);
    if (r.error) { $("#login-error").innerHTML = errorBox(r.error); return; }
    f.reset(); closeAll(); renderHeader(); RD.toast("Welcome back, " + r.player.username); route(true);
  });
  $("#form-register").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target;
    var r = db.register({ email: f.email.value, username: f.username.value, pass: f.pass.value, country: f.country.value, ref: f.ref.value });
    if (r.error) { $("#reg-error").innerHTML = errorBox(r.error); return; }
    f.reset(); try { localStorage.removeItem("rd_ref"); } catch (x) {}
    closeAll(); renderHeader(); RD.toast("Welcome, " + r.player.username + "! Make a deposit to start playing."); route(true);
  });
  $("#chat-form").addEventListener("submit", function (e) {
    e.preventDefault(); var inp = this.querySelector("input");
    if (!inp.value.trim()) return; if (needLogin()) return;
    db.chatSend(me().id, inp.value); inp.value = ""; renderChat();
  });

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
      if (!told && before.bal !== after.bal) RD.toast("Balance updated: " + fmt.usd(after.bal));
    }
    if ($(".overlay.open")) return;
    if (/^game\//.test(currentPath)) return; // não reinicia o jogo no meio da aposta
    if (currentPath === "" || currentPath === "home") { renderTicker(); renderFeed(); return; }
    route(true);
  });

  /* ---------- Boot ---------- */
  hydrateIcons(document);
  renderSidebar(); renderHeader(); renderFooter(); fillCountries();
  window.addEventListener("hashchange", function () { route(); });
  route();
  setInterval(countdown, 1000);
})();
