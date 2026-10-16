// Simulação do Don Gatto: node tools/gatto-sim.js <giros> <base|hunt|buy|super>  (RTP, frequência de prêmio, giros grátis, maiores prêmios)
const E = require('../assets/js/gatto-engine.js');
const P = require('../assets/js/gatto-engine.js').P;
const eng = E.make(P);
const N = +process.argv[2] || 200000, mode = process.argv[3] || 'base';
const cost = { base: 1, hunt: 3, buy: 100, super: 300 }[mode];
let colB = 0, colF = 0, tot = 0, hits = 0, fsT = 0, big = 0, caps = 0, sq = 0, fsTot = 0, baseOnly = 0, maxw = 0; const buckets = {};
for (let i = 0; i < N; i++) {
  const o = eng.round(Math.random, mode); const w = o.tot / 100;
  o.s.forEach((sp, j) => { if (sp.k) { if (j < o.fs || (o.fs === 0 && (mode==='base'||mode==='hunt') && j===0)) colB += sp.k.p / 100; else colF += sp.k.p / 100; } });
  tot += w; sq += w * w; if (w > 0) hits++; if (o.s.length > 1 || mode === 'buy' || mode === 'super') { fsT++; } if (o.cap) caps++; if (w > maxw) maxw = w;
  if (mode === 'base' || mode === 'hunt') { baseOnly += o.s[0].w / 100; if (o.s.length > 1) fsTot += w - o.s[0].w / 100; }
  const b = w === 0 ? '0' : w < 1 ? '<1' : w < 5 ? '1-5' : w < 20 ? '5-20' : w < 100 ? '20-100' : w < 1000 ? '100-1k' : '1k+'; buckets[b] = (buckets[b] || 0) + 1;
}
const rtp = tot / N / cost, sd = Math.sqrt(sq / N - (tot / N) ** 2) / cost;
console.log(mode, 'N', N, 'RTP', (rtp * 100).toFixed(2) + '%', '±', (196 * sd / Math.sqrt(N)).toFixed(2), 'hit', (hits / N * 100).toFixed(1) + '%', 'FS 1/', (N / fsT).toFixed(0), 'caps', caps, 'max', maxw.toFixed(0) + 'x');
if (mode === 'base' || mode === 'hunt') console.log(' base part', (baseOnly / N / cost * 100).toFixed(2) + '%', 'fs part', (fsTot / N / cost * 100).toFixed(2) + '%', 'avg fs', (fsTot / Math.max(1, fsT)).toFixed(1) + 'x');
console.log('  collect base', (colB / N / cost * 100).toFixed(2) + '%', 'collect fs', (colF / N / cost * 100).toFixed(2) + '%');
console.log(' ', JSON.stringify(Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, (v / N * 100).toFixed(2) + '%']))));
