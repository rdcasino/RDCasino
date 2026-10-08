/* ==========================================================================
   RDCasino — Player site (SPA com rotas em hash: #/rota)
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ic = RD.ic, fmt = RD.fmt, esc = RD.esc, media = RD.media;

  /* ---------- State (persistência só para conveniência da demo) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("rd_" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("rd_" + k, JSON.stringify(v)); } catch (e) {} }
  };
  var state = {
    loggedIn: store.get("loggedIn", false),
    campaigns: RD.affiliate.campaigns.slice(),
    walletTab: "deposit",
    coin: "USDT",
    net: "TRC20",
    heroIndex: 0
  };

  /* ---------- Icons in static markup ---------- */
  function hydrateIcons(root) {
    $$("[data-ic]", root).forEach(function (el) { el.outerHTML = ic(el.getAttribute("data-ic")); });
  }

  /* ---------- Sidebar ---------- */
  var NAV = [
    { group: "Casino" },
    { route: "", label: "Lobby", icon: "home" },
    { route: "casino/originals", label: "RD Originals", icon: "star" },
    { route: "casino/slots", label: "Slots", icon: "cherry" },
    { route: "casino/live", label: "Live casino", icon: "play" },
    { route: "casino/gameshows", label: "Game shows", icon: "tv" },
    { group: "Rewards" },
    { route: "promotions", label: "Promotions", icon: "gift" },
    { route: "vip", label: "VIP Club", icon: "crown" },
    { route: "leaderboard", label: "Leaderboard", icon: "trophy" },
    { group: "Platform" },
    { route: "affiliate", label: "Affiliate program", icon: "link", badge: "50%" },
    { route: "fairness", label: "Provably fair", icon: "shield" },
    { route: "responsible", label: "Responsible gaming", icon: "help" }
  ];
  function renderSidebar() {
    var h = "";
    NAV.forEach(function (n) {
      if (n.group) { h += '<div class="sb-group">' + n.group + "</div>"; return; }
      h += '<a class="sb-link" href="#/' + n.route + '" data-route="' + n.route + '">' + ic(n.icon) + "<span>" + n.label + "</span>" +
        (n.badge ? '<span class="badge badge-brand">' + n.badge + "</span>" : "") + "</a>";
    });
    h += '<a class="sb-promo" href="#/leaderboard"><span class="eyebrow">Monthly leaderboard</span><strong>$50,000</strong><small>Ends in <span data-countdown-short></span></small></a>';
    $("#sb-nav").innerHTML = h;
  }
  function markActive(path) {
    var base = path.split("/").slice(0, path.indexOf("casino") === 0 ? 2 : 1).join("/");
    $$(".sb-link").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-route") === base); });
    $$(".sb-switch a").forEach(function (a) { a.classList.toggle("active", (a.getAttribute("data-switch") === "sports") === (base === "sports")); });
    $$(".bottom-nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#/" + path); });
  }

  /* ---------- Auth UI ---------- */
  function renderAuth() {
    $("#hdr-guest").classList.toggle("hidden", state.loggedIn);
    $("#hdr-user").classList.toggle("hidden", !state.loggedIn);
    $("#hdr-bal").textContent = fmt.usd(RD.user.balance);
    $("#user-menu").innerHTML =
      '<div class="menu-head"><strong>' + esc(RD.user.username) + '</strong><small class="faint">' + esc(RD.user.tier) + " · VIP</small></div>" +
      '<a href="#/vip">' + ic("crown", 16) + "VIP Club</a>" +
      '<a href="#/affiliate/overview">' + ic("link", 16) + "Affiliate dashboard</a>" +
      '<button data-open="wallet">' + ic("wallet", 16) + "Wallet</button>" +
      '<a href="#/account">' + ic("settings", 16) + "Settings & security</a>" +
      '<a href="#/responsible">' + ic("help", 16) + "Responsible gaming</a>" +
      '<button class="danger" data-action="logout">' + ic("logout", 16) + "Sign out</button>";
  }
  function login() { state.loggedIn = true; store.set("loggedIn", true); renderAuth(); closeAll(); RD.toast("Welcome back, " + RD.user.username); route(); }
  function logout() { state.loggedIn = false; store.set("loggedIn", false); renderAuth(); closeAll(); location.hash = "#/"; RD.toast("Signed out"); }

  /* ---------- Modals & drawers ---------- */
  function openModal(id) { closeAll(); var m = $("#modal-" + id); if (m) { m.classList.add("open"); document.body.style.overflow = "hidden"; } }
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
  }
  function fillCountries() {
    var list = ["Select…", "Argentina", "Austria", "Brazil", "Canada", "Chile", "Colombia", "Finland", "Germany", "India", "Ireland", "Japan", "Mexico", "New Zealand", "Norway", "Peru", "Portugal", "Turkey", "United Arab Emirates", "United Kingdom", "United States", "Other"];
    $("#reg-country").innerHTML = list.map(function (c, i) { return "<option" + (i === 0 ? ' value=""' : "") + ">" + c + "</option>"; }).join("");
  }
  function isRestricted(country) {
    return RD.config.restrictedCountries.some(function (r) { return r.toLowerCase() === String(country).toLowerCase(); });
  }

  /* ---------- Wallet ---------- */
  function coin() { return RD.wallet.coins.filter(function (c) { return c.sym === state.coin; })[0]; }
  function renderWallet() {
    $$("#wallet-tabs .tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-wtab") === state.walletTab); });
    var c = coin(); if (c.nets.indexOf(state.net) < 0) state.net = c.nets[0];
    var coins = '<div class="coin-select">' + RD.wallet.coins.map(function (x) {
      return '<button class="coin-opt' + (x.sym === state.coin ? " active" : "") + '" data-coin="' + x.sym + '"><span class="coin-dot" style="background:' + x.color + '">' + x.sym[0] + "</span>" + x.sym + "</button>";
    }).join("") + "</div>";
    var nets = '<div class="field"><label>Network</label><div class="net-row">' + c.nets.map(function (n) {
      return '<button class="chip' + (n === state.net ? " active" : "") + '" data-net="' + n + '">' + n + "</button>";
    }).join("") + "</div></div>";
    var h = "";
    if (state.walletTab === "deposit") {
      h = coins + nets +
        '<div class="field"><label>Your ' + c.sym + " deposit address (" + state.net + ')</label><div class="copy-field"><code>' + RD.wallet.demoAddress + '</code><button class="btn btn-secondary btn-sm" data-copy="' + RD.wallet.demoAddress + '">' + ic("copy", 14) + "Copy</button></div></div>" +
        '<div class="qr">' + fakeQR() + "</div>" +
        '<div class="notice">' + ic("alert", 16) + "<span>Send only " + c.sym + " on the " + state.net + " network. Funds sent on another network can't be recovered. Credited after 1 confirmation.</span></div>" +
        '<div class="wallet-foot">' + ic("shield", 14) + "Demo address — not a real wallet</div>";
    } else if (state.walletTab === "withdraw") {
      h = coins + nets +
        '<div class="field"><label>Destination address</label><input class="input" placeholder="Paste your ' + c.sym + ' address"></div>' +
        '<div class="field"><label>Amount</label><div class="input-group"><input type="number" min="0" step="0.01" placeholder="0.00" id="wd-amt"><button class="btn btn-ghost btn-sm" id="wd-max">Max</button></div><span class="hint">Available: ' + fmt.usd(c.bal) + " · Network fee shown before confirming</span></div>" +
        '<button class="btn btn-primary btn-block btn-lg" data-action="withdraw">Request withdrawal</button>' +
        '<div class="wallet-foot">' + ic("lock", 14) + "Withdrawals require 2FA. Large amounts may need KYC.</div>";
    } else {
      h = '<div class="field"><label>Recipient username</label><input class="input" placeholder="@username"></div>' + coins +
        '<div class="field"><label>Amount</label><div class="input-group"><input type="number" min="0" step="0.01" placeholder="0.00"><span class="faint" style="padding-right:8px">' + c.sym + "</span></div></div>" +
        '<label class="check" style="margin-bottom:16px"><input type="checkbox"> <span>Send publicly in chat</span></label>' +
        '<button class="btn btn-primary btn-block btn-lg" data-action="tip">Send tip</button>';
    }
    $("#wallet-body").innerHTML = h;
  }
  function fakeQR() {
    var s = "", seed = 7;
    for (var y = 0; y < 21; y++) for (var x = 0; x < 21; x++) {
      var finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      var on;
      if (finder) { var fx = x > 13 ? x - 14 : x, fy = y > 13 ? y - 14 : y; on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5); }
      else { seed = (seed * 9301 + 49297) % 233280; on = seed / 233280 > 0.5; }
      if (on) s += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 21 21" width="100%" height="100%" fill="#0a0d13" shape-rendering="crispEdges">' + s + "</svg>";
  }

  /* ---------- Search ---------- */
  function search(q) {
    var pop = $("#search-pop");
    q = q.trim().toLowerCase();
    if (q.length < 2) { pop.classList.add("hidden"); return; }
    var res = RD.games.filter(function (g) { return g.name.toLowerCase().indexOf(q) > -1 || g.provider.toLowerCase().indexOf(q) > -1; }).slice(0, 8);
    pop.innerHTML = res.length ? res.map(function (g) {
      return '<a class="search-item" href="#/game/' + g.id + '">' + media(g, "", "") + "<div><strong>" + esc(g.name) + "</strong><small>" + esc(g.provider) + "</small></div></a>";
    }).join("") : '<div class="empty" style="padding:24px">No games found for “' + esc(q) + "”</div>";
    pop.classList.remove("hidden");
  }

  /* ---------- Shared fragments ---------- */
  function gameCard(g) {
    var tag = g.tag === "hot" ? '<span class="badge badge-danger g-tag">Hot</span>' : g.tag === "new" ? '<span class="badge badge-brand g-tag">New</span>' : "";
    return '<a class="game" href="#/game/' + g.id + '">' + tag +
      media(g, "", '<span class="gf-name">' + esc(g.name) + '</span><span class="gf-prov">' + esc(g.provider) + "</span>") +
      '<span class="g-play"><span>' + ic("play", 26) + "</span></span>" +
      '<div class="game-meta"><strong>' + esc(g.name) + "</strong><small>" + esc(g.provider) + "</small></div></a>";
  }
  function gamesOf(cat) { return RD.games.filter(function (g) { return g.enabled && (cat === "all" || g.cat === cat); }); }
  function sectionHead(title, icon, link) {
    return '<div class="section-head"><h2>' + (icon ? ic(icon, 18) : "") + title + "</h2>" + (link ? '<a class="see-all" href="' + link + '">View all' + ic("chevronRight") + "</a>" : "") + "</div>";
  }
  function heroBlock(b, cls) {
    return '<a class="' + cls + '" href="#/' + b.route + '">' + media(b, "", "") + '<div class="hero-shade"></div><div class="hero-copy"><span class="badge">' + esc(b.tag) + "</span><h1>" + esc(b.title) + "</h1><p>" + esc(b.sub) + "</p>" +
      (cls === "hero-main" ? '<div class="row"><span class="btn btn-primary btn-lg">' + esc(b.cta) + "</span></div>" : "") + "</div></a>";
  }

  /* ---------- Pages ---------- */
  var pages = {};

  pages.home = function () {
    var b = RD.banners;
    var trust = [
      ["bolt", "Instant withdrawals", "Most crypto payouts in minutes"],
      ["shield", "Provably fair", "Verify every Originals result"],
      ["lock", "2FA & cold storage", "Your account, protected"],
      ["chat", "24/7 live support", "Real people, any time"]
    ];
    return '<div class="container">' +
      '<div class="hero">' + heroBlock(b[0], "hero-main") +
        '<div class="hero-side-col">' + heroBlock(b[1], "hero-side") + heroBlock(b[2], "hero-side") + "</div></div>" +
      '<div class="trust">' + trust.map(function (t) { return '<div class="trust-item"><span class="ti">' + ic(t[0], 18) + "</span><div><strong>" + t[1] + "</strong><small>" + t[2] + "</small></div></div>"; }).join("") + "</div>" +
      '<div class="section"><div class="chips">' + RD.categories.map(function (c, i) { return '<a class="chip' + (i === 0 ? " active" : "") + '" href="#/casino/' + c.id + '">' + c.label + "</a>"; }).join("") + "</div></div>" +
      '<div class="section">' + sectionHead("RD Originals", "star", "#/casino/originals") + '<div class="game-row">' + gamesOf("originals").map(gameCard).join("") + "</div></div>" +
      '<div class="section">' + sectionHead("Popular slots", "cherry", "#/casino/slots") + '<div class="game-row">' + gamesOf("slots").map(gameCard).join("") + "</div></div>" +
      '<div class="section">' + sectionHead("Live casino", "play", "#/casino/live") + '<div class="game-row">' + gamesOf("live").concat(gamesOf("gameshows")).map(gameCard).join("") + "</div></div>" +
      '<div class="section activity">' + sectionHead("Latest bets", "chart") +
        '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Game</th><th>Player</th><th class="right">Bet</th><th class="right">Multiplier</th><th class="right">Payout</th></tr></thead><tbody id="feed"></tbody></table></div></div>' +
        '<p class="demo-note" style="margin-top:8px">Demo data. In production this feed must come from real bets.</p></div>' +
      "</div>";
  };
  pages.home.after = function () { startFeed(); startHero(); };

  pages.casino = function (cat) {
    cat = cat || "all";
    var c = RD.categories.filter(function (x) { return x.id === cat; })[0] || RD.categories[0];
    var providers = {}; gamesOf(cat).forEach(function (g) { providers[g.provider] = 1; });
    return '<div class="container"><div class="page-head"><h1>' + c.label + "</h1><p>" + gamesOf(cat).length + " games</p></div>" +
      '<div class="row wrap" style="margin-bottom:18px;gap:10px"><div class="chips grow">' + RD.categories.map(function (x) { return '<a class="chip' + (x.id === cat ? " active" : "") + '" href="#/casino/' + x.id + '">' + x.label + "</a>"; }).join("") + "</div>" +
      '<select class="select" id="prov-filter" style="width:200px;height:36px"><option value="">All providers</option>' + Object.keys(providers).map(function (p) { return "<option>" + esc(p) + "</option>"; }).join("") + "</select></div>" +
      '<div class="game-grid" id="cat-grid">' + gamesOf(cat).map(gameCard).join("") + "</div></div>";
  };
  pages.casino.after = function (cat) {
    var sel = $("#prov-filter");
    sel && sel.addEventListener("change", function () {
      var list = gamesOf(cat || "all").filter(function (g) { return !sel.value || g.provider === sel.value; });
      $("#cat-grid").innerHTML = list.map(gameCard).join("");
    });
  };

  pages.game = function (id) {
    var g = RD.games.filter(function (x) { return x.id === id; })[0];
    if (!g) return pages.notfound();
    var related = gamesOf(g.cat).filter(function (x) { return x.id !== g.id; }).slice(0, 8);
    return '<div class="container">' +
      '<div class="row" style="margin-bottom:14px"><a class="btn btn-ghost btn-sm" href="#/casino/' + g.cat + '">' + ic("chevronLeft", 16) + "Back</a></div>" +
      '<div class="game-frame">' + media(g, "", "") +
        '<div class="game-frame-cta"><h2>' + esc(g.name) + '</h2><p class="muted">' + esc(g.provider) + "</p>" +
        (state.loggedIn ? '<div class="row"><button class="btn btn-primary btn-lg" data-action="play-real">' + ic("play", 18) + 'Play for real</button><button class="btn btn-secondary btn-lg" data-action="play-demo">Demo</button></div>'
                        : '<div class="row"><button class="btn btn-primary btn-lg" data-open="register">Create account to play</button><button class="btn btn-secondary btn-lg" data-action="play-demo">Try demo</button></div>') +
        '<small class="faint">Game iframe loads here once the provider/aggregator is integrated.</small></div></div>' +
      '<div class="game-bar"><div><h3>' + esc(g.name) + '</h3><small class="faint">' + esc(g.provider) + "</small></div>" +
        '<div class="row"><span class="badge">RTP ' + g.rtp + "%</span>" + (g.cat === "originals" ? '<a class="badge badge-brand" href="#/fairness">' + ic("shield", 12) + "Provably fair</a>" : "") + "</div></div>" +
      '<div class="section">' + sectionHead("More like this", "", "#/casino/" + g.cat) + '<div class="game-row">' + related.map(gameCard).join("") + "</div></div></div>";
  };

  pages.promotions = function () {
    return '<div class="container"><div class="page-head"><h1>Promotions</h1><p>Clear terms, no hidden conditions. Read the rules before you opt in.</p></div>' +
      '<div class="promo-grid">' + RD.promotions.filter(function (p) { return p.status !== "draft"; }).map(function (p) {
        return '<div class="card promo">' + media(p, "", esc(p.title)) +
          '<div class="promo-body"><div class="row between"><span class="badge">' + esc(p.badge) + "</span>" + (p.status === "scheduled" ? '<span class="badge badge-info">Coming soon</span>' : "") + "</div>" +
          "<h3>" + esc(p.title) + '</h3><div class="promo-value">' + esc(p.value) + "</div><p>" + esc(p.desc) + "</p>" +
          '<div class="promo-foot"><button class="btn btn-primary btn-sm grow" data-action="claim">Claim</button><button class="btn btn-secondary btn-sm" data-action="terms">Terms</button></div></div></div>';
      }).join("") + "</div>" +
      '<div class="notice info" style="margin-top:24px">' + ic("help", 16) + "<span>Bonus funds are subject to wagering requirements. Max bet while wagering: $5. You can forfeit an active bonus at any time from your wallet.</span></div></div>";
  };

  pages.vip = function () {
    var cur = RD.vipTiers.map(function (t) { return t.name; }).indexOf(RD.user.tier);
    var next = RD.vipTiers[cur + 1];
    var pct = next ? Math.min(100, Math.round((RD.user.wagered / next.wager) * 100)) : 100;
    var benefits = [["bolt", "Instant rakeback", "A share of the house edge back on every bet."], ["gift", "Level-up rewards", "One-time cash reward on every new tier."], ["clock", "Weekly & monthly bonus", "Calculated on your activity, no wagering."], ["user", "Dedicated host", "From Platinum: a personal VIP manager."], ["bolt", "Faster withdrawals", "Priority queue and higher limits."], ["star", "Exclusive events", "Private tournaments and giveaways."]];
    return '<div class="container"><div class="page-head"><h1>VIP Club</h1><p>Every dollar wagered counts toward your next level. No opt-in.</p></div>' +
      '<div class="card vip-card"><div class="row" style="gap:16px;align-items:flex-start"><div class="vip-tier-badge">' + ic("crown", 26) + '</div><div class="grow"><span class="eyebrow">Your level</span><h2>' + (state.loggedIn ? esc(RD.user.tier) : "Sign in to see your level") + "</h2>" +
        (state.loggedIn && next ? '<div class="tier-progress"><div class="row between" style="font-size:13px;margin-bottom:8px"><span class="muted">' + fmt.usd(RD.user.wagered, { dec: 0 }) + " wagered</span><strong>" + pct + '%</strong></div><div class="progress"><span style="width:' + pct + '%"></span></div><small class="faint">' + fmt.usd(next.wager - RD.user.wagered, { dec: 0 }) + " to " + next.name + "</small></div>" : "") +
        "</div></div>" +
        '<div class="row" style="align-items:stretch;gap:10px"><div class="kpi grow"><div class="kpi-label">Rakeback ready</div><div class="kpi-value">' + (state.loggedIn ? "$12.40" : "—") + '</div><button class="btn btn-primary btn-sm" style="margin-top:10px" data-action="claim">Claim</button></div>' +
        '<div class="kpi grow"><div class="kpi-label">Next reward</div><div class="kpi-value">' + (next ? fmt.usd(next.reward, { dec: 0 }) : "—") + '</div><small class="faint">at ' + (next ? next.name : "max level") + "</small></div></div></div>" +
      '<div class="section">' + sectionHead("Levels & rewards", "crown") + '<div class="tier-grid">' + RD.vipTiers.map(function (t, i) {
        return '<div class="card tier' + (state.loggedIn && i === cur ? " current" : "") + '" style="--tc:' + t.color + '"><h3>' + t.name + '</h3><small class="faint">' + fmt.compact(t.wager) + ' wagered</small><div class="tv">' + fmt.usd(t.reward, { dec: 0 }) + '</div><small class="faint">level-up reward</small></div>';
      }).join("") + "</div></div>" +
      '<div class="section">' + sectionHead("Benefits", "gift") + '<div class="benefits">' + benefits.map(function (b) { return '<div class="card benefit"><div class="ti">' + ic(b[0]) + "</div><h3>" + b[1] + "</h3><p>" + b[2] + "</p></div>"; }).join("") + "</div></div></div>";
  };

  pages.leaderboard = function () {
    var L = RD.leaderboard, top = [L[1], L[0], L[2]], heights = [80, 110, 60], colors = ["#aab4c3", "#e6b450", "#b87a4b"];
    return '<div class="container"><div class="page-head"><h1>Monthly leaderboard</h1><p>Ranked by total wagered this calendar month (UTC). Prizes paid automatically.</p></div>' +
      '<div class="lb-hero"><div class="card lb-pool"><span class="eyebrow">Prize pool</span><div class="big">$50,000</div><p class="muted">Top 100 players get paid · Paid in USDT within 24h of close</p>' +
        '<div class="countdown"><div><strong data-cd="d">00</strong><small>days</small></div><div><strong data-cd="h">00</strong><small>hours</small></div><div><strong data-cd="m">00</strong><small>min</small></div><div><strong data-cd="s">00</strong><small>sec</small></div></div></div>' +
        '<div class="card podium">' + top.map(function (p, i) {
          return '<div class="podium-col"><div class="avatar" style="background:' + colors[i] + ';color:#111">' + p.user.slice(0, 2).toUpperCase() + '</div><div style="font-weight:600;font-size:13px">' + esc(p.user) + '</div><div class="faint" style="font-size:12px">' + fmt.usd(p.prize, { dec: 0 }) + '</div><div class="step" style="height:' + heights[i] + "px;background:" + colors[i] + '22;color:' + colors[i] + '">' + p.rank + "</div></div>";
        }).join("") + "</div></div>" +
      '<div class="section"><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Rank</th><th>Player</th><th class="right">Wagered</th><th class="right">Prize</th></tr></thead><tbody>' +
        L.map(function (p) { return '<tr><td><span class="rank-pill">' + p.rank + '</span></td><td class="strong">' + esc(p.user) + '</td><td class="right num">' + fmt.usd(p.wagered, { dec: 0 }) + '</td><td class="right num strong">' + fmt.usd(p.prize, { dec: 0 }) + "</td></tr>"; }).join("") +
        (state.loggedIn ? '<tr style="background:var(--brand-soft)"><td><span class="rank-pill">247</span></td><td class="strong">' + esc(RD.user.username) + ' (you)</td><td class="right num">' + fmt.usd(RD.user.wagered, { dec: 0 }) + '</td><td class="right faint">—</td></tr>' : "") +
      "</tbody></table></div></div></div></div>";
  };

  /* ---------- Affiliate ---------- */
  var A = RD.affiliate;
  pages.affiliate = function (tab) {
    if (tab && tab !== "program") {
      if (!state.loggedIn) { setTimeout(function () { openAuth("login"); }, 0); return affLanding(); }
      return affDashboard(tab);
    }
    return affLanding();
  };
  pages.affiliate.after = function (tab) {
    if (!tab || tab === "program" || !state.loggedIn) return bindCalc();
    if (tab === "referrals") bindReferralFilters();
  };

  function affLanding() {
    var faqs = [
      ["How is commission calculated?", "You earn a percentage of the Net Gaming Revenue (NGR) of every player you refer: bets minus wins, minus bonuses, minus payment and provider fees. Your tier is based on new depositing players (FTDs) per month."],
      ["Is there negative carryover?", "No. If a month closes negative, it resets to zero the next month. You never owe us anything."],
      ["When and how do I get paid?", "Commissions are calculated daily and available for withdrawal every Monday, in USDT, BTC or ETH. Minimum withdrawal: $50."],
      ["Can I get a custom deal?", "Yes. Streamers, media sites and communities with proven traffic can request CPA, hybrid or custom revenue share deals through their account manager."],
      ["Which traffic is not allowed?", "Brand bidding on paid search, incentivized traffic, spam, and any traffic from restricted countries. Players from restricted territories are not eligible and generate no commission."]
    ];
    var cur = state.loggedIn ? A.currentTier : 0;
    return '<div class="container">' +
      '<section class="aff-hero">' + media({ img: RD.img.heroAffiliate, c1: "#10284a", c2: "#0a0f18" }) + '<div class="hero-shade"></div>' +
        '<div class="hero-copy"><span class="badge">RDCasino Partners</span><h1>Turn your audience into lifetime revenue</h1><p>Up to 50% revenue share, no negative carryover and weekly crypto payouts. Real-time stats for every link you share.</p>' +
        '<div class="row wrap">' + (state.loggedIn ? '<a class="btn btn-primary btn-lg" href="#/affiliate/overview">Open dashboard' + ic("arrowUpRight", 16) + "</a>" : '<button class="btn btn-primary btn-lg" data-open="register">Become a partner</button><button class="btn btn-secondary btn-lg" data-open="login">Sign in</button>') + "</div>" +
        '<div class="aff-hero-stats"><div><strong>50%</strong><small>max revenue share</small></div><div><strong>$0</strong><small>negative carryover</small></div><div><strong>Weekly</strong><small>crypto payouts</small></div></div></div></section>' +

      '<div class="section">' + sectionHead("How it works") + '<div class="steps">' +
        [["Get your link", "Create an account and generate tracking links and codes for each channel you promote on."], ["Share with your audience", "Use our banners and copy. Every player who signs up through you is tied to you for life."], ["Earn every week", "Get a share of the revenue your players generate, paid every Monday in crypto."]].map(function (s, i) {
          return '<div class="card step"><div class="step-n">' + (i + 1) + "</div><h3>" + s[0] + "</h3><p>" + s[1] + "</p></div>";
        }).join("") + "</div></div>" +

      '<div class="section">' + sectionHead("Commission tiers") + '<div class="plan-grid">' + A.plans.map(function (p) {
        return '<div class="card plan' + (p.tier === cur ? " current" : "") + '"><span class="eyebrow">' + p.label + '</span><div class="share">' + p.share + '%</div><small>' + p.range + "</small>" + (p.tier === cur ? '<div style="margin-top:10px"><span class="badge badge-brand">Your tier</span></div>' : "") + "</div>";
      }).join("") + '</div><p class="faint" style="font-size:12px;margin-top:10px">Tier is recalculated on the 1st of each month based on new depositing players (FTDs) of the previous month.</p></div>' +

      '<div class="section">' + sectionHead("Earnings calculator", "calc") + '<div class="card calc"><div class="calc-in">' +
        rangeRow("players", "New depositing players / month", 1, 200, 20, "") +
        rangeRow("deposit", "Average monthly deposit per player", 20, 2000, 250, "$") +
        rangeRow("months", "Months", 1, 24, 12, "") +
        '<small class="faint">Estimate assumes ~35% of deposits become NGR and 60% monthly player retention. Real results vary.</small></div>' +
        '<div class="calc-out"><span class="eyebrow">Estimated commission</span><div class="big num" id="calc-total">$0</div><div class="muted" id="calc-detail"></div></div></div></div>' +

      '<div class="section">' + sectionHead("Questions") + '<div class="card faq">' + faqs.map(function (f) { return "<details><summary>" + f[0] + ic("chevronDown", 16) + "</summary><p>" + f[1] + "</p></details>"; }).join("") + "</div></div>" +

      '<div class="section"><div class="card cta-band"><div><h2>Have a bigger audience?</h2><p class="muted">Talk to our partnerships team about CPA, hybrid or custom deals.</p></div><a class="btn btn-primary btn-lg" href="mailto:' + RD.config.supportEmail + '?subject=Partnership">Contact partnerships</a></div></div>' +
      "</div>";
  }
  function rangeRow(id, label, min, max, val, pre) {
    return '<div class="range-row"><div class="row"><span class="muted">' + label + '</span><strong id="v-' + id + '">' + pre + val + '</strong></div><input type="range" id="r-' + id + '" min="' + min + '" max="' + max + '" value="' + val + '" data-pre="' + pre + '"></div>';
  }
  function bindCalc() {
    var r = ["players", "deposit", "months"].map(function (k) { return $("#r-" + k); });
    if (!r[0]) return;
    function calc() {
      r.forEach(function (el) { $("#v-" + el.id.slice(2)).textContent = el.getAttribute("data-pre") + Number(el.value).toLocaleString("en-US"); });
      var newP = +r[0].value, dep = +r[1].value, months = +r[2].value;
      var share = A.plans.filter(function (p) { var m = p.range.match(/(\d+)/g); return newP >= +m[0] && (!m[1] || newP <= +m[1]); })[0] || A.plans[0];
      var active = 0, total = 0;
      for (var i = 0; i < months; i++) { active = active * 0.6 + newP; total += active * dep * 0.35 * (share.share / 100); }
      $("#calc-total").textContent = fmt.usd(total, { dec: 0 });
      $("#calc-detail").textContent = "at " + share.share + "% (" + share.label + ") · ~" + fmt.usd(total / months, { dec: 0 }) + " / month";
    }
    r.forEach(function (el) { el.addEventListener("input", calc); });
    calc();
  }

  var AFF_TABS = [["overview", "Overview"], ["campaigns", "Campaigns"], ["referrals", "Referred players"], ["earnings", "Earnings & payouts"], ["assets", "Marketing assets"], ["settings", "Settings"]];
  function affDashboard(tab) {
    var valid = AFF_TABS.some(function (t) { return t[0] === tab; }); if (!valid) tab = "overview";
    var s = A.stats, plan = A.plans[A.currentTier - 1], nextPlan = A.plans[A.currentTier];
    var head = '<div class="aff-head"><div><span class="eyebrow">Affiliate dashboard</span><h1>Partner overview</h1></div>' +
      '<div class="row"><a class="btn btn-ghost btn-sm" href="#/affiliate/program">Program details</a><button class="btn btn-primary btn-sm" data-action="new-campaign">' + ic("plus", 16) + "New campaign</button></div></div>" +
      '<div class="card balance-card"><div><div class="kpi-label">Available</div><div class="kpi-value num pos">' + fmt.usd(s.available) + '</div></div><div><div class="kpi-label">Pending (this week)</div><div class="kpi-value num">' + fmt.usd(s.pending) + '</div></div><div><div class="kpi-label">Paid to date</div><div class="kpi-value num">' + fmt.usd(s.paid) + '</div></div><div><button class="btn btn-primary" data-action="aff-withdraw">' + ic("arrowUp", 16) + "Withdraw</button></div></div>" +
      '<div class="tabs aff-tabs" style="margin-top:20px">' + AFF_TABS.map(function (t) { return '<a class="tab' + (t[0] === tab ? " active" : "") + '" href="#/affiliate/' + t[0] + '">' + t[1] + "</a>"; }).join("") + "</div>";
    var body = "";

    if (tab === "overview") {
      var link = A.baseUrl + A.code;
      body = '<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Clicks</div><div class="kpi-value num">' + fmt.int(s.clicks) + '</div></div><div class="kpi"><div class="kpi-label">Sign-ups</div><div class="kpi-value num">' + fmt.int(s.signups) + '</div><div class="kpi-delta faint">' + ((s.signups / s.clicks) * 100).toFixed(1) + '% of clicks</div></div><div class="kpi"><div class="kpi-label">First deposits (FTD)</div><div class="kpi-value num">' + s.ftds + '</div><div class="kpi-delta pos">+4 vs last month</div></div><div class="kpi"><div class="kpi-label">NGR (lifetime)</div><div class="kpi-value num">' + fmt.usd(s.ngr, { dec: 0 }) + "</div></div></div>" +
        '<div class="grid-2" style="margin-top:16px"><div class="card"><div class="card-head"><h3>Commission — last 30 days</h3><span class="badge badge-brand">' + fmt.usd(A.daily.reduce(function (a, d) { return a + d.commission; }, 0)) + '</span></div><div class="card-pad">' + RD.bars(A.daily, "commission", function (v) { return fmt.usd(v); }) + "</div></div>" +
        '<div class="card link-box"><h3>Your main link</h3><p class="faint" style="font-size:13px;margin:4px 0 12px">Players who sign up through it are linked to you for life.</p><div class="copy-field"><code>' + link + '</code><button class="btn btn-secondary btn-sm" data-copy="' + link + '">' + ic("copy", 14) + 'Copy</button></div>' +
          '<div class="row" style="margin-top:10px"><span class="faint" style="font-size:13px">Code</span><span class="badge">' + A.code + '</span><button class="btn btn-ghost btn-sm" data-copy="' + A.code + '">' + ic("copy", 14) + "</button></div>" +
          '<div class="divider"></div><div class="row between"><div><span class="eyebrow">Current tier</span><h3>' + plan.label + " · " + plan.share + "%</h3></div>" + (nextPlan ? '<span class="badge">Next: ' + nextPlan.share + "%</span>" : "") + "</div>" +
          (nextPlan ? '<div class="tier-progress"><div class="progress"><span style="width:' + Math.round((s.ftds / 26) * 100) + '%"></span></div><small class="faint">' + s.ftds + " of 26 FTDs this month to reach " + nextPlan.label + "</small></div>" : "") + "</div></div>" +
        '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Funnel — this month</h3></div><div class="funnel"><div><small>Clicks</small><strong>' + fmt.int(1240) + '</strong></div><div><small>Sign-ups</small><strong>86</strong><em>6.9%</em></div><div><small>First deposits</small><strong>' + s.ftds + '</strong><em>20.9%</em></div><div><small>Active players</small><strong>' + s.activePlayers + "</strong></div></div></div>" +
        '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Top campaigns</h3><a class="see-all" href="#/affiliate/campaigns">All campaigns' + ic("chevronRight") + "</a></div>" + campaignTable(state.campaigns.slice(0, 3)) + "</div>";
    }

    if (tab === "campaigns") {
      body = '<div class="card"><div class="card-head"><div><h3>Campaigns</h3><small class="faint">One code per channel lets you see what converts.</small></div><button class="btn btn-primary btn-sm" data-action="new-campaign">' + ic("plus", 16) + "New campaign</button></div>" + campaignTable(state.campaigns) + "</div>";
    }

    if (tab === "referrals") {
      body = '<div class="card"><div class="toolbar"><div class="input-search">' + ic("search") + '<input class="input" id="ref-q" placeholder="Search player"></div>' +
        '<select class="select" id="ref-status" style="width:170px"><option value="">All statuses</option><option>Active</option><option>Inactive</option><option>No deposit</option></select>' +
        '<select class="select" id="ref-camp" style="width:220px"><option value="">All campaigns</option>' + state.campaigns.map(function (c) { return "<option>" + esc(c.name) + "</option>"; }).join("") + "</select>" +
        '<button class="btn btn-secondary btn-sm" data-action="export" style="margin-left:auto">' + ic("download", 16) + "Export CSV</button></div>" +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Player</th><th>Campaign</th><th>Joined</th><th class="right">Deposits</th><th class="right">Wagered</th><th class="right">NGR</th><th>Status</th></tr></thead><tbody id="ref-body"></tbody></table></div></div>' +
        '<p class="faint" style="font-size:12px;margin-top:8px">Usernames are masked to protect player privacy.</p>';
    }

    if (tab === "earnings") {
      body = '<div class="grid-2"><div class="card"><div class="card-head"><h3>Daily commission</h3><div class="segmented"><button class="active">30d</button><button>90d</button><button>YTD</button></div></div><div class="card-pad">' + RD.bars(A.daily, "commission", function (v) { return fmt.usd(v); }) + "</div></div>" +
        '<div class="card card-pad"><h3>How this week is calculated</h3><div class="stack" style="margin-top:14px;font-size:13px">' +
          [["Gross gaming revenue", 4280.4], ["Bonuses & rakeback", -1120.0], ["Payment & provider fees (est.)", -293.7]].map(function (r) { return '<div class="row between"><span class="muted">' + r[0] + '</span><span class="num ' + (r[1] < 0 ? "neg" : "") + '">' + fmt.usd(r[1]) + "</span></div>"; }).join("") +
          '<div class="divider" style="margin:6px 0"></div><div class="row between"><span>Net gaming revenue</span><strong class="num">' + fmt.usd(2866.7) + '</strong></div><div class="row between"><span>Your share (' + plan.share + '%)</span><strong class="num pos">' + fmt.usd(860.01) + "</strong></div></div>" +
          '<button class="btn btn-primary btn-block" style="margin-top:18px" data-action="aff-withdraw">Withdraw ' + fmt.usd(s.available) + "</button></div></div>" +
        '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Payout history</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Date</th><th>Coin</th><th class="right">Amount</th><th>Status</th><th>Transaction</th></tr></thead><tbody>' +
          A.payouts.map(function (p) { return '<tr><td class="strong">' + p.id + "</td><td>" + p.date + "</td><td>" + p.coin + '</td><td class="right num strong">' + fmt.usd(p.amount) + '</td><td><span class="badge badge-brand">' + p.status + '</span></td><td><a class="see-all" href="#">' + p.tx + ic("external", 12) + "</a></td></tr>"; }).join("") +
        "</tbody></table></div></div>";
    }

    if (tab === "assets") {
      body = '<div class="notice info" style="margin-bottom:16px">' + ic("image", 16) + "<span>Every banner already includes your tracking link when you copy the embed code. Use only these official assets — don't edit the bonus terms shown.</span></div>" +
        '<div class="asset-grid">' + A.assets.map(function (a) {
          var code = '<a href="' + A.baseUrl + A.code + '"><img src="https://rdcasino.example/' + a.img + '" alt="RDCasino"></a>';
          return '<div class="card asset">' + media(a, "", "<span>" + a.name + '</span><small style="opacity:.6;font-size:12px">' + a.size + "</small>") + '<div class="asset-body"><div><strong style="font-size:13px">' + a.name + '</strong><br><small class="faint">' + a.size + '</small></div><div class="row" style="gap:6px"><button class="btn btn-secondary btn-sm btn-icon" title="Copy embed code" data-copy="' + esc(code) + '">' + ic("copy", 14) + '</button><a class="btn btn-secondary btn-sm btn-icon" title="Download" href="' + a.img + '" download>' + ic("download", 14) + "</a></div></div></div>";
        }).join("") + "</div>" +
        '<div class="section">' + sectionHead("Ready-to-use copy") + '<div class="card card-pad stack">' +
          ["New here? RDCasino doubles your first crypto deposit up to $1,000. Use code " + A.code + " → " + A.baseUrl + A.code, "Instant crypto withdrawals + provably fair originals. Sign up with my code " + A.code + "."].map(function (t) {
            return '<div class="copy-field"><code style="white-space:normal">' + esc(t) + '</code><button class="btn btn-secondary btn-sm" data-copy="' + esc(t) + '">' + ic("copy", 14) + "Copy</button></div>";
          }).join("") + '<p class="faint" style="font-size:12px">Always add “18+ | Play responsibly” where the platform allows it.</p></div></div>';
    }

    if (tab === "settings") {
      body = '<div class="grid-2"><div class="card card-pad"><h3 style="margin-bottom:16px">Payout details</h3>' +
        '<div class="field"><label>Payout coin</label><select class="select"><option>USDT (TRC20)</option><option>USDT (ERC20)</option><option>BTC</option><option>ETH</option></select></div>' +
        '<div class="field"><label>Wallet address</label><input class="input" placeholder="Your payout address"><span class="hint">Changes require email confirmation and lock payouts for 48h.</span></div>' +
        '<div class="field"><label>Minimum auto-payout</label><select class="select"><option>$50</option><option>$100</option><option>$500</option><option>Manual only</option></select></div>' +
        '<button class="btn btn-primary" data-action="save">Save changes</button></div>' +
        '<div class="card card-pad"><h3 style="margin-bottom:16px">Profile & notifications</h3>' +
        '<div class="field"><label>Website or channel</label><input class="input" placeholder="https://"></div>' +
        '<div class="field"><label>Telegram for your account manager</label><input class="input" placeholder="@handle"></div>' +
        ["New first deposit", "Weekly earnings summary", "Tier changes"].map(function (n) { return '<div class="row between" style="padding:8px 0"><span class="muted">' + n + '</span><label class="switch"><input type="checkbox" checked><span></span></label></div>'; }).join("") +
        "</div></div>";
    }
    return '<div class="container">' + head + body + "</div>";
  }
  function campaignTable(list) {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Campaign</th><th>Code</th><th class="right">Clicks</th><th class="right">Sign-ups</th><th class="right">FTDs</th><th class="right">NGR</th><th class="right">Commission</th><th></th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr><td class="strong">' + esc(c.name) + '<br><small class="faint">since ' + c.created + '</small></td><td><span class="badge">' + esc(c.code) + '</span></td><td class="right num">' + fmt.int(c.clicks) + '</td><td class="right num">' + c.signups + '</td><td class="right num">' + c.ftds + '</td><td class="right num">' + fmt.usd(c.ngr) + '</td><td class="right num strong pos">' + fmt.usd(c.commission) + '</td><td class="right"><button class="btn btn-secondary btn-sm" data-copy="' + A.baseUrl + esc(c.code) + '">' + ic("copy", 14) + "Link</button></td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function bindReferralFilters() {
    var q = $("#ref-q"), st = $("#ref-status"), cp = $("#ref-camp");
    function draw() {
      var list = A.referrals.filter(function (r) {
        return (!q.value || r.user.toLowerCase().indexOf(q.value.toLowerCase()) > -1) && (!st.value || r.status === st.value) && (!cp.value || r.campaign === cp.value);
      });
      $("#ref-body").innerHTML = list.length ? list.map(function (r) {
        var b = r.status === "Active" ? "badge-brand" : r.status === "Inactive" ? "badge-warn" : "";
        return '<tr><td class="strong">' + esc(r.user) + "</td><td>" + esc(r.campaign) + "</td><td>" + r.joined + '</td><td class="right num">' + fmt.usd(r.deposits, { dec: 0 }) + '</td><td class="right num">' + fmt.usd(r.wagered, { dec: 0 }) + '</td><td class="right num strong">' + fmt.usd(r.ngr) + '</td><td><span class="badge ' + b + '">' + r.status + "</span></td></tr>";
      }).join("") : '<tr><td colspan="7"><div class="empty">No players match these filters.</div></td></tr>';
    }
    [q, st, cp].forEach(function (el) { el.addEventListener("input", draw); });
    draw();
  }
  function newCampaign() {
    var o = document.createElement("div");
    o.className = "overlay open"; o.id = "modal-campaign";
    o.innerHTML = '<div class="modal"><div class="modal-head"><h3>New campaign</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form class="modal-body" id="camp-form">' +
      '<div class="field"><label>Campaign name</label><input class="input" name="name" required placeholder="e.g. Instagram stories"></div>' +
      '<div class="field"><label>Code</label><input class="input" name="code" required pattern="[A-Za-z0-9]{3,16}" placeholder="3–16 letters or numbers" style="text-transform:uppercase"><span class="hint">Players can type this code at sign-up instead of using the link.</span></div>' +
      '<div class="field"><label>Landing page</label><select class="select"><option>Home</option><option>Welcome offer</option><option>Sign-up</option><option>RD Originals</option></select></div>' +
      '<button class="btn btn-primary btn-block btn-lg">Create campaign</button></form></div>';
    document.body.appendChild(o);
    $("#camp-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, code = f.code.value.toUpperCase();
      state.campaigns.push({ id: "c" + Date.now(), name: f.name.value, code: code, clicks: 0, signups: 0, ftds: 0, ngr: 0, commission: 0, created: new Date().toISOString().slice(0, 10) });
      o.remove(); RD.toast("Campaign “" + f.name.value + "” created");
      location.hash = "#/affiliate/campaigns"; route();
    });
  }

  /* ---------- Static pages ---------- */
  pages.sports = function () {
    return '<div class="container"><div class="card empty" style="padding:72px 20px">' + ic("ball", 40) + '<h2 style="margin-top:14px">Sportsbook is coming</h2><p style="max-width:420px;margin:8px auto 20px">We are integrating a sportsbook provider. Meanwhile, explore RD Originals and live tables.</p><a class="btn btn-primary" href="#/casino/originals">Play RD Originals</a></div></div>';
  };
  pages.fairness = function () {
    return '<div class="container prose"><h1>Provably fair</h1><p class="muted" style="margin-top:8px">Every RD Originals result can be independently verified. Nobody — including us — can change a result after you bet.</p>' +
      "<h2>How it works</h2><ul><li>Before you bet, we commit to a hashed <strong>server seed</strong>.</li><li>You provide (or randomize) a <strong>client seed</strong>.</li><li>Each bet uses server seed + client seed + a <strong>nonce</strong> to generate the result with HMAC-SHA256.</li><li>When you rotate seeds, the old server seed is revealed so you can check every past bet.</li></ul>" +
      '<h2>Verify a bet</h2><div class="card card-pad"><div class="field"><label>Server seed (revealed)</label><input class="input" placeholder="e.g. 3f1a…"></div><div class="field"><label>Client seed</label><input class="input"></div><div class="field"><label>Nonce</label><input class="input" type="number" value="0"></div><button class="btn btn-primary" data-action="verify">Verify</button></div>' +
      '<div class="notice info" style="margin-top:16px">' + ic("help", 16) + "<span>Verifier UI only. The real algorithm must be the same one used by your game server.</span></div></div>";
  };
  pages.responsible = function () {
    return '<div class="container prose"><h1>Responsible gaming</h1><p class="muted" style="margin-top:8px">Gambling should be entertainment, never a way to make money or escape problems.</p>' +
      "<h2>Tools in your account</h2><ul><li><strong>Deposit limits</strong> — daily, weekly or monthly.</li><li><strong>Loss & wager limits</strong>.</li><li><strong>Session reminders</strong>.</li><li><strong>Cool-off</strong> — 24 hours to 6 weeks.</li><li><strong>Self-exclusion</strong> — 6 months to permanent.</li></ul>" +
      "<h2>Warning signs</h2><ul><li>Spending more than you can afford to lose.</li><li>Chasing losses.</li><li>Hiding gambling from people close to you.</li></ul>" +
      '<h2>Get help</h2><p>Free, confidential support: <a class="link-sm" href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware</a>, <a class="link-sm" href="https://www.gamblersanonymous.org" target="_blank" rel="noopener">Gamblers Anonymous</a>, <a class="link-sm" href="https://www.gamblingtherapy.org" target="_blank" rel="noopener">Gambling Therapy</a>.</p>' +
      (state.loggedIn ? '<div class="row" style="margin-top:20px"><a class="btn btn-secondary" href="#/account">Set limits</a><button class="btn btn-danger" data-action="self-exclude">Self-exclude</button></div>' : "") + "</div>";
  };
  var LEGAL = { terms: "Terms of Service", privacy: "Privacy Policy", aml: "AML & KYC Policy", bonus: "Bonus Terms", cookies: "Cookie Policy" };
  pages.legal = function (doc) {
    var title = LEGAL[doc] || "Legal";
    return '<div class="container prose"><h1>' + title + '</h1><div class="notice" style="margin:16px 0">' + ic("alert", 16) + "<span>Placeholder. This document must be drafted by a lawyer for your licensing jurisdiction before launch.</span></div>" +
      "<h2>Restricted territories</h2><p>Accounts may not be opened or used by residents of: " + RD.config.restrictedCountries.join(", ") + ".</p>" +
      "<h2>Other documents</h2><ul>" + Object.keys(LEGAL).map(function (k) { return '<li><a class="link-sm" href="#/legal/' + k + '">' + LEGAL[k] + "</a></li>"; }).join("") + "</ul></div>";
  };
  pages.account = function () {
    if (!state.loggedIn) { setTimeout(function () { openAuth("login"); }, 0); return pages.home(); }
    return '<div class="container"><div class="page-head"><h1>Settings & security</h1></div><div class="grid-2">' +
      '<div class="card card-pad"><h3 style="margin-bottom:14px">Profile</h3><div class="field"><label>Username</label><input class="input" value="' + esc(RD.user.username) + '" disabled></div><div class="field"><label>Email</label><input class="input" value="' + esc(RD.user.email) + '"></div>' +
        '<div class="row between" style="padding:10px 0"><div><strong>Two-factor authentication</strong><br><small class="faint">Required for withdrawals</small></div><button class="btn btn-secondary btn-sm">Enable</button></div>' +
        '<div class="row between" style="padding:10px 0"><div><strong>Identity verification (KYC)</strong><br><small class="faint">Needed for large withdrawals</small></div><span class="badge badge-warn">Not started</span></div></div>' +
      '<div class="card card-pad"><h3 style="margin-bottom:14px">Limits</h3><div class="field"><label>Daily deposit limit</label><select class="select"><option>No limit</option><option>$100</option><option>$500</option><option>$1,000</option></select></div><div class="field"><label>Session reminder</label><select class="select"><option>Off</option><option>Every 30 min</option><option>Every hour</option></select></div><button class="btn btn-primary" data-action="save">Save limits</button></div></div></div>';
  };
  pages.notfound = function () {
    return '<div class="container"><div class="card empty" style="padding:72px 20px"><h2>Page not found</h2><p style="margin:8px 0 20px">The page you are looking for does not exist.</p><a class="btn btn-primary" href="#/">Back to lobby</a></div></div>';
  };

  /* ---------- Footer ---------- */
  function renderFooter() {
    var L = RD.config.license;
    var licenseLine = L.status === "active"
      ? esc(L.company) + " is licensed and regulated by " + esc(L.authority) + " under license no. " + esc(L.number) + ". " + esc(L.address)
      : "Licensing information will be published here. [Pending — do not launch with real money before this is filled in.]";
    $("#footer").innerHTML = '<div class="footer-in"><div class="footer-cols">' +
      '<div class="footer-about"><span class="brand-name">RD<span>Casino</span></span><p>Crypto casino with provably fair originals, top providers and instant withdrawals.</p><div class="footer-badges"><span class="age-badge">18+</span><span class="badge">' + ic("shield", 12) + 'Provably fair</span><span class="badge">' + ic("lock", 12) + "SSL secured</span></div></div>" +
      "<div><h4>Casino</h4><a href=\"#/casino/originals\">RD Originals</a><a href=\"#/casino/slots\">Slots</a><a href=\"#/casino/live\">Live casino</a><a href=\"#/casino/gameshows\">Game shows</a></div>" +
      "<div><h4>Rewards</h4><a href=\"#/promotions\">Promotions</a><a href=\"#/vip\">VIP Club</a><a href=\"#/leaderboard\">Leaderboard</a><a href=\"#/affiliate\">Affiliates</a></div>" +
      "<div><h4>Support</h4><a href=\"#\" data-drawer=\"chat\">Live chat</a><a href=\"mailto:" + RD.config.supportEmail + "\">Email us</a><a href=\"#/fairness\">Provably fair</a><a href=\"#/responsible\">Responsible gaming</a></div>" +
      "<div><h4>Legal</h4><a href=\"#/legal/terms\">Terms of Service</a><a href=\"#/legal/privacy\">Privacy Policy</a><a href=\"#/legal/aml\">AML & KYC</a><a href=\"#/legal/bonus\">Bonus Terms</a></div></div>" +
      '<div class="footer-legal"><div>' + licenseLine + "</div><div>Restricted territories: " + RD.config.restrictedCountries.join(", ") + ".</div><div>Gambling can be addictive. Play responsibly. © 2026 RDCasino.</div></div></div>";
  }

  /* ---------- Live bits ---------- */
  var feedTimer, heroTimer;
  function feedRow() {
    var g = RD.games[Math.floor(Math.random() * RD.games.length)];
    var users = ["satoshi_k", "Hidden", "m***x", "alpha_dog", "Hidden", "n***88", "cryptoqueen", "j***o"];
    var bet = Math.round((Math.random() * 400 + 1) * 100) / 100, r = Math.random();
    var mult = r > 0.45 ? (r > 0.94 ? 20 + Math.random() * 200 : r > 0.75 ? 2 + Math.random() * 8 : 1.01 + Math.random()) : 0;
    var pay = mult ? bet * mult : 0;
    return '<tr><td><a href="#/game/' + g.id + '" class="row" style="gap:10px">' + media(g, "thumb-28", "") + esc(g.name) + "</a></td><td>" + users[Math.floor(Math.random() * users.length)] + '</td><td class="right num">' + fmt.usd(bet) + '</td><td class="right num">' + mult.toFixed(2) + 'x</td><td class="right num ' + (pay > bet ? "pos" : "faint") + '">' + (pay ? fmt.usd(pay) : "—") + "</td></tr>";
  }
  function startFeed() {
    var body = $("#feed"); if (!body) return;
    var h = ""; for (var i = 0; i < 8; i++) h += feedRow(); body.innerHTML = h;
    clearInterval(feedTimer);
    feedTimer = setInterval(function () {
      var b = $("#feed"); if (!b) return clearInterval(feedTimer);
      b.insertAdjacentHTML("afterbegin", feedRow()); if (b.children.length > 8) b.lastElementChild.remove();
    }, 3000);
  }
  function startHero() { clearInterval(heroTimer); }
  function countdown() {
    var now = new Date(), end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1), d = end - now.getTime();
    var v = { d: Math.floor(d / 864e5), h: Math.floor((d % 864e5) / 36e5), m: Math.floor((d % 36e5) / 6e4), s: Math.floor((d % 6e4) / 1e3) };
    $$("[data-cd]").forEach(function (el) { el.textContent = String(v[el.getAttribute("data-cd")]).padStart(2, "0"); });
    $$("[data-countdown-short]").forEach(function (el) { el.textContent = v.d + "d " + v.h + "h"; });
  }
  function seedChat() {
    var msgs = [["RD", "RDCasino", "Welcome! Be kind, no spam, no begging. Mods are online 24/7.", true], ["SK", "satoshi_k", "gl everyone 🍀"], ["AD", "alpha_dog", "anyone on Crash right now?"], ["CQ", "cryptoqueen", "withdrew to my wallet in like 3 min, nice"], ["DD", "degen_dan", "plinko high risk is wild today"]];
    $("#chat-list").innerHTML = msgs.map(function (m) { return '<div class="chat-msg' + (m[3] ? " staff" : "") + '"><span class="avatar">' + m[0] + "</span><div><strong>" + m[1] + "</strong><p>" + esc(m[2]) + "</p></div></div>"; }).join("");
  }

  /* ---------- Router ---------- */
  function route() {
    var path = (location.hash || "#/").replace(/^#\/?/, "").replace(/\/$/, "");
    var parts = path.split("/"), name = parts[0] || "home", arg = parts[1];
    var fn = pages[name] || pages.notfound;
    clearInterval(feedTimer);
    $("#view").innerHTML = fn(arg);
    if (fn.after) fn.after(arg);
    $("#search-pop").classList.add("hidden");
    closeAll();
    markActive(path);
    countdown();
    window.scrollTo(0, 0);
  }

  /* ---------- Global events (delegation) ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open],[data-close],[data-drawer],[data-close-drawer],[data-action],[data-copy],[data-auth],[data-wtab],[data-coin],[data-net],#user-btn,#burger,#bn-menu,#sb-backdrop");
    if (!t) {
      if (!e.target.closest(".menu-wrap")) $("#user-menu").classList.add("hidden");
      if (!e.target.closest(".hdr-search")) $("#search-pop").classList.add("hidden");
      if (e.target.classList.contains("overlay")) { e.target.id === "modal-campaign" ? e.target.remove() : closeAll(); }
      return;
    }
    if (t.hasAttribute("data-copy")) { e.preventDefault(); return RD.copy(t.getAttribute("data-copy")); }
    if (t.hasAttribute("data-open")) {
      e.preventDefault();
      var w = t.getAttribute("data-open");
      if (w === "wallet") { if (!state.loggedIn) return openAuth("login"); openModal("wallet"); return renderWallet(); }
      return openAuth(w);
    }
    if (t.hasAttribute("data-close")) { var m = t.closest(".overlay"); m && m.id === "modal-campaign" ? m.remove() : closeAll(); return; }
    if (t.hasAttribute("data-drawer")) { e.preventDefault(); closeAll(); $("#drawer-" + t.getAttribute("data-drawer")).classList.add("open"); return; }
    if (t.hasAttribute("data-close-drawer")) return closeAll();
    if (t.hasAttribute("data-auth")) return openAuth(t.getAttribute("data-auth"));
    if (t.hasAttribute("data-wtab")) { state.walletTab = t.getAttribute("data-wtab"); return renderWallet(); }
    if (t.hasAttribute("data-coin")) { state.coin = t.getAttribute("data-coin"); return renderWallet(); }
    if (t.hasAttribute("data-net")) { state.net = t.getAttribute("data-net"); return renderWallet(); }
    if (t.id === "user-btn") return $("#user-menu").classList.toggle("hidden");
    if (t.id === "burger" || t.id === "bn-menu") return document.body.classList.toggle("sb-open");
    if (t.id === "sb-backdrop") return closeAll();

    var a = t.getAttribute("data-action");
    switch (a) {
      case "logout": return logout();
      case "new-campaign": return newCampaign();
      case "aff-withdraw": return RD.toast("Withdrawal of " + fmt.usd(A.stats.available) + " requested (demo)");
      case "withdraw": return RD.toast("Withdrawal requested (demo)");
      case "tip": return RD.toast("Tip sent (demo)");
      case "claim": return state.loggedIn ? RD.toast("Claimed (demo)") : openAuth("register");
      case "terms": location.hash = "#/legal/bonus"; return;
      case "play-real": return RD.toast("Provider not integrated yet");
      case "play-demo": return RD.toast("Demo mode will load the provider iframe");
      case "export": return RD.toast("CSV export (demo)");
      case "save": return RD.toast("Saved");
      case "verify": return RD.toast("Verification needs the game server algorithm");
      case "self-exclude": return RD.toast("Self-exclusion flow (to be built with backend)");
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeAll(); var c = $("#modal-campaign"); c && c.remove(); } });
  document.addEventListener("click", function (e) { if (e.target.id === "wd-max") { $("#wd-amt").value = coin().bal.toFixed(2); } });

  $("#form-login").addEventListener("submit", function (e) { e.preventDefault(); login(); });
  $("#form-register").addEventListener("submit", function (e) {
    e.preventDefault();
    if (isRestricted($("#reg-country").value)) { $("#geo-block").classList.remove("hidden"); return; }
    login();
  });
  $("#reg-country").addEventListener("change", function () { $("#geo-block").classList.toggle("hidden", !isRestricted(this.value)); });
  $("#chat-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = this.querySelector("input"); if (!inp.value.trim()) return;
    if (!state.loggedIn) return openAuth("login");
    $("#chat-list").insertAdjacentHTML("beforeend", '<div class="chat-msg"><span class="avatar" style="background:var(--brand);color:var(--brand-ink)">' + RD.user.username.slice(0, 2).toUpperCase() + "</span><div><strong>" + esc(RD.user.username) + "</strong><p>" + esc(inp.value.trim()) + "</p></div></div>");
    inp.value = ""; var l = $("#chat-list"); l.scrollTop = l.scrollHeight;
  });
  var gs = $("#global-search");
  gs.addEventListener("input", function () { search(gs.value); });
  gs.addEventListener("focus", function () { search(gs.value); });

  /* Captura ?ref=CODE para atribuição de afiliado */
  (function () {
    var m = location.search.match(/[?&]ref=([A-Za-z0-9]+)/);
    if (m) store.set("ref", m[1].toUpperCase());
    var ref = store.get("ref", ""); if (ref) $("#reg-ref").value = ref;
  })();

  /* ---------- Boot ---------- */
  hydrateIcons(document);
  renderSidebar();
  renderAuth();
  renderFooter();
  fillCountries();
  seedChat();
  window.addEventListener("hashchange", route);
  route();
  setInterval(countdown, 1000);
})();
