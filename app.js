(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) ? x : 0; };
  const eur = GL.eur;

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
      ui: { tab: "home", pyr: "nat", sel: null },
    };
  }
  function merge(raw) {
    const d = defaultState();
    if (!raw || typeof raw !== "object") return d;
    return {
      profile: Object.assign(d.profile, raw.profile),
      scenarios: Array.isArray(raw.scenarios) ? raw.scenarios : d.scenarios,
      invest: Object.assign(d.invest, raw.invest),
      wardrobeBudget: typeof raw.wardrobeBudget === "number" ? raw.wardrobeBudget : null,
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

  /* ---------------- Navigation ---------------- */
  const TABS = {
    home: { title: "Accueil", fn: viewHome },
    grind: { title: "Grind", fn: viewGrind },
    save: { title: "Épargne", fn: viewSave },
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

  function viewHome() {
    const p = state.profile, b = GL.budget(p);
    view.innerHTML =
      '<section class="card hero"><div class="lbl">Reste à vivre</div><div class="big">' + eur(b.rav) + "</div>" +
      '<div class="row"><div><span class="lbl">Effort loyer</span><b>' + (isNaN(b.effort) ? "–" : Math.round(b.effort * 100) + " %") + "</b></div>" +
      '<div><span class="lbl">Épargne</span><b>' + eur(b.savings) + "</b></div>" +
      '<div><span class="lbl">Marge</span><b>' + eur(b.freeAfterSavings) + "</b></div></div></section>" +
      (b.effort > 0.33 ? '<p class="warn">Ton loyer dépasse un tiers de ton revenu : c\'est le premier poste à optimiser.</p>' : "") +
      '<div class="seg" role="group" aria-label="Échelle">' +
      '<button data-pyr="nat" aria-pressed="' + (state.ui.pyr === "nat") + '">France</button>' +
      '<button data-pyr="stu" aria-pressed="' + (state.ui.pyr === "stu") + '">Étudiants</button></div>' +
      '<div class="card"><div id="pyr"></div></div><div class="card" id="pyrinfo"></div>' +
      '<div class="card"><h2>Fonds de secours cible</h2><div class="big2">' + eur(b.emergency) +
      '</div><p class="muted">3 mois de loyer, charges et dépenses courantes.</p></div>';
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

  /* ---------------- Grind ---------------- */
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
    view.innerHTML = '<p class="muted">Simule des revenus en plus. Le net et la perte d\'aides sont des hypothèses : ajuste-les à ton cas.</p>' +
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

  /* ---------------- Épargne ---------------- */
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
    view.innerHTML = '<div class="card"><h2>Hypothèses</h2><div class="grid2">' + f("Versement (€/mois)", "monthly", 10) + f("Capital de départ (€)", "initial", 100) + "</div>" +
      '<label class="field"><span>Horizon : <b id="yrs">' + v.years + ' ans</b></span><input type="range" min="1" max="40" value="' + v.years + '" data-iv="years"></label>' +
      '<div class="grid3">' + f("Bas (%/an)", "low", 0.5) + f("Central (%/an)", "mid", 0.5) + f("Haut (%/an)", "high", 0.5) + "</div>" +
      '<div class="grid2">' + f("Frais (%/an)", "fees", 0.1) + f("Inflation (%/an)", "infl", 0.5) + "</div>" +
      '<p class="muted">Les rendements sont tes hypothèses, pas des prévisions. Ce n\'est pas un conseil d\'investissement : pour choisir des placements, vois un professionnel agréé.</p></div>' +
      '<div id="saveout"></div>' +
      '<div class="card"><h2>Objectif</h2>' + f("Montant visé (€)", "target", 500) + '<div id="goalout"></div></div>';
    view.querySelectorAll("[data-iv]").forEach((inp) => inp.addEventListener("input", () => {
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
    const p = state.profile, b = GL.budget(p);
    const budget = state.wardrobeBudget == null ? Math.round(b.clothingYear) : state.wardrobeBudget;
    view.innerHTML = '<div class="seg" role="group" aria-label="Style">' + GL.STYLES.map((s) =>
      '<button data-style="' + s + '" aria-pressed="' + (p.style === s) + '">' + GL.STYLE_LABELS[s] + "</button>").join("") + "</div>" +
      '<div class="card"><label class="field"><span>Budget vêtements sur 12 mois (€)</span><input type="number" inputmode="decimal" id="wb" value="' + budget + '">' +
      "<em>Par défaut : " + Math.round(p.clothingPct * 100) + " % de ton revenu annuel. Prix du catalogue : estimations.</em></label></div><div id=\"styleout\"></div>";
    view.querySelector(".seg").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-style]");
      if (!btn) return;
      p.style = btn.dataset.style; save(); viewStyle();
    });
    $("#wb").addEventListener("input", (e) => { state.wardrobeBudget = e.target.value === "" ? null : Math.max(num(e.target.value), 0); save(); updateStyleOut(); });
    updateStyleOut();
  }
  function updateStyleOut() {
    const p = state.profile, b = GL.budget(p);
    const budget = state.wardrobeBudget == null ? Math.round(b.clothingYear) : state.wardrobeBudget;
    const plan = GL.planWardrobe(GL.CATALOG, p.style, budget);
    const pct = budget > 0 ? Math.min(100, (plan.spent / budget) * 100) : 0;
    let html = '<div class="card"><h2>Dépensé</h2><div class="big2">' + eur(plan.spent) + ' <span class="muted">sur ' + eur(budget) + '</span></div><div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div></div>';
    if (plan.rows.length) {
      html += '<div class="card"><h2>Ta garde-robe</h2><ul class="list">' + plan.rows.map((r) =>
        '<li><span class="n">' + esc(r.piece) + "<small>" + esc(r.category) + " · " + esc(GL.TIER_LABELS[r.tier]) + (r.essential ? "" : " · optionnel") +
        '</small></span><span class="p">' + eur(r.price) + "<small class=\"muted\"><br>" + r.cpw.toFixed(2).replace(".", ",") + " € / port</small></span></li>").join("") + "</ul></div>";
    } else html += '<div class="card"><p class="muted">Budget trop bas pour une première pièce.</p></div>';
    if (plan.postponed.length) html += '<p class="muted">À repousser faute de budget : ' + esc(plan.postponed.join(", ")) + ".</p>";
    $("#styleout").innerHTML = html;
  }

  /* ---------------- Moi ---------------- */
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (state.ui.tab === "me") viewMe(); });
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  function viewMe() {
    const p = state.profile;
    const f = (label, k, step, val, hint) => '<label class="field"><span>' + label + '</span><input type="number" inputmode="decimal" step="' + step + '" data-p="' + k + '" value="' + val + '">' + (hint ? "<em>" + hint + "</em>" : "") + "</label>";
    let install;
    if (standalone()) install = "<p>L'app est installée sur cet appareil.</p>";
    else if (deferredPrompt) install = '<button class="btn" id="install">Installer l\'app</button>';
    else install = '<p class="muted">iPhone : touche Partager puis « Sur l\'écran d\'accueil ». Android : menu ⋮ puis « Installer l\'application ».</p>';
    view.innerHTML = '<div class="card"><h2>Profil</h2><label class="field"><span>Prénom</span><input type="text" data-p="name" value="' + esc(p.name) + '"></label>' +
      f("Revenu mensuel net, aides comprises (€)", "income", 25, p.income) + '<div class="grid2">' + f("Loyer + charges (€)", "rent", 5, p.rent) + f("Autres charges fixes (€)", "otherFixed", 5, p.otherFixed) + "</div>" +
      f("Courses et dépenses courantes (€)", "essentials", 10, p.essentials, "Estimation modifiable") +
      '<div class="grid2">' + f("Épargne visée (% du revenu)", "savingsRate", 1, Math.round(p.savingsRate * 100)) + f("Vêtements (% du revenu annuel)", "clothingPct", 0.5, +(p.clothingPct * 100).toFixed(1)) + "</div>" +
      f("Niveau de vie médian national (€/mois)", "median", 1, p.median, "Insee 2022 : 2 028 €") + "</div>" +
      '<div class="card"><h2>Importer un relevé bancaire (CSV)</h2><p class="muted">Lu et catégorisé sur ton téléphone, rien n\'est envoyé.</p>' +
      '<input type="file" id="csv" accept=".csv,text/csv,text/plain"><div id="csvout"></div></div>' +
      '<div class="card"><h2>Installer</h2>' + install + "</div>" +
      '<div class="card"><h2>Sauvegarde</h2><button class="btn alt" id="exp">Exporter mes données</button>' +
      '<label class="btn alt" style="display:block;text-align:center;cursor:pointer">Restaurer une sauvegarde<input type="file" id="imp" accept=".json,application/json" hidden></label>' +
      '<button class="btn danger" id="reset">Tout réinitialiser</button></div>' +
      '<p class="muted">Tes données restent sur cet appareil. GrindLab est un simulateur basé sur des hypothèses modifiables : ce n\'est ni un conseil financier ni une prévision.</p>';

    view.querySelectorAll("[data-p]").forEach((inp) => inp.addEventListener("input", () => {
      const k = inp.dataset.p;
      if (k === "name") p.name = inp.value;
      else if (k === "savingsRate") p.savingsRate = Math.min(Math.max(num(inp.value), 0), 100) / 100;
      else if (k === "clothingPct") p.clothingPct = Math.min(Math.max(num(inp.value), 0), 100) / 100;
      else p[k] = Math.max(num(inp.value), 0);
      save();
    }));
    const ib = $("#install");
    if (ib) ib.addEventListener("click", async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; viewMe(); });

    $("#csv").addEventListener("change", async (e) => {
      const file = e.target.files[0], out = $("#csvout");
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        let text;
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (err) { text = new TextDecoder("windows-1252").decode(buf); }
        const r = GL.importBank(text);
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
  go(state.ui.tab);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* hors-ligne indisponible */ }));
  }
})();
