# RDCasino

Front-end do cassino cripto (mercado internacional) e do painel administrativo. Hoje é **protótipo navegável**: todos os dados são de demonstração e não há backend.

## Como rodar

Não precisa de instalar nada. Na pasta do projeto:

```bash
python3 -m http.server 8000
```

- Site: http://localhost:8000
- Admin: http://localhost:8000/admin/

Qualquer e-mail e senha entram, nos dois.

## Estrutura

```
index.html              Site do jogador (rotas em hash: #/affiliate, #/vip …)
admin/index.html        Back-office
assets/css/base.css     Design system compartilhado (cores, botões, tabelas, modais)
assets/css/app.css      Estilos do site
assets/css/admin.css    Estilos do admin
assets/js/data.js       Camada de dados (mock). É aqui que o backend vai entrar
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
