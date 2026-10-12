(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) ? x : 0; };
  const eur = GL.eur;
  const signed = (x) => (x >= 0 ? "+" : "−") + eur(Math.abs(x));

  /* ---------------- État ---------------- */
  const KEY = "grindlab.v1";
  const DEFAULT_SCEN = [
    { on: true, name: "Renégocier le salaire", gross: 150, hours: 0, netRatio: 0.85, aidLoss: 0.25 },
    { on: false, name: "Contrat mieux payé", gross: 300, hours: 0, netRatio: 0.85, aidLoss: 0.25 },
    { on: true, name: "Mission freelance (8 h)", gross: 200, hours: 8, netRatio: 0.78, aidLoss: 0.25 },
    { on: false, name: "Vente à côté (10 h)", gross: 120, hours: 10, netRatio: 0.8, aidLoss: 0.25 },
  ];
  function defaultState() {
    return {
      profile: Object.assign({}, GL.DEFAULT_PROFILE),
      scenarios: DEFAULT_SCEN.map((s) => Object.assign({}, s)),
      invest: { monthly: null, initial: 0, years: 10, low: 2, mid: 5, high: 8, fees: 0.3, infl: 2, target: 10000 },
      wardrobeBudget: null,
      accounts: GL.defaultAccounts(),
      jobs: { type: "cdi", query: "", cities: ["paris"], custom: "", showEmployers: false, targetNet: 2500 },
      body: Object.assign({}, GL.DEFAULT_BODY, { weights: [], rhythm: JSON.parse(JSON.stringify(GL.DEFAULT_RHYTHM)) }),
      prices: { date: "", city: "", data: {} },
      secondHand: false,
      look: Object.assign({}, GL.DEFAULT_LOOK),
      ui: { tab: "home", pyr: "nat", sel: null, workSub: "scen", accSub: "acc", bodySub: "goal", styleSub: "wear", sportWeek: 0, interestNote: "" },
    };
  }
  function merge(raw) {
    const d = defaultState();
    if (!raw || typeof raw !== "object") return d;
    return {
      profile: Object.assign(d.profile, raw.profile, { setup: raw.profile ? raw.profile.setup !== false : false }),
      scenarios: Array.isArray(raw.scenarios) ? raw.scenarios : d.scenarios,
      invest: Object.assign(d.invest, raw.invest),
      wardrobeBudget: typeof raw.wardrobeBudget === "number" ? raw.wardrobeBudget : null,
      accounts: Array.isArray(raw.accounts) && raw.accounts.length ? raw.accounts.map((a) => Object.assign({ history: [], contributed: 0, rate: 0, openDate: "", balance: 0, autoInterest: true, interestLog: [] }, a)) : d.accounts,
      jobs: Object.assign(d.jobs, raw.jobs),
      body: Object.assign(d.body, raw.body, {
        weights: raw.body && Array.isArray(raw.body.weights) ? raw.body.weights : [],
        rhythm: Object.assign(d.body.rhythm, raw.body && raw.body.rhythm),
      }),
      prices: Object.assign(d.prices, raw.prices),
      secondHand: !!raw.secondHand,
      look: Object.assign(d.look, raw.look),
      ui: Object.assign(d.ui, raw.ui),
    };
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return merge(JSON.parse(raw)); } catch (e) { /* ignore */ }
    return defaultState();
  }
  let state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  const view = $("#view");
  const titleEl = $("#title");
  const subEl = $("#subtitle");
  let host = view; // conteneur courant des sous-vues

  function segHtml(items, cur, attr) {
    return '<div class="seg" role="group">' + items.map((it) =>
      "<button " + attr + '="' + it[0] + '" aria-pressed="' + (cur === it[0]) + '">' + esc(it[1]) + "</button>").join("") + "</div>";
  }
  function decodeText(buf) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { return new TextDecoder("windows-1252").decode(buf); }
  }

  /* ---------------- Navigation ---------------- */
  const TABS = {
    home: { title: "Accueil", fn: viewHome },
    accounts: { title: "Comptes", fn: viewAccounts },
    work: { title: "Revenus", fn: viewWork },
    body: { title: "Corps", fn: viewBody },
    style: { title: "Style", fn: viewStyle },
    me: { title: "Moi", fn: viewMe },
  };
  function go(tab) {
    if (!TABS[tab]) tab = "home";
    state.ui.tab = tab; save();
    document.querySelectorAll("#tabs button").forEach((b) => {
      if (b.dataset.tab === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    titleEl.textContent = TABS[tab].title;
    const n = state.profile.name.trim();
    subEl.textContent = tab === "home" ? (n ? "Salut " + n : "Ton tableau de bord") : "";
    host = view;
    TABS[tab].fn();
    window.scrollTo(0, 0);
  }
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b) go(b.dataset.tab);
  });

  /* ---------------- Accueil ---------------- */
  const NAT_INFO = {
    "Pauvres": ["moins de 60 % de la médiane", "chômage, inactivité, petits boulots, peu d'aide familiale"],
    "Modestes": ["60 à 90 % de la médiane", "temps partiel, alternance, CDD enchaînés"],
    "Médians": ["90 à 110 % de la médiane", "salarié en début de carrière, couple"],
    "Plutôt aisés": ["110 à 180 % de la médiane", "CDI qualifié, couple bi-actif, foyer de cadres"],
    "Aisés": ["plus de 180 % de la médiane", "revenus élevés tôt, ou foyer très aisé"],
  };
  const STU_INFO = {
    "Précaires": ["nettement sous la moyenne étudiante", "sans aide familiale ni bourse suffisante, cumul de petits jobs"],
    "Serrés": ["sous la moyenne étudiante", "boursier sans job, aide familiale limitée"],
    "Moyens": ["autour de la moyenne", "aide parentale régulière et petit job, ou alternant en début de grille"],
    "Aisés": ["1,5 à 2 fois la moyenne", "alternant en master, étudiant salarié avec soutien familial"],
    "Très aisés": ["plus de 2 fois la moyenne", "alternant très bien payé, ou salaire plus forte aide familiale"],
  };

  function applyStatus(st) {
    const d = GL.STATUS_DEFAULTS[st];
    state.profile.status = st;
    if (d) { state.jobs.type = d.jobType; state.ui.pyr = d.pyr; state.ui.sel = null; }
    save();
  }
  function statusCard() {
    if (state.profile.status || !state.profile.setup) return "";
    return '<div class="card"><h2>Ta situation</h2><p class="muted">Pour adapter l\'appli (pyramide, offres d\'emploi, planning sportif), dis-nous ce qui te correspond. Tu pourras le changer dans Moi.</p><div class="chips wrap">' +
      Object.entries(GL.STATUSES).map(([k, v]) => '<button class="chip" data-status="' + k + '">' + esc(v) + "</button>").join("") + "</div></div>";
  }
  function interestCard() {
    return state.ui.interestNote ? '<div class="card"><h2>Intérêts crédités</h2><p>' + esc(state.ui.interestNote) + '</p><p class="muted">Estimation ajoutée automatiquement au 31 décembre (taux et solde connus). Corrige le solde si ta banque indique un autre montant.</p><button class="btn alt" data-dismiss-int>OK</button></div>' : "";
  }
  function goalsCard() {
    const b = state.body, p = state.profile;
    const rows = [];
    const t = GL.calorieTarget(b), wk = GL.weeksToTarget(b);
    let phys = "Cible " + GL.nf(t.kcal) + " kcal et " + GL.macroTargets(b, t.kcal).protein + " g de protéines par jour.";
    if (b.goal !== "maintain" && wk) phys = kgf(b.weight) + " vers " + kgf(b.targetWeight) + " (environ " + wk + " semaines). " + phys;
    else if (b.goal === "maintain") phys = "Maintien autour de " + kgf(b.weight) + ". " + phys;
    rows.push(["Physique", phys, "body"]);
    const worth = GL.totalWorth(state.accounts), target = state.invest.target || 0;
    rows.push(["Finances", worth > 0 && target > 0 ? eur(worth) + " suivis sur " + eur(target) + " visés (" + Math.min(100, Math.round((worth / target) * 100)) + " %)." : "Renseigne tes comptes pour suivre ton objectif.", "accounts"]);
    const bud = state.wardrobeBudget == null ? Math.round(GL.budget(p).clothingYear) : state.wardrobeBudget;
    const plan = GL.planWardrobe(GL.catalogFor(p.gender, state.secondHand), p.style, bud);
    rows.push(["Style", plan.rows.length + " pièces prévues pour " + eur(plan.spent) + " sur " + eur(bud) + " de budget.", "style"]);
    return '<div class="card"><h2>Tes objectifs</h2><ul class="list">' + rows.map((r) =>
      '<li><span class="n">' + esc(r[0]) + "<small>" + esc(r[1]) + '</small></span><a class="lk" href="#" data-go="' + r[2] + '">Voir ›</a></li>').join("") + "</ul></div>";
  }
  const kgf = (x) => x.toFixed(1).replace(".", ",") + " kg";

  function viewWelcome() {
    const p = state.profile, b = state.body;
    const f = (id, label, type, val, extra) => '<label class="field"><span>' + label + '</span><input id="' + id + '" type="' + type + '"' + (type === "number" ? ' inputmode="decimal" step="any"' : "") + ' value="' + esc(val) + '"' + (extra || "") + "></label>";
    view.innerHTML = '<div class="card"><h2>Bienvenue</h2><p>Réponds à quelques questions pour adapter GrindLab à ta situation. Tout reste sur ton téléphone et tu pourras tout modifier ensuite.</p></div>' +
      '<div class="card"><h2>Toi</h2>' + f("w_name", "Prénom (facultatif)", "text", "") +
      '<label class="field"><span>Situation</span><select id="w_status">' + optList(GL.STATUSES, "") + "</select></label>" +
      '<label class="field"><span>Genre (pour les vêtements, coupes et le calcul des calories)</span><select id="w_gender">' + optList(GL.GENDERS, "x") + "</select></label>" +
      '<div class="grid3">' + f("w_age", "Âge", "number", "") + f("w_height", "Taille (cm)", "number", "") + f("w_weight", "Poids (kg)", "number", "") + "</div>" +
      f("w_city", "Ville", "text", "") + "</div>" +
      '<div class="card"><h2>Argent</h2>' + f("w_income", "Revenu mensuel net, aides comprises (€)", "number", "") + f("w_rent", "Loyer et charges du logement (€)", "number", "") + "</div>" +
      '<div class="card"><h2>Alimentation et forme</h2><label class="field"><span>Alimentation</span><select id="w_diet">' + optList({ omni: "Omnivore", vege: "Végétarien", vegan: "Vegan" }, "omni") + "</select></label>" +
      '<label class="field"><span>Objectif physique</span><select id="w_goal">' + optList(GL.BODY_GOALS, "maintain") + "</select></label></div>" +
      '<p class="err" id="werr"></p><button class="btn" id="wgo">Commencer</button>' +
      '<p class="muted">GrindLab est un simulateur : estimations et repères généraux, ni conseil financier, ni avis médical. Aucune donnée n\'est envoyée.</p>';
    void p; void b;
    $("#wgo").addEventListener("click", () => {
      const v = (id) => $("#" + id).value, n = (id) => num(v(id));
      const err = (m) => { $("#werr").textContent = m; };
      if (!v("w_status")) return err("Choisis ta situation.");
      const age = n("w_age"), h = n("w_height"), w = n("w_weight");
      if (!(age >= 14 && age <= 100)) return err("Indique ton âge (entre 14 et 100).");
      if (!(h >= 120 && h <= 230)) return err("Indique ta taille en cm (entre 120 et 230).");
      if (!(w >= 30 && w <= 250)) return err("Indique ton poids en kg (entre 30 et 250).");
      if (v("w_income") === "" || n("w_income") < 0) return err("Indique ton revenu mensuel net (0 si aucun).");
      if (v("w_rent") === "" || n("w_rent") < 0) return err("Indique ton loyer (0 si aucun).");
      const st = state.profile, bd = state.body;
      st.name = v("w_name").trim(); st.income = Math.round(n("w_income")); st.rent = Math.round(n("w_rent")); st.otherFixed = 0;
      st.gender = v("w_gender");
      bd.sex = st.gender; bd.age = Math.round(age); bd.height = h; bd.weight = w; bd.targetWeight = w; bd.weights = [];
      bd.diet = v("w_diet"); bd.goal = v("w_goal"); bd.basket = null;
      const city = v("w_city").trim();
      bd.city = city;
      const key = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (GL.CITIES[key]) { state.jobs.cities = [key]; state.jobs.custom = ""; }
      else if (city) { state.jobs.cities = ["custom"]; state.jobs.custom = city; }
      st.setup = true;
      applyStatus(v("w_status"));
      go("home");
    });
  }

  function viewHome() {
    if (!state.profile.setup) return viewWelcome();
    const p = state.profile, b = GL.budget(p);
    const worth = GL.totalWorth(state.accounts);
    const ins = GL.insights(p, state.accounts);
    view.innerHTML =
      '<section class="card hero"><div class="lbl">Reste à vivre</div><div class="big">' + eur(b.rav) + "</div>" +
      '<div class="row"><div><span class="lbl">Effort loyer</span><b>' + (isNaN(b.effort) ? "–" : Math.round(b.effort * 100) + " %") + "</b></div>" +
      '<div><span class="lbl">Épargne</span><b>' + eur(b.savings) + "</b></div>" +
      '<div><span class="lbl">Marge</span><b>' + eur(b.freeAfterSavings) + "</b></div></div></section>" +
      (ins.length ? '<div class="card"><h2>À regarder</h2><ul class="list">' + ins.map((i) =>
        '<li class="t-' + i.tone + '"><span class="n">' + esc(i.text) + "</span></li>").join("") + "</ul></div>" : "") +
      statusCard() + interestCard() + goalsCard() +
      (worth > 0 ? '<div class="card"><h2>Patrimoine suivi</h2><div class="big2">' + eur(worth) + '</div><p class="muted">' + state.accounts.filter((a) => a.balance > 0).map((a) => esc(a.name) + " : " + eur(a.balance)).join(" · ") + "</p></div>" : "") +
      segHtml([["nat", "France"], ["stu", "Étudiants"]], state.ui.pyr, "data-pyr") +
      '<div class="card"><div id="pyr"></div></div><div class="card" id="pyrinfo"></div>' +
      '<div class="card"><h2>Fonds de secours cible</h2><div class="big2">' + eur(b.emergency) +
      '</div><p class="muted">3 mois de loyer, charges et dépenses courantes.</p></div>';
    view.querySelectorAll("button[data-status]").forEach((b) => b.addEventListener("click", () => { applyStatus(b.dataset.status); viewHome(); }));
    view.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.dataset.go); }));
    view.querySelector(".seg").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-pyr]");
      if (!btn) return;
      state.ui.pyr = btn.dataset.pyr; state.ui.sel = null; save(); viewHome();
    });
    $("#pyr").addEventListener("click", (e) => {
      const g = e.target.closest("g[data-i]");
      if (!g) return;
      state.ui.sel = +g.dataset.i; save(); renderPyramid();
    });
    renderPyramid();
  }

  function renderPyramid() {
    const p = state.profile, nat = state.ui.pyr === "nat";
    const bands = nat ? GL.nationalBands(p.median) : GL.STUDENT;
    const cur = GL.bandIndex(p.income, bands);
    if (state.ui.sel == null || state.ui.sel >= bands.length) state.ui.sel = cur;
    const sel = state.ui.sel;
    const cls = ["coral", "coral", "gray", "teal", "teal"];
    const hw = (y) => 40 + ((y - 10) / 270) * 110;
    let svg = '<svg class="pyr" viewBox="0 0 380 292" role="group" aria-label="Pyramide des niveaux de vie">';
    for (let r = 0; r < 5; r++) {
      const i = 4 - r, y0 = 10 + 54 * r, y1 = y0 + 54;
      const a = hw(y0), c = hw(y1);
      const pts = [[190 - a, y0], [190 + a, y0], [190 + c, y1], [190 - c, y1]].map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");
      const range = GL.fmtBand(bands[i][1], bands[i][2]);
      svg += '<g class="' + cls[i] + " " + (i === sel ? "sel" : "dim") + '" data-i="' + i + '" role="button" tabindex="0" aria-label="' + esc(bands[i][0] + ", " + range) + '">' +
        '<polygon points="' + pts + '"/><text x="190" y="' + (y0 + 24) + '" text-anchor="middle">' + esc(bands[i][0]) + "</text>" +
        '<text class="s" x="190" y="' + (y0 + 42) + '" text-anchor="middle">' + esc(range) + "</text>";
      if (i === cur) svg += '<circle class="me" cx="' + (190 + hw(y0 + 27) - 16).toFixed(1) + '" cy="' + (y0 + 27) + '" r="6"/>';
      svg += "</g>";
    }
    svg += "</svg><p class=\"muted\">Touche un niveau. Le point noir, c'est toi.</p>";
    $("#pyr").innerHTML = svg;
    $("#pyr").querySelectorAll("g[data-i]").forEach((g) => g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); state.ui.sel = +g.dataset.i; save(); renderPyramid(); }
    }));

    const name = bands[sel][0], info = (nat ? NAT_INFO : STU_INFO)[name];
    let html = "<h2>" + esc(name) + '</h2><dl class="kv"><dt>Tranche</dt><dd>' + esc(GL.fmtBand(bands[sel][1], bands[sel][2])) + " par mois</dd>" +
      "<dt>Position</dt><dd>" + esc(info[0]) + "</dd><dt>Profil type</dt><dd>" + esc(info[1]) + "</dd>";
    if (sel === cur) html += '<dt>Toi</dt><dd class="me">' + eur(p.income) + " par mois</dd>";
    else if (sel > cur) html += "<dt>Écart</dt><dd>Il te manque " + eur(bands[sel][1] - p.income) + " par mois</dd>";
    else html += "<dt>Toi</dt><dd>Tu as dépassé ce niveau</dd>";
    html += "</dl>" + (nat ? '<p class="muted">Médiane nationale : ' + eur(p.median) + " par mois (Insee 2022). Revenu avant loyer.</p>"
      : '<p class="muted">Seuils indicatifs calés sur le budget moyen étudiant, avant loyer.</p>');
    $("#pyrinfo").innerHTML = html;
  }

  /* ---------------- Comptes ---------------- */
  const TYPE_LABELS = { pea: "PEA", livret: "Livret", other: "Autre" };

  function viewAccounts() {
    view.innerHTML = segHtml([["acc", "Comptes"], ["proj", "Projection"]], state.ui.accSub, "data-sub") + '<div id="sub"></div>';
    host = $("#sub");
    view.querySelector(".seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sub]");
      if (!b) return;
      state.ui.accSub = b.dataset.sub; save(); viewAccounts();
    });
    if (state.ui.accSub === "proj") viewSave(); else viewAccountList();
  }

  function seriesChart(points) {
    const W = 360, H = 170, pl = 48, pr = 8, pt = 10, pb = 24, n = points.length;
    const maxY = Math.max(1, ...points.map((q) => q.total)), minY = Math.min(0, ...points.map((q) => q.total));
    const x = (i) => pl + (W - pl - pr) * (n === 1 ? 0 : i / (n - 1));
    const y = (v) => pt + (H - pt - pb) * (1 - (v - minY) / (maxY - minY || 1));
    let svg = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Évolution du patrimoine suivi">';
    [minY, (minY + maxY) / 2, maxY].forEach((v) => {
      svg += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text x="' + (pl - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + GL.nf(v) + "</text>";
    });
    svg += '<text x="' + pl + '" y="' + (H - 6) + '">' + esc(points[0].date) + '</text><text x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(points[n - 1].date) + "</text>";
    svg += '<polyline fill="none" stroke="var(--c2)" stroke-width="2.5" stroke-linejoin="round" points="' +
      points.map((q, i) => x(i).toFixed(1) + "," + y(q.total).toFixed(1)).join(" ") + '"/>';
    return svg + "</svg>";
  }

  function accCard(a, i) {
    let extra = "";
    if (a.type === "pea") {
      extra = '<div class="grid2"><label class="field"><span>Versements cumulés (€)</span><input type="number" inputmode="decimal" data-k="contributed" value="' + a.contributed + '"></label>' +
        '<label class="field"><span>Date d\'ouverture</span><input type="date" data-k="openDate" value="' + esc(a.openDate || "") + '"></label></div>';
    } else if (a.type === "livret") {
      extra = '<label class="field"><span>Taux (% par an)</span><input type="number" inputmode="decimal" step="0.05" data-k="rate" value="' + a.rate + '"><em>À vérifier : le taux officiel est révisé deux fois par an.</em></label>' +
        '<div class="head" style="margin:6px 0"><label class="switch"><input type="checkbox" data-k="autoInterest" ' + (a.autoInterest !== false ? "checked" : "") + ' aria-label="Intérêts automatiques"><i></i></label><span>Ajouter les intérêts chaque 31 décembre (estimation)</span></div>';
    }
    return '<div class="card acc" data-i="' + i + '"><div class="head">' +
      '<input type="text" data-k="name" value="' + esc(a.name) + '" aria-label="Nom du compte"><span class="tag">' + esc(TYPE_LABELS[a.type] || "Autre") + "</span>" +
      '<button class="x" data-del aria-label="Supprimer">×</button></div>' +
      '<label class="field"><span>Solde actuel (€)</span><input type="number" inputmode="decimal" data-k="balance" value="' + a.balance + '"></label>' + extra +
      '<p class="muted" data-derived></p>' +
      '<label class="btn alt" style="display:block;text-align:center;cursor:pointer">Importer un export CSV<input type="file" accept=".csv,text/csv,text/plain" data-imp hidden></label>' +
      '<div data-impout></div></div>';
  }

  function viewAccountList() {
    host.innerHTML = interestCard() + '<div id="accHero"></div><div id="accList">' + state.accounts.map(accCard).join("") + "</div>" +
      '<div class="grid3"><button class="btn alt" data-add="pea">+ PEA</button><button class="btn alt" data-add="livret">+ Livret</button><button class="btn alt" data-add="other">+ Autre</button></div>' +
      '<div class="card"><h2>Pourquoi pas de connexion directe ?</h2><p class="muted">Les banques et courtiers en ligne (Boursorama, Trade Republic, etc.) n\'offrent pas d\'accès public pour une app perso, et saisir tes identifiants bancaires dans une app non officielle est risqué. GrindLab ne te les demande jamais : tu saisis tes soldes ou tu importes l\'export CSV de ton espace client. Exporte les opérations de ton compte en CSV depuis ton espace client, si ta banque le propose. Si ton fichier n\'est pas reconnu, saisis le solde à la main.</p>' +
      '<p class="muted">Suivi et informations générales uniquement : GrindLab ne recommande aucun placement. Pour choisir des investissements, vois un professionnel agréé.</p></div>';
    const list = $("#accList");
    function onEdit(e) {
      const card = e.target.closest(".acc");
      if (!card || e.target.matches("[data-imp]")) return;
      const a = state.accounts[+card.dataset.i], k = e.target.dataset.k;
      if (!a || !k) return;
      if (k === "autoInterest") { a.autoInterest = e.target.checked; if (a.autoInterest) runInterest(); }
      else if (k === "name" || k === "openDate") a[k] = e.target.value;
      else if (k === "balance") GL.addSnapshot(a, GL.todayISO(), num(e.target.value));
      else a[k] = num(e.target.value);
      save(); updateAccOut();
      if (k === "autoInterest") viewAccountList();
    }
    list.addEventListener("input", onEdit);
    list.addEventListener("click", (e) => {
      if (!e.target.closest("[data-del]")) return;
      const a = state.accounts[+e.target.closest(".acc").dataset.i];
      if (confirm("Supprimer « " + a.name + " » ?")) { state.accounts.splice(+e.target.closest(".acc").dataset.i, 1); save(); viewAccountList(); }
    });
    list.addEventListener("change", (e) => {
      if (!e.target.matches("[data-imp]") || !e.target.files[0]) return;
      const card = e.target.closest(".acc");
      handleAccImport(+card.dataset.i, e.target.files[0], card.querySelector("[data-impout]"));
    });
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-add]");
      if (!b) return;
      state.accounts.push(GL.newAccount(b.dataset.add)); save(); viewAccountList();
    });
    updateAccOut();
  }

  function updateAccOut() {
    const accs = state.accounts, total = GL.totalWorth(accs);
    const sum = (t) => accs.filter((a) => a.type === t).reduce((s, a) => s + (+a.balance || 0), 0);
    const series = GL.netWorthSeries(accs);
    $("#accHero").innerHTML = '<section class="card hero"><div class="lbl">Patrimoine suivi</div><div class="big">' + eur(total) + "</div>" +
      '<div class="row"><div><span class="lbl">Livrets</span><b>' + eur(sum("livret")) + '</b></div><div><span class="lbl">PEA</span><b>' + eur(sum("pea")) + '</b></div><div><span class="lbl">Autres</span><b>' + eur(sum("other")) + "</b></div></div></section>" +
      (series.length >= 2 ? '<div class="card"><h2>Évolution</h2>' + seriesChart(series) + "</div>" : '<p class="muted">Mets à jour tes soldes de temps en temps : chaque saisie ajoute un point à la courbe.</p>');
    accs.forEach((a, i) => {
      const el = $('.acc[data-i="' + i + '"] [data-derived]');
      if (!el) return;
      const lines = [];
      if (a.type === "pea") {
        const s = GL.peaStats(a);
        if (a.contributed > 0) lines.push("Plus-value latente : " + signed(s.gain) + (s.pct != null ? " (" + (s.pct >= 0 ? "+" : "−") + Math.abs(s.pct * 100).toFixed(1).replace(".", ",") + " %)" : ""));
        lines.push("Versements : " + Math.round(s.capUsed * 100) + " % du plafond de " + eur(GL.PEA_CAP));
        if (s.years != null) lines.push("Ouvert depuis " + s.years.toFixed(1).replace(".", ",") + " an(s) (seuil des 5 ans)");
      } else if (a.type === "livret") {
        const s = GL.livretStats(a);
        lines.push("Intérêts annuels estimés : " + eur(s.interest));
        lines.push("Plafond : " + Math.round(s.capUsed * 100) + " % de " + eur(GL.LIVRET_CAP));
        const lg = (a.interestLog || [])[(a.interestLog || []).length - 1];
        if (lg) lines.push("Dernier crédit automatique : +" + lg.amount.toFixed(2).replace(".", ",") + " € le " + lg.date.split("-").reverse().join("/"));
      }
      el.textContent = lines.join(" · ");
    });
  }

  async function handleAccImport(i, file, out) {
    try {
      const r = GL.importAccountCSV(decodeText(await file.arrayBuffer()));
      const a = state.accounts[i];
      let html = '<p class="muted">' + r.count + " opérations lues.</p>";
      if (r.balance != null) html += '<button class="btn alt" data-use="bal">Utiliser le solde ' + eur(r.balance) + (r.balanceDate ? " (" + esc(r.balanceDate) + ")" : "") + "</button>";
      if (a.type === "pea" && r.depositsNet != null) html += '<button class="btn alt" data-use="dep">Utiliser ' + eur(r.depositsNet) + " comme versements nets</button>";
      if (r.balance == null && !(a.type === "pea" && r.depositsNet != null)) html += '<p class="muted">Aucun solde ni versement détecté : saisis-les à la main.</p>';
      out.innerHTML = html;
      out.onclick = (e) => {
        const b = e.target.closest("[data-use]");
        if (!b) return;
        if (b.dataset.use === "bal") GL.addSnapshot(a, r.balanceDate || GL.todayISO(), r.balance);
        else a.contributed = Math.round(r.depositsNet);
        save(); viewAccountList();
      };
    } catch (err) { out.innerHTML = '<p class="err">' + esc(err.message || "Fichier illisible.") + "</p>"; }
  }

  /* ---------------- Revenus : scénarios + emploi ---------------- */
  function viewWork() {
    view.innerHTML = segHtml([["scen", "Scénarios"], ["jobs", "Emploi"]], state.ui.workSub, "data-sub") + '<div id="sub"></div>';
    host = $("#sub");
    view.querySelector(".seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sub]");
      if (!b) return;
      state.ui.workSub = b.dataset.sub; save(); viewWork();
    });
    if (state.ui.workSub === "jobs") viewJobs(); else viewGrind();
  }

  function scenCard(s, i) {
    return '<div class="card scen" data-i="' + i + '"><div class="head">' +
      '<label class="switch"><input type="checkbox" data-k="on" ' + (s.on ? "checked" : "") + ' aria-label="Activer"><i></i></label>' +
      '<input type="text" data-k="name" value="' + esc(s.name) + '" aria-label="Nom du scénario">' +
      '<button class="x" data-del aria-label="Supprimer">×</button></div>' +
      '<div class="grid2"><label class="field"><span>Brut en plus (€/mois)</span><input type="number" inputmode="decimal" data-k="gross" value="' + s.gross + '"></label>' +
      '<label class="field"><span>Heures en plus (/mois)</span><input type="number" inputmode="decimal" data-k="hours" value="' + s.hours + '"></label></div>' +
      '<details><summary>Hypothèses</summary><div class="grid2">' +
      '<label class="field"><span>Part nette (%)</span><input type="number" inputmode="decimal" data-k="netRatio" value="' + Math.round(s.netRatio * 100) + '"></label>' +
      '<label class="field"><span>Perte d\'aides (%)</span><input type="number" inputmode="decimal" data-k="aidLoss" value="' + Math.round(s.aidLoss * 100) + '"></label></div></details>' +
      '<p class="muted" data-gain></p></div>';
  }
  function viewGrind() {
    host.innerHTML = '<p class="muted">Simule des revenus en plus. Le net et la perte d\'aides sont des hypothèses : ajuste-les à ton cas.</p>' +
      '<div id="scens"></div><button class="btn alt" id="addScen">+ Ajouter un scénario</button><div id="grindout"></div>';
    const list = $("#scens");
    list.innerHTML = state.scenarios.map(scenCard).join("");
    function onEdit(e) {
      const card = e.target.closest(".scen");
      if (!card) return;
      const s = state.scenarios[+card.dataset.i], k = e.target.dataset.k;
      if (!s || !k) return;
      if (k === "on") s.on = e.target.checked;
      else if (k === "name") s.name = e.target.value;
      else if (k === "netRatio" || k === "aidLoss") s[k] = Math.min(Math.max(num(e.target.value), 0), 100) / 100;
      else s[k] = Math.max(num(e.target.value), 0);
      save(); updateGrindOut();
    }
    list.addEventListener("input", onEdit);
    list.addEventListener("change", onEdit);
    list.addEventListener("click", (e) => {
      if (!e.target.closest("[data-del]")) return;
      state.scenarios.splice(+e.target.closest(".scen").dataset.i, 1); save(); viewGrind();
    });
    $("#addScen").addEventListener("click", () => {
      state.scenarios.push({ on: true, name: "Nouveau scénario", gross: 100, hours: 5, netRatio: 0.8, aidLoss: 0.25 }); save(); viewGrind();
    });
    updateGrindOut();
  }
  function updateGrindOut() {
    const p = state.profile;
    state.scenarios.forEach((s, i) => {
      const el = $('.scen[data-i="' + i + '"] [data-gain]');
      if (el) { const g = GL.netGain(s); el.textContent = "Gain net : " + eur(g) + " par mois" + (s.hours > 0 ? " · " + eur(g / s.hours) + " par heure" : ""); }
    });
    const act = state.scenarios.filter((s) => s.on), out = $("#grindout");
    if (!act.length) { out.innerHTML = '<div class="card"><p class="muted">Active au moins un scénario.</p></div>'; return; }
    const c = GL.combine(p.income, act, p.median);
    out.innerHTML = '<div class="card hero"><div class="lbl">Gain net cumulé</div><div class="big">+' + eur(c.total) + "</div>" +
      '<div class="row"><div><span class="lbl">Nouveau revenu</span><b>' + eur(c.newIncome) + '</b></div><div><span class="lbl">Heures en plus</span><b>' + Math.round(c.hours) + " h</b></div></div></div>" +
      '<div class="chips"><span class="chip">Étudiants : <b>' + esc(c.studentLevel) + '</b></span><span class="chip">France : <b>' + esc(c.nationalLevel) + "</b></span></div>" +
      (c.overload ? '<p class="warn">' + Math.round(c.hours) + " h en plus par mois : attention à tes études et à ta santé.</p>" : "") +
      '<p class="muted">Les aides (APL, prime d\'activité) baissent quand ton revenu monte.</p>';
  }

  function viewJobs() {
    const j = state.jobs;
    host.innerHTML = '<p class="muted">Des recherches prêtes à ouvrir sur les sites d\'emploi, et des employeurs cibles. Rien n\'est stocké : les liens ouvrent les résultats en direct.</p>' +
      '<div class="card"><h2>Ta recherche</h2>' + segHtml(Object.entries(GL.JOB_TYPES), j.type, "data-jt") +
      '<label class="field"><span>Métier ou mots-clés</span><input type="text" id="jq" value="' + esc(j.query) + '"></label>' +
      '<div class="chips wrap" id="jcities">' + Object.entries(GL.CITIES).map(([k, v]) =>
        '<button class="chip" data-city="' + k + '" aria-pressed="' + (j.cities.indexOf(k) >= 0) + '">' + esc(v) + "</button>").join("") + "</div>" +
      '<label class="field"><span>Autre ville</span><input type="text" id="jcustom" value="' + esc(j.custom || "") + '" placeholder="ex. Lyon, Nantes, Bruxelles"></label>' +
      '<button class="btn alt" id="jemp">' + (j.showEmployers ? "Masquer" : "Voir") + " des exemples d'employeurs (banque, fintech, IT)</button></div>" +
      '<div id="jobout"></div>' +
      '<div class="card"><h2>Si tu décroches…</h2><label class="field"><span>Salaire net visé (€/mois)</span><input type="number" inputmode="decimal" id="jsal" value="' + j.targetNet + '"></label><div id="salout"></div></div>';
    host.querySelector(".seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-jt]");
      if (!b) return;
      j.type = b.dataset.jt; save();
      host.querySelectorAll("button[data-jt]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      updateJobOut();
    });
    $("#jq").addEventListener("input", (e) => { j.query = e.target.value; save(); updateJobOut(); });
    $("#jcities").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-city]");
      if (!b) return;
      const k = b.dataset.city, idx = j.cities.indexOf(k);
      if (idx >= 0) j.cities.splice(idx, 1); else j.cities.push(k);
      b.setAttribute("aria-pressed", idx < 0); save(); updateJobOut();
    });
    $("#jcustom").addEventListener("input", (e) => {
      j.custom = e.target.value.trim();
      const i = j.cities.indexOf("custom");
      if (j.custom && i < 0) j.cities.push("custom"); else if (!j.custom && i >= 0) j.cities.splice(i, 1);
      save(); updateJobOut();
    });
    $("#jemp").addEventListener("click", (e) => { j.showEmployers = !j.showEmployers; e.target.textContent = (j.showEmployers ? "Masquer" : "Voir") + " des exemples d'employeurs (banque, fintech, IT)"; save(); updateJobOut(); });
    $("#jsal").addEventListener("input", (e) => { j.targetNet = num(e.target.value); save(); updateSalOut(); });
    updateJobOut(); updateSalOut();
  }
  function updateJobOut() {
    const j = state.jobs, out = $("#jobout");
    if (!j.cities.length) { out.innerHTML = '<div class="card"><p class="muted">Choisis au moins un lieu.</p></div>'; return; }
    let html = j.query.trim() ? "" : '<p class="warn">Saisis un métier ou des mots-clés ci-dessus (ex. comptable, développeur, infirmier) pour des recherches pertinentes.</p>';
    j.cities.forEach((c) => {
      html += '<div class="card"><h2>' + esc(c === "custom" ? j.custom : GL.CITIES[c]) + '</h2><div class="linkgrid">' + GL.jobLinks(c, j.query, j.type, j.custom).map((l) =>
        '<a class="btn alt" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.name) + "</a>").join("") + "</div></div>";
    });
    const regions = [];
    j.cities.forEach((c) => { const r = GL.REGION_OF_CITY[c]; if (r && regions.indexOf(r) < 0) regions.push(r); });
    (j.showEmployers ? regions : []).forEach((r) => {
      html += '<div class="card"><h2>Employeurs à viser : ' + esc(GL.REGION_LABELS[r]) + '</h2><ul class="list">' +
        GL.EMPLOYERS.filter((e) => e.region === r).map((e) =>
          '<li><span class="n">' + esc(e.name) + "<small>" + esc(e.sector) + '</small></span><a class="lk" href="' + esc(GL.employerLink(e.name, GL.jobQuery(j.query, j.type))) +
          '" target="_blank" rel="noopener noreferrer">Offres ›</a></li>').join("") + "</ul></div>";
    });
    html += '<p class="muted">Liste de départ d\'acteurs connus du secteur, pas une promesse d\'offres : vérifie leurs annonces actuelles. Certains sites ne reprennent pas tous les filtres, complète-les au besoin.</p>';
    out.innerHTML = html;
  }
  function updateSalOut() {
    const p = state.profile, net = state.jobs.targetNet, out = $("#salout");
    if (!(net > 0)) { out.innerHTML = ""; return; }
    out.innerHTML = '<dl class="kv"><dt>France</dt><dd>' + esc(GL.bandFor(net, GL.nationalBands(p.median))) + "</dd><dt>Étudiants</dt><dd>" + esc(GL.bandFor(net, GL.STUDENT)) +
      "</dd><dt>Effort loyer</dt><dd>" + Math.round((p.rent / net) * 100) + " %</dd><dt>Reste à vivre</dt><dd>" + eur(net - p.rent - p.otherFixed) + "</dd><dt>Écart actuel</dt><dd>" + signed(net - p.income) + " par mois</dd></dl>";
  }

  /* ---------------- Épargne (projection) ---------------- */
  function lineChart(series, colors) {
    const W = 360, H = 200, pl = 46, pr = 8, pt = 10, pb = 24;
    const n = series[0].length;
    if (!n) return "";
    const maxY = Math.max(1, ...series.flatMap((s) => s.map((r) => r.real)));
    const x = (i) => pl + (W - pl - pr) * (n === 1 ? 0 : i / (n - 1));
    const y = (v) => pt + (H - pt - pb) * (1 - v / maxY);
    let svg = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Projection de l\'épargne en euros constants">';
    [0, 0.5, 1].forEach((f) => {
      svg += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(maxY * f).toFixed(1) + '" y2="' + y(maxY * f).toFixed(1) + '"/>' +
        '<text x="' + (pl - 6) + '" y="' + (y(maxY * f) + 4).toFixed(1) + '" text-anchor="end">' + GL.nf(maxY * f) + "</text>";
    });
    svg += '<text x="' + pl + '" y="' + (H - 6) + '">an ' + series[0][0].year + '</text><text x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">an ' + series[0][n - 1].year + "</text>";
    series.forEach((s, k) => {
      svg += '<polyline fill="none" stroke="' + colors[k] + '" stroke-width="2.5" stroke-linejoin="round" points="' +
        s.map((r, i) => x(i).toFixed(1) + "," + y(r.real).toFixed(1)).join(" ") + '"/>';
    });
    return svg + "</svg>";
  }
  function viewSave() {
    const b = GL.budget(state.profile), v = state.invest;
    if (v.monthly == null) v.monthly = Math.round(b.savings);
    const f = (label, k, step, hint) => '<label class="field"><span>' + label + '</span><input type="number" inputmode="decimal" step="' + step + '" data-iv="' + k + '" value="' + v[k] + '">' + (hint ? "<em>" + hint + "</em>" : "") + "</label>";
    host.innerHTML = '<div class="card"><h2>Hypothèses</h2><div class="grid2">' + f("Versement (€/mois)", "monthly", 10) + f("Capital de départ (€)", "initial", 100) + "</div>" +
      '<label class="field"><span>Horizon : <b id="yrs">' + v.years + ' ans</b></span><input type="range" min="1" max="40" value="' + v.years + '" data-iv="years"></label>' +
      '<div class="grid3">' + f("Bas (%/an)", "low", 0.5) + f("Central (%/an)", "mid", 0.5) + f("Haut (%/an)", "high", 0.5) + "</div>" +
      '<div class="grid2">' + f("Frais (%/an)", "fees", 0.1) + f("Inflation (%/an)", "infl", 0.5) + "</div>" +
      '<p class="muted">Les rendements sont tes hypothèses, pas des prévisions. Ce n\'est pas un conseil d\'investissement : pour choisir des placements, vois un professionnel agréé.</p></div>' +
      '<div id="saveout"></div>' +
      '<div class="card"><h2>Objectif</h2>' + f("Montant visé (€)", "target", 500) + '<div id="goalout"></div></div>';
    host.querySelectorAll("[data-iv]").forEach((inp) => inp.addEventListener("input", () => {
      v[inp.dataset.iv] = inp.dataset.iv === "years" ? Math.max(1, Math.round(num(inp.value))) : num(inp.value);
      if (inp.dataset.iv === "years") $("#yrs").textContent = v.years + (v.years > 1 ? " ans" : " an");
      save(); updateSaveOut();
    }));
    updateSaveOut();
  }
  function updateSaveOut() {
    const v = state.invest, b = GL.budget(state.profile);
    const rates = [v.low / 100, v.mid / 100, v.high / 100];
    const series = rates.map((r) => GL.project(v.monthly, v.years, r, v.fees / 100, v.infl / 100, v.initial));
    const last = series[1][series[1].length - 1];
    $("#saveout").innerHTML = '<div class="card"><h2>En euros d\'aujourd\'hui</h2>' + lineChart(series, ["var(--c1)", "var(--c2)", "var(--c3)"]) +
      '<div class="legend"><span><i style="background:var(--c1)"></i>Bas</span><span><i style="background:var(--c2)"></i>Central</span><span><i style="background:var(--c3)"></i>Haut</span></div></div>' +
      (last ? '<div class="card"><h2>Scénario central</h2><dl class="kv"><dt>Total versé</dt><dd>' + eur(last.contributed) + "</dd><dt>Valeur finale</dt><dd>" + eur(last.nominal) +
        "</dd><dt>En euros d'aujourd'hui</dt><dd class=\"me\">" + eur(last.real) + "</dd></dl></div>" : "");
    const m = GL.monthsToTarget(v.target, v.monthly, v.mid / 100, v.fees / 100, v.initial);
    $("#goalout").innerHTML = "<p>" + (m === null ? "Objectif non atteint en 60 ans avec ces paramètres." :
      m === 0 ? "Objectif déjà atteint." : "Scénario central : environ " + Math.floor(m / 12) + " an(s) et " + (m % 12) + " mois.") +
      '</p><p class="muted">Fonds de secours cible (3 mois de charges) : ' + eur(b.emergency) + ".</p>";
  }

  /* ---------------- Style ---------------- */
  function viewStyle() {
    view.innerHTML = segHtml([["wear", "Vêtements"], ["cut", "Coupe"]], state.ui.styleSub, "data-sub") + '<div id="sub"></div>';
    host = $("#sub");
    view.querySelector(".seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sub]");
      if (!b) return;
      state.ui.styleSub = b.dataset.sub; save(); viewStyle();
    });
    if (state.ui.styleSub === "cut") viewCut(); else viewWardrobe();
  }
  function viewWardrobe() {
    const p = state.profile, b = GL.budget(p);
    const budget = state.wardrobeBudget == null ? Math.round(b.clothingYear) : state.wardrobeBudget;
    host.innerHTML = '<div class="seg" role="group" aria-label="Style">' + GL.STYLES.map((s) =>
      '<button data-style="' + s + '" aria-pressed="' + (p.style === s) + '">' + GL.STYLE_LABELS[s] + "</button>").join("") + "</div>" +
      '<div class="card"><label class="field"><span>Budget vêtements sur 12 mois (€)</span><input type="number" inputmode="decimal" id="wb" value="' + budget + '">' +
      "<em>Par défaut : " + Math.round(p.clothingPct * 100) + " % de ton revenu annuel. Prix du catalogue : estimations.</em></label></div>" +
      '<div class="card"><div class="head" style="display:flex;align-items:center;gap:10px"><label class="switch"><input type="checkbox" id="sh" ' + (state.secondHand ? "checked" : "") + ' aria-label="Seconde main"><i></i></label><span>Acheter en seconde main (Vinted) : prix estimés à environ 55 % du neuf</span></div></div><div id="styleout"></div>';
    host.querySelector(".seg").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-style]");
      if (!btn) return;
      p.style = btn.dataset.style; save(); viewWardrobe();
    });
    $("#sh").addEventListener("change", (e) => { state.secondHand = e.target.checked; save(); updateStyleOut(); });
    $("#wb").addEventListener("input", (e) => { state.wardrobeBudget = e.target.value === "" ? null : Math.max(num(e.target.value), 0); save(); updateStyleOut(); });
    updateStyleOut();
  }
  function updateStyleOut() {
    const p = state.profile, b = GL.budget(p);
    const budget = state.wardrobeBudget == null ? Math.round(b.clothingYear) : state.wardrobeBudget;
    const plan = GL.planWardrobe(GL.catalogFor(p.gender, state.secondHand), p.style, budget);
    const pct = budget > 0 ? Math.min(100, (plan.spent / budget) * 100) : 0;
    let html = '<div class="card"><h2>Dépensé</h2><div class="big2">' + eur(plan.spent) + ' <span class="muted">sur ' + eur(budget) + '</span></div><div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div></div>';
    if (plan.rows.length) {
      html += '<div class="card"><h2>Quoi acheter, et chez qui</h2><ul class="list">' + plan.rows.map((r) => {
        const brands = GL.brandsFor(r.piece, r.category, r.tier, p.style);
        return '<li><span class="n">' + esc(r.piece) + "<small>" + esc(r.category) + " · " + esc(GL.TIER_LABELS[r.tier]) + (r.essential ? "" : " · optionnel") + "</small>" +
          (brands.length ? '<small class="brands">' + esc(brands.join(" · ")) + "</small>" : "") +
          '<details><summary>Où l\'acheter</summary><div class="linkgrid">' + GL.clothingLinks(r.piece, brands).map((l) =>
            '<a class="btn alt" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.name) + "</a>").join("") + "</div></details>" +
          '</span><span class="p">' + eur(r.price) + '<small class="muted"><br>' + r.cpw.toFixed(2).replace(".", ",") + " € / port</small></span></li>";
      }).join("") + "</ul></div>";
    } else html += '<div class="card"><p class="muted">Budget trop bas pour une première pièce.</p></div>';
    if (plan.postponed.length) html += '<p class="muted">À repousser faute de budget : ' + esc(plan.postponed.join(", ")) + ".</p>";
    html += '<div class="card"><h2>Astuces</h2><p class="muted">Les liens ouvrent une recherche sur Vinted (seconde main) ou sur le neuf : ce ne sont pas des annonces précises, les articles et les prix changent tout le temps. Pense à filtrer ta taille et l\'état. Les marques sont des suggestions sans partenariat.</p></div>';
    $("#styleout").innerHTML = html;
  }

  /* ---------------- Corps : objectif, assiette, courses, sport ---------------- */
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const month = () => new Date().getMonth() + 1;
  const optList = (obj, cur) => Object.keys(obj).map((k) => '<option value="' + k + '"' + (k === cur ? " selected" : "") + ">" + esc(Array.isArray(obj[k]) ? obj[k][1] : obj[k]) + "</option>").join("");

  function viewBody() {
    view.innerHTML = segHtml([["goal", "Objectif"], ["plate", "Assiette"], ["shop", "Courses"], ["sport", "Sport"]], state.ui.bodySub, "data-sub") + '<div id="sub"></div>';
    host = $("#sub");
    view.querySelector(".seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sub]");
      if (!b) return;
      state.ui.bodySub = b.dataset.sub; save(); viewBody();
    });
    ({ goal: viewBodyGoal, plate: viewPlate, shop: viewShop, sport: viewSport }[state.ui.bodySub] || viewBodyGoal)();
  }

  function weightChart(ws) {
    const W = 360, H = 150, pl = 44, pr = 8, pt = 10, pb = 22, n = ws.length;
    const vals = ws.map((w) => w.kg);
    let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mx - mn < 1) { mn -= 0.5; mx += 0.5; }
    const x = (i) => pl + (W - pl - pr) * (n === 1 ? 0.5 : i / (n - 1));
    const y = (v) => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
    let svg = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Évolution du poids">';
    [mn, (mn + mx) / 2, mx].forEach((v) => {
      svg += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v.toFixed(1).replace(".", ",") + "</text>";
    });
    svg += '<text x="' + pl + '" y="' + (H - 5) + '">' + esc(ws[0].date) + '</text><text x="' + (W - pr) + '" y="' + (H - 5) + '" text-anchor="end">' + esc(ws[n - 1].date) + "</text>";
    svg += '<polyline fill="none" stroke="var(--c2)" stroke-width="2.5" stroke-linejoin="round" points="' + ws.map((w, i) => x(i).toFixed(1) + "," + y(w.kg).toFixed(1)).join(" ") + '"/>';
    ws.forEach((w, i) => { svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(w.kg).toFixed(1) + '" r="3" fill="var(--c2)"/>'; });
    return svg + "</svg>";
  }

  function viewBodyGoal() {
    const b = state.body;
    const nf2 = (label, k, step) => '<label class="field"><span>' + label + '</span><input type="number" inputmode="decimal" step="' + step + '" data-b="' + k + '" value="' + b[k] + '"></label>';
    host.innerHTML = '<div id="bodyout"></div>' +
      '<div class="card"><h2>Ton profil</h2>' + segHtml([["m", "Homme"], ["f", "Femme"], ["x", "Autre"]], b.sex, "data-bsex") +
      '<div class="grid3">' + nf2("Âge", "age", 1) + nf2("Taille (cm)", "height", 1) + nf2("Poids (kg)", "weight", 0.1) + "</div>" +
      '<label class="field"><span>Activité</span><select data-bsel="activity">' + optList(GL.ACTIVITY, b.activity) + "</select></label>" +
      '<label class="field"><span>Objectif</span><select data-bsel="goal">' + optList(GL.BODY_GOALS, b.goal) + "</select></label>" +
      '<div class="grid2">' + nf2("Poids visé (kg)", "targetWeight", 0.5) + nf2("Séances par semaine", "sessions", 1) + "</div>" +
      segHtml([["omni", "Omnivore"], ["vege", "Végétarien"], ["vegan", "Vegan"]], b.diet, "data-bdiet") + "</div>" +
      '<div class="card"><h2>Pesée</h2><div class="grid2"><label class="field"><span>Poids du jour (kg)</span><input type="number" inputmode="decimal" step="0.1" id="wnew" value="' + b.weight + '"></label>' +
      '<button class="btn" id="wadd" style="align-self:end">Enregistrer</button></div><div id="wlog"></div></div>' +
      '<p class="muted">Estimations générales (formule de Mifflin-St Jeor, repères de santé publique). Ce n\'est pas un avis médical : en cas de pathologie, de grossesse ou de doute, vois un médecin ou un diététicien. Tes données restent sur cet appareil.</p>';

    const upd = () => { save(); updateBodyOut(); };
    host.querySelectorAll("input[data-b]").forEach((inp) => inp.addEventListener("input", () => {
      const k = inp.dataset.b, v = num(inp.value);
      b[k] = k === "age" ? Math.min(Math.max(v, 14), 100) : k === "sessions" ? Math.min(Math.max(Math.round(v), 0), 14) : Math.max(v, 0);
      upd();
    }));
    host.querySelectorAll("select[data-bsel]").forEach((s) => s.addEventListener("change", () => { b[s.dataset.bsel] = s.value; upd(); }));
    host.querySelectorAll("[data-bsex]").forEach((btn) => btn.addEventListener("click", () => { b.sex = btn.dataset.bsex; state.profile.gender = b.sex; save(); viewBodyGoal(); }));
    host.querySelectorAll("[data-bdiet]").forEach((btn) => btn.addEventListener("click", () => { b.diet = btn.dataset.bdiet; b.basket = null; save(); viewBodyGoal(); }));
    $("#wadd").addEventListener("click", () => {
      const kg = num($("#wnew").value);
      if (kg < 25 || kg > 300) return;
      GL.addWeight(b, GL.todayISO(), kg); save(); viewBodyGoal();
    });
    updateBodyOut();
  }

  function updateBodyOut() {
    const b = state.body, t = GL.calorieTarget(b), m = GL.macroTargets(b, t.kcal), bmiV = GL.bmi(b);
    const wk = GL.weeksToTarget(b), tr = GL.weightTrend(b);
    let goalLine = "";
    if (b.goal === "lose" && b.targetWeight < b.weight && wk) goalLine = "Pour " + kgf(b.weight - b.targetWeight) + " en moins : environ " + wk + " semaines à ce rythme.";
    else if (b.goal === "gain" && b.targetWeight > b.weight && wk) goalLine = "Pour " + kgf(b.targetWeight - b.weight) + " en plus : au mieux " + wk + " semaines (la prise de muscle est souvent plus lente).";
    else if (b.goal !== "maintain") goalLine = "Ton poids visé ne correspond pas à l'objectif choisi.";
    let warn = "";
    if (t.note) warn += '<p class="warn">' + esc(t.note) + "</p>";
    if (t.floorApplied) warn += '<p class="warn">Cible remontée au minimum de sécurité : ne descends pas plus bas sans suivi médical.</p>';
    if (tr) warn += '<p class="' + (tr.tooFast ? "warn" : "muted") + '">Tendance : ' + (tr.perWeek >= 0 ? "+" : "−") + Math.abs(tr.perWeek).toFixed(2).replace(".", ",") + " kg par semaine sur " + Math.round(tr.days) + " jours" + (tr.tooFast ? " : c'est rapide, vise moins de 1 % du poids par semaine." : ".") + "</p>";
    $("#bodyout").innerHTML = '<section class="card hero"><div class="lbl">Cible par jour</div><div class="big">' + GL.nf(t.kcal) + ' kcal</div>' +
      '<div class="row"><div><span class="lbl">Protéines</span><b>' + m.protein + ' g</b></div><div><span class="lbl">Glucides</span><b>' + m.carbs + ' g</b></div><div><span class="lbl">Lipides</span><b>' + m.fat + ' g</b></div></div></section>' +
      '<div class="card"><dl class="kv"><dt>Métabolisme de base</dt><dd>' + GL.nf(t.bmr) + " kcal</dd><dt>Dépense totale</dt><dd>" + GL.nf(t.tdee) + " kcal</dd><dt>Écart choisi</dt><dd>" + (t.delta >= 0 ? "+" : "−") + Math.abs(t.delta) + " kcal par jour</dd>" +
      "<dt>Fibres</dt><dd>" + m.fiber + " g ou plus</dd><dt>Fruits et légumes</dt><dd>5 portions (environ 400 g) ou plus</dd><dt>IMC</dt><dd>" + (bmiV > 0 ? bmiV.toFixed(1).replace(".", ",") + " (" + esc(GL.bmiLabel(bmiV)) + ")" : "–") + "</dd></dl>" +
      (goalLine ? "<p>" + esc(goalLine) + "</p>" : "") + warn + '<p class="muted">L\'IMC est un repère grossier : il ne distingue pas muscle et graisse.</p></div>';
    const wl = $("#wlog");
    if (wl) {
      const ws = b.weights || [];
      wl.innerHTML = ws.length >= 2 ? weightChart(ws.slice(-30)) : '<p class="muted">Enregistre ton poids de temps en temps (une fois par semaine suffit) pour voir la tendance.</p>';
    }
  }

  function viewPlate() {
    const b = state.body, t = GL.calorieTarget(b), m = GL.macroTargets(b, t.kcal);
    if (!b.basket) b.basket = GL.suggestedBasket(b, month(), t.kcal, m.protein);
    save();
    const groups = {};
    host.innerHTML = '<p class="muted">Ton panier d\'une semaine (en grammes). Modifie les quantités : le bilan se met à jour. La base proposée suit ta cible et la saison.</p>' +
      '<button class="btn alt" id="regen">Régénérer une base pour ma cible</button><div id="plateout"></div><div id="plist"></div>' +
      '<div class="card"><h2>Ajouter un aliment</h2><select id="addfood">' + Object.keys(GL.FOOD_CATS).map((c) =>
        '<optgroup label="' + esc(GL.FOOD_CATS[c]) + '">' + GL.FOODS.filter((f) => f.cat === c).map((f) => '<option value="' + f.id + '">' + esc(f.name) + "</option>").join("") + "</optgroup>").join("") +
      '</select><button class="btn alt" id="addbtn">Ajouter</button></div>' +
      '<div class="card"><h2>Échanges simples</h2><ul class="list">' + GL.SWAPS.map((s) => '<li><span class="n">' + esc(s[0]) + "<small>" + esc(s[1]) + "</small></span></li>").join("") + "</ul></div>" +
      '<p class="muted">Valeurs nutritionnelles moyennes (ordre de grandeur, proches des tables Ciqual) et prix indicatifs de grande distribution : ils varient selon le magasin et la saison.</p>';
    void groups;
    const renderList = () => {
      const ids = Object.keys(b.basket).sort((x, y) => GL.FOODS.indexOf(GL.FOOD_BY_ID[x]) - GL.FOODS.indexOf(GL.FOOD_BY_ID[y]));
      $("#plist").innerHTML = '<div class="card"><h2>Panier de la semaine</h2><ul class="list">' + ids.map((id) => {
        const f = GL.FOOD_BY_ID[id];
        return '<li data-id="' + id + '"><span class="n">' + esc(f.name) + "<small>" + esc(GL.FOOD_CATS[f.cat]) + (GL.isFV(f) && GL.inSeason(f, month()) && f.season ? " · de saison" : "") + '</small></span><input type="number" inputmode="numeric" step="50" data-g value="' + b.basket[id] + '" aria-label="Grammes par semaine : ' + esc(f.name) + '"><button class="x" data-del aria-label="Retirer">×</button></li>';
      }).join("") + "</ul></div>";
    };
    $("#plist").addEventListener("input", (e) => {
      const li = e.target.closest("li[data-id]");
      if (!li || !e.target.matches("[data-g]")) return;
      b.basket[li.dataset.id] = Math.max(num(e.target.value), 0); save(); updatePlateOut();
    });
    $("#plist").addEventListener("click", (e) => {
      const li = e.target.closest("li[data-id]");
      if (!li || !e.target.closest("[data-del]")) return;
      delete b.basket[li.dataset.id]; save(); renderList(); updatePlateOut();
    });
    $("#addbtn").addEventListener("click", () => {
      const id = $("#addfood").value;
      if (!(b.basket[id] > 0)) b.basket[id] = 500;
      save(); renderList(); updatePlateOut();
    });
    $("#regen").addEventListener("click", () => {
      const tt = GL.calorieTarget(b);
      b.basket = GL.suggestedBasket(b, month(), tt.kcal, GL.macroTargets(b, tt.kcal).protein); save(); renderList(); updatePlateOut();
    });
    renderList(); updatePlateOut();
  }

  function updatePlateOut() {
    const b = state.body, t = GL.calorieTarget(b), m = GL.macroTargets(b, t.kcal), tot = GL.basketTotals(b.basket, pricesOverride()), d = tot.day;
    const row = (label, v, target, unit, goodHigh) => {
      const pct = target > 0 ? Math.min(100, (v / target) * 100) : 0;
      return '<li><span class="n">' + label + '<div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div></span><span class="p">' + GL.nf(v) + " / " + GL.nf(target) + " " + unit + "</span></li>";
    };
    $("#plateout").innerHTML = '<div class="card"><h2>Bilan par jour (moyenne)</h2><ul class="list">' +
      row("Calories", d.kcal, t.kcal, "kcal") + row("Protéines", d.p, m.protein, "g") + row("Glucides", d.c, m.carbs, "g") + row("Lipides", d.f, m.fat, "g") +
      row("Fibres", d.fib, m.fiber, "g") + row("Fruits et légumes", d.fv, 400, "g") + "</ul>" +
      '<p class="muted">Budget estimé : ' + eur(tot.costWeek) + " par semaine (" + eur(tot.costWeek / 7) + " par jour).</p></div>" +
      '<div class="card"><h2>Ajustements</h2><ul class="list">' + GL.basketAdvice(tot, t, m, b).map((a) => '<li class="t-' + a.tone + '"><span class="n">' + esc(a.text) + "</span></li>").join("") + "</ul></div>";
  }

  const realPrice = (f) => {
    const r = state.prices && state.prices.data && state.prices.data[f.id];
    return r && r.n >= 3 ? r : null;
  };
  function viewShop() {
    const b = state.body, mo = month();
    const season = GL.seasonalProduce(mo);
    const fruits = season.filter((f) => f.cat === "fruit"), vegs = season.filter((f) => f.cat === "veg");
    const chips = (arr) => '<div class="chips wrap">' + arr.map((f) => {
      const r = realPrice(f);
      return '<span class="chip">' + esc(f.name) + " <b>" + (r ? r.median : f.price).toFixed(1).replace(".", ",") + " €/kg</b></span>";
    }).join("") + "</div>";
    let list = '<p class="muted">Génère ton panier dans l\'onglet Assiette pour obtenir la liste de courses.</p>', tools = "";
    const ids = b.basket ? Object.keys(b.basket).filter((id) => b.basket[id] > 0) : [];
    if (ids.length) {
      let total = 0;
      const body = Object.keys(GL.FOOD_CATS).map((c) => {
        const items = GL.FOODS.filter((f) => f.cat === c && b.basket[f.id] > 0);
        if (!items.length) return "";
        return '<h2 class="sep">' + esc(GL.FOOD_CATS[c]) + '</h2><ul class="list">' + items.map((f) => {
          const g = b.basket[f.id], r = realPrice(f), ppk = r ? r.median : f.price;
          total += (g / 1000) * ppk;
          let real = "";
          if (!r) real = '<small class="muted">Prix estimé (pas assez de relevés)</small>';
          else {
            const chains = Object.keys(r.byChain).map((k) => [k, r.byChain[k]]).sort((x, y) => x[1].median - y[1].median);
            real = '<small class="brands">Relevé : ' + r.median.toFixed(2).replace(".", ",") + " €/kg (" + r.n + " relevés " + (r.scope === "local" ? "près de " + esc(b.city) : "en France") + ")" + (chains.length ? " · le moins cher : " + esc(chains[0][0]) + " " + chains[0][1].median.toFixed(2).replace(".", ",") + " €/kg" : "") + "</small>";
          }
          const links = GL.foodSearchLinks(f.name.replace(/\(.*?\)/g, "").trim()).map((l) => '<a class="btn alt" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.name) + "</a>").join("");
          return '<li><details style="flex:1"><summary style="display:flex;justify-content:space-between;gap:10px;color:var(--text);font-size:16px"><span>' + esc(f.name) + '</span><span class="p">' + (g >= 1000 ? (g / 1000).toFixed(1).replace(".", ",") + " kg" : Math.round(g) + " g") + ' <small class="muted">~' + eur((g / 1000) * ppk) + "</small></span></summary>" +
            real + '<div class="linkgrid">' + links + "</div></details></li>";
        }).join("") + "</ul>";
      }).join("");
      list = '<p class="muted">Touche un article pour le chercher chez Lidl, Aldi, Carrefour, Auchan, Leclerc ou Intermarché.</p>' + body + '<p class="big2">' + eur(total) + ' <span class="muted">estimés</span></p>';
      const when = state.prices && state.prices.date ? "Dernière recherche : " + state.prices.date.split("-").reverse().join("/") + "." : "";
      tools = '<div class="card"><h2>Prix réels</h2><p class="muted">Cherche les prix relevés pour tes fruits, légumes et pommes de terre dans Open Prices, une base ouverte alimentée par des contributeurs (tickets et étiquettes). Les sites des enseignes n\'ont pas d\'accès public : les relevés peuvent être rares ou anciens. ' + when + '</p>' +
        '<button class="btn" id="getprices">Chercher les prix réels</button><p class="muted" id="pstatus"></p></div>';
    }
    host.innerHTML = '<div class="card"><h2>De saison en ' + MONTHS[mo - 1] + "</h2>" +
      (fruits.length ? '<p class="muted">Fruits</p>' + chips(fruits) : "") + (vegs.length ? '<p class="muted">Légumes</p>' + chips(vegs) : "") +
      '<p class="muted">De saison, c\'est généralement plus savoureux, moins cher et moins transporté. Prix indicatifs (ou relevés si tu as lancé la recherche).</p></div>' +
      tools + '<div class="card"><h2>Liste de courses</h2>' + list + "</div>" +
      '<div class="card"><h2>Où acheter</h2><label class="field"><span>Ta ville</span><input type="text" id="city" value="' + esc(b.city || "") + '"></label><ul class="list" id="stores"></ul></div>' +
      '<div class="card"><h2>Astuces pour payer moins</h2><ul class="list">' +
      ["Compare toujours le prix au kilo, pas au paquet.", "Prends les fruits et légumes de saison, et les surgelés nature pour le reste.", "Légumineuses, œufs, flocons d'avoine et riz sont parmi les protéines et glucides les moins chers.", "Fais ta liste après avoir regardé ton frigo, et ne va pas faire les courses affamé.", "Cuisine en double le dimanche : tu évites les plats préparés de la semaine.", "L'appli Open Food Facts affiche le Nutri-Score et le niveau de transformation d'un produit en scannant son code-barres."].map((x) => '<li><span class="n">' + esc(x) + "</span></li>").join("") + "</ul></div>";
    const renderStores = () => {
      $("#stores").innerHTML = GL.STORES.map((s) => '<li><span class="n">' + esc(s.name) + ' <span class="tag">' + esc(s.price) + "</span><small>" + esc(s.best) + "</small><small>" + esc(s.note) + '</small></span><a class="lk" href="' + esc(GL.storeLink(s, b.city)) + '" target="_blank" rel="noopener noreferrer">Plan ›</a></li>').join("");
    };
    $("#city").addEventListener("input", (e) => { b.city = e.target.value; save(); renderStores(); });
    renderStores();
    const gp = $("#getprices");
    if (gp) {
      gp.addEventListener("click", () => fetchRealPrices(ids, gp, $("#pstatus")));
      const pr = state.prices || {}, age = pr.date ? (Date.now() - Date.parse(pr.date)) / 86400000 : Infinity;
      if (!autoPricesTried && (age > 7 || (pr.city || "") !== (b.city || ""))) { autoPricesTried = true; fetchRealPrices(ids, gp, $("#pstatus")); }
    }
  }

  let autoPricesTried = false;
  const pricesOverride = () => {
    const o = {};
    const d = (state.prices && state.prices.data) || {};
    Object.keys(d).forEach((id) => { if (d[id] && d[id].n >= 3) o[id] = d[id].median; });
    return o;
  };
  async function fetchJson(url, ms) {
    // Dans l'APK, on passe par le client HTTP natif de Capacitor (pas de blocage CORS).
    const cap = typeof window !== "undefined" && window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.CapacitorHttp) {
      const r = await withTimeout(cap.Plugins.CapacitorHttp.request({ method: "GET", url, headers: { Accept: "application/json" }, responseType: "json" }), ms || 12000);
      if (!r || r.status < 200 || r.status >= 300) throw new Error("HTTP " + (r && r.status));
      return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    }
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms || 12000);
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal, headers: { Accept: "application/json" } } : undefined);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  async function fetchRealPrices(ids, btn, status) {
    const b = state.body, today = GL.todayISO();
    const todo = ids.filter((id) => GL.OP_TAGS[id]);
    if (!todo.length) { status.textContent = "Aucun fruit ni légume dans ton panier."; return; }
    btn.disabled = true;
    const data = {}; let done = 0, fail = 0;
    status.textContent = "Recherche en cours (0/" + todo.length + ")…";
    const queue = todo.slice();
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const local = GL.openPricesUrl(id, b.city, today, 120), wide = GL.openPricesUrl(id, b.city, today, 120, false);
          let r = GL.summarizePrices(await fetchJson(local)), scope = local === wide ? "france" : "local";
          if (r.n < 3 && local !== wide) { r = GL.summarizePrices(await fetchJson(wide)); scope = "france"; }
          data[id] = Object.assign(r, { scope });
        } catch (e) { fail++; }
        done++; status.textContent = "Recherche en cours (" + done + "/" + todo.length + ")…";
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    btn.disabled = false;
    if (fail === todo.length) { status.textContent = "Open Prices est injoignable (hors ligne ou accès bloqué par le navigateur). Réessaie avec du réseau."; return; }
    state.prices = { date: today, city: b.city || "", data }; save();
    if (!(state.ui.tab === "body" && state.ui.bodySub === "shop")) return;
    viewShop();
    const st = $("#pstatus");
    if (st) st.textContent = Object.keys(data).filter((k) => data[k].n >= 3).length + " aliment(s) avec au moins 3 relevés sur " + todo.length + (fail ? " (" + fail + " échec(s) réseau)" : "") + ".";
  }

  function viewSport() {
    const b = state.body, r = b.rhythm, wi = state.ui.sportWeek === 1 ? 1 : 0, av = r.weeks[wi];
    const goalFor = { goal: b.goal };
    host.innerHTML = '<p class="muted">Indique le temps réel dont tu disposes chaque jour pour t\'entraîner. Le programme s\'adapte : séances espacées, durée qui tient dans ton créneau, matériel disponible.</p>' +
      segHtml([["0", "Semaine 1"], ["1", "Semaine 2 (facultative)"]], String(wi), "data-wk") +
      '<div class="card"><h2>Temps dispo par jour</h2><div class="days" id="days">' + GL.DAYS.map((d, i) =>
        '<button data-day="' + i + '" aria-label="' + GL.DAYS_LONG[i] + '"><span>' + d + "</span><b>" + (av[i] ? av[i] + "'" : "–") + "</b></button>").join("") + '</div><p class="muted">Touche un jour pour changer (– = pas dispo). Si ton rythme alterne (entreprise et école, bureau et télétravail, horaires décalés...), remplis la semaine 2.</p>' +
      '<label class="field"><span>Matériel</span><select id="eq">' + optList(GL.EQUIP, r.equip) + '</select></label>' +
      '<label class="field"><span>Niveau</span><select id="lv">' + optList(GL.LEVELS, r.level) + '</select></label>' +
      '<div class="grid2"><label class="field"><span>Sommeil (h par nuit)</span><input type="number" inputmode="decimal" step="0.5" id="sl" value="' + r.sleep + '"></label>' +
      '<label class="field"><span>Séances visées</span><input type="number" inputmode="numeric" id="ns" value="' + b.sessions + '"></label></div></div><div id="planout"></div>' +
      '<div class="card"><h2>Repères</h2><ul class="list">' + GL.TRAINING_RULES.map((x) => '<li><span class="n">' + esc(x) + "</span></li>").join("") + "</ul></div>" +
      '<p class="muted">Programme générique, pas un avis médical ni un coaching personnalisé. Apprends la technique des mouvements de base avant d\'augmenter les charges.</p>';
    void goalFor;
    host.querySelector(".seg").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-wk]");
      if (!btn) return;
      state.ui.sportWeek = +btn.dataset.wk; save(); viewSport();
    });
    $("#days").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-day]");
      if (!btn) return;
      const i = +btn.dataset.day, k = GL.AVAIL_STEPS.indexOf(av[i]);
      av[i] = GL.AVAIL_STEPS[(k + 1) % GL.AVAIL_STEPS.length];
      btn.querySelector("b").textContent = av[i] ? av[i] + "'" : "–";
      save(); updatePlanOut();
    });
    $("#eq").addEventListener("change", (e) => { r.equip = e.target.value; save(); updatePlanOut(); });
    $("#lv").addEventListener("change", (e) => { r.level = e.target.value; save(); updatePlanOut(); });
    $("#sl").addEventListener("input", (e) => { r.sleep = Math.min(Math.max(num(e.target.value), 0), 14); save(); updatePlanOut(); });
    $("#ns").addEventListener("input", (e) => { b.sessions = Math.min(Math.max(Math.round(num(e.target.value)), 1), 5); save(); updatePlanOut(); });
    updatePlanOut();
  }
  function updatePlanOut() {
    const b = state.body, r = b.rhythm, wi = state.ui.sportWeek === 1 ? 1 : 0;
    const plan = GL.planWeek(r.weeks[wi], { sessions: b.sessions, equip: r.equip, level: r.level, sleep: r.sleep, goal: b.goal });
    $("#planout").innerHTML = '<div class="card hero"><div class="lbl">Ta semaine</div><div class="big">' + plan.sessions + " séance" + (plan.sessions > 1 ? "s" : "") + '</div><div class="row"><div><span class="lbl">Force</span><b>' + plan.strengthMin + ' min</b></div><div><span class="lbl">Cardio</span><b>' + plan.cardioMin + ' min</b></div></div></div>' +
      plan.days.map((d) => {
        const head = '<h2>' + GL.DAYS_LONG[d.day] + " · " + esc(d.title) + (d.minutes ? " · " + d.minutes + " min" : "") + "</h2>";
        if (d.kind === "repos") return '<div class="card" style="opacity:.7">' + head + "</div>";
        return '<div class="card">' + head + '<ul class="list">' + d.exercises.map((e) => '<li><span class="n">' + esc(e.name) + '</span><span class="p">' + esc(e.scheme) + "</span></li>").join("") + "</ul></div>";
      }).join("") + plan.notes.map((n) => '<p class="warn">' + esc(n) + "</p>").join("") +
      '<p class="muted">Progression : quand tu réussis toutes les séries au haut de la fourchette, ajoute 2,5 kg ou 1 à 2 répétitions. Échauffement de 5 minutes inclus dans la durée.</p>';
  }

  /* ---------------- Coupe de cheveux (onglet Style) ---------------- */
  const MP_BASE = (typeof window !== "undefined" && window.GL_MP_BASE) || "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/";
  let fmPromise = null;
  function loadFaceMesh() {
    if (fmPromise) return fmPromise;
    fmPromise = new Promise((resolve, reject) => {
      const sc = document.createElement("script");
      sc.src = MP_BASE + "face_mesh.js"; sc.crossOrigin = "anonymous";
      sc.onload = async () => {
        try {
          const fm = new window.FaceMesh({ locateFile: (f) => MP_BASE + f });
          fm.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.5 });
          await fm.initialize();
          resolve(fm);
        } catch (e) { reject(e); }
      };
      sc.onerror = () => reject(new Error("la bibliothèque de détection n'a pas pu être chargée (internet requis)"));
      document.head.appendChild(sc);
    });
    fmPromise.catch(() => { fmPromise = null; });
    return fmPromise;
  }
  async function detectFace(canvas) {
    const fm = await loadFaceMesh();
    return new Promise((resolve, reject) => {
      fm.onResults(resolve);
      fm.send({ image: canvas }).catch(reject);
    });
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(u); reject(new Error("image illisible")); };
      im.src = u;
    });
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("délai dépassé")), ms))]);
  }

  function viewCut() {
    const l = state.look;
    host.innerHTML = '<div class="card"><h2>Scanner mon visage</h2><p class="muted">Selfie de face, cheveux dégagés du front, bonne lumière, expression neutre. La photo est analysée sur ton téléphone et n\'est ni envoyée ni enregistrée. Le premier scan télécharge le modèle de détection (internet requis, quelques Mo).</p>' +
      '<label class="btn" style="display:block;text-align:center;cursor:pointer">Prendre ou choisir un selfie<input type="file" accept="image/*" id="scan" hidden></label>' +
      '<canvas id="scanc" hidden style="width:100%;height:auto;border-radius:12px;margin-top:10px"></canvas><p class="muted" id="scanst"></p></div>' +
      '<div class="card"><h2>Forme de ton visage</h2><div class="chips wrap" id="shapes">' + Object.keys(GL.FACE_SHAPES).map((k) =>
      '<button class="chip" data-shape="' + k + '" aria-pressed="' + (l.shape === k) + '">' + esc(GL.FACE_SHAPES[k].label) + "</button>").join("") + "</div>" +
      '<details><summary>Je ne sais pas : je mesure</summary><p class="muted">Devant un miroir, avec une règle ou un mètre ruban souple, en cm.</p>' +
      '<div class="grid2"><label class="field"><span>Hauteur (racine des cheveux au menton)</span><input type="number" inputmode="decimal" step="0.1" data-m="L" value="' + esc(l.L) + '"></label>' +
      '<label class="field"><span>Front (entre les tempes)</span><input type="number" inputmode="decimal" step="0.1" data-m="F" value="' + esc(l.F) + '"></label>' +
      '<label class="field"><span>Pommettes (largeur max)</span><input type="number" inputmode="decimal" step="0.1" data-m="C" value="' + esc(l.C) + '"></label>' +
      '<label class="field"><span>Mâchoire (aux angles)</span><input type="number" inputmode="decimal" step="0.1" data-m="J" value="' + esc(l.J) + '"></label></div><p class="muted" id="mres"></p></details></div>' +
      '<div class="card"><h2>Tes cheveux</h2>' + segHtml(Object.entries(GL.HAIR_TYPES), l.hairType, "data-ht") +
      segHtml(Object.entries(GL.HAIR_DENSITY), l.density, "data-hd") + segHtml(Object.entries(GL.HAIR_LENGTHS), l.length, "data-hl") + '</div><div id="cutout"></div>';
    const upd = () => { save(); updateCutOut(); };
    const syncShapeUI = () => {
      host.querySelectorAll("button[data-shape]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.shape === l.shape));
      ["L", "F", "C", "J"].forEach((k) => { const i = host.querySelector('input[data-m="' + k + '"]'); if (i) i.value = l[k]; });
    };
    $("#scan").addEventListener("change", async (e) => {
      const file = e.target.files[0], st = $("#scanst"), cv = $("#scanc");
      if (!file) return;
      st.textContent = "Analyse en cours… (au premier scan, le chargement du modèle peut prendre quelques secondes)";
      try {
        const img = await loadImage(file);
        const sc = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
        cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
        const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const res = await withTimeout(detectFace(cv), 90000);
        const lm = res && res.multiFaceLandmarks && res.multiFaceLandmarks[0];
        if (!lm) { cv.hidden = false; st.textContent = "Aucun visage détecté. Reprends un selfie de face, mieux éclairé, ou choisis ta forme à la main."; return; }
        const m = GL.measuresFromLandmarks(lm, cv.width, cv.height);
        ctx.fillStyle = "#ee8a66";
        Object.keys(GL.FACE_PTS).forEach((k) => { ctx.beginPath(); ctx.arc(lm[GL.FACE_PTS[k]].x * cv.width, lm[GL.FACE_PTS[k]].y * cv.height, 4, 0, 6.3); ctx.fill(); });
        cv.hidden = false;
        if (!m || !m.frontal) { st.textContent = "Le visage n'est pas assez de face (tête tournée). Refais un selfie bien droit."; return; }
        l.L = m.L; l.F = m.F; l.C = m.C; l.J = m.J; l.shape = GL.faceShape(m);
        syncShapeUI(); upd();
        st.textContent = "Forme estimée : " + GL.FACE_SHAPES[l.shape].label.toLowerCase() + ". C'est une estimation : vérifie les points orange sur la photo et corrige la forme ci-dessous si besoin.";
      } catch (err) { st.textContent = "Scan impossible : " + (err && err.message ? err.message : "erreur inconnue") + ". Tu peux choisir ta forme à la main."; }
    });
    $("#shapes").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-shape]");
      if (!b) return;
      l.shape = b.dataset.shape;
      host.querySelectorAll("button[data-shape]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      upd();
    });
    host.querySelectorAll("input[data-m]").forEach((inp) => inp.addEventListener("input", () => {
      l[inp.dataset.m] = inp.value;
      const k = GL.faceShape(l), r = $("#mres");
      if (k) {
        l.shape = k; r.textContent = "Résultat : visage " + GL.FACE_SHAPES[k].label.toLowerCase() + ".";
        host.querySelectorAll("button[data-shape]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.shape === k));
      } else r.textContent = "Remplis les 4 mesures.";
      upd();
    }));
    [["data-ht", "hairType"], ["data-hd", "density"], ["data-hl", "length"]].forEach(([attr, key]) => {
      const segs = [...host.querySelectorAll(".seg")].filter((s) => s.querySelector("[" + attr + "]"));
      segs.forEach((seg) => seg.addEventListener("click", (e) => {
        const b = e.target.closest("button[" + attr + "]");
        if (!b) return;
        l[key] = b.getAttribute(attr);
        seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        upd();
      }));
    });
    updateCutOut();
  }
  function updateCutOut() {
    const l = state.look, out = $("#cutout");
    if (!l.shape || !GL.FACE_SHAPES[l.shape]) { out.innerHTML = '<div class="card"><p class="muted">Choisis ta forme de visage pour voir les coupes adaptées.</p></div>'; return; }
    const fsh = GL.FACE_SHAPES[l.shape], cuts = GL.recommendCuts(l.shape, l.hairType, l.length, l.density, state.profile.gender), notes = GL.hairNotes(l.hairType, l.density);
    out.innerHTML = '<div class="card"><h2>Visage ' + esc(fsh.label.toLowerCase()) + '</h2><dl class="kv"><dt>Repère</dt><dd>' + esc(fsh.desc) + "</dd><dt>Objectif</dt><dd>" + esc(fsh.goal) + "</dd><dt>À éviter</dt><dd>" + esc(fsh.avoid) + "</dd>" + (state.profile.gender === "f" ? "" : "<dt>Barbe</dt><dd>" + esc(fsh.beard) + "</dd>") + "</dl></div>" +
      '<div class="card"><h2>Coupes qui te vont</h2>' + (cuts.length ? '<ul class="list">' + cuts.map((c) => {
        const k = GL.cutLinks(c);
        return '<li><span class="n">' + esc(c.name) + "<small>À dire au coiffeur : " + esc(c.how) + '</small></span><span class="p"><a class="lk" href="' + esc(k.images) + '" target="_blank" rel="noopener noreferrer">Photos ›</a><br><a class="lk" href="' + esc(k.pinterest) + '" target="_blank" rel="noopener noreferrer">Pinterest ›</a></span></li>';
      }).join("") + "</ul>" : '<p class="muted">Aucune coupe ne correspond à ces critères, essaie « Peu importe » pour la longueur.</p>') +
      notes.map((n) => '<p class="muted">' + esc(n) + "</p>").join("") + "</div>" +
      '<p class="muted">Ce sont des règles de style courantes, pas une science exacte : tes cheveux, ton style et ton métier comptent autant. Montre des photos à ton coiffeur et demande son avis.</p>';
  }

  /* ---------------- Moi ---------------- */
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (state.ui.tab === "me") viewMe(); });
  const standalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;

  function viewMe() {
    const p = state.profile;
    const f = (label, k, step, val, hint) => '<label class="field"><span>' + label + '</span><input type="number" inputmode="decimal" step="' + step + '" data-p="' + k + '" value="' + val + '">' + (hint ? "<em>" + hint + "</em>" : "") + "</label>";
    let install;
    if (standalone()) install = "<p>L'app est installée sur cet appareil.</p>";
    else if (deferredPrompt) install = '<button class="btn" id="install">Installer l\'app</button>';
    else install = '<p class="muted">iPhone : touche Partager puis « Sur l\'écran d\'accueil ». Android : menu ⋮ puis « Installer l\'application ».</p>';
    view.innerHTML = '<div class="card"><h2>Profil</h2><label class="field"><span>Prénom</span><input type="text" data-p="name" value="' + esc(p.name) + '"></label>' +
      '<label class="field"><span>Genre</span><select id="gender">' + optList(GL.GENDERS, p.gender) + "</select></label>" +
      '<label class="field"><span>Situation</span><select id="status"><option value=""' + (p.status ? "" : " selected") + '>À préciser</option>' + optList(GL.STATUSES, p.status) + "</select></label>" +
      f("Revenu mensuel net, aides comprises (€)", "income", 25, p.income) + '<div class="grid2">' + f("Loyer + charges (€)", "rent", 5, p.rent) + f("Autres charges fixes (€)", "otherFixed", 5, p.otherFixed) + "</div>" +
      f("Courses et dépenses courantes (€)", "essentials", 10, p.essentials, "Estimation modifiable") +
      '<div class="grid2">' + f("Épargne visée (% du revenu)", "savingsRate", 1, Math.round(p.savingsRate * 100)) + f("Vêtements (% du revenu annuel)", "clothingPct", 0.5, +(p.clothingPct * 100).toFixed(1)) + "</div>" +
      f("Niveau de vie médian national (€/mois)", "median", 1, p.median, "Insee 2022 : 2 028 €") + "</div>" +
      '<div class="card"><h2>Importer un relevé bancaire (CSV)</h2><p class="muted">Pour voir tes dépenses par catégorie. Lu et catégorisé sur ton téléphone, rien n\'est envoyé. Pour mettre à jour un compte, passe par l\'onglet Comptes.</p>' +
      '<input type="file" id="csv" accept=".csv,text/csv,text/plain"><div id="csvout"></div></div>' +
      '<div class="card"><h2>Installer</h2>' + install + "</div>" +
      '<div class="card"><h2>Sauvegarde</h2><button class="btn alt" id="exp">Exporter mes données</button>' +
      '<label class="btn alt" style="display:block;text-align:center;cursor:pointer">Restaurer une sauvegarde<input type="file" id="imp" accept=".json,application/json" hidden></label>' +
      '<button class="btn danger" id="reset">Tout réinitialiser</button></div>' +
      '<p class="muted">Tes données restent sur cet appareil. GrindLab ne te demande jamais d\'identifiant bancaire. C\'est un simulateur basé sur des hypothèses modifiables : ni conseil financier, ni prévision.</p>';

    view.querySelectorAll("[data-p]").forEach((inp) => inp.addEventListener("input", () => {
      const k = inp.dataset.p;
      if (k === "name") p.name = inp.value;
      else if (k === "savingsRate") p.savingsRate = Math.min(Math.max(num(inp.value), 0), 100) / 100;
      else if (k === "clothingPct") p.clothingPct = Math.min(Math.max(num(inp.value), 0), 100) / 100;
      else p[k] = Math.max(num(inp.value), 0);
      save();
    }));
    $("#gender").addEventListener("change", (e) => { p.gender = e.target.value; state.body.sex = p.gender; save(); });
    $("#status").addEventListener("change", (e) => { if (e.target.value) applyStatus(e.target.value); else { p.status = ""; save(); } });
    const ib = $("#install");
    if (ib) ib.addEventListener("click", async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; viewMe(); });

    $("#csv").addEventListener("change", async (e) => {
      const file = e.target.files[0], out = $("#csvout");
      if (!file) return;
      try {
        const r = GL.importBank(decodeText(await file.arrayBuffer()));
        const cats = Object.keys(r.avg).sort((a, b) => r.avg[b] - r.avg[a]);
        const maxv = Math.max(1, ...cats.map((c) => r.avg[c]));
        const daily = (r.avg.courses || 0) + (r.avg.restauration || 0) + (r.avg.transport || 0);
        out.innerHTML = '<p class="muted">' + r.count + " opérations sur " + r.months.length + " mois. Dépenses moyennes par mois :</p><ul class=\"list\">" +
          cats.map((c) => '<li><span class="n">' + esc(c) + '<div class="bar"><i style="width:' + ((r.avg[c] / maxv) * 100).toFixed(0) + '%"></i></div></span><span class="p">' + eur(r.avg[c]) + "</span></li>").join("") + "</ul>" +
          (r.avg.logement ? '<button class="btn alt" id="useRent">Utiliser ' + eur(r.avg.logement) + " comme loyer</button>" : "") +
          (daily > 0 ? '<button class="btn alt" id="useDaily">Utiliser ' + eur(daily) + " comme dépenses courantes</button>" : "");
        const apply = (id, key, val) => { const b = $(id); if (b) b.addEventListener("click", () => { p[key] = Math.round(val); save(); const i = $('[data-p="' + key + '"]'); if (i) i.value = p[key]; b.textContent = "Appliqué"; }); };
        apply("#useRent", "rent", r.avg.logement || 0);
        apply("#useDaily", "essentials", daily);
      } catch (err) { out.innerHTML = '<p class="err">' + esc(err.message || "Fichier illisible.") + "</p>"; }
    });

    $("#exp").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "grindlab-sauvegarde.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $("#imp").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try { state = merge(JSON.parse(await file.text())); state.ui.tab = "me"; save(); go("me"); }
      catch (err) { alert("Sauvegarde illisible."); }
    });
    $("#reset").addEventListener("click", () => {
      if (confirm("Effacer toutes tes données sur cet appareil ?")) { state = defaultState(); save(); go("home"); }
    });
  }

  /* ---------------- Démarrage ---------------- */
  function runInterest() {
    const added = GL.applyAllInterest(state.accounts, GL.todayISO());
    if (!added.length) return;
    state.ui.interestNote = added.map((x) => x.name + " : +" + x.amount.toFixed(2).replace(".", ",") + " € (" + x.date.split("-").reverse().join("/") + ")").join(" · ");
    save();
  }
  runInterest();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { const before = state.ui.interestNote; runInterest(); if (state.ui.interestNote !== before && (state.ui.tab === "home" || state.ui.tab === "accounts")) go(state.ui.tab); } });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-dismiss-int]")) return;
    state.ui.interestNote = ""; save(); go(state.ui.tab);
  });
  go(state.ui.tab);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* hors-ligne indisponible */ }));
  }
})();
