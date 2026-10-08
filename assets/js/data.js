/* ==========================================================================
   RDCasino — Catálogo e configuração (NÃO contém jogadores nem transações).
   Tudo que é atividade real (contas, apostas, saques, KYC, afiliados) vive
   em store.js e começa zerado.
   ========================================================================== */

window.RD = window.RD || {};

RD.config = {
  brand: "RDCasino",
  currency: "USD",
  supportEmail: "support@rdcasino.example", // TODO: domínio real
  // Preencha SOMENTE com dados reais da licença. Nunca exiba licença inexistente.
  license: { status: "pending", authority: "", number: "", company: "", address: "" },
  // Lista base comum em licenças offshore. Valide com seu advogado/licenciador.
  restrictedCountries: [
    "Brazil", "United States", "United Kingdom", "France", "Netherlands", "Spain",
    "Australia", "Curaçao", "Germany", "Italy", "Ontario (Canada)", "Israel"
  ],
  minAge: 18,
  leaderboardPrize: 50000,
  leaderboardPrizes: [15000, 9000, 6000, 4000, 3000, 2500, 2000, 1500, 1200, 1000],
  kycWithdrawLimit: 2000,
  rakebackRate: 0.05 // 5% da vantagem da casa volta como rakeback
};

/* Para colocar uma foto: salve o arquivo exatamente no caminho indicado.
   Se o arquivo não existir, aparece um degradê (fallback). */
RD.img = {
  logo: "assets/img/brand/logo.svg",
  heroAffiliate: "assets/img/affiliate/hero.jpg",
  heroArt: "scene:hero"
};

RD.banners = [
  { id: "welcome", art: "scene:welcome", tag: "Welcome offer", title: "100% bonus up to $1,000", sub: "On your first crypto deposit.", cta: "Claim now", route: "promotions", img: "assets/img/banners/welcome.jpg", c1: "#1d4ed8", c2: "#0b2a6b" },
  { id: "leaderboard", art: "scene:leaderboard", tag: "Monthly race", title: "$50,000 leaderboard", sub: "Top wagerers get paid every month.", cta: "See standings", route: "leaderboard", img: "assets/img/banners/leaderboard.jpg", c1: "#5b3fd6", c2: "#24135f" },
  { id: "affiliate", art: "scene:affiliate", tag: "Affiliates", title: "Earn up to 50% commission", sub: "Lifetime revenue share, paid in crypto.", cta: "Start earning", route: "affiliate", img: "assets/img/banners/affiliate.jpg", c1: "#0e7490", c2: "#083344" }
];

RD.categories = [
  { id: "all", label: "Lobby" },
  { id: "originals", label: "RD Originals" },
  { id: "slots", label: "Slots" },
  { id: "live", label: "Live Casino" },
  { id: "gameshows", label: "Game Shows" }
];

/* playable: jogo próprio que já funciona no site */
RD.games = [
  { id: "dice", name: "Dice", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, tag: "hot", c1: "#1e40af", c2: "#0b1d4f" },
  { id: "limbo", name: "Limbo", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, tag: "new", c1: "#6d28d9", c2: "#2a0f5c" },
  { id: "crash", name: "Crash", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, tag: "hot", c1: "#be123c", c2: "#4c0519" },
  { id: "mines", name: "Mines", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, c1: "#047857", c2: "#022c22" },
  { id: "plinko", name: "Plinko", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, c1: "#c026d3", c2: "#4a044e" },
  { id: "keno", name: "Keno", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, c1: "#0369a1", c2: "#082f49" },
  { id: "hilo", name: "Hi-Lo", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, c1: "#b45309", c2: "#451a03" },
  { id: "wheel", name: "Wheel", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, c1: "#4338ca", c2: "#1e1b4b" },
  { id: "blackjack", name: "Blackjack", provider: "RD Originals", cat: "originals", rtp: 99.4, edge: 0.6, playable: true, tag: "new", c1: "#22b35e", c2: "#063a1c" },
  { id: "tower", name: "Tower", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#16c98d", c2: "#06352a" },
  { id: "chicken", name: "Chicken", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#ffb020", c2: "#6b2a00" },
  { id: "roulette", name: "Roulette", provider: "RD Originals", cat: "originals", rtp: 97.3, edge: 2.7, playable: true, tag: "new", c1: "#5b5bf0", c2: "#15124a" },
  { id: "gates-olympus", name: "Gates of Olympus 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, tag: "hot", c1: "#a16207", c2: "#3f2a04" },
  { id: "sweet-bonanza", name: "Sweet Bonanza 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.53, c1: "#db2777", c2: "#500724" },
  { id: "sugar-rush", name: "Sugar Rush 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.53, c1: "#e11d48", c2: "#4c0519" },
  { id: "wanted", name: "Wanted Dead or a Wild", provider: "Hacksaw Gaming", cat: "slots", rtp: 96.38, c1: "#9a3412", c2: "#3b1406" },
  { id: "mental-2", name: "Mental II", provider: "Nolimit City", cat: "slots", rtp: 96.06, c1: "#3f3f46", c2: "#121214" },
  { id: "starlight", name: "Starlight Princess 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, c1: "#7c3aed", c2: "#2e1065" },
  { id: "dog-house", name: "The Dog House Megaways", provider: "Pragmatic Play", cat: "slots", rtp: 96.55, c1: "#0284c7", c2: "#082f49" },
  { id: "book-dead", name: "Book of Dead", provider: "Play'n GO", cat: "slots", rtp: 96.21, c1: "#a16207", c2: "#3f2a04" },
  { id: "big-bass", name: "Big Bass Bonanza", provider: "Pragmatic Play", cat: "slots", rtp: 96.71, c1: "#0e7490", c2: "#083344" },
  { id: "lightning-roulette", name: "Lightning Roulette", provider: "Evolution", cat: "live", rtp: 97.3, tag: "hot", c1: "#a16207", c2: "#3f2a04" },
  { id: "blackjack-vip", name: "Blackjack VIP", provider: "Evolution", cat: "live", rtp: 99.28, c1: "#166534", c2: "#052e16" },
  { id: "baccarat", name: "Speed Baccarat", provider: "Evolution", cat: "live", rtp: 98.94, c1: "#9f1239", c2: "#4c0519" },
  { id: "euro-roulette", name: "European Roulette", provider: "Evolution", cat: "live", rtp: 97.3, c1: "#991b1b", c2: "#450a0a" },
  { id: "crazy-time", name: "Crazy Time", provider: "Evolution", cat: "gameshows", rtp: 96.08, tag: "hot", c1: "#be185d", c2: "#500724" },
  { id: "monopoly", name: "Monopoly Live", provider: "Evolution", cat: "gameshows", rtp: 96.23, c1: "#15803d", c2: "#052e16" },
  { id: "dream-catcher", name: "Dream Catcher", provider: "Evolution", cat: "gameshows", rtp: 96.58, c1: "#6d28d9", c2: "#2e1065" },
  { id: "funky-time", name: "Funky Time", provider: "Evolution", cat: "gameshows", rtp: 95.99, tag: "new", c1: "#c026d3", c2: "#4a044e" }
];
RD.games.forEach(function (g) { g.img = "assets/img/games/" + g.id + ".jpg"; g.enabled = true; });

RD.promotions = [
  { id: "welcome", art: "scene:welcome", title: "Welcome Bonus", value: "100% up to $1,000", desc: "Double your first deposit. Min. deposit $20. 35x wagering on bonus funds within 30 days.", badge: "New players", img: "assets/img/promos/welcome.jpg", c1: "#1d4ed8", c2: "#0b2a6b", status: "active" },
  { id: "reload", art: "scene:reload", title: "Weekly Reload", value: "25% up to $500", desc: "Every Friday on your first deposit of the day. Available from Bronze.", badge: "Weekly", img: "assets/img/promos/reload.jpg", c1: "#0e7490", c2: "#083344", status: "active" },
  { id: "rakeback", art: "scene:rakeback", title: "Instant Rakeback", value: "5% of house edge", desc: "Part of the house edge comes back on every bet. Claim it any time from VIP.", badge: "VIP", img: "assets/img/promos/rakeback.jpg", c1: "#5b3fd6", c2: "#24135f", status: "active" },
  { id: "race", art: "scene:race", title: "Monthly Leaderboard", value: "$50,000 pool", desc: "Top 10 wagerers of the calendar month share the prize pool. No opt-in.", badge: "Monthly", img: "assets/img/promos/race.jpg", c1: "#a16207", c2: "#3f2a04", status: "active" }
];

/* Níveis VIP (mesmos nomes da versão original). wager = total apostado. */
RD.vipTiers = [
  { name: "Wood", wager: 1000, reward: 20, color: "#a0703f" },
  { name: "Iron", wager: 5000, reward: 50, color: "#8a98a8" },
  { name: "Bronze", wager: 10000, reward: 100, color: "#cd7f4e" },
  { name: "Silver", wager: 50000, reward: 300, color: "#c0d0e0" },
  { name: "Gold", wager: 100000, reward: 750, color: "#f5c842" },
  { name: "Jade", wager: 250000, reward: 1500, color: "#00b878" },
  { name: "Sapphire", wager: 500000, reward: 3000, color: "#3a6fff" },
  { name: "Emerald", wager: 2000000, reward: 10000, color: "#00c858" },
  { name: "Ruby", wager: 5000000, reward: 30000, color: "#ff2d78" },
  { name: "Obsidian", wager: 10000000, reward: 75000, color: "#8a93a6" },
  { name: "Amethyst", wager: 25000000, reward: 200000, color: "#c040ff" }
];

RD.wallet = {
  coins: [
    { sym: "USDT", name: "Tether", nets: ["TRC20", "ERC20", "BEP20"], color: "#26a17b" },
    { sym: "BTC", name: "Bitcoin", nets: ["Bitcoin"], color: "#f7931a" },
    { sym: "ETH", name: "Ethereum", nets: ["ERC20", "Arbitrum"], color: "#627eea" },
    { sym: "SOL", name: "Solana", nets: ["Solana"], color: "#9945ff" },
    { sym: "LTC", name: "Litecoin", nets: ["Litecoin"], color: "#345d9d" }
  ]
};

RD.affiliatePlans = [
  { tier: 1, label: "Starter", min: 0, max: 10, range: "0–10 FTDs / month", share: 25 },
  { tier: 2, label: "Growth", min: 11, max: 25, range: "11–25 FTDs / month", share: 30 },
  { tier: 3, label: "Pro", min: 26, max: 50, range: "26–50 FTDs / month", share: 35 },
  { tier: 4, label: "Elite", min: 51, max: 100, range: "51–100 FTDs / month", share: 40 },
  { tier: 5, label: "Partner", min: 101, max: Infinity, range: "100+ FTDs / month", share: 50 }
];

RD.affiliateAssets = [
  { id: "b-728", name: "Leaderboard", size: "728×90", img: "assets/img/affiliate/banner-728x90.jpg", c1: "#1d4ed8", c2: "#0b2a6b" },
  { id: "b-300", name: "Welcome bonus", size: "300×250", img: "assets/img/affiliate/banner-300x250.jpg", c1: "#5b3fd6", c2: "#24135f" },
  { id: "b-1080", name: "Instagram story", size: "1080×1920", img: "assets/img/affiliate/story-1080x1920.jpg", c1: "#0e7490", c2: "#083344" },
  { id: "b-1200", name: "Social post", size: "1200×628", img: "assets/img/affiliate/post-1200x628.jpg", c1: "#a16207", c2: "#3f2a04" }
];

/* ---- Helpers compartilhados ---- */
RD.fmt = {
  usd: function (n, opts) {
    opts = opts || {}; n = n || 0;
    var s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: opts.dec === 0 ? 0 : 2, maximumFractionDigits: opts.dec === 0 ? 0 : 2 });
    return (n < 0 ? "-" : opts.sign && n > 0 ? "+" : "") + "$" + s;
  },
  int: function (n) { return Math.round(n || 0).toLocaleString("en-US"); },
  compact: function (n) { return n >= 1e6 ? "$" + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "K" : "$" + n; },
  date: function (iso) { return iso ? iso.slice(0, 16).replace("T", " ") : "—"; }
};

RD.esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
};

RD.media = function (o, cls, label) {
  var key = o.art || (o.cat === "originals" ? "cover:" + o.id : ""), art = key && RD.art && RD.art.has(key) ? RD.art.render(key, o.artPalette) : "";
  return '<div class="media ' + (cls || "") + (art ? " has-art" : "") + '" style="--c1:' + (o.c1 || "#20161e") + ";--c2:" + (o.c2 || "#0e090d") + '">' +
    (art ? '<div class="media-art">' + art + "</div>" : label ? '<div class="media-fallback">' + label + "</div>" : "") +
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
  setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(function () { t.remove(); }, 300); }, 2800);
};

RD.copy = function (text, label) {
  var done = function () { RD.toast((label || "Copied") + " to clipboard"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
  else done();
};

/* Gráfico de barras simples. series = [{date:'YYYY-MM-DD', <key>: n}] */
RD.bars = function (series, key, fmt) {
  if (!series.length) return '<div class="empty">No data yet.</div>';
  var max = Math.max.apply(null, series.map(function (d) { return Math.abs(d[key]); })) || 1;
  var html = '<div class="bars">' + series.map(function (d) {
    return '<div class="bar' + (d[key] < 0 ? " neg" : "") + '" style="height:' + Math.max(2, (Math.abs(d[key]) / max) * 100) + '%" data-tip="' + d.date.slice(5) + " · " + fmt(d[key]) + '"></div>';
  }).join("") + "</div>";
  html += '<div class="bars-axis"><span>' + series[0].date.slice(5) + "</span><span>" + series[Math.floor(series.length / 2)].date.slice(5) + "</span><span>" + series[series.length - 1].date.slice(5) + "</span></div>";
  return html;
};
