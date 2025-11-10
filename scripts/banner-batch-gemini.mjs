#!/usr/bin/env node
// Batch banner generator with logos
// - Overlay one or multiple logos on a fixed banner area
// - Optionally detect/crop multiple logos from a single sheet using Gemini 1.5 Flash
// Usage examples:
// node scripts/banner-batch-gemini.mjs \
//   --banner assets/banner.png --logos assets/logos/a.png,assets/logos/b.png \
//   --out out/banners --box 0.75,0.05,0.2,0.2
// node scripts/banner-batch-gemini.mjs \
//   --banner assets/banner.png --logosSheet assets/sheet.png --sheet-detection \
//   --out out/banners --all-in-one --box 0.7,0.08,0.25,0.18

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Lazy import to avoid requiring API key when not used
let GoogleGenerativeAI = null;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isNormalizedBox(boxStr) {
  return /^(\d*\.?\d+),(\d*\.?\d+),(\d*\.?\d+),(\d*\.?\d+)$/.test(boxStr);
}

async function loadImageBuffer(p) {
  return fs.promises.readFile(p);
}

function pxBoxFromNormalized(boxNorm, baseW, baseH) {
  const [nx, ny, nw, nh] = boxNorm;
  return [
    Math.round(nx * baseW),
    Math.round(ny * baseH),
    Math.round(nw * baseW),
    Math.round(nh * baseH),
  ];
}

async function getImageSize(buf) {
  const meta = await sharp(buf).metadata();
  return { width: meta.width, height: meta.height };
}

async function resizeToFit(logoBuf, targetW, targetH, pad = 0) {
  const maxW = Math.max(1, targetW - pad * 2);
  const maxH = Math.max(1, targetH - pad * 2);
  return sharp(logoBuf).resize({
    width: maxW,
    height: maxH,
    fit: 'inside',
    withoutEnlargement: false,
  }).toBuffer();
}

async function compositeLogoOnBanner({ bannerBuf, logoBuf, boxPx, align = 'center', pad = 0 }) {
  const [x, y, w, h] = boxPx;
  const resized = await resizeToFit(logoBuf, w, h, pad);
  const { width: lw, height: lh } = await getImageSize(resized);

  let left = x;
  let top = y;
  if (align === 'center') {
    left = x + Math.round((w - lw) / 2);
    top = y + Math.round((h - lh) / 2);
  } else if (align === 'top-left') {
    left = x + pad;
    top = y + pad;
  } else if (align === 'bottom-right') {
    left = x + w - lw - pad;
    top = y + h - lh - pad;
  }

  return sharp(bannerBuf)
    .composite([{ input: resized, left, top }])
    .toBuffer();
}

async function compositeGridOfLogos({ bannerBuf, logoBufs, boxPx, cols = 2, pad = 8 }) {
  const [x, y, w, h] = boxPx;
  const rows = Math.ceil(logoBufs.length / cols);
  const cellW = Math.floor((w - pad * (cols + 1)) / cols);
  const cellH = Math.floor((h - pad * (rows + 1)) / rows);

  let img = sharp(bannerBuf);
  const composites = [];

  for (let i = 0; i < logoBufs.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const resized = await resizeToFit(logoBufs[i], cellW, cellH, 0);
    const { width: lw, height: lh } = await getImageSize(resized);
    const left = x + pad + col * (cellW + pad) + Math.floor((cellW - lw) / 2);
    const top = y + pad + row * (cellH + pad) + Math.floor((cellH - lh) / 2);
    composites.push({ input: resized, left, top });
  }

  return img.composite(composites).toBuffer();
}

function b642inlineData(mime, b64) {
  return {
    inlineData: { data: b64, mimeType: mime },
  };
}

async function detectLogosWithGemini(sheetPath, { apiKey, max = 8 }) {
  if (!GoogleGenerativeAI) {
    ({ GoogleGenerativeAI } = await import('@google/generative-ai'));
  }
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const buf = await fs.promises.readFile(sheetPath);
  const b64 = buf.toString('base64');
  const mime = inferMime(sheetPath);

  const prompt = [
    'Você é um assistente de visão. Extraia bounding boxes (em pixels) de cada LOGO distinto presente na imagem fornecida.',
    'Retorne um JSON estrito com o seguinte formato:',
    '{ "boxes": [ {"x": <int>, "y": <int>, "width": <int>, "height": <int>} ... ] }',
    `- Max de boxes: ${max}`,
    '- Não inclua texto fora do JSON. Sem comentários.',
    '- Tente isolar cada marca/insígnia visível. Evite recortes muito grandes com fundo desnecessário.',
  ].join('\n');

  const result = await model.generateContent([
    b642inlineData(mime, b64),
    { text: prompt },
  ]);
  const text = result.response.text().trim();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Falha ao interpretar JSON de detecção do Gemini. Conteúdo recebido: ' + text);
  }
  if (!data || !Array.isArray(data.boxes)) {
    throw new Error('Resposta do Gemini sem o campo boxes válido.');
  }
  return data.boxes;
}

async function cropBoxes(buf, boxes, outDir) {
  const crops = [];
  const baseSharp = sharp(buf);
  const meta = await baseSharp.metadata();
  for (let i = 0; i < boxes.length; i++) {
    const { x, y, width, height } = boxes[i];
    // Clamp to image bounds
    const region = {
      left: Math.max(0, Math.min(x, (meta.width ?? 0) - 1)),
      top: Math.max(0, Math.min(y, (meta.height ?? 0) - 1)),
      width: Math.max(1, Math.min(width, (meta.width ?? 1))),
      height: Math.max(1, Math.min(height, (meta.height ?? 1))),
    };
    const cropBuf = await sharp(buf).extract(region).toBuffer();
    const p = path.join(outDir, `logo_${i + 1}.png`);
    await sharp(cropBuf).png().toFile(p);
    crops.push(p);
  }
  return crops;
}

function inferMime(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function main() {
  const args = parseArgs();
  const bannerPath = args.banner;
  const outDir = args.out || 'out/banners';
  const boxStr = args.box || '0.75,0.05,0.2,0.2'; // normalized: x,y,w,h
  const pad = args.pad ? Number(args.pad) : 0;
  const allInOne = !!args['all-in-one'];
  const cols = args.cols ? Number(args.cols) : 2;
  const count = args.count ? Number(args.count) : undefined;
  const allowRepeat = !!args['allow-repeat'];

  if (!bannerPath) {
    console.error('Erro: --banner é obrigatório');
    process.exit(1);
  }
  if (!isNormalizedBox(boxStr)) {
    console.error('Erro: --box deve ser no formato normalizado x,y,w,h (0..1)');
    process.exit(1);
  }

  ensureDir(outDir);
  const bannerBuf = await loadImageBuffer(bannerPath);
  const { width: bw, height: bh } = await getImageSize(bannerBuf);
  const boxNorm = boxStr.split(',').map(Number);
  const boxPx = pxBoxFromNormalized(boxNorm, bw, bh);

  let logoPaths = [];
  if (args.logos) {
    logoPaths = args.logos.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (args.logosDir) {
    const entries = fs.readdirSync(args.logosDir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .map((f) => path.join(args.logosDir, f));
    logoPaths.push(...entries);
  }

  // Sheet detection using Gemini (optional)
  if (args.logosSheet || args['sheet-detection']) {
    const sheetPath = args.logosSheet;
    if (!sheetPath) {
      console.error('Erro: --logosSheet é obrigatório quando usa --sheet-detection');
      process.exit(1);
    }
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_APIKEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Erro: defina GOOGLE_API_KEY (ou GEMINI_API_KEY) no ambiente para detecção no Gemini.');
      process.exit(1);
    }
    const max = args.maxLogos ? Number(args.maxLogos) : 8;
    const boxes = await detectLogosWithGemini(sheetPath, { apiKey, max });
    const buf = await fs.promises.readFile(sheetPath);
    const cropsDir = path.join(outDir, 'crops');
    ensureDir(cropsDir);
    const crops = await cropBoxes(buf, boxes, cropsDir);
    logoPaths.push(...crops);
  }

  // Deduplicate
  logoPaths = Array.from(new Set(logoPaths));
  if (logoPaths.length === 0) {
    console.error('Nenhum logo encontrado. Use --logos, --logosDir, ou --logosSheet + --sheet-detection.');
    process.exit(1);
  }

  const logoBufs = await Promise.all(logoPaths.map((p) => loadImageBuffer(p)));

  if (allInOne) {
    const outPath = path.join(outDir, `banner_all-in-one.png`);
    const outBuf = await compositeGridOfLogos({ bannerBuf, logoBufs, boxPx, cols, pad });
    await fs.promises.writeFile(outPath, outBuf);
    console.log('Gerado:', outPath);
    return;
  }

  // One version per logo (possibly limited by --count)
  let tasks = logoBufs.map((logoBuf, idx) => ({ logoBuf, idx }));
  if (typeof count === 'number') {
    if (logoBufs.length >= count) {
      tasks = tasks.slice(0, count);
    } else if (allowRepeat) {
      // Repeat logos to reach count
      const repeated = [];
      let i = 0;
      while (repeated.length < count) {
        repeated.push({ logoBuf: logoBufs[i % logoBufs.length], idx: i });
        i++;
      }
      tasks = repeated;
    } else {
      console.warn(`Aviso: --count=${count} > logos(${logoBufs.length}). Gerando ${logoBufs.length} versões.`);
    }
  }

  for (const t of tasks) {
    const outPath = path.join(outDir, `banner_${t.idx + 1}.png`);
    const outBuf = await compositeLogoOnBanner({ bannerBuf, logoBuf: t.logoBuf, boxPx, pad });
    await fs.promises.writeFile(outPath, outBuf);
    console.log('Gerado:', outPath);
  }
}

main().catch((err) => {
  console.error('Falha:', err?.message || err);
  process.exit(1);
});

