(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\- ]/g, " ").replace(/\s+/g, " ").trim();
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
const eur = (x) => Math.round(x).toLocaleString("fr-FR") + " €";
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("délai dépassé")), ms))]);
const KEY = "relook-v1";
const view = $("#view");

const defaults = () => ({ tab: "profile", gender: "x", height: 170, bust: 0, waist: 0, hips: 0, override: "", gabarit: "moyen", hauteur: "moyenne", scan: null,
  kws: [], sel: null, budget: 100, owned: [], bought: [], order: "relevance", chk: { ask: 25, neuf: 60, etat: "bon", mat: "coton", fees: 3 } });
let state = defaults();
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) state = Object.assign(defaults(), s, { chk: Object.assign(defaults().chk, s.chk) }); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

/* ---------- logique ---------- */
function morphology() {
  if (state.override) return state.override;
  const b = state.bust, w = state.waist, h = state.hips;
  if (!(b > 0 && w > 0 && h > 0)) return null;
  if (w >= 0.97 * Math.max(b, h)) return "pomme";
  if (h > b * 1.05) return "poire";
  if (b > h * 1.05) return "inverse";
  if (state.gender === "h") return w <= 0.85 * b ? "inverse" : "rectangle";
  return w <= 0.78 * ((b + h) / 2) ? "sablier" : "rectangle";
}
const morphoKey = () => { const m = morphology(); return m && RL.MORPHO[m] ? m : null; };

function matches() {
  const out = [];
  RL.AESTHETICS.forEach((a) => {
    const hit = [];
    state.kws.forEach((k) => { const n = norm(k); if (n.length >= 3 && a.kw.some((w) => w.length >= 3 && (w.includes(n) || n.includes(w)))) hit.push(k); });
    if (hit.length) out.push({ a, hit });
  });
  return out.sort((x, y) => y.hit.length - x.hit.length);
}
const selected = () => {
  const m = matches();
  const keys = state.sel || m.slice(0, 2).map((x) => x.a.key);
  return keys.map((k) => RL.AESTHETICS.find((a) => a.key === k)).filter(Boolean);
};
const okGender = (p) => !p.g || state.gender === "x" || p.g === state.gender;

function plan() {
  const owned = new Set(state.owned), pool = [], sel = selected();
  RL.BASE.pieces.slice(0, 2).forEach((p) => pool.push({ p, from: RL.BASE.label }));
  const max = Math.max.apply(null, sel.map((a) => a.pieces.length).concat([0]));
  for (let i = 0; i < max; i++) sel.forEach((a) => { if (a.pieces[i]) pool.push({ p: a.pieces[i], from: a.label }); });
  RL.BASE.pieces.slice(2).forEach((p) => pool.push({ p, from: RL.BASE.label }));
  let left = state.budget; const rows = [], later = [];
  pool.filter((r) => okGender(r.p)).forEach((r) => {
    if (owned.has(r.p.id)) return;
    if (r.p.p <= left) { rows.push(r); left -= r.p.p; } else later.push(r.p.n);
  });
  return { rows, later, spent: state.budget - left };
}
const vinted = (q, pmax, order) => "https://www.vinted.fr/catalog?search_text=" + encodeURIComponent(q) + (pmax ? "&price_to=" + Math.round(pmax) : "") + "&order=" + (order || "relevance");

/* ---------- vues ---------- */
const TITLES = { profile: ["Silhouette", "Scan photo ou mesures"], tastes: ["Goûts", "Univers, films, personnages"], looks: ["Looks", "Pièces à chiner sur Vinted"], check: ["Annonce", "Cette pièce est-elle une bonne affaire ?"] };
const seg = (items, cur, attr) => '<div class="seg" role="group">' + items.map(([k, l]) => '<button ' + attr + '="' + k + '" aria-pressed="' + (cur === k) + '">' + l + "</button>").join("") + "</div>";
const confLabel = { hi: "Fiabilité bonne", mid: "Fiabilité moyenne", lo: "Fiabilité faible" };

function viewProfile() {
  view.innerHTML =
    '<div class="card scan"><h2>Scan par photo</h2>' +
    '<p class="muted">Photo en pied, de face, bras légèrement écartés, vêtements près du corps, fond uni, appareil à hauteur de hanches. La photo est analysée sur ton appareil : elle n\'est ni envoyée ni enregistrée.</p>' +
    '<label class="btn" for="ph-cam">Prendre une photo</label><input type="file" id="ph-cam" accept="image/*" capture="user">' +
    '<label class="btn alt" for="ph-file">Choisir une photo</label><input type="file" id="ph-file" accept="image/*">' +
    '<p id="scanst" class="muted"></p><canvas id="cv" hidden></canvas><div id="scanres"></div></div>' +
    '<div class="card"><h2>Toi</h2>' + seg([["f", "Femme"], ["h", "Homme"], ["x", "Neutre"]], state.gender, "data-g") +
    '<label class="field"><span>Taille (cm)</span><input type="number" inputmode="decimal" id="height" value="' + (state.height || "") + '"></label>' +
    '<label class="field"><span>Gabarit ressenti</span><select id="gab">' + [["mince", "Mince"], ["moyen", "Moyen"], ["rond", "Rond / courbes"], ["grande", "Grande taille (XL et +)"]].map(([k, l]) => '<option value="' + k + '"' + (state.gabarit === k ? " selected" : "") + ">" + l + "</option>").join("") + "</select></label>" +
    '<label class="field"><span>Morphologie</span><select id="ovr"><option value="">Calculer avec mes mesures</option>' + Object.keys(RL.MORPHO).map((k) => '<option value="' + k + '"' + (state.override === k ? " selected" : "") + ">" + RL.MORPHO[k].label + "</option>").join("") + "</select><em>Le scan remplit ce champ : corrige-le si le résultat ne te ressemble pas.</em></label></div>" +
    '<details class="card"><summary>Ou saisir mes mesures (cm)</summary><div class="grid2"><label class="field"><span>Poitrine / carrure</span><input type="number" inputmode="decimal" id="bust" value="' + (state.bust || "") + '"></label>' +
    '<label class="field"><span>Taille (le plus étroit)</span><input type="number" inputmode="decimal" id="waist" value="' + (state.waist || "") + '"></label>' +
    '<label class="field"><span>Hanches (le plus large)</span><input type="number" inputmode="decimal" id="hips" value="' + (state.hips || "") + '"></label></div><p class="muted">Mètre horizontal, à même la peau. Utilisé seulement si aucune morphologie n\'est choisie ci-dessus.</p></details>' +
    '<div id="mout"></div>';
  view.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => { state.gender = b.dataset.g; save(); viewProfile(); }));
  [["height", "height"], ["bust", "bust"], ["waist", "waist"], ["hips", "hips"]].forEach(([id, k]) => $("#" + id).addEventListener("input", (e) => { state[k] = num(e.target.value); save(); updM(); }));
  $("#gab").addEventListener("change", (e) => { state.gabarit = e.target.value; save(); updM(); });
  $("#ovr").addEventListener("change", (e) => { state.override = e.target.value; save(); updM(); });
  ["ph-cam", "ph-file"].forEach((id) => $("#" + id).addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onPhoto(f); }));
  if (state.scan) showScan(state.scan);
  updM();
}
function showScan(r) {
  $("#scanres").innerHTML = '<p><span class="conf ' + r.conf + '">' + confLabel[r.conf] + "</span></p>" +
    '<p class="muted">Largeurs de face mesurées — taille / épaules : ' + Math.round(r.ratios.waistShoulders * 100) + " %, hanches / épaules : " + Math.round(r.ratios.hipsShoulders * 100) + " %.</p>" +
    (r.warnings.length ? '<ul class="tips">' + r.warnings.map((w) => '<li class="warn">' + esc(w) + "</li>").join("") + "</ul>" : "") +
    '<button class="btn danger" id="clr">Effacer le résultat du scan</button>';
  $("#clr").addEventListener("click", () => { state.scan = null; state.override = ""; save(); viewProfile(); });
}
async function onPhoto(file) {
  const st = $("#scanst"), cv = $("#cv");
  st.className = "muted"; st.textContent = "Analyse en cours… (au premier usage, le modèle se télécharge : quelques secondes, connexion requise)";
  $("#scanres").innerHTML = "";
  try {
    const r = await withTimeout(Scan.run(file, cv, state.gender), 90000);
    cv.hidden = false;
    state.scan = { morpho: r.morpho, conf: r.conf, warnings: r.warnings, ratios: r.ratios };
    state.override = r.morpho; state.gabarit = r.gabarit; save();
    st.textContent = "Résultat estimé : " + RL.MORPHO[r.morpho].label + ", gabarit « " + r.gabarit + " ». Les traits verts montrent les largeurs mesurées.";
    showScan(state.scan);
    $("#ovr").value = state.override; $("#gab").value = state.gabarit; updM();
  } catch (e) {
    cv.hidden = true; st.className = "err"; st.textContent = "Scan impossible : " + (e && e.message ? e.message : e) + ". Tu peux choisir ta morphologie à la main.";
  }
}
function updM() {
  const m = morphoKey(), M = m && RL.MORPHO[m];
  const h = state.height; state.hauteur = h && h < 160 ? "petite" : h > 178 ? "grande" : "moyenne";
  let html;
  if (!M) html = '<div class="card"><p class="muted">Fais un scan photo, saisis tes mesures ou choisis ta morphologie.</p></div>';
  else html = '<div class="card"><h2>Ta silhouette</h2><div class="big2">' + esc(M.label) + '</div><p class="muted">' + esc(M.desc) + "</p>" +
    '<h2 style="margin-top:12px">À privilégier</h2><ul class="tips">' + M.do.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
    '<h2 style="margin-top:12px">À éviter ou tester avec prudence</h2><ul class="tips">' + M.avoid.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
    '<h2 style="margin-top:12px">Gabarit et taille</h2><p class="muted">' + esc(RL.GABARIT[state.gabarit]) + " " + esc(RL.HAUTEUR[state.hauteur]) + "</p>" +
    '<p class="muted">Repères pour équilibrer les proportions, pas des interdits : le confort et ton goût passent avant. Le scan est une estimation à partir d\'une photo de face.</p></div>';
  $("#mout").innerHTML = html;
}

const SUGG = ["Peaky Blinders", "Matrix", "Harry Potter", "Top Gun", "Ghibli", "Stranger Things", "Barbie", "Dune", "Succession", "Wednesday", "Naruto", "Star Wars", "Nirvana", "Hip-hop", "Friends", "Yellowstone", "Bridgerton", "Indiana Jones"];
function viewTastes() {
  const m = matches();
  view.innerHTML = '<div class="card"><h2>Tes univers</h2><p class="muted">Ajoute des films, séries, personnages, jeux, groupes, époques ou ambiances.</p>' +
    '<div class="row2"><input type="text" id="kw" placeholder="ex. Peaky Blinders, Zelda, années 90…" enterkeyhint="done"><button class="btn" id="add">Ajouter</button></div>' +
    '<div class="chips wrap" id="mine">' + (state.kws.length ? state.kws.map((k, i) => '<button class="chip" data-del="' + i + '" aria-label="Retirer ' + esc(k) + '">' + esc(k) + " ✕</button>").join("") : '<span class="muted">Aucun mot-clé pour l\'instant.</span>') + "</div></div>" +
    '<div class="card"><h2>Idées</h2><div class="chips wrap">' + SUGG.filter((s) => !state.kws.includes(s)).map((s) => '<button class="chip" data-sg="' + esc(s) + '">+ ' + esc(s) + "</button>").join("") + "</div></div>" +
    '<div class="card"><h2>Styles qui te correspondent</h2>' + (m.length ? "<p class=\"muted\">Coche ceux que tu veux mélanger (2 recommandés).</p><ul class=\"list\">" + m.map(({ a, hit }) => {
      const on = selected().some((x) => x.key === a.key);
      return '<li><div class="li-row"><input class="chk" type="checkbox" data-sel="' + a.key + '"' + (on ? " checked" : "") + ' aria-label="' + esc(a.label) + '"><span class="n"><b>' + esc(a.label) + "</b><small>" + esc(a.blurb) + "</small><small>Via : " + esc(hit.join(", ")) + '</small><span class="pal">' + a.pal.map((c) => '<i style="background:' + c + '"></i>').join("") + "</span></span></div></li>";
    }).join("") + "</ul>" : '<p class="muted">Ajoute au moins un mot-clé. Si un univers n\'est pas reconnu, essaie une ambiance (rock, vintage, minimaliste, sport…) ou une époque.</p>') + "</div>";
  const add = (v) => { v = v.trim(); if (v && !state.kws.some((k) => norm(k) === norm(v))) { state.kws.push(v); state.sel = null; save(); } viewTastes(); };
  $("#add").addEventListener("click", () => add($("#kw").value));
  $("#kw").addEventListener("keydown", (e) => { if (e.key === "Enter") add(e.target.value); });
  view.querySelectorAll("[data-sg]").forEach((b) => b.addEventListener("click", () => add(b.dataset.sg)));
  view.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { state.kws.splice(+b.dataset.del, 1); state.sel = null; save(); viewTastes(); }));
  view.querySelectorAll("[data-sel]").forEach((c) => c.addEventListener("change", () => {
    state.sel = Array.from(view.querySelectorAll("[data-sel]")).filter((x) => x.checked).map((x) => x.dataset.sel); save();
  }));
}

function viewLooks() {
  const sel = selected(), M = morphoKey() && RL.MORPHO[morphoKey()];
  const head = '<div class="card"><label class="field"><span>Budget total pour ce relooking (€)</span><input type="number" inputmode="decimal" id="bud" value="' + state.budget + '"><em>Les prix sont des cibles indicatives en seconde main, pas des annonces réelles.</em></label>' +
    seg([["relevance", "Pertinence"], ["newest_first", "Plus récentes"], ["price_low_to_high", "Prix croissant"]], state.order, "data-ord") + "</div>";
  const warn = (!M ? '<p class="warn">Renseigne ta silhouette pour des coupes adaptées.</p>' : "") + (!sel.length ? '<p class="warn">Ajoute des goûts : en attendant, voici le socle intemporel.</p>' : "");
  view.innerHTML = head + warn + '<div id="lout"></div>';
  $("#bud").addEventListener("input", (e) => { state.budget = Math.max(num(e.target.value), 0); save(); updL(); });
  view.querySelectorAll("[data-ord]").forEach((b) => b.addEventListener("click", () => { state.order = b.dataset.ord; save(); viewLooks(); }));
  updL();
}
function updL() {
  const sel = selected(), mk = morphoKey(), M = mk && RL.MORPHO[mk], P = plan();
  const pct = state.budget > 0 ? Math.min(100, P.spent / state.budget * 100) : 0;
  let html = "";
  if (sel.length) html += '<div class="card"><h2>Ton fil conducteur</h2><p><b>' + esc(sel.map((a) => a.label).join(" + ")) + "</b></p>" +
    sel.map((a) => '<p class="muted">' + esc(a.blurb) + '</p><div class="pal">' + a.pal.map((c) => '<i style="background:' + c + '"></i>').join("") + "</div>").join("") +
    '<p class="muted">Pour garder un style cohérent : reste dans cette palette (3 couleurs + 1 neutre) et n\'achète une pièce que si elle se porte avec au moins 3 autres de ta garde-robe.</p></div>';
  html += '<div class="card"><h2>Budget prévu</h2><div class="big2">' + eur(P.spent) + ' <span class="muted">sur ' + eur(state.budget) + '</span></div><div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div></div>';
  if (P.rows.length) {
    html += '<div class="card"><h2>Pièces à chiner</h2><ul class="list">' + P.rows.map(({ p, from }) => {
      const cut = M && M.cut[p.c], br = RL.BRANDS[p.c] || [], done = state.bought.includes(p.id);
      const q2 = cut ? p.q + " " + cut.split(" ").slice(0, 2).join(" ") : p.q;
      return '<li class="' + (done ? "done" : "") + '"><div class="li-row"><input class="chk" type="checkbox" data-buy="' + p.id + '"' + (done ? " checked" : "") + ' aria-label="Acheté"><span class="n">' + esc(p.n) +
        "<small>" + esc(p.c) + " · " + esc(from) + "</small>" +
        (cut ? '<small class="brands">Coupe pour toi : ' + esc(cut) + "</small>" : "") +
        '<details><summary>Chercher sur Vinted</summary><div class="linkgrid">' +
        '<a class="btn alt" target="_blank" rel="noopener noreferrer" href="' + esc(vinted(p.q, p.p * 1.3, state.order)) + '">Pièce (max ' + Math.round(p.p * 1.3) + " €)</a>" +
        (cut ? '<a class="btn alt" target="_blank" rel="noopener noreferrer" href="' + esc(vinted(q2, p.p * 1.3, state.order)) + '">Avec ma coupe</a>' : "") +
        br.slice(0, 2).map((b) => '<a class="btn alt" target="_blank" rel="noopener noreferrer" href="' + esc(vinted(p.q + " " + b, p.p * 1.5, state.order)) + '">' + esc(b) + "</a>").join("") +
        '</div><p class="muted">' + esc(RL.QUALITY[p.c]) + '</p><button class="btn alt" data-own="' + p.id + '">Je l\'ai déjà</button></details></span><span class="p">~' + eur(p.p) + "</span></div></li>";
    }).join("") + "</ul></div>";
  } else html += '<div class="card"><p class="muted">Budget trop bas pour une première pièce.</p></div>';
  if (P.later.length) html += '<p class="muted">À repousser faute de budget : ' + esc(P.later.join(", ")) + ".</p>";
  html += '<div class="card"><h2>Bien acheter sur Vinted</h2><ul class="tips"><li>Les liens ouvrent une recherche filtrée par prix : il ne s\'agit pas d\'annonces précises.</li><li>Ajoute ta taille dans les filtres et demande les mesures à plat du vêtement.</li><li>Fais une offre à −10 à −15 % et groupe plusieurs articles du même vendeur pour économiser des frais d\'envoi.</li><li>Teste l\'annonce dans l\'onglet « Annonce » avant d\'acheter.</li></ul></div>';
  $("#lout").innerHTML = html;
  $("#lout").querySelectorAll("[data-buy]").forEach((c) => c.addEventListener("change", () => { const id = c.dataset.buy; state.bought = c.checked ? state.bought.concat(id) : state.bought.filter((x) => x !== id); save(); c.closest("li").classList.toggle("done", c.checked); }));
  $("#lout").querySelectorAll("[data-own]").forEach((b) => b.addEventListener("click", () => { state.owned.push(b.dataset.own); save(); updL(); }));
}

function viewCheck() {
  const c = state.chk;
  const opt = (arr, cur) => arr.map(([k, l]) => '<option value="' + k + '"' + (cur === k ? " selected" : "") + ">" + l + "</option>").join("");
  view.innerHTML = '<div class="card"><h2>Analyser une annonce</h2><div class="grid2">' +
    '<label class="field"><span>Prix annoncé (€)</span><input type="number" inputmode="decimal" id="c-ask" value="' + c.ask + '"></label>' +
    '<label class="field"><span>Prix neuf estimé (€)</span><input type="number" inputmode="decimal" id="c-neuf" value="' + c.neuf + '"></label>' +
    '<label class="field"><span>État</span><select id="c-etat">' + opt([["neuf", "Neuf avec étiquette"], ["tresbon", "Très bon état"], ["bon", "Bon état"], ["satisfaisant", "Satisfaisant"]], c.etat) + "</select></label>" +
    '<label class="field"><span>Matière</span><select id="c-mat">' + opt([["laine", "Laine / cachemire"], ["cuir", "Cuir"], ["denim", "Denim épais"], ["coton", "Coton"], ["lin", "Lin"], ["melange", "Mélange"], ["synthetique", "Synthétique"]], c.mat) + "</select></label></div>" +
    '<label class="field"><span>Frais (port + protection acheteur, €)</span><input type="number" inputmode="decimal" id="c-fees" value="' + c.fees + '"><em>À modifier selon le total affiché par Vinted avant paiement.</em></label></div><div id="cout"></div>';
  [["c-ask", "ask"], ["c-neuf", "neuf"], ["c-fees", "fees"]].forEach(([id, k]) => $("#" + id).addEventListener("input", (e) => { c[k] = num(e.target.value); save(); updC(); }));
  [["c-etat", "etat"], ["c-mat", "mat"]].forEach(([id, k]) => $("#" + id).addEventListener("change", (e) => { c[k] = e.target.value; save(); updC(); }));
  updC();
}
function updC() {
  const c = state.chk, total = c.ask + c.fees;
  if (!(c.neuf > 0)) { $("#cout").innerHTML = '<div class="card"><p class="muted">Indique le prix neuf pour comparer.</p></div>'; return; }
  const ratio = total / c.neuf, wears = RL.WEARS[c.mat] * RL.STATE[c.etat], cpw = total / Math.max(wears, 1);
  let v, cls;
  if (ratio <= 0.3 || (ratio <= 0.4 && c.etat !== "satisfaisant")) { v = "Très bonne affaire"; cls = "good"; }
  else if (ratio <= 0.55) { v = "Bonne affaire"; cls = "good"; }
  else if (ratio <= 0.75) { v = "Correct : négocie"; cls = "mid"; }
  else { v = "Trop cher : compare avec le neuf ou les soldes"; cls = "bad"; }
  $("#cout").innerHTML = '<div class="card"><div class="verdict ' + cls + '">' + v + '</div><dl class="kv"><dt>Coût total</dt><dd>' + eur(total) + "</dd><dt>Vs neuf</dt><dd>" + Math.round(ratio * 100) + " % du prix neuf</dd><dt>Ports estimés</dt><dd>~" + Math.round(wears) + "</dd><dt>Coût / port</dt><dd class=\"me\">" + cpw.toFixed(2).replace(".", ",") + " €</dd></dl>" +
    (ratio > 0.4 ? '<p class="muted">Offre suggérée : ~' + eur(c.ask * 0.87) + " (−13 %).</p>" : "") +
    '<p class="muted">Estimation indicative : ports et ratios sont des repères, pas des mesures. Vérifie photos, mesures et avis du vendeur.</p></div>';
}

const views = { profile: viewProfile, tastes: viewTastes, looks: viewLooks, check: viewCheck };
function go(t) {
  state.tab = views[t] ? t : "profile"; save();
  $("#title").textContent = TITLES[state.tab][0]; $("#subtitle").textContent = TITLES[state.tab][1];
  document.querySelectorAll("#tabs button").forEach((b) => { if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  views[state.tab](); window.scrollTo(0, 0);
}
$("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) go(b.dataset.tab); });
go(state.tab);
})();
