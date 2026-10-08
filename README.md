# RDCasino

Front-end do cassino cripto (mercado internacional) e do painel administrativo. Hoje é **protótipo navegável**: todos os dados são de demonstração e não há backend.

## Como rodar

Não precisa de instalar nada. Na pasta do projeto:

```bash
python3 -m http.server 8000
```

- Site: http://localhost:8000
- Admin: http://localhost:8000/admin/


## Como funciona agora

O sistema começa **zerado**: nenhum jogador, aposta ou transação inventada. Tudo que aparece é criado por quem usa o site.

**Primeiro acesso ao admin:** abra `/admin/` (ou digite `rdadmin` no site, ou toque 5 vezes no logo no celular). Na primeira vez, o painel pede para você **criar** o seu e-mail e a sua senha. A partir daí, só entra quem souber essa senha.

**O que funciona de verdade (na demonstração):**
- Cadastro e login de jogadores, com bloqueio de países restritos (Brasil incluído).
- Depósito de teste (simula o processador cripto), saque com aprovação do admin e gorjeta entre jogadores.
- **Dice e Limbo jogáveis**, com resultado provably fair (HMAC-SHA256) verificável na página Provably Fair.
- Nível VIP (Wood → Amethyst) pelo total apostado, rakeback e prêmio de nível para resgatar.
- Leaderboard do mês calculado pelas apostas reais.
- Afiliados: todo jogador tem link e código; cliques, cadastros, depósitos e comissão são calculados de verdade; a comissão é coletada para o saldo.
- KYC: o jogador envia, o admin aprova ou rejeita com motivo.
- Admin: dashboard com GGR/NGR reais, jogadores, transações, apostas, KYC, jogos, promoções, imagens, afiliados, configurações e log de auditoria.

Para recomeçar do zero: Admin → Configurações → "Apagar tudo e recomeçar".

**Limite importante:** os dados ficam guardados só no navegador de quem está usando. Um jogador no celular dele e você no seu computador não se enxergam. Para isso funcionar entre pessoas diferentes (e com dinheiro real), é preciso o servidor com banco de dados. As funções de `assets/js/store.js` são exatamente as que esse servidor vai ter.

## Estrutura

```
index.html              Site do jogador (rotas em hash: #/affiliate, #/vip …)
admin/index.html        Back-office
assets/css/base.css     Design system compartilhado (cores, botões, tabelas, modais)
assets/css/app.css      Estilos do site
assets/css/admin.css    Estilos do admin
assets/js/data.js       Catálogo: jogos, promoções, níveis VIP, configurações
assets/js/store.js      "Backend" de demonstração: contas, apostas, saques, KYC, afiliados
assets/js/icons.js      Ícones SVG
assets/js/app.js        Site: rotas, páginas, afiliados, carteira, login
assets/js/admin.js      Admin: dashboard, jogadores, transações, KYC, jogos,
                        promoções, imagens, afiliados, configurações, auditoria
assets/img/             Fotos (guia em assets/img/README.md)
legacy/                 Versão anterior em arquivo único (só referência)
```

## Páginas

**Site:** Lobby, categorias de jogos com filtro por provedor, página do jogo, Promotions, VIP Club, Leaderboard, Programa de Afiliados (landing com calculadora e FAQ), Painel do Afiliado (visão geral, campanhas, jogadores indicados, ganhos e pagamentos, materiais, configurações), Provably fair, Jogo responsável, páginas legais, Configurações da conta, Sports (em breve).

**Admin:** Dashboard (GGR/NGR, fila de ações), Jogadores (busca, filtros, ficha com ajuste de saldo e suspensão), Transações (aprovar ou rejeitar saques), KYC & Risco, Jogos (ativar/desativar, destaque), Promoções (criar/editar), Banners & Imagens (status de cada foto), Afiliados (aprovar, acordos, pagar), Configurações (licença, países restritos, limites, equipe), Log de auditoria.

## O que falta para operar de verdade

1. **Backend + banco de dados.** Contas, saldo em ledger, sessões, API. O admin só pode ir ao ar com autenticação no servidor, 2FA e restrição de IP.
2. **Licença** (ex.: Curaçao/Anjouan) e empresa na jurisdição. Preencher `RD.config.license` em `data.js`.
3. **Agregador de jogos** (provedores licenciados) e motor próprio para os RD Originals com provably fair real.
4. **Processador cripto** (endereço de depósito por usuário, saques, conversão).
5. **KYC/AML** (Sumsub, Veriff ou similar) e geobloqueio por IP dos países restritos.
6. **Textos legais** escritos por advogado.
