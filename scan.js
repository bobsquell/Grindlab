/* Scan de silhouette : MediaPipe Pose Landmarker (points du corps + masque de segmentation), 100 % dans le navigateur. */
const Scan = (() => {
const VERSIONS = ["0.10.14", "latest"];
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
let lmPromise = null;

function load() {
  if (lmPromise) return lmPromise;
  lmPromise = (async () => {
    let last;
    for (const v of VERSIONS) {
      try {
        const base = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + v;
        const mod = await import(base + "/vision_bundle.mjs");
        const files = await mod.FilesetResolver.forVisionTasks(base + "/wasm");
        const opts = (d) => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: "IMAGE", numPoses: 1, outputSegmentationMasks: true });
        try { return await mod.PoseLandmarker.createFromOptions(files, opts("GPU")); }
        catch (e) { return await mod.PoseLandmarker.createFromOptions(files, opts("CPU")); }
      } catch (e) { last = e; }
    }
    throw new Error("modèle de détection indisponible (internet requis à la première utilisation)" + (last ? " : " + last.message : ""));
  })();
  lmPromise.catch(() => { lmPromise = null; });
  return lmPromise;
}

async function toCanvas(file, canvas, maxSide) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch (e) {
    src = await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => rej(new Error("image illisible")); im.src = u; });
  }
  const sw = src.width, sh = src.height, k = Math.min(1, maxSide / Math.max(sw, sh));
  canvas.width = Math.round(sw * k); canvas.height = Math.round(sh * k);
  canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
  if (src.close) src.close();
}

/* Largeur du corps (pixels) sur une ligne : segment contigu de masque qui contient l'axe du corps. */
function runAt(arr, mw, y, cx) {
  const row = Math.max(0, Math.min(Math.round(y), Math.floor(arr.length / mw) - 1)), b = row * mw;
  let x = Math.round(cx);
  if (!(arr[b + x] >= 0.5)) {
    let found = -1;
    for (let d = 1; d < mw * 0.06 && found < 0; d++) { if (arr[b + x - d] >= 0.5) found = x - d; else if (arr[b + x + d] >= 0.5) found = x + d; }
    if (found < 0) return null; x = found;
  }
  let l = x, r = x;
  while (l > 0 && arr[b + l - 1] >= 0.5) l--;
  while (r < mw - 1 && arr[b + r + 1] >= 0.5) r++;
  return { l, r, w: r - l + 1, y: row };
}

function classify(s, w, h, gender) {
  if (w >= 0.95 * Math.max(s, h)) return "pomme";
  if (h > s * 1.08) return "poire";
  if (s > h * 1.08) return "inverse";
  if (gender === "h") return w <= 0.85 * s ? "inverse" : "rectangle";
  return w <= 0.80 * ((s + h) / 2) ? "sablier" : "rectangle";
}
function gabaritOf(avgRatio) { return avgRatio < 0.20 ? "mince" : avgRatio < 0.245 ? "moyen" : avgRatio < 0.285 ? "rond" : "grande"; }

function measure(arr, mw, mh, lm, gender) {
  const L = (i) => lm[i], vis = (i) => (L(i).visibility == null ? 1 : L(i).visibility);
  const warnings = []; let conf = 3;
  if ([11, 12, 23, 24].some((i) => vis(i) < 0.5)) throw new Error("épaules ou hanches non visibles : cadre-toi en entier, de face");
  const legsOk = [27, 28].every((i) => vis(i) >= 0.5 && L(i).y < 0.995);
  if (!legsOk) { warnings.push("Pieds coupés ou peu visibles : recule pour être entier(e) dans le cadre."); conf--; }
  const sy = (L(11).y + L(12).y) / 2 * mh, hy = (L(23).y + L(24).y) / 2 * mh, T = hy - sy;
  const cx = (L(23).x + L(24).x) / 2 * mw;
  if (!(T > mh * 0.08)) throw new Error("buste trop petit sur la photo : rapproche-toi un peu");
  const shW = Math.abs(L(11).x - L(12).x) * mw;
  if (shW / T < 0.5) { warnings.push("Tu sembles de profil ou de trois quarts : tiens-toi bien de face."); conf--; }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rowsW = (from, to, n) => { const out = []; for (let i = 0; i <= n; i++) { const r = runAt(arr, mw, sy + T * (from + (to - from) * i / n), cx); if (r) out.push(r); } return out; };
  const chest = rowsW(0.08, 0.2, 4), waist = rowsW(0.45, 0.85, 10), hip = rowsW(0.95, 1.2, 6);
  if (!chest.length || !waist.length || !hip.length) throw new Error("silhouette non détectée : fond uni et lumière de face aideront");
  const s = avg(chest.map((r) => r.w));
  const wr = waist.reduce((m, r) => (r.w < m.w ? r : m), waist[0]);
  const hr = hip.reduce((m, r) => (r.w > m.w ? r : m), hip[0]);
  let top = 0; for (let y = 0; y < mh; y++) { let any = false; for (let x = 0; x < mw; x += 4) if (arr[y * mw + x] >= 0.5) { any = true; break; } if (any) { top = y; break; } }
  const footY = legsOk ? (L(27).y + L(28).y) / 2 * mh : mh;
  const bodyH = Math.max(footY - top, 1);
  const armsAway = [15, 16].every((i) => vis(i) < 0.4 || Math.abs(L(i).x * mw - cx) > hr.w * 0.55);
  if (!armsAway) { warnings.push("Bras trop près du corps : écarte-les légèrement pour ne pas fausser la taille."); conf--; }
  if (Math.abs(L(23).y - L(24).y) * mh > T * 0.12 || Math.abs(L(11).y - L(12).y) * mh > T * 0.12) { warnings.push("Épaules ou hanches inclinées : tiens-toi droit(e)."); conf--; }
  const morpho = classify(s, wr.w, hr.w, gender);
  const gab = gabaritOf((s + wr.w + hr.w) / 3 / bodyH);
  return { morpho, gabarit: gab, s, w: wr.w, h: hr.w, bodyH, lines: [{ r: { l: avg(chest.map((r) => r.l)), r: avg(chest.map((r) => r.r)), y: avg(chest.map((r) => r.y)) } }, { r: wr }, { r: hr }],
    conf: conf >= 3 ? "hi" : conf === 2 ? "mid" : "lo", warnings, ratios: { waistShoulders: wr.w / s, hipsShoulders: hr.w / s } };
}

function overlay(canvas, res, lm) {
  const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  g.lineWidth = Math.max(2, W / 250); g.strokeStyle = "#3fcaa5"; g.fillStyle = "#3fcaa5";
  res.lines.forEach(({ r }) => { g.beginPath(); g.moveTo(r.l, r.y); g.lineTo(r.r, r.y); g.stroke(); [r.l, r.r].forEach((x) => { g.beginPath(); g.arc(x, r.y, g.lineWidth * 1.6, 0, 6.3); g.fill(); }); });
  g.fillStyle = "rgba(255,255,255,.85)";
  [0, 11, 12, 23, 24, 27, 28].forEach((i) => { if (lm[i]) { g.beginPath(); g.arc(lm[i].x * W, lm[i].y * H, g.lineWidth, 0, 6.3); g.fill(); } });
}

async function run(file, canvas, gender) {
  await toCanvas(file, canvas, 960);
  const pl = await load();
  const out = pl.detect(canvas);
  try {
    if (!out.landmarks || !out.landmarks.length) throw new Error("aucune personne détectée");
    const mask = out.segmentationMasks && out.segmentationMasks[0];
    if (!mask) throw new Error("masque de silhouette indisponible");
    const arr = mask.getAsFloat32Array(), res = measure(arr, mask.width, mask.height, out.landmarks[0], gender);
    overlay(canvas, res, out.landmarks[0]);
    return res;
  } finally { try { (out.segmentationMasks || []).forEach((m) => m.close()); } catch (e) {} }
}

return { run, measure, classify, gabaritOf };
})();
if (typeof module !== "undefined") module.exports = Scan;
