/* ==========================================================================
   RDCasino — modo REAL (Supabase).
   Liga quando RD.live = true (veja data.js). Troca as funções de RD.db que
   mexem em conta e dinheiro por chamadas ao servidor. O resto do site
   continua lendo do cache (RD.db.data()), que este arquivo mantém atualizado.
   Saldo NUNCA é alterado aqui: só o servidor muda saldo.
   ========================================================================== */
(function () {
  "use strict";
  if (!RD.live) return;
  var db = RD.db, D = db.data(), cfg = RD.supabaseConfig;
  var sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  RD.sb = sb;
  var state = { user: null, admin: false, ready: false, wallets: [] };

  var KYC = { none: "Not started", pending: "Pending", verified: "Verified", rejected: "Rejected" };
  var TX = { deposit: "Deposit", withdrawal: "Withdrawal", adjustment: "Adjustment", bonus: "Bonus", rakeback: "Rakeback", level_reward: "Level reward", commission: "Commission", tip_in: "Tip received", tip_out: "Tip sent" };
  var ST = { pending: "Pending", completed: "Completed", rejected: "Rejected" };
  function n(v) { return Math.round((+v || 0) * 100) / 100; }
  function msg(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || "Something went wrong.");
    if (/Invalid login credentials/i.test(m)) return "Wrong email or password.";
    if (/already registered/i.test(m)) return "This email is already registered.";
    if (/Database error saving new user/i.test(m)) return "Invalid or already used invite code.";
    if (/tx_hash_once/i.test(m)) return RD.isAdminPage ? "Esse TxID já foi creditado antes." : "This transaction was already submitted.";
    return m.replace(/^.*?ERROR:\s*/, "");
  }

  function mapTx(t, uname) {
    var amt = n(t.amount_usd);
    return { id: "TX-" + t.id, rid: t.id, userId: t.user_id, user: uname || "", type: TX[t.type] || t.type, amount: Math.abs(amt), sign: amt < 0 ? -1 : 1, status: ST[t.status] || t.status, date: t.created_at, coin: t.coin, net: t.network, address: t.address, txHash: t.tx_hash, note: t.note };
  }
  function mapProfile(p, email, txs) {
    var mine = (txs || []).filter(function (t) { return t.userId === p.id && t.status === "Completed"; });
    var sum = function (type) { return n(mine.filter(function (t) { return t.type === type; }).reduce(function (a, t) { return a + t.amount; }, 0)); };
    var firstDep = mine.filter(function (t) { return t.type === "Deposit"; }).map(function (t) { return t.date; }).sort()[0] || null;
    return {
      id: p.id, username: p.username, email: email || "", country: p.country, refCode: p.ref_code, referrerId: p.referred_by, referredBy: null,
      status: p.status === "active" ? "Active" : "Suspended", kyc: KYC[p.kyc] || "Not started", kycReason: "", kycInfo: null,
      balance: n(p.balance), held: n(p.held), wagered: n(p.wagered), profit: n(p.profit), bets: +p.bets_count || 0, rakeback: +p.rakeback || 0, rakebackClaimed: sum("Rakeback"),
      claimedTiers: p.claimed_tiers || [], bonusTotal: n(sum("Bonus") + sum("Level reward")), deposits: sum("Deposit"), withdrawals: sum("Withdrawal"), firstDeposit: firstDep,
      created: p.created_at, note: p.note || "", affShare: p.aff_share != null ? +p.aff_share : null, affPaid: n(p.aff_paid), campaigns: [], rounds: {},
      seeds: { server: "", client: "", nonce: 0, revealed: [] }
    };
  }
  function mapReload(r) { return r ? { id: r.id, per: n(r.per_claim), claims: r.claims, used: r.used, hours: r.interval_hours, last: r.last_claim_at, note: r.note || "", created: r.created_at } : null; }
  var DOC = { passport: "Passport", id_card: "National ID", driver_license: "Driver's license" };
  function mapKyc(k) { return k ? { name: k.first_name + " " + k.last_name, first: k.first_name, last: k.last_name, dob: k.dob, doc: DOC[k.doc_type] || k.doc_type, docType: k.doc_type, sent: String(k.created_at).slice(0, 10), country: k.country, address: k.address, city: k.city, postal: k.postal || "", files: k.files || {}, status: k.status, reason: k.reason || "" } : null; }
  function fill(arr, items) { arr.length = 0; Array.prototype.push.apply(arr, items); }

  /* ---------- Carregar dados do servidor para o cache ---------- */
  function loadPlayer() {
    var uid = state.user.id;
    return Promise.all([
      sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
      sb.from("bets").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
      sb.from("my_seeds").select("*").maybeSingle(),
      sb.from("wallets").select("*").eq("enabled", true).order("id"),
      sb.from("vip_reloads").select("*").eq("user_id", uid).eq("status", "active").maybeSingle(),
      sb.from("kyc_submissions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("my_rounds").select("*")
    ]).then(function (r) {
      var prof = r[0].data; if (!prof) throw new Error("Profile not found.");
      var txs = (r[1].data || []).map(function (t) { return mapTx(t, prof.username); });
      var me = mapProfile(prof, state.user.email, txs), s = r[3].data;
      if (s) me.seeds = { server: "", hash: s.server_hash, client: s.client_seed, nonce: +s.nonce, revealed: s.revealed || [] };
      me.reloadGrant = mapReload(r[5].data);
      me.kycInfo = mapKyc(r[6].data); if (me.kycInfo && me.kyc === "Rejected") me.kycReason = me.kycInfo.reason;
      Object.keys(rounds).forEach(function (k) { delete rounds[k]; });
      (r[7].data || []).forEach(function (x) { rounds[x.game] = { game: x.game, amount: n(x.amount), nonce: +x.nonce, client: x.client_seed, server: "", state: x.state || {}, started: x.started_at }; });
      me.rounds = rounds;
      loadAff(); if (!sup.loaded) supLoad();
      fill(D.players, [me]); fill(D.tx, txs);
      fill(D.bets, (r[2].data || []).map(function (b) { return { id: "B-" + b.id, userId: b.user_id, user: prof.username, game: b.game, amount: n(b.amount), multiplier: +b.multiplier, payout: n(b.payout), date: b.created_at, detail: Object.assign({ nonce: +b.nonce, client: b.client_seed }, b.detail || {}) }; }));
      state.wallets = r[4].data || [];
    });
  }
  function loadAdmin() {
    return Promise.all([
      sb.from("profiles").select("*").order("created_at", { ascending: false }),
      sb.rpc("admin_player_emails"),
      sb.from("transactions").select("*").order("created_at", { ascending: false }).limit(2000),
      sb.from("bets").select("*").order("created_at", { ascending: false }).limit(2000),
      sb.from("audit_log").select("*").order("at", { ascending: false }).limit(500),
      sb.from("invites_admin").select("*").order("created_at", { ascending: false }),
      sb.from("wallets").select("*").order("id"),
      sb.from("vip_reloads").select("*").eq("status", "active"),
      sb.from("settings").select("*").eq("key", "rain_auto").maybeSingle(),
      sb.from("kyc_submissions").select("*").order("created_at", { ascending: false }).limit(1000)
    ]).then(function (r) {
      r.forEach(function (x) { if (x.error) throw x.error; });
      var profs = r[0].data || [], emails = {}, names = {};
      (r[1].data || []).forEach(function (e) { emails[e.id] = e.email; });
      profs.forEach(function (p) { names[p.id] = p.username; });
      var txs = (r[2].data || []).map(function (t) { return mapTx(t, names[t.user_id]); });
      fill(D.tx, txs);
      var rl = {}; (r[7].data || []).forEach(function (x) { rl[x.user_id] = mapReload(x); });
      state.rainAuto = r[8].data ? r[8].data.value : null;
      var ky = {}; (r[9].data || []).forEach(function (x) { if (!ky[x.user_id]) ky[x.user_id] = mapKyc(x); });
      fill(D.players, profs.map(function (p) { var m = mapProfile(p, emails[p.id], txs); m.reloadGrant = rl[p.id] || null; m.kycInfo = ky[p.id] || null; if (m.kycInfo && m.kyc === "Rejected") m.kycReason = m.kycInfo.reason; if (p.referred_by) m.referredBy = (profs.filter(function (x) { return x.id === p.referred_by; })[0] || {}).ref_code || null; return m; }));
      fill(D.bets, (r[3].data || []).map(function (b) { return { id: "B-" + b.id, userId: b.user_id, user: names[b.user_id] || "", game: b.game, amount: n(b.amount), multiplier: +b.multiplier, payout: n(b.payout), date: b.created_at, detail: b.detail || {} }; }));
      fill(D.audit, (r[4].data || []).map(function (a) { return { at: a.at, who: names[a.who] || (a.who ? "admin" : "sistema"), what: a.what + (a.data ? " " + JSON.stringify(a.data) : "") }; }));
      state.invites = r[5].data || []; state.wallets = r[6].data || [];
    });
  }
  function refresh() {
    if (!state.user) { fill(D.players, []); fill(D.tx, []); fill(D.bets, []); return Promise.resolve(); }
    return (state.admin && RD.isAdminPage ? loadAdmin() : loadPlayer()).then(function () { state.ready = true; db.emit(); }, function (e) { console.error(e); state.ready = true; db.emit(); });
  }
  function onSession(session) {
    state.user = session ? session.user : null;
    if (!state.user) { state.admin = false; return refresh(); }
    return sb.rpc("is_admin").then(function (r) { state.admin = !!r.data; return refresh(); });
  }

  /* ---------- Conta ---------- */
  db.live = state;
  db.ready = sb.auth.getSession().then(function (r) { return onSession(r.data.session); });
  sb.auth.onAuthStateChange(function (ev, session) { if (ev === "SIGNED_OUT") onSession(null); if (ev === "TOKEN_REFRESHED") state.user = session.user; });
  db.current = function () { return state.user && D.players[0] && D.players[0].id === state.user.id ? D.players[0] : (state.user ? D.players.filter(function (p) { return p.id === state.user.id; })[0] || null : null); };
  db.logout = function () { state.user = null; fill(D.players, []); fill(D.tx, []); fill(D.bets, []); return sb.auth.signOut(); };
  db.login = function (email, pass) {
    email = String(email || "").trim();
    if (email.indexOf("@") < 0) return Promise.resolve({ error: "Sign in with your email." });
    return sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      if (r.error) return { error: msg(r.error) };
      return onSession(r.data.session).then(function () { return db.current() ? { player: db.current() } : { error: "Account not found." }; });
    });
  };
  db.register = function (f) {
    var username = String(f.username || "").trim(), email = String(f.email || "").trim().toLowerCase();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return Promise.resolve({ error: "Username: 3–16 letters, numbers or _." });
    if (String(f.pass || "").length < 8) return Promise.resolve({ error: "Password must have at least 8 characters." });
    return sb.rpc("username_available", { p_username: username }).then(function (a) {
      if (a.data === false) return { error: "This username is already taken." };
      return sb.auth.signUp({ email: email, password: f.pass, options: { data: { username: username, country: f.country, invite: String(f.invite).trim().toUpperCase(), ref: String(f.ref || "").trim().toUpperCase() } } }).then(function (r) {
        if (r.error) return { error: msg(r.error) };
        if (!r.data.session) return { error: "Account created. Sign in to continue." };
        return onSession(r.data.session).then(function () { return { player: db.current() }; });
      });
    });
  };
  db.refresh = refresh;

  /* ---------- Caixa ---------- */
  db.wallets = function () { return state.wallets; };
  db.requestDeposit = function (wallet, amountUsd, txHash) {
    return sb.rpc("request_deposit", { p_coin: wallet.coin, p_network: wallet.network, p_amount_usd: amountUsd, p_tx_hash: txHash }).then(function (r) {
      if (r.error) return { error: /tx_hash_once|duplicate/i.test(r.error.message) ? "This transaction was already submitted." : msg(r.error) };
      return refresh().then(function () { return { ok: true }; });
    });
  };
  db.requestWithdrawal = function (pid, amount, coinNet, address) {
    var w = typeof coinNet === "object" ? coinNet : { coin: coinNet, network: "" };
    return sb.rpc("request_withdrawal", { p_coin: w.coin, p_network: w.network, p_amount_usd: amount, p_address: address }).then(function (r) {
      if (r.error) return { error: msg(r.error) };
      return refresh().then(function () { return { ok: true }; });
    });
  };
  db.deposit = function () { return { error: "Use the deposit form." }; };

  /* ---------- Jogos de um clique: o servidor sorteia, calcula e grava (play_bet) ---------- */
  var lastNonce = -1;
  db.playBet = function (game, amount, params) {
    return sb.rpc("play_bet", { p_game: game, p_amount: amount, p_params: params || {} }).then(function (r) {
      if (r.error) return { error: msg(r.error) };
      var x = r.data, nonce = +x.nonce;
      return {
        fs: x.fs.map(Number), nonce: nonce, client: x.client,
        place: function (mult, win, detail) {
          var me = db.current(), b = x.bet, pr = x.profile;
          var bet = { id: "B-" + b.id, userId: me.id, user: me.username, game: game, amount: n(b.amount), multiplier: +b.multiplier, payout: n(b.payout), date: b.created_at, detail: Object.assign({}, detail, b.detail, { nonce: nonce, client: x.client }) };
          if (Math.abs(bet.payout - (win ? n(bet.amount * mult) : 0)) > 0.011) console.warn("RD: resultado do servidor diferente do site", game, bet, mult, win);
          /* Plinko com várias bolas: só o saldo da aposta mais recente vale */
          if (nonce > lastNonce) {
            lastNonce = nonce;
            me.balance = n(pr.balance); me.wagered = n(pr.wagered); me.profit = n(pr.profit); me.bets = +pr.bets; me.rakeback = +pr.rakeback;
            me.seeds.nonce = nonce + 1;
          }
          D.bets.unshift(bet); if (D.bets.length > 500) D.bets.length = 500;
          db.emit(); return bet;
        }
      };
    }, function (e) { return { error: msg(e) }; });
  };
  /* ---------- Jogos com rodada (Mines, Tower, Chicken, Hi-Lo, RPS, Crash, Blackjack): o servidor joga ---------- */
  var SOON = { error: "Not available yet." };
  db.placeBet = function () { return SOON; };
  var rounds = {}, lastBet = {};
  function applyProfile(pr) { var me = db.current(); if (!me || !pr) return; me.balance = n(pr.balance); me.wagered = n(pr.wagered); me.profit = n(pr.profit); me.bets = +pr.bets; me.rakeback = +pr.rakeback; me.held = n(pr.held); }
  function mapBet(b, game, r) { var me = db.current() || {}; return { id: "B-" + b.id, userId: me.id, user: me.username, game: game, amount: n(b.amount), multiplier: +b.multiplier, payout: n(b.payout), date: b.created_at, detail: Object.assign({ nonce: r ? r.nonce : undefined, client: r ? r.client : undefined }, b.detail || {}) }; }
  function syncRounds() { var me = db.current(); if (me) me.rounds = rounds; }
  db.activeRound = function (pid, game) { return rounds[game] || null; };
  db.activeRounds = function () { return Object.keys(rounds).map(function (k) { return rounds[k]; }); };
  db.startRound = function () { return { error: "Use roundStart." }; };
  db.updateRound = function () {};
  db.addToRound = function () { return { ok: true }; };
  db.settleRound = function (pid, game) { var b = lastBet[game]; delete lastBet[game]; return b || null; };
  function roundResult(game, x) {
    var r = rounds[game];
    applyProfile(x.profile);
    if (x.bet) { var b = mapBet(x.bet, game, r); x.bet = b; lastBet[game] = b; D.bets.unshift(b); if (D.bets.length > 500) D.bets.length = 500; delete rounds[game]; }
    else if (r && x.state) r.state = x.state;
    if (r && x.amount != null) r.amount = n(x.amount);
    syncRounds(); db.emit(); return x;
  }
  db.roundStart = function (game, amount, params) {
    return sb.rpc("round_start", { p_game: game, p_amount: amount, p_params: params || {} }).then(function (r) {
      if (r.error) return { error: msg(r.error) };
      var x = r.data; rounds[game] = { game: game, amount: n(x.round.amount), nonce: +x.round.nonce, client: x.round.client, server: "", state: x.state || {}, started: x.round.started };
      return roundResult(game, x);
    }, function (e) { return { error: msg(e) }; });
  };
  db.roundAct = function (game, action, params) {
    return sb.rpc("round_act", { p_game: game, p_action: action, p_params: params || {} }).then(function (r) {
      if (r.error) { if (/No active round/i.test(r.error.message)) { delete rounds[game]; syncRounds(); } return { error: msg(r.error) }; }
      return roundResult(game, r.data);
    }, function (e) { return { error: msg(e) }; });
  };
  db.reserve = function () { return { server: "", client: "", nonce: 0 }; };
  db.claimLevel = function () { return SOON; };
  db.claimRakeback = function () { return SOON; };
  /* VIP Reload (dado pelo admin) já paga no servidor; diário/semanal/mensal ainda não */
  db.claimBonus = function (pid, key) {
    if (key !== "reload") return SOON;
    return sb.rpc("claim_reload").then(function (r) { if (r.error) return { error: msg(r.error) }; return refresh().then(function () { return { amount: n(r.data) }; }); });
  };
  db.tip = function (pid, to, amount, pub) {
    return sb.rpc("tip_send", { p_to: String(to || "").trim(), p_amount: amount, p_public: pub !== false }).then(function (r) {
      if (r.error) return { error: msg(r.error) };
      return refresh().then(function () { return { ok: true }; });
    });
  };
  /* ---------- KYC: arquivos vão para o cofre privado "kyc" (pasta do próprio jogador) ---------- */
  db.submitKyc = function (pid, info, files) {
    var uid = state.user && state.user.id; if (!uid) return Promise.resolve({ error: "Sign in first." });
    var keys = Object.keys(files || {}), paths = {}, stamp = Date.now();
    return Promise.all(keys.map(function (k) {
      var f = files[k], ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg", path = uid + "/" + stamp + "-" + k + "." + ext;
      return sb.storage.from("kyc").upload(path, f, { contentType: f.type || undefined, upsert: false }).then(function (r) { if (r.error) throw r.error; paths[k] = path; });
    })).then(function () {
      return sb.rpc("kyc_submit", { p: Object.assign({}, info, { files: paths }) });
    }).then(function (r) {
      if (r.error) return { error: msg(r.error) };
      return refresh().then(function () { return { ok: true }; });
    }, function (e) { return { error: /exceeded|size/i.test(String(e && e.message)) ? "Each file must be 10 MB or less." : msg(e) }; });
  };
  db.kycFileUrl = function (path) { return sb.storage.from("kyc").createSignedUrl(path, 600).then(function (r) { return r.data ? r.data.signedUrl : null; }); };
  db.setKyc = function (pid, status, reason) { return adminCall("admin_kyc_decide", { p_user: pid, p_approve: status === "Verified", p_reason: reason || null }); };
  db.creditDeposit = function (pid, amount, coin, net, txHash) { return adminCall("admin_credit_deposit", { p_user: pid, p_amount: amount, p_coin: coin || "", p_network: net || "", p_tx_hash: txHash || null }); };
  /* ---------- Afiliado (15% do NGR, calculado no servidor) ---------- */
  state.aff = null;
  function loadAff() {
    return sb.rpc("my_affiliate").then(function (r) { if (r.data) { state.aff = r.data; db.emit(); } });
  }
  if (!RD.isAdminPage) db.affiliate = function (pid) {
    var a = state.aff || { code: (db.current() || {}).refCode || "", share: 15, custom: false, referrals: [], ngr: 0, commission: 0, paid: 0, available: 0 };
    var refs = (a.referrals || []).map(function (r) { return { user: r.user, code: a.code, joined: r.joined, deposits: n(r.deposits), wagered: n(r.wagered), ngr: n(r.ngr), commission: n(r.commission), active: +r.wagered > 0, ftd: +r.deposits > 0 }; });
    var daily = []; for (var i = 29; i >= 0; i--) daily.push({ date: new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), commission: 0 });
    return { code: a.code, codes: [{ name: "Default", code: a.code, clicks: 0, signups: refs.length, ftds: refs.filter(function (r) { return r.ftd; }).length, ngr: n(a.ngr), commission: n(a.commission) }],
      referrals: refs, plan: RD.affiliatePlans[0], share: +a.share, custom: !!a.custom, clicks: 0, signups: refs.length, ftds: refs.filter(function (r) { return r.ftd; }).length, ftdMonth: 0,
      active: refs.filter(function (r) { return r.active; }).length, ngr: n(a.ngr), commission: n(a.commission), paid: n(a.paid), available: n(a.available), daily: daily,
      payouts: D.tx.filter(function (t) { return t.type === "Commission"; }) };
  };
  db.collectCommission = function () {
    return sb.rpc("affiliate_collect").then(function (r) { if (r.error) return { error: msg(r.error) }; return refresh().then(function () { return { amount: n(r.data) }; }); });
  };
  db.setAffShare = function (pid, share) { return adminCall("admin_set_aff_share", { p_user: pid, p_share: share === "" || share == null ? null : +share }); };
  db.addCampaign = function () { return { error: "Extra campaign codes are coming soon. Use your main link for now." }; };
  /* ---------- Leaderboard do mês (servidor) ---------- */
  state.lb = [];
  function loadLb() {
    return sb.rpc("leaderboard_month").then(function (r) {
      state.lb = (r.data || []).map(function (x, i) { return { userId: x.username, user: x.username, wagered: n(x.wagered), rank: i + 1, prize: RD.config.leaderboardPrizes[i] || 0 }; });
    });
  }
  loadLb(); setInterval(function () { if (!document.hidden) loadLb(); }, 30000);
  db.leaderboard = function () { return state.lb; };
  /* ---------- Códigos promocionais ---------- */
  db.redeemCode = function (pid, code) {
    return sb.rpc("redeem_code", { p_code: code }).then(function (r) {
      if (r.error) return { error: msg(r.error) }; if (r.data && r.data.error) return { error: r.data.error };
      return refresh().then(function () { return { amount: n(r.data.amount) }; });
    });
  };
  db.adminCodes = function () { return sb.from("promo_codes").select("*").order("created_at", { ascending: false }).then(function (r) { return r.data || []; }); };
  db.saveCode = function (c) { return adminCall("admin_save_code", { p_code: c.code, p_amount: c.amount, p_max_uses: c.maxUses, p_min_wager: c.minWager, p_hours: c.hours, p_active: true }); };
  db.toggleCode = function (code, active) { return adminCall("admin_toggle_code", { p_code: code, p_active: active }); };
  /* ---------- Equipe (tag de diamante) ---------- */
  RD.staff = [];
  sb.rpc("public_staff").then(function (r) { if (r.data) { RD.staff = r.data; db.emit(); chatNotify(); } });
  /* ---------- Suporte ao vivo ---------- */
  var sup = { msgs: [], unread: 0, subs: [], loaded: false, ch: null, rt: false };
  function supMap(m) { return { id: m.id, fromStaff: m.from_staff, staff: m.staff_name, text: m.text, at: m.created_at }; }
  function supNotify() { sup.subs.forEach(function (fn) { fn(); }); }
  function supAdd(row) {
    if (sup.msgs.some(function (x) { return x.id === row.id; })) return;
    var mine = !row.from_staff && sup.msgs.filter(function (x) { return x.pending && x.text === row.text; })[0];
    if (mine) { mine.id = row.id; mine.at = row.created_at; mine.pending = false; return; }
    sup.msgs.push(supMap(row));
  }
  function supLoad() {
    if (!state.user) { sup.msgs = []; sup.unread = 0; supNotify(); return Promise.resolve(); }
    var uid = state.user.id;
    return Promise.all([
      sb.from("support_messages").select("*").eq("user_id", uid).order("id").limit(300),
      sb.from("support_threads").select("*").eq("user_id", uid).maybeSingle()
    ]).then(function (r) {
      sup.msgs = (r[0].data || []).map(supMap); sup.unread = r[1].data ? r[1].data.unread_user : 0; sup.loaded = true; supNotify();
      if (!sup.ch && !RD.isAdminPage) {
        sup.ch = sb.channel("rd-support-" + uid)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: "user_id=eq." + uid }, function (ev) { supAdd(ev.new); if (ev.new.from_staff) sup.unread++; supNotify(); })
          .subscribe(function (st) { sup.rt = st === "SUBSCRIBED"; });
      }
    });
  }
  db.ready.then(supLoad);
  setInterval(function () {
    if (sup.rt || document.hidden || !state.user || RD.isAdminPage) return;
    var last = sup.msgs.filter(function (x) { return !x.pending; }).slice(-1)[0], lastId = last ? last.id : 0;
    sb.from("support_messages").select("*").eq("user_id", state.user.id).gt("id", lastId).order("id").then(function (r) {
      var fresh = r.data || []; if (!fresh.length) return;
      fresh.forEach(function (m) { supAdd(m); if (m.from_staff) sup.unread++; }); supNotify();
    });
  }, 4000);
  db.onSupport = function (fn) { sup.subs.push(fn); };
  db.supportMessages = function () { return sup.msgs.slice(); };
  db.supportUnread = function () { return sup.unread; };
  db.supportSend = function (pid, text) {
    var v = String(text || "").trim(); if (!v) return Promise.resolve({ error: "Type a message." });
    var tmp = { id: "tmp-" + Date.now(), fromStaff: false, text: v, at: new Date().toISOString(), pending: true };
    sup.msgs.push(tmp); supNotify();
    return sb.rpc("support_send", { p_text: v }).then(function (r) {
      if (r.error) { sup.msgs.splice(sup.msgs.indexOf(tmp), 1); supNotify(); return { error: msg(r.error) }; }
      if (tmp.pending) { if (sup.msgs.some(function (x) { return x.id === r.data; })) sup.msgs.splice(sup.msgs.indexOf(tmp), 1); else { tmp.id = r.data; tmp.pending = false; } }
      supNotify(); return { ok: true };
    });
  };
  db.supportSeen = function () { if (!sup.unread) return; sup.unread = 0; supNotify(); sb.rpc("support_seen"); };
  /* Admin */
  db.adminSupportThreads = function () {
    return sb.from("support_threads").select("*").order("last_at", { ascending: false }).then(function (r) {
      var names = {}; D.players.forEach(function (p) { names[p.id] = p.username; });
      return (r.data || []).map(function (t) { return { userId: t.user_id, user: names[t.user_id] || "?", status: t.status, lastAt: t.last_at, lastText: t.last_text, unread: t.unread_staff }; });
    });
  };
  db.adminSupportMessages = function (uid) { return sb.from("support_messages").select("*").eq("user_id", uid).order("id").limit(500).then(function (r) { return (r.data || []).map(supMap); }); };
  db.adminSupportReply = function (uid, text) { return sb.rpc("admin_support_reply", { p_user: uid, p_text: text }).then(function (r) { return r.error ? { error: msg(r.error) } : { ok: true }; }); };
  db.adminSupportStatus = function (uid, st) { return sb.rpc("admin_support_status", { p_user: uid, p_status: st }).then(function (r) { return r.error ? { error: msg(r.error) } : { ok: true }; }); };
  db.adminSupportSeen = function (uid) { return sb.rpc("admin_support_seen", { p_user: uid }); };
  db.onAdminSupport = function (fn) {
    sb.channel("rd-support-admin").on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, function (ev) { fn(ev.new); }).subscribe();
  };
  db.grantReload = function (pid, per, claims, hours, note) { return adminCall("admin_grant_reload", { p_user: pid, p_per: per, p_claims: claims, p_hours: hours, p_note: note || null }); };
  db.cancelReload = function (pid) { return adminCall("admin_cancel_reload", { p_user: pid }); };
  db.rainAuto = function () { return state.rainAuto; };
  db.setRainAuto = function (enabled, amount, minWager) { return adminCall("admin_set_rain_auto", { p_enabled: enabled, p_amount: amount, p_min_wager: minWager }).then(loadRain); };
  /* ---------- Chat em tempo real + Chuva ---------- */
  var chatSubs = [];
  db.onChat = function (fn) { chatSubs.push(fn); };
  function chatNotify() { chatSubs.forEach(function (fn) { fn(); }); }
  function mapMsg(m) { return { id: m.id, user: m.username, text: m.text, at: m.created_at, kind: m.kind }; }
  sb.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(60).then(function (r) {
    fill(D.chat, (r.data || []).reverse().map(mapMsg)); chatNotify();
  });
  sb.channel("rd-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, function (ev) {
      if (D.chat.some(function (x) { return x.id === ev.new.id; })) return;
      addMsg(ev.new); if (D.chat.length > 100) D.chat.splice(0, D.chat.length - 100); chatNotify();
      if (((ev.new.kind === "rain" && /split between/.test(ev.new.text)) || ev.new.kind === "tip") && state.user) refresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "rains" }, function () { loadRain(); })
    .subscribe(function (status) { live.rt = status === "SUBSCRIBED"; });
  /* Plano B: se o tempo real (WebSocket) não conectar nesse aparelho/rede, busca novidades a cada 3s */
  var live = { rt: false, tick: 0 };
  setInterval(function () {
    if (live.rt || document.hidden) return;
    live.tick++;
    var lastId = D.chat.length ? D.chat[D.chat.length - 1].id || 0 : 0;
    sb.from("chat_messages").select("*").gt("id", lastId).order("id").limit(50).then(function (r) {
      var fresh = (r.data || []).filter(function (m) { return !D.chat.some(function (x) { return x.id === m.id; }); });
      if (!fresh.length) return;
      fresh.forEach(addMsg); if (D.chat.length > 100) D.chat.splice(0, D.chat.length - 100);
      if (fresh.some(function (m) { return (m.kind === "rain" && /split between/.test(m.text)) || m.kind === "tip"; }) && state.user) refresh();
      chatNotify();
    });
    if (live.tick % 2 === 0) loadRain();
  }, 3000);
  /* Mensagem nova do servidor: se for a minha que já está na tela (enviada agora), só confirma */
  function addMsg(row) {
    if (D.chat.some(function (x) { return x.id === row.id; })) return;
    var mine = D.chat.filter(function (x) { return x.pending && x.user === row.username && x.text === row.text; })[0];
    if (mine) { mine.id = row.id; mine.at = row.created_at; mine.pending = false; return; }
    D.chat.push(mapMsg(row));
  }
  /* Envio instantâneo: a mensagem aparece na hora e o servidor confirma em seguida */
  db.chatSend = function (pid, text) {
    var me = db.current(), tmp = { id: "tmp-" + Date.now(), user: me ? me.username : "", text: String(text).trim().slice(0, 200), at: new Date().toISOString(), kind: "user", pending: true };
    D.chat.push(tmp); chatNotify();
    return sb.rpc("chat_send", { p_text: text }).then(function (r) {
      if (r.error) { D.chat.splice(D.chat.indexOf(tmp), 1); chatNotify(); return { error: msg(r.error) }; }
      if (tmp.pending) { if (D.chat.some(function (x) { return x.id === r.data; })) D.chat.splice(D.chat.indexOf(tmp), 1); else { tmp.id = r.data; tmp.pending = false; } }
      return { ok: true };
    });
  };
  state.rain = null;
  function loadRain() {
    return sb.from("rains").select("*").eq("status", "open").order("id", { ascending: false }).limit(1).maybeSingle().then(function (r) {
      var rain = r.data || null;
      if (!rain || !state.user) { state.rain = rain; chatNotify(); return; }
      return sb.from("rain_entries").select("rain_id").eq("rain_id", rain.id).eq("user_id", state.user.id).maybeSingle().then(function (e) {
        rain.joined = !!e.data; state.rain = rain; chatNotify();
      });
    });
  }
  loadRain();
  db.ready.then(loadRain);
  db.rain = function () { return state.rain; };
  db.rainSettle = function () { return sb.rpc("rain_auto_tick").then(loadRain); };  /* fecha a vencida e já abre a próxima chuva da hora */
  db.rainJoin = function () {
    return sb.rpc("rain_join").then(function (r) { if (r.error) return { error: msg(r.error) }; return loadRain().then(function () { return { ok: true }; }); });
  };
  db.rainContribute = function (amount) {
    return sb.rpc("rain_contribute", { p_amount: amount }).then(function (r) { if (r.error) return { error: msg(r.error) }; return refresh().then(loadRain).then(function () { return { ok: true }; }); });
  };
  db.adminStartRain = function (amount, minutes, minWager) { return adminCall("admin_start_rain", { p_amount: amount, p_minutes: minutes, p_min_wager: minWager }).then(loadRain); };
  db.adminRains = function () { return sb.from("rains").select("*").order("id", { ascending: false }).limit(20).then(function (r) { return r.data || []; }); };

  /* ---------- Admin ---------- */
  db.adminExists = function () { return true; };
  db.adminLogin = function (email, pass) {
    return sb.auth.signInWithPassword({ email: String(email).trim(), password: pass }).then(function (r) {
      if (r.error) return { error: msg(r.error) };
      return sb.rpc("is_admin").then(function (a) {
        if (!a.data) { sb.auth.signOut(); return { error: "This account is not an admin." }; }
        state.user = r.data.session.user; state.admin = true; return loadAdmin().then(function () { return { ok: true }; });
      });
    });
  };
  db.adminSession = function () {
    return sb.auth.getSession().then(function (r) {
      if (!r.data.session) return false;
      state.user = r.data.session.user;
      return sb.rpc("is_admin").then(function (a) { state.admin = !!a.data; return state.admin ? loadAdmin().then(function () { return true; }) : false; });
    });
  };
  function adminCall(fn, args) {
    return sb.rpc(fn, args).then(function (r) { if (r.error) { RD.toast(msg(r.error), "error"); throw r.error; } return loadAdmin().then(function () { db.emit(); return r.data; }); });
  }
  function rid(txId) { return +String(txId).replace("TX-", ""); }
  db.decideTx = function (txId, approve, reason, hold) { return adminCall("admin_decide_tx", { p_id: rid(txId), p_approve: approve, p_tx_hash: null, p_note: reason || null, p_hold: !!hold }); };
  db.holdBalance = function (pid, amount, reason) { return adminCall("admin_hold", { p_user: pid, p_amount: amount, p_reason: reason }); };
  db.releaseHeld = function (pid, amount, reason) { return adminCall("admin_release", { p_user: pid, p_amount: amount, p_reason: reason }); };
  db.confiscateHeld = function (pid, amount, reason) { return adminCall("admin_confiscate", { p_user: pid, p_amount: amount, p_reason: reason }); };
  db.decideWithdrawal = db.decideTx;
  db.adjustBalance = function (pid, amount, reason, type) { return adminCall("admin_adjust_balance", { p_user: pid, p_amount: amount, p_reason: reason || "", p_type: type === "Bonus" ? "bonus" : "adjustment" }); };
  db.setStatus = function (pid, status) { return adminCall("admin_set_status", { p_user: pid, p_status: status === "Suspended" ? "suspended" : "active" }); };
  db.setNote = function (pid, note) { return adminCall("admin_set_note", { p_user: pid, p_note: note }); };
  db.createInvites = function (count, note) { return adminCall("admin_create_invites", { p_count: count, p_note: note || null }); };
  db.invites = function () { return state.invites || []; };
  db.adminLogout = function () { return sb.auth.signOut(); };
})();
