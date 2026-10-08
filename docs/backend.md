# Servidor de verdade (Supabase) — plano

**Objetivo:** tirar saldo, contas e sorteio do navegador. Hoje tudo fica no `localStorage` (modo demonstração) e não pode receber dinheiro real.

## Como fica
- **Banco (Postgres no Supabase):** `supabase/migrations/0001_init.sql`.
  - Tabelas: jogadores, seeds, rodadas, apostas, transações, carteiras da casa, convites, configurações e auditoria.
  - Segurança por linha (RLS): o jogador só lê o que é dele, e ninguém altera saldo direto pelo navegador.
- **Login:** Supabase Auth (e-mail e senha).
  - O cadastro exige código de convite enquanto a fase for fechada.
  - O admin é uma conta comum que está na tabela `admins`, com verificação em duas etapas (2FA) ligada.
- **Apostas:** Edge Function `play` (TypeScript/Deno).
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
- [ ] Jogos sorteados no servidor (Edge Function `play`).
- [ ] VIP, rakeback e leaderboard no servidor.

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
