/* ==========================================================================
   RDCasino — Mock data layer
   TUDO aqui é dado de demonstração. Quando o backend existir, substitua
   cada coleção por chamadas à API mantendo os mesmos formatos de objeto,
   e o resto do front-end continua funcionando.
   ========================================================================== */

window.RD = window.RD || {};

RD.config = {
  brand: "RDCasino",
  currency: "USD",
  supportEmail: "support@rdcasino.example", // TODO: domínio real
  // Preencha SOMENTE com dados reais da licença. Nunca exiba licença inexistente.
  license: {
    status: "pending", // "pending" | "active"
    authority: "",      // ex.: "Curaçao Gaming Authority"
    number: "",         // ex.: "OGL/2025/XXX/XXXX"
    company: "",        // razão social da operadora
    address: ""
  },
  // Lista base comum em licenças offshore. Valide com seu advogado/licenciador.
  restrictedCountries: [
    "Brazil", "United States", "United Kingdom", "France", "Netherlands", "Spain",
    "Australia", "Curaçao", "Germany", "Italy", "Ontario (Canada)", "Israel"
  ],
  minAge: 18
};

/* ---- Images -------------------------------------------------------------
   Para colocar uma foto: salve o arquivo exatamente no caminho indicado.
   Se o arquivo não existir, o site mostra um degradê com o nome (fallback).
   Tamanhos recomendados em assets/img/README.md
   ------------------------------------------------------------------------- */
RD.img = {
  logo: "assets/img/brand/logo.svg",
  heroAffiliate: "assets/img/affiliate/hero.jpg"
};

RD.banners = [
  { id: "welcome", tag: "Welcome offer", title: "100% up to $1,000", sub: "On your first crypto deposit. 35x wagering, 30 days.", cta: "Claim offer", route: "promotions", img: "assets/img/banners/welcome.jpg", c1: "#123526", c2: "#0b1712" },
  { id: "leaderboard", tag: "Monthly leaderboard", title: "$50,000 prize pool", sub: "Top 100 players by wagered volume get paid.", cta: "See standings", route: "leaderboard", img: "assets/img/banners/leaderboard.jpg", c1: "#3a2c10", c2: "#16110a" },
  { id: "affiliate", tag: "Affiliates", title: "Earn up to 50% NGR", sub: "Lifetime revenue share, weekly crypto payouts.", cta: "Become a partner", route: "affiliate", img: "assets/img/banners/affiliate.jpg", c1: "#14264a", c2: "#0b1220" }
];

RD.categories = [
  { id: "all", label: "All games" },
  { id: "originals", label: "RD Originals" },
  { id: "slots", label: "Slots" },
  { id: "live", label: "Live casino" },
  { id: "gameshows", label: "Game shows" }
];

RD.games = [
  // Originals
  { id: "dice", name: "Dice", provider: "RD Originals", cat: "originals", rtp: 99, tag: "hot", c1: "#0f3a2a", c2: "#0a1a14" },
  { id: "crash", name: "Crash", provider: "RD Originals", cat: "originals", rtp: 99, tag: "hot", c1: "#3b1620", c2: "#170a0e" },
  { id: "mines", name: "Mines", provider: "RD Originals", cat: "originals", rtp: 99, c1: "#163a1a", c2: "#0a170c" },
  { id: "plinko", name: "Plinko", provider: "RD Originals", cat: "originals", rtp: 99, c1: "#1a2a52", c2: "#0b1224" },
  { id: "limbo", name: "Limbo", provider: "RD Originals", cat: "originals", rtp: 99, c1: "#3a2e10", c2: "#17120a" },
  { id: "keno", name: "Keno", provider: "RD Originals", cat: "originals", rtp: 99, c1: "#2c1a4a", c2: "#120b20" },
  { id: "hilo", name: "Hi-Lo", provider: "RD Originals", cat: "originals", rtp: 99, c1: "#123040", c2: "#0a141b" },
  { id: "wheel", name: "Wheel", provider: "RD Originals", cat: "originals", rtp: 99, tag: "new", c1: "#3a1a3a", c2: "#170a17" },
  // Slots
  { id: "gates-olympus", name: "Gates of Olympus 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, tag: "hot", c1: "#3a2a10", c2: "#1a1208" },
  { id: "sweet-bonanza", name: "Sweet Bonanza 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.53, c1: "#3a1a2e", c2: "#180a13" },
  { id: "sugar-rush", name: "Sugar Rush 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.53, c1: "#3a1a24", c2: "#180a0f" },
  { id: "wanted", name: "Wanted Dead or a Wild", provider: "Hacksaw Gaming", cat: "slots", rtp: 96.38, c1: "#3a2414", c2: "#180f08" },
  { id: "mental-2", name: "Mental II", provider: "Nolimit City", cat: "slots", rtp: 96.06, tag: "new", c1: "#2a1414", c2: "#120808" },
  { id: "starlight", name: "Starlight Princess 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, c1: "#2a1a4a", c2: "#110a20" },
  { id: "dog-house", name: "The Dog House Megaways", provider: "Pragmatic Play", cat: "slots", rtp: 96.55, c1: "#14304a", c2: "#08131f" },
  { id: "book-dead", name: "Book of Dead", provider: "Play'n GO", cat: "slots", rtp: 96.21, c1: "#3a3014", c2: "#181408" },
  { id: "wolf-gold", name: "Wolf Gold", provider: "Pragmatic Play", cat: "slots", rtp: 96.01, c1: "#2a2a3a", c2: "#111118" },
  { id: "big-bass", name: "Big Bass Bonanza", provider: "Pragmatic Play", cat: "slots", rtp: 96.71, c1: "#103040", c2: "#08141b" },
  // Live
  { id: "lightning-roulette", name: "Lightning Roulette", provider: "Evolution", cat: "live", rtp: 97.3, tag: "hot", c1: "#3a2a0a", c2: "#181106" },
  { id: "blackjack-vip", name: "Blackjack VIP", provider: "Evolution", cat: "live", rtp: 99.28, c1: "#0f2e22", c2: "#08130e" },
  { id: "baccarat", name: "Speed Baccarat", provider: "Evolution", cat: "live", rtp: 98.94, c1: "#3a1018", c2: "#18070a" },
  { id: "euro-roulette", name: "European Roulette", provider: "Evolution", cat: "live", rtp: 97.3, c1: "#2a1010", c2: "#120707" },
  { id: "holdem", name: "Casino Hold'em", provider: "Evolution", cat: "live", rtp: 97.84, c1: "#102a2a", c2: "#071212" },
  { id: "dragon-tiger", name: "Dragon Tiger", provider: "Evolution", cat: "live", rtp: 96.27, c1: "#3a1a0a", c2: "#180b05" },
  // Game shows
  { id: "crazy-time", name: "Crazy Time", provider: "Evolution", cat: "gameshows", rtp: 96.08, tag: "hot", c1: "#3a1040", c2: "#17071a" },
  { id: "monopoly", name: "Monopoly Live", provider: "Evolution", cat: "gameshows", rtp: 96.23, c1: "#0f2a3a", c2: "#071218" },
  { id: "dream-catcher", name: "Dream Catcher", provider: "Evolution", cat: "gameshows", rtp: 96.58, c1: "#2a1a40", c2: "#110a1a" },
  { id: "deal-no-deal", name: "Deal or No Deal", provider: "Evolution", cat: "gameshows", rtp: 95.42, c1: "#2a2410", c2: "#121008" },
  { id: "mega-ball", name: "Mega Ball", provider: "Evolution", cat: "gameshows", rtp: 95.4, c1: "#10283a", c2: "#071118" },
  { id: "funky-time", name: "Funky Time", provider: "Evolution", cat: "gameshows", rtp: 95.99, tag: "new", c1: "#3a1030", c2: "#170714" }
];
RD.games.forEach(function (g) { g.img = "assets/img/games/" + g.id + ".jpg"; g.enabled = true; });

RD.promotions = [
  { id: "welcome", title: "Welcome Bonus", value: "100% up to $1,000", desc: "Double your first deposit. Min. deposit $20. 35x wagering on bonus funds within 30 days.", badge: "New players", img: "assets/img/promos/welcome.jpg", c1: "#123526", c2: "#0b1712", status: "active" },
  { id: "reload", title: "Weekly Reload", value: "25% up to $500", desc: "Every Friday on your first deposit of the day. Available from Bronze tier.", badge: "Weekly", img: "assets/img/promos/reload.jpg", c1: "#14264a", c2: "#0b1220", status: "active" },
  { id: "rakeback", title: "Instant Rakeback", value: "Up to 10%", desc: "Get a share of the house edge back on every bet, claimable any time.", badge: "VIP", img: "assets/img/promos/rakeback.jpg", c1: "#3a2c10", c2: "#16110a", status: "active" },
  { id: "race", title: "Daily Race", value: "$5,000 daily", desc: "Top 50 wagerers every 24h share the prize pool. No opt-in needed.", badge: "Daily", img: "assets/img/promos/race.jpg", c1: "#2c1a4a", c2: "#120b20", status: "active" },
  { id: "drops", title: "Pragmatic Drops & Wins", value: "$2M monthly", desc: "Random cash drops and tournaments on eligible Pragmatic Play slots.", badge: "Provider", img: "assets/img/promos/drops.jpg", c1: "#3a1a24", c2: "#180a0f", status: "active" },
  { id: "cashback", title: "Weekend Cashback", value: "10% back", desc: "On net losses from Saturday 00:00 to Sunday 23:59 UTC. Paid Monday, no wagering.", badge: "Weekend", img: "assets/img/promos/cashback.jpg", c1: "#103040", c2: "#08141b", status: "scheduled" }
];

RD.vipTiers = [
  { name: "Bronze", wager: 10000, reward: 25, color: "#b87a4b" },
  { name: "Silver", wager: 50000, reward: 100, color: "#aab4c3" },
  { name: "Gold", wager: 100000, reward: 250, color: "#e6b450" },
  { name: "Platinum I", wager: 250000, reward: 500, color: "#7fc4d8" },
  { name: "Platinum II", wager: 500000, reward: 1000, color: "#7fc4d8" },
  { name: "Diamond I", wager: 1000000, reward: 2500, color: "#8fb3ff" },
  { name: "Diamond II", wager: 2500000, reward: 6000, color: "#8fb3ff" },
  { name: "Obsidian", wager: 10000000, reward: 25000, color: "#b18cff" }
];

RD.leaderboard = (function () {
  var names = ["luck***", "satoshi_k", "m***x", "tr***er", "BigWager", "n***88", "alpha_dog", "j***o", "cryptoqueen", "r***z", "degen_dan", "w***s"];
  var prizes = [15000, 9000, 6000, 4000, 3000, 2500, 2000, 1500, 1200, 1000, 800, 600];
  return names.map(function (n, i) {
    return { rank: i + 1, user: n, wagered: Math.round(4200000 / (i + 1.3)), prize: prizes[i] };
  });
})();

/* ---- Current user (demo) ---- */
RD.user = {
  id: "u_10293",
  username: "rdplayer",
  email: "player@example.com",
  balance: 1284.55,
  tier: "Gold",
  nextTier: "Platinum I",
  wagered: 162400,
  isAffiliate: true,
  country: "Canada"
};

RD.wallet = {
  coins: [
    { sym: "USDT", name: "Tether", nets: ["TRC20", "ERC20", "BEP20"], color: "#26a17b", bal: 820.10 },
    { sym: "BTC", name: "Bitcoin", nets: ["Bitcoin"], color: "#f7931a", bal: 312.45 },
    { sym: "ETH", name: "Ethereum", nets: ["ERC20", "Arbitrum"], color: "#627eea", bal: 98.0 },
    { sym: "SOL", name: "Solana", nets: ["Solana"], color: "#9945ff", bal: 54.0 },
    { sym: "LTC", name: "Litecoin", nets: ["Litecoin"], color: "#345d9d", bal: 0 }
  ],
  // Endereço fictício. Em produção vem do processador (ex.: NOWPayments, CoinsPaid) por usuário.
  demoAddress: "TXy3dEmoAddr3ss0nlyNotReal9kQw2Lm"
};

/* ---- Affiliate (demo) ---- */
RD.affiliate = {
  code: "RDPLAYER",
  baseUrl: "https://rdcasino.example/?ref=",
  plans: [
    { tier: 1, label: "Starter", range: "0–10 FTDs / month", share: 25 },
    { tier: 2, label: "Growth", range: "11–25 FTDs / month", share: 30 },
    { tier: 3, label: "Pro", range: "26–50 FTDs / month", share: 35 },
    { tier: 4, label: "Elite", range: "51–100 FTDs / month", share: 40 },
    { tier: 5, label: "Partner", range: "100+ FTDs / month", share: 50 }
  ],
  currentTier: 2,
  stats: { clicks: 4821, signups: 312, ftds: 18, activePlayers: 64, ngr: 18640.2, commission: 5592.06, available: 1240.5, pending: 860.0, paid: 3491.56 },
  campaigns: [
    { id: "c1", name: "Default", code: "RDPLAYER", clicks: 2210, signups: 140, ftds: 9, ngr: 8120.4, commission: 2436.12, created: "2026-05-02" },
    { id: "c2", name: "YouTube — Slots review", code: "YTSLOTS", clicks: 1580, signups: 104, ftds: 6, ngr: 6830.1, commission: 2049.03, created: "2026-06-18" },
    { id: "c3", name: "Telegram channel", code: "TGVIP", clicks: 862, signups: 58, ftds: 3, ngr: 3189.7, commission: 956.91, created: "2026-08-01" },
    { id: "c4", name: "X / Twitter bio", code: "XBIO", clicks: 169, signups: 10, ftds: 0, ngr: 500.0, commission: 150.0, created: "2026-09-12" }
  ],
  referrals: (function () {
    var out = [], users = ["k***a91", "satoshi_k", "m***3", "p***x", "L***e", "r***k", "T***g", "w***z", "b***f", "n***7", "j***o", "q***e"];
    var camps = ["Default", "YouTube — Slots review", "Telegram channel", "Default", "Default", "YouTube — Slots review"];
    for (var i = 0; i < users.length; i++) {
      var dep = i % 4 === 3 ? 0 : Math.round(150 + ((i * 937) % 2400));
      out.push({
        user: users[i],
        campaign: camps[i % camps.length],
        joined: "2026-" + String(6 + (i % 4)).padStart(2, "0") + "-" + String(3 + i * 2).padStart(2, "0"),
        deposits: dep,
        wagered: dep * (8 + (i % 5)),
        ngr: Math.round(dep * 0.42 * 100) / 100,
        status: dep === 0 ? "No deposit" : i % 5 === 0 ? "Inactive" : "Active"
      });
    }
    return out;
  })(),
  daily: (function () {
    var out = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(2026, 9, 8 - i);
      out.push({ date: d.toISOString().slice(0, 10), commission: Math.round((90 + Math.sin(i / 3) * 60 + ((i * 53) % 70)) * 100) / 100 });
    }
    return out;
  })(),
  payouts: [
    { id: "PO-1042", date: "2026-10-01", amount: 1210.4, coin: "USDT", status: "Paid", tx: "0x8a…f31c" },
    { id: "PO-1031", date: "2026-09-24", amount: 980.0, coin: "USDT", status: "Paid", tx: "0x41…9ab2" },
    { id: "PO-1019", date: "2026-09-17", amount: 760.16, coin: "BTC", status: "Paid", tx: "bc1q…7hx0" },
    { id: "PO-1008", date: "2026-09-10", amount: 541.0, coin: "USDT", status: "Paid", tx: "0x77…02de" }
  ],
  assets: [
    { id: "b-728", name: "Leaderboard", size: "728×90", img: "assets/img/affiliate/banner-728x90.jpg", c1: "#3a2c10", c2: "#16110a" },
    { id: "b-300", name: "Welcome bonus", size: "300×250", img: "assets/img/affiliate/banner-300x250.jpg", c1: "#123526", c2: "#0b1712" },
    { id: "b-1080", name: "Instagram story", size: "1080×1920", img: "assets/img/affiliate/story-1080x1920.jpg", c1: "#14264a", c2: "#0b1220" },
    { id: "b-1200", name: "Social post", size: "1200×628", img: "assets/img/affiliate/post-1200x628.jpg", c1: "#2c1a4a", c2: "#120b20" }
  ]
};

/* ---- Admin (demo) ---- */
RD.admin = {
  kpis: { ggr: 182340.5, ngr: 141220.8, deposits: 612400, withdrawals: 431900, activePlayers: 1842, newSignups: 386, ftds: 121, bonusCost: 41119.7 },
  revenueDaily: (function () {
    var out = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(2026, 9, 8 - i);
      out.push({ date: d.toISOString().slice(0, 10), ggr: Math.round(4200 + Math.sin(i / 4) * 1800 + ((i * 397) % 1500)) });
    }
    return out;
  })(),
  players: (function () {
    var names = ["satoshi_k", "alpha_dog", "cryptoqueen", "degen_dan", "BigWager", "rdplayer", "lucky_7", "moonboy", "hodl_hannah", "whale_01", "ace_high", "nightowl"];
    var countries = ["Canada", "Austria", "Japan", "Mexico", "Argentina", "Canada", "India", "Turkey", "Chile", "UAE", "Norway", "Peru"];
    var kyc = ["Verified", "Verified", "Pending", "Not started", "Verified", "Verified", "Rejected", "Pending", "Verified", "Verified", "Not started", "Verified"];
    return names.map(function (n, i) {
      return {
        id: "u_" + (10280 + i), username: n, email: n.toLowerCase() + "@mail.example", country: countries[i],
        balance: Math.round(((i * 7919) % 25000) * 100) / 100 / 3,
        deposits: Math.round((i * 15485) % 90000), withdrawals: Math.round((i * 9973) % 60000),
        tier: RD.vipTiers[i % RD.vipTiers.length].name, kyc: kyc[i],
        status: i === 6 ? "Suspended" : "Active",
        registered: "2026-0" + (3 + (i % 6)) + "-" + String(10 + i).padStart(2, "0"),
        affiliate: i % 3 === 0 ? "RDPLAYER" : "—", risk: i === 7 ? "High" : i % 4 === 0 ? "Medium" : "Low"
      };
    });
  })(),
  transactions: (function () {
    var out = [], types = ["Deposit", "Withdrawal", "Deposit", "Deposit", "Withdrawal"], coins = ["USDT", "BTC", "ETH", "SOL", "USDT", "LTC"];
    var st = ["Completed", "Pending", "Completed", "Completed", "Pending", "Rejected", "Completed"];
    for (var i = 0; i < 18; i++) {
      var t = types[i % types.length];
      out.push({
        id: "TX-" + (88210 - i), user: RD.admin ? "" : "", type: t, coin: coins[i % coins.length],
        amount: Math.round(((i * 4271) % 4800 + 50) * 100) / 100,
        status: t === "Withdrawal" && i % 2 === 0 ? "Pending" : st[i % st.length],
        date: "2026-10-0" + (8 - (i % 7)) + " " + String(9 + (i % 12)).padStart(2, "0") + ":" + String((i * 7) % 60).padStart(2, "0")
      });
    }
    return out;
  })(),
  affiliates: [
    { id: "a1", name: "rdplayer", email: "player@example.com", code: "RDPLAYER", plan: "Growth · 30%", players: 64, ngr: 18640.2, owed: 1240.5, status: "Active" },
    { id: "a2", name: "SlotsTube", email: "biz@slotstube.example", code: "SLOTSTUBE", plan: "Custom · 45%", players: 412, ngr: 98210.0, owed: 8420.0, status: "Active" },
    { id: "a3", name: "CryptoBetsTG", email: "admin@cbtg.example", code: "CBTG", plan: "Pro · 35%", players: 188, ngr: 40112.6, owed: 3011.4, status: "Active" },
    { id: "a4", name: "streamer_jax", email: "jax@mail.example", code: "JAX", plan: "Hybrid · $80 CPA + 20%", players: 0, ngr: 0, owed: 0, status: "Pending review" },
    { id: "a5", name: "bonushunter.io", email: "hello@bonushunter.example", code: "BHIO", plan: "Starter · 25%", players: 9, ngr: -820.4, owed: 0, status: "Suspended" }
  ]
};
RD.admin.players.forEach(function (p, i) { RD.admin.transactions[i] && (RD.admin.transactions[i].user = p.username); });
RD.admin.transactions.forEach(function (t, i) { if (!t.user) t.user = RD.admin.players[i % RD.admin.players.length].username; });

/* ---- Helpers shared by site & admin ---- */
RD.fmt = {
  usd: function (n, opts) {
    opts = opts || {};
    var s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: opts.dec === 0 ? 0 : 2, maximumFractionDigits: opts.dec === 0 ? 0 : 2 });
    return (n < 0 ? "-" : opts.sign && n > 0 ? "+" : "") + "$" + s;
  },
  int: function (n) { return Math.round(n).toLocaleString("en-US"); },
  compact: function (n) { return n >= 1e6 ? "$" + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "K" : "$" + n; }
};

RD.esc = function (s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
};

/* Image block with graceful fallback (gradient + label) */
RD.media = function (o, cls, label) {
  return '<div class="media ' + (cls || "") + '" style="--c1:' + (o.c1 || "#1a2233") + ";--c2:" + (o.c2 || "#0f1420") + '">' +
    (label ? '<div class="media-fallback">' + label + "</div>" : "") +
    (o.img ? '<img src="' + (RD.imgBase || "") + o.img + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
    "</div>";
};

RD.toast = function (msg, type) {
  var box = document.querySelector(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
  var t = document.createElement("div");
  t.className = "toast" + (type === "error" ? " error" : "");
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(function () { t.remove(); }, 300); }, 2600);
};

RD.copy = function (text, label) {
  var done = function () { RD.toast((label || "Copied") + " to clipboard"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
  else done();
};

RD.bars = function (series, key, fmt) {
  var max = Math.max.apply(null, series.map(function (d) { return d[key]; })) || 1;
  var html = '<div class="bars">' + series.map(function (d) {
    return '<div class="bar" style="height:' + Math.max(2, (d[key] / max) * 100) + '%" data-tip="' + d.date.slice(5) + " · " + fmt(d[key]) + '"></div>';
  }).join("") + "</div>";
  html += '<div class="bars-axis"><span>' + series[0].date.slice(5) + "</span><span>" + series[Math.floor(series.length / 2)].date.slice(5) + "</span><span>" + series[series.length - 1].date.slice(5) + "</span></div>";
  return html;
};
