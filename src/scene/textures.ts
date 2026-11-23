import * as THREE from 'three';

const HK_SANS = "'Noto Sans CJK HK', 'Noto Sans CJK TC', 'PingFang HK', 'Microsoft JhengHei', sans-serif";
const HK_SERIF = "'Noto Serif CJK HK', 'Noto Serif CJK TC', 'Songti TC', Georgia, serif";

// Deterministic PRNG for repeatable procedural weathering
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

/**
 * Computes the largest uniform font size (in px) in [minPx, maxPx] whose natural
 * measured width fits within maxAllowedW. NEVER uses ctx.fillText(..., maxWidth)
 * so CJK and Latin glyphs always preserve their true 1:1 natural proportions.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number | string,
  maxPx: number,
  minPx: number,
  fontFamily: string,
  maxAllowedW: number
): number {
  let sz = Math.max(minPx, Math.round(maxPx));
  while (sz > minPx) {
    ctx.font = `${weight} ${sz}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxAllowedW) {
      return sz;
    }
    sz -= 1;
  }
  ctx.font = `${weight} ${minPx}px ${fontFamily}`;
  return minPx;
}

function toTexture(
  canvas: HTMLCanvasElement,
  opts?: {
    srgb?: boolean;
    repeatX?: number;
    repeatY?: number;
    wrap?: boolean;
    anisotropy?: number;
  }
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts?.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts?.wrap !== false) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  if (opts?.repeatX !== undefined || opts?.repeatY !== undefined) {
    tex.repeat.set(opts.repeatX ?? 1, opts.repeatY ?? 1);
  }
  tex.anisotropy = opts?.anisotropy ?? 4;
  tex.needsUpdate = true;
  return tex;
}

export interface FacadeTextureSet {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export interface FacadeConfig {
  seed: number;
  baseColor: string;
  secondaryColor: string;
  trimColor: string;
  cols: number;
  rows: number;
  tileStyle: 'plaster' | 'mosaic' | 'concrete' | 'blueTile';
  litProbability: number;
  warmRatio: number;
  hasIronGrilles?: boolean;
  stainStrength?: number;
}

/**
 * Generates paired Albedo + Emissive + Bump CanvasTextures for weathered Hong Kong
 * Tong Lau & Kowloon tenement facades with recessed window mullions, iron grilles (鐵窗花),
 * ceiling interior shadows, Venetian blinds, varied room color temps, and rain weathering.
 */
export function createFacadeTextureSet(cfg: FacadeConfig): FacadeTextureSet {
  const W = 1024;
  const H = 1024;
  const rand = mulberry32(cfg.seed);

  const [albedoC, ctx] = makeCanvas(W, H);
  const [emissiveC, ectx] = makeCanvas(W, H);
  const [bumpC, bctx] = makeCanvas(W, H);

  ctx.fillStyle = cfg.baseColor;
  ctx.fillRect(0, 0, W, H);

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, W, H);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, W, H);

  const stainStrength = cfg.stainStrength ?? 1.0;

  if (cfg.tileStyle === 'mosaic') {
    // Classic Hong Kong 紙皮石 (small glazed ceramic mosaic tiles with mortar depth & patina)
    const tile = 12;
    for (let y = 0; y < H; y += tile) {
      for (let x = 0; x < W; x += tile) {
        const v = (rand() - 0.5) * 24;
        ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 210})` : `rgba(10,24,28,${-v / 165})`;
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        // Subtle glazed top-left micro-highlight
        if (rand() > 0.45) {
          ctx.fillStyle = 'rgba(235, 252, 248, 0.085)';
          ctx.fillRect(x + 1, y + 1, tile - 3, 2);
        }
        // Occasional weathered replacement mosaic tile
        if (rand() < 0.025) {
          ctx.fillStyle = rand() > 0.5 ? 'rgba(218, 232, 224, 0.14)' : 'rgba(18, 36, 38, 0.20)';
          ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        }
      }
    }
    ctx.strokeStyle = 'rgba(16, 30, 34, 0.30)';
    ctx.lineWidth = 1.5;
    bctx.strokeStyle = '#4e4e4e';
    bctx.lineWidth = 1.8;
    for (let x = 0; x < W; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      bctx.beginPath();
      bctx.moveTo(x, 0);
      bctx.lineTo(x, H);
      bctx.stroke();
    }
    for (let y = 0; y < H; y += tile) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      bctx.beginPath();
      bctx.moveTo(0, y);
      bctx.lineTo(W, y);
      bctx.stroke();
    }
  } else if (cfg.tileStyle === 'blueTile') {
    // Wan Chai heritage glazed rectangular subway tiles with staggered joints
    const bandH = 22;
    const tileW = 44;
    for (let rowIdx = 0; rowIdx * bandH < H; rowIdx++) {
      const y = rowIdx * bandH;
      const xOff = (rowIdx % 2) * (tileW * 0.5);
      for (let x = -tileW; x < W + tileW; x += tileW) {
        const shade = (rand() - 0.5) * 18;
        ctx.fillStyle = shade > 0 ? `rgba(235,248,255,${shade / 230})` : `rgba(10,22,32,${-shade / 170})`;
        ctx.fillRect(x + xOff + 1, y + 1, tileW - 2, bandH - 2);
        ctx.fillStyle = 'rgba(220, 242, 250, 0.06)';
        ctx.fillRect(x + xOff + 2, y + 2, tileW - 4, 2);
        ctx.strokeStyle = 'rgba(14, 28, 38, 0.28)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + xOff, y, tileW, bandH);
        bctx.strokeStyle = '#525252';
        bctx.lineWidth = 2;
        bctx.strokeRect(x + xOff, y, tileW, bandH);
      }
    }
  } else if (cfg.tileStyle === 'concrete') {
    // Weathered Kowloon poured concrete with form-tie dimples, subtle aggregate & hairline cracks
    for (let i = 0; i < 1400; i++) {
      const px = rand() * W;
      const py = rand() * H;
      const rw = 4 + rand() * 26;
      const rh = 6 + rand() * 34;
      ctx.fillStyle = rand() > 0.45 ? 'rgba(18, 28, 42, 0.055)' : 'rgba(220, 232, 246, 0.042)';
      ctx.fillRect(px, py, rw, rh);
    }
    const panelH = H / cfg.rows;
    ctx.strokeStyle = 'rgba(16, 26, 38, 0.34)';
    ctx.lineWidth = 3;
    bctx.strokeStyle = '#484848';
    bctx.lineWidth = 3;
    for (let r = 1; r < cfg.rows; r++) {
      const yy = Math.round(r * panelH);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(W, yy);
      ctx.stroke();
      bctx.beginPath();
      bctx.moveTo(0, yy);
      bctx.lineTo(W, yy);
      bctx.stroke();
    }
    // Concrete vertical formwork seams & circular tie-rod dimples
    const formCols = cfg.cols * 2;
    for (let fc = 1; fc < formCols; fc++) {
      const xx = Math.round((W / formCols) * fc);
      ctx.strokeStyle = 'rgba(18, 28, 40, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xx, 0);
      ctx.lineTo(xx, H);
      ctx.stroke();
      for (let fy = 48; fy < H; fy += 96) {
        ctx.fillStyle = 'rgba(14, 22, 32, 0.28)';
        ctx.beginPath();
        ctx.arc(xx - 16, fy, 3.2, 0, Math.PI * 2);
        ctx.arc(xx + 16, fy, 3.2, 0, Math.PI * 2);
        ctx.fill();
        bctx.fillStyle = '#404040';
        bctx.beginPath();
        bctx.arc(xx - 16, fy, 3.2, 0, Math.PI * 2);
        bctx.arc(xx + 16, fy, 3.2, 0, Math.PI * 2);
        bctx.fill();
      }
    }
  } else {
    // Old Hong Kong weathered stucco/plaster Tong Lau facade with mottled patina & hairline cracks
    for (let i = 0; i < 1100; i++) {
      const px = rand() * W;
      const py = rand() * H;
      const w = 14 + rand() * 58;
      const h = 10 + rand() * 44;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(246, 226, 200, 0.042)' : 'rgba(40, 24, 18, 0.058)';
      ctx.fillRect(px, py, w, h);
    }
    // Subtle exposed stucco texture flecks in bump map
    for (let i = 0; i < 1600; i++) {
      const px = rand() * W;
      const py = rand() * H;
      bctx.fillStyle = rand() > 0.5 ? '#8e8e8e' : '#707070';
      bctx.fillRect(px, py, 2 + rand() * 3, 2 + rand() * 3);
    }
  }

  // Fine organic weathered plaster/concrete hairline cracks across walls
  const crackCount = cfg.tileStyle === 'plaster' || cfg.tileStyle === 'concrete' ? 16 : 6;
  for (let i = 0; i < crackCount; i++) {
    let cx0 = rand() * W;
    let cy0 = rand() * H;
    ctx.strokeStyle = `rgba(18, 22, 28, ${0.18 * stainStrength})`;
    ctx.lineWidth = 1.2;
    bctx.strokeStyle = '#464646';
    bctx.lineWidth = 1.5;
    ctx.beginPath();
    bctx.beginPath();
    ctx.moveTo(cx0, cy0);
    bctx.moveTo(cx0, cy0);
    const segs = 4 + Math.floor(rand() * 5);
    for (let s = 0; s < segs; s++) {
      cx0 += (rand() - 0.5) * 34;
      cy0 += 12 + rand() * 28;
      ctx.lineTo(cx0, cy0);
      bctx.lineTo(cx0, cy0);
    }
    ctx.stroke();
    bctx.stroke();
  }

  const rowH = H / cfg.rows;
  const colW = W / cfg.cols;

  // Floor ledges + rich multi-stop under-cornice AO shadow strips beneath every floor band
  for (let r = 0; r < cfg.rows; r++) {
    const floorTop = r * rowH;
    // Upper bevel highlight
    ctx.fillStyle = 'rgba(245, 248, 252, 0.16)';
    ctx.fillRect(0, floorTop, W, 3);
    ctx.fillStyle = cfg.trimColor;
    ctx.fillRect(0, floorTop + 3, W, 13);

    // Rich dark under-cornice AO shadow strip right beneath each floor ledge
    const aoStrip = ctx.createLinearGradient(0, floorTop + 16, 0, floorTop + 50);
    aoStrip.addColorStop(0, `rgba(10, 16, 24, ${Math.min(0.62, 0.48 * stainStrength)})`);
    aoStrip.addColorStop(0.35, `rgba(12, 18, 28, ${0.24 * stainStrength})`);
    aoStrip.addColorStop(1, 'rgba(12, 18, 28, 0.0)');
    ctx.fillStyle = aoStrip;
    ctx.fillRect(0, floorTop + 16, W, 34);

    bctx.fillStyle = '#d8d8d8';
    bctx.fillRect(0, floorTop, W, 16);
    bctx.fillStyle = '#383838';
    bctx.fillRect(0, floorTop + 16, W, 8);
  }

  // Vertical rain-wash & AC condensate runoff streaks
  for (let i = 0; i < 68; i++) {
    const sx = rand() * W;
    const sy = rand() * H * 0.45;
    const sh = 95 + rand() * (H * 0.58);
    const sw = 4 + rand() * 14;
    const grad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    const rusty = rand() < 0.25;
    const rgb = rusty ? '42, 26, 18' : '14, 24, 34';
    grad.addColorStop(0, `rgba(${rgb}, ${0.22 * stainStrength})`);
    grad.addColorStop(0.45, `rgba(${rgb}, ${0.10 * stainStrength})`);
    grad.addColorStop(1, `rgba(${rgb}, 0.0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, sw, sh);
  }

  // Bottom-up damp rain-splash / ground contact AO darkening gradient along lower wall
  const bottomAO = ctx.createLinearGradient(0, H * 0.78, 0, H);
  bottomAO.addColorStop(0, 'rgba(10, 18, 26, 0.0)');
  bottomAO.addColorStop(0.55, `rgba(12, 20, 28, ${0.18 * stainStrength})`);
  bottomAO.addColorStop(0.86, `rgba(10, 16, 22, ${0.36 * stainStrength})`);
  bottomAO.addColorStop(1, `rgba(8, 13, 18, ${0.52 * stainStrength})`);
  ctx.fillStyle = bottomAO;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);

  // Subtle damp rain-splash grime speckles along bottom skirt
  for (let i = 0; i < 240; i++) {
    const gx = rand() * W;
    const gy = H * (0.88 + rand() * 0.12);
    const gr = 2 + rand() * 7;
    ctx.fillStyle = rand() > 0.3 ? 'rgba(12, 20, 22, 0.14)' : 'rgba(26, 44, 34, 0.12)';
    ctx.fillRect(gx, gy, gr, gr * 0.7);
  }

  // Subtle top roofline shadow vignette
  const topAO = ctx.createLinearGradient(0, 0, 0, 44);
  topAO.addColorStop(0, `rgba(10, 16, 24, ${0.32 * stainStrength})`);
  topAO.addColorStop(1, 'rgba(10, 16, 24, 0)');
  ctx.fillStyle = topAO;
  ctx.fillRect(0, 0, W, 44);

  // Windows with deeper 3D room perspective, pendant lamp silhouettes, bookshelves/art, curtains, blinds & grilles
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const marginX = colW * 0.17;
      const marginTop = rowH * 0.22;
      const winW = colW - marginX * 2;
      const winH = rowH * 0.56;
      const wx = c * colW + marginX;
      const wy = r * rowH + marginTop;

      // Deep masonry reveal shadow around window + sill bevel
      ctx.fillStyle = 'rgba(10, 16, 26, 0.58)';
      ctx.fillRect(wx - 8, wy - 10, winW + 16, winH + 18);
      ctx.fillStyle = 'rgba(10, 16, 24, 0.34)';
      ctx.fillRect(wx - 10, wy - 14, winW + 20, 6);
      ctx.fillStyle = cfg.secondaryColor;
      ctx.fillRect(wx - 10, wy + winH + 3, winW + 20, 12);
      ctx.fillStyle = 'rgba(235, 244, 252, 0.14)';
      ctx.fillRect(wx - 10, wy + winH + 3, winW + 20, 2.5);

      bctx.fillStyle = '#222222';
      bctx.fillRect(wx, wy, winW, winH);
      bctx.fillStyle = '#e0e0e0';
      bctx.fillRect(wx - 10, wy + winH + 3, winW + 20, 12);
      bctx.fillStyle = '#c8c8c8';
      bctx.fillRect(wx - 10, wy - 12, winW + 20, 8);

      // Under-sill AC condensate & rainwater corner drip streaks
      const dripGrad = ctx.createLinearGradient(0, wy + winH + 14, 0, wy + winH + 84);
      dripGrad.addColorStop(0, `rgba(12, 18, 28, ${0.42 * stainStrength})`);
      dripGrad.addColorStop(0.45, `rgba(26, 20, 18, ${0.20 * stainStrength})`);
      dripGrad.addColorStop(1, 'rgba(14, 20, 30, 0)');
      ctx.fillStyle = dripGrad;
      ctx.fillRect(wx - 8, wy + winH + 14, 14, 70);
      ctx.fillRect(wx + winW - 6, wy + winH + 14, 14, 70);
      // Narrow rust/condensate trickle from AC corner
      const acDrip = ctx.createLinearGradient(0, wy + winH + 14, 0, wy + winH + 110);
      acDrip.addColorStop(0, `rgba(52, 28, 18, ${0.34 * stainStrength})`);
      acDrip.addColorStop(1, 'rgba(52, 28, 18, 0)');
      ctx.fillStyle = acDrip;
      ctx.fillRect(wx + winW * 0.15, wy + winH + 14, 5, 96);

      const isLit = rand() < cfg.litProbability;
      if (isLit) {
        const tempRoll = rand();
        const grad = ctx.createLinearGradient(wx, wy, wx, wy + winH);
        const eGrad = ctx.createLinearGradient(wx, wy, wx, wy + winH);

        if (tempRoll < cfg.warmRatio * 0.55) {
          // Cozy deep tungsten amber apartment interior with ceiling soffit shadow
          grad.addColorStop(0, '#5e381e');
          grad.addColorStop(0.18, '#a66836');
          grad.addColorStop(0.42, '#e6a054');
          grad.addColorStop(0.76, '#f4be72');
          grad.addColorStop(1, '#984e22');

          eGrad.addColorStop(0, '#2e1808');
          eGrad.addColorStop(0.20, '#78441c');
          eGrad.addColorStop(0.44, '#cc8034');
          eGrad.addColorStop(0.78, '#e09d4c');
          eGrad.addColorStop(1, '#683010');
        } else if (tempRoll < cfg.warmRatio) {
          // Soft warm cream incandescent Hong Kong living room
          grad.addColorStop(0, '#6a523c');
          grad.addColorStop(0.18, '#b48d68');
          grad.addColorStop(0.42, '#f0d4a4');
          grad.addColorStop(0.80, '#d89a56');
          grad.addColorStop(1, '#844824');

          eGrad.addColorStop(0, '#382818');
          eGrad.addColorStop(0.20, '#7c5d3c');
          eGrad.addColorStop(0.44, '#d6b67c');
          eGrad.addColorStop(0.82, '#b67a3a');
          eGrad.addColorStop(1, '#5a2e12');
        } else {
          // Muted cool TV / daylight-tube fluorescent Hong Kong flat
          grad.addColorStop(0, '#324858');
          grad.addColorStop(0.22, '#62869e');
          grad.addColorStop(0.50, '#a6cade');
          grad.addColorStop(1, '#446278');

          eGrad.addColorStop(0, '#1c3040');
          eGrad.addColorStop(0.24, '#3c6078');
          eGrad.addColorStop(0.52, '#78a8c0');
          eGrad.addColorStop(1, '#2c485c');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(wx, wy, winW, winH);
        ectx.fillStyle = eGrad;
        ectx.fillRect(wx, wy, winW, winH);

        // Interior room side-wall perspective depth shading (gives 3D interior recession!)
        const sideShadowL = ctx.createLinearGradient(wx, 0, wx + winW * 0.22, 0);
        sideShadowL.addColorStop(0, 'rgba(24, 14, 10, 0.42)');
        sideShadowL.addColorStop(1, 'rgba(24, 14, 10, 0)');
        ctx.fillStyle = sideShadowL;
        ctx.fillRect(wx, wy, winW * 0.22, winH);
        ectx.fillStyle = sideShadowL;
        ectx.fillRect(wx, wy, winW * 0.22, winH);

        const sideShadowR = ctx.createLinearGradient(wx + winW * 0.78, 0, wx + winW, 0);
        sideShadowR.addColorStop(0, 'rgba(24, 14, 10, 0)');
        sideShadowR.addColorStop(1, 'rgba(24, 14, 10, 0.38)');
        ctx.fillStyle = sideShadowR;
        ctx.fillRect(wx + winW * 0.78, wy, winW * 0.22, winH);
        ectx.fillStyle = sideShadowR;
        ectx.fillRect(wx + winW * 0.78, wy, winW * 0.22, winH);

        // Subtle hanging ceiling pendant lamp silhouette + concentrated glow halo
        if (rand() > 0.28) {
          const lx = wx + winW * (0.36 + rand() * 0.28);
          const ly = wy + winH * (0.20 + rand() * 0.08);
          const lampHalo = ctx.createRadialGradient(lx, ly + 10, 3, lx, ly + 10, winW * 0.34);
          lampHalo.addColorStop(0, 'rgba(255, 248, 224, 0.56)');
          lampHalo.addColorStop(0.5, 'rgba(255, 212, 134, 0.18)');
          lampHalo.addColorStop(1, 'rgba(255, 190, 100, 0)');
          ctx.fillStyle = lampHalo;
          ctx.fillRect(wx, wy, winW, winH);
          ectx.fillStyle = lampHalo;
          ectx.fillRect(wx, wy, winW, winH);

          // Cord & dome lampshade silhouette
          const drawLamp = (tCtx: CanvasRenderingContext2D, col: string) => {
            tCtx.fillStyle = col;
            tCtx.fillRect(lx - 1.5, wy, 3, ly - wy);
            tCtx.beginPath();
            tCtx.arc(lx, ly + 4, winW * 0.085, Math.PI, 0);
            tCtx.closePath();
            tCtx.fill();
          };
          drawLamp(ctx, 'rgba(38, 22, 14, 0.74)');
          drawLamp(ectx, 'rgba(0, 0, 0, 0.80)');
        }

        // Interior depth hints: framed wall art OR bookshelf / houseplant silhouette on back wall
        const decorRoll = rand();
        if (decorRoll < 0.38) {
          // Framed wall art hanging on back room wall
          const fw = winW * 0.28;
          const fh = winH * 0.24;
          const fx = wx + winW * (0.25 + rand() * 0.24);
          const fy = wy + winH * 0.38;
          ctx.strokeStyle = 'rgba(42, 24, 16, 0.52)';
          ctx.lineWidth = 3;
          ctx.strokeRect(fx, fy, fw, fh);
          ctx.fillStyle = 'rgba(72, 46, 34, 0.24)';
          ctx.fillRect(fx + 2, fy + 2, fw - 4, fh - 4);
          ectx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
          ectx.lineWidth = 3;
          ectx.strokeRect(fx, fy, fw, fh);
        } else if (decorRoll < 0.72) {
          // Bookshelf / cabinet silhouette along lower half of room
          const sw = winW * 0.36;
          const sh = winH * 0.36;
          const sx = rand() > 0.5 ? wx + winW * 0.12 : wx + winW * 0.52;
          const sy = wy + winH - sh;
          const drawShelf = (tCtx: CanvasRenderingContext2D, col: string) => {
            tCtx.fillStyle = col;
            tCtx.fillRect(sx, sy, sw, sh);
            // Tiny shelf divider cutouts
            tCtx.fillRect(sx - 2, sy, sw + 4, 4);
            tCtx.fillRect(sx, sy + sh * 0.34, sw, 3);
            tCtx.fillRect(sx, sy + sh * 0.68, sw, 3);
          };
          drawShelf(ctx, 'rgba(38, 22, 16, 0.44)');
          drawShelf(ectx, 'rgba(0, 0, 0, 0.52)');
        } else {
          // Small potted plant silhouette on interior sill
          const px = wx + winW * (0.28 + rand() * 0.44);
          const py = wy + winH - 12;
          const drawPlant = (tCtx: CanvasRenderingContext2D, col: string) => {
            tCtx.fillStyle = col;
            tCtx.fillRect(px - 8, py, 16, 12);
            tCtx.beginPath();
            tCtx.arc(px, py - 6, 11, 0, Math.PI * 2);
            tCtx.arc(px - 8, py - 3, 7, 0, Math.PI * 2);
            tCtx.arc(px + 8, py - 4, 7, 0, Math.PI * 2);
            tCtx.fill();
          };
          drawPlant(ctx, 'rgba(26, 36, 26, 0.56)');
          drawPlant(ectx, 'rgba(0, 0, 0, 0.65)');
        }

        // Pleated fabric curtains along left or right edge
        if (rand() > 0.32) {
          const curtW = winW * (0.20 + rand() * 0.22);
          const onRight = rand() > 0.5;
          const cx0 = onRight ? wx + winW - curtW : wx;
          ctx.fillStyle = 'rgba(36, 24, 20, 0.46)';
          ctx.fillRect(cx0, wy, curtW, winH);
          ectx.fillStyle = 'rgba(0, 0, 0, 0.54)';
          ectx.fillRect(cx0, wy, curtW, winH);
          // Pleat fold lines
          for (let fx = cx0 + 6; fx < cx0 + curtW - 3; fx += 9) {
            ctx.fillStyle = 'rgba(18, 12, 10, 0.24)';
            ctx.fillRect(fx, wy, 3, winH);
          }
        }

        // Crisp Venetian blinds across upper half
        if (rand() > 0.42) {
          ctx.fillStyle = 'rgba(24, 18, 16, 0.34)';
          ectx.fillStyle = 'rgba(0, 0, 0, 0.42)';
          const blindH = winH * (0.28 + rand() * 0.28);
          for (let by = wy + 5; by < wy + blindH; by += 8) {
            ctx.fillRect(wx, by, winW, 3.2);
            ectx.fillRect(wx, by, winW, 3.2);
          }
          // Vertical blind ladder cords
          ctx.fillStyle = 'rgba(24, 18, 16, 0.25)';
          ctx.fillRect(wx + winW * 0.24, wy, 2, blindH);
          ctx.fillRect(wx + winW * 0.76, wy, 2, blindH);
        }
      } else {
        // Cool unlit rainy glass reflection with subtle darkened interior depth
        const uGrad = ctx.createLinearGradient(wx, wy, wx + winW, wy + winH);
        uGrad.addColorStop(0, '#364b60');
        uGrad.addColorStop(0.45, '#223242');
        uGrad.addColorStop(0.54, '#445d74');
        uGrad.addColorStop(1, '#1a2734');
        ctx.fillStyle = uGrad;
        ctx.fillRect(wx, wy, winW, winH);

        // Soft upper soffit shadow & diagonal rain-sheen glint
        ctx.fillStyle = 'rgba(10, 16, 24, 0.34)';
        ctx.fillRect(wx, wy, winW, winH * 0.16);

        ctx.fillStyle = 'rgba(188, 214, 236, 0.13)';
        ctx.beginPath();
        ctx.moveTo(wx + 4, wy + 4);
        ctx.lineTo(wx + winW * 0.56, wy + 4);
        ctx.lineTo(wx + 4, wy + winH * 0.60);
        ctx.closePath();
        ctx.fill();

        // Thin secondary diagonal window reflection band
        ctx.fillStyle = 'rgba(176, 204, 228, 0.08)';
        ctx.beginPath();
        ctx.moveTo(wx + winW * 0.64, wy + 4);
        ctx.lineTo(wx + winW * 0.78, wy + 4);
        ctx.lineTo(wx + winW * 0.22, wy + winH - 4);
        ctx.lineTo(wx + winW * 0.08, wy + winH - 4);
        ctx.closePath();
        ctx.fill();
      }

      // Crisp aluminum/steel window mullions & traditional HK iron grilles (鐵窗花)
      const drawFrame = (targetCtx: CanvasRenderingContext2D, color: string, isAlbedo: boolean) => {
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = 8;
        targetCtx.strokeRect(wx + 2, wy + 2, winW - 4, winH - 4);
        targetCtx.lineWidth = 5.5;
        targetCtx.beginPath();
        targetCtx.moveTo(wx + winW * 0.5, wy);
        targetCtx.lineTo(wx + winW * 0.5, wy + winH);
        targetCtx.moveTo(wx, wy + winH * 0.34);
        targetCtx.lineTo(wx + winW, wy + winH * 0.34);
        targetCtx.stroke();

        // Subtle metallic edge highlight on window mullions
        if (isAlbedo) {
          targetCtx.strokeStyle = 'rgba(195, 216, 232, 0.22)';
          targetCtx.lineWidth = 1.5;
          targetCtx.strokeRect(wx + 6, wy + 6, winW - 12, winH - 12);
        }

        if (cfg.hasIronGrilles) {
          targetCtx.strokeStyle = color;
          targetCtx.lineWidth = 2.6;
          for (let g = 1; g <= 3; g++) {
            const gx = wx + (winW * g) / 4;
            targetCtx.beginPath();
            targetCtx.moveTo(gx, wy + winH * 0.34);
            targetCtx.lineTo(gx, wy + winH);
            targetCtx.stroke();
          }
          targetCtx.beginPath();
          targetCtx.moveTo(wx, wy + winH * 0.68);
          targetCtx.lineTo(wx + winW, wy + winH * 0.68);
          targetCtx.stroke();
        }
      };

      drawFrame(ctx, '#1c2630', true);
      drawFrame(ectx, '#000000', false);
    }
  }

  return {
    map: toTexture(albedoC, { srgb: true }),
    emissiveMap: toTexture(emissiveC, { srgb: true }),
    bumpMap: toTexture(bumpC, { srgb: false })
  };
}

export function createRoofTileTexture(baseHex = '#2e4152', seed = 91): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const rand = mulberry32(seed);
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, W, H);

  const rowH = 24;
  const colW = 32;
  for (let row = 0; row < H / rowH; row++) {
    const y = row * rowH;
    const offset = (row % 2) * (colW * 0.5);
    for (let x = -colW; x < W + colW; x += colW) {
      const shade = (rand() - 0.5) * 22;
      ctx.fillStyle = shade > 0 ? `rgba(218,236,252,${shade / 210})` : `rgba(8,14,22,${-shade / 145})`;
      ctx.fillRect(x + offset + 1, y + 1, colW - 2, rowH - 2);
      // Curved clay barrel sheen gradient across each tile
      const tileG = ctx.createLinearGradient(x + offset, y, x + offset + colW, y);
      tileG.addColorStop(0, 'rgba(8, 14, 22, 0.24)');
      tileG.addColorStop(0.35, 'rgba(205, 226, 244, 0.14)');
      tileG.addColorStop(1, 'rgba(8, 14, 22, 0.28)');
      ctx.fillStyle = tileG;
      ctx.fillRect(x + offset + 1, y + 1, colW - 2, rowH - 2);

      ctx.strokeStyle = 'rgba(10, 18, 28, 0.44)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x + offset, y, colW, rowH);
    }
    // Cast shadow lip beneath every overlapping tile course
    ctx.fillStyle = 'rgba(6, 12, 18, 0.36)';
    ctx.fillRect(0, y + rowH - 4, W, 4);
    ctx.fillStyle = 'rgba(190, 218, 238, 0.13)';
    ctx.fillRect(0, y + rowH - 6, W, 2);
  }

  // Subtle damp rain-moss streaks across tiles
  for (let i = 0; i < 36; i++) {
    const mx = rand() * W;
    const my = rand() * H;
    const r = 10 + rand() * 26;
    const mg = ctx.createRadialGradient(mx, my, 2, mx, my, r);
    mg.addColorStop(0, 'rgba(20, 38, 32, 0.18)');
    mg.addColorStop(1, 'rgba(20, 38, 32, 0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, { repeatX: 2, repeatY: 2 });
}

export function createCorrugatedTinTexture(
  baseHex = '#2d4d42',
  stripeHex?: string
): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const rand = mulberry32(baseHex.length * 997 + (stripeHex ? 41 : 13));
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, W, H);

  const rib = 18;
  for (let x = 0; x < W; x += rib) {
    if (stripeHex && Math.floor(x / (rib * 2)) % 2 === 1) {
      ctx.fillStyle = stripeHex;
      ctx.fillRect(x, 0, rib, H);
    }
    const g = ctx.createLinearGradient(x, 0, x + rib, 0);
    g.addColorStop(0, 'rgba(10, 18, 22, 0.34)');
    g.addColorStop(0.32, 'rgba(240, 248, 255, 0.22)');
    g.addColorStop(0.72, 'rgba(12, 20, 26, 0.12)');
    g.addColorStop(1, 'rgba(10, 18, 22, 0.36)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rib, H);
  }

  // Horizontal bolted overlap seam & tiny screw heads
  for (const sy of [H * 0.34, H * 0.68]) {
    ctx.fillStyle = 'rgba(12, 18, 24, 0.28)';
    ctx.fillRect(0, sy, W, 4);
    for (let x = 9; x < W; x += rib * 2) {
      ctx.fillStyle = 'rgba(220, 232, 242, 0.42)';
      ctx.beginPath();
      ctx.arc(x, sy - 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Weathering rain-rust patina toward lower drip edge
  const rust = ctx.createLinearGradient(0, H * 0.68, 0, H);
  rust.addColorStop(0, 'rgba(92, 46, 26, 0)');
  rust.addColorStop(1, 'rgba(92, 46, 26, 0.28)');
  ctx.fillStyle = rust;
  ctx.fillRect(0, H * 0.68, W, H * 0.32);

  for (let i = 0; i < 24; i++) {
    const rx = rand() * W;
    const ry = H * (0.4 + rand() * 0.5);
    ctx.fillStyle = 'rgba(84, 42, 24, 0.14)';
    ctx.fillRect(rx, ry, 4 + rand() * 8, 22 + rand() * 44);
  }

  return toTexture(canvas, { repeatX: 2, repeatY: 1 });
}

export function createConcreteRoofTexture(seed = 404): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const rand = mulberry32(seed);
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = '#536270';
  ctx.fillRect(0, 0, W, H);

  // Fine aggregate concrete speckle
  for (let i = 0; i < 2200; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const sz = 1 + rand() * 3;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(20, 30, 42, 0.10)' : 'rgba(196, 212, 226, 0.06)';
    ctx.fillRect(x, y, sz, sz);
  }

  // Damp rain-pooled dark patches & waterproof tar weathering
  for (let i = 0; i < 36; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 18 + rand() * 56;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, rand() > 0.35 ? 'rgba(20, 30, 42, 0.22)' : 'rgba(26, 42, 36, 0.16)');
    g.addColorStop(1, 'rgba(20, 30, 42, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Perimeter parapet dampness vignette
  const edgeW = 38;
  ctx.strokeStyle = 'rgba(14, 22, 32, 0.32)';
  ctx.lineWidth = edgeW;
  ctx.strokeRect(edgeW * 0.5, edgeW * 0.5, W - edgeW, H - edgeW);

  // Waterproof slab expansion joints & corner roof drain grate
  ctx.strokeStyle = 'rgba(18, 26, 36, 0.42)';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.beginPath();
  ctx.moveTo(W / 2, 24);
  ctx.lineTo(W / 2, H - 24);
  ctx.moveTo(24, H / 2);
  ctx.lineTo(W - 24, H / 2);
  ctx.stroke();

  // Small metal roof drain grate in one quadrant
  ctx.fillStyle = '#24303a';
  ctx.fillRect(W * 0.72, H * 0.72, 22, 22);
  ctx.strokeStyle = '#6f8292';
  ctx.lineWidth = 2;
  for (let dy = 4; dy < 20; dy += 5) {
    ctx.beginPath();
    ctx.moveTo(W * 0.72 + 3, H * 0.72 + dy);
    ctx.lineTo(W * 0.72 + 19, H * 0.72 + dy);
    ctx.stroke();
  }

  return toTexture(canvas);
}

/**
 * Rain-soaked dark charcoal-slate Hong Kong asphalt + broad continuous wet-puddle alpha sheet!
 * Road plane spans 72 units in Z (z in [-36, +36]):
 * - Core road |z| < 12.5 maps to v in [0.326, 0.674] -> continuous broad wet-puddle sheets
 *   with alpha in [0.30, 0.60] so warm shops, neon, cyan mart, taxi & tram reflect lushly
 *   across the ENTIRE wet road (ZERO isolated circular mud hole!).
 * - Outside |z| > 14.5 (v < 0.298 or v > 0.702), alpha ramps smoothly to pure WHITE (1.0)
 *   well inside the PlanarWetReflector bounds (|z| <= 16.5) so reflector edges are 100% hidden!
 */
export function createWetRoadTextures(): {
  albedo: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  puddleAlpha: THREE.CanvasTexture;
} {
  const W = 512;
  const H = 1024;
  const rand = mulberry32(1988);

  const [albedoC, ctx] = makeCanvas(W, H);
  const [roughC, rctx] = makeCanvas(W, H);
  const [alphaC, actx] = makeCanvas(W, H);

  // Rich rain-soaked dark charcoal-slate asphalt (matching IMG_1635 wet tar contrast!)
  ctx.fillStyle = '#242e3a';
  ctx.fillRect(0, 0, W, H);

  // Smooth damp sheen base roughness
  rctx.fillStyle = '#4e4e4e';
  rctx.fillRect(0, 0, W, H);

  // Damp asphalt baseline alpha = 0.62 (158) across core road -> subtle continuous reflection everywhere!
  actx.fillStyle = 'rgb(158, 158, 158)';
  actx.fillRect(0, 0, W, H);

  // Fine rain-darkened aggregate grain
  for (let i = 0; i < 7200; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const sz = 1 + rand() * 2.2;
    ctx.fillStyle = rand() > 0.55 ? 'rgba(145, 168, 192, 0.055)' : 'rgba(8, 12, 18, 0.16)';
    ctx.fillRect(x, y, sz, sz);
  }

  // Longitudinal darkened wheel & tram tracks
  const trackXs = [W * 0.27, W * 0.39, W * 0.65, W * 0.78];
  for (const tx of trackXs) {
    const g = ctx.createLinearGradient(tx - 30, 0, tx + 30, 0);
    g.addColorStop(0, 'rgba(12, 18, 26, 0)');
    g.addColorStop(0.5, 'rgba(10, 15, 22, 0.28)');
    g.addColorStop(1, 'rgba(12, 18, 26, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(tx - 30, 0, 60, H);
  }

  // Crisp HK white dashed centerline (78-unit road: Yellow Box z=+0.2 [-1.05..+1.45] + Zebra z=+3.4 [+2.48..+4.33] -> y in [495..572])
  ctx.fillStyle = 'rgba(222, 232, 240, 0.62)';
  for (let y = 24; y < H - 24; y += 44) {
    if (y > 488 && y < 578) continue;
    ctx.fillRect(W * 0.5 - 3, y, 6, 22);
  }

  // Crisp HK double-yellow curbside no-stopping under-lines aligned beneath 3D strips at x = ±4.93 & ±4.80
  ctx.fillStyle = 'rgba(218, 180, 68, 0.54)';
  ctx.fillRect(21, 0, 3, H);
  ctx.fillRect(28, 0, 3, H);
  ctx.fillRect(W - 24, 0, 3, H);
  ctx.fillRect(W - 31, 0, 3, H);

  // Broad, overlapping organic wet-rainwater sheets covering ~64% of the wider core road (|z| < 16.5)
  // Smoothly blending between 0.30 (deep glossy wet sheets) and 0.60 (damp tar) — ZERO isolated mud hole!
  const sheets: Array<{ x: number; y: number; rx: number; ry: number; alpha: number }> = [
    { x: 0.42, y: 0.50, rx: 0.40, ry: 0.14, alpha: 0.34 },
    { x: 0.60, y: 0.54, rx: 0.38, ry: 0.14, alpha: 0.36 },
    { x: 0.35, y: 0.61, rx: 0.36, ry: 0.12, alpha: 0.32 },
    { x: 0.62, y: 0.65, rx: 0.36, ry: 0.12, alpha: 0.38 },
    { x: 0.48, y: 0.41, rx: 0.42, ry: 0.12, alpha: 0.36 },
    { x: 0.45, y: 0.70, rx: 0.38, ry: 0.08, alpha: 0.46 },
    { x: 0.52, y: 0.34, rx: 0.38, ry: 0.08, alpha: 0.48 }
  ];

  for (const s of sheets) {
    const cx = s.x * W;
    const cy = s.y * H;
    const rx = s.rx * W;
    const ry = s.ry * H;

    // Gentle wet darkening (very subtle so it never looks like a mud stain!)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const ag = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
    ag.addColorStop(0, 'rgba(10, 16, 24, 0.16)');
    ag.addColorStop(0.75, 'rgba(10, 16, 24, 0.07)');
    ag.addColorStop(1, 'rgba(10, 16, 24, 0)');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glossy low roughness inside rain sheet
    rctx.save();
    rctx.translate(cx, cy);
    rctx.scale(1, ry / rx);
    const rg = rctx.createRadialGradient(0, 0, rx * 0.18, 0, 0, rx);
    rg.addColorStop(0, 'rgba(16, 16, 16, 0.88)');
    rg.addColorStop(0.7, 'rgba(32, 32, 32, 0.55)');
    rg.addColorStop(1, 'rgba(78, 78, 78, 0)');
    rctx.fillStyle = rg;
    rctx.beginPath();
    rctx.arc(0, 0, rx, 0, Math.PI * 2);
    rctx.fill();
    rctx.restore();

    // Continuous reflective window in alphaMap
    actx.save();
    actx.translate(cx, cy);
    actx.scale(1, ry / rx);
    const val = Math.round(s.alpha * 255);
    const pg = actx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
    pg.addColorStop(0, `rgba(${val},${val},${val},0.88)`);
    pg.addColorStop(0.65, `rgba(${val + 28},${val + 28},${val + 28},0.65)`);
    pg.addColorStop(1, 'rgba(158, 158, 158, 0)');
    actx.fillStyle = pg;
    actx.beginPath();
    actx.arc(0, 0, rx, 0, Math.PI * 2);
    actx.fill();
    actx.restore();
  }

  // Smoothly ramp outer Z ends (|z| > 19.2 -> v < 0.254 or v > 0.746 on 78-unit road) to pure WHITE (1.0)
  // so PlanarWetReflector boundaries (|z| = 21.0) are 100% hidden under opaque wet asphalt!
  const topFade = actx.createLinearGradient(0, 0, 0, H * 0.31);
  topFade.addColorStop(0, 'rgb(255,255,255)');
  topFade.addColorStop(0.82, 'rgb(255,255,255)');
  topFade.addColorStop(1, 'rgba(255,255,255,0)');
  actx.fillStyle = topFade;
  actx.fillRect(0, 0, W, H * 0.31);

  const botFade = actx.createLinearGradient(0, H * 0.69, 0, H);
  botFade.addColorStop(0, 'rgba(255,255,255,0)');
  botFade.addColorStop(0.18, 'rgb(255,255,255)');
  botFade.addColorStop(1, 'rgb(255,255,255)');
  actx.fillStyle = botFade;
  actx.fillRect(0, H * 0.69, W, H * 0.31);

  // Subtle curb margin opaque feather
  const leftFade = actx.createLinearGradient(0, 0, W * 0.09, 0);
  leftFade.addColorStop(0, 'rgb(255,255,255)');
  leftFade.addColorStop(1, 'rgba(255,255,255,0)');
  actx.fillStyle = leftFade;
  actx.fillRect(0, 0, W * 0.09, H);

  const rightFade = actx.createLinearGradient(W * 0.91, 0, W, 0);
  rightFade.addColorStop(0, 'rgba(255,255,255,0)');
  rightFade.addColorStop(1, 'rgb(255,255,255)');
  actx.fillStyle = rightFade;
  actx.fillRect(W * 0.91, 0, W * 0.09, H);

  return {
    albedo: toTexture(albedoC, { wrap: false }),
    roughness: toTexture(roughC, { srgb: false, wrap: false }),
    puddleAlpha: toTexture(alphaC, { srgb: false, wrap: false })
  };
}

export function createSidewalkTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const rand = mulberry32(314);
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = '#687988';
  ctx.fillRect(0, 0, W, H);

  const tile = 64;
  for (let y = 0; y < H; y += tile) {
    for (let x = 0; x < W; x += tile) {
      // Very subtle micro-tonal variation across individual Hong Kong flagstones (zero repeating spots!)
      const d = (rand() - 0.5) * 14;
      ctx.fillStyle = d > 0 ? `rgba(232,244,254,${d / 240})` : `rgba(16,26,36,${-d / 190})`;
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);

      // Fine damp concrete aggregate stone grain per slab
      for (let g = 0; g < 28; g++) {
        const sx = x + 4 + rand() * (tile - 8);
        const sy = y + 4 + rand() * (tile - 8);
        ctx.fillStyle = rand() > 0.5 ? 'rgba(220, 236, 248, 0.055)' : 'rgba(14, 24, 34, 0.075)';
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Crisp subtle beveled concrete flagstone chamfer (bright top-left, shadowed bottom-right)
      ctx.fillStyle = 'rgba(226, 240, 252, 0.14)';
      ctx.fillRect(x + 2, y + 2, tile - 4, 2.2);
      ctx.fillRect(x + 2, y + 2, 2.2, tile - 4);

      ctx.fillStyle = 'rgba(16, 24, 34, 0.26)';
      ctx.fillRect(x + 2, y + tile - 4.2, tile - 4, 2.2);
      ctx.fillRect(x + tile - 4.2, y + 2, 2.2, tile - 4);

      // Subtle damp grime nestled cleanly inside recessed joint borders
      ctx.strokeStyle = 'rgba(22, 38, 36, 0.14)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);

      // Crisp dark mortar joint groove
      ctx.strokeStyle = 'rgba(18, 28, 38, 0.42)';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
    }
  }

  return toTexture(canvas, { repeatX: 11, repeatY: 26 });
}

export function createZebraTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);

  const stripes = 11;
  const step = W / stripes;
  for (let i = 0; i < stripes; i++) {
    const x = i * step + step * 0.18;
    const w = step * 0.58;
    ctx.fillStyle = 'rgba(228, 236, 242, 0.80)';
    ctx.fillRect(x, 10, w, H - 20);
    ctx.fillStyle = 'rgba(34, 44, 56, 0.24)';
    ctx.fillRect(x + w * 0.2, 22, w * 0.6, H - 44);
  }
  return toTexture(canvas, { wrap: false });
}

export function createYellowBoxTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(224, 184, 68, 0.64)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  ctx.save();
  ctx.beginPath();
  ctx.rect(12, 12, W - 24, H - 24);
  ctx.clip();

  ctx.lineWidth = 6;
  const spacing = 46;
  for (let x = -H; x < W + H; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + H, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();
  return toTexture(canvas, { wrap: false });
}

export function createPawnshopNeonTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = 'rgba(26, 12, 16, 0.94)';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#ff3d4e';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#ff2840';
  ctx.shadowBlur = 18;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  ctx.save();
  ctx.fillStyle = '#ff4b58';
  ctx.strokeStyle = '#ffd068';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ffaa38';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(W * 0.5, 24);
  ctx.quadraticCurveTo(W * 0.28, 16, 30, 56);
  ctx.quadraticCurveTo(W * 0.34, 64, W * 0.42, 82);
  ctx.lineTo(W * 0.5, 68);
  ctx.lineTo(W * 0.58, 82);
  ctx.quadraticCurveTo(W * 0.66, 64, W - 30, 56);
  ctx.quadraticCurveTo(W * 0.72, 16, W * 0.5, 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#ffd56c';
  ctx.lineWidth = 7;
  ctx.shadowColor = '#ff9c2a';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(W * 0.5, 154, 74, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#ff4d58';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W * 0.5, 154, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 72px ${HK_SERIF}`;
  ctx.shadowColor = '#ff3038';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#fff0b8';
  ctx.fillText('押', W * 0.5, 158);
  ctx.strokeStyle = '#ff5442';
  ctx.lineWidth = 2;
  ctx.strokeText('押', W * 0.5, 158);

  ctx.font = `700 22px ${HK_SERIF}`;
  ctx.fillStyle = '#ffd978';
  ctx.fillText('大', W * 0.5, 52);
  ctx.restore();

  return toTexture(canvas, { wrap: false });
}

export interface NeonSignSpec {
  text: string;
  subText?: string;
  vertical?: boolean;
  bgColor: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
  width?: number;
  height?: number;
}

export function createNeonSignTexture(spec: NeonSignSpec): THREE.CanvasTexture {
  const W = spec.width ?? (spec.vertical ? 192 : 512);
  const H = spec.height ?? (spec.vertical ? 512 : 176);
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = spec.bgColor;
  ctx.fillRect(0, 0, W, H);

  const minDim = Math.min(W, H);
  const inset = Math.max(8, Math.round(minDim * 0.055));
  const outerBorderW = Math.max(5, Math.round(minDim * 0.038));
  const innerBorderW = Math.max(2, Math.round(outerBorderW * 0.3));
  const borderBlur = Math.max(12, Math.round(minDim * 0.11));
  const wireStep = Math.max(16, Math.round(minDim * 0.11));

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let y = wireStep; y < H; y += wireStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.strokeStyle = spec.borderColor;
  ctx.lineWidth = outerBorderW;
  ctx.shadowColor = spec.glowColor;
  ctx.shadowBlur = borderBlur;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = innerBorderW;
  ctx.shadowBlur = Math.round(borderBlur * 0.35);
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = spec.glowColor;
  ctx.shadowBlur = Math.max(14, Math.round(minDim * 0.12));

  const innerMargin = inset + outerBorderW + Math.max(8, Math.round(minDim * 0.045));
  const maxTextW = Math.max(40, W - innerMargin * 2);

  if (spec.vertical) {
    const chars = Array.from(spec.text);
    const subZoneH = spec.subText ? Math.max(36, Math.round(W * 0.27)) : 0;
    const topPad = innerMargin;
    const botPad = innerMargin + subZoneH;
    const usableH = Math.max(40, H - topPad - botPad);
    const stepY = usableH / chars.length;

    let charFont = Math.min(Math.floor(stepY * 0.84), Math.floor(maxTextW * 0.84));
    for (const ch of chars) {
      charFont = Math.min(charFont, fitFontSize(ctx, ch, 800, charFont, 16, HK_SERIF, maxTextW));
    }
    ctx.font = `800 ${charFont}px ${HK_SERIF}`;

    const startY = topPad + stepY * 0.5;
    chars.forEach((ch, idx) => {
      const cy = startY + idx * stepY;
      ctx.fillStyle = spec.glowColor;
      ctx.fillText(ch, W * 0.5, cy);
      ctx.fillStyle = spec.textColor;
      ctx.fillText(ch, W * 0.5, cy);
    });

    if (spec.subText) {
      const targetSub = Math.round(W * 0.135);
      fitFontSize(ctx, spec.subText, 700, targetSub, 11, HK_SANS, maxTextW);
      ctx.shadowBlur = Math.max(8, Math.round(minDim * 0.055));
      ctx.fillStyle = spec.borderColor;
      ctx.fillText(spec.subText, W * 0.5, H - inset - outerBorderW - subZoneH * 0.44);
    }
  } else {
    const targetMain = Math.round(H * (spec.subText ? 0.44 : 0.54));
    fitFontSize(ctx, spec.text, 800, targetMain, 18, HK_SERIF, maxTextW);
    const mainY = spec.subText ? H * 0.42 : H * 0.52;
    ctx.fillStyle = spec.glowColor;
    ctx.fillText(spec.text, W * 0.5, mainY);
    ctx.fillStyle = spec.textColor;
    ctx.fillText(spec.text, W * 0.5, mainY);

    if (spec.subText) {
      const targetSub = Math.round(H * 0.165);
      fitFontSize(ctx, spec.subText, 700, targetSub, 12, HK_SANS, maxTextW);
      ctx.shadowBlur = Math.max(8, Math.round(minDim * 0.065));
      ctx.fillStyle = spec.borderColor;
      ctx.fillText(spec.subText, W * 0.5, H * 0.78);
    }
  }
  ctx.restore();

  return toTexture(canvas, { wrap: false });
}

export function createShopInteriorTexture(
  kind: 'chachaanteng' | 'noodle' | 'mart',
  customWidth?: number,
  customHeight?: number
): THREE.CanvasTexture {
  const W = customWidth ?? (kind === 'mart' ? 1024 : kind === 'chachaanteng' ? 780 : 680);
  const H = customHeight ?? 512;
  const [canvas, ctx] = makeCanvas(W, H);

  if (kind === 'mart') {
    // Crisp icy-cyan 24H convenience store back-wall chiller cabinet bank
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#d8f9ff');
    grad.addColorStop(0.24, '#8de0f8');
    grad.addColorStop(0.76, '#3e9ec0');
    grad.addColorStop(1, '#184458');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Classic HK 24H green-orange-red brand ribbon header
    ctx.fillStyle = '#157a5b';
    ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = '#ee8228';
    ctx.fillRect(0, 22, W, 10);
    ctx.fillStyle = '#c83430';
    ctx.fillRect(0, 32, W, 6);

    // Fluorescent ceiling LED header strip
    ctx.fillStyle = '#f4feff';
    ctx.fillRect(32, 46, W - 64, 14);

    // Chiller category headers
    const headers = ['冷飲 DRINKS', '茶飲 TEA', '鮮奶 DAIRY', '啤酒 BEER', '小食 SNACKS'];
    const shelfCols = 5;
    const colW = (W - 56) / shelfCols;
    const bottleColors = ['#e04238', '#28a862', '#f0b22c', '#2e7ee0', '#edf4fa', '#d4488c', '#4ec4b2', '#e87830'];

    for (let c = 0; c < shelfCols; c++) {
      const sx = 28 + c * colW;
      // Glowing category header bar
      ctx.fillStyle = '#10445c';
      ctx.fillRect(sx + 8, 70, colW - 16, 26);
      ctx.fillStyle = '#dffaff';
      fitFontSize(ctx, headers[c], 800, 16, 10, HK_SANS, colW - 24);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(headers[c], sx + colW * 0.5, 83);

      // Chiller cabinet bay recess & glass door frame
      ctx.fillStyle = 'rgba(12, 38, 54, 0.24)';
      ctx.fillRect(sx + 8, 100, colW - 16, H - 134);
      ctx.strokeStyle = 'rgba(18, 46, 62, 0.88)';
      ctx.lineWidth = 6;
      ctx.strokeRect(sx + 6, 98, colW - 12, H - 130);

      const innerColW = colW - 28;
      const bottleSlot = innerColW / 6;
      const bottleW = Math.max(12, Math.floor(bottleSlot * 0.68));
      for (let row = 0; row < 5; row++) {
        const sy = 114 + row * 72;
        // Metal shelf rail + white price-tag strip
        ctx.fillStyle = '#143448';
        ctx.fillRect(sx + 10, sy + 50, colW - 20, 7);
        ctx.fillStyle = '#d8f2fc';
        ctx.fillRect(sx + 12, sy + 51, colW - 24, 3);

        for (let b = 0; b < 6; b++) {
          const bx = sx + 14 + b * bottleSlot + (bottleSlot - bottleW) * 0.5;
          const col = bottleColors[(c * 3 + row * 2 + b) % bottleColors.length];
          const isTall = (row + b) % 2 === 0;
          const bh = isTall ? 40 : 30;
          ctx.fillStyle = col;
          ctx.fillRect(bx, sy + 49 - bh, bottleW, bh);
          // Bottle cap & label stripe
          ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.fillRect(bx + 2, sy + 49 - bh * 0.62, bottleW - 4, 9);
          ctx.fillStyle = '#eef6fa';
          ctx.fillRect(bx + Math.round(bottleW * 0.28), sy + 49 - bh - 4, Math.max(6, Math.round(bottleW * 0.44)), 4);
        }
      }
      // Subtle vertical cooler door handle
      ctx.fillStyle = '#c8e4f0';
      ctx.fillRect(sx + colW - 18, 220, 5, 86);
    }
  } else {
    // Rich warm golden tungsten Hong Kong Cha Chaan Teng / Wonton Noodle shop interior!
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ffe2a4');
    grad.addColorStop(0.38, '#ee9b40');
    grad.addColorStop(0.78, '#b65b22');
    grad.addColorStop(1, '#5e2c12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Classic HK green-and-white ceramic wainscot tile dado along lower interior wall
    const dadoTop = H * 0.60;
    const tileSz = 26;
    for (let ty = dadoTop; ty < H; ty += tileSz) {
      for (let tx = 0; tx < W; tx += tileSz) {
        const checker = ((Math.floor(tx / tileSz) + Math.floor((ty - dadoTop) / tileSz)) % 2) === 0;
        ctx.fillStyle =
          kind === 'chachaanteng'
            ? checker
              ? 'rgba(42, 114, 88, 0.78)'
              : 'rgba(232, 220, 194, 0.72)'
            : checker
            ? 'rgba(182, 142, 92, 0.56)'
            : 'rgba(236, 214, 174, 0.62)';
        ctx.fillRect(tx + 1, ty + 1, tileSz - 2, tileSz - 2);
      }
    }
    // Dado chair-rail trim molding
    ctx.fillStyle = '#3a2214';
    ctx.fillRect(0, dadoTop - 6, W, 10);
    ctx.fillStyle = '#e8c488';
    ctx.fillRect(0, dadoTop - 8, W, 3);

    // Warm glowing vintage HK hanging pendant lamps evenly distributed across W
    const lampCount = W >= 820 ? 4 : 3;
    for (let i = 0; i < lampCount; i++) {
      const lx = (W / lampCount) * (i + 0.5);
      const halo = ctx.createRadialGradient(lx, 96, 8, lx, 96, 134);
      halo.addColorStop(0, 'rgba(255, 250, 224, 0.96)');
      halo.addColorStop(0.34, 'rgba(255, 206, 118, 0.58)');
      halo.addColorStop(1, 'rgba(255, 152, 52, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(lx, 96, 134, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#361f14';
      ctx.fillRect(lx - 3, 0, 6, 72);
      ctx.fillStyle = kind === 'chachaanteng' ? '#1e5844' : '#8c2822';
      ctx.beginPath();
      ctx.arc(lx, 84, 24, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fff5cc';
      ctx.beginPath();
      ctx.arc(lx, 88, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Iconic red-and-gold calligraphic header banner plaque
    const bannerW = Math.round(W * 0.68);
    const bannerX = Math.round((W - bannerW) * 0.5);
    ctx.fillStyle = kind === 'chachaanteng' ? '#1a4c3b' : '#8a221c';
    ctx.fillRect(bannerX, 20, bannerW, 52);
    ctx.strokeStyle = '#f4cf7a';
    ctx.lineWidth = 3;
    ctx.strokeRect(bannerX + 4, 24, bannerW - 8, 44);
    ctx.fillStyle = '#fff3cf';
    const bannerTitle =
      kind === 'chachaanteng' ? '金鳳冰室 · 菠蘿油 · 奶茶' : '明記雲吞麵 · 燒味粉麵';
    fitFontSize(ctx, bannerTitle, 900, 28, 16, HK_SERIF, bannerW - 28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bannerTitle, W * 0.5, 47);

    // Traditional HK Menu Boards (紅綠木牌價目表) adapted cleanly to exact wall width W
    const allMenuItems =
      kind === 'chachaanteng'
        ? [
            ['菠蘿油', '$12'],
            ['絲襪奶茶', '$22'],
            ['西多士', '$28'],
            ['沙嗲牛麵', '$38'],
            ['出爐蛋撻', '$10'],
            ['凍檸茶', '$24']
          ]
        : [
            ['鮮蝦雲吞麵', '$36'],
            ['柱侯牛腩撈', '$44'],
            ['潮州魚蛋河', '$34'],
            ['招牌燒鴨飯', '$48'],
            ['凍檸茶', '$20'],
            ['油菜', '$18']
          ];
    const menuItems = W < 700 ? allMenuItems.slice(0, 5) : allMenuItems;
    const padX = 20;
    const gap = 10;
    const boardW = (W - padX * 2 - gap * (menuItems.length - 1)) / menuItems.length;
    const boardH = 114;

    menuItems.forEach(([item, price], idx) => {
      const mx = padX + idx * (boardW + gap);
      const my = 122;
      ctx.fillStyle = idx % 2 === 0 ? '#a62822' : '#1d5a44';
      ctx.fillRect(mx, my, boardW, boardH);
      ctx.strokeStyle = '#f4d48c';
      ctx.lineWidth = 3;
      ctx.strokeRect(mx + 4, my + 4, boardW - 8, boardH - 8);
      ctx.fillStyle = '#fff6dc';
      fitFontSize(ctx, item, 800, 24, 13, HK_SANS, boardW - 18);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item, mx + boardW * 0.5, my + 46);
      ctx.fillStyle = '#ffdc80';
      fitFontSize(ctx, price, 700, 20, 13, HK_SANS, boardW - 18);
      ctx.fillText(price, mx + boardW * 0.5, my + 84);
    });

    if (kind === 'noodle') {
      // Illuminated Hong Kong Siu-Mei hanging roast-meat showcase on right side (燒味櫥窗)!
      const sw = Math.min(232, Math.round(W * 0.34));
      const sx = W - sw - 26;
      const sy = 250;
      ctx.fillStyle = 'rgba(255, 224, 152, 0.85)';
      ctx.fillRect(sx, sy, sw, 168);
      ctx.strokeStyle = '#c8d2d8';
      ctx.lineWidth = 6;
      ctx.strokeRect(sx, sy, sw, 168);
      // Hanging steel rail
      ctx.fillStyle = '#5a6670';
      ctx.fillRect(sx + 8, sy + 18, sw - 16, 6);
      // Glazed roast duck / char siu silhouettes hanging from hooks
      const roastCols = ['#8e2e18', '#a63e1c', '#7a2614', '#b44c22', '#8a301a'];
      const roastStep = (sw - 40) / 4;
      for (let r = 0; r < 5; r++) {
        const rx = sx + 20 + r * roastStep;
        ctx.strokeStyle = '#3a4248';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(rx, sy + 22);
        ctx.lineTo(rx, sy + 42);
        ctx.stroke();
        ctx.fillStyle = roastCols[r];
        ctx.beginPath();
        ctx.ellipse(rx, sy + 76, 13, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 210, 140, 0.36)';
        ctx.beginPath();
        ctx.ellipse(rx - 4, sy + 68, 4, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Cha Chaan Teng pastry display cabinet (出爐麵包櫃) with golden egg tarts & pineapple buns
      const bw = Math.min(240, Math.round(W * 0.33));
      const bx = 32;
      const by = 264;
      ctx.fillStyle = 'rgba(255, 232, 178, 0.78)';
      ctx.fillRect(bx, by, bw, 142);
      ctx.strokeStyle = '#b89462';
      ctx.lineWidth = 5;
      ctx.strokeRect(bx, by, bw, 142);
      const pastryCount = 6;
      const pStep = (bw - 48) / (pastryCount - 1);
      for (let tray = 0; tray < 2; tray++) {
        const ty = by + 56 + tray * 58;
        ctx.fillStyle = '#707c86';
        ctx.fillRect(bx + 12, ty, bw - 24, 8);
        for (let p = 0; p < pastryCount; p++) {
          ctx.fillStyle = tray === 0 ? '#e89d38' : '#f4c048';
          ctx.beginPath();
          ctx.arc(bx + 24 + p * pStep, ty - 6, 11, Math.PI, 0);
          ctx.fill();
        }
      }
    }

    // Warm timber & marble service counter along bottom
    ctx.fillStyle = '#482414';
    ctx.fillRect(0, H - 104, W, 104);
    ctx.fillStyle = '#e2be88';
    ctx.fillRect(0, H - 112, W, 12);
    // Decorative brass counter strip
    ctx.fillStyle = '#c89a4c';
    ctx.fillRect(0, H - 62, W, 5);
  }

  return toTexture(canvas, { wrap: false });
}

export function createVendingMachineTexture(tint: 'cyan' | 'white' = 'cyan'): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = tint === 'cyan' ? '#b0dce9' : '#d2e2ec';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#264458';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  // Backlit header banner (positioned cleanly below 3D top bezel)
  ctx.fillStyle = tint === 'cyan' ? '#135b72' : '#245870';
  ctx.fillRect(18, 22, W - 36, 36);
  ctx.fillStyle = '#e8fbff';
  fitFontSize(ctx, '冷熱飲品 · 24H', 800, 19, 12, HK_SANS, W - 52);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('冷熱飲品 · 24H', W * 0.5, 40);

  // Bright illuminated beverage showcase backing (y = 62..320 aligned above 3D mid bezel)
  const g = ctx.createLinearGradient(0, 62, 0, 322);
  g.addColorStop(0, '#e8fbff');
  g.addColorStop(0.5, '#90e2f6');
  g.addColorStop(1, '#54b6d4');
  ctx.fillStyle = g;
  ctx.fillRect(18, 62, W - 36, 258);

  const colors = ['#e0403c', '#2ca864', '#efa828', '#2c7cd6', '#e0588c', '#f4f8fc', '#46b8a6'];
  for (let row = 0; row < 4; row++) {
    const ry = 74 + row * 61;
    // Shelf rail + Hot/Cold indicator strip (blue cold / red hot)
    ctx.fillStyle = '#1b3e54';
    ctx.fillRect(20, ry + 40, W - 40, 13);
    ctx.fillStyle = row === 3 ? '#e8483c' : '#2898dc';
    ctx.fillRect(24, ry + 43, W - 48, 4);

    for (let col = 0; col < 6; col++) {
      const bx = 28 + col * 34;
      ctx.fillStyle = colors[(row * 3 + col) % colors.length];
      ctx.fillRect(bx, ry + 6, 20, 33);
      // White label band & cap
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillRect(bx + 2, ry + 17, 16, 8);
      ctx.fillStyle = '#f2f8fc';
      ctx.fillRect(bx + 5, ry + 2, 10, 4);
      // Tiny glowing selection button
      ctx.fillStyle = '#e4f8ff';
      ctx.fillRect(bx + 4, ry + 49, 12, 3);
    }
  }

  // Lower control area (y = 356..468 aligned cleanly below 3D mid bezel & above bottom bezel)
  ctx.fillStyle = '#152532';
  ctx.fillRect(24, 364, W - 104, 96);
  ctx.strokeStyle = '#6c8ea2';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 364, W - 104, 96);

  // Octopus card contactless pad (八達通)
  ctx.fillStyle = '#f4b43a';
  ctx.fillRect(W - 68, 358, 46, 46);
  ctx.fillStyle = '#1a2e3e';
  fitFontSize(ctx, '八達通', 800, 13, 9, HK_SANS, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('八達通', W - 45, 382);

  // Coin & bill slot panel
  ctx.fillStyle = '#223848';
  ctx.fillRect(W - 68, 412, 46, 50);
  ctx.fillStyle = '#7ad4ec';
  ctx.fillRect(W - 58, 422, 26, 6);

  return toTexture(canvas, { wrap: false });
}

export function createStreetPlaqueTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = '#f2efe8';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#1c242c';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, W - 12, H - 12);

  ctx.fillStyle = '#161d24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFontSize(ctx, '灣 仔 道', 800, 44, 24, HK_SANS, W - 36);
  ctx.fillText('灣 仔 道', W * 0.5, 48);
  fitFontSize(ctx, 'WAN CHAI RD', 700, 22, 14, HK_SANS, W - 36);
  ctx.fillText('WAN CHAI RD', W * 0.5, 92);

  return toTexture(canvas, { wrap: false });
}

export function createTramStopSignTexture(): THREE.CanvasTexture {
  const W = 192;
  const H = 192;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#1d5e45';
  ctx.beginPath();
  ctx.arc(96, 96, 94, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#f4ead2';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(96, 96, 82, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f8f2e2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFontSize(ctx, '電車站', 800, 36, 20, HK_SANS, 134);
  ctx.fillText('電車站', 96, 78);
  fitFontSize(ctx, 'TRAM STOP', 700, 20, 12, HK_SANS, 128);
  ctx.fillText('TRAM STOP', 96, 120);

  return toTexture(canvas, { wrap: false });
}

export function createTramSideTexture(): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const W = 512;
  const H = 384;
  const [canvas, ctx] = makeCanvas(W, H);
  const [eCanvas, ectx] = makeCanvas(W, H);

  ctx.fillStyle = '#1f5c43';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#efe3c6';
  ctx.fillRect(0, 26, W, 118);
  ctx.fillRect(0, 198, W, 108);

  ctx.fillStyle = '#d4b472';
  ctx.fillRect(0, 148, W, 5);
  ctx.fillRect(0, 188, W, 5);
  ctx.fillRect(0, 310, W, 6);

  ctx.fillStyle = '#f3e5c4';
  fitFontSize(ctx, '香 港 電 車  ·  120  ·  HONG KONG TRAMWAYS', 700, 20, 12, HK_SERIF, W - 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('香 港 電 車  ·  120  ·  HONG KONG TRAMWAYS', W * 0.5, 171);

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, W, H);

  const winCount = 7;
  const padX = 24;
  const winW = (W - padX * 2) / winCount - 10;

  const drawDeckWindows = (topY: number, winH: number, isUpper: boolean) => {
    for (let i = 0; i < winCount; i++) {
      const wx = padX + i * ((W - padX * 2) / winCount) + 5;

      const g = ctx.createLinearGradient(wx, topY, wx, topY + winH);
      g.addColorStop(0, '#f5d996');
      g.addColorStop(0.5, '#e29e44');
      g.addColorStop(1, '#9c541c');
      ctx.fillStyle = g;
      ctx.fillRect(wx, topY, winW, winH);

      const eg = ectx.createLinearGradient(wx, topY, wx, topY + winH);
      eg.addColorStop(0, '#eac476');
      eg.addColorStop(0.6, '#cf8430');
      eg.addColorStop(1, '#7c3c12');
      ectx.fillStyle = eg;
      ectx.fillRect(wx, topY, winW, winH);

      if (isUpper && (i === 1 || i === 3 || i === 5)) {
        ctx.fillStyle = 'rgba(42, 26, 18, 0.62)';
        ectx.fillStyle = 'rgba(0, 0, 0, 0.70)';
        const px = wx + winW * 0.5;
        ctx.beginPath();
        ctx.arc(px, topY + winH * 0.54, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px - 11, topY + winH * 0.65, 22, winH * 0.35);

        ectx.beginPath();
        ectx.arc(px, topY + winH * 0.54, 9, 0, Math.PI * 2);
        ectx.fill();
        ectx.fillRect(px - 11, topY + winH * 0.65, 22, winH * 0.35);
      }

      ctx.strokeStyle = '#362316';
      ctx.lineWidth = 4;
      ctx.strokeRect(wx, topY, winW, winH);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, topY + winH * 0.28);
      ctx.lineTo(wx + winW, topY + winH * 0.28);
      ctx.stroke();

      ectx.strokeStyle = '#000000';
      ectx.lineWidth = 4;
      ectx.strokeRect(wx, topY, winW, winH);
    }
  };

  drawDeckWindows(38, 94, true);
  drawDeckWindows(210, 86, false);

  return {
    map: toTexture(canvas, { wrap: false }),
    emissiveMap: toTexture(eCanvas, { wrap: false })
  };
}

/**
 * Painted Hong Kong Tram front/rear glass window with teak wood mullions, warm interior glow,
 * and subtle driver/passenger silhouette (prevents white bloom blowout!).
 */
export function createTramFrontGlassTexture(isDriverCab = true): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const W = 256;
  const H = 160;
  const [canvas, ctx] = makeCanvas(W, H);
  const [eCanvas, ectx] = makeCanvas(W, H);

  // Subtle shaded warm cab glass
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5a4430');
  g.addColorStop(0.28, '#c8924e');
  g.addColorStop(0.76, '#dfaa5e');
  g.addColorStop(1, '#684020');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const eg = ectx.createLinearGradient(0, 0, 0, H);
  eg.addColorStop(0, '#302014');
  eg.addColorStop(0.32, '#a87234');
  eg.addColorStop(0.78, '#bd863c');
  eg.addColorStop(1, '#462810');
  ectx.fillStyle = eg;
  ectx.fillRect(0, 0, W, H);

  // Diagonal cool wet rain reflection glint across windshield
  ctx.fillStyle = 'rgba(182, 212, 232, 0.16)';
  ctx.beginPath();
  ctx.moveTo(18, 12);
  ctx.lineTo(84, 12);
  ctx.lineTo(42, H - 18);
  ctx.lineTo(14, H - 18);
  ctx.closePath();
  ctx.fill();

  if (isDriverCab) {
    // Subtle tram driver silhouette & brass control wheel on left side
    const drawDriver = (tCtx: CanvasRenderingContext2D, col: string) => {
      tCtx.fillStyle = col;
      tCtx.beginPath();
      tCtx.arc(W * 0.38, H * 0.48, 17, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.fillRect(W * 0.28, H * 0.58, 52, H * 0.42);
      // Lower dashboard console shadow
      tCtx.fillRect(0, H * 0.78, W, H * 0.22);
    };
    drawDriver(ctx, 'rgba(34, 24, 18, 0.68)');
    drawDriver(ectx, 'rgba(0, 0, 0, 0.78)');
  } else {
    // Upper deck seated front-row silhouette
    const drawPax = (tCtx: CanvasRenderingContext2D, col: string) => {
      tCtx.fillStyle = col;
      for (const px of [W * 0.28, W * 0.70]) {
        tCtx.beginPath();
        tCtx.arc(px, H * 0.52, 14, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillRect(px - 18, H * 0.64, 36, H * 0.36);
      }
    };
    drawPax(ctx, 'rgba(36, 24, 18, 0.52)');
    drawPax(ectx, 'rgba(0, 0, 0, 0.62)');
  }

  // Dark teak wooden frame & vertical center/side mullions
  const drawMullions = (tCtx: CanvasRenderingContext2D, col: string) => {
    tCtx.strokeStyle = col;
    tCtx.lineWidth = 10;
    tCtx.strokeRect(4, 4, W - 8, H - 8);
    tCtx.lineWidth = 7;
    tCtx.beginPath();
    tCtx.moveTo(W * 0.5, 0);
    tCtx.lineTo(W * 0.5, H);
    tCtx.moveTo(0, H * 0.26);
    tCtx.lineTo(W, H * 0.26);
    tCtx.stroke();
  };
  drawMullions(ctx, '#382416');
  drawMullions(ectx, '#000000');

  return {
    map: toTexture(canvas, { wrap: false }),
    emissiveMap: toTexture(eCanvas, { wrap: false })
  };
}

export function createTramBillboardTexture(): THREE.CanvasTexture {
  const W = 1150;
  const H = 100;
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = '#efe3c6';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#1f5c43';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Subtle brass inner heritage pinstripe
  ctx.strokeStyle = '#c8a35a';
  ctx.lineWidth = 2;
  ctx.strokeRect(11, 11, W - 22, H - 22);

  // Crisp square red 叮叮 heritage seal on the left
  const sealX = 18;
  const sealY = 16;
  const sealW = 86;
  const sealH = H - 32;
  ctx.fillStyle = '#a82c26';
  ctx.fillRect(sealX, sealY, sealW, sealH);
  ctx.strokeStyle = '#ebd098';
  ctx.lineWidth = 2;
  ctx.strokeRect(sealX + 4, sealY + 4, sealW - 8, sealH - 8);

  ctx.fillStyle = '#f8ecd0';
  fitFontSize(ctx, '叮叮', 800, 32, 18, HK_SERIF, sealW - 14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('叮叮', sealX + sealW * 0.5, H * 0.52);

  // Clean natural-proportion serif across the cream panel
  const headline = '香港電車 · 百年穿梭   HONG KONG TRAMWAYS';
  const panelLeft = sealX + sealW + 18;
  const panelRight = W - 22;
  const panelCenter = (panelLeft + panelRight) * 0.5;
  ctx.fillStyle = '#1b4736';
  fitFontSize(ctx, headline, 800, 42, 20, HK_SERIF, panelRight - panelLeft - 16);
  ctx.fillText(headline, panelCenter, H * 0.52);

  return toTexture(canvas, { wrap: false });
}

export function createTramDestinationTexture(): THREE.CanvasTexture {
  const W = 392;
  const H = 100;
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = '#161b1e';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d4b472';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  ctx.fillStyle = '#ffeab0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFontSize(ctx, '跑 馬 地', 800, 40, 22, HK_SANS, W - 36);
  ctx.fillText('跑 馬 地', W * 0.5, 38);
  ctx.fillStyle = '#f2c878';
  fitFontSize(ctx, 'HAPPY VALLEY', 700, 20, 12, HK_SANS, W - 36);
  ctx.fillText('HAPPY VALLEY', W * 0.5, 76);

  return toTexture(canvas, { wrap: false });
}

/**
 * Glowing Hong Kong Red Taxi roof box texture: TAXI 的士 (310 × 100, AR = 3.10 exact match!)
 */
export function createTaxiRoofSignTexture(): THREE.CanvasTexture {
  const W = 310;
  const H = 100;
  const [canvas, ctx] = makeCanvas(W, H);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fff2ba');
  g.addColorStop(1, '#f2bd48');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#382a18';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  ctx.fillStyle = '#1d1c1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFontSize(ctx, 'TAXI  的士', 900, 42, 22, HK_SANS, W - 36);
  ctx.fillText('TAXI  的士', W * 0.5, H * 0.52);

  return toTexture(canvas, { wrap: false });
}

/**
 * Classic Toyota Crown Comfort HK Red Taxi front grille / rear license plate (HK 1988)
 * Canvas 384 × 128 (AR = 3.00) matching front/rear face plates cleanly within <= 3%!
 */
export function createTaxiFaceTexture(isRear: boolean): THREE.CanvasTexture {
  const W = 384;
  const H = 128;
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = '#a42428';
  ctx.fillRect(0, 0, W, H);

  if (isRear) {
    // Classic Hong Kong yellow rear license plate + dark trunk recess
    ctx.fillStyle = '#24181a';
    ctx.fillRect(114, 34, 156, 58);
    ctx.fillStyle = '#f0c438';
    ctx.fillRect(122, 42, 140, 42);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(123, 43, 138, 40);
    ctx.fillStyle = '#141414';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFontSize(ctx, 'HK 1988', 900, 26, 14, HK_SANS, 126);
    ctx.fillText('HK 1988', W * 0.5, 64);

    // Classic HK 5-seat green badge on right trunk lid at true natural proportions
    ctx.fillStyle = '#206848';
    ctx.fillRect(292, 24, 70, 24);
    ctx.strokeStyle = '#d8ece2';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(293, 25, 68, 22);
    ctx.fillStyle = '#ffffff';
    fitFontSize(ctx, '5 SEATS', 700, 12, 8, HK_SANS, 60);
    ctx.fillText('5 SEATS', 327, 36);
  } else {
    // Front chrome slatted Crown Comfort grille + white HK front plate
    ctx.fillStyle = '#262b30';
    ctx.fillRect(92, 18, 200, 52);
    ctx.strokeStyle = '#d4dce4';
    ctx.lineWidth = 4;
    ctx.strokeRect(92, 18, 200, 52);
    ctx.lineWidth = 2;
    for (let y = 28; y <= 60; y += 8) {
      ctx.beginPath();
      ctx.moveTo(96, y);
      ctx.lineTo(288, y);
      ctx.stroke();
    }

    // White HK front license plate
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(126, 80, 132, 34);
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 2;
    ctx.strokeRect(127, 81, 130, 32);
    ctx.fillStyle = '#141414';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFontSize(ctx, 'HK 1988', 900, 23, 14, HK_SANS, 118);
    ctx.fillText('HK 1988', W * 0.5, 98);
  }

  return toTexture(canvas, { wrap: false });
}

export function createMetroTrainSideTexture(): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const W = 512;
  const H = 192;
  const [canvas, ctx] = makeCanvas(W, H);
  const [eCanvas, ectx] = makeCanvas(W, H);

  const bodyGrad = ctx.createLinearGradient(0, 0, 0, H);
  bodyGrad.addColorStop(0, '#c2ccd6');
  bodyGrad.addColorStop(0.5, '#d6dee6');
  bodyGrad.addColorStop(1, '#9ca8b4');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#9c2c2c';
  ctx.fillRect(0, 0, W, 24);
  ctx.fillStyle = '#962828';
  ctx.fillRect(0, H - 46, W, 34);
  ctx.fillStyle = '#e8dfd0';
  ctx.fillRect(0, H - 52, W, 6);

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, W, H);

  const sections = 6;
  const secW = (W - 24) / sections;
  for (let i = 0; i < sections; i++) {
    const sx = 12 + i * secW;
    const isDoor = i === 1 || i === 4;

    if (isDoor) {
      ctx.strokeStyle = '#5a6672';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 6, 30, secW - 12, H - 42);
      ctx.beginPath();
      ctx.moveTo(sx + secW * 0.5, 30);
      ctx.lineTo(sx + secW * 0.5, H - 12);
      ctx.stroke();

      for (const offset of [12, secW * 0.5 + 4]) {
        const dw = secW * 0.5 - 16;
        ctx.fillStyle = '#f2be6c';
        ctx.fillRect(sx + offset, 44, dw, 68);
        ectx.fillStyle = '#dc9a42';
        ectx.fillRect(sx + offset, 44, dw, 68);
      }
    } else {
      const wx = sx + 6;
      const ww = secW - 12;
      const wg = ctx.createLinearGradient(0, 42, 0, 114);
      wg.addColorStop(0, '#fae5b4');
      wg.addColorStop(0.55, '#ebac54');
      wg.addColorStop(1, '#b46826');
      ctx.fillStyle = wg;
      ctx.fillRect(wx, 42, ww, 72);

      const eg = ectx.createLinearGradient(0, 42, 0, 114);
      eg.addColorStop(0, '#f2d28a');
      eg.addColorStop(0.6, '#d48b36');
      eg.addColorStop(1, '#8c4414');
      ectx.fillStyle = eg;
      ectx.fillRect(wx, 42, ww, 72);

      ctx.strokeStyle = '#2e3842';
      ctx.lineWidth = 4;
      ctx.strokeRect(wx, 42, ww, 72);
      ectx.strokeStyle = '#000000';
      ectx.lineWidth = 4;
      ectx.strokeRect(wx, 42, ww, 72);
    }
  }

  return {
    map: toTexture(canvas, { wrap: false }),
    emissiveMap: toTexture(eCanvas, { wrap: false })
  };
}

export function createNewsRackTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const rand = mulberry32(77);
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = '#2d3b34';
  ctx.fillRect(0, 0, W, H);

  const colors = ['#f0e6d2', '#d85c48', '#4888b8', '#e6b848', '#e8eef2', '#5ea068'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      const px = 8 + col * 30;
      const py = 10 + row * 38;
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      ctx.fillRect(px, py, 24, 31);
      ctx.fillStyle = 'rgba(20, 26, 34, 0.45)';
      ctx.fillRect(px + 3, py + 4, 18, 6);
      ctx.fillRect(px + 3, py + 13, 14, 3);
      ctx.fillRect(px + 3, py + 19, 16, 3);
    }
  }
  return toTexture(canvas, { wrap: false });
}

/**
 * Painterly dappled Bauhinia (洋紫荊) blossom texture for matte organic tree canopies
 */
export function createBauhiniaCanopyTexture(seed = 808): THREE.CanvasTexture {
  const S = 256;
  const rand = mulberry32(seed);
  const [canvas, ctx] = makeCanvas(S, S);

  ctx.fillStyle = '#d48eb0';
  ctx.fillRect(0, 0, S, S);

  const swatches = ['#f4c6db', '#e298ba', '#b86892', '#8a4c72', '#f8d8e6', '#c678a0'];
  for (let i = 0; i < 420; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const rx = 5 + rand() * 14;
    const ry = 4 + rand() * 11;
    const ang = rand() * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = swatches[Math.floor(rand() * swatches.length)];
    ctx.globalAlpha = 0.55 + rand() * 0.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Subtle dark botanical gaps for painterly foliage depth
  for (let i = 0; i < 90; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 3 + rand() * 6;
    ctx.fillStyle = 'rgba(54, 30, 52, 0.32)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return toTexture(canvas, { repeatX: 2, repeatY: 2 });
}

/**
 * Soft painterly cloud-mist sprite texture with STRICT circular alpha falloff
 * hitting 0.0 completely by r = 0.43 * S so NO mist sprite quad can EVER show a straight border!
 */
export function createMistCloudTexture(seed = 2026): THREE.CanvasTexture {
  const S = 256;
  const rand = mulberry32(seed);
  const [canvas, ctx] = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);

  const core = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.03, S * 0.5, S * 0.5, S * 0.40);
  core.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
  core.addColorStop(0.45, 'rgba(255, 255, 255, 0.34)');
  core.addColorStop(0.78, 'rgba(255, 255, 255, 0.08)');
  core.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  // Subtle wispy interior puffs strictly inside safe radius
  for (let i = 0; i < 10; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = (0.04 + rand() * 0.14) * S;
    const cx = S * 0.5 + Math.cos(angle) * dist;
    const cy = S * 0.5 + Math.sin(angle) * dist * 0.76;
    const rad = (0.12 + rand() * 0.11) * S;
    const puff = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    puff.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    puff.addColorStop(0.55, 'rgba(255, 255, 255, 0.08)');
    puff.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Strict circular alpha envelope guaranteeing exact 0 alpha for r >= 0.43*S (zero quad seams!)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.14, S * 0.5, S * 0.5, S * 0.43);
  mask.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  mask.addColorStop(0.62, 'rgba(255, 255, 255, 0.55)');
  mask.addColorStop(0.88, 'rgba(255, 255, 255, 0.10)');
  mask.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();

  return toTexture(canvas, { wrap: false });
}

export function createContactShadowTexture(shape: 'rect' | 'round' = 'rect'): THREE.CanvasTexture {
  const S = 128;
  const [canvas, ctx] = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);

  if (shape === 'round') {
    const g = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.08, S * 0.5, S * 0.5, S * 0.46);
    g.addColorStop(0, 'rgba(8, 14, 24, 0.72)');
    g.addColorStop(0.55, 'rgba(8, 14, 24, 0.32)');
    g.addColorStop(1, 'rgba(8, 14, 24, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else {
    const pad = 24;
    ctx.save();
    ctx.shadowColor = 'rgba(8, 14, 24, 0.78)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(8, 14, 24, 0.70)';
    ctx.fillRect(pad, pad, S - pad * 2, S - pad * 2);
    ctx.restore();
  }

  return toTexture(canvas, { wrap: false });
}

export function createGlowSpriteTexture(): THREE.CanvasTexture {
  const S = 128;
  const [canvas, ctx] = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);

  const g = ctx.createRadialGradient(S * 0.5, S * 0.5, 2, S * 0.5, S * 0.5, S * 0.45);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  g.addColorStop(0.28, 'rgba(255, 255, 255, 0.40)');
  g.addColorStop(0.65, 'rgba(255, 255, 255, 0.09)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  return toTexture(canvas, { wrap: false });
}

/**
 * Ornate Hong Kong vintage arched / pill-framed neon sign texture
 * ('seafood' = 海鮮酒家 crimson-gold-emerald; 'mahjong' = 雀館 emerald-gold)
 */
export function createArchedNeonSignTexture(spec: {
  mainText: string;
  subText?: string;
  style: 'seafood' | 'mahjong';
}): THREE.CanvasTexture {
  const W = 524;
  const H = 240;
  const [canvas, ctx] = makeCanvas(W, H);

  const isSeafood = spec.style === 'seafood';
  const bg = isSeafood ? '#1e1014' : '#0f241c';
  const outerBorder = isSeafood ? '#ff4448' : '#3cf098';
  const innerBorder = isSeafood ? '#ffd468' : '#ffcf56';
  const textCol = '#fff6d8';
  const glowCol = isSeafood ? '#ff5830' : '#28e688';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle horizontal neon tube support wires behind letters
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  for (let y = 26; y < H; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Pill-arched double neon frame
  const drawPill = (inset: number, r: number) => {
    const x = inset;
    const y = inset;
    const w = W - inset * 2;
    const h = H - inset * 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  ctx.save();
  ctx.strokeStyle = outerBorder;
  ctx.lineWidth = 8;
  ctx.shadowColor = outerBorder;
  ctx.shadowBlur = 20;
  drawPill(12, 48);
  ctx.stroke();

  ctx.strokeStyle = innerBorder;
  ctx.lineWidth = 4;
  ctx.shadowColor = innerBorder;
  ctx.shadowBlur = 14;
  drawPill(24, 40);
  ctx.stroke();

  // Emerald / crimson decorative side medallions
  const medCol = isSeafood ? '#3ce896' : '#ff5460';
  ctx.strokeStyle = medCol;
  ctx.shadowColor = medCol;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 4;
  for (const mx of [52, W - 52]) {
    ctx.beginPath();
    ctx.arc(mx, H * 0.5, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, H * 0.5, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Calligraphic neon main text + subtext (uniformly fitted with zero horizontal crushing!)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowCol;
  ctx.shadowBlur = 24;
  fitFontSize(ctx, spec.mainText, 900, 74, 30, HK_SERIF, W - 156);
  const mainY = spec.subText ? H * 0.43 : H * 0.52;
  ctx.fillStyle = glowCol;
  ctx.fillText(spec.mainText, W * 0.5, mainY);
  ctx.fillStyle = textCol;
  ctx.fillText(spec.mainText, W * 0.5, mainY);

  if (spec.subText) {
    fitFontSize(ctx, spec.subText, 700, 23, 12, HK_SANS, W - 124);
    ctx.shadowColor = innerBorder;
    ctx.shadowBlur = 12;
    ctx.fillStyle = innerBorder;
    ctx.fillText(spec.subText, W * 0.5, H * 0.77);
  }
  ctx.restore();

  return toTexture(canvas, { wrap: false });
}

/**
 * Classic Hong Kong green-and-white ceramic wainscot tile dado (綠白紙皮石/階磚)
 * for Cha Chaan Teng arcade columns & traditional shopfront pillars.
 */
export function createTileDadoTexture(
  primaryHex = '#296b54',
  accentHex = '#e6dfd0'
): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const rand = mulberry32(618);
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, W, H);

  const sz = 16;
  for (let y = 0; y < H; y += sz) {
    for (let x = 0; x < W; x += sz) {
      const rowIdx = Math.floor(y / sz);
      const colIdx = Math.floor(x / sz);
      // Decorative green top/bottom border bands + classic HK checker field
      const isBand = rowIdx <= 1 || rowIdx >= 13;
      const isGreen = isBand || (rowIdx + colIdx) % 2 === 0;
      ctx.fillStyle = isGreen ? primaryHex : accentHex;
      ctx.fillRect(x + 1, y + 1, sz - 2, sz - 2);

      // Subtle glazed highlight
      const v = (rand() - 0.5) * 16;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 180})` : `rgba(10,24,20,${-v / 160})`;
      ctx.fillRect(x + 1, y + 1, sz - 2, sz - 2);

      ctx.strokeStyle = 'rgba(20, 34, 30, 0.34)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, sz - 1, sz - 1);
    }
  }

  // Bottom street rain-splash darkening
  const splash = ctx.createLinearGradient(0, H * 0.72, 0, H);
  splash.addColorStop(0, 'rgba(10, 18, 16, 0)');
  splash.addColorStop(1, 'rgba(10, 18, 16, 0.42)');
  ctx.fillStyle = splash;
  ctx.fillRect(0, H * 0.72, W, H * 0.28);

  return toTexture(canvas, { repeatX: 1, repeatY: 1 });
}

/**
 * Fine woven emerald-green Hong Kong bamboo scaffolding safety mesh (棚網).
 */
export function createSafetyNetTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);

  // Translucent emerald base fill
  ctx.fillStyle = 'rgba(34, 134, 96, 0.34)';
  ctx.fillRect(0, 0, W, H);

  // Fine woven grid filaments
  ctx.strokeStyle = 'rgba(64, 186, 134, 0.65)';
  ctx.lineWidth = 1.2;
  for (let x = 0; x < W; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Reinforced horizontal hem stripes
  ctx.fillStyle = 'rgba(22, 96, 68, 0.62)';
  ctx.fillRect(0, 0, W, 8);
  ctx.fillRect(0, H - 8, W, 8);
  ctx.fillRect(0, H * 0.5 - 3, W, 6);

  return toTexture(canvas, { repeatX: 2, repeatY: 3 });
}

/**
 * Crisp industrial angled steel louver ventilation grille texture for substation & utility walls.
 */
export function createLouvreVentTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const [canvas, ctx] = makeCanvas(W, H);

  ctx.fillStyle = '#18222b';
  ctx.fillRect(0, 0, W, H);

  const slatH = 14;
  for (let y = 10; y < H - 10; y += slatH) {
    const g = ctx.createLinearGradient(0, y, 0, y + slatH);
    g.addColorStop(0, '#6a7c8c');
    g.addColorStop(0.45, '#465766');
    g.addColorStop(0.65, '#1b242c');
    g.addColorStop(1, '#10161c');
    ctx.fillStyle = g;
    ctx.fillRect(10, y, W - 20, slatH - 2);
  }

  // Center vertical mullion divider & riveted perimeter frame
  ctx.fillStyle = '#384856';
  ctx.fillRect(W * 0.5 - 5, 8, 10, H - 16);
  ctx.strokeStyle = '#4e6070';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  return toTexture(canvas, { wrap: false });
}
