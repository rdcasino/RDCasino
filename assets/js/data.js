/* ==========================================================================
   RDCasino — Catálogo e configuração (NÃO contém jogadores nem transações).
   Tudo que é atividade real (contas, apostas, saques, KYC, afiliados) vive
   em store.js e começa zerado.
   ========================================================================== */

window.RD = window.RD || {};

/* Modo REAL (servidor Supabase) x modo demonstração (dados no navegador).
   Por enquanto o modo real fica escondido: abra o site com ?live=1 para ligar
   e ?live=0 para voltar. Quando lançar, troque LIVE_DEFAULT para true. */
var LIVE_DEFAULT = false;
RD.supabaseConfig = {
  url: "https://szhmaytfipnzcdulotli.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6aG1heXRmaXBuemNkdWxvdGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDYxMDksImV4cCI6MjA4NzAyMjEwOX0.l9DkjbnR-5AcFiSvz4jmNuIWpEL2EdhV9HW6zMMmaEA" // chave pública (anon): pode ficar no site, o banco é protegido por RLS
};
RD.live = (function () {
  try {
    var m = location.search.match(/[?&]live=([01])/);
    if (m) localStorage.setItem("rd_live", m[1]);
    var v = localStorage.getItem("rd_live");
    return v === null ? LIVE_DEFAULT : v === "1";
  } catch (e) { return LIVE_DEFAULT; }
})() && !!window.supabase;

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
  minDeposit: 10, // depósito mínimo em USD (vale para todas as moedas; se a Kraken exigir mais numa moeda, vale o maior)
  maxProfit: 0, // lucro máximo por aposta nos originais (0 = sem limite; muda no admin)
  leaderboardPrizes: [15000, 9000, 6000, 4000, 3000, 2500, 2000, 1500, 1200, 1000],
  kycWithdrawLimit: 2000,
  rakebackRate: 0.02, // 2% da vantagem da casa volta como rakeback instantâneo
  /* Bônus recorrentes. Base de cálculo = vantagem da casa gerada pelo jogador no período
     (valor apostado × vantagem da casa de cada jogo). "rate" = fatia dessa vantagem que volta.
     minTier = nível VIP mínimo para liberar. Soma máxima (sem recarga): 5% + 5% + 7,5% + 10% = 27,5% da vantagem da casa. */
  bonuses: {
    daily:   { label: "Daily Bonus",   rate: 0.03,  hours: 24,  minTier: "Bronze 2" },
    weekly:  { label: "Weekly Bonus",  rate: 0.04,  hours: 168, minTier: "Silver 1" },
    monthly: { label: "Monthly Bonus", rate: 0.05,  hours: 720, minTier: "Silver 1" },
    reload:  { label: "VIP Reload", minTier: "Gold 1" }   // só aparece quando o admin dá (Jogadores → VIP Reload), a partir do Gold
  }
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
  { id: "affiliate", art: "scene:affiliate", tag: "Affiliates", title: "Earn 15% commission", sub: "Lifetime revenue share, paid in crypto.", cta: "Start earning", route: "affiliate", img: "assets/img/banners/affiliate.jpg", c1: "#0e7490", c2: "#083344" }
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
  { id: "coinflip", name: "Coinflip", provider: "RD Originals", cat: "originals", rtp: 99, edge: 1, playable: true, tag: "new", c1: "#ffc23a", c2: "#7a4a00" },
  { id: "rps", name: "Rock Paper Scissors", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#7c5cff", c2: "#21124f" },
  { id: "baccarat", name: "Baccarat", provider: "RD Originals", cat: "originals", rtp: 98.9, edge: 1.1, playable: true, tag: "new", c1: "#ff2e55", c2: "#4a0716" },
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
/* Níveis VIP: valor total apostado para chegar no nível e prêmio de subida (pago uma vez, o jogador resgata).
   Prêmios = metade da tabela de referência (0,2% do apostado na maioria dos níveis). */
RD.vipFamilies = {
  bronze: { label: "Bronze", c1: "#f0a066", c2: "#8a4a1c" },
  silver: { label: "Silver", c1: "#eef3f8", c2: "#8d9cae" },
  gold: { label: "Gold", c1: "#ffe08a", c2: "#c98a00" },
  jade: { label: "Jade", c1: "#6ff0bd", c2: "#0f8a5c" },
  sapphire: { label: "Sapphire", c1: "#7aa7ff", c2: "#1f3fae" },
  emerald: { label: "Emerald", c1: "#4ff08a", c2: "#0a7a3a" },
  ruby: { label: "Ruby", c1: "#ff7a90", c2: "#a80f2e" },
  obsidian: { label: "Obsidian", c1: "#9a86ad", c2: "#2e2340" },
  amethyst: { label: "Amethyst", c1: "#e08aff", c2: "#7a1fb0" }
};
RD.vipTiers = [
  { name: "Bronze 1", wager: 1000, reward: 2, family: "bronze" },
  { name: "Bronze 2", wager: 5000, reward: 10, family: "bronze" },
  { name: "Bronze 3", wager: 15000, reward: 30, family: "bronze" },
  { name: "Bronze 4", wager: 50000, reward: 100, family: "bronze" },
  { name: "Silver 1", wager: 100000, reward: 200, family: "silver" },
  { name: "Silver 2", wager: 150000, reward: 300, family: "silver" },
  { name: "Silver 3", wager: 200000, reward: 400, family: "silver" },
  { name: "Silver 4", wager: 250000, reward: 500, family: "silver" },
  { name: "Gold 1", wager: 300000, reward: 600, family: "gold" },
  { name: "Gold 2", wager: 350000, reward: 700, family: "gold" },
  { name: "Gold 3", wager: 400000, reward: 800, family: "gold" },
  { name: "Gold 4", wager: 450000, reward: 900, family: "gold" },
  { name: "Jade 1", wager: 500000, reward: 1000, family: "jade" },
  { name: "Jade 2", wager: 600000, reward: 1200, family: "jade" },
  { name: "Jade 3", wager: 700000, reward: 1400, family: "jade" },
  { name: "Jade 4", wager: 800000, reward: 1600, family: "jade" },
  { name: "Jade 5", wager: 900000, reward: 1800, family: "jade" },
  { name: "Sapphire 1", wager: 1000000, reward: 2000, family: "sapphire" },
  { name: "Sapphire 2", wager: 1500000, reward: 3000, family: "sapphire" },
  { name: "Emerald 1", wager: 2000000, reward: 4000, family: "emerald" },
  { name: "Emerald 2", wager: 2500000, reward: 5000, family: "emerald" },
  { name: "Ruby 1", wager: 3000000, reward: 6000, family: "ruby" },
  { name: "Ruby 2", wager: 3500000, reward: 7000, family: "ruby" },
  { name: "Obsidian 1", wager: 4000000, reward: 8000, family: "obsidian" },
  { name: "Obsidian 2", wager: 4500000, reward: 9000, family: "obsidian" },
  { name: "Amethyst 1", wager: 5000000, reward: 10000, family: "amethyst" },
  { name: "Amethyst 2", wager: 7500000, reward: 15000, family: "amethyst" },
  { name: "Amethyst 3", wager: 10000000, reward: 20000, family: "amethyst" }
];
RD.vipTiers.forEach(function (t) { t.color = RD.vipFamilies[t.family].c1; });

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
  { tier: 1, label: "Standard", min: 0, max: Infinity, range: "Every player you refer", share: 15 }
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
