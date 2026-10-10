/* ==========================================================================
   RDCasino — Catálogo e configuração (NÃO contém jogadores nem transações).
   Tudo que é atividade real (contas, apostas, saques, KYC, afiliados) vive
   em store.js e começa zerado.
   ========================================================================== */

window.RD = window.RD || {};

/* Modo REAL (servidor Supabase) x modo demonstração (dados no navegador).
   Por enquanto o modo real fica escondido: abra o site com ?live=1 para ligar
   e ?live=0 para voltar. Quando lançar, troque LIVE_DEFAULT para true. */
var LIVE_DEFAULT = true; // modo real é o padrão (?live=0 abre a demonstração)
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
  /* Peso de cada aposta no progresso VIP (o total apostado real não muda). Igual a game_tables.vip_weights no servidor. */
  vipWeights: { default: 1, dice: 0.75, limbo: 0.75, sports: 3, slots: 1, live: 1 },
  rakebackRate: 0.02, // 2% da vantagem da casa volta como rakeback instantâneo
  /* Bônus recorrentes. Base de cálculo = vantagem da casa gerada pelo jogador no período
     (valor apostado × vantagem da casa de cada jogo). "rate" = fatia dessa vantagem que volta.
     minTier = nível VIP mínimo para liberar. Soma máxima (sem recarga): 5% + 5% + 7,5% + 10% = 27,5% da vantagem da casa. */
  bonuses: {
    daily:   { label: "Daily Bonus",   rate: 0.03,  hours: 24,  minTier: "Bronze 3" },
    weekly:  { label: "Weekly Bonus",  rate: 0.04,  hours: 168, minTier: "Gold 2" },
    monthly: { label: "Monthly Bonus", rate: 0.05,  hours: 720, minTier: "Gold 2" },
    reload:  { label: "VIP Reload", minTier: "Jade 2" }   // só aparece quando o admin dá (Jogadores → VIP Reload), a partir do Jade 2
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
  { id: "vip", art: "scene:vip", tag: "VIP Club", title: "Over $10,000 in rewards", sub: "A cash reward at every VIP level.", cta: "Open VIP Club", route: "vip", img: "assets/img/banners/vip.jpg", c1: "#8a1f5c", c2: "#1f0618" },
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
  { id: "dice", name: "Dice", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "hot", c1: "#1e40af", c2: "#0b1d4f" },
  { id: "limbo", name: "Limbo", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#6d28d9", c2: "#2a0f5c" },
  { id: "crash", name: "Crash", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "hot", c1: "#be123c", c2: "#4c0519" },
  { id: "mines", name: "Mines", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, c1: "#047857", c2: "#022c22" },
  { id: "plinko", name: "Plinko", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, c1: "#c026d3", c2: "#4a044e" },
  { id: "keno", name: "Keno", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, c1: "#0369a1", c2: "#082f49" },
  { id: "hilo", name: "Hi-Lo", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, c1: "#b45309", c2: "#451a03" },
  { id: "blackjack", name: "Blackjack", provider: "RD Originals", cat: "originals", rtp: 99.1, edge: 0.9, playable: true, tag: "new", c1: "#22b35e", c2: "#063a1c" },
  { id: "roulette", name: "Roulette", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#5b5bf0", c2: "#15124a" },
  { id: "baccarat", name: "Baccarat", provider: "RD Originals", cat: "originals", rtp: 98.9, edge: 1.1, playable: true, tag: "new", c1: "#ff2e55", c2: "#4a0716" },
  { id: "double", name: "Double", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#ff2e55", c2: "#2a0710" },
  { id: "coinflip", name: "Coinflip", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#ffc23a", c2: "#7a4a00" },
  { id: "tower", name: "Tower", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#16c98d", c2: "#06352a" },
  { id: "chicken", name: "Chicken", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#ffb020", c2: "#6b2a00" },
  { id: "door", name: "Door", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#8a3ffc", c2: "#1d0b3d" },
  { id: "soccer", name: "Soccer", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#22b35e", c2: "#062a16" },
  { id: "wheel", name: "Wheel", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, c1: "#4338ca", c2: "#1e1b4b" },
  { id: "rps", name: "Rock Paper Scissors", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#7c5cff", c2: "#21124f" },
  { id: "spill", name: "Spill", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#1f8fff", c2: "#0b1d4f" },
  { id: "pump", name: "Pump", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#3fdc4a", c2: "#0b3d1a" },
  { id: "lake", name: "Cross the Lake", provider: "RD Originals", cat: "originals", rtp: 98, edge: 2, playable: true, tag: "new", c1: "#1fb6ff", c2: "#0a3a5c" },
  { id: "gates-olympus", pp: "vs20olympx", name: "Gates of Olympus 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, tag: "hot", c1: "#a16207", c2: "#3f2a04" },
  { id: "sweet-bonanza", pp: "vs20fruitswx", name: "Sweet Bonanza 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.53, c1: "#db2777", c2: "#500724" },
  { id: "sugar-rush", pp: "vs20sugarrushx", name: "Sugar Rush 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.53, c1: "#e11d48", c2: "#4c0519" },
  { id: "wanted", name: "Wanted Dead or a Wild", provider: "Hacksaw Gaming", cat: "slots", rtp: 96.38, c1: "#9a3412", c2: "#3b1406" },
  { id: "mental-2", name: "Mental II", provider: "Nolimit City", cat: "slots", rtp: 96.06, c1: "#3f3f46", c2: "#121214" },
  { id: "starlight", pp: "vs20starlightx", name: "Starlight Princess 1000", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, c1: "#7c3aed", c2: "#2e1065" },
  { id: "big-bass", pp: "vs10bbbonanza", name: "Big Bass Bonanza", provider: "Pragmatic Play", cat: "slots", rtp: 96.71, c1: "#0e7490", c2: "#083344" },
  { id: "book-dead", name: "Book of Dead", provider: "Play'n GO", cat: "slots", rtp: 96.21, c1: "#a16207", c2: "#3f2a04" },
  { id: "temujin", pp: "vs1024temuj", name: "Temujin Treasures", provider: "Pragmatic Play", cat: "slots", rtp: 96.55, c1: "#9a3412", c2: "#3b1406" },
  { id: "gates-olympus-classic", pp: "vs20olympgate", name: "Gates of Olympus", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, c1: "#3b2a7a", c2: "#120a33" },
  { id: "sweet-bonanza-classic", pp: "vs20fruitsw", name: "Sweet Bonanza", provider: "Pragmatic Play", cat: "slots", rtp: 96.48, c1: "#db2777", c2: "#500724" },
  { id: "dog-house-classic", pp: "vs20doghouse", name: "The Dog House", provider: "Pragmatic Play", cat: "slots", rtp: 96.51, c1: "#0284c7", c2: "#082f49" },
  { id: "sugar-rush-classic", pp: "vs20sugarrush", name: "Sugar Rush", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, c1: "#e11d48", c2: "#4c0519" },
  { id: "starlight-classic", pp: "vs20starlight", name: "Starlight Princess", provider: "Pragmatic Play", cat: "slots", rtp: 96.5, c1: "#7c3aed", c2: "#2e1065" },
  { id: "lightning-roulette", name: "Lightning Roulette", provider: "Evolution", cat: "live", rtp: 97.3, tag: "hot", c1: "#a16207", c2: "#3f2a04" },
  { id: "lightning-blackjack", name: "Lightning Blackjack", provider: "Evolution", cat: "live", rtp: 99.56, c1: "#166534", c2: "#052e16" },
  { id: "golden-wealth-baccarat", name: "Golden Wealth Baccarat", provider: "Evolution", cat: "live", rtp: 98.76, c1: "#9f1239", c2: "#4c0519" },
  { id: "immersive-roulette", name: "Immersive Roulette", provider: "Evolution", cat: "live", rtp: 97.3, c1: "#991b1b", c2: "#450a0a" },
  { id: "crazy-time", name: "Crazy Time", provider: "Evolution", cat: "gameshows", rtp: 96.08, tag: "hot", c1: "#be185d", c2: "#500724" },
  { id: "monopoly", name: "Monopoly Live", provider: "Evolution", cat: "gameshows", rtp: 96.23, c1: "#15803d", c2: "#052e16" },
  { id: "dream-catcher", name: "Dream Catcher", provider: "Evolution", cat: "gameshows", rtp: 96.58, c1: "#6d28d9", c2: "#2e1065" },
  { id: "funky-time", name: "Funky Time", provider: "Evolution", cat: "gameshows", rtp: 95.99, tag: "new", c1: "#c026d3", c2: "#4a044e" }
];
RD.games.forEach(function (g) { g.img = "assets/img/games/" + g.id + ".jpg"; g.enabled = true; });
/* Pragmatic Play: foto oficial (CDN deles) e modo demo (jogo grátis embutido; dinheiro real chega com o agregador) */
RD.ppImg = "https://common-static.ppgames.net/game_pic/square/200/";
RD.ppDemo = function (sym) { return "https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=" + encodeURIComponent(sym) + "&lang=en&cur=USD&jurisdiction=99&lobbyUrl=" + encodeURIComponent(location.origin); };
/* Logo mais largo que o card: versão vertical montada a partir da foto oficial, hospedada no site (nome inteiro, sem corte) */
RD.ppLocal = ["sugar-rush", "big-bass", "sweet-bonanza-classic"];
RD.games.forEach(function (g) { if (g.pp) { g.img = RD.ppLocal.indexOf(g.id) > -1 ? "assets/img/games/" + g.id + ".jpg" : RD.ppImg + g.pp + ".png"; g.demo = true; } });

/* Promoções (todas reais e funcionando no site). value = título grande na arte; title = nome do card.
   cat: casino | sports. route/cta = para onde o botão leva. featured = destaque no topo. */
RD.promotions = [
  { id: "race", art: "scene:race", cat: "casino", featured: true, badge: "Monthly race", value: "$50,000 Leaderboard", sub: "Top 10 wagerers get paid every month.", title: "$50,000 Monthly Leaderboard",
    desc: "Every bet on RD Originals counts toward the monthly race — no opt-in. The top 10 wagerers of the calendar month (UTC) share a $50,000 prize pool: $15,000 for first place down to $1,000 for tenth. Prizes are paid to your balance after the month closes.", cta: "See the standings", route: "leaderboard", ends: "month", status: "active" },
  { id: "vip", art: "scene:vip", cat: "casino", badge: "VIP Club", value: "Over $10,000 in rewards", sub: "A cash reward at every VIP level.", title: "VIP Level-Up Rewards",
    desc: "Climb from Bronze 1 to Amethyst 4 just by playing. Every level unlocks a one-time cash reward — from $2 at Bronze 1 to $1,000 at the Ruby and Amethyst levels — paid straight to your balance with no wagering. Your level never goes down.", cta: "Open VIP Club", route: "vip", status: "active" },
  { id: "rain", art: "scene:rain", cat: "casino", badge: "Every hour", value: "Hourly Rain", sub: "Free money splits in the chat every hour.", title: "Hourly Rain",
    desc: "Every hour a rain pot drops in the chat. Click Join before the timer ends and the pot is split equally between everyone who joined. Open to players with $5,000 wagered in the last 7 days. Players can add to the pot too.", cta: "Open the chat", route: "chat", status: "active" },
  { id: "rakeback", art: "scene:rakeback", cat: "casino", badge: "Instant", value: "Instant Rakeback", sub: "Part of every bet comes back to you.", title: "Instant Rakeback",
    desc: "2% of the house edge of every bet you place comes back as rakeback. It builds up as you play and you can claim it any time in Rewards.", cta: "Claim in Rewards", route: "vip", status: "active" },
  { id: "bonuses", art: "scene:reload", cat: "casino", badge: "Daily · Weekly · Monthly", value: "Recurring Bonuses", sub: "Get paid back for playing — every day.", title: "Daily, Weekly & Monthly Bonuses",
    desc: "Your recent play pays you back: the Daily Bonus unlocks at Bronze 3 and the Weekly and Monthly Bonuses at Gold 2. The more you play, the bigger they get. Claim them in Rewards when the timer is up.", cta: "Open Rewards", route: "vip", status: "active" },
  { id: "codes", art: "scene:codes", cat: "casino", badge: "Social drops", value: "Bonus Codes", sub: "Grab our codes before they run out.", title: "Bonus Codes",
    desc: "We drop bonus codes on our socials and in the chat. Type a code in \"Have a code?\" under Rewards to add it to your balance — first come, first served. Each code can be used once per account.", cta: "Redeem a code", route: "vip", status: "active" },
  { id: "affiliate", art: "scene:affiliate", cat: "casino", badge: "Partners", value: "Earn 15% for life", sub: "Invite friends and earn from every bet.", title: "RD Partners — 15% Revenue Share",
    desc: "Share your referral link and earn 15% of the net gaming revenue of every player you bring, for life. Track everything in real time and collect your commission to your balance any time.", cta: "Become a partner", route: "affiliate", status: "active" }
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
  amethyst: { label: "Amethyst", c1: "#e08aff", c2: "#7a1fb0" }
};
RD.vipTiers = [
  { name: "Bronze 1", wager: 1000, reward: 2, family: "bronze" },
  { name: "Bronze 2", wager: 2500, reward: 2, family: "bronze" },
  { name: "Bronze 3", wager: 5000, reward: 3, family: "bronze" },
  { name: "Bronze 4", wager: 10000, reward: 5, family: "bronze" },
  { name: "Silver 1", wager: 15000, reward: 5, family: "silver" },
  { name: "Silver 2", wager: 20000, reward: 5, family: "silver" },
  { name: "Silver 3", wager: 30000, reward: 10, family: "silver" },
  { name: "Silver 4", wager: 50000, reward: 20, family: "silver" },
  { name: "Gold 1", wager: 75000, reward: 25, family: "gold" },
  { name: "Gold 2", wager: 100000, reward: 25, family: "gold" },
  { name: "Gold 3", wager: 150000, reward: 50, family: "gold" },
  { name: "Gold 4", wager: 200000, reward: 50, family: "gold" },
  { name: "Jade 1", wager: 250000, reward: 50, family: "jade" },
  { name: "Jade 2", wager: 300000, reward: 50, family: "jade" },
  { name: "Jade 3", wager: 400000, reward: 100, family: "jade" },
  { name: "Jade 4", wager: 500000, reward: 100, family: "jade" },
  { name: "Sapphire 1", wager: 600000, reward: 100, family: "sapphire" },
  { name: "Sapphire 2", wager: 750000, reward: 150, family: "sapphire" },
  { name: "Sapphire 3", wager: 1000000, reward: 250, family: "sapphire" },
  { name: "Sapphire 4", wager: 1250000, reward: 250, family: "sapphire" },
  { name: "Emerald 1", wager: 1500000, reward: 250, family: "emerald" },
  { name: "Emerald 2", wager: 2000000, reward: 500, family: "emerald" },
  { name: "Emerald 3", wager: 2500000, reward: 500, family: "emerald" },
  { name: "Emerald 4", wager: 3000000, reward: 500, family: "emerald" },
  { name: "Ruby 1", wager: 3500000, reward: 500, family: "ruby" },
  { name: "Ruby 2", wager: 4000000, reward: 500, family: "ruby" },
  { name: "Ruby 3", wager: 5000000, reward: 1000, family: "ruby" },
  { name: "Ruby 4", wager: 6000000, reward: 1000, family: "ruby" },
  { name: "Amethyst 1", wager: 7000000, reward: 1000, family: "amethyst" },
  { name: "Amethyst 2", wager: 8000000, reward: 1000, family: "amethyst" },
  { name: "Amethyst 3", wager: 9000000, reward: 1000, family: "amethyst" },
  { name: "Amethyst 4", wager: 10000000, reward: 1000, family: "amethyst" }
];
RD.vipTiers.forEach(function (t, i) { t.color = RD.vipFamilies[t.family].c1; t.cum = (i ? RD.vipTiers[i - 1].cum : 0) + t.reward; }); // cum: soma dos prêmios até o nível
RD.vipWeight = function (game) { var w = RD.config.vipWeights || {}; return w[game] != null ? w[game] : (w["default"] != null ? w["default"] : 1); };
/* direito acumulado do VIP: soma dos prêmios dos níveis alcançados; o resgate paga a diferença para o que já foi pago */
RD.vipEntitled = function (xp) { var e = 0; RD.vipTiers.forEach(function (t) { if (xp >= t.wager) e = t.cum; }); return e; };

RD.wallet = {
  coins: [
    { sym: "USDT", name: "Tether", nets: ["TRC20", "ERC20", "BEP20"], color: "#26a17b" },
    { sym: "BTC", name: "Bitcoin", nets: ["Bitcoin"], color: "#f7931a" },
    { sym: "ETH", name: "Ethereum", nets: ["ERC20", "Arbitrum"], color: "#627eea" },
    { sym: "SOL", name: "Solana", nets: ["Solana"], color: "#9945ff" },
    { sym: "LTC", name: "Litecoin", nets: ["Litecoin"], color: "#345d9d" },
    { sym: "DOGE", name: "Dogecoin", nets: ["Dogecoin"], color: "#c2a633" }
  ]
};

/* Cotação em dólar de cada moeda (o modo real troca por valores do servidor, atualizados a cada 2 min).
   O saldo é sempre em dólar por dentro; a moeda escolhida no cabeçalho só muda a exibição. */
RD.prices = { USDT: 1, USDC: 1, BTC: 80000, ETH: 2400, SOL: 105, LTC: 61, DOGE: 0.08, TRX: 0.33 };
/* Moedas para exibir o saldo: [código, símbolo, nome, casas decimais (padrão 2), formato do número] */
RD.fiats = [["USD", "$", "US Dollar"], ["BRL", "R$", "Brazilian Real", 2, "pt-BR"], ["ARS", "AR$", "Argentine Peso", 0, "es-AR"], ["CAD", "CA$", "Canadian Dollar"], ["EUR", "€", "Euro"], ["GBP", "£", "British Pound"], ["MXN", "MX$", "Mexican Peso"], ["CLP", "CLP$", "Chilean Peso", 0, "es-CL"], ["AUD", "A$", "Australian Dollar"], ["JPY", "¥", "Japanese Yen", 0], ["INR", "₹", "Indian Rupee"], ["TRY", "₺", "Turkish Lira"], ["PHP", "₱", "Philippine Peso"]];
/* câmbio de reserva (modo demonstração); no modo real vem do servidor */
["BRL:5.02", "ARS:1516", "CAD:1.42", "EUR:0.89", "GBP:0.76", "MXN:18.2", "CLP:978", "AUD:1.44", "JPY:157.8", "INR:96.8", "TRY:49.2", "PHP:63"].forEach(function (x) { var k = x.split(":"); RD.prices["FX:" + k[0]] = +k[1]; });
RD.coinNames = { USDT: "Tether", USDC: "USD Coin", BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", LTC: "Litecoin", DOGE: "Dogecoin", TRX: "Tron" };

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

/* Fotos enviadas para assets/img: liste o caminho aqui ao subir uma (ex.: "assets/img/games/chicken.jpg").
   Sem estar na lista, o site usa a ilustração própria e não faz pedido nenhum ao servidor (evita dezenas de 404 por página). */
RD.imgFiles = ["sugar-rush", "big-bass", "sweet-bonanza-classic", "wanted", "mental-2", "book-dead", "lightning-roulette", "lightning-blackjack", "golden-wealth-baccarat", "immersive-roulette", "crazy-time", "monopoly", "dream-catcher", "funky-time"].map(function (id) { return "assets/img/games/" + id + ".jpg"; }); // fotos oficiais dos provedores, hospedadas no site
RD.hasImg = function (src) { return !!src && (/^(https?|data|blob):/.test(src) || RD.imgFiles.indexOf(src) > -1); };

RD.media = function (o, cls, label) {
  var key = o.art || (o.cat === "originals" ? "cover:" + o.id : ""), art = key && RD.art && RD.art.has(key) ? RD.art.render(key, o.artPalette) : "";
  return '<div class="media ' + (cls || "") + (art ? " has-art" : "") + '" style="--c1:' + (o.c1 || "#20161e") + ";--c2:" + (o.c2 || "#0e090d") + '">' +
    (art ? '<div class="media-art">' + art + "</div>" : label ? '<div class="media-fallback">' + label + "</div>" : "") +
    (RD.hasImg(o.img) ? '<img src="' + (/^(https?|data|blob):/.test(o.img) ? "" : RD.imgBase || "") + o.img + '" alt="" loading="lazy" data-rm-err>' : "") +
    "</div>";
};

// imagem quebrada some (sem onerror inline, para a CSP bloquear scripts inline)
document.addEventListener("error", function (e) { var t = e.target; if (t && t.hasAttribute && t.hasAttribute("data-rm-err")) t.remove(); }, true);

RD.toast = function (msg, type) {
  var box = document.querySelector(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
  /* mesma mensagem já na tela: não repete; no máximo 3 avisos de cada vez */
  if ([].some.call(box.children, function (x) { return x.textContent === msg; })) return;
  while (box.children.length >= 2) box.firstChild.remove();
  var t = document.createElement("div"), err = type === "error";
  t.className = "toast" + (err ? " error" : "");
  t.innerHTML = '<i class="toast-ic" aria-hidden="true">' + (err ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>' : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>') + '</i><span></span>';
  t.lastChild.textContent = msg;
  var close = function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 220); };
  t.addEventListener("click", close);
  box.appendChild(t);
  setTimeout(close, err ? 3400 : 2400);
};

/* ---------- Sons dos originais (gerados na hora com Web Audio: nada para baixar) ---------- */
RD.sfx = (function () {
  var ac = null, muted = false, last = {};
  try { muted = localStorage.getItem("rd_mute") === "1"; } catch (e) {}
  /* Liga o áudio no primeiro toque (pointerdown), antes do clique: o 1º clique de aposta não paga esse custo */
  function warm() { document.removeEventListener("pointerdown", warm, true); document.removeEventListener("keydown", warm, true); if (!muted) try { ctx(); } catch (e) {} }
  document.addEventListener("pointerdown", warm, true); document.addEventListener("keydown", warm, true);
  function ctx() { if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); } if (ac.state === "suspended") ac.resume(); return ac; }
  function tone(f, dur, type, vol, at, slide) {
    var a = ctx(); if (!a) return; var t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, lp) {
    var a = ctx(); if (!a) return; var n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = "lowpass"; f.frequency.value = lp || 900; g.gain.value = vol || 0.3;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  var S = {
    bet: function () { tone(520, 0.06, "triangle", 0.07); },
    tick: function () { tone(1250 + Math.random() * 250, 0.035, "sine", 0.045); },
    pin: function () { tone(1700 + Math.random() * 500, 0.03, "sine", 0.03); },
    step: function () { tone(660, 0.07, "triangle", 0.08); tone(990, 0.06, "triangle", 0.05, 0.05); },
    gem: function () { tone(1320, 0.12, "sine", 0.09); tone(1980, 0.16, "sine", 0.06, 0.05); },
    card: function () { noise(0.06, 0.12, 3200); },
    win: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.16, "triangle", 0.08, i * 0.06); }); },
    small: function () { tone(880, 0.1, "triangle", 0.07); tone(1320, 0.14, "triangle", 0.06, 0.07); },
    lose: function () { tone(220, 0.22, "sine", 0.09, 0, 140); },
    boom: function () { noise(0.45, 0.45, 700); tone(110, 0.35, "sine", 0.12, 0, 50); },
    cash: function () { tone(1568, 0.08, "square", 0.04); tone(2093, 0.22, "triangle", 0.07, 0.07); }
  };
  /* Música ambiente (Cross the Lake): batida lo-fi de hip-hop gerada aqui, volume baixo, sem arquivo */
  var mus = { on: false, timer: null, step: 0, next: 0, out: null };
  try { mus.pref = localStorage.getItem("rd_music") !== "0"; } catch (e) { mus.pref = true; }
  var BPM = 84, SIX = 60 / BPM / 4;
  var CH = [[57, 60, 64, 67], [50, 57, 60, 65], [55, 59, 62, 65], [48, 55, 59, 64]]; // Am7 Dm7 G7 Cmaj7
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function mtone(a, f, t, dur, type, vol, slide) {
    var o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(mus.out); o.start(t); o.stop(t + dur + 0.05);
  }
  function mnoise(a, t, dur, vol, type, freq) {
    var n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = type; f.frequency.value = freq; g.gain.value = vol;
    src.buffer = b; src.connect(f); f.connect(g); g.connect(mus.out); src.start(t);
  }
  function beat(a, i, t) {
    var s16 = i % 16, bar = Math.floor(i / 16) % 4, sw = (i % 2) ? SIX * 0.12 : 0; t += sw;
    if (s16 === 0 || s16 === 10) mtone(a, 120, t, 0.32, "sine", 0.9, 45);            // bumbo
    if (s16 === 4 || s16 === 12) mnoise(a, t, 0.18, 0.45, "bandpass", 1800);           // caixa
    if (s16 % 2 === 0) mnoise(a, t, 0.04, s16 % 4 ? 0.12 : 0.2, "highpass", 7000);     // chimbal
    if (s16 === 0) CH[bar].forEach(function (m, k) { mtone(a, hz(m), t + k * 0.012, SIX * 15, "triangle", 0.08); }); // acorde
    if (s16 === 0 || s16 === 7 || s16 === 10) mtone(a, hz(CH[bar][0] - 12), t, SIX * 2.6, "sine", 0.45);              // baixo
    if (s16 === 14 && bar === 3) mtone(a, hz(CH[bar][3] + 12), t, 0.4, "sine", 0.06);
  }
  function startMusic() {
    if (mus.on || muted || !mus.pref) return; var a = ctx(); if (!a) return;
    if (!mus.out) { var lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400; mus.out = a.createGain(); mus.out.connect(lp); lp.connect(a.destination); }
    mus.out.gain.cancelScheduledValues(a.currentTime); mus.out.gain.setValueAtTime(0.0001, a.currentTime); mus.out.gain.exponentialRampToValueAtTime(0.055, a.currentTime + 1.5);
    mus.on = true; mus.next = a.currentTime + 0.1;
    mus.timer = setInterval(function () {
      if (a.state !== "running") return;
      while (mus.next < a.currentTime + 0.25) { beat(a, mus.step, mus.next); mus.step++; mus.next += SIX; }
      if (mus.next < a.currentTime) mus.next = a.currentTime + 0.05;
    }, 60);
  }
  function stopMusic() {
    if (!mus.on) return; mus.on = false; clearInterval(mus.timer); mus.timer = null;
    if (ac && mus.out) { mus.out.gain.cancelScheduledValues(ac.currentTime); mus.out.gain.setValueAtTime(mus.out.gain.value, ac.currentTime); mus.out.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3); }
  }
  return {
    music: { start: startMusic, stop: stopMusic, on: function () { return mus.pref && !muted; },
      toggle: function () { mus.pref = !mus.pref; try { localStorage.setItem("rd_music", mus.pref ? "1" : "0"); } catch (e) {} if (mus.pref) startMusic(); else stopMusic(); return mus.pref; } },
    play: function (k, gap) { if (muted || !S[k]) return; var now = Date.now(); if (now - (last[k] || 0) < (gap == null ? 40 : gap)) return; last[k] = now; try { S[k](); } catch (e) {} },
    muted: function () { return muted; },
    toggle: function () { muted = !muted; try { localStorage.setItem("rd_mute", muted ? "1" : "0"); } catch (e) {} if (!muted) S.small(); if (muted) stopMusic(); return muted; }
  };
})();

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
