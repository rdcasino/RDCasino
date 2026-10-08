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
      balance: n(p.balance), wagered: n(p.wagered), profit: n(p.profit), bets: +p.bets_count || 0, rakeback: +p.rakeback || 0, rakebackClaimed: sum("Rakeback"),
      claimedTiers: p.claimed_tiers || [], bonusTotal: n(sum("Bonus") + sum("Level reward")), deposits: sum("Deposit"), withdrawals: sum("Withdrawal"), firstDeposit: firstDep,
      created: p.created_at, note: p.note || "", affShare: null, campaigns: [], rounds: {},
      seeds: { server: "", client: "", nonce: 0, revealed: [] }
    };
  }
  function mapReload(r) { return r ? { id: r.id, per: n(r.per_claim), claims: r.claims, used: r.used, hours: r.interval_hours, last: r.last_claim_at, note: r.note || "", created: r.created_at } : null; }
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
      sb.from("vip_reloads").select("*").eq("user_id", uid).eq("status", "active").maybeSingle()
    ]).then(function (r) {
      var prof = r[0].data; if (!prof) throw new Error("Profile not found.");
      var txs = (r[1].data || []).map(function (t) { return mapTx(t, prof.username); });
      var me = mapProfile(prof, state.user.email, txs), s = r[3].data;
      if (s) me.seeds = { server: "", hash: s.server_hash, client: s.client_seed, nonce: +s.nonce, revealed: s.revealed || [] };
      me.reloadGrant = mapReload(r[5].data);
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
      sb.from("settings").select("*").eq("key", "rain_auto").maybeSingle()
    ]).then(function (r) {
      r.forEach(function (x) { if (x.error) throw x.error; });
      var profs = r[0].data || [], emails = {}, names = {};
      (r[1].data || []).forEach(function (e) { emails[e.id] = e.email; });
      profs.forEach(function (p) { names[p.id] = p.username; });
      var txs = (r[2].data || []).map(function (t) { return mapTx(t, names[t.user_id]); });
      fill(D.tx, txs);
      var rl = {}; (r[7].data || []).forEach(function (x) { rl[x.user_id] = mapReload(x); });
      state.rainAuto = r[8].data ? r[8].data.value : null;
      fill(D.players, profs.map(function (p) { var m = mapProfile(p, emails[p.id], txs); m.reloadGrant = rl[p.id] || null; if (p.referred_by) m.referredBy = (profs.filter(function (x) { return x.id === p.referred_by; })[0] || {}).ref_code || null; return m; }));
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
  /* Jogos com rodada (Mines, Crash, Blackjack...): ainda chegando no modo real */
  var SOON = { error: "This game opens for real money very soon. Dice, Limbo, Plinko, Keno, Wheel, Roulette, Coinflip and Baccarat are live now." };
  db.placeBet = function () { return SOON; };
  db.startRound = function () { return SOON; };
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
      D.chat.push(mapMsg(ev.new)); if (D.chat.length > 100) D.chat.splice(0, D.chat.length - 100); chatNotify();
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
      fresh.forEach(function (m) { D.chat.push(mapMsg(m)); }); if (D.chat.length > 100) D.chat.splice(0, D.chat.length - 100);
      if (fresh.some(function (m) { return (m.kind === "rain" && /split between/.test(m.text)) || m.kind === "tip"; }) && state.user) refresh();
      chatNotify();
    });
    if (live.tick % 2 === 0) loadRain();
  }, 3000);
  db.chatSend = function (pid, text) {
    return sb.rpc("chat_send", { p_text: text }).then(function (r) {
      if (r.error) return { error: msg(r.error) };
      if (!live.rt) return sb.from("chat_messages").select("*").eq("id", r.data).maybeSingle().then(function (m) { if (m.data && !D.chat.some(function (x) { return x.id === m.data.id; })) { D.chat.push(mapMsg(m.data)); chatNotify(); } return { ok: true }; });
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
  db.decideTx = function (txId, approve, reason) { return adminCall("admin_decide_tx", { p_id: rid(txId), p_approve: approve, p_tx_hash: null, p_note: reason || null }); };
  db.decideWithdrawal = db.decideTx;
  db.adjustBalance = function (pid, amount, reason, type) { return adminCall("admin_adjust_balance", { p_user: pid, p_amount: amount, p_reason: reason || "", p_type: type === "Bonus" ? "bonus" : "adjustment" }); };
  db.setStatus = function (pid, status) { return adminCall("admin_set_status", { p_user: pid, p_status: status === "Suspended" ? "suspended" : "active" }); };
  db.setNote = function (pid, note) { return adminCall("admin_set_note", { p_user: pid, p_note: note }); };
  db.createInvites = function (count, note) { return adminCall("admin_create_invites", { p_count: count, p_note: note || null }); };
  db.invites = function () { return state.invites || []; };
  db.adminLogout = function () { return sb.auth.signOut(); };
})();
