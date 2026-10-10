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
    if (m) return { y: +m[3], mo: +m[2] };
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { y: +m[1], mo: +m[2] };
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

  return {
    MEDIAN, STYLES, STYLE_LABELS, TIERS, TIER_LABELS, CATALOG, DEFAULT_PROFILE, HOURS_WARNING,
    STUDENT, nationalBands, bandFor, bandIndex, nextBand, fmtBand, eur, nf,
    budget, netGain, combine, project, monthsToTarget, planWardrobe, importBank, parseCSV,
  };
});
