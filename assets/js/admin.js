/* ==========================================================================
   RDCasino — Admin (back-office). Front-end apenas: cada ação aqui
   precisa virar um endpoint autenticado e auditado no backend.
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ic = RD.ic, fmt = RD.fmt, esc = RD.esc, media = RD.media, D = RD.admin;

  var store = {
    get: function (k, d) { try { var v = sessionStorage.getItem("rda_" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { sessionStorage.setItem("rda_" + k, JSON.stringify(v)); } catch (e) {} }
  };

  function hydrate(root) { $$("[data-ic]", root).forEach(function (el) { el.outerHTML = ic(el.getAttribute("data-ic")); }); }

  /* ---------- Navegação ---------- */
  function pendingWithdrawals() { return D.transactions.filter(function (t) { return t.type === "Withdrawal" && t.status === "Pending"; }); }
  function pendingKyc() { return D.players.filter(function (p) { return p.kyc === "Pending"; }); }
  function NAV() {
    return [
      { group: "Visão geral" },
      { id: "dashboard", label: "Dashboard", icon: "chart" },
      { group: "Operação" },
      { id: "players", label: "Jogadores", icon: "users" },
      { id: "transactions", label: "Transações", icon: "coins", badge: pendingWithdrawals().length },
      { id: "kyc", label: "KYC & Risco", icon: "id", badge: pendingKyc().length },
      { group: "Produto" },
      { id: "games", label: "Jogos", icon: "grid" },
      { id: "promotions", label: "Promoções & Bônus", icon: "gift" },
      { id: "media", label: "Banners & Imagens", icon: "image" },
      { group: "Crescimento" },
      { id: "affiliates", label: "Afiliados", icon: "link", badge: D.affiliates.filter(function (a) { return a.status === "Pending review"; }).length },
      { group: "Sistema" },
      { id: "settings", label: "Configurações", icon: "settings" },
      { id: "audit", label: "Log de auditoria", icon: "file" }
    ];
  }
  function renderNav(active) {
    $("#adm-nav").innerHTML = NAV().map(function (n) {
      if (n.group) return '<div class="adm-group">' + n.group + "</div>";
      return '<a class="adm-link' + (n.id === active ? " active" : "") + '" href="#/' + n.id + '">' + ic(n.icon, 17) + n.label + (n.badge ? '<span class="badge badge-warn">' + n.badge + "</span>" : "") + "</a>";
    }).join("");
  }

  /* ---------- Helpers ---------- */
  var audit = store.get("audit", [
    { at: "2026-10-08 09:12", who: "admin", what: "Aprovou saque TX-88209 ($1,240.00)" },
    { at: "2026-10-08 08:40", who: "admin", what: "Alterou banner 'welcome'" },
    { at: "2026-10-07 22:05", who: "support_01", what: "Suspendeu jogador lucky_7 (risco: multi-contas)" }
  ]);
  function log(what) {
    var d = new Date(), at = d.toISOString().slice(0, 10) + " " + d.toTimeString().slice(0, 5);
    audit.unshift({ at: at, who: "admin", what: what }); store.set("audit", audit);
  }
  function statusBadge(s) {
    var map = { Completed: "badge-brand", Paid: "badge-brand", Active: "badge-brand", Verified: "badge-brand", Approved: "badge-brand",
      Pending: "badge-warn", "Pending review": "badge-warn", Scheduled: "badge-info", scheduled: "badge-info", active: "badge-brand", draft: "",
      Rejected: "badge-danger", Suspended: "badge-danger", High: "badge-danger", Medium: "badge-warn", Low: "", "Not started": "" };
    var pt = { Completed: "Concluída", Pending: "Pendente", Rejected: "Rejeitada", Active: "Ativo", Suspended: "Suspenso", Verified: "Verificado",
      "Not started": "Não iniciado", "Pending review": "Em análise", High: "Alto", Medium: "Médio", Low: "Baixo", active: "Ativa", scheduled: "Agendada", draft: "Rascunho", Paid: "Pago" };
    return '<span class="badge ' + (map[s] || "") + '">' + (pt[s] || s) + "</span>";
  }
  function head(title, sub, actions) {
    return '<div class="adm-head"><div><h1 style="font-size:24px">' + title + "</h1>" + (sub ? "<p>" + sub + "</p>" : "") + '</div><div class="row">' + (actions || "") + "</div></div>";
  }
  function kpi(label, value, delta, pos) {
    return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + "</div>" + (delta ? '<div class="kpi-delta ' + (pos === false ? "neg" : "pos") + '">' + delta + "</div>" : "") + "</div>";
  }
  function openDrawer(title, html) { $("#adm-drawer-title").textContent = title; $("#adm-drawer-body").innerHTML = html; $("#adm-drawer").classList.add("open"); }
  function openModal(html) { $("#adm-modal-box").innerHTML = html; $("#adm-modal").classList.add("open"); }
  function closeAll() { $("#adm-drawer").classList.remove("open"); $("#adm-modal").classList.remove("open"); document.body.classList.remove("adm-open"); }

  /* ---------- Páginas ---------- */
  var P = {};

  P.dashboard = function () {
    var k = D.kpis, pw = pendingWithdrawals();
    var total = D.revenueDaily.reduce(function (a, d) { return a + d.ggr; }, 0);
    return head("Dashboard", "Últimos 30 dias · valores em USD", '<div class="segmented"><button>Hoje</button><button>7d</button><button class="active">30d</button><button>Ano</button></div>') +
      '<div class="kpi-grid">' + kpi("GGR", fmt.usd(k.ggr, { dec: 0 }), "+12,4% vs mês anterior") + kpi("NGR", fmt.usd(k.ngr, { dec: 0 }), "+9,1%") + kpi("Depósitos", fmt.usd(k.deposits, { dec: 0 }), "+18,0%") + kpi("Saques", fmt.usd(k.withdrawals, { dec: 0 }), "+6,2%", false) + "</div>" +
      '<div class="kpi-grid mt">' + kpi("Jogadores ativos", fmt.int(k.activePlayers)) + kpi("Novos cadastros", fmt.int(k.newSignups)) + kpi("Primeiros depósitos (FTD)", fmt.int(k.ftds), ((k.ftds / k.newSignups) * 100).toFixed(1) + "% conversão") + kpi("Custo de bônus", fmt.usd(k.bonusCost, { dec: 0 }), ((k.bonusCost / k.ggr) * 100).toFixed(1) + "% do GGR", false) + "</div>" +
      '<div class="adm-grid-2 mt"><div class="card"><div class="card-head"><h3>GGR diário</h3><span class="badge badge-brand">' + fmt.usd(total, { dec: 0 }) + '</span></div><div class="card-pad">' + RD.bars(D.revenueDaily, "ggr", function (v) { return fmt.usd(v, { dec: 0 }); }) + "</div></div>" +
      '<div class="card"><div class="card-head"><h3>Requer ação</h3></div>' +
        '<a class="queue-item" href="#/transactions"><span class="avatar" style="background:var(--warn-soft);color:var(--warn)">' + ic("coins", 16) + '</span><div class="grow"><strong>' + pw.length + ' saques pendentes</strong><small>' + fmt.usd(pw.reduce(function (a, t) { return a + t.amount; }, 0)) + " aguardando aprovação</small></div>" + ic("chevronRight", 16) + "</a>" +
        '<a class="queue-item" href="#/kyc"><span class="avatar" style="background:var(--info-soft);color:var(--info)">' + ic("id", 16) + '</span><div class="grow"><strong>' + pendingKyc().length + ' verificações KYC</strong><small>Documentos enviados para análise</small></div>' + ic("chevronRight", 16) + "</a>" +
        '<a class="queue-item" href="#/affiliates"><span class="avatar" style="background:var(--brand-soft);color:var(--brand)">' + ic("link", 16) + '</span><div class="grow"><strong>1 afiliado em análise</strong><small>streamer_jax pediu acordo híbrido</small></div>' + ic("chevronRight", 16) + "</a>" +
        '<a class="queue-item" href="#/kyc"><span class="avatar" style="background:var(--danger-soft);color:var(--danger)">' + ic("alert", 16) + '</span><div class="grow"><strong>1 alerta de risco alto</strong><small>moonboy · padrão de bônus abuse</small></div>' + ic("chevronRight", 16) + "</a></div></div>" +
      '<div class="adm-grid-2 mt"><div class="card"><div class="card-head"><h3>Transações recentes</h3><a class="see-all" href="#/transactions">Ver todas</a></div>' + txTable(D.transactions.slice(0, 6), false) + "</div>" +
      '<div class="card"><div class="card-head"><h3>Top jogos (GGR)</h3></div><div class="table-wrap"><table class="table"><tbody>' +
        RD.games.slice(0, 6).map(function (g, i) { var v = Math.round(28000 / (i + 1.4)); return '<tr><td><div class="row" style="gap:10px">' + media(g, "thumb", "") + '<span class="strong">' + esc(g.name) + '</span></div></td><td class="right num strong">' + fmt.usd(v, { dec: 0 }) + "</td></tr>"; }).join("") +
      "</tbody></table></div></div></div>";
  };

  /* Jogadores */
  P.players = function () {
    return head("Jogadores", D.players.length + " contas", '<button class="btn btn-secondary btn-sm" data-act="export">' + ic("download", 16) + "Exportar</button>") +
      '<div class="card"><div class="toolbar-a">' +
        '<div class="input-search" style="flex:1;max-width:320px">' + ic("search") + '<input class="input" id="pl-q" placeholder="Usuário, e-mail ou ID"></div>' +
        '<select class="select" id="pl-kyc" style="width:170px"><option value="">KYC: todos</option><option>Verified</option><option>Pending</option><option>Not started</option><option>Rejected</option></select>' +
        '<select class="select" id="pl-st" style="width:150px"><option value="">Status: todos</option><option>Active</option><option>Suspended</option></select></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Jogador</th><th>País</th><th>Nível</th><th class="right">Saldo</th><th class="right">Depósitos</th><th class="right">Saques</th><th>KYC</th><th>Risco</th><th>Status</th></tr></thead><tbody id="pl-body"></tbody></table></div></div>';
  };
  P.players.after = function () {
    var q = $("#pl-q"), k = $("#pl-kyc"), s = $("#pl-st");
    function draw() {
      var v = q.value.toLowerCase();
      var list = D.players.filter(function (p) { return (!v || (p.username + p.email + p.id).toLowerCase().indexOf(v) > -1) && (!k.value || p.kyc === k.value) && (!s.value || p.status === s.value); });
      $("#pl-body").innerHTML = list.map(function (p) {
        return '<tr class="clickable" data-player="' + p.id + '"><td><div class="row" style="gap:10px"><span class="avatar">' + p.username.slice(0, 2).toUpperCase() + '</span><div><span class="strong">' + esc(p.username) + '</span><br><small class="faint">' + p.id + "</small></div></div></td><td>" + esc(p.country) + "</td><td>" + p.tier + '</td><td class="right num strong">' + fmt.usd(p.balance) + '</td><td class="right num">' + fmt.usd(p.deposits, { dec: 0 }) + '</td><td class="right num">' + fmt.usd(p.withdrawals, { dec: 0 }) + "</td><td>" + statusBadge(p.kyc) + "</td><td>" + statusBadge(p.risk) + "</td><td>" + statusBadge(p.status) + "</td></tr>";
      }).join("") || '<tr><td colspan="9"><div class="empty">Nenhum jogador encontrado.</div></td></tr>';
    }
    [q, k, s].forEach(function (el) { el.addEventListener("input", draw); });
    draw();
  };
  function playerDrawer(id) {
    var p = D.players.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var tx = D.transactions.filter(function (t) { return t.user === p.username; });
    openDrawer(p.username,
      '<div class="row" style="gap:12px;margin-bottom:16px"><span class="avatar" style="width:44px;height:44px;font-size:15px">' + p.username.slice(0, 2).toUpperCase() + '</span><div><strong>' + esc(p.username) + '</strong><br><small class="faint">' + esc(p.email) + " · " + p.id + '</small></div></div>' +
      '<div class="row wrap" style="gap:6px;margin-bottom:16px">' + statusBadge(p.status) + statusBadge(p.kyc) + '<span class="badge">Risco: ' + p.risk + '</span><span class="badge">' + p.tier + "</span></div>" +
      '<div class="detail-grid"><div><small>Saldo</small><strong class="num">' + fmt.usd(p.balance) + '</strong></div><div><small>Lucro da casa (NGR)</small><strong class="num">' + fmt.usd(p.deposits - p.withdrawals - p.balance, { dec: 0 }) + '</strong></div><div><small>Depósitos</small><strong class="num">' + fmt.usd(p.deposits, { dec: 0 }) + '</strong></div><div><small>Saques</small><strong class="num">' + fmt.usd(p.withdrawals, { dec: 0 }) + '</strong></div><div><small>País</small><strong>' + esc(p.country) + '</strong></div><div><small>Cadastro</small><strong>' + p.registered + '</strong></div><div><small>Afiliado</small><strong>' + p.affiliate + '</strong></div><div><small>Último IP</small><strong>203.0.113.' + (p.id.slice(-2) | 0) + "</strong></div></div>" +
      '<h3 style="margin:20px 0 10px">Ações</h3><div class="row wrap" style="gap:8px">' +
        '<button class="btn btn-secondary btn-sm" data-act="adjust" data-id="' + p.id + '">' + ic("sliders", 14) + "Ajustar saldo</button>" +
        '<button class="btn btn-secondary btn-sm" data-act="bonus" data-id="' + p.id + '">' + ic("gift", 14) + "Dar bônus</button>" +
        '<button class="btn btn-secondary btn-sm" data-act="reset2fa" data-id="' + p.id + '">' + ic("lock", 14) + "Resetar 2FA</button>" +
        (p.status === "Suspended" ? '<button class="btn btn-primary btn-sm" data-act="unsuspend" data-id="' + p.id + '">Reativar</button>' : '<button class="btn btn-danger btn-sm" data-act="suspend" data-id="' + p.id + '">' + ic("ban", 14) + "Suspender</button>") + "</div>" +
      '<div class="field" style="margin-top:20px"><label>Nota interna</label><textarea class="textarea" placeholder="Visível só para a equipe"></textarea></div>' +
      '<h3 style="margin:20px 0 10px">Transações</h3><div class="card">' + (tx.length ? txTable(tx, false) : '<div class="empty">Sem transações.</div>') + "</div>");
  }

  /* Transações */
  function txTable(list, actions) {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Jogador</th><th>Tipo</th><th>Moeda</th><th class="right">Valor</th><th>Status</th><th>Data</th>' + (actions ? "<th></th>" : "") + "</tr></thead><tbody>" +
      list.map(function (t) {
        var act = actions && t.status === "Pending" && t.type === "Withdrawal"
          ? '<td class="right"><div class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-primary btn-sm" data-act="approve" data-id="' + t.id + '">Aprovar</button><button class="btn btn-danger btn-sm" data-act="reject" data-id="' + t.id + '">Rejeitar</button></div></td>' : actions ? "<td></td>" : "";
        return '<tr><td class="strong">' + t.id + "</td><td>" + esc(t.user) + "</td><td>" + (t.type === "Deposit" ? '<span class="pos">' + ic("arrowDown", 14) + " Depósito</span>" : '<span class="neg">' + ic("arrowUp", 14) + " Saque</span>") + "</td><td>" + t.coin + '</td><td class="right num strong">' + fmt.usd(t.amount) + "</td><td>" + statusBadge(t.status) + '</td><td class="faint">' + t.date + "</td>" + act + "</tr>";
      }).join("") + "</tbody></table></div>";
  }
  P.transactions = function (filter) {
    filter = filter || "all";
    var list = D.transactions.filter(function (t) {
      return filter === "all" || (filter === "pending" && t.status === "Pending" && t.type === "Withdrawal") || (filter === "deposits" && t.type === "Deposit") || (filter === "withdrawals" && t.type === "Withdrawal");
    });
    var tabs = [["all", "Todas"], ["pending", "Saques pendentes (" + pendingWithdrawals().length + ")"], ["deposits", "Depósitos"], ["withdrawals", "Saques"]];
    return head("Transações", "Saques acima de $2.000 ou de contas sem KYC exigem aprovação manual.") +
      '<div class="tabs" style="margin-bottom:16px">' + tabs.map(function (t) { return '<a class="tab' + (t[0] === filter ? " active" : "") + '" href="#/transactions/' + t[0] + '">' + t[1] + "</a>"; }).join("") + "</div>" +
      '<div class="card">' + (list.length ? txTable(list, true) : '<div class="empty"><h3>Fila vazia</h3>Nenhuma transação aqui.</div>') + "</div>";
  };

  /* KYC */
  P.kyc = function () {
    var pend = D.players.filter(function (p) { return p.kyc === "Pending"; });
    var risk = D.players.filter(function (p) { return p.risk !== "Low"; });
    return head("KYC & Risco", "Verificação de identidade e alertas de fraude") +
      '<div class="kpi-grid">' + kpi("Pendentes", pend.length) + kpi("Verificados", D.players.filter(function (p) { return p.kyc === "Verified"; }).length) + kpi("Rejeitados", D.players.filter(function (p) { return p.kyc === "Rejected"; }).length) + kpi("Alertas de risco", risk.length) + "</div>" +
      '<div class="adm-grid-2 mt"><div class="card"><div class="card-head"><h3>Fila de verificação</h3><span class="faint" style="font-size:12px">Integre Sumsub, Veriff ou similar</span></div>' +
        (pend.length ? pend.map(function (p) {
          return '<div class="queue-item"><span class="avatar">' + p.username.slice(0, 2).toUpperCase() + '</span><div class="grow"><strong>' + esc(p.username) + "</strong><small>" + esc(p.country) + ' · Passaporte + comprovante de endereço</small></div><button class="btn btn-secondary btn-sm" data-player="' + p.id + '">Ver</button><button class="btn btn-primary btn-sm" data-act="kyc-ok" data-id="' + p.id + '">Aprovar</button><button class="btn btn-danger btn-sm" data-act="kyc-no" data-id="' + p.id + '">Rejeitar</button></div>';
        }).join("") : '<div class="empty">Nenhuma verificação pendente.</div>') + "</div>" +
      '<div class="card"><div class="card-head"><h3>Alertas de risco</h3></div>' + risk.map(function (p) {
        var why = p.risk === "High" ? "Mesmo dispositivo de 3 contas; padrão de bônus abuse" : "Depósitos fragmentados abaixo do limite de KYC";
        return '<div class="queue-item"><div class="grow"><strong>' + esc(p.username) + " " + statusBadge(p.risk) + "</strong><small>" + why + '</small></div><button class="btn btn-secondary btn-sm" data-player="' + p.id + '">Investigar</button></div>';
      }).join("") + "</div></div>" +
      '<div class="notice info mt">' + ic("shield", 16) + "<span>Para licença offshore você precisará de: KYC por faixa de valor, checagem de PEP/sanções, monitoramento de transações (AML) e um responsável de compliance (MLRO). Os limites exatos vêm do seu licenciador.</span></div>";
  };

  /* Jogos */
  P.games = function () {
    var provs = {}; RD.games.forEach(function (g) { provs[g.provider] = (provs[g.provider] || 0) + 1; });
    return head("Jogos", RD.games.length + " jogos · " + Object.keys(provs).length + " provedores", '<button class="btn btn-secondary btn-sm" data-act="sync">' + ic("download", 16) + "Sincronizar agregador</button>") +
      '<div class="card"><div class="toolbar-a"><div class="input-search" style="flex:1;max-width:320px">' + ic("search") + '<input class="input" id="gm-q" placeholder="Buscar jogo"></div>' +
      '<select class="select" id="gm-cat" style="width:180px"><option value="">Todas categorias</option>' + RD.categories.slice(1).map(function (c) { return '<option value="' + c.id + '">' + c.label + "</option>"; }).join("") + "</select></div>" +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Jogo</th><th>Provedor</th><th>Categoria</th><th class="right">RTP</th><th>Destaque</th><th>Imagem</th><th class="right">Ativo</th></tr></thead><tbody id="gm-body"></tbody></table></div></div>';
  };
  P.games.after = function () {
    var q = $("#gm-q"), c = $("#gm-cat");
    function draw() {
      $("#gm-body").innerHTML = RD.games.filter(function (g) { return (!q.value || g.name.toLowerCase().indexOf(q.value.toLowerCase()) > -1) && (!c.value || g.cat === c.value); }).map(function (g) {
        return '<tr><td><div class="row" style="gap:10px">' + media(g, "thumb", "") + '<span class="strong">' + esc(g.name) + "</span></div></td><td>" + esc(g.provider) + "</td><td>" + g.cat + '</td><td class="right num">' + g.rtp + '%</td><td><select class="select" style="height:30px;width:110px;font-size:12px" data-tag="' + g.id + '"><option value="">—</option><option' + (g.tag === "hot" ? " selected" : "") + ' value="hot">Hot</option><option' + (g.tag === "new" ? " selected" : "") + ' value="new">New</option></select></td><td><code class="faint" style="font-size:11px">' + g.img.replace("assets/img/", "") + '</code></td><td class="right"><label class="switch"><input type="checkbox" data-toggle-game="' + g.id + '"' + (g.enabled ? " checked" : "") + "><span></span></label></td></tr>";
      }).join("");
    }
    q.addEventListener("input", draw); c.addEventListener("input", draw); draw();
  };

  /* Promoções */
  P.promotions = function () {
    return head("Promoções & Bônus", "O que aparece na página Promotions do site", '<button class="btn btn-primary btn-sm" data-act="new-promo">' + ic("plus", 16) + "Nova promoção</button>") +
      '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Promoção</th><th>Valor</th><th>Público</th><th>Status</th><th class="right">Resgates (30d)</th><th class="right">Custo (30d)</th><th></th></tr></thead><tbody>' +
      RD.promotions.map(function (p, i) {
        return '<tr><td><div class="row" style="gap:10px">' + media(p, "thumb", "") + '<span class="strong">' + esc(p.title) + "</span></div></td><td>" + esc(p.value) + "</td><td>" + esc(p.badge) + "</td><td>" + statusBadge(p.status) + '</td><td class="right num">' + fmt.int(420 / (i + 1)) + '</td><td class="right num">' + fmt.usd(16000 / (i + 1), { dec: 0 }) + '</td><td class="right"><button class="btn btn-ghost btn-sm" data-act="edit-promo" data-id="' + p.id + '">' + ic("edit", 14) + "Editar</button></td></tr>";
      }).join("") + "</tbody></table></div></div>" +
      '<div class="notice mt">' + ic("alert", 16) + "<span>Custo de bônus acima de ~25–30% do GGR costuma corroer a margem. Acompanhe no Dashboard e defina limite de aposta máxima durante o rollover (anti bonus-abuse).</span></div>";
  };
  function promoForm(p) {
    p = p || { title: "", value: "", desc: "", badge: "", status: "draft", img: "", id: "" };
    openModal('<div class="modal-head"><h3>' + (p.id ? "Editar promoção" : "Nova promoção") + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="promo-form"><div class="modal-body">' +
      '<div class="adm-grid-2" style="gap:12px"><div class="field"><label>Título</label><input class="input" name="title" required value="' + esc(p.title) + '"></div><div class="field"><label>Valor em destaque</label><input class="input" name="value" required value="' + esc(p.value) + '" placeholder="100% up to $1,000"></div></div>' +
      '<div class="field"><label>Descrição (inglês, aparece no site)</label><textarea class="textarea" name="desc">' + esc(p.desc) + "</textarea></div>" +
      '<div class="adm-grid-3" style="gap:12px"><div class="field"><label>Etiqueta</label><input class="input" name="badge" value="' + esc(p.badge) + '" placeholder="Weekly"></div><div class="field"><label>Status</label><select class="select" name="status"><option value="active"' + (p.status === "active" ? " selected" : "") + '>Ativa</option><option value="scheduled"' + (p.status === "scheduled" ? " selected" : "") + '>Agendada</option><option value="draft"' + (p.status === "draft" ? " selected" : "") + '>Rascunho</option></select></div><div class="field"><label>Rollover</label><input class="input" value="35x"></div></div>' +
      '<div class="field"><label>Imagem</label><input class="input" value="' + esc(p.img || "assets/img/promos/" + (p.id || "nova") + ".jpg") + '" disabled><span class="hint">Salve o arquivo nesse caminho (1200×600). Upload direto exige backend.</span></div></div>' +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Salvar</button></div></form>');
    $("#promo-form").addEventListener("submit", function (e) {
      e.preventDefault(); var f = e.target;
      if (p.id) { var x = RD.promotions.filter(function (y) { return y.id === p.id; })[0]; x.title = f.title.value; x.value = f.value.value; x.desc = f.desc.value; x.badge = f.badge.value; x.status = f.status.value; log("Editou promoção '" + x.title + "'"); }
      else { RD.promotions.push({ id: "p" + Date.now(), title: f.title.value, value: f.value.value, desc: f.desc.value, badge: f.badge.value || "New", status: f.status.value, c1: "#1a2a3a", c2: "#0b1219" }); log("Criou promoção '" + f.title.value + "'"); }
      closeAll(); RD.toast("Promoção salva"); route();
    });
  }

  /* Banners & imagens */
  P.media = function () {
    var slots = [];
    RD.banners.forEach(function (b) { slots.push({ group: "Banners da home", name: b.title, path: b.img, size: b.id === "welcome" ? "1600×700" : "800×400", o: b }); });
    RD.promotions.forEach(function (p) { slots.push({ group: "Promoções", name: p.title, path: p.img, size: "1200×600", o: p }); });
    slots.push({ group: "Afiliados", name: "Hero da página de afiliados", path: RD.img.heroAffiliate, size: "1920×800", o: { img: RD.img.heroAffiliate, c1: "#10284a", c2: "#0a0f18" } });
    RD.affiliate.assets.forEach(function (a) { slots.push({ group: "Afiliados", name: "Material: " + a.name, path: a.img, size: a.size.replace("×", "×"), o: a }); });
    RD.games.slice(0, 8).forEach(function (g) { slots.push({ group: "Capas de jogos (exemplos)", name: g.name, path: g.img, size: "600×800", o: g }); });
    var groups = {}; slots.forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    return head("Banners & Imagens", "Cada espaço do site que aceita foto. Status mostra se o arquivo já existe.", '<a class="btn btn-secondary btn-sm" href="../assets/img/README.md" target="_blank">' + ic("file", 16) + "Guia de imagens</a>") +
      '<div class="notice info" style="margin-bottom:20px">' + ic("upload", 16) + "<span>Como trocar uma imagem hoje: salve o arquivo com o nome exato em <code>assets/img/…</code> e publique. Com backend, este painel terá upload direto (S3/Cloudflare R2).</span></div>" +
      Object.keys(groups).map(function (g) {
        return '<div class="section-a"><h3 style="margin:8px 0 12px">' + g + '</h3><div class="adm-grid-4">' + groups[g].map(function (s) {
          return '<div class="card img-slot">' + media(s.o, "", ic("image", 22) + "<span>Sem imagem</span>") + '<div class="img-slot-body"><strong style="font-size:13px">' + esc(s.name) + "</strong><code>" + s.path + '</code><div class="row between"><span class="badge">' + s.size + '</span><span class="img-status" data-src="../' + s.path + '"><span class="badge">verificando…</span></span></div></div></div>';
        }).join("") + "</div></div>";
      }).join("");
  };
  P.media.after = function () {
    $$(".img-status").forEach(function (el) {
      var im = new Image();
      im.onload = function () { el.innerHTML = '<span class="badge badge-brand">OK</span>'; };
      im.onerror = function () { el.innerHTML = '<span class="badge badge-warn">Faltando</span>'; };
      im.src = el.getAttribute("data-src");
    });
  };

  /* Afiliados */
  P.affiliates = function () {
    var owed = D.affiliates.reduce(function (a, x) { return a + x.owed; }, 0);
    return head("Afiliados", "Parceiros, acordos e pagamentos", '<button class="btn btn-primary btn-sm" data-act="new-aff">' + ic("plus", 16) + "Convidar afiliado</button>") +
      '<div class="kpi-grid">' + kpi("Afiliados ativos", D.affiliates.filter(function (a) { return a.status === "Active"; }).length) + kpi("Jogadores trazidos", fmt.int(D.affiliates.reduce(function (a, x) { return a + x.players; }, 0))) + kpi("NGR via afiliados", fmt.usd(D.affiliates.reduce(function (a, x) { return a + Math.max(0, x.ngr); }, 0), { dec: 0 })) + kpi("A pagar (segunda)", fmt.usd(owed, { dec: 0 })) + "</div>" +
      '<div class="card mt"><div class="table-wrap"><table class="table"><thead><tr><th>Afiliado</th><th>Código</th><th>Acordo</th><th class="right">Jogadores</th><th class="right">NGR</th><th class="right">A pagar</th><th>Status</th><th></th></tr></thead><tbody>' +
      D.affiliates.map(function (a) {
        var act = a.status === "Pending review" ? '<button class="btn btn-primary btn-sm" data-act="aff-approve" data-id="' + a.id + '">Aprovar</button>'
          : a.owed > 0 ? '<button class="btn btn-secondary btn-sm" data-act="aff-pay" data-id="' + a.id + '">Pagar</button>' : "";
        return '<tr><td><span class="strong">' + esc(a.name) + '</span><br><small class="faint">' + esc(a.email) + '</small></td><td><span class="badge">' + a.code + "</span></td><td>" + esc(a.plan) + '</td><td class="right num">' + a.players + '</td><td class="right num ' + (a.ngr < 0 ? "neg" : "") + '">' + fmt.usd(a.ngr, { dec: 0 }) + '</td><td class="right num strong">' + fmt.usd(a.owed) + "</td><td>" + statusBadge(a.status) + '</td><td class="right"><div class="row" style="gap:6px;justify-content:flex-end">' + act + '<button class="btn btn-ghost btn-sm" data-act="aff-edit" data-id="' + a.id + '">' + ic("edit", 14) + "</button></div></td></tr>";
      }).join("") + "</tbody></table></div></div>" +
      '<div class="adm-grid-2 mt"><div class="card card-pad"><h3>Plano padrão (revenue share por FTD/mês)</h3><div class="table-wrap" style="margin-top:10px"><table class="table"><tbody>' +
        RD.affiliate.plans.map(function (p) { return "<tr><td class=\"strong\">" + p.label + "</td><td>" + p.range + '</td><td class="right"><input class="input" style="width:80px;height:32px;text-align:right" value="' + p.share + '">%</td></tr>'; }).join("") +
      '</tbody></table></div><button class="btn btn-primary btn-sm" style="margin-top:12px" data-act="save">Salvar plano</button></div>' +
      '<div class="card card-pad"><h3>Regras</h3><div class="stack" style="margin-top:12px;font-size:13px">' +
        [["Negative carryover", false], ["Pagamento automático toda segunda", true], ["Mínimo para saque: $50", true], ["Bloquear auto-indicação (mesmo IP/dispositivo)", true], ["Excluir jogadores de países restritos da comissão", true]].map(function (r) { return '<div class="row between"><span class="muted">' + r[0] + '</span><label class="switch"><input type="checkbox"' + (r[1] ? " checked" : "") + "><span></span></label></div>"; }).join("") +
      "</div></div></div>";
  };

  /* Configurações */
  P.settings = function () {
    var L = RD.config.license;
    return head("Configurações", "Dados da operação exibidos no site") +
      '<div class="adm-grid-2"><div class="card card-pad"><h3 style="margin-bottom:14px">Licença</h3>' +
        '<div class="notice" style="margin-bottom:14px">' + ic("alert", 16) + "<span>Enquanto o status for “pendente”, o rodapé avisa que não há licença. Não opere com dinheiro real nesse estado.</span></div>" +
        '<div class="field"><label>Status</label><select class="select"><option' + (L.status === "pending" ? " selected" : "") + '>Pendente</option><option' + (L.status === "active" ? " selected" : "") + ">Ativa</option></select></div>" +
        '<div class="field"><label>Autoridade</label><input class="input" value="' + esc(L.authority) + '" placeholder="Ex.: Curaçao Gaming Authority"></div>' +
        '<div class="field"><label>Número da licença</label><input class="input" value="' + esc(L.number) + '"></div>' +
        '<div class="field"><label>Razão social e endereço</label><input class="input" value="' + esc(L.company) + '"></div>' +
        '<button class="btn btn-primary" data-act="save">Salvar</button></div>' +
      '<div class="card card-pad"><h3 style="margin-bottom:14px">Países restritos</h3><p class="faint" style="font-size:13px;margin-bottom:10px">Cadastro bloqueado e aviso no rodapé. Em produção, combine com bloqueio por IP (geofencing).</p>' +
        '<div class="tag-input" id="geo-tags">' + RD.config.restrictedCountries.map(function (c) { return '<span class="badge badge-danger" data-rm="' + esc(c) + '">' + esc(c) + " ✕</span>"; }).join("") + '<input id="geo-add" placeholder="Adicionar país + Enter"></div>' +
        '<div class="divider"></div><h3 style="margin-bottom:14px">Limites</h3>' +
        '<div class="adm-grid-2" style="gap:12px"><div class="field"><label>Depósito mínimo</label><input class="input" value="$20"></div><div class="field"><label>Saque mínimo</label><input class="input" value="$20"></div><div class="field"><label>Saque automático até</label><input class="input" value="$2,000"></div><div class="field"><label>KYC obrigatório a partir de</label><input class="input" value="$2,000 acumulado"></div></div>' +
        '<button class="btn btn-primary" data-act="save">Salvar limites</button></div></div>' +
      '<div class="card card-pad mt"><h3 style="margin-bottom:14px">Equipe & permissões</h3><div class="table-wrap"><table class="table"><thead><tr><th>Usuário</th><th>Função</th><th>2FA</th><th>Último acesso</th></tr></thead><tbody>' +
        [["admin", "Super admin", true, "agora"], ["support_01", "Suporte (sem saques)", true, "2h"], ["finance", "Financeiro (aprova saques)", false, "1d"]].map(function (u) { return '<tr><td class="strong">' + u[0] + "</td><td>" + u[1] + "</td><td>" + (u[2] ? '<span class="badge badge-brand">Ativo</span>' : '<span class="badge badge-danger">Desligado</span>') + '</td><td class="faint">' + u[3] + "</td></tr>"; }).join("") +
      "</tbody></table></div></div>";
  };
  P.settings.after = function () {
    var inp = $("#geo-add");
    inp.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || !inp.value.trim()) return;
      e.preventDefault(); RD.config.restrictedCountries.push(inp.value.trim()); log("Adicionou país restrito: " + inp.value.trim()); route();
    });
  };

  P.audit = function () {
    return head("Log de auditoria", "Toda ação administrativa deve ser registrada no servidor (quem, quando, o quê, IP).") +
      '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th></tr></thead><tbody>' +
      audit.map(function (a) { return '<tr><td class="faint">' + a.at + '</td><td class="strong">' + esc(a.who) + "</td><td>" + esc(a.what) + "</td></tr>"; }).join("") + "</tbody></table></div></div>";
  };

  /* ---------- Router ---------- */
  var TITLES = { dashboard: "Dashboard", players: "Jogadores", transactions: "Transações", kyc: "KYC & Risco", games: "Jogos", promotions: "Promoções & Bônus", media: "Banners & Imagens", affiliates: "Afiliados", settings: "Configurações", audit: "Auditoria" };
  function route() {
    var parts = (location.hash || "#/dashboard").replace(/^#\/?/, "").split("/");
    var name = P[parts[0]] ? parts[0] : "dashboard";
    $("#adm-view").innerHTML = P[name](parts[1]);
    if (P[name].after) P[name].after(parts[1]);
    $("#adm-title").textContent = TITLES[name];
    renderNav(name);
    closeAll();
    window.scrollTo(0, 0);
  }

  /* ---------- Eventos ---------- */
  function find(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act],[data-player],[data-close],[data-close-drawer],[data-rm],#adm-burger,#adm-backdrop,#adm-logout");
    if (!t) { if (e.target.id === "adm-modal") closeAll(); return; }
    if (t.id === "adm-burger") return document.body.classList.toggle("adm-open");
    if (t.id === "adm-backdrop" || t.hasAttribute("data-close") || t.hasAttribute("data-close-drawer")) return closeAll();
    if (t.id === "adm-logout") { store.set("auth", false); location.reload(); return; }
    if (t.hasAttribute("data-player")) return playerDrawer(t.getAttribute("data-player"));
    if (t.hasAttribute("data-rm")) { var c = t.getAttribute("data-rm"); RD.config.restrictedCountries = RD.config.restrictedCountries.filter(function (x) { return x !== c; }); log("Removeu país restrito: " + c); return route(); }

    var a = t.getAttribute("data-act"), id = t.getAttribute("data-id");
    if (a === "approve" || a === "reject") {
      var tx = find(D.transactions, id); tx.status = a === "approve" ? "Completed" : "Rejected";
      log((a === "approve" ? "Aprovou" : "Rejeitou") + " saque " + id + " (" + fmt.usd(tx.amount) + ")");
      RD.toast("Saque " + id + (a === "approve" ? " aprovado" : " rejeitado"), a === "reject" ? "error" : ""); return route();
    }
    if (a === "kyc-ok" || a === "kyc-no") { var p = find(D.players, id); p.kyc = a === "kyc-ok" ? "Verified" : "Rejected"; log("KYC " + (a === "kyc-ok" ? "aprovado" : "rejeitado") + ": " + p.username); RD.toast("KYC atualizado"); return route(); }
    if (a === "suspend" || a === "unsuspend") { var q = find(D.players, id); q.status = a === "suspend" ? "Suspended" : "Active"; log((a === "suspend" ? "Suspendeu " : "Reativou ") + q.username); RD.toast("Status atualizado"); playerDrawer(id); if (location.hash.indexOf("players") > -1) P.players.after(); return; }
    if (a === "adjust") {
      var pl = find(D.players, id);
      openModal('<div class="modal-head"><h3>Ajustar saldo · ' + esc(pl.username) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>' + ic("x") + '</button></div><form id="adj-form"><div class="modal-body"><div class="field"><label>Tipo</label><select class="select" name="type"><option value="1">Crédito</option><option value="-1">Débito</option></select></div><div class="field"><label>Valor (USD)</label><input class="input" name="amt" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Motivo (obrigatório, vai para auditoria)</label><input class="input" name="why" required minlength="5"></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Confirmar</button></div></form>');
      $("#adj-form").addEventListener("submit", function (ev) { ev.preventDefault(); var f = ev.target, v = +f.amt.value * +f.type.value; pl.balance = Math.max(0, pl.balance + v); log("Ajuste de saldo " + pl.username + ": " + fmt.usd(v, { sign: true }) + " — " + f.why.value); closeAll(); RD.toast("Saldo ajustado"); route(); });
      return;
    }
    if (a === "new-promo") return promoForm();
    if (a === "edit-promo") return promoForm(find(RD.promotions, id));
    if (a === "aff-approve") { var af = find(D.affiliates, id); af.status = "Active"; log("Aprovou afiliado " + af.name); RD.toast("Afiliado aprovado"); return route(); }
    if (a === "aff-pay") { var ap = find(D.affiliates, id); log("Pagou afiliado " + ap.name + " " + fmt.usd(ap.owed)); RD.toast("Pagamento de " + fmt.usd(ap.owed) + " registrado"); ap.owed = 0; return route(); }
    if (a === "aff-edit") { var ae = find(D.affiliates, id); return openDrawer(ae.name, '<div class="field"><label>Acordo</label><select class="select"><option>Revenue share (plano padrão)</option><option>Revenue share customizado</option><option>CPA</option><option>Híbrido (CPA + RS)</option></select></div><div class="field"><label>% revenue share</label><input class="input" value="' + (ae.plan.match(/(\d+)%/) || [0, 30])[1] + '"></div><div class="field"><label>CPA (USD por FTD qualificado)</label><input class="input" placeholder="Ex.: 80"></div><div class="field"><label>Baseline de qualificação do CPA</label><input class="input" placeholder="Ex.: depósito mín. $50 + $250 apostado"></div><div class="field"><label>Carteira de pagamento</label><input class="input" placeholder="USDT TRC20"></div><button class="btn btn-primary" data-act="save">Salvar acordo</button><div class="notice" style="margin-top:16px">' + ic("alert", 16) + "<span>CPA sem baseline mínima é a principal porta de fraude de afiliado.</span></div>"); }
    if (a === "new-aff") return openDrawer("Convidar afiliado", '<div class="field"><label>Nome / marca</label><input class="input"></div><div class="field"><label>E-mail</label><input class="input" type="email"></div><div class="field"><label>Código</label><input class="input" style="text-transform:uppercase"></div><button class="btn btn-primary" data-act="save">Enviar convite</button>');
    if (a === "bonus") return RD.toast("Concessão de bônus (precisa de backend)");
    if (a === "reset2fa") { log("Resetou 2FA de " + find(D.players, id).username); return RD.toast("2FA resetado"); }
    if (a === "sync") return RD.toast("Sincronização com agregador (precisa de integração)");
    if (a === "export") return RD.toast("Exportação CSV (demo)");
    if (a === "save") { log("Salvou configurações"); return RD.toast("Salvo"); }
  });
  document.addEventListener("change", function (e) {
    var g = e.target.getAttribute("data-toggle-game");
    if (g) { var game = find(RD.games, g); game.enabled = e.target.checked; log((game.enabled ? "Ativou" : "Desativou") + " jogo " + game.name); RD.toast(game.name + (game.enabled ? " ativado" : " desativado")); }
    var tg = e.target.getAttribute("data-tag");
    if (tg) { find(RD.games, tg).tag = e.target.value; RD.toast("Destaque atualizado"); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  /* ---------- Boot ---------- */
  hydrate(document);
  function enter() { $("#adm-login").classList.add("hidden"); $("#adm").classList.remove("hidden"); route(); }
  $("#adm-login-form").addEventListener("submit", function (e) { e.preventDefault(); store.set("auth", true); enter(); });
  window.addEventListener("hashchange", route);
  if (store.get("auth", false)) enter();
})();
