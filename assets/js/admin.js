/* ==========================================================================
   RDCasino — Painel administrativo (dados reais do RD.db, começa zerado).
   Em produção, cada ação aqui vira um endpoint autenticado e auditado.
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ic = RD.ic, fmt = RD.fmt, esc = RD.esc, media = RD.media, db = RD.db;
  var SESSION = "rda_session";
  var period = 30;

  function hydrate(root) { $$("[data-ic]", root).forEach(function (el) { el.outerHTML = ic(el.getAttribute("data-ic")); }); }
  function gameOf(id) { return RD.games.filter(function (g) { return g.id === id; })[0] || { name: id }; }
  function errorBox(msg) { return '<div class="notice" style="margin-bottom:14px;background:var(--danger-soft);border-color:rgba(255,122,89,.3);color:var(--danger)">' + ic("alert", 16) + "<span>" + esc(msg) + "</span></div>"; }
  function empty(title, text) { return '<div class="empty"><h3>' + title + "</h3><p>" + (text || "") + "</p></div>"; }
  function initials(u) { return String(u || "?").slice(0, 2).toUpperCase(); }

  /* ---------- Navegação ---------- */
  function pendingWd() { return db.transactions().filter(function (t) { return (t.type === "Withdrawal" || t.type === "Deposit") && t.status === "Pending"; }); }
  function after(p, okMsg, playerId, kind) { Promise.resolve(p).then(function (r) { if (r && r.error) return RD.toast(r.error, "error"); RD.toast(okMsg, kind); refreshAfter(playerId); }, function () {}); }
  /* ---------- Antifraude: alertas do servidor (só sinalizam; você decide) ---------- */
  var risk = { list: [], map: {} };
  var RISK_PT = { same_device: "Mesmo aparelho de outras contas", shared_ip: "Mesmo IP de outras contas", shared_address: "Endereço de saque usado por outra conta", self_referral: "Possível autoindicação", low_wager: "Quer sacar tendo jogado pouco", bonus_heavy: "Bônus maiores que os depósitos", rain_multi: "Várias contas na mesma rain", tip_funnel: "Recebe gorjeta de muitas contas", kyc_duplicate: "Mesma identidade em outra conta", new_account: "Conta nova sacando", big_win: "Ganho fora da curva", code_bruteforce: "Tentando adivinhar códigos", many_withdrawals: "Muitos pedidos de saque" };
  function sevBadge(n) { return '<span class="badge ' + (n >= 3 ? "badge-danger" : n === 2 ? "badge-warn" : "") + '">' + (n >= 3 ? "Alta" : n === 2 ? "Média" : "Baixa") + "</span>"; }
  function riskChip(uid) { var r = risk.map[uid]; return r ? ' <a href="#/kyc" class="badge ' + (r.top >= 3 ? "badge-danger" : "badge-warn") + '" title="' + esc(r.flags.map(function (f) { return RISK_PT[f.rule] || f.title; }).join(" · ")) + '">' + ic("alert", 12) + " " + r.flags.length + (r.flags.length === 1 ? " alerta" : " alertas") + "</a>" : ""; }
  function riskList(list, withReview) {
    return list.map(function (u) {
      return '<div class="risk-item"><div class="row between" style="gap:10px"><a href="#" class="link strong" data-player="' + u.user_id + '">' + esc(u.username) + "</a>" + sevBadge(u.top) + "</div>" +
        u.flags.map(function (f) { return '<div class="risk-flag' + (f.reviewed ? " reviewed" : "") + '">' + sevBadge(f.sev) + '<div class="grow"><b>' + esc(RISK_PT[f.rule] || f.title) + "</b><small>" + esc(f.detail) + "</small></div>" + (withReview && !f.reviewed ? '<button class="btn btn-ghost btn-sm" data-act="risk-ok" data-id="' + u.user_id + '" data-key="' + esc(f.key) + '">Revisado</button>' : f.reviewed ? '<small class="faint">revisado</small>' : "") + "</div>"; }).join("") + "</div>";
    }).join("");
  }
  function loadRisk() {
    if (!RD.live || !db.adminRisk) return Promise.resolve();
    return Promise.resolve(db.adminRisk()).then(function (list) {
      if (!Array.isArray(list)) return;
      risk.list = list; risk.map = {}; list.forEach(function (u) { risk.map[u.user_id] = u; });
      if (current === "kyc" || current === "transactions" || current === "dashboard") route(); else renderNav(current);
    });
  }
  function pendingKyc() { return db.players().filter(function (p) { return p.kyc === "Pending"; }); }
  function NAV() {
    return [
      { group: "Visão geral" },
      { id: "dashboard", label: "Dashboard", icon: "chart" },
      { group: "Operação" },
      { id: "players", label: "Jogadores", icon: "users", count: db.players().length },
      { id: "transactions", label: "Transações", icon: "coins", badge: pendingWd().length },
      { id: "support", label: "Suporte", icon: "chat", badge: supUnreadTotal },
      { id: "kyc", label: "KYC & Risco", icon: "id", badge: pendingKyc().length + risk.list.length },
      { id: "bets", label: "Apostas", icon: "bars" },
      { group: "Produto" },
      { id: "games", label: "Jogos", icon: "grid" },
      { id: "promotions", label: "Promoções", icon: "gift" },
      { id: "media", label: "Banners & Imagens", icon: "image" },
      { group: "Crescimento" },
      { id: "affiliates", label: "Afiliados", icon: "link" },
      RD.live ? { id: "invites", label: "Convites", icon: "gift" } : null,
      RD.live ? { id: "rain", label: "Chuva (Rain)", icon: "coins" } : null,
      { id: "codes", label: "Códigos", icon: "gift" },
      { id: "vip", label: "VIP & Recompensas", icon: "crown" },
      { group: "Sistema" },
      { id: "settings", label: "Configurações", icon: "settings" },
      { id: "audit", label: "Log de auditoria", icon: "file" }
    ];
  }
  function renderNav(active) {
    $("#adm-nav").innerHTML = NAV().filter(Boolean).map(function (n) {
      if (n.group) return '<div class="adm-group">' + n.group + "</div>";
      return '<a class="adm-link' + (n.id === active ? " active" : "") + '" href="#/' + n.id + '">' + ic(n.icon, 17) + n.label +
        (n.badge ? '<span class="badge badge-warn">' + n.badge + "</span>" : n.count ? '<span class="badge">' + n.count + "</span>" : "") + "</a>";
    }).join("");
  }

  /* ---------- Helpers ---------- */
  var PT = { Completed: "Concluída", Pending: "Pendente", Rejected: "Rejeitada", Active: "Ativo", Suspended: "Suspenso", Verified: "Verificado", "Not started": "Não enviado", active: "Ativa", scheduled: "Agendada", draft: "Rascunho" };
  var CLS = { Completed: "badge-success", Active: "badge-success", Verified: "badge-success", active: "badge-success", Pending: "badge-warn", scheduled: "badge-info", Rejected: "badge-danger", Suspended: "badge-danger" };
  function badge(s) { return '<span class="badge ' + (CLS[s] || "") + '">' + (PT[s] || s) + "</span>"; }
  var TX = { Deposit: ["arrowDown", "Depósito", "pos"], Withdrawal: ["arrowUp", "Saque", "neg"], Bonus: ["gift", "Bônus", ""], Adjustment: ["sliders", "Ajuste manual", ""], Rakeback: ["bolt", "Rakeback", ""], "Level reward": ["crown", "Prêmio VIP", ""], Commission: ["link", "Comissão afiliado", ""], "Tip sent": ["send", "Gorjeta enviada", ""], "Tip received": ["send", "Gorjeta recebida", ""] };
  function txType(t) { var x = TX[t.type] || ["coins", t.type, ""]; return '<span class="' + x[2] + '">' + ic(x[0], 14) + " " + x[1] + (t.type === "Adjustment" && t.sign === -1 ? " (débito)" : "") + "</span>"; }
  function head(title, sub, actions) { return '<div class="adm-head"><div><h1 style="font-size:24px">' + title + "</h1>" + (sub ? "<p>" + sub + "</p>" : "") + '</div><div class="row">' + (actions || "") + "</div></div>"; }
  function kpi(label, value, note, cls) { return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value ' + (cls || "") + '">' + value + "</div>" + (note ? '<div class="kpi-delta faint">' + note + "</div>" : "") + "</div>"; }
  function openDrawer(title, html) { $("#adm-drawer-title").textContent = title; $("#adm-drawer-body").innerHTML = html; $("#adm-drawer").classList.add("open"); }
  function openModal(html) { $("#adm-modal-box").innerHTML = html; $("#adm-modal").classList.add("open"); }
  function closeAll() { $("#adm-drawer").classList.remove("open"); $("#adm-modal").classList.remove("open"); document.body.classList.remove("adm-open"); }
  function txTable(list, actions) {
    if (!list.length) return empty("Nada por aqui", "As transações aparecem conforme os jogadores usam o site.");
    return '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Jogador</th><th>Tipo</th><th class="right">Valor</th><th>Status</th><th>Data</th>' + (actions ? "<th></th>" : "") + "</tr></thead><tbody>" +
      list.map(function (t) {
        var act = actions ? (t.status === "Pending" && (t.type === "Withdrawal" || t.type === "Deposit") ? '<td class="right"><div class="row" style="gap:6px;justify-content:flex-end">' + (RD.config.npPayouts && t.type === "Withdrawal" && !/NOWPayments/.test(t.note || "") ? '<button class="btn btn-secondary btn-sm" data-act="np-send" data-id="' + t.id + '">Enviar via NOWPayments</button>' : "") + '<button class="btn btn-primary btn-sm" data-act="approve" data-id="' + t.id + '">Aprovar</button><button class="btn btn-danger btn-sm" data-act="reject" data-id="' + t.id + '">Rejeitar</button></div></td>' : "<td></td>") : "";
        return '<tr><td class="strong">' + t.id + '</td><td><a href="#" data-player="' + t.userId + '" class="link">' + esc(t.user) + "</a>" + (t.type === "Withdrawal" && t.status === "Pending" ? riskChip(t.userId) : "") + "</td><td>" + txType(t) + (t.coin ? ' <small class="faint">' + t.coin + "</small>" : "") + (t.net ? ' <small class="faint">' + esc(t.net) + "</small>" : "") + (t.address ? '<br><small class="faint" title="' + esc(t.address) + '">Para: <span class="mono">' + esc(t.address) + "</span></small>" : "") + (t.txHash ? '<br><small class="faint">TxID: <span class="mono">' + esc(t.txHash) + "</span></small>" : "") + (t.note ? '<br><small class="faint">' + esc(t.note) + "</small>" : "") + '</td><td class="right num strong">' + fmt.usd(t.amount) + "</td><td>" + badge(t.status) + '</td><td class="faint">' + fmt.date(t.date) + "</td>" + act + "</tr>";
      }).join("") + "</tbody></table></div>";
  }
  function betsTable(list) {
    if (!list.length) return empty("Nenhuma aposta ainda", "Assim que alguém jogar Dice ou Limbo, aparece aqui.");
    return '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Jogador</th><th>Jogo</th><th class="right">Aposta</th><th class="right">Mult.</th><th class="right">Resultado casa</th><th>Data</th></tr></thead><tbody>' +
      list.map(function (b) { var house = b.amount - b.payout; return '<tr><td class="faint">' + b.id + '</td><td><a href="#" data-player="' + b.userId + '">' + esc(b.user) + "</a></td><td>" + esc(gameOf(b.game).name) + '</td><td class="right num">' + fmt.usd(b.amount) + '</td><td class="right num">' + b.multiplier.toFixed(2) + '×</td><td class="right num strong ' + (house >= 0 ? "pos" : "neg") + '">' + fmt.usd(house, { sign: true }) + '</td><td class="faint">' + fmt.date(b.date) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }

  /* ---------- Páginas ---------- */
  var P = {};

  P.dashboard = function () {
    var k = db.kpis(period), pw = pendingWd(), pk = pendingKyc();
    var periods = [[1, "Hoje"], [7, "7 dias"], [30, "30 dias"], [0, "Tudo"]];
    var games = db.gameStats().slice(0, 6), recent = db.players().slice(-5).reverse();
    return head("Dashboard", "Números reais do sistema · USD", '<div class="segmented">' + periods.map(function (p) { return '<button data-period="' + p[0] + '" class="' + (p[0] === period ? "active" : "") + '">' + p[1] + "</button>"; }).join("") + "</div>") +
      (db.players().length ? "" : '<div class="notice info" style="margin-bottom:16px">' + ic("help", 16) + '<span>Sistema zerado. Abra o site, crie uma conta, faça um depósito de teste e jogue Dice: tudo aparece aqui em tempo real.</span></div>') +
      '<div class="kpi-grid">' + kpi("GGR (casa ganhou nos jogos)", fmt.usd(k.ggr), k.bets + " apostas", k.ggr >= 0 ? "" : "neg") + kpi("NGR (GGR − bônus)", fmt.usd(k.ngr), "bônus/rakeback: " + fmt.usd(k.bonus)) + kpi("Depósitos", fmt.usd(k.deposits), k.ftds + " primeiros depósitos") + kpi("Saques pagos", fmt.usd(k.withdrawals), pw.length + " pendentes") + "</div>" +
      '<div class="kpi-grid mt">' + kpi("Cadastros", fmt.int(k.signups)) + kpi("Jogadores ativos", fmt.int(k.activePlayers), "apostaram no período") + kpi("Volume apostado", fmt.usd(k.wagered)) + kpi("Saldo dos jogadores", fmt.usd(k.liabilities), "dinheiro que você deve ter em caixa") + "</div>" +
      '<div class="adm-grid-2 mt"><div class="card"><div class="card-head"><h3>GGR por dia (30 dias)</h3></div><div class="card-pad">' + RD.bars(db.daily(30), "ggr", function (v) { return fmt.usd(v); }) + "</div></div>" +
      '<div class="card"><div class="card-head"><h3>Requer ação</h3></div>' +
        (pw.length || pk.length ? (pw.length ? '<a class="queue-item" href="#/transactions/pending"><span class="avatar" style="background:var(--warn-soft);color:var(--warn)">' + ic("coins", 16) + '</span><div class="grow"><strong>' + pw.length + " saque(s) pendente(s)</strong><small>" + fmt.usd(pw.reduce(function (a, t) { return a + t.amount; }, 0)) + " aguardando aprovação</small></div>" + ic("chevronRight", 16) + "</a>" : "") +
          (pk.length ? '<a class="queue-item" href="#/kyc"><span class="avatar" style="background:var(--info-soft);color:var(--info)">' + ic("id", 16) + '</span><div class="grow"><strong>' + pk.length + " verificação(ões) KYC</strong><small>Documentos aguardando análise</small></div>" + ic("chevronRight", 16) + "</a>" : "")
          : empty("Tudo em dia", "Nenhum saque ou KYC aguardando.")) + "</div></div>" +
      '<div class="adm-grid-2 mt"><div class="card"><div class="card-head"><h3>Últimas transações</h3><a class="see-all" href="#/transactions">Ver todas</a></div>' + txTable(db.transactions().slice(0, 6), false) + "</div>" +
      '<div class="card"><div class="card-head"><h3>Novos jogadores</h3><a class="see-all" href="#/players">Ver todos</a></div>' + (recent.length ? recent.map(function (p) { return '<a class="queue-item" href="#" data-player="' + p.id + '"><span class="avatar">' + initials(p.username) + '</span><div class="grow"><strong>' + esc(p.username) + "</strong><small>" + esc(p.country) + " · " + fmt.date(p.created) + (p.referredBy ? " · via " + esc(p.referredBy) : "") + '</small></div><span class="num">' + fmt.usd(p.balance) + "</span></a>"; }).join("") : empty("Nenhum cadastro ainda", "")) + "</div></div>" +
      '<div class="card mt"><div class="card-head"><h3>Jogos (desde o início)</h3></div>' + (games.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Jogo</th><th class="right">Apostas</th><th class="right">Volume</th><th class="right">GGR</th><th class="right">Margem real</th></tr></thead><tbody>' + games.map(function (s) { return '<tr><td class="strong">' + esc(gameOf(s.game).name) + '</td><td class="right num">' + fmt.int(s.bets) + '</td><td class="right num">' + fmt.usd(s.wagered) + '</td><td class="right num strong ' + (s.ggr >= 0 ? "pos" : "neg") + '">' + fmt.usd(s.ggr) + '</td><td class="right num">' + (s.wagered ? ((s.ggr / s.wagered) * 100).toFixed(2) + "%" : "—") + "</td></tr>"; }).join("") + "</tbody></table></div>" : empty("Sem apostas ainda", "")) + "</div>";
  };

  P.players = function () {
    return head("Jogadores", db.players().length + " conta(s)") +
      '<div class="card"><div class="toolbar-a"><div class="input-search" style="flex:1;max-width:320px">' + ic("search") + '<input class="input" id="pl-q" placeholder="Usuário, e-mail ou ID"></div>' +
      '<select class="select" id="pl-kyc" style="width:170px"><option value="">KYC: todos</option><option value="Verified">Verificado</option><option value="Pending">Pendente</option><option value="Not started">Não enviado</option><option value="Rejected">Rejeitado</option></select>' +
      '<select class="select" id="pl-st" style="width:150px"><option value="">Status: todos</option><option value="Active">Ativo</option><option value="Suspended">Suspenso</option></select></div><div id="pl-body"></div></div>';
  };
  P.players.after = function () {
    var q = $("#pl-q"), k = $("#pl-kyc"), s = $("#pl-st");
    function draw() {
      var v = q.value.toLowerCase();
      var list = db.players().filter(function (p) { return (!v || (p.username + p.email + p.id).toLowerCase().indexOf(v) > -1) && (!k.value || p.kyc === k.value) && (!s.value || p.status === s.value); }).slice().reverse();
      $("#pl-body").innerHTML = list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Jogador</th><th>País</th><th>VIP</th><th class="right">Saldo</th><th class="right">Depósitos</th><th class="right">Saques</th><th class="right">Apostado</th><th>KYC</th><th>Status</th></tr></thead><tbody>' +
        list.map(function (p) { var t = db.tierOf(p.vipXp != null ? p.vipXp : p.wagered); return '<tr class="clickable" data-player="' + p.id + '"><td><div class="row" style="gap:10px"><span class="avatar">' + initials(p.username) + '</span><div><span class="strong">' + esc(p.username) + '</span><br><small class="faint">' + esc(p.email) + "</small></div></div></td><td>" + esc(p.country) + "</td><td>" + (t ? t.name : "—") + '</td><td class="right num strong">' + fmt.usd(p.balance) + '</td><td class="right num">' + fmt.usd(p.deposits) + '</td><td class="right num">' + fmt.usd(p.withdrawals) + '</td><td class="right num">' + fmt.usd(p.wagered) + "</td><td>" + badge(p.kyc) + "</td><td>" + badge(p.status) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : empty(db.players().length ? "Nenhum jogador encontrado" : "Nenhum jogador ainda", db.players().length ? "" : "Quando alguém se cadastrar no site, aparece aqui.");
    }
    [q, k, s].forEach(function (el) { el.addEventListener("input", draw); }); draw();
  };
  function playerDrawer(id) {
    var p = db.player(id); if (!p) return;
    /* jogo responsável: pausa, autoexclusão e limites que o próprio jogador definiu */
    if (db.adminRisk) setTimeout(function () { db.adminRisk(id, true).then(function (l) { var el = $("#pl-risk"); if (!el || !Array.isArray(l) || !l.length) return; el.innerHTML = '<div class="risk-list" style="margin-bottom:16px"><h4 style="margin-bottom:8px">Alertas antifraude</h4>' + riskList(l, true) + "</div>"; hydrate(el); }); }, 0);
    if (db.adminRg) setTimeout(function () { db.adminRg(id).then(function (g) { var el = $("#pl-rg"); if (!el || !g || g.error) return; var L = g.limits || {}, n = 0; ["deposit", "loss", "wager"].forEach(function (k) { if (L[k]) n += Object.keys(L[k]).length; });
      el.outerHTML = (g.excluded_until ? '<span class="badge badge-danger">Autoexcluído ' + (g.excluded_until === "infinity" ? "permanente" : "até " + String(g.excluded_until).slice(0, 10)) + "</span>" : "") + (g.break_until ? '<span class="badge badge-warn">Pausa até ' + String(g.break_until).slice(0, 16).replace("T", " ") + "</span>" : "") + (n ? '<span class="badge">' + n + (n === 1 ? " limite ativo" : " limites ativos") + "</span>" : ""); }); }, 0);
    var t = db.tierOf(p.vipXp != null ? p.vipXp : p.wagered), house = -p.profit, ref = p.referrerId ? db.player(p.referrerId) : null;
    openDrawer(p.username,
      '<div class="row" style="gap:12px;margin-bottom:16px"><span class="avatar" style="width:44px;height:44px;font-size:15px">' + initials(p.username) + '</span><div><strong>' + esc(p.username) + '</strong><br><small class="faint">' + esc(p.email) + " · " + p.id + "</small></div></div>" +
      '<div class="row wrap" style="gap:6px;margin-bottom:16px">' + badge(p.status) + badge(p.kyc) + '<span class="badge">' + (t ? t.name : "Sem nível") + '</span><span id="pl-rg"></span></div><div id="pl-risk"></div>' +
      '<div class="detail-grid"><div><small>Saldo</small><strong class="num">' + fmt.usd(p.balance) + '</strong></div><div><small>Resultado da casa</small><strong class="num ' + (house >= 0 ? "pos" : "neg") + '">' + fmt.usd(house) + '</strong></div><div><small>Depósitos</small><strong class="num">' + fmt.usd(p.deposits) + '</strong></div><div><small>Saques</small><strong class="num">' + fmt.usd(p.withdrawals) + '</strong></div><div><small>Apostado</small><strong class="num">' + fmt.usd(p.wagered) + " (" + p.bets + ' apostas)</strong></div><div><small>Bônus recebidos</small><strong class="num">' + fmt.usd(p.bonusTotal) + '</strong></div><div><small>País</small><strong>' + esc(p.country) + '</strong></div><div><small>Cadastro</small><strong>' + fmt.date(p.created) + '</strong></div><div><small>Indicado por</small><strong>' + (ref ? esc(ref.username) + " (" + esc(p.referredBy) + ")" : "—") + '</strong></div><div><small>Código de afiliado</small><strong>' + p.refCode + "</strong></div></div>" +
      (p.kycInfo ? '<h3 style="margin:20px 0 10px">KYC enviado</h3><div class="detail-grid"><div><small>Nome</small><strong>' + esc(p.kycInfo.name) + '</strong></div><div><small>Nascimento</small><strong>' + esc(p.kycInfo.dob) + '</strong></div><div><small>Documento</small><strong>' + esc(p.kycInfo.doc) + '</strong></div><div><small>Enviado</small><strong>' + esc(p.kycInfo.sent) + "</strong></div>" +
        (p.kycInfo.address ? '<div style="grid-column:1/-1"><small>Endereço</small><strong>' + esc(p.kycInfo.address + ", " + p.kycInfo.city + (p.kycInfo.postal ? " " + p.kycInfo.postal : "") + " — " + p.kycInfo.country) + "</strong></div>" : "") + "</div>" +
        (p.kycInfo.files && Object.keys(p.kycInfo.files).length ? '<div class="kyc-docs" id="kyc-docs">' + Object.keys(p.kycInfo.files).map(function (k) { return '<div class="kyc-doc-item"><small>' + ({ front: "Frente", back: "Verso", selfie: "Selfie", address: "Comprovante" }[k] || k) + '</small><div class="kyc-thumb" data-kpath="' + esc(p.kycInfo.files[k]) + '">Carregando…</div></div>'; }).join("") + "</div>" : "") +
        (p.kyc === "Pending" ? '<div class="row" style="gap:8px;margin-top:10px"><button class="btn btn-primary btn-sm" data-act="kyc-ok" data-id="' + p.id + '">Aprovar</button><button class="btn btn-danger btn-sm" data-act="kyc-no" data-id="' + p.id + '">Rejeitar</button></div>' : "") : "") +
      (p.reloadGrant && p.reloadGrant.used < p.reloadGrant.claims ? '<div class="notice info" style="margin-top:16px">' + ic("bolt", 16) + "<span>VIP Reload ativo: <b>" + fmt.usd(p.reloadGrant.per) + "</b> por resgate, " + p.reloadGrant.used + " de " + p.reloadGrant.claims + " resgatados, 1 a cada " + p.reloadGrant.hours + "h.</span></div>" : "") +
      (p.held > 0 ? '<div class="notice" style="margin-top:16px;border-color:rgba(255,200,92,.35)">' + ic("lock", 16) + "<span>Saldo retido: <b>" + fmt.usd(p.held) + "</b>. O jogador vê, mas não consegue usar nem sacar.</span></div>" : "") +
      '<h3 style="margin:20px 0 10px">Ações</h3><div class="row wrap" style="gap:8px">' +
        '<button class="btn btn-primary btn-sm" data-act="credit-dep" data-id="' + p.id + '">' + ic("arrowDown", 14) + "Creditar depósito</button>" +
        '<button class="btn btn-secondary btn-sm" data-act="adjust" data-id="' + p.id + '">' + ic("sliders", 14) + "Ajustar saldo</button>" +
        '<button class="btn btn-secondary btn-sm" data-act="hold" data-id="' + p.id + '">' + ic("lock", 14) + "Reter saldo</button>" +
        (p.held > 0 ? '<button class="btn btn-secondary btn-sm" data-act="release" data-id="' + p.id + '">Liberar retido</button><button class="btn btn-danger btn-sm" data-act="confiscate" data-id="' + p.id + '">Confiscar retido</button>' : "") +
        '<button class="btn btn-secondary btn-sm" data-act="bonus" data-id="' + p.id + '">' + ic("gift", 14) + "Dar bônus</button>" +
        '<button class="btn btn-secondary btn-sm" data-act="reload" data-id="' + p.id + '">' + ic("bolt", 14) + "VIP Reload</button>" +
        '<button class="btn btn-secondary btn-sm" data-act="aff-share" data-id="' + p.id + '">' + ic("link", 14) + "Comissão afiliado</button>" +
        (RD.live ? "" : '<button class="btn btn-secondary btn-sm" data-act="resetbets" data-id="' + p.id + '">Zerar apostas</button>') + (p.status === "Suspended" ? '<button class="btn btn-primary btn-sm" data-act="unsuspend" data-id="' + p.id + '">Reativar</button>' : '<button class="btn btn-danger btn-sm" data-act="suspend" data-id="' + p.id + '">' + ic("ban", 14) + "Suspender</button>") + "</div>" +
      '<div class="field" style="margin-top:20px"><label>Nota interna (só a equipe vê)</label><textarea class="textarea" id="pl-note" data-id="' + p.id + '">' + esc(p.note) + "</textarea></div>" +
      '<h3 style="margin:20px 0 10px">Transações</h3><div class="card">' + txTable(db.txOf(p.id).slice(0, 20), true) + "</div>" +
      '<h3 style="margin:20px 0 10px">Últimas apostas</h3><div class="card">' + betsTable(db.betsOf(p.id).slice(0, 20)) + "</div>");
    $("#pl-note").addEventListener("change", function () { db.setNote(p.id, this.value); RD.toast("Nota salva"); });
    /* Documentos do KYC: links temporários (10 min) do cofre privado */
    $$("[data-kpath]").forEach(function (el) {
      if (!db.kycFileUrl) { el.textContent = "Só no modo real"; return; }
      var path = el.getAttribute("data-kpath"), pdf = /\.pdf$/i.test(path);
      db.kycFileUrl(path).then(function (url) {
        if (!url) { el.textContent = "Não encontrado"; return; }
        el.innerHTML = '<a href="' + url + '" target="_blank" rel="noopener">' + (pdf ? '<span class="kyc-pdf">PDF · abrir</span>' : '<img src="' + url + '" alt="">') + "</a>";
      });
    });
  }

  P.transactions = function (filter) {
    filter = filter || "all";
    var list = db.transactions().filter(function (t) { return filter === "all" || (filter === "pending" && t.status === "Pending" && (t.type === "Withdrawal" || t.type === "Deposit")) || (filter === "deposits" && t.type === "Deposit") || (filter === "withdrawals" && t.type === "Withdrawal") || (filter === "bonus" && ["Bonus", "Adjustment", "Rakeback", "Level reward", "Commission"].indexOf(t.type) > -1); });
    var tabs = [["all", "Todas"], ["pending", "Pendentes (" + pendingWd().length + ")"], ["deposits", "Depósitos"], ["withdrawals", "Saques"], ["bonus", "Bônus e ajustes"]];
    return head("Transações", RD.live ? "Depósitos: confira o TxID na Kraken e aprove para creditar. Saques: envie pela Kraken e aprove; rejeitar devolve o valor ao jogador." : "Saques só saem depois da sua aprovação. Rejeitar devolve o valor ao saldo do jogador.") +
      '<div class="tabs" style="margin-bottom:16px">' + tabs.map(function (t) { return '<a class="tab' + (t[0] === filter ? " active" : "") + '" href="#/transactions/' + t[0] + '">' + t[1] + "</a>"; }).join("") + "</div>" +
      '<div class="card">' + txTable(list, true) + "</div>";
  };

  P.bets = function () { return head("Apostas", "Todas as apostas dos jogos próprios, em tempo real") + '<div class="card">' + betsTable(db.allBets().slice(0, 200)) + "</div>"; };

  P.kyc = function () {
    var pend = pendingKyc(), all = db.players();
    var big = all.filter(function (p) { return p.deposits >= 1000 && p.kyc !== "Verified"; });
    return head("KYC & Risco", "Verificação de identidade dos jogadores") +
      '<div class="kpi-grid">' + kpi("Pendentes", pend.length) + kpi("Verificados", all.filter(function (p) { return p.kyc === "Verified"; }).length) + kpi("Rejeitados", all.filter(function (p) { return p.kyc === "Rejected"; }).length) + kpi("Sem KYC com +$1.000 depositados", big.length) + "</div>" +
      '<div class="card mt"><div class="card-head"><h3>' + ic("shield", 16) + ' Alertas antifraude</h3><small class="faint">O sistema só sinaliza. Ninguém é bloqueado automaticamente; se quiser segurar, rejeite e retenha o saque.</small></div>' +
        (risk.list.length ? '<div class="risk-list">' + riskList(risk.list, true) + "</div>" : empty("Nenhum alerta aberto", "Multicontas, autoindicação, abuso de bônus e saques suspeitos aparecem aqui.")) + "</div>" +
      '<div class="adm-grid-2 mt"><div class="card"><div class="card-head"><h3>Fila de verificação</h3></div>' +
        (pend.length ? pend.map(function (p) { return '<div class="queue-item"><span class="avatar">' + initials(p.username) + '</span><div class="grow"><strong>' + esc(p.username) + "</strong><small>" + esc(p.kycInfo ? p.kycInfo.name + " · " + p.kycInfo.doc : "") + '</small></div><button class="btn btn-secondary btn-sm" data-player="' + p.id + '">Ver</button><button class="btn btn-primary btn-sm" data-act="kyc-ok" data-id="' + p.id + '">Aprovar</button><button class="btn btn-danger btn-sm" data-act="kyc-no" data-id="' + p.id + '">Rejeitar</button></div>'; }).join("") : empty("Nenhuma verificação pendente", "")) + "</div>" +
      '<div class="card"><div class="card-head"><h3>Atenção</h3></div>' + (big.length ? big.map(function (p) { return '<div class="queue-item"><div class="grow"><strong>' + esc(p.username) + "</strong><small>Depositou " + fmt.usd(p.deposits) + " sem KYC aprovado</small></div><button class=\"btn btn-secondary btn-sm\" data-player=\"" + p.id + '">Ver</button></div>'; }).join("") : empty("Nenhum alerta", "")) + "</div></div>" +
      '<div class="notice info mt">' + ic("shield", 16) + "<span>Em produção, integre um serviço de KYC (Sumsub, Veriff ou similar) para checar documento, rosto e listas de sanções automaticamente.</span></div>";
  };

  P.games = function () {
    var st = {}; db.gameStats().forEach(function (s) { st[s.game] = s; });
    return head("Jogos", RD.games.length + " jogos · Dice e Limbo funcionando") +
      '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Jogo</th><th>Provedor</th><th>Situação</th><th class="right">Apostas</th><th class="right">GGR</th><th>Destaque</th><th class="right">Visível</th></tr></thead><tbody>' +
      RD.games.map(function (g) { var s = st[g.id]; return '<tr><td><div class="row" style="gap:10px">' + media(g, "thumb", "") + '<span class="strong">' + esc(g.name) + "</span></div></td><td>" + esc(g.provider) + "</td><td>" + (g.playable ? '<span class="badge badge-success">Jogável</span>' : '<span class="badge">Vitrine</span>') + '</td><td class="right num">' + (s ? fmt.int(s.bets) : "—") + '</td><td class="right num">' + (s ? fmt.usd(s.ggr) : "—") + '</td><td><select class="select" style="height:30px;width:100px;font-size:12px" data-tag="' + g.id + '"><option value="">—</option><option' + (g.tag === "hot" ? " selected" : "") + ' value="hot">Hot</option><option' + (g.tag === "new" ? " selected" : "") + ' value="new">New</option></select></td><td class="right"><label class="switch"><input type="checkbox" data-toggle-game="' + g.id + '"' + (g.enabled ? " checked" : "") + "><span></span></label></td></tr>"; }).join("") +
      "</tbody></table></div></div>";
  };

  P.promotions = function () {
    return head("Promoções", "O que aparece na página Promotions do site", '<button class="btn btn-primary btn-sm" data-act="new-promo">' + ic("plus", 16) + "Nova promoção</button>") +
      '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Promoção</th><th>Valor</th><th>Etiqueta</th><th>Status</th><th></th></tr></thead><tbody>' +
      RD.promotions.map(function (p) { return '<tr><td><div class="row" style="gap:10px">' + media(p, "thumb", "") + '<span class="strong">' + esc(p.title) + "</span></div></td><td>" + esc(p.value) + "</td><td>" + esc(p.badge) + "</td><td>" + badge(p.status) + '</td><td class="right"><button class="btn btn-ghost btn-sm" data-act="edit-promo" data-id="' + p.id + '">' + ic("edit", 14) + "Editar</button></td></tr>"; }).join("") +
      "</tbody></table></div></div>";
  };
  function promoForm(p) {
    p = p || { title: "", value: "", desc: "", badge: "", status: "draft", id: "" };
    openModal('<div class="modal-head"><h3>' + (p.id ? "Editar promoção" : "Nova promoção") + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="promo-form"><div class="modal-body">' +
      '<div class="adm-grid-2" style="gap:12px"><div class="field"><label>Título (inglês)</label><input class="input" name="title" required value="' + esc(p.title) + '"></div><div class="field"><label>Valor em destaque</label><input class="input" name="value" required value="' + esc(p.value) + '" placeholder="100% up to $1,000"></div></div>' +
      '<div class="field"><label>Descrição (inglês, aparece no site)</label><textarea class="textarea" name="desc">' + esc(p.desc) + "</textarea></div>" +
      '<div class="adm-grid-2" style="gap:12px"><div class="field"><label>Etiqueta</label><input class="input" name="badge" value="' + esc(p.badge) + '" placeholder="Weekly"></div><div class="field"><label>Status</label><select class="select" name="status"><option value="active"' + (p.status === "active" ? " selected" : "") + '>Ativa</option><option value="scheduled"' + (p.status === "scheduled" ? " selected" : "") + '>Agendada</option><option value="draft"' + (p.status === "draft" ? " selected" : "") + ">Rascunho</option></select></div></div>" +
      '<p class="faint" style="font-size:12px">Imagem: salve em assets/img/promos/' + (p.id || "&lt;id&gt;") + ".jpg (1200×600).</p></div>" +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Salvar</button></div></form>');
    $("#promo-form").addEventListener("submit", function (e) {
      e.preventDefault(); var f = e.target, x;
      if (p.id) { x = RD.promotions.filter(function (y) { return y.id === p.id; })[0]; }
      else { x = { id: "p" + Date.now(), c1: "#1d4ed8", c2: "#0b2a6b" }; RD.promotions.push(x); x.img = "assets/img/promos/" + x.id + ".jpg"; }
      x.title = f.title.value; x.value = f.value.value; x.desc = f.desc.value; x.badge = f.badge.value || "New"; x.status = f.status.value;
      db.savePromotions((p.id ? "Editou" : "Criou") + " promoção '" + x.title + "'");
      closeAll(); RD.toast("Promoção salva"); route();
    });
  }

  P.media = function () {
    var slots = [];
    RD.banners.forEach(function (b) { slots.push({ group: "Banners da home (3 cards)", name: b.title, path: b.img, size: "1200×600", o: b }); });
    RD.promotions.forEach(function (p) { slots.push({ group: "Promoções", name: p.title, path: p.img, size: "1200×600", o: p }); });
    slots.push({ group: "Afiliados", name: "Topo da página de afiliados", path: RD.img.heroAffiliate, size: "1920×800", o: { img: RD.img.heroAffiliate, art: RD.img.heroArt } });
    RD.affiliateAssets.forEach(function (a) { slots.push({ group: "Afiliados", name: "Material: " + a.name, path: a.img, size: a.size, o: a }); });
    RD.games.forEach(function (g) { slots.push({ group: "Capas dos jogos", name: g.name, path: g.img, size: "600×800", o: g }); });
    var groups = {}; slots.forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    return head("Banners & Imagens", "Cada espaço do site que aceita foto. 'Faltando' = ainda sem arquivo.") +
      '<div class="notice info" style="margin-bottom:20px">' + ic("upload", 16) + "<span>Para trocar uma imagem: salve o arquivo com o nome exato em <code>assets/img/…</code>, adicione o caminho em <code>RD.imgFiles</code> (assets/js/data.js) e publique.</span></div>" +
      Object.keys(groups).map(function (g) {
        return '<div class="section-a"><h3 style="margin:8px 0 12px">' + g + '</h3><div class="adm-grid-4">' + groups[g].map(function (s) {
          return '<div class="card img-slot">' + media(s.o, "", ic("image", 22) + "<span>Sem imagem</span>") + '<div class="img-slot-body"><strong style="font-size:13px">' + esc(s.name) + "</strong><code>" + s.path + '</code><div class="row between"><span class="badge">' + s.size + '</span><span class="img-status" data-src="../' + s.path + '"><span class="badge">…</span></span></div></div></div>';
        }).join("") + "</div></div>";
      }).join("");
  };
  P.media.after = function () {
    $$(".img-status").forEach(function (el) {
      var im = new Image();
      im.onload = function () { el.innerHTML = '<span class="badge badge-success">OK</span>'; };
      im.onerror = function () { el.innerHTML = '<span class="badge badge-warn">Faltando</span>'; };
      im.src = el.getAttribute("data-src");
    });
  };

  P.affiliates = function () {
    var list = db.affiliatesList();
    return head("Afiliados", "Todo jogador tem um link de indicação. Aqui aparecem os que já trouxeram alguém ou têm acordo próprio.") +
      '<div class="kpi-grid">' + kpi("Afiliados com indicações", list.length) + kpi("Jogadores indicados", list.reduce(function (a, x) { return a + x.signups; }, 0)) + kpi("NGR via afiliados", fmt.usd(list.reduce(function (a, x) { return a + x.ngr; }, 0))) + kpi("Comissão a coletar", fmt.usd(list.reduce(function (a, x) { return a + x.available; }, 0))) + "</div>" +
      '<div class="card mt">' + (list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Afiliado</th><th>Código</th><th class="right">Comissão</th><th class="right">Indicados</th><th class="right">FTDs</th><th class="right">NGR</th><th class="right">A coletar</th><th></th></tr></thead><tbody>' +
        list.map(function (a) { return '<tr><td><a href="#" data-player="' + a.id + '" class="strong">' + esc(a.username) + '</a><br><small class="faint">' + esc(a.email) + '</small></td><td><span class="badge">' + a.code + '</span></td><td class="right">' + a.share + "%" + (a.custom ? ' <span class="badge badge-brand">custom</span>' : "") + '</td><td class="right num">' + a.signups + '</td><td class="right num">' + a.ftds + '</td><td class="right num ' + (a.ngr < 0 ? "neg" : "") + '">' + fmt.usd(a.ngr) + '</td><td class="right num strong">' + fmt.usd(a.available) + '</td><td class="right"><button class="btn btn-ghost btn-sm" data-act="aff-share" data-id="' + a.id + '">' + ic("edit", 14) + "</button></td></tr>"; }).join("") +
        "</tbody></table></div>" : empty("Nenhum afiliado ativo ainda", "Quando alguém se cadastrar usando o link de outro jogador, os dois aparecem aqui.")) + "</div>" +
      '<div class="card card-pad mt"><h3>Plano padrão (por primeiros depósitos no mês)</h3><div class="table-wrap" style="margin-top:10px"><table class="table"><tbody>' +
        RD.affiliatePlans.map(function (p) { return '<tr><td class="strong">' + p.label + "</td><td>" + p.range + '</td><td class="right strong">' + p.share + "%</td></tr>"; }).join("") +
      '</tbody></table></div><p class="faint" style="font-size:12px;margin-top:8px">Para um acordo diferente com um afiliado específico, use "Comissão afiliado" na ficha dele.</p></div>';
  };

  /* VIP: quantos jogadores em cada nível, prêmios pagos e prêmios liberados ainda não resgatados */
  P.vip = function () {
    var ps = db.players(), txs = db.transactions();
    var paid = function (type) { return txs.filter(function (t) { return t.type === type && t.status === "Completed"; }).reduce(function (a, t) { return a + t.amount; }, 0); };
    var acc = 0, peak = 0;
    var rows = RD.vipTiers.map(function (t, i) {
      acc += t.reward; var cost = acc / t.wager * 100; if (cost > peak) peak = cost;
      var nxt = RD.vipTiers[i + 1], xp = function (p) { return p.vipXp != null ? p.vipXp : p.wagered; }, at = ps.filter(function (p) { return xp(p) >= t.wager && (!nxt || xp(p) < nxt.wager); }).length;
      var reached = ps.filter(function (p) { return xp(p) >= t.wager; }), claimed = reached.filter(function (p) { return p.claimedTiers.indexOf(t.name) > -1; }).length;
      return { t: t, at: at, claimed: claimed, open: reached.length - claimed, cost: cost };
    });
    var owed = rows.reduce(function (a, r) { return a + r.open * r.t.reward; }, 0), rakeOpen = ps.reduce(function (a, p) { return a + p.rakeback; }, 0);
    return head("VIP & Recompensas", "Níveis por valor apostado. O prêmio de cada nível é pago uma vez, quando o jogador resgata na página VIP.") +
      '<div class="kpi-grid">' + kpi("Prêmios de nível pagos", fmt.usd(paid("Level reward"))) + kpi("Prêmios liberados, não resgatados", fmt.usd(owed), "o jogador ainda pode resgatar") + kpi("Rakeback pago", fmt.usd(paid("Rakeback"))) + kpi("Rakeback acumulado", fmt.usd(rakeOpen), "ainda não resgatado") + "</div>" +
      '<div class="card mt"><div class="table-wrap"><table class="table"><thead><tr><th>Nível</th><th class="right">Apostado para chegar</th><th class="right">Prêmio</th><th class="right">Jogadores neste nível</th><th class="right">Resgataram</th><th class="right">Falta resgatar</th><th class="right">Custo acumulado</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td><span class="row" style="gap:10px">' + RD.art.tierBadge(r.t, 26) + '<b>' + r.t.name + '</b></span></td><td class="right num">' + fmt.usd(r.t.wager, { dec: 0 }) + '</td><td class="right num strong">' + fmt.usd(r.t.reward, { dec: 0 }) + '</td><td class="right">' + r.at + '</td><td class="right">' + r.claimed + '</td><td class="right">' + (r.open ? '<span class="badge badge-warn">' + r.open + "</span>" : "0") + '</td><td class="right num ' + (r.cost >= 1 ? "neg" : "faint") + '">' + r.cost.toFixed(2) + "% do apostado</td></tr>"; }).join("") +
      '</tbody></table></div></div><p class="faint" style="font-size:12.5px;margin-top:10px">Custo acumulado = soma de todos os prêmios até o nível ÷ valor apostado para chegar nele. Chega a ' + peak.toFixed(2) + '% (mais ' + (RD.config.rakebackRate * 100) + '% da vantagem da casa em rakeback). Nos originais a casa ganha de 1% a 2% do apostado; em vermelho, os níveis em que o VIP custa 1% ou mais. Os valores ficam em <code>assets/js/data.js</code> (RD.vipTiers).</p>' +
      '<div class="card card-pad mt"><h3 style="margin-bottom:10px">Bônus recorrentes</h3><p class="faint" style="font-size:13px;margin-bottom:12px">Base = vantagem da casa gerada pelo jogador no período (valor apostado × vantagem do jogo). Cada bônus devolve uma fatia disso, então nunca custa mais do que o jogador gerou.</p><div class="table-wrap"><table class="table"><thead><tr><th>Bônus</th><th>Libera a partir de</th><th class="right">Devolve</th><th class="right">Frequência</th></tr></thead><tbody>' +
      '<tr><td class="strong">Rakeback instantâneo</td><td>Todos</td><td class="right">' + (RD.config.rakebackRate * 100) + '% da vantagem</td><td class="right">A qualquer momento</td></tr>' +
      Object.keys(RD.config.bonuses).filter(function (k) { return k !== "reload"; }).map(function (k) { var c = RD.config.bonuses[k]; return '<tr><td class="strong">' + c.label + '</td><td>' + c.minTier + '</td><td class="right">' + (c.rate * 100) + '% da vantagem' + (k === "reload" ? " dos últimos " + c.lookbackDays + " dias, em " + c.claims + " partes" : "") + '</td><td class="right">' + (k === "reload" ? "1 por dia" : c.hours === 24 ? "Diário" : c.hours === 168 ? "Semanal" : "Mensal") + "</td></tr>"; }).join("") +
      '<tr><td class="strong">VIP Reload</td><td>Jade 2, quem você escolher</td><td class="right">Valor que você define</td><td class="right">Jogadores → VIP Reload</td></tr>' +
      '</tbody></table></div><p class="faint" style="font-size:12.5px;margin-top:10px">Somando tudo (sem o reload), os bônus devolvem até ' + Math.round((RD.config.rakebackRate + ['daily', 'weekly', 'monthly'].reduce(function (a, k) { return a + RD.config.bonuses[k].rate; }, 0)) * 1000) / 10 + '% da vantagem da casa. Ajuste as taxas em <code>RD.config.bonuses</code>.</p></div>';
  };

  /* Convites (modo real): só quem tem código consegue criar conta */
  P.invites = function () {
    var list = db.invites ? db.invites() : [], free = list.filter(function (i) { return !i.used_at; }).length;
    var link = location.origin + location.pathname.replace(/admin\/?(index\.html)?$/, "") + "?live=1&invite=";
    return head("Convites", "O cadastro é aberto. Códigos servem para campanhas ou para criar contas de administrador. Cada código vale para uma conta só.") +
      '<div class="kpi-grid">' + kpi("Convites gerados", list.length) + kpi("Disponíveis", free) + kpi("Usados", list.length - free) + "</div>" +
      '<div class="card card-pad mt"><form id="inv-form" class="row wrap" style="gap:12px;align-items:flex-end"><div class="field" style="margin:0;width:140px"><label>Quantidade</label><input class="input" type="number" name="n" min="1" max="200" value="10" required></div><div class="field grow" style="margin:0;min-width:200px"><label>Anotação (opcional)</label><input class="input" name="note" placeholder="ex.: amigos da RD"></div><button class="btn btn-primary">Gerar convites</button></form></div>' +
      '<div class="card mt">' + (list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Anotação</th><th>Status</th><th>Usado por</th><th>Criado</th><th></th></tr></thead><tbody>' +
        list.map(function (i) { return '<tr><td class="strong mono">' + esc(i.code) + (i.is_admin ? ' <span class="badge">admin</span>' : "") + "</td><td>" + esc(i.note || "") + "</td><td>" + (i.used_at ? '<span class="badge">Usado</span>' : '<span class="badge badge-success">Disponível</span>') + "</td><td>" + esc(i.used_by_username || "—") + '</td><td class="faint">' + fmt.date(i.created_at) + '</td><td class="right">' + (i.used_at ? "" : '<button class="btn btn-secondary btn-sm" data-copy-inv="' + esc(link + i.code) + '">Copiar link</button>') + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : empty("Nenhum convite ainda", "Gere os primeiros códigos acima.")) + "</div>";
  };
  P.invites.after = function () {
    $("#inv-form").addEventListener("submit", function (e) {
      e.preventDefault(); var f = e.target, b = f.querySelector("button"); b.disabled = true;
      Promise.resolve(db.createInvites(+f.n.value, f.note.value)).then(function (codes) { RD.toast((codes || []).length + " convites gerados"); route(); }, function () { b.disabled = false; });
    });
    $$("[data-copy-inv]").forEach(function (b) { b.addEventListener("click", function () { RD.copy(b.getAttribute("data-copy-inv")); }); });
  };

  /* Chuva: a casa coloca um valor que é dividido entre quem clicar "Join" no chat */
  P.rain = function () {
    return head("Chuva (Rain)", "Você coloca um valor e ele é dividido igualmente entre os jogadores que clicarem em Join no chat antes do tempo acabar. Os jogadores também podem aumentar o pote.") +
      '<div class="card card-pad"><form id="rain-form" class="row wrap" style="gap:12px;align-items:flex-end">' +
      '<div class="field" style="margin:0;width:160px"><label>Valor (USD)</label><input class="input" type="number" name="amt" min="1" step="1" value="50" required></div>' +
      '<div class="field" style="margin:0;width:160px"><label>Duração (minutos)</label><input class="input" type="number" name="min" min="1" max="1440" value="5" required></div>' +
      '<div class="field" style="margin:0;width:220px"><label>Apostado nos últimos 7 dias para entrar (USD)</label><input class="input" type="number" name="wag" min="0" step="1" value="100" required></div>' +
      '<button class="btn btn-primary">Começar chuva / reforçar pote</button></form><p class="faint" style="font-size:12.5px;margin-top:10px">Se já tiver uma chuva aberta (a de hora em hora), o valor entra no pote dela. O apostado mínimo evita que alguém crie várias contas só para pegar a chuva. A divisão acontece sozinha quando o tempo acaba.</p></div>' +
      (db.rainAuto ? (function () { var c = db.rainAuto() || { enabled: false, amount: 0, min_wager: 0 }; return '<div class="card card-pad mt"><h3 style="margin-bottom:6px">Chuva automática de hora em hora</h3><p class="faint" style="font-size:13px;margin-bottom:12px">Sempre tem uma chuva aberta no chat, com cronômetro até a virada da hora. O pote começa com o valor da casa e os jogadores podem aumentar. Se ninguém entrar, a casa não paga nada.</p>' +
        '<form id="rain-auto" class="row wrap" style="gap:12px;align-items:flex-end"><label class="check" style="margin:0 8px 10px 0"><input type="checkbox" name="on"' + (c.enabled ? " checked" : "") + '><span>Ligada</span></label>' +
        '<div class="field" style="margin:0;width:180px"><label>Pote da casa por hora (USD)</label><input class="input" type="number" name="amt" min="0" step="0.5" value="' + (+c.amount || 0) + '" required></div>' +
        '<div class="field" style="margin:0;width:220px"><label>Apostado nos últimos 7 dias para entrar (USD)</label><input class="input" type="number" name="wag" min="0" step="1" value="' + (+c.min_wager || 0) + '" required></div>' +
        '<button class="btn btn-primary">Salvar</button></form><p class="faint" id="rain-cost" style="font-size:12.5px;margin-top:10px">Custo máximo: ' + fmt.usd((+c.amount || 0) * 24 * 30, { dec: 0 }) + " por mês (se alguém entrar em todas as chuvas). Vale na hora para a chuva aberta.</p></div>"; })() : "") +
      '<div class="card mt" id="rain-list"><div class="card-pad faint">Carregando…</div></div>';
  };
  P.rain.after = function () {
    if ($("#rain-auto")) {
      var ra = $("#rain-auto");
      ra.amt.addEventListener("input", function () { $("#rain-cost").textContent = "Custo máximo: " + fmt.usd((+ra.amt.value || 0) * 24 * 30, { dec: 0 }) + " por mês (se alguém entrar em todas as chuvas). Vale na hora para a chuva aberta."; });
      ra.addEventListener("submit", function (e) { e.preventDefault(); db.setRainAuto(ra.on.checked, +ra.amt.value, +ra.wag.value).then(function () { RD.toast("Chuva automática salva"); route(); }, function () {}); });
    }
    $("#rain-form").addEventListener("submit", function (e) {
      e.preventDefault(); var f = e.target, b = f.querySelector("button"); b.disabled = true;
      db.adminStartRain(+f.amt.value, +f.min.value, +f.wag.value).then(function () { RD.toast("Chuva começou! Aparece no chat de todo mundo."); route(); }, function () { b.disabled = false; });
    });
    db.adminRains().then(function (list) {
      var box = $("#rain-list"); if (!box) return;
      box.innerHTML = list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Início</th><th class="right">Pote</th><th class="right">Da casa</th><th class="right">Participantes</th><th class="right">Cada um</th><th>Status</th></tr></thead><tbody>' +
        list.map(function (r) { return "<tr><td>" + r.id + '</td><td class="faint">' + fmt.date(r.starts_at) + '</td><td class="right num strong">' + fmt.usd(+r.amount) + '</td><td class="right num">' + fmt.usd(+r.house_amount) + '</td><td class="right">' + r.participants + '</td><td class="right num">' + (r.per_user != null ? fmt.usd(+r.per_user) : "—") + "</td><td>" + (r.status === "open" ? '<span class="badge badge-success">Ao vivo</span>' : '<span class="badge">Encerrada</span>') + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : empty("Nenhuma chuva ainda", "Comece a primeira acima.");
    });
  };

  /* ---------- Suporte ao vivo: conversas dos jogadores ---------- */
  var supUnreadTotal = 0, supSel = null, supThreads = [];
  function supRefreshCount() {
    if (!db.adminSupportThreads) return;
    Promise.resolve(db.adminSupportThreads()).then(function (list) {
      supThreads = list; var n = list.reduce(function (a, t) { return a + (t.unread || 0); }, 0);
      if (n !== supUnreadTotal) { supUnreadTotal = n; renderNav(location.hash.replace("#/", "").split("/")[0] || "dashboard"); }
      document.title = (n ? "(" + n + ") " : "") + "RDCasino Admin";
      if (/^#\/support/.test(location.hash)) supDraw();
    });
  }
  function beep() { try { var c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.15, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4); o.start(); o.stop(c.currentTime + 0.4); } catch (x) {} }
  P.support = function () {
    return head("Suporte ao vivo", "Mensagens dos jogadores pelo botão de suporte do site. Responda aqui; o jogador recebe na hora.") +
      '<div class="sup-admin"><div class="card sup-a-list" id="sup-a-list"><div class="card-pad faint">Carregando…</div></div><div class="card sup-a-chat" id="sup-a-chat"><div class="empty" style="padding:60px 20px"><h3>Escolha uma conversa</h3><p>As mensagens novas aparecem com um aviso e um som.</p></div></div></div>';
  };
  function supDraw() {
    var box = $("#sup-a-list"); if (!box) return;
    box.innerHTML = supThreads.length ? supThreads.map(function (t) {
      return '<button class="sup-a-item' + (t.userId === supSel ? " active" : "") + '" data-sup-user="' + t.userId + '"><span class="avatar">' + initials(t.user) + '</span><span class="grow"><b>' + esc(t.user) + (t.status === "closed" ? ' <small class="faint">· resolvida</small>' : "") + '</b><small>' + esc(t.lastText || "") + '</small></span><span class="sup-a-meta"><small class="faint">' + fmt.date(t.lastAt).slice(-5) + "</small>" + (t.unread ? '<span class="badge badge-brand">' + t.unread + "</span>" : "") + "</span></button>";
    }).join("") : empty("Nenhuma conversa ainda", "Quando um jogador escrever no suporte, aparece aqui.");
  }
  function supOpen(uid) {
    supSel = uid; supDraw();
    var t = supThreads.filter(function (x) { return x.userId === uid; })[0] || {}, chat = $("#sup-a-chat");
    Promise.resolve(db.adminSupportMessages(uid)).then(function (msgs) {
      chat.innerHTML = '<div class="card-head"><div><h3>' + esc(t.user || "") + '</h3><small class="faint">' + (t.status === "closed" ? "Resolvida" : "Aberta") + '</small></div><div class="row" style="gap:6px"><button class="btn btn-secondary btn-sm" data-player="' + uid + '">Ver jogador</button><button class="btn btn-secondary btn-sm" data-sup-status="' + (t.status === "closed" ? "open" : "closed") + '">' + (t.status === "closed" ? "Reabrir" : "Marcar resolvida") + "</button></div></div>" +
        '<div class="sup-a-thread" id="sup-a-thread">' + msgs.map(function (m) { return '<div class="sup-a-msg' + (m.fromStaff ? " staff" : "") + '"><p>' + esc(m.text) + "</p><small>" + (m.fromStaff ? esc(m.staff || "Equipe") + " · " : "") + fmt.date(m.at) + "</small></div>"; }).join("") + "</div>" +
        '<form class="sup-a-form" id="sup-a-form"><textarea name="t" rows="2" placeholder="Responder em inglês (o jogador vê na hora)…" required></textarea><button class="btn btn-primary">Enviar</button></form>';
      var th = $("#sup-a-thread"); th.scrollTop = th.scrollHeight;
      $("#sup-a-form").addEventListener("submit", function (e) {
        e.preventDefault(); var f = e.target, v = f.t.value.trim(); if (!v) return; f.querySelector("button").disabled = true;
        Promise.resolve(db.adminSupportReply(uid, v)).then(function (r) { if (r && r.error) { RD.toast(r.error, "error"); f.querySelector("button").disabled = false; return; } supRefreshCount(); supOpen(uid); });
      });
      $("#sup-a-form").t.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#sup-a-form").requestSubmit(); } });
      if (t.unread) Promise.resolve(db.adminSupportSeen(uid)).then(supRefreshCount);
    });
  }
  P.support.after = function () {
    supDraw(); supRefreshCount();
    $("#sup-a-list").addEventListener("click", function (e) { var b = e.target.closest("[data-sup-user]"); if (b) supOpen(b.getAttribute("data-sup-user")); });
    $("#sup-a-chat").addEventListener("click", function (e) { var b = e.target.closest("[data-sup-status]"); if (!b) return; Promise.resolve(db.adminSupportStatus(supSel, b.getAttribute("data-sup-status"))).then(function () { supRefreshCount(); setTimeout(function () { supOpen(supSel); }, 300); }); });
    if (supSel) supOpen(supSel);
  };
  /* Mensagem nova: som + aviso, em qualquer página do admin */
  function supIncoming(row) {
    if (row && row.from_staff) return;
    if (Date.now() - (supIncoming.last || 0) > 4000) { supIncoming.last = Date.now(); beep(); RD.toast("Nova mensagem no suporte"); }
    supRefreshCount();
    if (supSel && row && row.user_id === supSel && /^#\/support/.test(location.hash)) supOpen(supSel);
  }
  if (db.onAdminSupport) db.onAdminSupport(supIncoming);
  setInterval(function () { var before = supUnreadTotal; supRefreshCount(); setTimeout(function () { if (supUnreadTotal > before) supIncoming(null); }, 1200); }, 8000);
  setTimeout(supRefreshCount, 1500);

  /* Códigos promocionais: você cria e posta (Telegram, X...); o jogador digita em Rewards */
  P.codes = function () {
    return head("Códigos promocionais", "Crie um código, poste onde quiser e o jogador resgata na área de Rewards. Cada jogador usa cada código uma vez.") +
      '<div class="card card-pad"><form id="code-form" class="row wrap" style="gap:12px;align-items:flex-end">' +
      '<div class="field" style="margin:0;width:170px"><label>Código</label><input class="input" name="code" required maxlength="24" placeholder="Ex.: DAILY5" style="text-transform:uppercase"></div>' +
      '<div class="field" style="margin:0;width:130px"><label>Valor (USD)</label><input class="input" type="number" name="amt" min="0.01" step="0.01" required placeholder="1"></div>' +
      '<div class="field" style="margin:0;width:150px"><label>Máx. de usos (0 = sem limite)</label><input class="input" type="number" name="max" min="0" step="1" value="50"></div>' +
      '<div class="field" style="margin:0;width:170px"><label>Apostado mínimo (USD)</label><input class="input" type="number" name="wag" min="0" step="1" value="0"></div>' +
      '<div class="field" style="margin:0;width:150px"><label>Expira em (horas, 0 = nunca)</label><input class="input" type="number" name="hrs" min="0" step="1" value="24"></div>' +
      '<button class="btn btn-primary">Criar código</button></form><p class="faint" id="code-cost" style="font-size:12.5px;margin-top:10px"></p></div>' +
      '<div class="card mt" id="code-list"><div class="card-pad faint">Carregando…</div></div>';
  };
  P.codes.after = function () {
    var f = $("#code-form"), cost = function () { var a = +f.amt.value || 0, m = +f.max.value || 0; $("#code-cost").textContent = a ? (m ? "Custo máximo: " + fmt.usd(a * m) + " (" + m + " × " + fmt.usd(a) + ")." : "Sem limite de usos: custo = " + fmt.usd(a) + " por jogador que resgatar.") : ""; };
    ["amt", "max"].forEach(function (k) { f[k].addEventListener("input", cost); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      after(db.saveCode({ code: f.code.value.trim().toUpperCase(), amount: +f.amt.value, maxUses: +f.max.value, minWager: +f.wag.value, hours: +f.hrs.value }), "Código " + f.code.value.trim().toUpperCase() + " criado");
    });
    Promise.resolve(db.adminCodes()).then(function (list) {
      var box = $("#code-list"); if (!box) return;
      box.innerHTML = list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th class="right">Valor</th><th class="right">Usos</th><th class="right">Apostado mín.</th><th>Expira</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (c) {
          var expired = c.expires_at && new Date(c.expires_at) < new Date(), full = c.max_uses && c.uses >= c.max_uses;
          return '<tr><td><span class="badge">' + esc(c.code) + '</span> <button class="btn btn-ghost btn-sm" data-copy="' + esc(c.code) + '">' + ic("copy", 13) + '</button></td><td class="right num strong">' + fmt.usd(+c.amount) + '</td><td class="right">' + c.uses + (c.max_uses ? " / " + c.max_uses : "") + '</td><td class="right num">' + fmt.usd(+c.min_wager, { dec: 0 }) + '</td><td class="faint">' + (c.expires_at ? fmt.date(c.expires_at) : "Nunca") + "</td><td>" +
            (!c.active ? '<span class="badge">Desligado</span>' : expired ? '<span class="badge">Expirado</span>' : full ? '<span class="badge">Esgotado</span>' : '<span class="badge badge-success">Ativo</span>') + '</td><td class="right"><button class="btn btn-secondary btn-sm" data-act="code-toggle" data-id="' + esc(c.code) + '" data-on="' + (c.active ? 0 : 1) + '">' + (c.active ? "Desligar" : "Ligar") + "</button></td></tr>";
        }).join("") + "</tbody></table></div>" : empty("Nenhum código ainda", "Crie o primeiro acima.");
      hydrate(box); $$("[data-copy]", box).forEach(function (b) { b.addEventListener("click", function () { RD.copy(b.getAttribute("data-copy")); }); });
    });
  };

  P.settings = function () {
    var L = RD.config.license;
    return head("Configurações", "O que você muda aqui aparece no site na hora") +
      '<div class="adm-grid-2"><div class="card card-pad"><h3 style="margin-bottom:14px">Licença (rodapé do site)</h3>' +
        '<div class="notice" style="margin-bottom:14px">' + ic("alert", 16) + "<span>Preencha só com uma licença que existe de verdade. Sem número, o rodapé não mostra licença.</span></div>" +
        '<form id="lic-form"><div class="field"><label>Status</label><select class="select" name="status"><option value="pending"' + (L.status !== "active" ? " selected" : "") + '>Pendente</option><option value="active"' + (L.status === "active" ? " selected" : "") + ">Ativa</option></select></div>" +
        '<div class="field"><label>Autoridade</label><input class="input" name="authority" value="' + esc(L.authority) + '" placeholder="Ex.: Anjouan Gaming"></div>' +
        '<div class="field"><label>Número da licença</label><input class="input" name="number" value="' + esc(L.number) + '"></div>' +
        '<div class="field"><label>Empresa</label><input class="input" name="company" value="' + esc(L.company) + '"></div>' +
        '<div class="field"><label>Endereço</label><input class="input" name="address" value="' + esc(L.address) + '"></div>' +
        '<button class="btn btn-primary">Salvar licença</button></form></div>' +
      '<div class="card card-pad"><h3 style="margin-bottom:14px">Países bloqueados</h3><p class="faint" style="font-size:13px;margin-bottom:10px">Cadastro bloqueado e aviso no rodapé. Clique num país para remover.</p>' +
        '<div class="tag-input">' + RD.config.restrictedCountries.map(function (c) { return '<span class="badge badge-danger" data-rm="' + esc(c) + '">' + esc(c) + " ✕</span>"; }).join("") + '<input id="geo-add" placeholder="Adicionar país + Enter"></div>' +
        '<div class="divider"></div><h3 style="margin-bottom:14px">Leaderboard</h3><form id="lb-form" class="row" style="align-items:flex-end"><div class="field grow" style="margin:0"><label>Prêmio total do mês (USD)</label><input class="input" type="number" name="prize" value="' + RD.config.leaderboardPrize + '"></div><button class="btn btn-primary">Salvar</button></form>' +
        '<div class="divider"></div><h3 style="margin-bottom:6px">Limite de ganho por aposta</h3><p class="faint" style="font-size:13px;margin-bottom:12px">Lucro máximo que um jogador pode ganhar numa única aposta dos originais. 0 = sem limite. Recomendado: no máximo 5% do caixa da casa.</p><form id="mp-form" class="row" style="align-items:flex-end"><div class="field grow" style="margin:0"><label>Lucro máximo (USD)</label><input class="input" type="number" min="0" step="1" name="max" value="' + (RD.config.maxProfit || 0) + '"></div><button class="btn btn-primary">Salvar</button></form></div></div>' +
      '<div class="card card-pad mt"><h3 style="margin-bottom:6px">Pagamentos automáticos (NOWPayments)</h3><p class="faint" style="font-size:13px;margin-bottom:14px">Antes de ligar: crie a conta na NOWPayments e coloque as chaves nos segredos do Supabase (Edge Functions → Secrets): NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET e, para saques, NOWPAYMENTS_EMAIL e NOWPAYMENTS_PASSWORD.</p>' +
        '<label class="check" style="margin-bottom:10px"><input type="checkbox" id="np-en"' + (RD.config.npEnabled ? " checked" : "") + '> <span><b>Depósito automático</b> — o jogador recebe um endereço e o valor exato; o saldo entra sozinho quando a rede confirma.</span></label>' +
        '<label class="check"><input type="checkbox" id="np-po"' + (RD.config.npPayouts ? " checked" : "") + '> <span><b>Saque pela NOWPayments</b> — botão nos saques pendentes; você confirma cada envio com o código 2FA.</span></label></div>' +
      '<div class="adm-grid-2 mt"><div class="card card-pad"><h3 style="margin-bottom:14px">Sua senha de admin</h3><form id="pw-form"><div class="field"><label>Nova senha</label><input class="input" type="password" name="pass" minlength="8" required></div><button class="btn btn-primary">Trocar senha</button></form></div>' +
      '<div class="card card-pad"><h3 style="margin-bottom:8px">Zerar o sistema</h3><p class="faint" style="font-size:13px;margin-bottom:14px">Apaga todos os jogadores, saldos, apostas, transações e o seu acesso de admin. Use antes de mostrar para alguém ou para recomeçar os testes.</p><button class="btn btn-danger" data-act="reset">' + ic("trash", 16) + "Apagar tudo e recomeçar</button></div></div>";
  };
  P.settings.after = function () {
    $("#np-en").addEventListener("change", function () { var on = this.checked; if (on && !confirm("Ligar o depósito automático? Confira antes se as chaves da NOWPayments estão nos segredos do Supabase.")) { this.checked = false; return; } Promise.resolve(db.setSettings({ npEnabled: on })).then(function () { RD.toast(on ? "Depósito automático ligado" : "Depósito automático desligado"); }); });
    $("#np-po").addEventListener("change", function () { var on = this.checked; Promise.resolve(db.setSettings({ npPayouts: on })).then(function () { RD.toast(on ? "Saque pela NOWPayments ligado" : "Saque pela NOWPayments desligado"); }); });
    $("#lic-form").addEventListener("submit", function (e) { e.preventDefault(); var f = e.target; db.setSettings({ license: { status: f.status.value, authority: f.authority.value, number: f.number.value, company: f.company.value, address: f.address.value } }); RD.toast("Licença salva"); });
    $("#mp-form").addEventListener("submit", function (e) { e.preventDefault(); db.setSettings({ maxProfit: Math.max(0, Math.floor(+e.target.max.value || 0)) }); RD.toast(RD.config.maxProfit ? "Limite salvo" : "Sem limite de ganho"); });
    $("#lb-form").addEventListener("submit", function (e) { e.preventDefault(); db.setSettings({ leaderboardPrize: Math.max(0, +e.target.prize.value || 0) }); RD.toast("Prêmio salvo"); });
    $("#pw-form").addEventListener("submit", function (e) { e.preventDefault(); var f = e.target; Promise.resolve(db.adminSetup(db.data().admin ? db.data().admin.email : "", f.pass.value)).then(function () { RD.toast("Senha trocada"); f.reset(); }, function () {}); });
    $("#geo-add").addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || !this.value.trim()) return; e.preventDefault();
      db.setSettings({ restricted: RD.config.restrictedCountries.concat([this.value.trim()]) }); route();
    });
  };

  P.audit = function () {
    var a = db.audit();
    return head("Log de auditoria", "Tudo que acontece no sistema: cadastros, depósitos, saques e ações do admin") +
      '<div class="card">' + (a.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Quem</th><th>O quê</th></tr></thead><tbody>' + a.map(function (x) { return '<tr><td class="faint">' + fmt.date(x.at) + '</td><td class="strong">' + esc(x.who) + "</td><td>" + esc(x.what) + "</td></tr>"; }).join("") + "</tbody></table></div>" : empty("Nada registrado ainda", "")) + "</div>";
  };

  /* ---------- Router ---------- */
  var TITLES = { dashboard: "Dashboard", players: "Jogadores", transactions: "Transações", bets: "Apostas", kyc: "KYC & Risco", games: "Jogos", promotions: "Promoções", media: "Banners & Imagens", affiliates: "Afiliados", invites: "Convites", rain: "Chuva (Rain)", vip: "VIP & Recompensas", settings: "Configurações", audit: "Auditoria" };
  var current = "dashboard";
  function route() {
    var parts = (location.hash || "#/dashboard").replace(/^#\/?/, "").split("/");
    var name = P[parts[0]] ? parts[0] : "dashboard"; current = name;
    $("#adm-view").innerHTML = P[name](parts[1]);
    if (P[name].after) P[name].after(parts[1]);
    $("#adm-title").textContent = TITLES[name];
    renderNav(name); closeAll(); hydrate($("#adm-view"));
  }

  /* ---------- Eventos ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act],[data-player],[data-close],[data-close-drawer],[data-rm],[data-period],#adm-burger,#adm-backdrop,#adm-logout");
    if (!t) { if (e.target.id === "adm-modal") closeAll(); return; }
    if (t.id === "adm-burger") return document.body.classList.toggle("adm-open");
    if (t.id === "adm-backdrop" || t.hasAttribute("data-close") || t.hasAttribute("data-close-drawer")) return closeAll();
    if (t.id === "adm-logout") { try { sessionStorage.removeItem(SESSION); } catch (x) {} Promise.resolve(RD.live && db.adminLogout()).then(function () { location.reload(); }); return; }
    if (t.hasAttribute("data-period")) { period = +t.getAttribute("data-period"); return route(); }
    if (t.hasAttribute("data-player")) { e.preventDefault(); return playerDrawer(t.getAttribute("data-player")); }
    if (t.hasAttribute("data-rm")) { var c = t.getAttribute("data-rm"); db.setSettings({ restricted: RD.config.restrictedCountries.filter(function (x) { return x !== c; }) }); return route(); }

    var a = t.getAttribute("data-act"), id = t.getAttribute("data-id");
    if (a === "approve") {
      var ta = db.transactions().filter(function (x) { return x.id === id; })[0] || {}, rk = ta.type === "Withdrawal" && risk.map[ta.userId];
      if (rk && !confirm("Atenção: este jogador tem " + rk.flags.length + " alerta(s) antifraude:\n\n" + rk.flags.map(function (f) { return "• " + (RISK_PT[f.rule] || f.title) + " — " + f.detail; }).join("\n") + "\n\nContinuar mesmo assim?")) return;
      if (RD.live && !confirm(ta.type === "Deposit" ? "Confirmou na Kraken que " + fmt.usd(ta.amount) + " em " + (ta.coin || "") + " chegou (TxID " + (ta.txHash || "") + ")? O saldo será creditado." : "Já enviou " + fmt.usd(ta.amount) + " em " + (ta.coin || "") + " para " + (ta.address || "") + "? Marcar como pago.")) return;
      return after(db.decideWithdrawal(id, true), ta.type === "Deposit" ? "Depósito aprovado e creditado" : "Saque aprovado");
    }
    if (a === "risk-ok") { var rkey = t.getAttribute("data-key"); t.disabled = true; return Promise.resolve(db.adminRiskReview(id, rkey)).then(function (r) { if (r && r.error) return RD.toast(r.error, "error"); RD.toast("Alerta marcado como revisado"); loadRisk(); }); }
    if (a === "np-send") {
      var tn = db.transactions().filter(function (x) { return x.id === id; })[0] || {};
      openModal('<div class="modal-head"><h3>Enviar saque ' + id + ' pela NOWPayments</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="np-form"><div class="modal-body"><p class="muted" style="margin-bottom:12px">' + fmt.usd(tn.amount) + " em " + esc(tn.coin || "") + " (" + esc(tn.net || "") + ') para <span class="mono">' + esc(tn.address || "") + '</span>. O valor em cripto é calculado na cotação da NOWPayments na hora do envio.</p><div class="field"><label>Código 2FA da NOWPayments (6 dígitos)</label><input class="input" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Enviar</button></div></form>');
      $("#np-form").addEventListener("submit", function (ev) { ev.preventDefault(); var b = ev.target.querySelector(".btn-primary"); b.disabled = true; b.textContent = "Enviando…"; Promise.resolve(db.npPayout(id, ev.target.code.value.trim())).then(function (r) { if (r && r.error) { b.disabled = false; b.textContent = "Enviar"; return RD.toast(r.error, "error"); } closeAll(); RD.toast("Saque enviado para a NOWPayments (" + r.amount + " " + String(r.currency || "").toUpperCase() + "). Fica concluído quando a rede confirmar."); refreshAfter(); }); });
      return;
    }
    if (a === "reject") {
      var tx = db.transactions().filter(function (x) { return x.id === id; })[0];
      openModal('<div class="modal-head"><h3>Rejeitar ' + ((tx && tx.type === "Deposit") ? "depósito " : "saque ") + id + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="rej-form"><div class="modal-body"><p class="muted" style="margin-bottom:14px">' + fmt.usd(tx.amount) + " de <strong>" + esc(tx.user) + '</strong>: <b>devolver</b> volta para o saldo dele; <b>reter</b> trava o valor (ele vê como retido e não usa) até você liberar ou confiscar na ficha do jogador.</p><div class="field"><label>Motivo (fica na auditoria)</label><input class="input" name="why" required placeholder="Ex.: endereço suspeito"></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button>' + (tx && tx.type === "Withdrawal" ? '<button type="button" class="btn btn-secondary" id="rej-hold">Rejeitar e reter</button>' : "") + '<button class="btn btn-danger">' + (tx && tx.type === "Withdrawal" ? "Rejeitar e devolver" : "Rejeitar") + '</button></div></form>');
      if ($("#rej-hold")) $("#rej-hold").addEventListener("click", function () { var f = $("#rej-form"); if (!f.why.value.trim()) { f.why.focus(); return RD.toast("Escreva o motivo.", "error"); } closeAll(); after(db.decideWithdrawal(id, false, f.why.value, true), "Saque rejeitado e valor retido", null, "error"); });
      $("#rej-form").addEventListener("submit", function (ev) { ev.preventDefault(); closeAll(); after(db.decideWithdrawal(id, false, ev.target.why.value), tx && tx.type === "Deposit" ? "Depósito rejeitado" : "Saque rejeitado e valor devolvido", null, "error"); });
      return;
    }
    if (a === "kyc-ok") { if (!confirm("Aprovar a verificação deste jogador?")) return; return after(db.setKyc(id, "Verified"), "KYC aprovado", id); }
    if (a === "kyc-no") {
      openModal('<div class="modal-head"><h3>Rejeitar KYC</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="kyc-rej"><div class="modal-body"><div class="field"><label>Motivo (o jogador vê esta mensagem, em inglês)</label><select class="select" name="why"><option>Document is blurry or cropped</option><option>Document is expired</option><option>Name does not match your account</option><option>Proof of address is older than 3 months</option></select></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger">Rejeitar</button></div></form>');
      $("#kyc-rej").addEventListener("submit", function (ev) { ev.preventDefault(); closeAll(); after(db.setKyc(id, "Rejected", ev.target.why.value), "KYC rejeitado", null, "error"); });
      return;
    }
    if (a === "resetbets") { if (!confirm("Zerar o histórico de apostas e as estatísticas deste jogador? O saldo não muda.")) return; db.resetBets(id); RD.toast("Apostas zeradas"); return refreshAfter(id); }
    if (a === "suspend" || a === "unsuspend") return after(db.setStatus(id, a === "suspend" ? "Suspended" : "Active"), "Status atualizado", id);
    if (a === "adjust" || a === "bonus") {
      var pl = db.player(id), isBonus = a === "bonus";
      openModal('<div class="modal-head"><h3>' + (isBonus ? "Dar bônus" : "Ajustar saldo") + " · " + esc(pl.username) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="adj-form"><div class="modal-body"><p class="muted" style="margin-bottom:14px">Saldo atual: <strong>' + fmt.usd(pl.balance) + "</strong></p>" +
        (isBonus ? '<input type="hidden" name="type" value="1">' : '<div class="field"><label>Tipo</label><select class="select" name="type"><option value="1">Adicionar saldo</option><option value="-1">Remover saldo</option></select></div>') +
        '<div class="field"><label>Valor (USD)</label><input class="input" name="amt" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Motivo (o jogador vê no extrato, em inglês)</label><input class="input" name="why" required minlength="3" placeholder="' + (isBonus ? "Ex.: VIP reload bonus" : "Ex.: Compensation") + '"></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Confirmar</button></div></form>');
      $("#adj-form").addEventListener("submit", function (ev) { ev.preventDefault(); var f = ev.target; closeAll(); after(db.adjustBalance(pl.id, +f.amt.value * +f.type.value, f.why.value, isBonus ? "Bonus" : "Adjustment"), isBonus ? "Bônus enviado" : "Saldo ajustado", pl.id); });
      return;
    }
    if (a === "hold" || a === "release" || a === "confiscate") {
      var hp = db.player(id), M = { hold: ["Reter saldo", "Tira do saldo disponível e trava. Use quando suspeitar de bug, fraude ou bônus abusado.", hp.balance, "Reter", "btn-primary"], release: ["Liberar retido", "Volta para o saldo do jogador.", hp.held, "Liberar", "btn-primary"], confiscate: ["Confiscar retido", "O valor some do retido e não volta. Fica registrado na auditoria com o motivo.", hp.held, "Confiscar", "btn-danger"] }[a];
      openModal('<div class="modal-head"><h3>' + M[0] + " · " + esc(hp.username) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="hold-form"><div class="modal-body"><p class="muted" style="margin-bottom:14px">' + M[1] + "</p>" +
        '<div class="field"><label>Valor (USD) — máximo ' + fmt.usd(M[2]) + '</label><div class="input-group"><input name="amt" type="number" min="0.01" step="0.01" max="' + M[2] + '" required><button type="button" class="btn btn-ghost btn-sm" id="hold-max">Tudo</button></div></div>' +
        '<div class="field"><label>Motivo (fica na auditoria' + (a === "confiscate" ? "" : "; o jogador vê no extrato, em inglês") + ')</label><input class="input" name="why" required minlength="3" placeholder="' + (a === "confiscate" ? "Ex.: lucro de bug no jogo X" : "Ex.: Under review") + '"></div></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn ' + M[4] + '">' + M[3] + "</button></div></form>");
      $("#hold-max").addEventListener("click", function () { $("#hold-form").amt.value = M[2]; });
      $("#hold-form").addEventListener("submit", function (ev) {
        ev.preventDefault(); var f = ev.target, v = +f.amt.value;
        if (a === "confiscate" && !confirm("Confiscar " + fmt.usd(v) + " de " + hp.username + "? Não dá para desfazer.")) return;
        closeAll(); after((a === "hold" ? db.holdBalance : a === "release" ? db.releaseHeld : db.confiscateHeld)(hp.id, v, f.why.value.trim()), a === "hold" ? "Saldo retido" : a === "release" ? "Retido liberado" : "Valor confiscado", hp.id);
      });
      return;
    }
    if (a === "code-toggle") return after(db.toggleCode(id, t.getAttribute("data-on") === "1"), "Código atualizado");
    if (a === "credit-dep") {
      var dp = db.player(id), ws = RD.live && db.wallets ? db.wallets() : [];
      var opts = ws.length ? ws.map(function (w, i) { return '<option value="' + i + '">' + esc(w.coin + " · " + w.network) + "</option>"; }).join("") : '<option value="">USDT</option>';
      openModal('<div class="modal-head"><h3>Creditar depósito · ' + esc(dp.username) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="cd-form"><div class="modal-body"><p class="muted" style="margin-bottom:14px">Use quando você confirmar na Kraken que o depósito deste jogador chegou. Entra como <b>depósito</b> (conta para estatísticas e afiliados), não como bônus.</p>' +
        '<div class="adm-grid-2"><div class="field"><label>Valor em USD</label><input class="input" name="amt" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Moeda / rede</label><select class="select" name="w">' + opts + '</select></div></div>' +
        '<div class="field"><label>TxID (opcional, ajuda a não creditar duas vezes)</label><input class="input" name="tx" placeholder="Hash da transação na blockchain"></div></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Creditar</button></div></form>');
      $("#cd-form").addEventListener("submit", function (ev) {
        ev.preventDefault(); var f = ev.target, w = ws[+f.w.value] || { coin: "USDT", network: "" }, v = +f.amt.value;
        if (!confirm("Creditar " + fmt.usd(v) + " (" + w.coin + ") no saldo de " + dp.username + "?")) return;
        closeAll(); after(db.creditDeposit(dp.id, v, w.coin, w.network, f.tx.value.trim()), "Depósito creditado", dp.id);
      });
      return;
    }
    if (a === "reload") {
      var rp = db.player(id), g = rp.reloadGrant && rp.reloadGrant.used < rp.reloadGrant.claims ? rp.reloadGrant : null;
      var minT = RD.vipTiers.filter(function (t) { return t.name === RD.config.bonuses.reload.minTier; })[0];
      if (minT && (rp.vipXp != null ? rp.vipXp : rp.wagered) < minT.wager && !g) { RD.toast("VIP Reload é a partir do " + minT.name + " (" + fmt.usd(minT.wager, { dec: 0 }) + " apostados). " + rp.username + " apostou " + fmt.usd(rp.wagered, { dec: 0 }) + ".", "error"); return; }
      openModal('<div class="modal-head"><h3>VIP Reload · ' + esc(rp.username) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="rl-form"><div class="modal-body">' +
        (g ? '<div class="notice info" style="margin-bottom:14px">' + ic("bolt", 16) + "<span>Ativo agora: " + fmt.usd(g.per) + " por resgate, " + g.used + "/" + g.claims + " resgatados. Dar um novo substitui este.</span></div>" : '<p class="muted" style="margin-bottom:14px">O card "VIP Reload" aparece nas recompensas do jogador só enquanto ele tiver resgates sobrando.</p>') +
        '<div class="adm-grid-2"><div class="field"><label>Valor por resgate (USD)</label><input class="input" name="per" type="number" min="0.01" step="0.01" required placeholder="Ex.: 10"></div>' +
        '<div class="field"><label>Quantidade de resgates</label><input class="input" name="claims" type="number" min="1" max="365" step="1" value="7" required></div></div>' +
        '<div class="adm-grid-2"><div class="field"><label>Intervalo entre resgates (horas)</label><input class="input" name="hours" type="number" min="1" max="720" step="1" value="24" required></div>' +
        '<div class="field"><label>Nota interna (opcional)</label><input class="input" name="note" placeholder="Ex.: reload de outubro"></div></div>' +
        '<p class="faint" id="rl-total" style="font-size:12.5px"></p></div><div class="modal-foot">' + (g ? '<button type="button" class="btn btn-danger" id="rl-cancel">Cancelar reload</button>' : "") + '<button type="button" class="btn btn-ghost" data-close>Fechar</button><button class="btn btn-primary">Dar VIP Reload</button></div></form>');
      var rf = $("#rl-form"), tot = function () { $("#rl-total").textContent = (+rf.per.value > 0) ? "Total: " + fmt.usd(+rf.per.value * +rf.claims.value) + " em " + rf.claims.value + " resgates, um a cada " + rf.hours.value + "h." : ""; };
      ["per", "claims", "hours"].forEach(function (k) { rf[k].addEventListener("input", tot); });
      rf.addEventListener("submit", function (ev) { ev.preventDefault(); closeAll(); after(db.grantReload(rp.id, +rf.per.value, +rf.claims.value, +rf.hours.value, rf.note.value), "VIP Reload ativado para " + rp.username, rp.id); });
      if ($("#rl-cancel")) $("#rl-cancel").addEventListener("click", function () { if (!confirm("Cancelar o VIP Reload de " + rp.username + "?")) return; closeAll(); after(db.cancelReload(rp.id), "VIP Reload cancelado", rp.id); });
      return;
    }
    if (a === "aff-share") {
      var ap = db.player(id);
      openModal('<div class="modal-head"><h3>Comissão de afiliado · ' + esc(ap.username) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="share-form"><div class="modal-body"><div class="field"><label>Revenue share (%)</label><input class="input" type="number" name="share" min="0" max="70" step="1" value="' + (ap.affShare == null ? "" : ap.affShare) + '" placeholder="Vazio = plano padrão (25% a 50%)"></div><p class="faint" style="font-size:12px">Deixe vazio para seguir o plano padrão por primeiros depósitos no mês.</p></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Salvar</button></div></form>');
      $("#share-form").addEventListener("submit", function (ev) { ev.preventDefault(); db.setAffShare(ap.id, ev.target.share.value); closeAll(); RD.toast("Comissão salva"); refreshAfter(); });
      return;
    }
    if (a === "new-promo") return promoForm();
    if (a === "edit-promo") return promoForm(RD.promotions.filter(function (p) { return p.id === id; })[0]);
    if (a === "reset") {
      if (!confirm("Apagar TODOS os dados (jogadores, saldos, apostas, transações e seu acesso de admin)?")) return;
      db.reset(); try { sessionStorage.removeItem(SESSION); } catch (x) {} location.reload();
    }
  });
  function refreshAfter(playerId) { var open = $("#adm-drawer").classList.contains("open"); route(); if (playerId && open) playerDrawer(playerId); }
  document.addEventListener("change", function (e) {
    var g = e.target.getAttribute("data-toggle-game");
    if (g) { db.setGame(g, { enabled: e.target.checked }); RD.toast("Jogo " + (e.target.checked ? "visível" : "escondido") + " no site"); }
    var tg = e.target.getAttribute("data-tag");
    if (tg) { db.setGame(tg, { tag: e.target.value }); RD.toast("Destaque atualizado"); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  /* Atualiza sozinho quando algo muda no site (outra aba) */
  db.onChange(function () {
    if ($("#adm").classList.contains("hidden")) return;
    if ($("#adm-modal").classList.contains("open")) return;
    var title = $("#adm-drawer").classList.contains("open") && $("#adm-drawer-title").textContent;
    route();
    if (title) { var p = db.findByName(title); if (p) playerDrawer(p.id); }
  });

  /* ---------- Login / primeiro acesso ---------- */
  hydrate(document);
  function setupMode() { return !RD.live && !db.adminExists(); }
  function renderLogin() {
    var s = setupMode();
    $("#adm-login-intro").innerHTML = s ? '<div class="notice info" style="margin-bottom:16px">' + ic("lock", 16) + "<span><strong>Primeiro acesso.</strong> Crie o e-mail e a senha que vão proteger este painel.</span></div>" : "";
    $("#adm-pass2").classList.toggle("hidden", !s);
    $("#adm-pass2 input").required = s;
    $("#adm-login-btn").textContent = s ? "Criar acesso e entrar" : "Entrar";
  }
  function enter() {
    $("#adm-login").classList.add("hidden"); $("#adm").classList.remove("hidden");
    $("#adm-email").textContent = RD.live ? ((db.live.user || {}).email || "Admin") : ((db.data().admin || {}).email || "Admin");
    window.addEventListener("hashchange", route); route();
    loadRisk(); setInterval(function () { if (!document.hidden) loadRisk(); }, 120000); // alertas antifraude a cada 2 min
  }
  $("#adm-login-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; $("#adm-login-error").innerHTML = "";
    if (RD.live) {
      var lb = $("#adm-login-btn"); lb.disabled = true;
      return db.adminLogin(f.email.value, f.pass.value).then(function (r) {
        lb.disabled = false;
        if (r.error) { $("#adm-login-error").innerHTML = errorBox(r.error === "This account is not an admin." ? "Esta conta não é de administrador." : r.error === "Wrong email or password." ? "E-mail ou senha incorretos." : r.error); return; }
        enter();
      });
    }
    if (setupMode()) {
      if (f.pass.value !== f.pass2.value) { $("#adm-login-error").innerHTML = errorBox("As senhas não são iguais."); return; }
      db.adminSetup(f.email.value, f.pass.value);
    } else if (!db.adminLogin(f.email.value, f.pass.value)) { $("#adm-login-error").innerHTML = errorBox("E-mail ou senha incorretos."); return; }
    try { sessionStorage.setItem(SESSION, "1"); } catch (x) {}
    enter();
  });
  var logged = false; try { logged = sessionStorage.getItem(SESSION) === "1"; } catch (x) {}
  if (RD.live) { var envb = $(".adm-env"); if (envb) { envb.textContent = "Modo real"; envb.className = "badge badge-success adm-env"; } }
  if (RD.live) {
    renderLogin();
    $("#adm-login-intro").innerHTML = '<div class="notice info" style="margin-bottom:16px">' + ic("lock", 16) + "<span><strong>Modo real.</strong> Entre com a sua conta de administrador do RDCasino.</span></div>";
    db.adminSession().then(function (ok) { if (ok) enter(); });
  } else if (logged && db.adminExists()) enter(); else renderLogin();
})();
