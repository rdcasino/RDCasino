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
  function pendingWd() { return db.transactions().filter(function (t) { return t.type === "Withdrawal" && t.status === "Pending"; }); }
  function pendingKyc() { return db.players().filter(function (p) { return p.kyc === "Pending"; }); }
  function NAV() {
    return [
      { group: "Visão geral" },
      { id: "dashboard", label: "Dashboard", icon: "chart" },
      { group: "Operação" },
      { id: "players", label: "Jogadores", icon: "users", count: db.players().length },
      { id: "transactions", label: "Transações", icon: "coins", badge: pendingWd().length },
      { id: "kyc", label: "KYC & Risco", icon: "id", badge: pendingKyc().length },
      { id: "bets", label: "Apostas", icon: "bars" },
      { group: "Produto" },
      { id: "games", label: "Jogos", icon: "grid" },
      { id: "promotions", label: "Promoções", icon: "gift" },
      { id: "media", label: "Banners & Imagens", icon: "image" },
      { group: "Crescimento" },
      { id: "affiliates", label: "Afiliados", icon: "link" },
      { id: "vip", label: "VIP & Recompensas", icon: "crown" },
      { group: "Sistema" },
      { id: "settings", label: "Configurações", icon: "settings" },
      { id: "audit", label: "Log de auditoria", icon: "file" }
    ];
  }
  function renderNav(active) {
    $("#adm-nav").innerHTML = NAV().map(function (n) {
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
        var act = actions ? (t.status === "Pending" && t.type === "Withdrawal" ? '<td class="right"><div class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-primary btn-sm" data-act="approve" data-id="' + t.id + '">Aprovar</button><button class="btn btn-danger btn-sm" data-act="reject" data-id="' + t.id + '">Rejeitar</button></div></td>' : "<td></td>") : "";
        return '<tr><td class="strong">' + t.id + '</td><td><a href="#" data-player="' + t.userId + '" class="link">' + esc(t.user) + "</a></td><td>" + txType(t) + (t.coin ? ' <small class="faint">' + t.coin + "</small>" : "") + (t.address ? '<br><small class="faint" title="' + esc(t.address) + '">' + esc(t.address.slice(0, 10)) + "…</small>" : "") + (t.note ? '<br><small class="faint">' + esc(t.note) + "</small>" : "") + '</td><td class="right num strong">' + fmt.usd(t.amount) + "</td><td>" + badge(t.status) + '</td><td class="faint">' + fmt.date(t.date) + "</td>" + act + "</tr>";
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
        list.map(function (p) { var t = db.tierOf(p.wagered); return '<tr class="clickable" data-player="' + p.id + '"><td><div class="row" style="gap:10px"><span class="avatar">' + initials(p.username) + '</span><div><span class="strong">' + esc(p.username) + '</span><br><small class="faint">' + esc(p.email) + "</small></div></div></td><td>" + esc(p.country) + "</td><td>" + (t ? t.name : "—") + '</td><td class="right num strong">' + fmt.usd(p.balance) + '</td><td class="right num">' + fmt.usd(p.deposits) + '</td><td class="right num">' + fmt.usd(p.withdrawals) + '</td><td class="right num">' + fmt.usd(p.wagered) + "</td><td>" + badge(p.kyc) + "</td><td>" + badge(p.status) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : empty(db.players().length ? "Nenhum jogador encontrado" : "Nenhum jogador ainda", db.players().length ? "" : "Quando alguém se cadastrar no site, aparece aqui.");
    }
    [q, k, s].forEach(function (el) { el.addEventListener("input", draw); }); draw();
  };
  function playerDrawer(id) {
    var p = db.player(id); if (!p) return;
    var t = db.tierOf(p.wagered), house = -p.profit, ref = p.referrerId ? db.player(p.referrerId) : null;
    openDrawer(p.username,
      '<div class="row" style="gap:12px;margin-bottom:16px"><span class="avatar" style="width:44px;height:44px;font-size:15px">' + initials(p.username) + '</span><div><strong>' + esc(p.username) + '</strong><br><small class="faint">' + esc(p.email) + " · " + p.id + "</small></div></div>" +
      '<div class="row wrap" style="gap:6px;margin-bottom:16px">' + badge(p.status) + badge(p.kyc) + '<span class="badge">' + (t ? t.name : "Sem nível") + "</span></div>" +
      '<div class="detail-grid"><div><small>Saldo</small><strong class="num">' + fmt.usd(p.balance) + '</strong></div><div><small>Resultado da casa</small><strong class="num ' + (house >= 0 ? "pos" : "neg") + '">' + fmt.usd(house) + '</strong></div><div><small>Depósitos</small><strong class="num">' + fmt.usd(p.deposits) + '</strong></div><div><small>Saques</small><strong class="num">' + fmt.usd(p.withdrawals) + '</strong></div><div><small>Apostado</small><strong class="num">' + fmt.usd(p.wagered) + " (" + p.bets + ' apostas)</strong></div><div><small>Bônus recebidos</small><strong class="num">' + fmt.usd(p.bonusTotal) + '</strong></div><div><small>País</small><strong>' + esc(p.country) + '</strong></div><div><small>Cadastro</small><strong>' + fmt.date(p.created) + '</strong></div><div><small>Indicado por</small><strong>' + (ref ? esc(ref.username) + " (" + esc(p.referredBy) + ")" : "—") + '</strong></div><div><small>Código de afiliado</small><strong>' + p.refCode + "</strong></div></div>" +
      (p.kycInfo ? '<h3 style="margin:20px 0 10px">Documentos enviados</h3><div class="detail-grid"><div><small>Nome</small><strong>' + esc(p.kycInfo.name) + '</strong></div><div><small>Nascimento</small><strong>' + esc(p.kycInfo.dob) + '</strong></div><div><small>Documento</small><strong>' + esc(p.kycInfo.doc) + '</strong></div><div><small>Enviado</small><strong>' + esc(p.kycInfo.sent) + "</strong></div></div>" + (p.kyc === "Pending" ? '<div class="row" style="gap:8px;margin-top:10px"><button class="btn btn-primary btn-sm" data-act="kyc-ok" data-id="' + p.id + '">Aprovar KYC</button><button class="btn btn-danger btn-sm" data-act="kyc-no" data-id="' + p.id + '">Rejeitar</button></div>' : "") : "") +
      '<h3 style="margin:20px 0 10px">Ações</h3><div class="row wrap" style="gap:8px">' +
        '<button class="btn btn-secondary btn-sm" data-act="adjust" data-id="' + p.id + '">' + ic("sliders", 14) + "Ajustar saldo</button>" +
        '<button class="btn btn-secondary btn-sm" data-act="bonus" data-id="' + p.id + '">' + ic("gift", 14) + "Dar bônus</button>" +
        '<button class="btn btn-secondary btn-sm" data-act="aff-share" data-id="' + p.id + '">' + ic("link", 14) + "Comissão afiliado</button>" +
        ('<button class="btn btn-secondary btn-sm" data-act="resetbets" data-id="' + p.id + '">Zerar apostas</button>') + (p.status === "Suspended" ? '<button class="btn btn-primary btn-sm" data-act="unsuspend" data-id="' + p.id + '">Reativar</button>' : '<button class="btn btn-danger btn-sm" data-act="suspend" data-id="' + p.id + '">' + ic("ban", 14) + "Suspender</button>") + "</div>" +
      '<div class="field" style="margin-top:20px"><label>Nota interna (só a equipe vê)</label><textarea class="textarea" id="pl-note" data-id="' + p.id + '">' + esc(p.note) + "</textarea></div>" +
      '<h3 style="margin:20px 0 10px">Transações</h3><div class="card">' + txTable(db.txOf(p.id).slice(0, 20), true) + "</div>" +
      '<h3 style="margin:20px 0 10px">Últimas apostas</h3><div class="card">' + betsTable(db.betsOf(p.id).slice(0, 20)) + "</div>");
    $("#pl-note").addEventListener("change", function () { db.setNote(p.id, this.value); RD.toast("Nota salva"); });
  }

  P.transactions = function (filter) {
    filter = filter || "all";
    var list = db.transactions().filter(function (t) { return filter === "all" || (filter === "pending" && t.status === "Pending" && t.type === "Withdrawal") || (filter === "deposits" && t.type === "Deposit") || (filter === "withdrawals" && t.type === "Withdrawal") || (filter === "bonus" && ["Bonus", "Adjustment", "Rakeback", "Level reward", "Commission"].indexOf(t.type) > -1); });
    var tabs = [["all", "Todas"], ["pending", "Saques pendentes (" + pendingWd().length + ")"], ["deposits", "Depósitos"], ["withdrawals", "Saques"], ["bonus", "Bônus e ajustes"]];
    return head("Transações", "Saques só saem depois da sua aprovação. Rejeitar devolve o valor ao saldo do jogador.") +
      '<div class="tabs" style="margin-bottom:16px">' + tabs.map(function (t) { return '<a class="tab' + (t[0] === filter ? " active" : "") + '" href="#/transactions/' + t[0] + '">' + t[1] + "</a>"; }).join("") + "</div>" +
      '<div class="card">' + txTable(list, true) + "</div>";
  };

  P.bets = function () { return head("Apostas", "Todas as apostas dos jogos próprios, em tempo real") + '<div class="card">' + betsTable(db.allBets().slice(0, 200)) + "</div>"; };

  P.kyc = function () {
    var pend = pendingKyc(), all = db.players();
    var big = all.filter(function (p) { return p.deposits >= 1000 && p.kyc !== "Verified"; });
    return head("KYC & Risco", "Verificação de identidade dos jogadores") +
      '<div class="kpi-grid">' + kpi("Pendentes", pend.length) + kpi("Verificados", all.filter(function (p) { return p.kyc === "Verified"; }).length) + kpi("Rejeitados", all.filter(function (p) { return p.kyc === "Rejected"; }).length) + kpi("Sem KYC com +$1.000 depositados", big.length) + "</div>" +
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
      '<div class="notice info" style="margin-bottom:20px">' + ic("upload", 16) + "<span>Para trocar uma imagem: salve o arquivo com o nome exato em <code>assets/img/…</code> e publique no GitHub. Com servidor, este painel terá upload direto.</span></div>" +
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
    var rows = RD.vipTiers.map(function (t, i) {
      var nxt = RD.vipTiers[i + 1], at = ps.filter(function (p) { return p.wagered >= t.wager && (!nxt || p.wagered < nxt.wager); }).length;
      var reached = ps.filter(function (p) { return p.wagered >= t.wager; }), claimed = reached.filter(function (p) { return p.claimedTiers.indexOf(t.name) > -1; }).length;
      return { t: t, at: at, claimed: claimed, open: reached.length - claimed };
    });
    var owed = rows.reduce(function (a, r) { return a + r.open * r.t.reward; }, 0), rakeOpen = ps.reduce(function (a, p) { return a + p.rakeback; }, 0);
    return head("VIP & Recompensas", "Níveis por valor apostado. O prêmio de cada nível é pago uma vez, quando o jogador resgata na página VIP.") +
      '<div class="kpi-grid">' + kpi("Prêmios de nível pagos", fmt.usd(paid("Level reward"))) + kpi("Prêmios liberados, não resgatados", fmt.usd(owed), "o jogador ainda pode resgatar") + kpi("Rakeback pago", fmt.usd(paid("Rakeback"))) + kpi("Rakeback acumulado", fmt.usd(rakeOpen), "ainda não resgatado") + "</div>" +
      '<div class="card mt"><div class="table-wrap"><table class="table"><thead><tr><th>Nível</th><th class="right">Apostado para chegar</th><th class="right">Prêmio</th><th class="right">Jogadores neste nível</th><th class="right">Resgataram</th><th class="right">Falta resgatar</th><th class="right">Prêmio ÷ apostado</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td><span class="row" style="gap:10px">' + RD.art.tierBadge(r.t, 26) + '<b>' + r.t.name + '</b></span></td><td class="right num">' + fmt.usd(r.t.wager, { dec: 0 }) + '</td><td class="right num strong">' + fmt.usd(r.t.reward, { dec: 0 }) + '</td><td class="right">' + r.at + '</td><td class="right">' + r.claimed + '</td><td class="right">' + (r.open ? '<span class="badge badge-warn">' + r.open + "</span>" : "0") + '</td><td class="right num faint">' + (((r.t.reward / r.t.wager) * 100).toFixed(2)) + "% do apostado</td></tr>"; }).join("") +
      '</tbody></table></div></div><p class="faint" style="font-size:12.5px;margin-top:10px">Os prêmios de nível custam 0,4% do valor apostado. Com 1% de vantagem da casa e 5% de rakeback, o custo total do VIP fica em torno de 45% da vantagem da casa nos originais. Os valores ficam em <code>assets/js/data.js</code> (RD.vipTiers).</p>';
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
      '<div class="adm-grid-2 mt"><div class="card card-pad"><h3 style="margin-bottom:14px">Sua senha de admin</h3><form id="pw-form"><div class="field"><label>Nova senha</label><input class="input" type="password" name="pass" minlength="8" required></div><button class="btn btn-primary">Trocar senha</button></form></div>' +
      '<div class="card card-pad"><h3 style="margin-bottom:8px">Zerar o sistema</h3><p class="faint" style="font-size:13px;margin-bottom:14px">Apaga todos os jogadores, saldos, apostas, transações e o seu acesso de admin. Use antes de mostrar para alguém ou para recomeçar os testes.</p><button class="btn btn-danger" data-act="reset">' + ic("trash", 16) + "Apagar tudo e recomeçar</button></div></div>";
  };
  P.settings.after = function () {
    $("#lic-form").addEventListener("submit", function (e) { e.preventDefault(); var f = e.target; db.setSettings({ license: { status: f.status.value, authority: f.authority.value, number: f.number.value, company: f.company.value, address: f.address.value } }); RD.toast("Licença salva"); });
    $("#mp-form").addEventListener("submit", function (e) { e.preventDefault(); db.setSettings({ maxProfit: Math.max(0, Math.floor(+e.target.max.value || 0)) }); RD.toast(RD.config.maxProfit ? "Limite salvo" : "Sem limite de ganho"); });
    $("#lb-form").addEventListener("submit", function (e) { e.preventDefault(); db.setSettings({ leaderboardPrize: Math.max(0, +e.target.prize.value || 0) }); RD.toast("Prêmio salvo"); });
    $("#pw-form").addEventListener("submit", function (e) { e.preventDefault(); db.adminSetup(db.data().admin.email, e.target.pass.value); RD.toast("Senha trocada"); e.target.reset(); });
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
  var TITLES = { dashboard: "Dashboard", players: "Jogadores", transactions: "Transações", bets: "Apostas", kyc: "KYC & Risco", games: "Jogos", promotions: "Promoções", media: "Banners & Imagens", affiliates: "Afiliados", vip: "VIP & Recompensas", settings: "Configurações", audit: "Auditoria" };
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
    if (t.id === "adm-logout") { try { sessionStorage.removeItem(SESSION); } catch (x) {} location.reload(); return; }
    if (t.hasAttribute("data-period")) { period = +t.getAttribute("data-period"); return route(); }
    if (t.hasAttribute("data-player")) { e.preventDefault(); return playerDrawer(t.getAttribute("data-player")); }
    if (t.hasAttribute("data-rm")) { var c = t.getAttribute("data-rm"); db.setSettings({ restricted: RD.config.restrictedCountries.filter(function (x) { return x !== c; }) }); return route(); }

    var a = t.getAttribute("data-act"), id = t.getAttribute("data-id");
    if (a === "approve") { db.decideWithdrawal(id, true); RD.toast("Saque aprovado"); return refreshAfter(); }
    if (a === "reject") {
      var tx = db.transactions().filter(function (x) { return x.id === id; })[0];
      openModal('<div class="modal-head"><h3>Rejeitar saque ' + id + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="rej-form"><div class="modal-body"><p class="muted" style="margin-bottom:14px">' + fmt.usd(tx.amount) + " volta para o saldo de <strong>" + esc(tx.user) + '</strong>.</p><div class="field"><label>Motivo (fica na auditoria)</label><input class="input" name="why" required placeholder="Ex.: endereço suspeito"></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger">Rejeitar e devolver</button></div></form>');
      $("#rej-form").addEventListener("submit", function (ev) { ev.preventDefault(); db.decideWithdrawal(id, false, ev.target.why.value); closeAll(); RD.toast("Saque rejeitado e valor devolvido", "error"); refreshAfter(); });
      return;
    }
    if (a === "kyc-ok") { db.setKyc(id, "Verified"); RD.toast("KYC aprovado"); return refreshAfter(id); }
    if (a === "kyc-no") {
      openModal('<div class="modal-head"><h3>Rejeitar KYC</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="kyc-rej"><div class="modal-body"><div class="field"><label>Motivo (o jogador vê esta mensagem, em inglês)</label><select class="select" name="why"><option>Document is blurry or cropped</option><option>Document is expired</option><option>Name does not match your account</option><option>Proof of address is older than 3 months</option></select></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger">Rejeitar</button></div></form>');
      $("#kyc-rej").addEventListener("submit", function (ev) { ev.preventDefault(); db.setKyc(id, "Rejected", ev.target.why.value); closeAll(); RD.toast("KYC rejeitado", "error"); refreshAfter(); });
      return;
    }
    if (a === "resetbets") { if (!confirm("Zerar o histórico de apostas e as estatísticas deste jogador? O saldo não muda.")) return; db.resetBets(id); RD.toast("Apostas zeradas"); return refreshAfter(id); }
    if (a === "suspend" || a === "unsuspend") { db.setStatus(id, a === "suspend" ? "Suspended" : "Active"); RD.toast("Status atualizado"); return refreshAfter(id); }
    if (a === "adjust" || a === "bonus") {
      var pl = db.player(id), isBonus = a === "bonus";
      openModal('<div class="modal-head"><h3>' + (isBonus ? "Dar bônus" : "Ajustar saldo") + " · " + esc(pl.username) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="adj-form"><div class="modal-body"><p class="muted" style="margin-bottom:14px">Saldo atual: <strong>' + fmt.usd(pl.balance) + "</strong></p>" +
        (isBonus ? '<input type="hidden" name="type" value="1">' : '<div class="field"><label>Tipo</label><select class="select" name="type"><option value="1">Adicionar saldo</option><option value="-1">Remover saldo</option></select></div>') +
        '<div class="field"><label>Valor (USD)</label><input class="input" name="amt" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Motivo (o jogador vê no extrato, em inglês)</label><input class="input" name="why" required minlength="3" placeholder="' + (isBonus ? "Ex.: VIP reload bonus" : "Ex.: Compensation") + '"></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Confirmar</button></div></form>');
      $("#adj-form").addEventListener("submit", function (ev) { ev.preventDefault(); var f = ev.target; db.adjustBalance(pl.id, +f.amt.value * +f.type.value, f.why.value, isBonus ? "Bonus" : "Adjustment"); closeAll(); RD.toast(isBonus ? "Bônus enviado" : "Saldo ajustado"); refreshAfter(pl.id); });
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
  function setupMode() { return !db.adminExists(); }
  function renderLogin() {
    var s = setupMode();
    $("#adm-login-intro").innerHTML = s ? '<div class="notice info" style="margin-bottom:16px">' + ic("lock", 16) + "<span><strong>Primeiro acesso.</strong> Crie o e-mail e a senha que vão proteger este painel.</span></div>" : "";
    $("#adm-pass2").classList.toggle("hidden", !s);
    $("#adm-pass2 input").required = s;
    $("#adm-login-btn").textContent = s ? "Criar acesso e entrar" : "Entrar";
  }
  function enter() {
    $("#adm-login").classList.add("hidden"); $("#adm").classList.remove("hidden");
    $("#adm-email").textContent = (db.data().admin || {}).email || "Admin";
    window.addEventListener("hashchange", route); route();
  }
  $("#adm-login-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; $("#adm-login-error").innerHTML = "";
    if (setupMode()) {
      if (f.pass.value !== f.pass2.value) { $("#adm-login-error").innerHTML = errorBox("As senhas não são iguais."); return; }
      db.adminSetup(f.email.value, f.pass.value);
    } else if (!db.adminLogin(f.email.value, f.pass.value)) { $("#adm-login-error").innerHTML = errorBox("E-mail ou senha incorretos."); return; }
    try { sessionStorage.setItem(SESSION, "1"); } catch (x) {}
    enter();
  });
  var logged = false; try { logged = sessionStorage.getItem(SESSION) === "1"; } catch (x) {}
  if (logged && db.adminExists()) enter(); else renderLogin();
})();
