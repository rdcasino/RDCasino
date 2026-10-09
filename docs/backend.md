# Servidor de verdade (Supabase) — plano

**Objetivo:** tirar saldo, contas e sorteio do navegador. Hoje tudo fica no `localStorage` (modo demonstração) e não pode receber dinheiro real.

## Como fica
- **Banco (Postgres no Supabase):** `supabase/migrations/0001_init.sql`.
  - Tabelas: jogadores, seeds, rodadas, apostas, transações, carteiras da casa, convites, configurações e auditoria.
  - Segurança por linha (RLS): o jogador só lê o que é dele, e ninguém altera saldo direto pelo navegador.
- **Login:** Supabase Auth (e-mail e senha).
  - O cadastro exige código de convite enquanto a fase for fechada.
  - O admin é uma conta comum que está na tabela `admins`, com verificação em duas etapas (2FA) ligada.
- **Apostas:** funções no próprio banco (`play_bet` para um clique; rodadas a seguir).
  - Recebe `{ game, action, amount, params }`.
  - Faz o sorteio com a server seed, que nunca vai para o navegador.
  - Grava o saldo e a aposta numa única transação. O navegador só anima o resultado.
  - Jogos de um clique: Dice, Limbo, Plinko, Keno, Wheel, Roulette, Coinflip, Baccarat.
  - Rodadas, com `start` / `act` / `cashout`: Mines, Hi-Lo, Crash, Blackjack, Tower, Chicken, RPS. Ficam guardadas em `rounds`.
  - A matemática é a mesma de `assets/js/app.js` (tabelas e fórmulas), e os resultados continuam verificáveis na página Provably Fair.
- **Caixa (manual na fase com 50 pessoas):**
  - **Depósito:**
    1. O jogador escolhe a moeda e a rede.
    2. Vê o endereço da casa e o memo, se houver.
    3. Envia e informa o valor e o hash da transação (`request_deposit`).
    4. O admin confere na corretora e aprova (`admin_decide_tx`).
  - **Saque:**
    1. O valor sai do saldo na hora e fica reservado (`request_withdrawal`).
    2. O admin envia pela corretora e marca como pago.
    3. Se o admin rejeitar, o valor volta para o saldo.
  - **Depósito mínimo:** $10, ou o mínimo da moeda, se for maior.

## Status
- [x] Banco de dados aplicado no Supabase (migrações 0001, 0002 e 0003).
- [x] Cadastro aberto e login (o código de convite é opcional e serve para criar a conta de admin).
- [x] Caixa manual com várias moedas: depósito por TxID e saque, com aprovação ou rejeição no admin.
- [x] Admin no modo real: jogadores, transações e convites.
- [x] Jogos de um clique sorteados no servidor (função `play_bet`, migração 0007): Dice, Limbo, Plinko, Keno, Wheel, Roulette, Coinflip e Baccarat. Testado com 200 apostas: resultado do servidor igual ao do site e saldo batendo no centavo.
- [x] Jogos com rodada no servidor (migração 0012): Mines, Tower, Chicken, Hi-Lo, RPS, Crash e Blackjack. 304 rodadas conferidas contra a matemática do site. A tabela de rodadas e as seeds não podem ser lidas pelo navegador.
- [x] Leaderboard do mês, afiliado com rev share de 15% e códigos promocionais no servidor (migração 0013).
- [x] Novos originais no servidor (migração 0014): Double (estilo Blaze, 15 casas, RTP 93,33%), Soccer e Door (RTP 98%). 216 jogadas conferidas.
- [x] Chat em tempo real e Chuva (Rain) no servidor (migrações 0005 e 0006, pg_cron divide a chuva a cada minuto).
- [x] VIP Reload dado pelo admin, Tip entre jogadores e Chuva automática de hora em hora (migração 0008).
- [x] KYC com documentos num cofre privado (Supabase Storage), aprovação no admin, saque acima de $2.000 exige KYC; admin credita depósito manualmente (migração 0010).
- [x] Segurança (migração 0018): navegador não consegue gravar em nenhuma tabela/view; só via funções do servidor. vercel.json com CSP, HSTS e bloqueio de iframe.
- [x] Bônus semanal (quinta 12h) e mensal (dia 1, 12h), horário de Brasília (migração 0019).
- [x] Cotações das moedas no servidor (migração 0020, CoinGecko a cada 2 min via pg_net). Saldo continua em dólar; o jogador escolhe a moeda de exibição no cabeçalho.
- [x] Carteira por moeda no servidor (0022) registra de qual cripto veio cada valor; na tela é um saldo só, usado nas apostas (0023). Câmbio fiat para exibição (0021).
- [x] Spill (0024): copo com 25 despejos, derramamentos escondidos por dificuldade (Low 1, Medium 3, High 5, Degen 10), sorteio no servidor, RTP 98%.
- [x] RTP 98% (0025): Dice, Limbo, Crash, Mines, Hi-Lo, Coinflip, Wheel, Plinko, Keno, Roleta e Double em 98%; Blackjack H17 e sem dobrar após dividir (≈99,1% com estratégia perfeita), bloqueio das ações internas deal/peek; VIP ≈0,1% do apostado. Rain: só entra quem apostou US$ 5.000 nos últimos 7 dias. Aplicar no SQL Editor antes de publicar o site.
- [ ] Próxima seed do servidor (0026): o jogador vê o hash da próxima seed antes de trocar o par, como na Shuffle/Stake. Rodar no SQL Editor; o site funciona com ou sem ela.
- [ ] Pump e Cross the Lake (0027) + sem limite de ganho por aposta (max_profit = 0). Rodar no SQL Editor antes de publicar o site com esses jogos.
- [x] Provably fair no modo real: troca de seed revela a server seed (migração 0017). Configurações do admin (lucro máximo, países, licença, prêmio do leaderboard, jogos, promoções) salvas no servidor.
- [x] Resgates no servidor (migração 0016): rakeback, prêmios de nível, bônus diário/semanal/mensal; feed público de apostas recentes. Atenção: se mudar RD.vipTiers ou RD.config.bonuses em data.js, atualize também game_tables (vip_tiers, bonuses).

**Como ligar o modo real:** abra o site com `?live=1` (o navegador lembra a escolha) e com `?live=0` para voltar ao modo demonstração. O admin segue a mesma escolha. Para lançar para todos, troque `LIVE_DEFAULT` para `true` em `assets/js/data.js`.

## Ordem de construção
1. Aplicar a migração e criar a conta de admin.
2. Login e cadastro com convite no site; `RD.db` passa a chamar o Supabase.
3. Edge Function `play` com os jogos de um clique: Dice, Limbo, Coinflip, Plinko, Wheel, Keno, Roulette, Baccarat.
4. Rodadas: Mines, Tower, Chicken, Hi-Lo, Crash, RPS, Blackjack.
5. Caixa com várias moedas, mais o admin lendo do banco.
6. VIP, rakeback, afiliados e leaderboard calculados no servidor.
7. Testes:
   - o saldo bate sempre com depósitos − saques + resultado das apostas;
   - tentativas de trapaça pelo navegador;
   - carga.

## O que o dono precisa configurar
- **Variáveis do ambiente:** `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`. Nunca colar chaves no chat.
- **Acesso à rede:** liberar `supabase.com`, `api.supabase.com` e `*.supabase.co`.
- **Plano Pro antes de entrar dinheiro real:** o plano grátis pausa o projeto quando fica parado.
- **Endereços da Kraken:** moeda, rede, endereço, memo e mínimo de cada um.
