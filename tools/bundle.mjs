// Empacota o site: junta e compacta JS e CSS em assets/dist/ com o hash no nome (cache eterno, sem ?v= manual)
// e atualiza o index.html entre os marcadores <!-- bundle:... -->. Rode depois de mudar qualquer arquivo em assets/js ou assets/css.
import { transform } from "esbuild";
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from "fs";
import { createHash } from "crypto";
const root = new URL("../", import.meta.url).pathname, rd = (f) => readFileSync(root + f, "utf8");
const JS = ["assets/js/icons.js", "assets/js/data.js", "assets/js/art.js", "assets/js/store.js", "assets/js/remote.js", "assets/js/app.js"];
const CSS = ["assets/fonts/fonts.css", "assets/css/base.css", "assets/css/app.css"];
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);

let js = rd("assets/vendor/supabase-2.45.4.js") + "\n;";
for (const f of JS) js += "\n" + (await transform(rd(f), { loader: "js", minify: true, target: "es2017", legalComments: "none" })).code + ";";
let css = "";
for (const f of CSS) css += (await transform(rd(f).replace(/url\((?!["']?(data:|https?:|\/))["']?([^)"']+)["']?\)/g, (m, p, u) => f.startsWith("assets/fonts/") ? "url(../fonts/" + u + ")" : m), { loader: "css", minify: true })).code;

mkdirSync(root + "assets/dist", { recursive: true });
for (const f of readdirSync(root + "assets/dist")) unlinkSync(root + "assets/dist/" + f);
const jsName = "site." + hash(js) + ".js", cssName = "site." + hash(css) + ".css";
writeFileSync(root + "assets/dist/" + jsName, js); writeFileSync(root + "assets/dist/" + cssName, css);

let html = rd("index.html");
html = html.replace(/<!-- bundle:css -->[\s\S]*?<!-- \/bundle:css -->/, '<!-- bundle:css -->\n<link rel="stylesheet" href="assets/dist/' + cssName + '">\n<!-- /bundle:css -->');
html = html.replace(/<!-- bundle:js -->[\s\S]*?<!-- \/bundle:js -->/, '<!-- bundle:js -->\n<script src="assets/dist/' + jsName + '"></script>\n<!-- /bundle:js -->');
writeFileSync(root + "index.html", html);
// admin: usa os arquivos-fonte; o ?v= vira o hash deles para o navegador nunca usar uma versão velha
const admin = rd("admin/index.html"), adminV = hash(["assets/css/base.css", "assets/css/admin.css", "assets/fonts/fonts.css", "admin/boot.js", ...JS, "assets/js/admin.js"].map(rd).join("\n"));
writeFileSync(root + "admin/index.html", admin.replace(/\?v=[A-Za-z0-9]+/g, "?v=" + adminV));
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + " KB";
console.log("JS ", jsName, kb(js), "| CSS", cssName, kb(css));
