/* GrindLab : logique métier. Simulation basée sur des hypothèses modifiables,
   ni conseil financier ni prévision. Fonctionne dans le navigateur et sous Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GL = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MEDIAN = 2028;

  const NATIONAL = [
    ["Pauvres", 0, 0.6], ["Modestes", 0.6, 0.9], ["Médians", 0.9, 1.1],
    ["Plutôt aisés", 1.1, 1.8], ["Aisés", 1.8, Infinity],
  ];
  const STUDENT = [
    ["Précaires", 0, 700], ["Serrés", 700, 1000], ["Moyens", 1000, 1500],
    ["Aisés", 1500, 2000], ["Très aisés", 2000, Infinity],
  ];
  const STYLES = ["business", "smartcasual", "streetwear"];
  const STYLE_LABELS = { business: "Business", smartcasual: "Smart casual", streetwear: "Streetwear" };

  function nationalBands(median) {
    const m = median || MEDIAN;
    return NATIONAL.map(([n, lo, hi]) => [n, lo * m, hi * m]);
  }
  function bandFor(v, bands) {
    v = Math.max(v, 0);
    for (const [n, lo, hi] of bands) if (lo <= v && v < hi) return n;
    return bands[bands.length - 1][0];
  }
  function bandIndex(v, bands) {
    v = Math.max(v, 0);
    for (let i = 0; i < bands.length; i++) if (bands[i][1] <= v && v < bands[i][2]) return i;
    return bands.length - 1;
  }
  function nextBand(v, bands) {
    v = Math.max(v, 0);
    const i = bandIndex(v, bands);
    if (i + 1 < bands.length) return { name: bands[i + 1][0], gap: bands[i + 1][1] - v };
    return null;
  }
  function nf(x) {
    return Math.round(x).toLocaleString("fr-FR").replace(/[  ]/g, " ");
  }
  function eur(x) { return nf(x) + " €"; }
  function fmtBand(lo, hi) {
    if (lo <= 0) return "< " + nf(hi) + " €";
    if (hi === Infinity) return "> " + nf(lo) + " €";
    return nf(lo) + " à " + nf(hi) + " €";
  }

  const DEFAULT_PROFILE = {
    name: "", status: "", gender: "x", setup: false, income: 1700, rent: 675, otherFixed: 0, essentials: 350,
    savingsRate: 0.10, style: "smartcasual", clothingPct: 0.04, median: MEDIAN,
  };

  function budget(p) {
    const rav = p.income - p.rent - p.otherFixed;
    return {
      rav,
      effort: p.income > 0 ? p.rent / p.income : NaN,
      savings: p.income * p.savingsRate,
      freeAfterSavings: rav - p.essentials - p.income * p.savingsRate,
      emergency: 3 * (p.rent + p.otherFixed + p.essentials),
      clothingYear: p.income * 12 * p.clothingPct,
    };
  }

  /* ---- Scénarios de revenu ---- */
  const HOURS_WARNING = 40;
  function netGain(s) { return s.gross * s.netRatio * (1 - s.aidLoss); }
  function combine(income, scenarios, median) {
    const total = scenarios.reduce((a, s) => a + netGain(s), 0);
    const hours = scenarios.reduce((a, s) => a + s.hours, 0);
    const ni = income + total;
    return {
      total, hours, newIncome: ni,
      studentLevel: bandFor(ni, STUDENT),
      nationalLevel: bandFor(ni, nationalBands(median)),
      overload: hours > HOURS_WARNING,
    };
  }

  /* ---- Projection d'épargne ---- */
  function project(monthly, years, annualReturn, fees, inflation, initial) {
    fees = fees || 0; inflation = inflation || 0; initial = initial || 0;
    const net = annualReturn - fees;
    const m = net > -1 ? Math.pow(1 + net, 1 / 12) - 1 : -1;
    let bal = initial, contributed = initial;
    const rows = [];
    for (let month = 1; month <= Math.floor(years * 12); month++) {
      bal = bal * (1 + m) + monthly;
      contributed += monthly;
      if (month % 12 === 0) {
        const y = month / 12;
        rows.push({ year: y, contributed, nominal: bal, real: bal / Math.pow(1 + inflation, y) });
      }
    }
    return rows;
  }
  function monthsToTarget(target, monthly, annualReturn, fees, initial, maxYears) {
    fees = fees || 0; initial = initial || 0; maxYears = maxYears || 60;
    const net = annualReturn - fees;
    const m = net > -1 ? Math.pow(1 + net, 1 / 12) - 1 : -1;
    let bal = initial;
    if (bal >= target) return 0;
    for (let month = 1; month <= maxYears * 12; month++) {
      bal = bal * (1 + m) + monthly;
      if (bal >= target) return month;
    }
    return null;
  }

  /* ---- Garde-robe ---- */
  const TIERS = ["low", "mid", "high"];
  const TIER_LABELS = { low: "Entrée de gamme", mid: "Milieu de gamme", high: "Haut de gamme" };
  const TIER_LIFESPAN = { low: 1.0, mid: 1.6, high: 2.2 };
  // [item, category, style, essential, low, mid, high, wears/an, durée de vie (ans)]
  const CATALOG = [
    ["T-shirts basiques (x5)", "haut", "all", 1, 25, 50, 100, 120, 1.5],
    ["Chaussettes (x7)", "accessoire", "all", 1, 10, 20, 40, 150, 1],
    ["Jean brut sombre", "bas", "all", 1, 35, 70, 150, 80, 2.5],
    ["Baskets blanches en cuir", "chaussures", "all", 1, 50, 90, 180, 100, 2],
    ["Montre sobre", "accessoire", "all", 0, 40, 120, 400, 150, 8],
    ["Sacoche ou sac en cuir", "accessoire", "all", 0, 40, 90, 250, 150, 5],
    ["Chemise oxford blanche", "haut", "business", 1, 25, 45, 90, 80, 2.5],
    ["Chemise bleu ciel", "haut", "business", 1, 25, 45, 90, 70, 2.5],
    ["Pantalon de costume", "bas", "business", 1, 40, 90, 200, 70, 3],
    ["Blazer bleu marine", "veste", "business", 1, 70, 150, 350, 60, 4],
    ["Costume bleu marine", "costume", "business", 0, 120, 250, 600, 40, 4],
    ["Derbies en cuir", "chaussures", "business", 1, 60, 130, 300, 100, 4],
    ["Ceinture en cuir", "accessoire", "business", 1, 15, 35, 80, 100, 4],
    ["Cravate unie", "accessoire", "business", 0, 15, 35, 80, 30, 4],
    ["Manteau en laine", "veste", "business", 1, 80, 180, 400, 60, 5],
    ["Pull en maille fine", "haut", "smartcasual", 1, 25, 50, 120, 60, 3],
    ["Chino beige", "bas", "smartcasual", 1, 30, 55, 110, 70, 2.5],
    ["Chemise oxford", "haut", "smartcasual", 1, 25, 45, 90, 70, 2.5],
    ["Blazer décontracté", "veste", "smartcasual", 0, 70, 150, 350, 50, 4],
    ["Bottines ou derbies en daim", "chaussures", "smartcasual", 0, 60, 130, 300, 80, 4],
    ["Manteau en laine", "veste", "smartcasual", 1, 80, 180, 400, 60, 5],
    ["Hoodie épais", "haut", "streetwear", 1, 30, 60, 130, 70, 2.5],
    ["Pantalon cargo ou large", "bas", "streetwear", 1, 35, 65, 120, 70, 2.5],
    ["Veste bomber", "veste", "streetwear", 0, 50, 100, 220, 50, 3],
    ["Sneakers statement", "chaussures", "streetwear", 1, 60, 110, 220, 100, 2],
    ["Casquette ou bonnet", "accessoire", "streetwear", 0, 12, 25, 50, 60, 3],
    ["Doudoune légère", "veste", "streetwear", 0, 45, 100, 250, 60, 3],
    ["Chemisier ou blouse unie", "haut", "business", 1, 25, 50, 110, 80, 2.5, "f"],
    ["Jupe droite ou pantalon cigarette", "bas", "business", 1, 30, 65, 150, 70, 3, "f"],
    ["Tailleur (veste et jupe ou pantalon)", "costume", "business", 0, 90, 200, 500, 40, 4, "f"],
    ["Escarpins ou ballerines en cuir", "chaussures", "business", 1, 40, 90, 220, 100, 3, "f"],
    ["Robe chemise ou portefeuille", "haut", "smartcasual", 1, 30, 65, 150, 60, 3, "f"],
    ["Jupe midi", "bas", "smartcasual", 1, 25, 55, 120, 60, 3, "f"],
    ["Bottines en cuir", "chaussures", "smartcasual", 0, 50, 110, 250, 90, 4, "f"],
    ["Legging ou jogging confortable", "bas", "streetwear", 1, 15, 35, 80, 100, 2, "f"],
    ["Jupe en jean ou cargo", "bas", "streetwear", 0, 25, 50, 110, 60, 3, "f"],
  ].map((r) => ({
    g: r[9] || (r[0] === "Costume bleu marine" || r[0] === "Cravate unie" ? "m" : "all"),
    item: r[0], category: r[1], style: r[2], essential: r[3],
    price_low: r[4], price_mid: r[5], price_high: r[6], wears: r[7], life: r[8],
  }));

  // Pièces adaptées au genre choisi ("x" : uniquement les pièces mixtes) ; option seconde main
  function catalogFor(gender, secondHand) {
    const base = CATALOG.filter((c) => c.g === "all" || c.g === gender);
    return secondHand ? secondHandCatalog(base) : base;
  }
  function costPerWear(it, tier) {
    const w = it.wears * it.life * TIER_LIFESPAN[tier];
    return w > 0 ? it["price_" + tier] / w : Infinity;
  }
  function planWardrobe(catalog, style, budgetEur) {
    const pool = catalog.filter((c) => c.style === style || c.style === "all");
    pool.sort((a, b) => (b.essential - a.essential) || (costPerWear(a, "low") - costPerWear(b, "low")));
    const chosen = new Map();
    const postponed = [];
    let spent = 0;
    for (const it of pool) {
      if (spent + it.price_low <= budgetEur) {
        chosen.set(it.item, { it, tier: "low" });
        spent += it.price_low;
      } else postponed.push(it.item);
    }
    for (;;) {
      let best = null;
      for (const [name, o] of chosen) {
        const i = TIERS.indexOf(o.tier);
        if (i + 1 >= TIERS.length) continue;
        const nt = TIERS[i + 1];
        const cost = o.it["price_" + nt] - o.it["price_" + o.tier];
        if (cost <= 0 || spent + cost > budgetEur) continue;
        const score = o.it.wears / cost;
        if (!best || score > best.score) best = { score, name, nt, cost };
      }
      if (!best) break;
      chosen.get(best.name).tier = best.nt;
      spent += best.cost;
    }
    const rows = [];
    for (const [name, o] of chosen) {
      rows.push({
        piece: name, category: o.it.category, tier: o.tier,
        price: o.it["price_" + o.tier], cpw: costPerWear(o.it, o.tier),
        essential: !!o.it.essential,
      });
    }
    return { rows, spent, budget: budgetEur, postponed };
  }

  /* ---- Import CSV de relevé bancaire (100 % local) ---- */
  const RULES = {
    logement: ["loyer", "foncia", "nexity", "agence"],
    courses: ["carrefour", "leclerc", "auchan", "lidl", "monoprix", "franprix", "intermarche", "aldi", "picard", "grand frais", "casino"],
    transport: ["sncf", "ratp", "navigo", "ilevia", "ouigo", "flixbus", "blablacar", "uber", "bolt", "total", "esso"],
    restauration: ["mcdo", "mcdonald", "burger king", "kfc", "uber eats", "deliveroo", "starbucks", "boulangerie", "quick"],
    abonnements: ["netflix", "spotify", "disney", "prime video", "youtube", "canal", "free mobile", "orange", "sfr", "bouygues", "apple.com"],
    vetements: ["zara", "h&m", "hm ", "uniqlo", "kiabi", "vinted", "asos", "zalando", "celio", "jules", "bershka"],
  };

  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const first = text.split(/\r?\n/, 1)[0] || "";
    const counts = { ";": 0, ",": 0, "\t": 0 };
    for (const ch of first) if (ch in counts) counts[ch]++;
    const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ""));
  }
  function toNumber(x) {
    if (x == null) return 0;
    let s = String(x).trim().replace(/[   €]/g, "");
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(",", ".");
    const v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }
  function parseDate(s) {
    s = String(s).trim();
    let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if (m) return { y: +m[3], mo: +m[2], d: +m[1] };
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
    return null;
  }
  function findCol(header, keys) {
    for (let i = 0; i < header.length; i++) {
      const low = header[i].toLowerCase();
      if (keys.some((k) => low.includes(k))) return i;
    }
    return -1;
  }
  function importBank(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("Fichier vide ou illisible.");
    const header = rows[0];
    const d = findCol(header, ["date"]);
    const l = findCol(header, ["libell", "label", "description", "intitul", "détail", "detail"]);
    const a = findCol(header, ["montant", "amount"]);
    const db = findCol(header, ["débit", "debit"]);
    const cr = findCol(header, ["crédit", "credit"]);
    if (d < 0 || l < 0 || (a < 0 && db < 0 && cr < 0))
      throw new Error("Colonnes introuvables : il faut une date, un libellé et un montant (ou débit/crédit).");
    const tx = [];
    for (const r of rows.slice(1)) {
      const date = parseDate(r[d] || "");
      if (!date) continue;
      let amount;
      if (a >= 0) amount = toNumber(r[a]);
      else amount = (cr >= 0 ? toNumber(r[cr]) : 0) - (db >= 0 ? Math.abs(toNumber(r[db])) : 0);
      const label = String(r[l] || "");
      const low = label.toLowerCase();
      let cat = null;
      for (const k of Object.keys(RULES)) if (RULES[k].some((w) => low.includes(w))) { cat = k; break; }
      if (!cat) cat = amount > 0 ? "revenus" : "autre";
      tx.push({ month: date.y + "-" + String(date.mo).padStart(2, "0"), label, amount, cat });
    }
    const spend = {};
    const months = new Set();
    for (const t of tx) {
      if (t.amount >= 0) continue;
      months.add(t.month);
      spend[t.cat] = spend[t.cat] || {};
      spend[t.cat][t.month] = (spend[t.cat][t.month] || 0) + Math.abs(t.amount);
    }
    const n = Math.max(months.size, 1);
    const avg = {};
    for (const c of Object.keys(spend)) avg[c] = Object.values(spend[c]).reduce((x, y) => x + y, 0) / n;
    return { count: tx.length, months: [...months].sort(), avg, spend };
  }

  /* ---- Comptes : suivi manuel ou par export CSV, aucun identifiant bancaire ---- */
  const LIVRET_CAP = 22950;
  const PEA_CAP = 150000;
  const pad2 = (n) => String(n).padStart(2, "0");
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function defaultAccounts() {
    return [
      { id: "pea", name: "PEA", type: "pea", balance: 0, contributed: 0, rate: 0, openDate: "", history: [] },
      { id: "livret", name: "Livret A", type: "livret", balance: 0, contributed: 0, rate: 1.5, openDate: "", history: [] },
    ];
  }
  function newAccount(type) {
    const names = { pea: "Nouveau PEA", livret: "Nouveau livret", other: "Autre compte" };
    return { id: "a" + Date.now() + Math.floor(Math.random() * 1000), name: names[type] || "Compte", type,
      balance: 0, contributed: 0, rate: type === "livret" ? 1.5 : 0, openDate: "", history: [] };
  }
  function addSnapshot(acc, date, balance) {
    acc.history = (acc.history || []).filter((h) => h.date !== date);
    acc.history.push({ date, balance });
    acc.history.sort((a, b) => (a.date < b.date ? -1 : 1));
    acc.balance = acc.history[acc.history.length - 1].balance;
  }
  function totalWorth(accounts) { return accounts.reduce((s, a) => s + (+a.balance || 0), 0); }
  function netWorthSeries(accounts) {
    const dates = [...new Set(accounts.flatMap((a) => (a.history || []).map((h) => h.date)))].sort();
    return dates.map((d) => ({
      date: d,
      total: accounts.reduce((s, a) => {
        let v = 0;
        for (const h of a.history || []) if (h.date <= d) v = h.balance;
        return s + v;
      }, 0),
    }));
  }
  function yearsSince(iso) {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? null : (Date.now() - d.getTime()) / (365.25 * 864e5);
  }
  function peaStats(a) {
    const gain = a.balance - a.contributed;
    return {
      gain, pct: a.contributed > 0 ? gain / a.contributed : null,
      capUsed: a.contributed / PEA_CAP, years: a.openDate ? yearsSince(a.openDate) : null,
    };
  }
  function livretStats(a) {
    return { interest: (a.balance * a.rate) / 100, capUsed: a.balance / LIVRET_CAP };
  }
  // Lit un export CSV de compte (Boursorama, Trade Republic, etc.) : détecte au mieux le solde et les versements.
  function importAccountCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("Fichier vide ou illisible.");
    const h = rows[0];
    const d = findCol(h, ["date"]);
    const a = findCol(h, ["montant", "amount", "valeur", "value"]);
    const l = findCol(h, ["libell", "label", "description", "intitul", "détail", "detail", "note"]);
    const t = findCol(h, ["type"]);
    const b = findCol(h, ["accountbalance", "solde", "balance"]);
    if (d < 0 || a < 0) throw new Error("Colonnes introuvables : il faut au moins une date et un montant.");
    const dep = /versement|d[ée]p[oô]t|deposit|virement entrant|inbound|transfer in|alimentation|cash in/i;
    const wd = /retrait|withdraw|virement sortant|outbound|cash out/i;
    let deposits = 0, withdrawals = 0, seen = false, n = 0, best = null;
    for (const r of rows.slice(1)) {
      const dt = parseDate(r[d] || "");
      if (!dt) continue;
      n++;
      const amt = toNumber(r[a]);
      const txt = (l >= 0 ? r[l] || "" : "") + " " + (t >= 0 ? r[t] || "" : "");
      if (dep.test(txt) && amt > 0) { deposits += amt; seen = true; }
      else if (wd.test(txt)) { withdrawals += Math.abs(amt); seen = true; }
      if (b >= 0 && String(r[b] || "").trim() !== "") {
        const s = dt.y * 10000 + dt.mo * 100 + (dt.d || 1);
        if (!best || s > best.s) best = { s, bal: toNumber(r[b]), dt }; // égalité : on garde la 1re ligne (export du plus récent au plus ancien)
      }
    }
    return {
      count: n,
      balance: best ? best.bal : null,
      balanceDate: best ? best.dt.y + "-" + pad2(best.dt.mo) + "-" + pad2(best.dt.d || 1) : null,
      depositsNet: seen ? deposits - withdrawals : null,
    };
  }

  /* ---- Marques par pièce et par gamme (suggestions, sans partenariat) ---- */
  const CAT_BRANDS = {
    haut: { low: ["Uniqlo", "H&M", "Kiabi", "Vinted"], mid: ["Uniqlo", "COS", "Arket", "Lacoste"], high: ["Polo Ralph Lauren", "Sandro", "Hugo Boss"] },
    bas: { low: ["Uniqlo", "Kiabi", "Zara", "Vinted"], mid: ["Levi's", "Dockers", "Mango", "COS"], high: ["Hugo Boss", "Massimo Dutti", "Sandro"] },
    veste: { low: ["Zara", "H&M", "Vinted"], mid: ["Mango", "Massimo Dutti", "Uniqlo"], high: ["Suitsupply", "Hugo Boss", "Sandro"] },
    costume: { low: ["Celio", "Jules", "Zara"], mid: ["Suitsupply", "Massimo Dutti"], high: ["Hugo Boss", "Zegna"] },
    chaussures: { low: ["Zara", "Celio", "Vinted"], mid: ["Clarks", "Geox", "Dr. Martens"], high: ["Church's", "Grenson", "Carmina"] },
    accessoire: { low: ["Uniqlo", "H&M", "Vinted"], mid: ["Lacoste", "Levi's"], high: ["Hugo Boss", "Polo Ralph Lauren"] },
  };
  const STREET_BRANDS = {
    haut: { low: ["Uniqlo", "H&M", "Kiabi"], mid: ["Carhartt WIP", "Nike", "Adidas", "Levi's"], high: ["Stüssy", "Carhartt WIP"] },
    bas: { low: ["Kiabi", "Zara", "Vinted"], mid: ["Dickies", "Carhartt WIP", "Levi's"], high: ["Stüssy", "Carhartt WIP"] },
    veste: { low: ["Zara", "H&M", "Vinted"], mid: ["Carhartt WIP", "Nike", "Adidas", "Levi's"], high: ["Stüssy", "The North Face"] },
    chaussures: { low: ["Vinted", "Adidas (soldes)", "Nike (soldes)"], mid: ["New Balance", "Adidas Originals", "Nike", "Veja"], high: ["Common Projects", "Autry", "Salomon"] },
    accessoire: { low: ["Vinted", "H&M"], mid: ["Carhartt WIP", "Nike"], high: ["Stüssy"] },
  };
  const ITEM_BRANDS = {
    "Montre sobre": { low: ["Casio", "Timex"], mid: ["Seiko", "Orient", "Tissot"], high: ["Tissot", "Longines", "Nomos"] },
    "Sacoche ou sac en cuir": { low: ["Zara", "H&M"], mid: ["Lacoste", "Fossil"], high: ["Le Tanneur", "Longchamp"] },
    "Ceinture en cuir": { low: ["Zara", "Celio"], mid: ["Levi's", "Lacoste", "Dockers"], high: ["Hugo Boss", "Ferragamo"] },
    "Cravate unie": { low: ["Celio", "Jules"], mid: ["Suitsupply", "Jules"], high: ["Hugo Boss", "Hermès"] },
    "Chaussettes (x7)": { low: ["Uniqlo", "Kiabi", "Decathlon"], mid: ["Falke", "Happy Socks"], high: ["Falke"] },
    "T-shirts basiques (x5)": { low: ["Uniqlo", "H&M", "Kiabi"], mid: ["Uniqlo U", "COS", "Armor Lux"], high: ["Sunspel", "Norse Projects"] },
    "Jean brut sombre": { low: ["Zara", "Kiabi"], mid: ["Levi's 501", "Lee", "Uniqlo"], high: ["A.P.C.", "Nudie", "Edwin"] },
    "Manteau en laine": { low: ["Zara", "Mango", "H&M"], mid: ["Uniqlo", "Massimo Dutti", "Mango"], high: ["Suitsupply", "Sandro", "Max Mara"] },
    "Baskets blanches en cuir": { low: ["Adidas (soldes)", "Vinted"], mid: ["Veja", "Adidas Stan Smith", "New Balance"], high: ["Common Projects", "Axel Arigato"] },
    "Derbies en cuir": { low: ["Zara", "Celio", "Vinted"], mid: ["Clarks", "Geox"], high: ["Church's", "Grenson", "Carmina"] },
    "Casquette ou bonnet": { low: ["H&M", "Vinted"], mid: ["Carhartt WIP", "New Era"], high: ["Stüssy"] },
  };
  function brandsFor(piece, category, tier, style) {
    const byItem = ITEM_BRANDS[piece];
    if (byItem && byItem[tier]) return byItem[tier];
    if (style === "streetwear" && STREET_BRANDS[category] && STREET_BRANDS[category][tier]) return STREET_BRANDS[category][tier];
    return (CAT_BRANDS[category] && CAT_BRANDS[category][tier]) || [];
  }

  /* ---- Emploi : liens de recherche et employeurs cibles ---- */
  const JOB_TYPES = { alternance: "Alternance", cdi: "Emploi (CDI, CDD)", stage: "Stage" };
  const STATUSES = { alternant: "Alternant", etudiant: "Étudiant", salarie: "Salarié", independant: "Indépendant", recherche: "En recherche d'emploi", retraite: "Retraité" };
  // Valeurs par défaut selon la situation : type d'offre cherchée et pyramide affichée
  const STATUS_DEFAULTS = {
    alternant: { jobType: "alternance", pyr: "stu" }, etudiant: { jobType: "stage", pyr: "stu" },
    salarie: { jobType: "cdi", pyr: "nat" }, independant: { jobType: "cdi", pyr: "nat" }, recherche: { jobType: "cdi", pyr: "nat" },
    retraite: { jobType: "cdi", pyr: "nat" },
  };
  const GENDERS = { m: "Homme", f: "Femme", x: "Autre ou je préfère ne pas préciser" };
  const CITIES = { paris: "Paris", versailles: "Versailles", lille: "Lille", luxembourg: "Luxembourg", zurich: "Zurich", remote: "Télétravail" };
  const REGION_OF_CITY = { paris: "paris", versailles: "paris", remote: "paris", lille: "lille", luxembourg: "lu", zurich: "ch" };
  function jobQuery(q, type) {
    const w = type === "alternance" ? "alternance" : type === "stage" ? "stage" : "";
    return ((q || "") + " " + w).trim();
  }
  function jobLinks(city, q, type, custom) {
    const e = encodeURIComponent, qq = jobQuery(q, type), loc = city === "custom" ? (custom || "") : (CITIES[city] || "");
    const links = [["LinkedIn", "https://www.linkedin.com/jobs/search/?keywords=" + e(qq) + "&location=" + e(city === "remote" ? "France" : loc)]];
    if (city === "luxembourg") {
      links.push(["Indeed Luxembourg", "https://lu.indeed.com/jobs?q=" + e(qq) + "&l=Luxembourg"]);
    } else if (city === "zurich") {
      links.push(["jobs.ch", "https://www.jobs.ch/en/vacancies/?term=" + e(qq) + "&location=" + e(loc)],
        ["Indeed Suisse", "https://ch.indeed.com/jobs?q=" + e(qq) + "&l=" + e(loc)]);
    } else if (city === "remote") {
      links.push(["Welcome to the Jungle", "https://www.welcometothejungle.com/fr/jobs?query=" + e(qq + " télétravail")],
        ["Indeed", "https://fr.indeed.com/jobs?q=" + e(qq + " télétravail")]);
    } else {
      links.push(["Indeed", "https://fr.indeed.com/jobs?q=" + e(qq) + "&l=" + e(loc)],
        ["Welcome to the Jungle", "https://www.welcometothejungle.com/fr/jobs?query=" + e(qq)],
        ["HelloWork", "https://www.hellowork.com/fr-fr/emploi/recherche.html?k=" + e(qq) + "&l=" + e(loc)],
        ["France Travail", "https://candidat.francetravail.fr/offres/recherche?motsCles=" + e(qq)],
        ["Apec", "https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=" + e(qq)]);
      if (type !== "cdi") links.push(["La bonne alternance", "https://labonnealternance.apprentissage.beta.gouv.fr/"]);
    }
    return links.map(([name, url]) => ({ name, url }));
  }
  const REGION_LABELS = { paris: "Paris et Île-de-France", lille: "Lille", lu: "Luxembourg", ch: "Suisse (Zurich)" };
  const EMPLOYERS = [
    ["paris", "BNP Paribas", "Banque"], ["paris", "Société Générale", "Banque"], ["paris", "Crédit Agricole CIB", "Banque"],
    ["paris", "Natixis", "Banque"], ["paris", "BPCE", "Banque"], ["paris", "Boursorama", "Banque en ligne"],
    ["paris", "Qonto", "Fintech"], ["paris", "Pennylane", "Fintech"], ["paris", "Swile", "Fintech"],
    ["paris", "Spendesk", "Fintech"], ["paris", "Alan", "Insurtech"], ["paris", "Worldline", "Paiement"], ["paris", "Ledger", "Crypto, sécurité"],
    ["lille", "Oney", "Crédit, fintech"], ["lille", "Crédit Agricole Nord de France", "Banque"],
    ["lille", "Crédit Mutuel Nord Europe", "Banque"], ["lille", "CIC Nord Ouest", "Banque"],
    ["lu", "BGL BNP Paribas", "Banque"], ["lu", "Spuerkeess", "Banque"], ["lu", "Banque de Luxembourg", "Banque privée"],
    ["lu", "ING Luxembourg", "Banque"], ["lu", "Clearstream", "Post-marché"], ["lu", "PayPal Europe", "Paiement"],
    ["ch", "UBS", "Banque"], ["ch", "Zürcher Kantonalbank", "Banque"], ["ch", "Julius Baer", "Banque privée"],
    ["ch", "Swiss Re", "Réassurance"], ["ch", "Zurich Insurance Group", "Assurance"], ["ch", "Avaloq", "Logiciel bancaire"],
    ["ch", "SIX", "Infrastructure financière"], ["ch", "Sygnum", "Banque digitale"],
  ].map((r) => ({ region: r[0], name: r[1], sector: r[2] }));
  function employerLink(name, q) {
    return "https://www.linkedin.com/jobs/search/?keywords=" + encodeURIComponent(name + " " + (q || ""));
  }

  /* ---- Conseils budget (règles simples, pas de conseil de placement) ---- */
  function insights(p, accounts) {
    const b = budget(p), out = [];
    if (!isNaN(b.effort) && b.effort > 0.33)
      out.push({ tone: "warn", text: "Ton loyer pèse " + Math.round(b.effort * 100) + " % de ton revenu : c'est le premier poste à optimiser (aides, colocation, négociation)." });
    const liquid = accounts.filter((a) => a.type === "livret" || a.type === "cash").reduce((s, a) => s + (+a.balance || 0), 0);
    if (b.emergency > 0 && accounts.some((a) => a.balance > 0)) {
      const cov = liquid / b.emergency;
      out.push(cov >= 1 ? { tone: "ok", text: "Fonds de secours couvert (" + Math.round(cov * 100) + " % de 3 mois de charges)." }
        : { tone: "warn", text: "Fonds de secours à " + Math.round(cov * 100) + " % : il manque " + eur(b.emergency - liquid) + " sur tes comptes disponibles." });
    }
    accounts.forEach((a) => {
      if (a.type === "livret" && a.balance >= 0.9 * LIVRET_CAP) out.push({ tone: "info", text: a.name + " approche du plafond de " + eur(LIVRET_CAP) + "." });
    });
    const nb = nextBand(p.income, nationalBands(p.median));
    if (nb) out.push({ tone: "info", text: "Il te manque " + eur(nb.gap) + " par mois pour atteindre « " + nb.name + " » dans la pyramide française." });
    if (!accounts.some((a) => a.balance > 0)) out.push({ tone: "info", text: "Renseigne tes soldes dans l'onglet Comptes pour suivre ton patrimoine." });
    return out.slice(0, 4);
  }

  /* ================= Corps : calories, macros, aliments ================= */
  const ACTIVITY = {
    sedentary: [1.2, "Sédentaire (peu ou pas de sport)"],
    light: [1.375, "Léger (1 à 2 séances par semaine)"],
    moderate: [1.55, "Modéré (3 à 4 séances par semaine)"],
    high: [1.725, "Élevé (5 séances ou plus, ou métier physique)"],
  };
  const BODY_GOALS = { lose: "Perdre du gras", maintain: "Maintenir", gain: "Prendre du muscle" };
  const DEFAULT_BODY = {
    sex: "m", age: 22, height: 175, weight: 70, activity: "moderate", goal: "maintain", targetWeight: 70,
    sessions: 3, diet: "omni", city: "Versailles", weights: [], basket: null,
  };
  const DEFAULT_LOOK = { shape: null, L: "", F: "", C: "", J: "", hairType: "wavy", length: "any", density: "normal" };

  const round10 = (x) => Math.round(x / 10) * 10;
  function bmr(b) { return 10 * b.weight + 6.25 * b.height - 5 * b.age + (b.sex === "f" ? -161 : b.sex === "x" ? -78 : 5); }
  function tdee(b) { return bmr(b) * (ACTIVITY[b.activity] || ACTIVITY.moderate)[0]; }
  function bmi(b) { const m = b.height / 100; return m > 0 ? b.weight / (m * m) : NaN; }
  function bmiLabel(x) {
    if (!(x > 0)) return "–";
    return x < 18.5 ? "Maigreur" : x < 25 ? "Corpulence normale" : x < 30 ? "Surpoids" : "Obésité";
  }
  function calorieTarget(b) {
    const t = tdee(b), floor = b.sex === "f" ? 1200 : b.sex === "x" ? 1350 : 1500;
    let delta = 0, note = "";
    if (b.goal === "lose") {
      if (bmi(b) < 20) note = "Ton IMC est déjà bas : un déficit n'est pas recommandé. Cible calée sur le maintien.";
      else delta = -Math.min(500, 0.2 * t);
    } else if (b.goal === "gain") delta = 300;
    let kcal = t + delta, floorApplied = false;
    if (kcal < floor) { kcal = floor; floorApplied = true; delta = kcal - t; }
    return { kcal: round10(kcal), tdee: round10(t), bmr: round10(bmr(b)), delta: Math.round(delta), floorApplied, note };
  }
  function macroTargets(b, kcal) {
    const perKg = Math.min(2, (b.sessions >= 2 ? 1.6 : 1.2) + (b.goal === "lose" ? 0.2 : 0));
    const protein = Math.round(b.weight * perKg);
    const fat = Math.round(Math.max((kcal * 0.3) / 9, 0.8 * b.weight));
    const carbs = Math.max(0, Math.round((kcal - 4 * protein - 9 * fat) / 4));
    return { protein, fat, carbs, fiber: 30, perKg };
  }
  function weeksToTarget(b) {
    const ct = calorieTarget(b), diff = b.targetWeight - b.weight;
    if (b.goal === "lose" && diff < 0 && ct.delta < 0) return Math.ceil(-diff / ((-ct.delta * 7) / 7700));
    if (b.goal === "gain" && diff > 0) return Math.ceil(diff / 0.25);
    return null;
  }
  function dayNum(iso) { const p = parseDate(iso); return p ? Date.UTC(p.y, p.mo - 1, p.d) / 86400000 : NaN; }
  function addWeight(b, date, kg) {
    if (!Array.isArray(b.weights)) b.weights = [];
    const i = b.weights.findIndex((w) => w.date === date);
    if (i >= 0) b.weights[i].kg = kg; else b.weights.push({ date, kg });
    b.weights.sort((x, y) => (x.date < y.date ? -1 : 1));
    b.weight = b.weights[b.weights.length - 1].kg;
    return b;
  }
  function weightTrend(b) {
    const w = b.weights || [];
    if (w.length < 2) return null;
    const last = w[w.length - 1], lastD = dayNum(last.date);
    let first = last;
    for (const e of w) { if (lastD - dayNum(e.date) <= 28) { first = e; break; } }
    const days = lastD - dayNum(first.date);
    if (!(days >= 7)) return null;
    const perWeek = ((last.kg - first.kg) / days) * 7;
    return { perWeek, days, tooFast: Math.abs(perWeek) > 0.01 * last.kg };
  }

  // id, nom, catégorie, kcal, prot, gluc, lip, fibres (pour 100 g), prix indicatif €/kg, mois de saison (null = toute l'année), drapeaux
  const FOOD_ROWS = [
    ["banane", "Banane", "fruit", 90, 1.1, 20, 0.3, 2, 1.8, null, ""],
    ["pomme", "Pomme", "fruit", 52, 0.3, 12, 0.2, 2, 2.3, [9, 10, 11, 12, 1, 2, 3, 4], ""],
    ["poire", "Poire", "fruit", 55, 0.4, 12.5, 0.1, 3, 2.8, [8, 9, 10, 11, 12, 1], ""],
    ["orange", "Orange", "fruit", 45, 0.9, 9, 0.2, 2, 2.2, [11, 12, 1, 2, 3, 4], ""],
    ["clementine", "Clémentine", "fruit", 47, 0.8, 10, 0.3, 1.7, 2.8, [11, 12, 1, 2], ""],
    ["kiwi", "Kiwi", "fruit", 60, 1.1, 12, 0.5, 3, 3.5, [11, 12, 1, 2, 3, 4, 5], ""],
    ["raisin", "Raisin", "fruit", 70, 0.7, 17, 0.2, 1, 3.5, [8, 9, 10], ""],
    ["fraise", "Fraises", "fruit", 33, 0.7, 6, 0.3, 2, 6, [5, 6, 7], ""],
    ["carotte", "Carottes", "veg", 36, 0.7, 7.5, 0.2, 3, 1.4, [1, 2, 3, 4, 5, 6, 9, 10, 11, 12], ""],
    ["courgette", "Courgettes", "veg", 17, 1.2, 2.5, 0.3, 1.1, 2.5, [6, 7, 8, 9], ""],
    ["tomate", "Tomates", "veg", 18, 0.9, 3.5, 0.2, 1.2, 3, [6, 7, 8, 9], ""],
    ["poireau", "Poireaux", "veg", 31, 1.5, 5.5, 0.3, 2.5, 2.2, [9, 10, 11, 12, 1, 2, 3, 4], ""],
    ["chou-fleur", "Chou-fleur", "veg", 25, 2, 3, 0.3, 2.5, 2.5, [10, 11, 12, 1, 2, 3, 4], ""],
    ["brocoli", "Brocoli", "veg", 34, 2.8, 4, 0.4, 2.6, 3.5, [9, 10, 11, 12, 1, 2, 3], ""],
    ["epinards", "Épinards", "veg", 23, 2.9, 1.6, 0.4, 2.2, 4.5, [3, 4, 5, 9, 10, 11], ""],
    ["courge", "Courge, potiron", "veg", 26, 1, 5.5, 0.1, 1.5, 1.8, [9, 10, 11, 12, 1], ""],
    ["haricots-verts", "Haricots verts", "veg", 31, 1.8, 5, 0.2, 3, 4, [6, 7, 8, 9, 10], ""],
    ["champignons", "Champignons de Paris", "veg", 22, 3, 1, 0.3, 1.5, 4.5, null, ""],
    ["salade", "Salade verte", "veg", 15, 1.4, 1.5, 0.2, 1.3, 3, null, ""],
    ["oignon", "Oignons", "veg", 40, 1.1, 8.5, 0.1, 1.7, 1.6, null, ""],
    ["pates-completes", "Pâtes complètes (crues)", "starch", 350, 13, 66, 2.5, 8, 2.2, null, ""],
    ["riz-complet", "Riz complet (cru)", "starch", 350, 7.5, 72, 2.5, 3.5, 3, null, ""],
    ["flocons", "Flocons d'avoine", "starch", 370, 13, 60, 7, 10, 2.5, null, ""],
    ["pain-complet", "Pain complet", "starch", 250, 9, 45, 3, 6, 4, null, ""],
    ["pommes-de-terre", "Pommes de terre", "starch", 80, 2, 17, 0.1, 1.8, 1.5, null, ""],
    ["lentilles", "Lentilles sèches", "legume", 350, 25, 50, 1.5, 11, 3, null, ""],
    ["pois-chiches", "Pois chiches (conserve)", "legume", 120, 7, 16, 2.5, 5, 2.5, null, ""],
    ["haricots-rouges", "Haricots rouges (conserve)", "legume", 100, 7, 14, 0.5, 6, 2.5, null, ""],
    ["oeufs", "Œufs", "protein", 145, 12.5, 0.7, 10.5, 0, 4.2, null, ""],
    ["poulet", "Blanc de poulet", "protein", 120, 23, 0, 2.5, 0, 8.5, null, "meat"],
    ["boeuf", "Steak haché 5 %", "protein", 125, 21, 0, 5, 0, 11, null, "meat red"],
    ["jambon", "Jambon blanc", "protein", 110, 19, 1, 3, 0, 12, null, "meat charc"],
    ["thon", "Thon au naturel (boîte)", "protein", 110, 25, 0, 1, 0, 12, null, "fish"],
    ["saumon", "Saumon", "protein", 200, 20, 0, 13, 0, 18, null, "fish oily"],
    ["tofu", "Tofu ferme", "protein", 120, 13, 2, 7, 1, 9, null, ""],
    ["skyr", "Skyr ou fromage blanc 0 %", "dairy", 55, 10, 4, 0.2, 0, 3.2, null, ""],
    ["yaourt", "Yaourt nature", "dairy", 55, 4, 5, 2, 0, 2.5, null, ""],
    ["lait", "Lait demi-écrémé", "dairy", 46, 3.2, 4.8, 1.6, 0, 1, null, ""],
    ["lait-soja", "Boisson soja nature", "dairy", 40, 3.3, 1, 1.8, 0.5, 1.3, null, ""],
    ["yaourt-soja", "Yaourt au soja nature", "dairy", 50, 4, 2.5, 2.3, 0.5, 3, null, ""],
    ["emmental", "Emmental", "dairy", 380, 28, 0.5, 29, 0, 11, null, ""],
    ["huile-olive", "Huile d'olive", "fat", 900, 0, 0, 100, 0, 8, null, ""],
    ["amandes", "Amandes", "fat", 600, 21, 7, 52, 11, 12, null, ""],
    ["beurre-cacahuete", "Beurre de cacahuète", "fat", 600, 25, 12, 50, 6, 6, null, ""],
    ["chocolat-noir", "Chocolat noir 70 %", "treat", 560, 8, 35, 40, 10, 10, null, ""],
    ["soda", "Soda", "treat", 42, 0, 10.6, 0, 0, 1.2, null, "processed"],
    ["chips", "Chips", "treat", 540, 6, 50, 35, 4, 8, null, "processed"],
    ["biscuits", "Biscuits", "treat", 480, 6, 70, 19, 2, 5, null, "processed"],
    ["pizza", "Pizza surgelée", "treat", 250, 10, 30, 10, 2, 6, null, "processed"],
    ["plat-prepare", "Plat préparé", "treat", 150, 6, 15, 7, 1, 7, null, "processed"],
  ];
  const FOODS = FOOD_ROWS.map((r) => ({
    id: r[0], name: r[1], cat: r[2], kcal: r[3], p: r[4], c: r[5], f: r[6], fib: r[7], price: r[8], season: r[9],
    flags: r[10] ? r[10].split(" ") : [],
  }));
  const FOOD_BY_ID = {};
  FOODS.forEach((f) => { FOOD_BY_ID[f.id] = f; });
  const FOOD_CATS = {
    fruit: "Fruits", veg: "Légumes", starch: "Féculents", legume: "Légumineuses", protein: "Viandes, poissons, œufs, tofu",
    dairy: "Produits laitiers", fat: "Matières grasses et oléagineux", treat: "Plaisirs et produits transformés",
  };
  const isFV = (f) => f.cat === "fruit" || f.cat === "veg";
  function inSeason(f, month) { return !f.season || f.season.indexOf(month) >= 0; }
  function seasonalProduce(month) { return FOODS.filter((f) => isFV(f) && f.season && inSeason(f, month)); }

  function basketTotals(basket) {
    const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, fv: 0, cost: 0, red: 0, charc: 0, fish: 0, processedKcal: 0 };
    Object.keys(basket || {}).forEach((id) => {
      const f = FOOD_BY_ID[id], g = +basket[id] || 0;
      if (!f || g <= 0) return;
      const k = g / 100;
      t.kcal += f.kcal * k; t.p += f.p * k; t.c += f.c * k; t.f += f.f * k; t.fib += f.fib * k;
      t.cost += (g / 1000) * f.price;
      if (isFV(f)) t.fv += g;
      if (f.flags.indexOf("red") >= 0) t.red += g;
      if (f.flags.indexOf("charc") >= 0) t.charc += g;
      if (f.flags.indexOf("fish") >= 0) t.fish += g;
      if (f.flags.indexOf("processed") >= 0) t.processedKcal += f.kcal * k;
    });
    const day = {};
    ["kcal", "p", "c", "f", "fib", "fv"].forEach((k) => { day[k] = t[k] / 7; });
    return { week: t, day, costWeek: t.cost, processedShare: t.kcal > 0 ? t.processedKcal / t.kcal : 0 };
  }

  function suggestedBasket(b, month, targetKcal, protTarget) {
    const veg = b.diet === "vege" || b.diet === "vegan", vegan = b.diet === "vegan";
    const pick = (order, n) => order.filter((id) => inSeason(FOOD_BY_ID[id], month)).slice(0, n);
    const fruits = pick(["pomme", "poire", "orange", "clementine", "kiwi", "raisin", "fraise"], 2);
    const vegs = pick(["carotte", "courgette", "tomate", "brocoli", "chou-fleur", "poireau", "courge", "epinards", "haricots-verts", "champignons", "salade"], 4);
    const d = {}; // grammes par jour
    d.banane = 80;
    if (fruits[0]) d[fruits[0]] = 120;
    if (fruits[1]) d[fruits[1]] = 60;
    [120, 100, 100, 80].forEach((g, i) => { if (vegs[i]) d[vegs[i]] = g; });
    const fvSum = Object.keys(d).reduce((s, k) => s + d[k], 0);
    if (fvSum < 450) { d.carotte = (d.carotte || 0) + (450 - fvSum); }
    const fixed = Object.assign({}, d);
    const flex = {
      "pates-completes": 60, "riz-complet": 50, flocons: 40, "pain-complet": 80, "pommes-de-terre": 150,
      lentilles: 30, "pois-chiches": 50,
      "huile-olive": 15, amandes: 15, "beurre-cacahuete": 10, "chocolat-noir": 10,
    };
    if (vegan) { flex["yaourt-soja"] = 125; flex["lait-soja"] = 200; } else { Object.assign(flex, { skyr: 125, yaourt: 125, lait: 100, emmental: 15 }); }
    const protG = vegan ? { tofu: 100, lentilles: 40, "pois-chiches": 40 } : veg ? { oeufs: 70, tofu: 60, lentilles: 30 } : { oeufs: 60, poulet: 100, saumon: 30, thon: 15, boeuf: 20 };
    Object.keys(protG).forEach((k) => { flex[k] = (flex[k] || 0) + protG[k]; });
    const protIds = vegan ? ["tofu", "lentilles", "yaourt-soja", "pois-chiches"] : veg ? ["oeufs", "tofu", "skyr", "lentilles"] : ["oeufs", "poulet", "thon", "skyr"];
    const kcalOf = (m) => Object.keys(m).reduce((s, k) => s + (FOOD_BY_ID[k].kcal * m[k]) / 100, 0);
    const protOf = (m) => Object.keys(m).reduce((s, k) => s + (FOOD_BY_ID[k].p * m[k]) / 100, 0);
    let cur = Object.assign({}, flex);
    const rescale = () => {
      const fixedK = kcalOf(fixed), protPart = {}, rest = {};
      Object.keys(cur).forEach((k) => { (protIds.indexOf(k) >= 0 ? protPart : rest)[k] = cur[k]; });
      const room = targetKcal - fixedK - kcalOf(protPart);
      const rk = kcalOf(rest), f = rk > 0 ? Math.max(0.2, room / rk) : 1;
      Object.keys(rest).forEach((k) => { rest[k] *= f; });
      cur = Object.assign({}, protPart, rest);
    };
    const total = () => Object.assign({}, fixed, cur);
    const first = kcalOf(total()) || 1;
    Object.keys(cur).forEach((k) => { cur[k] *= targetKcal / first; });
    for (let i = 0; i < 8 && protOf(total()) < protTarget * 0.98; i++) {
      protIds.forEach((k) => { if (cur[k]) cur[k] *= 1.12; });
      rescale();
    }
    const all = total(), basket = {};
    Object.keys(all).forEach((k) => { const g = round10(all[k] * 7); if (g > 0) basket[k] = g; });
    return basket;
  }

  function basketAdvice(totals, target, macros, b) {
    const out = [], d = totals.day, w = totals.week;
    if (d.kcal === 0) return [{ tone: "info", text: "Ton panier est vide : génère une base ou ajoute des aliments." }];
    const diff = d.kcal - target.kcal;
    if (Math.abs(diff) > 0.1 * target.kcal)
      out.push({ tone: "warn", text: "Ton panier fait " + nf(d.kcal) + " kcal par jour pour une cible de " + nf(target.kcal) + " (" + (diff > 0 ? "+" : "−") + nf(Math.abs(diff)) + ")." });
    if (d.p < 0.9 * macros.protein)
      out.push({ tone: "warn", text: "Il manque environ " + Math.round(macros.protein - d.p) + " g de protéines par jour : œufs, skyr, légumineuses, " + (b.diet !== "omni" ? "tofu" : "volaille ou thon") + "." });
    if (d.fv < 400)
      out.push({ tone: "warn", text: "Fruits et légumes : " + Math.round(d.fv) + " g par jour, la repère est d'au moins 5 portions (environ 400 g)." });
    if (d.fib < 25)
      out.push({ tone: "warn", text: "Fibres : " + Math.round(d.fib) + " g par jour pour ~30 g visés. Plus de légumineuses, de complets et de légumes." });
    if (totals.processedShare > 0.15)
      out.push({ tone: "warn", text: "Les produits ultra-transformés pèsent " + Math.round(totals.processedShare * 100) + " % de tes calories : réduis sodas, chips, biscuits, plats préparés." });
    if (w.red > 500) out.push({ tone: "warn", text: "Viande rouge : " + Math.round(w.red) + " g par semaine, les repères officiels conseillent de rester sous 500 g." });
    if (w.charc > 150) out.push({ tone: "warn", text: "Charcuterie : " + Math.round(w.charc) + " g par semaine, les repères conseillent moins de 150 g." });
    if (b.diet === "omni" && w.fish < 200) out.push({ tone: "info", text: "Poisson : vise 2 portions par semaine dont une de poisson gras (saumon, maquereau, sardines)." });
    if (b.diet === "vegan") out.unshift({ tone: "info", text: "Régime vegan : une supplémentation en vitamine B12 est nécessaire, parles-en à un médecin ou un pharmacien." });
    if (!out.length) out.push({ tone: "ok", text: "Ton panier colle à ta cible : calories, protéines, fibres et fruits-légumes." });
    return out.slice(0, 5);
  }

  const SWAPS = [
    ["Soda, jus de fruit", "Eau, eau gazeuse citronnée, thé froid"],
    ["Céréales de petit-déjeuner sucrées", "Flocons d'avoine + fruit + skyr"],
    ["Pâtes ou riz blancs", "Versions complètes (plus de fibres, plus rassasiant)"],
    ["Chips, biscuits apéro", "Amandes (poignée), popcorn nature, crudités"],
    ["Plats préparés", "Batch cooking du dimanche : 2 féculents + 2 légumes + 1 protéine"],
    ["Pizza, burger du soir", "Pâtes complètes, œufs, légumes surgelés nature : prêts en 10 minutes"],
    ["Steak haché tous les jours", "Alterne œufs, volaille, thon, lentilles : moins cher, moins de viande rouge"],
    ["Snacks de distributeur", "Banane, pomme, yaourt nature dans le sac"],
  ];

  const STORES = [
    { id: "marche", name: "Marché alimentaire", price: "€ à €€", best: "Fruits et légumes de saison, œufs, fromages",
      note: "Souvent le plus frais et le moins cher en saison. Les prix baissent parfois en fin de marché.", q: "marché alimentaire" },
    { id: "discount", name: "Lidl, Aldi", price: "€", best: "Fruits et légumes de base, féculents, laitiers, surgelés",
      note: "Prix bas sur l'essentiel. Compare le prix au kilo, pas à la barquette.", q: "Lidl" },
    { id: "grandfrais", name: "Grand Frais, primeurs", price: "€ à €€", best: "Fruits, légumes, fromages, poissons frais",
      note: "Bon choix de produits frais. Les prix varient beaucoup d'un produit à l'autre.", q: "Grand Frais" },
    { id: "hyper", name: "Hypermarchés (Leclerc, Carrefour, Auchan...)", price: "€ à €€", best: "Tout en un, promotions, volaille et poisson",
      note: "Utile pour les promos et les cartes de fidélité. Attention aux achats impulsifs.", q: "supermarché" },
    { id: "bio", name: "Biocoop, Naturalia", price: "€€€", best: "Bio, vrac, légumineuses et céréales complètes",
      note: "Plus cher : à réserver au vrac (lentilles, flocons) ou à ce qui compte pour toi.", q: "Biocoop" },
    { id: "amap", name: "AMAP, paniers de producteurs", price: "€€", best: "Légumes locaux de saison en abonnement",
      note: "Engagement régulier, légumes de saison, peu de gaspillage si tu cuisines.", q: "AMAP panier légumes" },
    { id: "antigaspi", name: "Anti-gaspi (Too Good To Go, Phenix)", price: "€", best: "Paniers surprise à prix réduit",
      note: "Contenu aléatoire : pratique en complément, pas comme base du panier.", q: "Too Good To Go" },
    { id: "surgeles", name: "Surgelés nature (Picard, supermarchés)", price: "€ à €€", best: "Légumes et fruits surgelés sans sauce, poisson",
      note: "Nutritionnellement proches du frais, se conservent longtemps et évitent le gaspillage.", q: "Picard surgelés" },
  ];
  function storeLink(store, city) {
    return "https://www.google.com/maps/search/" + encodeURIComponent(store.q + (city ? " " + city : ""));
  }
  function produceLink(food, city) {
    return "https://www.google.com/maps/search/" + encodeURIComponent("marché alimentaire" + (city ? " " + city : ""));
  }

  const PROGRAMS = {
    2: [
      { name: "Séance A (corps entier)", items: ["Squat 3 × 6-8", "Développé couché 3 × 6-8", "Rowing barre ou haltère 3 × 8", "Gainage 3 × 30-45 s"] },
      { name: "Séance B (corps entier)", items: ["Soulevé de terre roumain 3 × 8", "Développé militaire 3 × 8", "Tractions ou tirage vertical 3 × 6-10", "Fentes 2 × 10 par jambe"] },
    ],
    3: [
      { name: "Séance A", items: ["Squat 3 × 6-8", "Développé couché 3 × 6-8", "Rowing 3 × 8", "Gainage 3 × 30-45 s"] },
      { name: "Séance B", items: ["Soulevé de terre roumain 3 × 8", "Développé militaire 3 × 8", "Tractions ou tirage vertical 3 × 6-10", "Fentes 2 × 10 par jambe"] },
      { name: "Séance C", items: ["Presse ou squat goblet 3 × 10", "Développé incliné haltères 3 × 8-10", "Tirage horizontal 3 × 10", "Biceps et triceps 2 × 12"] },
    ],
    4: [
      { name: "Haut du corps 1", items: ["Développé couché 4 × 6-8", "Rowing 4 × 8", "Développé militaire 3 × 8", "Tractions 3 × max", "Triceps et biceps 2 × 12"] },
      { name: "Bas du corps 1", items: ["Squat 4 × 6-8", "Soulevé de terre roumain 3 × 8", "Fentes 3 × 10", "Mollets 3 × 12", "Gainage 3 × 45 s"] },
      { name: "Haut du corps 2", items: ["Développé incliné 4 × 8", "Tirage vertical 4 × 8-10", "Élévations latérales 3 × 12-15", "Face pull 3 × 15", "Dips ou pompes 2 × max"] },
      { name: "Bas du corps 2", items: ["Presse ou squat avant 4 × 8-10", "Hip thrust 3 × 10", "Leg curl 3 × 12", "Mollets 3 × 12", "Gainage 3 × 45 s"] },
    ],
    5: [
      { name: "Poussée", items: ["Développé couché 4 × 6-8", "Développé militaire 3 × 8", "Développé incliné 3 × 10", "Élévations latérales 3 × 15", "Triceps 3 × 12"] },
      { name: "Tirage", items: ["Tractions 4 × max", "Rowing 4 × 8", "Tirage horizontal 3 × 10", "Face pull 3 × 15", "Biceps 3 × 12"] },
      { name: "Jambes", items: ["Squat 4 × 6-8", "Soulevé de terre roumain 3 × 8", "Fentes 3 × 10", "Mollets 4 × 12", "Gainage 3 × 45 s"] },
      { name: "Haut du corps", items: ["Développé incliné haltères 3 × 10", "Tirage vertical 3 × 10", "Élévations latérales 3 × 15", "Biceps et triceps 3 × 12"] },
      { name: "Bas du corps", items: ["Presse 4 × 10", "Hip thrust 3 × 10", "Leg curl 3 × 12", "Mollets 3 × 15"] },
    ],
  };
  const TRAINING_RULES = [
    "Règle de progression : quand tu fais toutes les séries au haut de la fourchette, ajoute 2,5 kg (ou 1 à 2 répétitions).",
    "Repère OMS pour les adultes : 150 à 300 minutes d'activité modérée par semaine (marche rapide, vélo), et au moins 2 séances de renforcement.",
    "Sommeil : 7 à 9 heures par nuit. C'est là que tu récupères et que le muscle se construit.",
    "Échauffe-toi avec 1 à 2 séries légères avant chaque exercice. Stoppe en cas de douleur vive et demande un avis médical si elle persiste.",
  ];

  /* ============ Visage et coupe de cheveux ============ */
  const FACE_SHAPES = {
    oval: { label: "Ovale", desc: "Longueur environ 1,5 fois la largeur, front et mâchoire un peu moins larges que les pommettes.",
      goal: "Presque tout te va : garde l'équilibre.", avoid: "Une frange très lourde qui masque le front.", beard: "Toutes les barbes, courtes de préférence." },
    rond: { label: "Rond", desc: "Longueur et largeur proches, mâchoire douce, joues pleines.",
      goal: "Allonger : du volume sur le dessus, côtés courts.", avoid: "Du volume sur les côtés et les coupes pleines au niveau des joues.", beard: "Barbe courte et plus longue sur le menton pour allonger." },
    carre: { label: "Carré", desc: "Front, pommettes et mâchoire de largeur proche, mâchoire marquée.",
      goal: "Adoucir les angles : dessus texturé, mouvement.", avoid: "Les coupes très géométriques et plaquées.", beard: "Barbe courte et propre, sans élargir la mâchoire." },
    long: { label: "Allongé", desc: "Visage nettement plus long que large.",
      goal: "Raccourcir et élargir : frange, volume sur les côtés.", avoid: "Beaucoup de hauteur sur le dessus.", beard: "Barbe fournie sur les joues pour élargir." },
    coeur: { label: "Cœur", desc: "Front large, menton plus étroit.",
      goal: "Équilibrer le bas du visage : longueur sur le front, côtés pas trop courts.", avoid: "Un dessus très dégagé avec les côtés rasés de près.", beard: "Barbe qui donne du volume au menton." },
    diamant: { label: "Diamant", desc: "Pommettes les plus larges, front et mâchoire plus étroits.",
      goal: "Ajouter de la largeur au front : frange, volume sur le dessus.", avoid: "Les côtés plaqués qui accentuent les pommettes.", beard: "Barbe courte et régulière." },
    triangle: { label: "Triangle", desc: "Mâchoire plus large que le front.",
      goal: "Ajouter du volume en haut pour équilibrer la mâchoire.", avoid: "Des côtés très larges ou une coupe plate sur le dessus.", beard: "Barbe courte, pas trop fournie sur la mâchoire." },
  };
  const HAIR_TYPES = { straight: "Raides", wavy: "Ondulés", curly: "Bouclés ou crépus" };
  const HAIR_LENGTHS = { any: "Peu importe", short: "Court", medium: "Mi-long", long: "Long" };
  const HAIR_DENSITY = { fine: "Fins ou clairsemés", normal: "Normaux", thick: "Épais" };

  function faceShape(m) {
    const L = +m.L, F = +m.F, C = +m.C, J = +m.J;
    if (!(L > 0 && F > 0 && C > 0 && J > 0)) return null;
    const ratio = L / C;
    let key;
    if (J > C && J >= F * 1.05) key = "triangle";
    else if (C >= F * 1.12 && C >= J * 1.12) key = "diamant";
    else if (F >= C * 0.98 && J <= C * 0.8) key = "coeur";
    else if (ratio >= 1.5) key = "long";
    else if (ratio <= 1.2) key = J / C >= 0.88 ? "carre" : "rond";
    else key = "oval";
    return key;
  }
  const CUTS = [
    { name: "Dégradé et dessus texturé", length: "short", types: ["straight", "wavy", "curly"], shapes: ["oval", "rond", "carre", "triangle", "coeur", "diamant"],
      how: "Dégradé progressif (de 3 à 6 mm sur les côtés), 5 à 7 cm sur le dessus, texturé aux ciseaux." },
    { name: "Quiff ou pompadour modéré", length: "short", types: ["straight", "wavy"], shapes: ["oval", "rond", "carre", "triangle"],
      how: "Côtés courts dégradés, 8 à 10 cm sur le dessus, coiffé vers le haut et l'arrière." },
    { name: "Crop texturé avec frange courte", length: "short", types: ["straight", "wavy", "curly"], shapes: ["oval", "long", "carre", "coeur", "diamant"],
      how: "Dessus 3 à 5 cm texturé, frange courte vers l'avant, côtés dégradés." },
    { name: "Raie sur le côté classique", length: "short", types: ["straight", "wavy"], shapes: ["oval", "rond", "carre", "coeur"],
      how: "Raie nette, côtés dégradés propres, dessus 6 à 8 cm peigné." },
    { name: "Mi-long en mouvement (flow)", length: "medium", types: ["straight", "wavy"], shapes: ["oval", "long", "coeur", "diamant", "carre"],
      how: "Longueur aux oreilles et à la nuque, dessus 10 cm ou plus, coupe aux ciseaux." },
    { name: "Undercut avec dessus coiffé", length: "short", types: ["straight", "wavy"], shapes: ["oval", "rond", "carre", "triangle"],
      how: "Côtés et nuque rasés court, dessus plus long, séparation marquée." },
    { name: "Boucles courtes et dégradé", length: "short", types: ["curly"], shapes: ["oval", "rond", "carre", "coeur", "diamant", "triangle"],
      how: "Dégradé sur les côtés, boucles conservées sur le dessus (6 à 8 cm)." },
    { name: "Boucles mi-longues", length: "medium", types: ["curly", "wavy"], shapes: ["oval", "long", "coeur", "diamant", "carre"],
      how: "Coupe aux ciseaux sur cheveux secs, volume contrôlé, nuque dégagée." },
    { name: "Coupe rasée courte (tondeuse)", length: "short", types: ["straight", "wavy", "curly"], shapes: ["oval", "carre"],
      how: "Tondeuse sur toute la tête, de 3 à 9 mm, avec un contour net." },
    { name: "Frange latérale ou rideau", length: "medium", types: ["straight", "wavy"], shapes: ["oval", "long", "coeur", "diamant"],
      how: "Frange qui tombe sur le côté du front, côtés nets, nuque dégradée." },
  ];
  const CUTS_F = [
    { name: "Pixie texturée", length: "short", types: ["straight", "wavy", "curly"], shapes: ["oval", "coeur", "diamant", "long"], who: "femme",
      how: "Dessus de 4 à 6 cm texturé, nuque et tempes courtes, frange effilée." },
    { name: "Carré court (bob) au menton", length: "short", types: ["straight", "wavy"], shapes: ["oval", "long", "coeur", "diamant", "triangle"], who: "femme",
      how: "Coupe nette au niveau du menton, légèrement dégradée dans la nuque." },
    { name: "Carré plongeant", length: "medium", types: ["straight", "wavy"], shapes: ["rond", "carre", "oval", "triangle"], who: "femme",
      how: "Plus long devant que derrière, pointes effilées pour allonger le visage." },
    { name: "Lob (carré long) aux épaules", length: "medium", types: ["straight", "wavy", "curly"], shapes: ["oval", "rond", "carre", "long", "coeur", "diamant", "triangle"], who: "femme",
      how: "Longueur aux clavicules, quelques mèches étagées pour le mouvement." },
    { name: "Coupe étagée (shag)", length: "medium", types: ["straight", "wavy", "curly"], shapes: ["oval", "long", "carre", "coeur", "diamant"], who: "femme",
      how: "Étages courts sur le dessus, longueurs conservées, frange rideau possible." },
    { name: "Cheveux longs dégradés", length: "long", types: ["straight", "wavy", "curly"], shapes: ["oval", "rond", "carre", "long", "coeur", "diamant", "triangle"], who: "femme",
      how: "Longueur conservée, dégradé léger pour alléger les pointes et donner du mouvement." },
    { name: "Frange rideau et longueurs", length: "long", types: ["straight", "wavy"], shapes: ["rond", "carre", "long", "coeur", "diamant", "oval"], who: "femme",
      how: "Frange ouverte au milieu qui retombe de chaque côté, longueurs au-dessous des épaules." },
    { name: "Frange droite", length: "medium", types: ["straight", "wavy"], shapes: ["oval", "long", "diamant", "coeur"], who: "femme",
      how: "Frange pleine à hauteur des sourcils, longueurs au choix." },
    { name: "Coupe courte bouclée", length: "short", types: ["curly"], shapes: ["oval", "rond", "carre", "coeur", "diamant", "triangle", "long"], who: "femme",
      how: "Coupe sur cheveux secs, forme arrondie, volume maîtrisé sur les côtés." },
    { name: "Queue de cheval ou chignon haut", length: "long", types: ["straight", "wavy", "curly"], shapes: ["rond", "carre", "oval", "triangle"], who: "femme",
      how: "Coiffure plutôt que coupe : attaches hautes pour allonger le visage, quelques mèches libres devant." },
  ];
  function cutLinks(cut) {
    const q = encodeURIComponent("coupe " + (cut.who || "homme") + " " + cut.name);
    return { images: "https://www.google.com/search?tbm=isch&q=" + q, pinterest: "https://www.pinterest.com/search/pins/?q=" + q };
  }
  function recommendCuts(shape, hairType, length, density, gender) {
    const ok = (c) => c.shapes.indexOf(shape) >= 0 && c.types.indexOf(hairType) >= 0;
    const m = CUTS.filter(ok), f = CUTS_F.filter(ok);
    let list;
    if (gender === "f") list = f;
    else if (gender === "x") { list = []; for (let i = 0; i < Math.max(m.length, f.length); i++) { if (m[i]) list.push(m[i]); if (f[i]) list.push(f[i]); } }
    else list = m;
    if (length && length !== "any") {
      const pref = list.filter((c) => c.length === length);
      if (pref.length) list = pref;
    }
    if (density === "fine") {
      const short = list.filter((c) => c.length === "short");
      if (short.length) list = short;
    }
    return list.slice(0, 4);
  }
  function hairNotes(hairType, density) {
    const out = [];
    if (density === "fine") out.push("Cheveux fins : privilégie le court et le texturé, le long accentue l'effet clairsemé.");
    if (density === "thick") out.push("Cheveux épais : demande à alléger (effilage) et un dégradé pour garder une forme nette.");
    if (hairType === "curly") out.push("Cheveux bouclés : fais-les couper secs ou à moitié secs, et évite la tondeuse sur le dessus.");
    if (hairType === "straight") out.push("Cheveux raides : un peu de poudre ou de pâte texturisante donne du volume.");
    return out;
  }

  /* ================= v4 : intérêts, liens d'achat, prix relevés, scan, planning ================= */
  const encQ = (s) => encodeURIComponent(s);

  // Intérêts annuels des livrets : crédités chaque 31 décembre (estimation sur le solde connu)
  function applyAnnualInterest(acc, today) {
    const out = [];
    if (!acc || acc.type !== "livret" || acc.autoInterest === false || !(acc.rate > 0) || !(acc.history && acc.history.length)) return out;
    const lastDate = acc.history[acc.history.length - 1].date, lp = parseDate(lastDate), tp = parseDate(today);
    if (!lp || !tp) return out;
    for (let y = lp.y; y <= tp.y; y++) {
      const dec = y + "-12-31";
      if (!(dec > lastDate && dec <= today)) continue;
      const frac = y === lp.y ? Math.min(1, (dayNum(dec) - dayNum(lastDate)) / 365) : 1;
      const amount = Math.round(acc.balance * (acc.rate / 100) * frac * 100) / 100;
      addSnapshot(acc, dec, Math.round((acc.balance + amount) * 100) / 100);
      if (!Array.isArray(acc.interestLog)) acc.interestLog = [];
      acc.interestLog.push({ date: dec, amount });
      out.push({ date: dec, amount, name: acc.name });
    }
    return out;
  }
  function applyAllInterest(accounts, today) {
    return [].concat(...accounts.map((a) => applyAnnualInterest(a, today)));
  }

  // Liens d'achat
  const RETAILERS = [["Lidl", "lidl.fr"], ["Aldi", "aldi.fr"], ["Carrefour", "carrefour.fr"], ["Auchan", "auchan.fr"], ["Leclerc", "e.leclerc"], ["Intermarché", "intermarche.com"]];
  function foodSearchLinks(name) {
    return RETAILERS.map((r) => ({ name: r[0], url: "https://www.google.com/search?q=" + encQ(name + " site:" + r[1]) }));
  }
  function vintedLink(q) { return "https://www.vinted.fr/catalog?search_text=" + encQ(q); }
  function shoppingLink(q) { return "https://www.google.com/search?tbm=shop&q=" + encQ(q); }
  function pieceQuery(piece) {
    return piece.replace(/\(.*?\)/g, "").split(" ou ")[0].replace(/\s+/g, " ").trim().toLowerCase();
  }
  function clothingLinks(piece, brands) {
    const q = pieceQuery(piece);
    const out = [{ name: "Vinted", url: vintedLink(q), kind: "second" }, { name: "Neuf", url: shoppingLink(q), kind: "new" }];
    (brands || []).slice(0, 3).forEach((b) => out.push({ name: b + " sur Vinted", url: vintedLink(b + " " + q), kind: "brand" }));
    return out;
  }
  const SECOND_HAND_FACTOR = 0.55;
  function secondHandCatalog(catalog) {
    return catalog.map((c) => (/chaussettes|sous-v/i.test(c.item) ? c : Object.assign({}, c, {
      price_low: Math.round(c.price_low * SECOND_HAND_FACTOR), price_mid: Math.round(c.price_mid * SECOND_HAND_FACTOR), price_high: Math.round(c.price_high * SECOND_HAND_FACTOR),
    })));
  }

  // Prix relevés (Open Prices, base collaborative d'Open Food Facts)
  const OP_TAGS = {
    banane: "en:bananas", pomme: "en:apples", poire: "en:pears", orange: "en:oranges", clementine: "en:clementines", kiwi: "en:kiwis",
    raisin: "en:grapes", fraise: "en:strawberries", carotte: "en:carrots", courgette: "en:zucchini", tomate: "en:tomatoes", poireau: "en:leeks",
    "chou-fleur": "en:cauliflowers", brocoli: "en:broccoli", epinards: "en:spinach", courge: "en:pumpkins", "haricots-verts": "en:green-beans",
    champignons: "en:mushrooms", salade: "en:lettuces", oignon: "en:onions", "pommes-de-terre": "en:potatoes",
  };
  const CITY_COORDS = {
    versailles: [48.8049, 2.1204], paris: [48.8566, 2.3522], lille: [50.6292, 3.0573], luxembourg: [49.6116, 6.1319], zurich: [47.3769, 8.5417],
    lyon: [45.764, 4.8357], marseille: [43.2965, 5.3698], toulouse: [43.6047, 1.4442], bordeaux: [44.8378, -0.5792], nantes: [47.2184, -1.5536],
    strasbourg: [48.5734, 7.7521], nice: [43.7102, 7.262], rennes: [48.1173, -1.6778], montpellier: [43.6108, 3.8767],
  };
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  function openPricesUrl(foodId, city, today, days) {
    const tag = OP_TAGS[foodId];
    if (!tag) return null;
    const d = new Date(Date.UTC(parseDate(today).y, parseDate(today).mo - 1, parseDate(today).d) - (days || 120) * 86400000);
    let u = "https://prices.openfoodfacts.org/api/v1/prices?category_tag=" + encQ(tag) + "&currency=EUR&order_by=-date&size=100&date__gte=" + d.toISOString().slice(0, 10);
    const c = CITY_COORDS[norm(city)];
    if (c) u += "&lat=" + c[0] + "&lon=" + c[1] + "&radius_km=30";
    return u;
  }
  const CHAINS = [["Lidl", /lidl/i], ["Aldi", /aldi/i], ["Carrefour", /carrefour/i], ["Leclerc", /leclerc/i], ["Auchan", /auchan/i], ["Intermarché", /intermarch/i],
    ["Monoprix", /monoprix/i], ["Casino", /casino/i], ["Super U", /\bu\b|super u|hyper u|u express/i], ["Biocoop", /biocoop/i], ["Grand Frais", /grand frais/i], ["Picard", /picard/i]];
  function medianOf(a) { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function summarizePrices(resp) {
    const items = (resp && resp.items) || [];
    const all = [], by = {};
    items.forEach((it) => {
      const price = parseFloat(it.price);
      if (!(price > 0) || String(it.price_per || "").toUpperCase() !== "KILOGRAM" || (it.currency && it.currency !== "EUR")) return;
      all.push(price);
      const loc = it.location || {}, label = (loc.osm_brand || "") + " " + (loc.osm_name || "");
      const ch = CHAINS.find((c) => c[1].test(label));
      if (ch) { (by[ch[0]] = by[ch[0]] || []).push(price); }
    });
    const byChain = {};
    Object.keys(by).forEach((k) => { byChain[k] = { median: medianOf(by[k]), n: by[k].length }; });
    return { n: all.length, median: all.length ? medianOf(all) : null, byChain };
  }

  // Visage : mesures à partir des points du maillage (MediaPipe Face Mesh, 468 points)
  const FACE_PTS = { top: 10, chin: 152, fL: 54, fR: 284, cL: 234, cR: 454, jL: 172, jR: 397, nose: 1 };
  function measuresFromLandmarks(lm, W, H) {
    if (!lm || lm.length < 468) return null;
    const P = (i) => [lm[i].x * W, lm[i].y * H];
    const dist = (a, b) => { const p = P(a), q = P(b); return Math.hypot(p[0] - q[0], p[1] - q[1]); };
    const dl = dist(FACE_PTS.nose, FACE_PTS.cL), dr = dist(FACE_PTS.nose, FACE_PTS.cR);
    const yaw = Math.abs(dl - dr) / (dl + dr);
    const C = dist(FACE_PTS.cL, FACE_PTS.cR);
    if (!(C > 0)) return null;
    const k = 14 / C; // échelle arbitraire : pommettes ≈ 14 cm (seuls les rapports comptent)
    const r1 = (x) => Math.round(x * k * 10) / 10;
    return { L: r1(dist(FACE_PTS.top, FACE_PTS.chin)), F: r1(dist(FACE_PTS.fL, FACE_PTS.fR)), C: 14, J: r1(dist(FACE_PTS.jL, FACE_PTS.jR)), yaw, frontal: yaw < 0.12 };
  }

  // Programme selon le rythme de vie
  const EX = {
    squat: { gym: "Squat", db: "Squat gobelet (haltère)", none: "Squat poids du corps, descente lente" },
    bench: { gym: "Développé couché", db: "Développé couché haltères (ou au sol)", none: "Pompes" },
    incline: { gym: "Développé incliné", db: "Développé incliné haltères", none: "Pompes pieds surélevés" },
    row: { gym: "Rowing barre ou machine", db: "Rowing haltère à un bras", none: "Rowing inversé sous une table solide" },
    ohp: { gym: "Développé militaire", db: "Développé épaules haltères", none: "Pompes en V (pike)" },
    pull: { gym: "Tractions ou tirage vertical", db: "Tractions (barre de porte) ou rowing haltères", none: "Tractions (barre de porte) ou rowing inversé" },
    rdl: { gym: "Soulevé de terre roumain", db: "Soulevé de terre roumain haltères", none: "Soulevé de terre à une jambe, poids du corps" },
    lunge: { gym: "Fentes", db: "Fentes haltères", none: "Fentes marchées" },
    plank: { gym: "Gainage", db: "Gainage", none: "Gainage" },
    curl: { gym: "Curl biceps", db: "Curl haltères", none: "Curl avec un sac chargé" },
    tri: { gym: "Triceps à la poulie", db: "Extension triceps haltère", none: "Dips entre deux chaises" },
    lat: { gym: "Élévations latérales", db: "Élévations latérales", none: "Élévations latérales avec bouteilles d'eau" },
    face: { gym: "Face pull", db: "Oiseau haltères", none: "Superman au sol" },
    calf: { gym: "Mollets", db: "Mollets", none: "Mollets sur une marche" },
    hip: { gym: "Hip thrust", db: "Hip thrust haltère", none: "Pont fessier" },
    legpress: { gym: "Presse à cuisses", db: "Squat bulgare haltères", none: "Squat bulgare" },
    legcurl: { gym: "Leg curl", db: "Soulevé de terre jambes tendues haltères", none: "Leg curl glissé (serviette au sol)" },
  };
  const PLAN_PROGRAMS = {
    1: [{ name: "Corps entier", ex: [["squat", 3, "6-8"], ["bench", 3, "6-8"], ["row", 3, "8"], ["rdl", 2, "8"], ["plank", 2, "30-45 s"]] }],
    2: [
      { name: "Corps entier A", ex: [["squat", 3, "6-8"], ["bench", 3, "6-8"], ["row", 3, "8"], ["plank", 3, "30-45 s"]] },
      { name: "Corps entier B", ex: [["rdl", 3, "8"], ["ohp", 3, "8"], ["pull", 3, "6-10"], ["lunge", 2, "10"]] },
    ],
    3: [
      { name: "Séance A", ex: [["squat", 3, "6-8"], ["bench", 3, "6-8"], ["row", 3, "8"], ["plank", 3, "30-45 s"]] },
      { name: "Séance B", ex: [["rdl", 3, "8"], ["ohp", 3, "8"], ["pull", 3, "6-10"], ["lunge", 2, "10"]] },
      { name: "Séance C", ex: [["legpress", 3, "10"], ["incline", 3, "8-10"], ["row", 3, "10"], ["curl", 2, "12"], ["tri", 2, "12"]] },
    ],
    4: [
      { name: "Haut du corps 1", ex: [["bench", 4, "6-8"], ["row", 4, "8"], ["ohp", 3, "8"], ["pull", 3, "max"], ["tri", 2, "12"], ["curl", 2, "12"]] },
      { name: "Bas du corps 1", ex: [["squat", 4, "6-8"], ["rdl", 3, "8"], ["lunge", 3, "10"], ["calf", 3, "12"], ["plank", 3, "45 s"]] },
      { name: "Haut du corps 2", ex: [["incline", 4, "8"], ["pull", 4, "8-10"], ["lat", 3, "12-15"], ["face", 3, "15"], ["tri", 2, "12"]] },
      { name: "Bas du corps 2", ex: [["legpress", 4, "8-10"], ["hip", 3, "10"], ["legcurl", 3, "12"], ["calf", 3, "12"], ["plank", 3, "45 s"]] },
    ],
    5: [
      { name: "Poussée", ex: [["bench", 4, "6-8"], ["ohp", 3, "8"], ["incline", 3, "10"], ["lat", 3, "15"], ["tri", 3, "12"]] },
      { name: "Tirage", ex: [["pull", 4, "max"], ["row", 4, "8"], ["face", 3, "15"], ["curl", 3, "12"]] },
      { name: "Jambes", ex: [["squat", 4, "6-8"], ["rdl", 3, "8"], ["lunge", 3, "10"], ["calf", 4, "12"], ["plank", 3, "45 s"]] },
      { name: "Haut du corps", ex: [["incline", 3, "10"], ["pull", 3, "10"], ["lat", 3, "15"], ["curl", 3, "12"], ["tri", 3, "12"]] },
      { name: "Bas du corps", ex: [["legpress", 4, "10"], ["hip", 3, "10"], ["legcurl", 3, "12"], ["calf", 3, "15"]] },
    ],
  };
  const EQUIP = { gym: "Salle de sport", db: "Maison avec haltères ou élastiques", none: "Maison sans matériel" };
  const LEVELS = { beginner: "Débutant (moins de 1 an)", inter: "Intermédiaire (1 à 3 ans)" };
  const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const DAYS_LONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const AVAIL_STEPS = [0, 20, 30, 45, 60, 90];
  const DEFAULT_RHYTHM = { equip: "gym", level: "beginner", sleep: 7, weeks: [[45, 0, 60, 0, 45, 90, 0], [30, 0, 45, 0, 30, 60, 0]] };

  function combos(arr, k) {
    const out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
  }
  function pickDays(avail, n) {
    const cand = avail.map((m, i) => (m >= 25 ? i : -1)).filter((i) => i >= 0);
    n = Math.min(n, cand.length);
    if (n <= 0) return [];
    let best = null, bestScore = -1;
    combos(cand, n).forEach((c) => {
      let gap = 7;
      if (c.length > 1) {
        gap = 7 - (c[c.length - 1] - c[0]);
        for (let i = 1; i < c.length; i++) gap = Math.min(gap, c[i] - c[i - 1]);
      }
      const score = gap * 1000 + c.reduce((s, d) => s + avail[d], 0);
      if (score > bestScore) { bestScore = score; best = c; }
    });
    return best;
  }
  const exMinutes = (e) => e[1] * 2.5 + 0.5;
  function fitSession(sess, minutes, equip, level) {
    let ex = sess.ex.map((e) => [e[0], level === "beginner" ? Math.max(2, e[1] - 1) : e[1], e[2]]);
    const budget = minutes - 5; // échauffement
    const total = () => ex.reduce((s, e) => s + exMinutes(e), 0);
    while (total() > budget && ex.length > 3) ex.pop();
    while (total() > budget && ex.some((e) => e[1] > 2)) { const i = ex.findIndex((e) => e[1] > 2); ex[i] = [ex[i][0], ex[i][1] - 1, ex[i][2]]; }
    return {
      name: sess.name, minutes: Math.round(5 + total()),
      exercises: ex.map((e) => ({ name: EX[e[0]][equip] || EX[e[0]].gym, scheme: e[1] + " × " + e[2] })),
    };
  }
  function planWeek(avail, o) {
    const notes = [];
    let n = Math.min(5, Math.max(1, Math.round(o.sessions || 3)));
    if (o.sleep && o.sleep < 6) { n = Math.max(1, n - 1); notes.push("Tu dors moins de 6 h : j'ai retiré une séance. La récupération passe avant le volume."); }
    const days = pickDays(avail, n);
    if (!days.length) return { days: DAYS.map((d, i) => ({ day: i, kind: "repos", title: "Repos", minutes: 0 })), notes: ["Aucun jour avec au moins 25 minutes : ajoute du temps libre pour obtenir un programme."], sessions: 0, strengthMin: 0, cardioMin: 0 };
    if (days.length < n) notes.push("Tu n'as que " + days.length + " jour(s) avec 25 min ou plus : le programme est réduit en conséquence.");
    const prog = PLAN_PROGRAMS[days.length];
    const out = DAYS.map((d, i) => ({ day: i, kind: "repos", title: "Repos", minutes: 0 }));
    let strength = 0;
    days.forEach((d, k) => {
      const s = fitSession(prog[k], avail[d], o.equip, o.level);
      out[d] = Object.assign({ day: d, kind: "force", title: s.name }, s);
      strength += s.minutes;
    });
    const cardioDays = avail.map((m, i) => (out[i].kind === "repos" && m >= 20 ? i : -1)).filter((i) => i >= 0)
      .sort((a, b) => avail[b] - avail[a]).slice(0, o.goal === "lose" ? 3 : o.goal === "gain" ? 1 : 2).sort((a, b) => a - b);
    let cardio = 0;
    cardioDays.forEach((d) => {
      const mins = Math.min(45, avail[d]);
      out[d] = { day: d, kind: "cardio", title: "Cardio léger", minutes: mins, exercises: [{ name: "Marche rapide, vélo ou natation", scheme: mins + " min, tu dois pouvoir parler" }] };
      cardio += mins;
    });
    if (strength + cardio < 150) notes.push("Total " + (strength + cardio) + " min par semaine : sous les 150 min conseillées. Ajoute de la marche au quotidien (escaliers, trajets à pied) pour compléter.");
    if (days.length >= 2 && (days[1] - days[0] === 1 || days[days.length - 1] - days[days.length - 2] === 1) && days.length <= 3)
      notes.push("Deux séances se suivent : change les groupes musculaires ou prends un jour de repos si tu es fatigué.");
    return { days: out, notes, sessions: days.length, strengthMin: strength, cardioMin: cardio };
  }

  return {
    LIVRET_CAP, PEA_CAP, todayISO, defaultAccounts, newAccount, addSnapshot, totalWorth, netWorthSeries,
    peaStats, livretStats, importAccountCSV, brandsFor, JOB_TYPES, CITIES, REGION_OF_CITY, REGION_LABELS,
    EMPLOYERS, jobLinks, jobQuery, employerLink, insights, STATUSES, STATUS_DEFAULTS, GENDERS, catalogFor, CUTS_F,
    ACTIVITY, BODY_GOALS, DEFAULT_BODY, DEFAULT_LOOK, bmr, tdee, bmi, bmiLabel, calorieTarget, macroTargets, weeksToTarget, addWeight, weightTrend,
    FOODS, FOOD_BY_ID, FOOD_CATS, isFV, inSeason, seasonalProduce, basketTotals, suggestedBasket, basketAdvice, SWAPS, STORES, storeLink, produceLink,
    applyAnnualInterest, applyAllInterest, RETAILERS, foodSearchLinks, vintedLink, shoppingLink, pieceQuery, clothingLinks, SECOND_HAND_FACTOR, secondHandCatalog,
    OP_TAGS, CITY_COORDS, openPricesUrl, summarizePrices, FACE_PTS, measuresFromLandmarks,
    EX, PLAN_PROGRAMS, EQUIP, LEVELS, DAYS, DAYS_LONG, AVAIL_STEPS, DEFAULT_RHYTHM, planWeek, pickDays,
    PROGRAMS, TRAINING_RULES, FACE_SHAPES, HAIR_TYPES, HAIR_LENGTHS, HAIR_DENSITY, faceShape, CUTS, cutLinks, recommendCuts, hairNotes,
    MEDIAN, STYLES, STYLE_LABELS, TIERS, TIER_LABELS, CATALOG, DEFAULT_PROFILE, HOURS_WARNING,
    STUDENT, nationalBands, bandFor, bandIndex, nextBand, fmtBand, eur, nf,
    budget, netGain, combine, project, monthsToTarget, planWardrobe, importBank, parseCSV,
  };
});
