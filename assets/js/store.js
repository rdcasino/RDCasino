/* ==========================================================================
   RDCasino — "Backend de demonstração"
   Site e admin leem e gravam os MESMOS dados (localStorage do navegador).
   Assim, o que o admin faz aparece no site na hora (abas diferentes, mesmo
   navegador). Cada função pública aqui = um endpoint que o backend real
   precisará ter (com autenticação, validação e registro de auditoria).
   ========================================================================== */
(function () {
  "use strict";
  var KEY = "rd_db_v1";
  var ME = "u_10285"; // jogador logado na demo (rdplayer)
  var listeners = [];

  function now() { var d = new Date(); return d.toISOString().slice(0, 10) + " " + d.toTimeString().slice(0, 5); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  var seed = {
    players: clone(RD.admin.players),
    transactions: clone(RD.admin.transactions),
    affiliates: clone(RD.admin.affiliates),
    promotions: clone(RD.promotions),
    games: RD.games.map(function (g) { return { id: g.id, enabled: g.enabled, tag: g.tag || "" }; }),
    restricted: RD.config.restrictedCountries.slice(),
    license: clone(RD.config.license),
    audit: [
      { at: "2026-10-08 09:12", who: "admin", what: "Aprovou saque TX-88209 ($1,240.00)" },
      { at: "2026-10-07 22:05", who: "support_01", what: "Suspendeu jogador lucky_7 (risco: multi-contas)" }
    ]
  };
  // O jogador da demo começa com dados coerentes com o site
  seed.players.forEach(function (p) {
    p.kycInfo = null;
    if (p.id === ME) { p.balance = 1284.55; p.kyc = "Not started"; p.tier = "Gold"; p.status = "Active"; p.email = "player@example.com"; p.country = "Canada"; }
  });
  seed.transactions.forEach(function (t) {
    if (t.type === "Deposit" && t.status !== "Completed") t.status = "Completed"; // depósito cripto confirmado não é "rejeitado"
    var p = seed.players.filter(function (x) { return x.username === t.user; })[0];
    t.userId = p ? p.id : "";
  });

  function read() { try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  /* Aplica os dados nas estruturas que site e admin já usam */
  function apply(d) {
    RD.admin.players = d.players;
    RD.admin.transactions = d.transactions;
    RD.admin.affiliates = d.affiliates;
    RD.promotions = d.promotions;
    d.games.forEach(function (s) { var g = RD.games.filter(function (x) { return x.id === s.id; })[0]; if (g) { g.enabled = s.enabled; g.tag = s.tag; } });
    RD.config.restrictedCountries = d.restricted;
    RD.config.license = d.license;
    var me = d.players.filter(function (p) { return p.id === ME; })[0];
    me.wagered = me.wagered || 162400;
    me.nextTier = "Platinum I";
    me.isAffiliate = true;
    RD.user = me;
  }
  function snapshot() {
    return {
      players: RD.admin.players, transactions: RD.admin.transactions, affiliates: RD.admin.affiliates,
      promotions: RD.promotions, games: RD.games.map(function (g) { return { id: g.id, enabled: g.enabled, tag: g.tag || "" }; }),
      restricted: RD.config.restrictedCountries, license: RD.config.license, audit: db.audit
    };
  }

  var data = read() || clone(seed);
  var db = {
    audit: data.audit,
    ME: ME,

    save: function () { write(snapshot()); },
    reload: function () { var d = read(); if (d) { db.audit = d.audit; apply(d); } },
    reset: function () { var d = clone(seed); db.audit = d.audit; apply(d); write(d); },
    onChange: function (fn) { listeners.push(fn); },

    player: function (id) { return RD.admin.players.filter(function (p) { return p.id === id; })[0]; },
    me: function () { return db.player(ME); },
    txOf: function (id) { return RD.admin.transactions.filter(function (t) { return t.userId === id; }).sort(function (a, b) { return a.date === b.date ? (+b.id.replace(/\D/g, "")) - (+a.id.replace(/\D/g, "")) : a.date < b.date ? 1 : -1; }); },

    log: function (who, what) { db.audit.unshift({ at: now(), who: who, what: what }); db.save(); },

    addTx: function (p, type, amount, status, extra) {
      var max = RD.admin.transactions.reduce(function (m, t) { return Math.max(m, +t.id.replace(/\D/g, "") || 0); }, 88210);
      var tx = { id: "TX-" + (max + 1), userId: p.id, user: p.username, type: type, coin: (extra && extra.coin) || "USD", amount: Math.round(amount * 100) / 100, status: status, date: now() };
      if (extra) for (var k in extra) tx[k] = extra[k];
      RD.admin.transactions.unshift(tx);
      return tx;
    },

    /* --- Ações do jogador (site) --- */
    deposit: function (amount, coin) {
      var p = db.me(); p.balance += amount; p.deposits += amount;
      var tx = db.addTx(p, "Deposit", amount, "Completed", { coin: coin });
      db.log(p.username, "Depósito " + RD.fmt.usd(amount) + " " + coin + " (" + tx.id + ")");
      return tx;
    },
    requestWithdrawal: function (amount, coin, address) {
      var p = db.me();
      if (p.status !== "Active") return { error: "Your account is suspended. Contact support." };
      if (!(amount > 0)) return { error: "Enter an amount." };
      if (amount > p.balance) return { error: "Amount is higher than your balance." };
      if (amount > 2000 && p.kyc !== "Verified") return { error: "Withdrawals above $2,000 require identity verification.", kyc: true };
      p.balance -= amount; // fica reservado até o admin decidir
      var tx = db.addTx(p, "Withdrawal", amount, "Pending", { coin: coin, address: address });
      db.log(p.username, "Pediu saque " + RD.fmt.usd(amount) + " (" + tx.id + ")");
      return { tx: tx };
    },
    submitKyc: function (info) {
      var p = db.me(); p.kyc = "Pending"; p.kycInfo = info;
      db.log(p.username, "Enviou documentos de KYC");
    },

    /* --- Ações do admin --- */
    adjustBalance: function (id, amount, reason, type) {
      var p = db.player(id); p.balance = Math.max(0, Math.round((p.balance + amount) * 100) / 100);
      db.addTx(p, type || "Adjustment", Math.abs(amount), "Completed", { note: reason, sign: amount < 0 ? -1 : 1 });
      db.log("admin", (type === "Bonus" ? "Bônus " : "Ajuste de saldo ") + p.username + ": " + RD.fmt.usd(amount, { sign: true }) + " — " + reason);
    },
    decideWithdrawal: function (txId, approve, reason) {
      var tx = RD.admin.transactions.filter(function (t) { return t.id === txId; })[0];
      if (!tx || tx.status !== "Pending") return;
      tx.status = approve ? "Completed" : "Rejected";
      var p = db.player(tx.userId);
      if (p) {
        if (approve) p.withdrawals += tx.amount;
        else p.balance += tx.amount; // devolve o valor reservado
      }
      if (reason) tx.note = reason;
      db.log("admin", (approve ? "Aprovou" : "Rejeitou") + " saque " + txId + " (" + RD.fmt.usd(tx.amount) + ")" + (reason ? " — " + reason : ""));
    },
    setKyc: function (id, status, reason) {
      var p = db.player(id); p.kyc = status; if (reason) p.kycReason = reason;
      db.log("admin", "KYC " + (status === "Verified" ? "aprovado" : "rejeitado") + ": " + p.username + (reason ? " — " + reason : ""));
    },
    setStatus: function (id, status) {
      var p = db.player(id); p.status = status;
      db.log("admin", (status === "Suspended" ? "Suspendeu " : "Reativou ") + p.username);
    }
  };

  apply(data);
  if (!read()) write(data);
  RD.db = db;

  /* Outra aba mudou os dados → atualiza esta */
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    db.reload();
    listeners.forEach(function (fn) { fn(); });
  });
})();
