/* ==========================================================================
   RDCasino — "Backend" de demonstração (começa ZERADO).
   Site e admin leem e gravam os mesmos dados (localStorage do navegador),
   e abas abertas se atualizam sozinhas. Cada função pública aqui é um
   endpoint que o servidor real terá (com autenticação e banco de dados).
   ========================================================================== */
(function () {
  "use strict";
  var KEY = "rd_db_v2", SESSION = "rd_session";
  var listeners = [];

  function nowIso() { return new Date().toISOString(); }
  function round(n) { return Math.round(n * 100) / 100; }
  function rnd(bytes) { var a = new Uint8Array(bytes); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  // Hash simples SÓ para a demonstração. No servidor real: bcrypt/argon2.
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

  function empty() {
    return {
      players: [], tx: [], bets: [], chat: [], clicks: {}, audit: [], seq: 1000, admin: null,
      fixes: { resetFlamengo10: true, vipV2: true }, // correções pontuais só valem para dados antigos
      games: RD.games.map(function (g) { return { id: g.id, enabled: true, tag: g.tag || "" }; }),
      promotions: JSON.parse(JSON.stringify(RD.promotions)),
      settings: { restricted: RD.config.restrictedCountries.slice(), license: JSON.parse(JSON.stringify(RD.config.license)), leaderboardPrize: RD.config.leaderboardPrize }
    };
  }
  function read() { try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  /* Ajustes em dados antigos: rodada única → uma rodada por jogo; correções pontuais pedidas pelo dono */
  function migrate(d) {
    if (!d) return d;
    d.fixes = d.fixes || {};
    RD.games.forEach(function (g) { if (!d.games.some(function (x) { return x.id === g.id; })) d.games.push({ id: g.id, enabled: true, tag: g.tag || "" }); });
    d.players.forEach(function (p) {
      p.rounds = p.rounds || {};
      if (p.activeRound) { p.rounds[p.activeRound.game] = p.activeRound; }
      delete p.activeRound;
    });
    if (!d.fixes.vipV2) {
      // Níveis VIP novos (Wood $10k … Jade 1 $500k): prêmios resgatados nos níveis antigos não contam mais
      d.players.forEach(function (p) { p.claimedTiers = []; });
      d.fixes.vipV2 = true;
    }
    if (!d.fixes.resetFlamengo10) {
      d.players.forEach(function (p) { if (p.username.toLowerCase() === "flamengo10") resetBetsOf(d, p, "Sistema"); });
      d.fixes.resetFlamengo10 = true;
    }
    return d;
  }
  /* Zera o histórico de apostas e as estatísticas de jogo (o saldo não muda) */
  function resetBetsOf(d, p, who) {
    d.bets = d.bets.filter(function (b) { return b.userId !== p.id; });
    var open = p.rounds || {}; Object.keys(open).forEach(function (k) { p.balance = round(p.balance + open[k].amount); });
    p.rounds = {}; p.wagered = 0; p.profit = 0; p.bets = 0; p.rakeback = 0;
    d.audit.unshift({ at: nowIso(), who: who, what: "Zerou as apostas de " + p.username });
  }
  var D = migrate(read()) || empty();

  function apply() {
    D.games.forEach(function (s) { var g = RD.games.filter(function (x) { return x.id === s.id; })[0]; if (g) { g.enabled = s.enabled; g.tag = s.tag; } });
    RD.promotions = D.promotions;
    RD.config.restrictedCountries = D.settings.restricted;
    RD.config.license = D.settings.license;
    RD.config.leaderboardPrize = D.settings.leaderboardPrize;
    RD.config.maxProfit = +D.settings.maxProfit || 0;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }
  function id(prefix) { D.seq++; return prefix + D.seq; }
  function log(who, what) { D.audit.unshift({ at: nowIso(), who: who, what: what }); D.audit = D.audit.slice(0, 500); }
  function byId(pid) { return D.players.filter(function (p) { return p.id === pid; })[0]; }
  function byName(u) { u = String(u || "").toLowerCase().replace(/^@/, ""); return D.players.filter(function (p) { return p.username.toLowerCase() === u || p.email.toLowerCase() === u; })[0]; }
  function ownerOfCode(code) {
    code = String(code || "").toUpperCase();
    return D.players.filter(function (p) { return p.refCode === code || (p.campaigns || []).some(function (c) { return c.code === code; }); })[0];
  }
  function addTx(p, type, amount, status, extra) {
    var t = { id: id("TX-"), userId: p.id, user: p.username, type: type, amount: round(amount), status: status, date: nowIso() };
    if (extra) for (var k in extra) t[k] = extra[k];
    D.tx.unshift(t);
    return t;
  }
  function tierOf(wagered) {
    var cur = null;
    RD.vipTiers.forEach(function (t) { if (wagered >= t.wager) cur = t; });
    return cur;
  }
  function monthKey(iso) { return (iso || nowIso()).slice(0, 7); }

  var db = {
    /* ---------- infraestrutura ---------- */
    data: function () { return D; },
    save: save,
    onChange: function (fn) { listeners.push(fn); },
    reset: function () { D = empty(); apply(); save(); try { localStorage.removeItem(SESSION); } catch (e) {} },

    /* ---------- sessão do jogador ---------- */
    current: function () { var sid; try { sid = localStorage.getItem(SESSION); } catch (e) {} return sid ? byId(sid) || null : null; },
    logout: function () { try { localStorage.removeItem(SESSION); } catch (e) {} },
    player: byId,
    findByName: byName,
    tierOf: tierOf,

    register: function (f) {
      var username = String(f.username || "").trim(), email = String(f.email || "").trim().toLowerCase();
      if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return { error: "Username: 3–16 letters, numbers or _." };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
      if (String(f.pass || "").length < 8) return { error: "Password must have at least 8 characters." };
      if (byName(username) || byName(email)) return { error: "This username or email is already registered." };
      if (D.settings.restricted.some(function (c) { return c.toLowerCase() === String(f.country).toLowerCase(); })) return { error: "We can't accept players from this country." };
      var ref = String(f.ref || "").trim().toUpperCase(), refOwner = ref ? ownerOfCode(ref) : null;
      if (ref && !refOwner) return { error: "Referral code not found." };
      var p = {
        id: id("u_"), username: username, email: email, pass: hash(f.pass), country: f.country, created: nowIso(),
        balance: 0, deposits: 0, withdrawals: 0, wagered: 0, profit: 0, bets: 0,
        rakeback: 0, rakebackClaimed: 0, claimedTiers: [], bonusTotal: 0,
        kyc: "Not started", kycInfo: null, kycReason: "", status: "Active", note: "",
        refCode: username.toUpperCase(), referredBy: refOwner ? ref : "", referrerId: refOwner ? refOwner.id : "",
        affShare: null, affPaid: 0, campaigns: [],
        seeds: { server: rnd(32), client: rnd(8), nonce: 0, revealed: [] }
      };
      D.players.push(p);
      log(username, "Criou conta (" + p.country + ")" + (refOwner ? " — indicado por " + refOwner.username + " via " + ref : ""));
      save();
      try { localStorage.setItem(SESSION, p.id); } catch (e) {}
      return { player: p };
    },
    login: function (user, pass) {
      var p = byName(user);
      if (!p || p.pass !== hash(pass)) return { error: "Wrong username/email or password." };
      try { localStorage.setItem(SESSION, p.id); } catch (e) {}
      return { player: p };
    },
    trackClick: function (code) {
      code = String(code).toUpperCase(); if (!ownerOfCode(code)) return;
      D.clicks[code] = (D.clicks[code] || 0) + 1; save();
    },

    /* ---------- carteira ---------- */
    deposit: function (pid, amount, coin) {
      var p = byId(pid); if (!p) return { error: "Not signed in." };
      if (p.status !== "Active") return { error: "Your account is suspended." };
      if (!(amount > 0)) return { error: "Enter an amount." };
      var first = p.deposits === 0;
      p.balance = round(p.balance + amount); p.deposits = round(p.deposits + amount);
      if (first) p.firstDeposit = nowIso();
      var t = addTx(p, "Deposit", amount, "Completed", { coin: coin });
      log(p.username, "Depósito " + RD.fmt.usd(amount) + " " + coin + " (" + t.id + ")"); save();
      return { tx: t };
    },
    requestWithdrawal: function (pid, amount, coin, address) {
      var p = byId(pid);
      if (!p) return { error: "Not signed in." };
      if (p.status !== "Active") return { error: "Your account is suspended. Contact support." };
      if (!(amount > 0)) return { error: "Enter an amount." };
      if (amount > p.balance) return { error: "Amount is higher than your balance." };
      if (amount > RD.config.kycWithdrawLimit && p.kyc !== "Verified") return { error: "Withdrawals above " + RD.fmt.usd(RD.config.kycWithdrawLimit, { dec: 0 }) + " require identity verification.", kyc: true };
      p.balance = round(p.balance - amount);
      var t = addTx(p, "Withdrawal", amount, "Pending", { coin: coin, address: address });
      log(p.username, "Pediu saque " + RD.fmt.usd(amount) + " (" + t.id + ")"); save();
      return { tx: t };
    },
    tip: function (pid, to, amount) {
      var p = byId(pid), q = byName(to);
      if (!q) return { error: "User not found." };
      if (q.id === pid) return { error: "You can't tip yourself." };
      if (!(amount > 0) || amount > p.balance) return { error: "Invalid amount." };
      p.balance = round(p.balance - amount); q.balance = round(q.balance + amount);
      addTx(p, "Tip sent", amount, "Completed", { sign: -1, note: "to " + q.username });
      addTx(q, "Tip received", amount, "Completed", { note: "from " + p.username });
      log(p.username, "Gorjeta " + RD.fmt.usd(amount) + " para " + q.username); save();
      return { ok: true };
    },
    submitKyc: function (pid, info) {
      var p = byId(pid); p.kyc = "Pending"; p.kycInfo = info; p.kycReason = "";
      log(p.username, "Enviou documentos de KYC"); save();
    },

    /* ---------- apostas (jogos próprios) ---------- */
    seeds: function (pid) { return byId(pid).seeds; },
    rotateSeed: function (pid, newClient) {
      var p = byId(pid), s = p.seeds;
      if (Object.keys(p.rounds || {}).length) return { error: "Finish your open rounds before rotating seeds." };
      s.revealed.unshift({ server: s.server, client: s.client, lastNonce: s.nonce - 1, at: nowIso() });
      s.revealed = s.revealed.slice(0, 20);
      s.server = rnd(32); s.client = newClient || rnd(8); s.nonce = 0; save();
      return { ok: true };
    },
    /* Reserva o próximo nonce na hora (síncrono): duas apostas seguidas nunca
       usam o mesmo número, mesmo com bolas de Plinko em paralelo. */
    reserve: function (pid) {
      var s = byId(pid).seeds, r = { server: s.server, client: s.client, nonce: s.nonce };
      s.nonce++; save(); return r;
    },
    placeBet: function (pid, game, amount, multiplier, win, detail) {
      var p = byId(pid), g = RD.games.filter(function (x) { return x.id === game; })[0] || {};
      if (!(amount > 0) || amount > p.balance + 1e-9) return { error: "Insufficient balance." };
      var payout = win ? round(amount * multiplier) : 0;
      p.balance = round(p.balance - amount + payout);
      p.wagered = round(p.wagered + amount); p.profit = round(p.profit + payout - amount); p.bets++;
      p.rakeback = p.rakeback + amount * ((g.edge || 1) / 100) * RD.config.rakebackRate;
      var b = { id: id("B-"), userId: p.id, user: p.username, game: game, amount: round(amount), multiplier: win ? multiplier : 0, payout: payout, date: nowIso(), detail: detail };
      D.bets.unshift(b); D.bets = D.bets.slice(0, 2000);
      save();
      return b;
    },
    claimRakeback: function (pid) {
      var p = byId(pid), v = Math.floor(p.rakeback * 100) / 100;
      if (v < 0.01) return { error: "Nothing to claim yet." };
      p.rakeback -= v; p.rakebackClaimed = round(p.rakebackClaimed + v); p.balance = round(p.balance + v); p.bonusTotal = round(p.bonusTotal + v);
      addTx(p, "Rakeback", v, "Completed"); log(p.username, "Resgatou rakeback " + RD.fmt.usd(v)); save();
      return { amount: v };
    },
    claimLevel: function (pid, tierName) {
      var p = byId(pid), t = RD.vipTiers.filter(function (x) { return x.name === tierName; })[0];
      if (!t || p.wagered < t.wager || p.claimedTiers.indexOf(tierName) > -1) return { error: "Not available." };
      p.claimedTiers.push(tierName); p.balance = round(p.balance + t.reward); p.bonusTotal = round(p.bonusTotal + t.reward);
      addTx(p, "Level reward", t.reward, "Completed", { note: tierName }); log(p.username, "Resgatou prêmio de nível " + tierName); save();
      return { amount: t.reward };
    },
    /* Rodadas com várias etapas (Mines, Hi-Lo, Crash, Blackjack, Tower, Chicken):
       a aposta sai do saldo no início e fica salva até ser liquidada.
       Cada jogo tem a sua rodada — dá para ter Mines aberto e jogar Dice. */
    activeRound: function (pid, game) { var p = byId(pid); return p && p.rounds ? p.rounds[game] || null : null; },
    activeRounds: function (pid) { var p = byId(pid), r = (p && p.rounds) || {}; return Object.keys(r).map(function (k) { return r[k]; }); },
    startRound: function (pid, game, amount, state) {
      var p = byId(pid), s = p.seeds; p.rounds = p.rounds || {};
      if (p.rounds[game]) return { error: "You already have a round open in this game." };
      if (!(amount > 0) || amount > p.balance + 1e-9) return { error: "Insufficient balance." };
      p.balance = round(p.balance - amount);
      var r = p.rounds[game] = { game: game, amount: round(amount), server: s.server, client: s.client, nonce: s.nonce, state: state || {}, started: nowIso() };
      s.nonce++; save();
      return { round: r };
    },
    addToRound: function (pid, game, extra) {
      var p = byId(pid), r = p.rounds && p.rounds[game];
      if (!r) return { error: "No active round." };
      if (extra > p.balance + 1e-9) return { error: "Insufficient balance." };
      p.balance = round(p.balance - extra); r.amount = round(r.amount + extra); save();
      return { round: r };
    },
    updateRound: function (pid, game, state) { var p = byId(pid), r = p.rounds && p.rounds[game]; if (r) { r.state = state; save(); } },
    settleRound: function (pid, game, multiplier, win, detail) {
      var p = byId(pid), r = p.rounds && p.rounds[game]; if (!r) return null;
      var g = RD.games.filter(function (x) { return x.id === r.game; })[0] || {};
      var payout = win ? round(r.amount * multiplier) : 0;
      p.balance = round(p.balance + payout);
      p.wagered = round(p.wagered + r.amount); p.profit = round(p.profit + payout - r.amount); p.bets++;
      p.rakeback = p.rakeback + r.amount * ((g.edge || 1) / 100) * RD.config.rakebackRate;
      var b = { id: id("B-"), userId: p.id, user: p.username, game: r.game, amount: r.amount, multiplier: win ? multiplier : 0, payout: payout, date: nowIso(), detail: detail || {} };
      b.detail.nonce = r.nonce; b.detail.client = r.client;
      D.bets.unshift(b); D.bets = D.bets.slice(0, 2000);
      delete p.rounds[game]; save();
      return b;
    },
    betsOf: function (pid) { return D.bets.filter(function (b) { return b.userId === pid; }); },
    recentBets: function (n) { return D.bets.slice(0, n || 20); },
    leaderboard: function (month) {
      month = month || monthKey(); var m = {};
      D.bets.forEach(function (b) { if (monthKey(b.date) === month) m[b.userId] = (m[b.userId] || 0) + b.amount; });
      return Object.keys(m).map(function (k) { return { userId: k, user: (byId(k) || {}).username, wagered: round(m[k]) }; })
        .sort(function (a, b) { return b.wagered - a.wagered; })
        .map(function (r, i) { r.rank = i + 1; r.prize = RD.config.leaderboardPrizes[i] || 0; return r; });
    },

    /* ---------- chat ---------- */
    chat: function () { return D.chat; },
    chatSend: function (pid, text) {
      var p = byId(pid); text = String(text).slice(0, 200).trim(); if (!text) return;
      D.chat.push({ user: p.username, text: text, at: nowIso() }); D.chat = D.chat.slice(-100); save();
    },

    /* ---------- afiliados ---------- */
    affiliate: function (pid) {
      var p = byId(pid), codes = [{ name: "Default", code: p.refCode, created: p.created }].concat(p.campaigns || []);
      var refs = D.players.filter(function (x) { return x.referrerId === pid; });
      var month = monthKey(), ngrByDay = {};
      var rows = refs.map(function (r) {
        var ggr = 0;
        D.bets.forEach(function (b) { if (b.userId === r.id) { ggr += b.amount - b.payout; var d = b.date.slice(0, 10); ngrByDay[d] = (ngrByDay[d] || 0) + (b.amount - b.payout); } });
        return { id: r.id, user: r.username, code: r.referredBy, joined: r.created, deposits: r.deposits, wagered: r.wagered, ngr: round(ggr - r.bonusTotal), active: !!r.bets, ftd: r.deposits > 0, ftdMonth: !!r.firstDeposit && monthKey(r.firstDeposit) === month };
      });
      var ftdMonth = rows.filter(function (r) { return r.ftdMonth; }).length;
      var plan = RD.affiliatePlans.filter(function (x) { return ftdMonth >= x.min && ftdMonth <= x.max; })[0];
      var share = p.affShare != null ? p.affShare : plan.share;
      var ngr = round(rows.reduce(function (a, r) { return a + r.ngr; }, 0));
      var commission = round(Math.max(0, ngr) * share / 100);
      var camp = codes.map(function (c) {
        var rr = rows.filter(function (r) { return r.code === c.code; });
        var cn = round(rr.reduce(function (a, r) { return a + r.ngr; }, 0));
        return { name: c.name, code: c.code, created: c.created, clicks: D.clicks[c.code] || 0, signups: rr.length, ftds: rr.filter(function (r) { return r.ftd; }).length, ngr: cn, commission: round(Math.max(0, cn) * share / 100) };
      });
      var daily = [];
      for (var i = 29; i >= 0; i--) { var d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); daily.push({ date: d, commission: round(Math.max(0, (ngrByDay[d] || 0)) * share / 100) }); }
      return {
        code: p.refCode, codes: camp, referrals: rows, plan: plan, share: share, custom: p.affShare != null,
        clicks: camp.reduce(function (a, c) { return a + c.clicks; }, 0), signups: rows.length, ftds: rows.filter(function (r) { return r.ftd; }).length, ftdMonth: ftdMonth,
        active: rows.filter(function (r) { return r.active; }).length, ngr: ngr, commission: commission,
        paid: p.affPaid, available: round(Math.max(0, commission - p.affPaid)), daily: daily,
        payouts: D.tx.filter(function (t) { return t.userId === pid && t.type === "Commission"; })
      };
    },
    addCampaign: function (pid, name, code) {
      code = String(code).toUpperCase();
      if (!/^[A-Z0-9]{3,16}$/.test(code)) return { error: "Code: 3–16 letters or numbers." };
      if (ownerOfCode(code)) return { error: "This code is already taken." };
      var p = byId(pid); p.campaigns.push({ name: name, code: code, created: nowIso() }); save();
      return { ok: true };
    },
    collectCommission: function (pid) {
      var a = db.affiliate(pid), p = byId(pid);
      if (a.available < 1) return { error: "Minimum to collect is $1.00." };
      p.affPaid = round(p.affPaid + a.available); p.balance = round(p.balance + a.available);
      addTx(p, "Commission", a.available, "Completed"); log(p.username, "Coletou comissão de afiliado " + RD.fmt.usd(a.available)); save();
      return { amount: a.available };
    },

    /* ---------- histórico ---------- */
    txOf: function (pid) { return D.tx.filter(function (t) { return t.userId === pid; }); },

    /* ---------- admin ---------- */
    adminExists: function () { return !!D.admin; },
    adminSetup: function (email, pass) { D.admin = { email: email.toLowerCase(), pass: hash(pass) }; log("admin", "Criou o acesso de administrador"); save(); },
    adminLogin: function (email, pass) { return !!D.admin && D.admin.email === String(email).toLowerCase() && D.admin.pass === hash(pass); },
    log: function (what) { log("admin", what); save(); },
    players: function () { return D.players; },
    transactions: function () { return D.tx; },
    allBets: function () { return D.bets; },
    audit: function () { return D.audit; },
    adjustBalance: function (pid, amount, reason, type) {
      var p = byId(pid); p.balance = Math.max(0, round(p.balance + amount));
      if (type === "Bonus") p.bonusTotal = round(p.bonusTotal + amount);
      addTx(p, type || "Adjustment", Math.abs(amount), "Completed", { note: reason, sign: amount < 0 ? -1 : 1 });
      log("admin", (type === "Bonus" ? "Bônus " : "Ajuste de saldo ") + p.username + ": " + RD.fmt.usd(amount, { sign: true }) + " — " + reason); save();
    },
    decideWithdrawal: function (txId, approve, reason) {
      var t = D.tx.filter(function (x) { return x.id === txId; })[0]; if (!t || t.status !== "Pending") return;
      var p = byId(t.userId);
      t.status = approve ? "Completed" : "Rejected"; if (reason) t.note = reason;
      if (approve) p.withdrawals = round(p.withdrawals + t.amount); else p.balance = round(p.balance + t.amount);
      log("admin", (approve ? "Aprovou" : "Rejeitou") + " saque " + txId + " de " + p.username + " (" + RD.fmt.usd(t.amount) + ")" + (reason ? " — " + reason : "")); save();
    },
    setKyc: function (pid, status, reason) {
      var p = byId(pid); p.kyc = status; p.kycReason = reason || "";
      log("admin", "KYC " + (status === "Verified" ? "aprovado" : "rejeitado") + ": " + p.username + (reason ? " — " + reason : "")); save();
    },
    setStatus: function (pid, status) { var p = byId(pid); p.status = status; log("admin", (status === "Suspended" ? "Suspendeu " : "Reativou ") + p.username); save(); },
    setAffShare: function (pid, share) { var p = byId(pid); p.affShare = share === "" || share == null ? null : Math.max(0, Math.min(70, +share)); log("admin", "Comissão de afiliado de " + p.username + ": " + (p.affShare == null ? "plano padrão" : p.affShare + "%")); save(); },
    setNote: function (pid, note) { byId(pid).note = note; save(); },
    resetBets: function (pid) { resetBetsOf(D, byId(pid), "admin"); save(); },
    setGame: function (gid, fields) {
      var s = D.games.filter(function (x) { return x.id === gid; })[0]; for (var k in fields) s[k] = fields[k]; apply();
      log("admin", "Jogo " + gid + ": " + JSON.stringify(fields)); save();
    },
    setSettings: function (fields) { for (var k in fields) D.settings[k] = fields[k]; apply(); log("admin", "Alterou configurações"); save(); },
    savePromotions: function (what) { log("admin", what); save(); },

    kpis: function (days) {
      var since = days ? Date.now() - days * 864e5 : 0, inRange = function (iso) { return Date.parse(iso) >= since; };
      var bets = D.bets.filter(function (b) { return inRange(b.date); });
      var tx = D.tx.filter(function (t) { return inRange(t.date); });
      var sum = function (arr, f) { return round(arr.reduce(function (a, x) { return a + f(x); }, 0)); };
      var ggr = sum(bets, function (b) { return b.amount - b.payout; });
      var bonus = sum(tx.filter(function (t) { return ["Bonus", "Rakeback", "Level reward"].indexOf(t.type) > -1; }), function (t) { return t.amount; });
      var active = {}; bets.forEach(function (b) { active[b.userId] = 1; });
      return {
        ggr: ggr, ngr: round(ggr - bonus), bonus: bonus, wagered: sum(bets, function (b) { return b.amount; }), bets: bets.length,
        deposits: sum(tx.filter(function (t) { return t.type === "Deposit"; }), function (t) { return t.amount; }),
        withdrawals: sum(tx.filter(function (t) { return t.type === "Withdrawal" && t.status === "Completed"; }), function (t) { return t.amount; }),
        pendingWithdrawals: D.tx.filter(function (t) { return t.type === "Withdrawal" && t.status === "Pending"; }),
        signups: D.players.filter(function (p) { return inRange(p.created); }).length,
        ftds: D.players.filter(function (p) { return p.firstDeposit && inRange(p.firstDeposit); }).length,
        activePlayers: Object.keys(active).length,
        liabilities: sum(D.players, function (p) { return p.balance; })
      };
    },
    daily: function (days) {
      var out = [];
      for (var i = days - 1; i >= 0; i--) {
        var d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        out.push({ date: d, ggr: round(D.bets.filter(function (b) { return b.date.slice(0, 10) === d; }).reduce(function (a, b) { return a + b.amount - b.payout; }, 0)) });
      }
      return out;
    },
    gameStats: function () {
      var m = {};
      D.bets.forEach(function (b) { var s = m[b.game] = m[b.game] || { game: b.game, bets: 0, wagered: 0, ggr: 0 }; s.bets++; s.wagered += b.amount; s.ggr += b.amount - b.payout; });
      return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.wagered - a.wagered; });
    },
    affiliatesList: function () {
      return D.players.filter(function (p) { return D.players.some(function (x) { return x.referrerId === p.id; }) || p.affShare != null; })
        .map(function (p) { var a = db.affiliate(p.id); return { id: p.id, username: p.username, email: p.email, code: p.refCode, share: a.share, custom: a.custom, signups: a.signups, ftds: a.ftds, ngr: a.ngr, commission: a.commission, available: a.available }; });
    }
  };

  apply();
  if (!read()) save();
  RD.db = db;

  window.addEventListener("storage", function (e) {
    if (e.key !== KEY && e.key !== SESSION) return;
    if (e.key === KEY) { D = migrate(read()) || empty(); apply(); }
    listeners.forEach(function (fn) { fn(e.key); });
  });
})();
