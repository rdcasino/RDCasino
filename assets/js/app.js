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
  function errorBox(msg, extra) { return '<div class="notice form-error" style="background:var(--danger-soft);border-color:rgba(240,86,106,.3);color:var(--danger)">' + ic("alert", 16) + "<span>" + esc(msg) + (extra || "") + "</span></div>"; }
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
      '<p class="muted" style="max-width:420px">' + (g.provider === "RD Originals" ? "This RD Original is in development. Dice and Limbo are live now." : "Third-party games go live once the game aggregator is integrated.") + '</p><a class="btn btn-primary" href="#/game/dice">Play Dice now</a></div></div>' +
      '<div class="section">' + sectionHead("More like this", "", "#/casino/" + g.cat) + '<div class="game-row">' + gamesOf(g.cat).filter(function (x) { return x.id !== g.id; }).map(gameCard).join("") + "</div></div></div>";
  };
  pages.game.after = function (id) { var g = gameOf(id); if (g && g.playable) bindOriginal(g); };

  function originalPage(g) {
    var u = me(), isDice = g.id === "dice";
    var panel = '<div class="og-panel">' +
      '<div class="field"><label>Bet amount</label><div class="og-amount"><span>$</span><input type="number" id="og-amt" min="0" step="0.01" value="1.00"><button data-og="half">½</button><button data-og="double">2×</button></div></div>' +
      '<div class="field"><label>Profit on win</label><div class="og-readonly num" id="og-profit">$0.00</div></div>' +
      '<button class="btn btn-primary btn-block og-bet" id="og-bet">' + (u ? "Bet" : "Sign in to play") + "</button>" +
      '<div id="og-msg" style="margin-top:8px"></div></div>';
    var stage = isDice
      ? '<div class="og-stage"><div class="og-history" id="og-history"></div><div class="og-result num" id="og-result">50.00</div>' +
        '<div><div class="dice-track" id="dice-track" style="--t:50.5%"><div class="dice-bar"><span class="dice-marker hidden" id="dice-marker">0</span></div><input type="range" id="dice-range" min="2" max="98" step="0.5" value="50.5"></div><div class="dice-scale" style="margin-top:12px"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>' +
        '<div class="og-stats"><div class="field"><label>Multiplier</label><input class="input num" id="dice-mult"></div><div class="field"><label id="dice-mode-label">Roll over</label><button class="input num" id="dice-mode" style="text-align:left;cursor:pointer">50.50 ⇄</button></div><div class="field"><label>Win chance</label><input class="input num" id="dice-chance"></div></div></div>'
      : '<div class="og-stage"><div class="og-history" id="og-history"></div><div class="og-result num" id="og-result">1.00×</div>' +
        '<div class="og-stats" style="grid-template-columns:1fr 1fr"><div class="field"><label>Target multiplier</label><input class="input num" id="limbo-target" type="number" min="1.01" step="0.01" value="2.00"></div><div class="field"><label>Win chance</label><input class="input num" id="limbo-chance" readonly></div></div></div>';
    return '<div class="container">' +
      '<div class="row between" style="margin-bottom:14px"><div class="row"><a class="icon-btn" href="#/casino/originals" aria-label="Back">' + ic("chevronLeft") + '</a><div><h2 style="font-size:20px">' + esc(g.name) + '</h2><small class="faint">RD Originals · RTP ' + g.rtp + "%</small></div></div>" +
      '<button class="btn btn-secondary btn-sm" data-action="seeds">' + ic("shield", 16) + "Fairness</button></div>" +
      '<div class="og">' + panel + stage + "</div>" +
      '<div class="og-foot"><span class="faint" style="font-size:12px">Max profit per bet: ' + fmt.usd(MAX_PROFIT, { dec: 0 }) + ". Results are provably fair — verify any bet.</span></div>" +
      '<div class="section">' + sectionHead("My " + g.name + " bets") + '<div class="card" id="og-mybets"></div></div></div>';
  }

  /* Provably fair: HMAC-SHA256(serverSeed, clientSeed:nonce) → float [0,1) */
  function hexOf(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function hmac(key, msg) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      .then(function (k) { return crypto.subtle.sign("HMAC", k, enc.encode(msg)); });
  }
  function sha256(s) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(hexOf); }
  function floatFrom(buf) { var b = new Uint8Array(buf); return b[0] / 256 + b[1] / 65536 + b[2] / 16777216 + b[3] / 4294967296; }
  function outcome(game, f) { return game === "dice" ? Math.floor(f * 10001) / 100 : Math.max(1, Math.floor((0.99 / Math.max(f, 1e-8)) * 100) / 100); }
  RD.fair = { hmac: hmac, sha256: sha256, floatFrom: floatFrom, outcome: outcome };

  function bindOriginal(g) {
    var isDice = g.id === "dice", amt = $("#og-amt"), busy = false, over = true;
    var dr = $("#dice-range");
    function amount() { return Math.max(0, Math.round((parseFloat(amt.value) || 0) * 100) / 100); }
    function params() {
      if (isDice) {
        var t = parseFloat(dr.value), chance = over ? 100 - t : t;
        return { target: t, chance: chance, mult: Math.floor((99 / chance) * 10000) / 10000 };
      }
      var m = Math.max(1.01, Math.min(1000000, parseFloat($("#limbo-target").value) || 1.01));
      return { target: m, chance: 99 / m, mult: m };
    }
    function refresh() {
      var p = params();
      $("#og-profit").textContent = fmt.usd(amount() * (p.mult - 1));
      if (isDice) {
        $("#dice-track").style.setProperty("--t", p.target + "%");
        $("#dice-track").classList.toggle("under", !over);
        $("#dice-mode-label").textContent = over ? "Roll over" : "Roll under";
        $("#dice-mode").textContent = p.target.toFixed(2) + " ⇄";
        if (document.activeElement !== $("#dice-mult")) $("#dice-mult").value = p.mult.toFixed(4);
        if (document.activeElement !== $("#dice-chance")) $("#dice-chance").value = p.chance.toFixed(2);
      } else {
        $("#limbo-chance").value = p.chance.toFixed(4) + "%";
      }
    }
    function myBets() {
      var u = me(), box = $("#og-mybets"); if (!box) return;
      box.innerHTML = u ? betsTable(db.betsOf(u.id).filter(function (b) { return b.game === g.id; }).slice(0, 10), "Place your first bet above.") : empty("Sign in to play", "Create an account and make a test deposit to try " + g.name + ".", '<button class="btn btn-primary btn-sm" data-open="register">Register</button>');
    }
    function history() {
      var u = me(), h = $("#og-history"); if (!u || !h) return;
      h.innerHTML = db.betsOf(u.id).filter(function (b) { return b.game === g.id; }).slice(0, 8).reverse().map(function (b) {
        var v = b.detail && b.detail.result; return '<span class="' + (b.payout > 0 ? "w" : "") + '">' + (isDice ? Number(v).toFixed(2) : Number(v).toFixed(2) + "×") + "</span>";
      }).join("");
    }
    amt.addEventListener("input", refresh);
    $$("[data-og]").forEach(function (b) {
      b.addEventListener("click", function () { var v = amount(); amt.value = (b.getAttribute("data-og") === "half" ? v / 2 : v * 2).toFixed(2); refresh(); });
    });
    if (isDice) {
      dr.addEventListener("input", refresh);
      $("#dice-mode").addEventListener("click", function () { over = !over; dr.value = (100 - parseFloat(dr.value)).toFixed(1); refresh(); });
      $("#dice-mult").addEventListener("change", function () {
        var m = Math.max(1.0102, Math.min(49.5, parseFloat(this.value) || 2)), chance = 99 / m;
        dr.value = (over ? 100 - chance : chance).toFixed(2); refresh();
      });
      $("#dice-chance").addEventListener("change", function () {
        var c = Math.max(2, Math.min(98, parseFloat(this.value) || 49.5));
        dr.value = (over ? 100 - c : c).toFixed(2); refresh();
      });
    } else {
      $("#limbo-target").addEventListener("input", refresh);
    }
    $("#og-bet").addEventListener("click", function () {
      if (busy) return;
      var u = me(); $("#og-msg").innerHTML = "";
      if (!u) return openAuth("register");
      if (u.status !== "Active") { $("#og-msg").innerHTML = errorBox("Your account is suspended."); return; }
      var a = amount(), p = params();
      if (a < 0.01) { $("#og-msg").innerHTML = errorBox("Minimum bet is $0.01."); return; }
      if (a > u.balance) { $("#og-msg").innerHTML = errorBox("Insufficient balance.", ' <a href="#" class="link-sm" data-open="wallet">Deposit</a>'); return; }
      if (a * (p.mult - 1) > MAX_PROFIT) { $("#og-msg").innerHTML = errorBox("Max profit per bet is " + fmt.usd(MAX_PROFIT, { dec: 0 }) + "."); return; }
      busy = true; $("#og-bet").disabled = true;
      var s = db.seeds(u.id);
      hmac(s.server, s.client + ":" + s.nonce).then(function (buf) {
        var res = outcome(g.id, floatFrom(buf));
        var win = isDice ? (over ? res > p.target : res < p.target) : res >= p.target;
        db.placeBet(u.id, g.id, a, p.mult, win, { result: res, target: p.target, mode: isDice ? (over ? "over" : "under") : "target", nonce: s.nonce, client: s.client });
        var el = $("#og-result");
        el.classList.remove("w", "l"); void el.offsetWidth;
        el.textContent = isDice ? res.toFixed(2) : res.toFixed(2) + "×";
        el.classList.add(win ? "w" : "l");
        if (isDice) { var mk = $("#dice-marker"); mk.classList.remove("hidden"); mk.textContent = res.toFixed(2); mk.style.left = res + "%"; }
        renderHeader(); history(); myBets();
        setTimeout(function () { busy = false; var b = $("#og-bet"); if (b) b.disabled = false; }, 250);
      });
    });
    refresh(); history(); myBets();
  }

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
      '<section class="aff-hero">' + media({ img: RD.img.heroAffiliate, c1: "#1d4ed8", c2: "#0a1730" }) + '<div class="shade"></div>' +
        '<div class="copy"><span class="badge" style="background:#fff;color:#0f1923">RDCasino Partners</span><h1 style="margin-top:14px">Refer friends. Earn for life.</h1><p>Up to 50% revenue share, no negative carryover and real-time stats for every link you share.</p>' +
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
      "<h2>How a result is made</h2><ul><li><code>HMAC_SHA256(server_seed, client_seed:nonce)</code></li><li>The first 4 bytes become a number between 0 and 1.</li><li><strong>Dice:</strong> <code>floor(number × 10001) / 100</code> → 0.00 to 100.00</li><li><strong>Limbo:</strong> <code>floor(0.99 / number × 100) / 100</code>, minimum 1.00×</li></ul>" +
      '<h2>Verify a bet</h2><div class="card card-pad"><div class="field"><label>Game</label><select class="select" id="v-game"><option value="dice">Dice</option><option value="limbo">Limbo</option></select></div><div class="field"><label>Server seed (revealed)</label><input class="input" id="v-server"></div><div class="field"><label>Client seed</label><input class="input" id="v-client"></div><div class="field"><label>Nonce</label><input class="input" id="v-nonce" type="number" value="0" min="0"></div><button class="btn btn-primary" data-action="verify">Verify</button><div id="v-out" style="margin-top:16px"></div></div>' +
      '<p class="faint" style="font-size:13px;margin-top:12px">Rotate your seed from the Fairness button inside any RD Original to reveal the server seed used for your past bets.</p></div>';
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
    var banner = u && u.status !== "Active" ? '<div class="container" style="padding-bottom:0"><div class="notice" style="background:var(--danger-soft);border-color:rgba(240,86,106,.3);color:var(--danger)">' + ic("ban", 16) + "<span><strong>Your account is suspended.</strong> Deposits, bets and withdrawals are disabled. Contact support.</span></div></div>" : "";
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
      case "rotate": db.rotateSeed(u.id, ($("#new-client").value || "").trim()); RD.toast("Seeds rotated — previous server seed revealed"); return seedsModal();
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
        var game = $("#v-game").value, sv = $("#v-server").value.trim(), cl = $("#v-client").value.trim(), n = parseInt($("#v-nonce").value, 10) || 0;
        if (!sv || !cl) { $("#v-out").innerHTML = errorBox("Fill in both seeds."); return; }
        Promise.all([hmac(sv, cl + ":" + n), sha256(sv)]).then(function (res) {
          var o = outcome(game, floatFrom(res[0]));
          $("#v-out").innerHTML = '<div class="notice info">' + ic("check", 16) + "<span>Result: <strong>" + (game === "dice" ? o.toFixed(2) : o.toFixed(2) + "×") + "</strong><br>Server seed hash: <code>" + res[1] + "</code></span></div>";
        });
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
