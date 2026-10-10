// NOWPayments: depósito automático (cria o pagamento e confirma pela API) e saque enviado pelo admin.
// Segredos (Supabase → Edge Functions → Secrets): NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET,
// NOWPAYMENTS_EMAIL e NOWPAYMENTS_PASSWORD (só para saques), NOWPAYMENTS_SANDBOX=1 para testar no sandbox.
// O status de um pagamento SEMPRE vem da API da NOWPayments (com a nossa chave), nunca do corpo do aviso (IPN).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY = Deno.env.get("NOWPAYMENTS_API_KEY") || "";
const IPN_SECRET = Deno.env.get("NOWPAYMENTS_IPN_SECRET") || "";
const NP = Deno.env.get("NOWPAYMENTS_SANDBOX") === "1" ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1";
const SELF = URL_ + "/functions/v1/nowpayments";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const fail = (msg: string, status = 400) => json({ error: msg }, status);

async function np(path: string, init: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = { "x-api-key": KEY, "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(NP + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) } });
  const text = await r.text();
  let data: any = null; try { data = JSON.parse(text); } catch { data = { message: text }; }
  if (!r.ok) throw new Error((data && (data.message || data.error)) || "NOWPayments error " + r.status);
  return data;
}

// assinatura do IPN: HMAC-SHA512 do JSON com as chaves em ordem alfabética
function sortDeep(v: any): any { if (Array.isArray(v)) return v.map(sortDeep); if (v && typeof v === "object") return Object.keys(v).sort().reduce((o: any, k) => { o[k] = sortDeep(v[k]); return o; }, {}); return v; }
async function sigOk(body: any, sig: string | null) {
  if (!IPN_SECRET || !sig) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(IPN_SECRET), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(JSON.stringify(sortDeep(body)))));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === sig.toLowerCase();
}

async function settleDeposit(paymentId: string) {
  const p = await np("/payment/" + encodeURIComponent(paymentId));
  const { data, error } = await admin.rpc("np_settle", {
    p_payment_id: String(p.payment_id), p_status: String(p.payment_status), p_pay_amount: Number(p.pay_amount) || 0,
    p_actually_paid: Number(p.actually_paid) || 0, p_data: { pay_currency: p.pay_currency, payin_hash: p.payin_hash || null, outcome_amount: p.outcome_amount || null },
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function settlePayout(batchId: string) {
  const b = await np("/payout/" + encodeURIComponent(batchId));
  const list: any[] = b.withdrawals || [];
  const out: string[] = [];
  for (const w of list) {
    const { data: tx } = await admin.from("transactions").select("id").eq("provider", "nowpayments").eq("provider_id", batchId + ":" + w.id).eq("type", "withdrawal").maybeSingle();
    if (!tx) continue;
    const { data } = await admin.rpc("np_payout_mark", { p_tx: tx.id, p_payout_id: batchId + ":" + w.id, p_status: String(w.status || "").toLowerCase(), p_hash: w.hash || null, p_admin: null });
    out.push(String(data));
  }
  return out;
}

async function currencyOf(coin: string, network: string) {
  const { data } = await admin.from("settings").select("value").eq("key", "np_currencies").maybeSingle();
  return data && data.value ? data.value[coin + "|" + network] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  if (!KEY) return fail("Payments are not configured yet.", 503);
  const url = new URL(req.url);
  let body: any = {}; try { body = await req.json(); } catch { body = {}; }

  // Aviso da NOWPayments (sem login): confere a assinatura e busca o status real na API
  if (url.searchParams.get("ipn") === "1") {
    const signed = await sigOk(body, req.headers.get("x-nowpayments-sig"));
    if (!signed) console.warn("IPN with missing/invalid signature; status will be read from the API anyway");
    try {
      if (body.payment_id) return json({ ok: true, result: await settleDeposit(String(body.payment_id)) });
      if (body.batch_withdrawal_id) return json({ ok: true, result: await settlePayout(String(body.batch_withdrawal_id)) });
      return json({ ok: true, result: "ignored" });
    } catch (e) { console.error("ipn", e); return fail(String((e as Error).message), 500); }
  }

  // Ações do jogador / admin: precisam do login do site
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return fail("Sign in first.", 401);
  const user = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who } = await user.auth.getUser();
  if (!who || !who.user) return fail("Sign in first.", 401);
  const uid = who.user.id;

  try {
    if (body.action === "deposit") {
      const { data: open, error } = await user.rpc("np_deposit_open", { p_coin: String(body.coin || ""), p_network: String(body.network || ""), p_amount: Number(body.amount) || 0 });
      if (error) return fail(error.message);
      const tx = open.tx as number;
      let p: any;
      try {
        p = await np("/payment", { method: "POST", body: JSON.stringify({
          price_amount: Number(open.amount), price_currency: "usd", pay_currency: open.pay_currency,
          order_id: String(tx), order_description: "RDCasino deposit #" + tx, ipn_callback_url: SELF + "?ipn=1",
        }) });
      } catch (e) {
        await admin.rpc("np_deposit_cancel", { p_tx: tx, p_reason: "Could not create payment: " + (e as Error).message });
        return fail("The payment provider is not responding. Try again in a minute.", 502);
      }
      const expires = p.expiration_estimate_date || p.valid_until || null;
      const { error: e2 } = await admin.rpc("np_deposit_attach", { p_tx: tx, p_payment_id: String(p.payment_id), p_address: p.pay_address, p_pay_amount: Number(p.pay_amount), p_extra: p.payin_extra_id || null, p_expires: expires });
      if (e2) return fail(e2.message, 500);
      return json({ id: tx, address: p.pay_address, pay_amount: Number(p.pay_amount), pay_currency: p.pay_currency, memo: p.payin_extra_id || null, expires, amount: Number(open.amount) });
    }

    if (body.action === "check") {
      // o site pergunta enquanto o jogador espera: confirma direto na API (não depende só do aviso)
      const { data: rows } = await admin.from("transactions").select("id, provider_id").eq("user_id", uid).eq("provider", "nowpayments").eq("type", "deposit").eq("status", "awaiting").not("provider_id", "is", null).gte("created_at", new Date(Date.now() - 864e5).toISOString()).limit(5);
      const out: Record<string, string> = {};
      for (const r of rows || []) { try { out[r.id] = await settleDeposit(r.provider_id); } catch (e) { out[r.id] = "error"; } }
      return json({ ok: true, result: out });
    }

    if (body.action === "payout") {
      const { data: isAdm } = await user.rpc("is_admin");
      if (isAdm !== true) return fail("Admins only.", 403);
      const { data: en } = await admin.from("settings").select("value").eq("key", "np_payouts").maybeSingle();
      if (!en || en.value !== true) return fail("NOWPayments payouts are turned off in Settings.");
      const email = Deno.env.get("NOWPAYMENTS_EMAIL"), pass = Deno.env.get("NOWPAYMENTS_PASSWORD");
      if (!email || !pass) return fail("Set NOWPAYMENTS_EMAIL and NOWPAYMENTS_PASSWORD in Supabase secrets.");
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) return fail("Enter the 6-digit 2FA code from your NOWPayments authenticator.");
      const { data: t } = await admin.from("transactions").select("*").eq("id", Number(body.tx)).eq("type", "withdrawal").maybeSingle();
      if (!t || t.status !== "pending") return fail("This withdrawal is not pending.");
      if (t.provider === "nowpayments" && t.provider_id) return fail("This withdrawal was already sent to NOWPayments.");
      const cur = await currencyOf(t.coin, t.network);
      if (!cur) return fail("No NOWPayments currency for " + t.coin + " (" + t.network + ").");
      const est = await np("/estimate?amount=" + encodeURIComponent(t.amount_usd) + "&currency_from=usd&currency_to=" + encodeURIComponent(cur));
      const amount = Number(est.estimated_amount);
      if (!(amount > 0)) return fail("Could not price this withdrawal.");
      const tok = await np("/auth", { method: "POST", body: JSON.stringify({ email, password: pass }) });
      const batch = await np("/payout", { method: "POST", body: JSON.stringify({ ipn_callback_url: SELF + "?ipn=1", withdrawals: [{ address: t.address, currency: cur, amount, ipn_callback_url: SELF + "?ipn=1" }] }) }, tok.token);
      const w = (batch.withdrawals || [])[0];
      await np("/payout/" + encodeURIComponent(batch.id) + "/verify", { method: "POST", body: JSON.stringify({ verification_code: code }) }, tok.token);
      const { data: mark } = await admin.rpc("np_payout_mark", { p_tx: t.id, p_payout_id: batch.id + ":" + (w ? w.id : ""), p_status: "sending", p_hash: null, p_admin: uid });
      return json({ ok: true, result: mark, amount, currency: cur });
    }

    return fail("Unknown action.");
  } catch (e) {
    console.error(body.action, e);
    return fail(String((e as Error).message || e), 500);
  }
});
