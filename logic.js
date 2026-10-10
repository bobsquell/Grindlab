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
    name: "", income: 1700, rent: 675, otherFixed: 0, essentials: 350,
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
  ].map((r) => ({
    item: r[0], category: r[1], style: r[2], essential: r[3],
    price_low: r[4], price_mid: r[5], price_high: r[6], wears: r[7], life: r[8],
  }));

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
      { id: "pea", name: "PEA Trade Republic", type: "pea", balance: 0, contributed: 0, rate: 0, openDate: "", history: [] },
      { id: "livret", name: "Livret A Boursorama", type: "livret", balance: 0, contributed: 0, rate: 1.5, openDate: "", history: [] },
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
  const JOB_TYPES = { alternance: "Alternance", cdi: "CDI junior", stage: "Stage" };
  const CITIES = { paris: "Paris", versailles: "Versailles", lille: "Lille", luxembourg: "Luxembourg", zurich: "Zurich", remote: "Télétravail" };
  const REGION_OF_CITY = { paris: "paris", versailles: "paris", remote: "paris", lille: "lille", luxembourg: "lu", zurich: "ch" };
  function jobQuery(q, type) {
    const w = type === "alternance" ? "alternance" : type === "stage" ? "stage" : "junior";
    return ((q || "") + " " + w).trim();
  }
  function jobLinks(city, q, type) {
    const e = encodeURIComponent, qq = jobQuery(q, type), loc = CITIES[city] || "";
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

  return {
    LIVRET_CAP, PEA_CAP, todayISO, defaultAccounts, newAccount, addSnapshot, totalWorth, netWorthSeries,
    peaStats, livretStats, importAccountCSV, brandsFor, JOB_TYPES, CITIES, REGION_OF_CITY, REGION_LABELS,
    EMPLOYERS, jobLinks, jobQuery, employerLink, insights,
    MEDIAN, STYLES, STYLE_LABELS, TIERS, TIER_LABELS, CATALOG, DEFAULT_PROFILE, HOURS_WARNING,
    STUDENT, nationalBands, bandFor, bandIndex, nextBand, fmtBand, eur, nf,
    budget, netGain, combine, project, monthsToTarget, planWardrobe, importBank, parseCSV,
  };
});
