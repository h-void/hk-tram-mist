import * as THREE from 'three';
import { createSoftLightConeMaterial } from './atmosphere';
import { getHKSignalState } from './hkSignal';
import {
  createBauhiniaCanopyTexture,
  createBusShelterMapTexture,
  createContactShadowTexture,
  createCorrugatedTinTexture,
  createFoliageCanopyTexture,
  createNewsRackTexture,
  createPhoneBoothSignTexture,
  createStreetPlaqueTexture,
  createTramStopSignTexture
} from './textures';

export interface PropsAndLifeSystem {
  group: THREE.Group;
  bauhiniaCenters: THREE.Vector3[];
  setEmissiveScale: (scale: number) => void;
  setPrintMode: (enabled: boolean) => void;
  update: (simTime: number) => void;
}

const HK_SANS = "'Noto Sans CJK HK', 'Noto Sans CJK TC', 'PingFang HK', 'Microsoft JhengHei', sans-serif";

function markSkipPrintEdges<T extends THREE.Object3D>(obj: T): T {
  obj.userData.skipPrintEdges = true;
  return obj;
}

function makeLocalTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts?: { wrap?: boolean; repeatX?: number; repeatY?: number }
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts?.wrap) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (opts.repeatX || opts.repeatY) {
      tex.repeat.set(opts.repeatX ?? 1, opts.repeatY ?? 1);
    }
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

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

/**
 * Hong Kong pedestrian crossing signal face (過路公仔燈):
 * switches cleanly between bright emerald-green walking man (綠公仔)
 * and bright crimson standing man (紅公仔).
 */
function createPedSignalTexture(
  active: 'green' | 'red'
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const redLit = active === 'red';
  const greenLit = active === 'green';
  const drawSignal = (emissiveOnly: boolean) =>
    makeLocalTexture(128, 256, (ctx, W, H) => {
      ctx.fillStyle = emissiveOnly ? '#000000' : '#161b20';
      ctx.fillRect(0, 0, W, H);

      if (!emissiveOnly) {
        ctx.strokeStyle = '#313b44';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, W - 6, H - 6);
      }

      // Upper lens circle (red standing man — 紅公仔)
      ctx.fillStyle = redLit
        ? (emissiveOnly ? '#1c0506' : '#1b1112')
        : (emissiveOnly ? '#080202' : '#111418');
      ctx.beginPath();
      ctx.arc(W * 0.5, 68, 44, 0, Math.PI * 2);
      ctx.fill();

      if (redLit) {
        const redHalo = ctx.createRadialGradient(W * 0.5, 68, 6, W * 0.5, 68, 44);
        redHalo.addColorStop(0, 'rgba(255, 86, 72, 0.58)');
        redHalo.addColorStop(0.6, 'rgba(230, 48, 40, 0.20)');
        redHalo.addColorStop(1, 'rgba(180, 28, 24, 0)');
        ctx.fillStyle = redHalo;
        ctx.beginPath();
        ctx.arc(W * 0.5, 68, 44, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = redLit ? '#ff6258' : (emissiveOnly ? '#180506' : '#3d1517');
      // Standing red man silhouette
      ctx.beginPath();
      ctx.arc(W * 0.5, 44, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(W * 0.5 - 9, 54, 18, 24);
      ctx.fillRect(W * 0.5 - 8, 78, 6, 20);
      ctx.fillRect(W * 0.5 + 2, 78, 6, 20);

      // Lower lens circle (emerald-green walking man — 綠公仔)
      ctx.fillStyle = greenLit
        ? (emissiveOnly ? '#061a10' : '#0f1816')
        : (emissiveOnly ? '#020806' : '#111418');
      ctx.beginPath();
      ctx.arc(W * 0.5, 186, 46, 0, Math.PI * 2);
      ctx.fill();

      if (greenLit) {
        const halo = ctx.createRadialGradient(W * 0.5, 186, 6, W * 0.5, 186, 44);
        halo.addColorStop(0, 'rgba(56, 255, 152, 0.55)');
        halo.addColorStop(0.6, 'rgba(28, 230, 124, 0.18)');
        halo.addColorStop(1, 'rgba(20, 180, 96, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(W * 0.5, 186, 44, 0, Math.PI * 2);
        ctx.fill();
      }

      // Walking figure silhouette
      const walkColor = greenLit ? '#62ffb0' : (emissiveOnly ? '#081810' : '#163828');
      ctx.fillStyle = walkColor;
      ctx.strokeStyle = walkColor;
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      // Head
      ctx.beginPath();
      ctx.arc(W * 0.5 + 3, 157, 8, 0, Math.PI * 2);
      ctx.fill();
      // Torso leaning slightly forward
      ctx.beginPath();
      ctx.moveTo(W * 0.5 + 2, 167);
      ctx.lineTo(W * 0.5 - 3, 192);
      ctx.stroke();
      // Striding arms
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.5 + 1, 173);
      ctx.lineTo(W * 0.5 + 18, 183);
      ctx.moveTo(W * 0.5, 174);
      ctx.lineTo(W * 0.5 - 16, 187);
      ctx.stroke();
      // Striding legs
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.5 - 3, 191);
      ctx.lineTo(W * 0.5 + 14, 214);
      ctx.moveTo(W * 0.5 - 3, 191);
      ctx.lineTo(W * 0.5 - 16, 214);
      ctx.stroke();
    });

  return { map: drawSignal(false), emissiveMap: drawSignal(true) };
}

/**
 * Weathered Hong Kong roadside electrical feeder pillar texture (電箱 HKE-042).
 */
function createElectricalBoxTexture(): THREE.CanvasTexture {
  return makeLocalTexture(192, 256, (ctx, W, H) => {
    ctx.fillStyle = '#5d6b66';
    ctx.fillRect(0, 0, W, H);

    // Subtle rain grime & rust streaks from top rain lip
    for (let i = 0; i < 18; i++) {
      const gx = 10 + ((i * 37) % (W - 20));
      const grad = ctx.createLinearGradient(gx, 0, gx, 140);
      grad.addColorStop(0, 'rgba(32, 38, 34, 0.34)');
      grad.addColorStop(1, 'rgba(32, 38, 34, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx, 0, 5 + (i % 4), 120 + (i % 5) * 18);
    }

    // Double hinged door panel seam & recessed bevels
    ctx.strokeStyle = '#323c38';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 14, W - 20, H - 28);
    ctx.beginPath();
    ctx.moveTo(W * 0.5, 14);
    ctx.lineTo(W * 0.5, H - 14);
    ctx.stroke();

    // Lower ventilation louver slots
    ctx.fillStyle = '#252e2a';
    for (let y = 178; y < 226; y += 9) {
      ctx.fillRect(22, y, 64, 4);
      ctx.fillRect(106, y, 64, 4);
    }

    // Yellow high-voltage warning triangle plaque
    ctx.fillStyle = '#e5b828';
    ctx.beginPath();
    ctx.moveTo(W * 0.5, 50);
    ctx.lineTo(W * 0.5 + 24, 92);
    ctx.lineTo(W * 0.5 - 24, 92);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1d1e1c';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Lightning bolt inside triangle
    ctx.fillStyle = '#181918';
    ctx.beginPath();
    ctx.moveTo(W * 0.5 + 3, 59);
    ctx.lineTo(W * 0.5 - 6, 75);
    ctx.lineTo(W * 0.5 + 1, 75);
    ctx.lineTo(W * 0.5 - 4, 88);
    ctx.lineTo(W * 0.5 + 8, 71);
    ctx.lineTo(W * 0.5 + 1, 71);
    ctx.closePath();
    ctx.fill();

    // Weathered stenciled feeder box ID & bilingual danger notice
    ctx.fillStyle = '#e6ece4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFontSize(ctx, 'HKE 042', 800, 22, 14, HK_SANS, W - 40);
    ctx.fillText('HKE 042', W * 0.5, 118);
    ctx.fillStyle = '#d43c32';
    ctx.fillRect(36, 134, W - 72, 26);
    ctx.fillStyle = '#f8f5ec';
    fitFontSize(ctx, '危險 DANGER', 800, 14, 9, HK_SANS, W - 82);
    ctx.fillText('危險 DANGER', W * 0.5, 148);
  });
}

/**
 * Iconic Hong Kong woven red-white-blue nylon tarp stripe texture (紅白藍膠布).
 */
function createRedWhiteBlueTarpTexture(): THREE.CanvasTexture {
  return makeLocalTexture(
    128,
    128,
    (ctx, W, H) => {
      const stripes = ['#1c4ca0', '#f0f2f4', '#c82e32', '#f0f2f4', '#1c4ca0', '#f0f2f4'];
      const sw = W / stripes.length;
      stripes.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(i * sw, 0, sw + 1, H);
      });
      // Subtle woven polyethylene cross-hatch texture
      ctx.fillStyle = 'rgba(18, 28, 44, 0.14)';
      for (let y = 0; y < H; y += 6) {
        ctx.fillRect(0, y, W, 2);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let x = 0; x < W; x += 8) {
        ctx.fillRect(x, 0, 2, H);
      }
    },
    { wrap: true, repeatX: 2, repeatY: 2 }
  );
}

/**
 * Soft warm-amber circular wet-pavement specular halo disc under vintage streetlamps.
 */
function createLampHaloTexture(): THREE.CanvasTexture {
  return makeLocalTexture(128, 128, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.5, H * 0.5, 2, W * 0.5, H * 0.5, W * 0.44);
    g.addColorStop(0, 'rgba(255, 224, 152, 0.85)');
    g.addColorStop(0.32, 'rgba(255, 184, 92, 0.38)');
    g.addColorStop(0.70, 'rgba(255, 152, 62, 0.08)');
    g.addColorStop(1, 'rgba(255, 140, 50, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
}

/**
 * Striped rain-awning valence texture for the Hong Kong newspaper & flower kiosk.
 */
function createKioskValenceTexture(): THREE.CanvasTexture {
  return makeLocalTexture(
    128,
    64,
    (ctx, W, H) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#275945' : '#dfd4ba';
        ctx.fillRect(i * 16, 0, 16, H);
      }
      ctx.fillStyle = 'rgba(16, 28, 24, 0.25)';
      ctx.fillRect(0, H - 8, W, 8);
    },
    { wrap: true, repeatX: 3, repeatY: 1 }
  );
}

/**
 * Folded Hong Kong newspaper top-page texture for tied bundles beside the kiosk.
 * Canvas 170 × 128 (AR = 1.328) matching both 0.32×0.24 (AR 1.333) and 0.42×0.32 (AR 1.313) within <= 1.2%!
 */
function createNewspaperBundleTexture(): THREE.CanvasTexture {
  return makeLocalTexture(170, 128, (ctx, W, H) => {
    ctx.fillStyle = '#e5dcc9';
    ctx.fillRect(0, 0, W, H);
    // Red HK tabloid masthead bar
    ctx.fillStyle = '#b4302c';
    ctx.fillRect(10, 10, W - 20, 22);
    ctx.fillStyle = '#f8f0dc';
    fitFontSize(ctx, '香江晚報', 800, 15, 10, HK_SANS, W - 32);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('香江晚報', W * 0.5, 21);
    // Columns of newsprint lines
    ctx.fillStyle = '#3c4044';
    const colW = Math.floor((W - 32) * 0.5);
    for (let row = 0; row < 8; row++) {
      ctx.fillRect(12, 42 + row * 10, colW, 4);
      ctx.fillRect(20 + colW, 42 + row * 10, colW, 4);
    }
  });
}

/**
 * Generates an organically perturbed flattened botanical frond cluster (airy Hong Kong canopy silhouette).
 */
function createOrganicFoliageGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n1 = Math.sin(vx * 4.4 + seed) * Math.cos(vy * 5.0 + seed * 0.7) * Math.sin(vz * 4.2 - seed * 0.4);
    const n2 = Math.cos(vx * 7.8 - vz * 6.4 + seed * 1.3) * 0.42;
    const disp = 1.0 + (n1 + n2) * 0.18;
    pos.setXYZ(i, vx * disp * 1.12, vy * disp * 0.74, vz * disp * 1.12);
  }
  geom.computeVertexNormals();
  return geom;
}

export function createPropsAndLife(scene: THREE.Scene): PropsAndLifeSystem {
  const group = new THREE.Group();
  group.name = 'PropsAndLifeGroup';

  const Y0 = 0.16;
  const rectShadowTex = createContactShadowTexture('rect');
  const roundShadowTex = createContactShadowTexture('round');
  const bauhiniaTex = createBauhiniaCanopyTexture(808);
  const lampHaloTex = createLampHaloTexture();

  const emissiveTracks: Array<{ mat: THREE.MeshStandardMaterial; base: number }> = [];
  const softCones: Array<{ mat: THREE.ShaderMaterial; baseOpacity: number }> = [];
  const lampHaloMats: Array<{ mat: THREE.MeshBasicMaterial; baseOpacity: number }> = [];
  const animatedUmbrellas: Array<{ obj: THREE.Object3D; phase: number; baseRotZ: number }> = [];
  const bauhiniaCenters: THREE.Vector3[] = [];

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x26323d,
    roughness: 0.48,
    metalness: 0.68
  });
  const hkGreenMetalMat = new THREE.MeshStandardMaterial({
    color: 0x245643,
    roughness: 0.46,
    metalness: 0.48
  });
  const chromeSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5df,
    roughness: 0.24,
    metalness: 0.86
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6b4b38,
    roughness: 0.78
  });
  const safetyYellowMat = new THREE.MeshStandardMaterial({
    color: 0xe6b528,
    roughness: 0.44,
    metalness: 0.16
  });
  const signalBlackMat = new THREE.MeshStandardMaterial({
    color: 0x1b2128,
    roughness: 0.52,
    metalness: 0.36
  });
  const hkRedStoolMat = new THREE.MeshStandardMaterial({
    color: 0xc62d28,
    roughness: 0.42,
    metalness: 0.06
  });

  const addRoundAO = (x: number, z: number, radius: number, opacity = 0.54) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({
        map: roundShadowTex,
        transparent: true,
        opacity,
        depthWrite: false
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, Y0 + 0.014, z);
    m.renderOrder = 3;
    group.add(m);
  };

  // =========================================================================
  // 1. UPGRADED FRONT-RIGHT GREEN CORRUGATED TIN HK NEWSPAPER & FLOWER KIOSK (報紙檔)
  // Tied newspaper bundles, blue HK beverage crates (汽水膠箱), stylized kiosk vendor
  // inside under the hanging bulb, awning valence flap & richer floral buckets!
  // =========================================================================
  {
    const kiosk = new THREE.Group();
    kiosk.name = 'HK_NewspaperKiosk';
    const kx = 9.4;
    const kz = 7.4;
    kiosk.position.set(kx, Y0, kz);

    const ao = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 3.4),
      new THREE.MeshBasicMaterial({
        map: rectShadowTex,
        transparent: true,
        opacity: 0.64,
        depthWrite: false
      })
    );
    ao.rotation.x = -Math.PI / 2;
    ao.position.set(0.08, 0.014, 0.05);
    ao.renderOrder = 3;
    kiosk.add(ao);

    const tinGreenTex = createCorrugatedTinTexture('#2e5848');
    const tinRoofTex = createCorrugatedTinTexture('#324b4d');
    const newsTex = createNewsRackTexture();
    const valenceTex = createKioskValenceTexture();
    const bundleTopTex = createNewspaperBundleTexture();

    const tinWallMat = new THREE.MeshStandardMaterial({
      map: tinGreenTex,
      roughness: 0.62,
      metalness: 0.30
    });
    const tinRoofMat = new THREE.MeshStandardMaterial({
      map: tinRoofTex,
      roughness: 0.54,
      metalness: 0.38
    });
    // Warm cozy interior wall/ceiling bounce lit by the bare hanging tungsten bulb
    const kioskWarmInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x6c5844,
      emissive: new THREE.Color(0xffaa4c),
      emissiveIntensity: 0.58,
      roughness: 0.78
    });
    emissiveTracks.push({ mat: kioskWarmInteriorMat, base: 0.58 });

    const newsMat = new THREE.MeshStandardMaterial({
      map: newsTex,
      emissive: new THREE.Color(0xffc272),
      emissiveMap: newsTex,
      emissiveIntensity: 0.58,
      roughness: 0.66
    });
    emissiveTracks.push({ mat: newsMat, base: 0.58 });

    const lowerBox = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.05, 1.95), tinWallMat);
    lowerBox.position.y = 0.525;
    lowerBox.castShadow = true;
    lowerBox.receiveShadow = true;
    kiosk.add(lowerBox);

    // Warm timber counter ledge on top of lower box
    const counterLedge = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.06, 2.02), woodMat);
    counterLedge.position.y = 1.07;
    kiosk.add(counterLedge);

    // Back & side corrugated walls with warm tungsten-lit inner faces
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 1.25, 0.12),
      [tinWallMat, tinWallMat, tinWallMat, tinWallMat, kioskWarmInteriorMat, tinWallMat]
    );
    backWall.position.set(0, 1.65, -0.92);
    backWall.castShadow = true;
    kiosk.add(backWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.25, 1.95),
      [tinWallMat, kioskWarmInteriorMat, tinWallMat, tinWallMat, tinWallMat, tinWallMat]
    );
    rightWall.position.set(1.12, 1.65, 0);
    rightWall.castShadow = true;
    kiosk.add(rightWall);

    for (const [px, pz] of [
      [-1.1, 0.9],
      [1.1, 0.9],
      [-1.1, -0.9]
    ]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.28, 0.08), darkMetalMat);
      post.position.set(px, 1.65, pz);
      kiosk.add(post);
    }

    // Slanted overhanging corrugated roof with warm illuminated ceiling underside + valence flaps!
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.85, 0.10, 2.48),
      [tinRoofMat, tinRoofMat, tinRoofMat, kioskWarmInteriorMat, tinRoofMat, tinRoofMat]
    );
    roof.position.set(-0.08, 2.34, 0.08);
    roof.rotation.x = 0.14;
    roof.rotation.z = 0.05;
    roof.castShadow = true;
    kiosk.add(roof);

    // Hanging rain awning valence flaps along front (+Z) & west (-X) roof eaves
    const valenceMat = new THREE.MeshStandardMaterial({
      map: valenceTex,
      roughness: 0.78,
      side: THREE.DoubleSide
    });
    const frontValence = markSkipPrintEdges(new THREE.Mesh(new THREE.PlaneGeometry(2.82, 0.24), valenceMat));
    frontValence.position.set(-0.08, 2.06, 1.31);
    kiosk.add(frontValence);

    const westValence = markSkipPrintEdges(new THREE.Mesh(new THREE.PlaneGeometry(2.44, 0.24), valenceMat));
    westValence.rotation.y = Math.PI / 2;
    westValence.position.set(-1.49, 2.16, 0.08);
    kiosk.add(westValence);

    // Bare warm hanging tungsten bulb & green vintage enamel shade
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff5d4,
      emissive: new THREE.Color(0xffc05e),
      emissiveIntensity: 2.45,
      roughness: 0.15
    });
    emissiveTracks.push({ mat: bulbMat, base: 2.45 });
    const cord = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), darkMetalMat)
    );
    cord.position.set(-0.2, 2.08, 0.15);
    kiosk.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.11, 12), hkGreenMetalMat);
    shade.position.set(-0.2, 1.92, 0.15);
    kiosk.add(shade);
    const bulb = markSkipPrintEdges(new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), bulbMat));
    bulb.position.set(-0.2, 1.83, 0.15);
    kiosk.add(bulb);

    // Tiny Stylized Kiosk Vendor Figure seated/leaning inside under the warm hanging bulb!
    {
      const vendor = markSkipPrintEdges(new THREE.Group());
      vendor.position.set(0.18, 1.05, -0.18);
      vendor.rotation.y = -0.55;

      const vestMat = new THREE.MeshStandardMaterial({
        color: 0x385068,
        emissive: new THREE.Color(0xffa64a),
        emissiveIntensity: 0.18,
        roughness: 0.78
      });
      emissiveTracks.push({ mat: vestMat, base: 0.18 });
      const skinMat = new THREE.MeshStandardMaterial({
        color: 0xe6c0a0,
        emissive: new THREE.Color(0xffad52),
        emissiveIntensity: 0.16,
        roughness: 0.68
      });
      emissiveTracks.push({ mat: skinMat, base: 0.16 });

      const vTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.44, 10), vestMat);
      vTorso.position.y = 0.22;
      vendor.add(vTorso);

      const vHead = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), skinMat);
      vHead.position.set(0, 0.54, 0.02);
      vendor.add(vHead);

      const vHair = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
        darkMetalMat
      );
      vHair.position.set(0, 0.55, 0.01);
      vendor.add(vHair);

      // Evening newspaper held slightly open on the counter (6-mat: masthead on +Y top face only!)
      const vendorPaperSideMat = new THREE.MeshStandardMaterial({ color: 0xd8ceba, roughness: 0.85 });
      const vendorPaperTopMat = new THREE.MeshStandardMaterial({ map: bundleTopTex, roughness: 0.72 });
      const paper = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.02, 0.24),
        [
          vendorPaperSideMat,
          vendorPaperSideMat,
          vendorPaperTopMat,
          vendorPaperSideMat,
          vendorPaperSideMat,
          vendorPaperSideMat
        ]
      );
      paper.position.set(0, 0.08, 0.26);
      paper.rotation.x = 0.25;
      vendor.add(paper);

      kiosk.add(vendor);
    }

    const westRack = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.85, 1.65),
      [newsMat, newsMat, tinWallMat, tinWallMat, tinWallMat, tinWallMat]
    );
    westRack.position.set(-1.22, 0.85, 0.05);
    westRack.rotation.z = 0.24;
    kiosk.add(westRack);

    const frontRack = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.82, 0.12),
      [tinWallMat, tinWallMat, tinWallMat, tinWallMat, newsMat, newsMat]
    );
    frontRack.position.set(-0.1, 0.85, 1.02);
    frontRack.rotation.x = -0.24;
    kiosk.add(frontRack);

    // Stacked Tied Newspaper Bundles beside the kiosk & on the counter!
    {
      const paperSideMat = new THREE.MeshStandardMaterial({ color: 0xd8ceba, roughness: 0.85 });
      const paperTopMat = new THREE.MeshStandardMaterial({ map: bundleTopTex, roughness: 0.76 });
      const twineMat = new THREE.MeshStandardMaterial({ color: 0xc24838, roughness: 0.72 });

      const addNewsBundle = (bx: number, by: number, bz: number, rotY: number) => {
        const bGroup = markSkipPrintEdges(new THREE.Group());
        bGroup.position.set(bx, by, bz);
        bGroup.rotation.y = rotY;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.18, 0.32),
          [paperSideMat, paperSideMat, paperTopMat, paperSideMat, paperSideMat, paperSideMat]
        );
        block.castShadow = true;
        bGroup.add(block);
        const strapA = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.19, 0.025), twineMat);
        bGroup.add(strapA);
        const strapB = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.19, 0.33), twineMat);
        bGroup.add(strapB);
        kiosk.add(bGroup);
      };

      // Two stacked bundles on sidewalk beside west/front corner
      addNewsBundle(-1.46, 0.09, -0.78, 0.12);
      addNewsBundle(-1.44, 0.27, -0.76, -0.08);
      // One bundle on kiosk counter
      addNewsBundle(-0.72, 1.19, 0.56, 0.24);
    }

    // Blue Plastic Hong Kong Beverage Crates (汽水膠箱) with miniature glass soda bottles!
    {
      const crateBlueMat = new THREE.MeshStandardMaterial({
        color: 0x2664a8,
        roughness: 0.44,
        metalness: 0.08
      });
      const bottleColors = [0x36a658, 0xd48e28, 0xc83a36, 0x36a658];

      const addCrate = (cx: number, cy: number, cz: number, withBottles: boolean) => {
        const cr = markSkipPrintEdges(new THREE.Group());
        cr.position.set(cx, cy, cz);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.36), crateBlueMat);
        box.castShadow = true;
        cr.add(box);

        // Dark recessed top interior & ribbed handle slots
        const inner = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.04, 0.29), darkMetalMat);
        inner.position.y = 0.15;
        cr.add(inner);

        if (withBottles) {
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 3; c++) {
              const col = bottleColors[(r * 3 + c) % bottleColors.length];
              const bMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.22, metalness: 0.12 });
              const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.036, 0.12, 7), bMat);
              neck.position.set(-0.12 + c * 0.12, 0.19, -0.06 + r * 0.12);
              cr.add(neck);
            }
          }
        }
        kiosk.add(cr);
      };

      addCrate(1.42, 0.16, 0.58, false);
      addCrate(1.40, 0.48, 0.56, true);
      addCrate(1.42, 0.16, 0.12, true);
    }

    // Richer Colorful Flower Buckets (4 buckets with dark-green leaves & multi-blossom clusters)
    {
      const bucketMat = new THREE.MeshStandardMaterial({ color: 0x3b4c56, roughness: 0.58 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e643e, roughness: 0.88 });
      const flowerSpecs = [
        { hex: 0xeb84a6, accent: 0xf8c2d4 },
        { hex: 0xf4c84c, accent: 0xffe494 },
        { hex: 0xf5efe6, accent: 0xdbe6d8 },
        { hex: 0xb67cd6, accent: 0xdec2f2 }
      ];
      flowerSpecs.forEach((spec, idx) => {
        const fx = -1.42 + idx * 0.36;
        const fz = 1.26 + (idx % 2) * 0.06;
        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.105, 0.32, 10), bucketMat);
        bucket.position.set(fx, 0.16, fz);
        bucket.castShadow = true;
        kiosk.add(bucket);

        const rim = markSkipPrintEdges(
          new THREE.Mesh(new THREE.TorusGeometry(0.136, 0.012, 6, 12), chromeSteelMat)
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.set(fx, 0.32, fz);
        kiosk.add(rim);

        const floralCluster = markSkipPrintEdges(new THREE.Group());
        floralCluster.position.set(fx, 0.36, fz);
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), leafMat);
        leaves.scale.set(1.0, 0.72, 1.0);
        floralCluster.add(leaves);

        const mainMat = new THREE.MeshStandardMaterial({ color: spec.hex, roughness: 0.86 });
        const accMat = new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.86 });
        for (const [bx, by, bz, r, useAcc] of [
          [0, 0.12, 0, 0.11, false],
          [-0.08, 0.07, 0.06, 0.085, true],
          [0.08, 0.08, -0.05, 0.085, false],
          [0.02, 0.18, 0.04, 0.075, true]
        ] as Array<[number, number, number, number, boolean]>) {
          const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), useAcc ? accMat : mainMat);
          bloom.position.set(bx, by, bz);
          floralCluster.add(bloom);
        }
        kiosk.add(floralCluster);
      });
    }

    // Iconic Hong Kong Ginger-White Street Cat (報紙檔屋頂橘白街貓) perched dry on kiosk roof, swishing tail!
    {
      const cat = markSkipPrintEdges(new THREE.Group());
      cat.name = 'HK_KioskRoofCat';
      cat.position.set(-0.24, 2.41, -0.08);
      cat.rotation.set(0.12, -0.68, 0.04);

      const gingerMat = new THREE.MeshStandardMaterial({ color: 0xd9843b, roughness: 0.85 });
      const whiteFurMat = new THREE.MeshStandardMaterial({ color: 0xf4eee2, roughness: 0.86 });

      const cBody = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), gingerMat);
      cBody.scale.set(0.88, 0.78, 1.32);
      cBody.position.set(0, 0.11, 0);
      cBody.castShadow = true;
      cat.add(cBody);

      const cChest = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 8), whiteFurMat);
      cChest.position.set(0, 0.11, 0.12);
      cat.add(cChest);

      const catHeadPivot = new THREE.Group();
      catHeadPivot.position.set(0, 0.21, 0.15);
      const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.098, 10, 8), gingerMat);
      catHeadPivot.add(cHead);
      const cMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 6), whiteFurMat);
      cMuzzle.position.set(0, -0.02, 0.08);
      catHeadPivot.add(cMuzzle);
      for (const ex of [-0.055, 0.055]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.072, 4), gingerMat);
        ear.position.set(ex, 0.095, 0.01);
        ear.rotation.z = ex < 0 ? 0.24 : -0.24;
        catHeadPivot.add(ear);
      }
      cat.add(catHeadPivot);

      const catTailPivot = new THREE.Group();
      catTailPivot.position.set(0, 0.10, -0.17);
      const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.08, -0.11),
        new THREE.Vector3(0.04, 0.22, -0.15)
      ]);
      const cTail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 8, 0.024, 6, false), gingerMat);
      catTailPivot.add(cTail);
      cat.add(catTailPivot);

      kiosk.add(cat);
      kiosk.userData.catHeadPivot = catHeadPivot;
      kiosk.userData.catTailPivot = catTailPivot;
    }

    group.add(kiosk);
  }

  // =========================================================================
  // 2. LIVE CYCLING HONG KONG TRAFFIC LIGHT & PEDESTRIAN CROSSING SIGNAL (交通燈 + 閃動過路公仔燈)
  // Positioned right beside the zebra crossing (斑馬線): black/yellow striped pole,
  // 3-aspect vehicle head with white backing border & visors, glowing green walking man
  // (綠公仔 -> 閃綠公仔 -> 紅公仔), and iconic yellow HK tactile pedestrian audio-button box!
  // =========================================================================
  const pedSigGreen = createPedSignalTexture('green');
  const pedSigRed = createPedSignalTexture('red');
  let pedSigPhase: 'green' | 'red' = 'green';
  const pedFaceMat = new THREE.MeshStandardMaterial({
    map: pedSigGreen.map,
    emissive: new THREE.Color(0x52ffa8),
    emissiveMap: pedSigGreen.emissiveMap,
    emissiveIntensity: 1.85,
    roughness: 0.25
  });
  emissiveTracks.push({ mat: pedFaceMat, base: 1.85 });

  const vehRedLitMat = new THREE.MeshStandardMaterial({
    color: 0xff4640,
    emissive: new THREE.Color(0xff2a24),
    emissiveIntensity: 2.35,
    roughness: 0.18
  });
  emissiveTracks.push({ mat: vehRedLitMat, base: 2.35 });

  const vehAmberDimMat = new THREE.MeshStandardMaterial({
    color: 0xffb838,
    emissive: new THREE.Color(0xff9a18),
    emissiveIntensity: 0.22,
    roughness: 0.24
  });
  emissiveTracks.push({ mat: vehAmberDimMat, base: 0.22 });

  const vehGreenDimMat = new THREE.MeshStandardMaterial({
    color: 0x38e88c,
    emissive: new THREE.Color(0x1ce078),
    emissiveIntensity: 0.20,
    roughness: 0.24
  });
  emissiveTracks.push({ mat: vehGreenDimMat, base: 0.20 });

  {
    const whiteBorderMat = new THREE.MeshStandardMaterial({
      color: 0xebeef2,
      roughness: 0.52
    });

    const waitLabelMat = new THREE.MeshStandardMaterial({
      color: 0xffdd78,
      emissive: new THREE.Color(0xffb838),
      emissiveIntensity: 1.15,
      roughness: 0.3
    });
    emissiveTracks.push({ mat: waitLabelMat, base: 1.15 });

    const addHKTrafficSignal = (x: number, z: number, pedFaceDirX: 1 | -1) => {
      const sig = new THREE.Group();
      sig.name = pedFaceDirX > 0 ? 'HK_TrafficSignal_West' : 'HK_TrafficSignal_East';
      sig.position.set(x, Y0, z);

      // Cast-iron plinth base
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.32, 10), signalBlackMat);
      base.position.y = 0.16;
      base.castShadow = true;
      sig.add(base);

      // Iconic Hong Kong black-and-yellow striped cylindrical pole (up to y = 3.45)
      const bandCount = 10;
      const bandH = 0.315;
      for (let b = 0; b < bandCount; b++) {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(0.052, 0.055, bandH, 10),
          b % 2 === 0 ? signalBlackMat : safetyYellowMat
        );
        band.position.y = 0.32 + (b + 0.5) * bandH;
        band.castShadow = true;
        sig.add(band);
      }
      const cap = markSkipPrintEdges(new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), signalBlackMat));
      cap.position.y = 3.48;
      sig.add(cap);

      // 3-Aspect Vehicle Traffic Light Head (facing +Z toward foreground camera & waiting red taxi!)
      const vehHead = new THREE.Group();
      vehHead.position.set(0, 3.02, 0.14);

      // Signature HK white reflective border backing board
      const backBoard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.86, 0.04), whiteBorderMat);
      backBoard.position.z = -0.05;
      vehHead.add(backBoard);

      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.78, 0.22), signalBlackMat);
      housing.castShadow = true;
      vehHead.add(housing);

      const lensSpecs: Array<{ y: number; mat: THREE.MeshStandardMaterial }> = [
        { y: 0.23, mat: vehRedLitMat },
        { y: 0.0, mat: vehAmberDimMat },
        { y: -0.23, mat: vehGreenDimMat }
      ];
      for (const ls of lensSpecs) {
        const lens = markSkipPrintEdges(
          new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.04, 12), ls.mat)
        );
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, ls.y, 0.11);
        vehHead.add(lens);

        // Sun visor arching cleanly over top (+Y) of each signal lens
        const visor = markSkipPrintEdges(
          new THREE.Mesh(
            new THREE.CylinderGeometry(0.095, 0.095, 0.15, 10, 1, true, Math.PI * 0.55, Math.PI * 0.90),
            signalBlackMat
          )
        );
        visor.rotation.x = Math.PI / 2;
        visor.position.set(0, ls.y, 0.17);
        vehHead.add(visor);
      }
      sig.add(vehHead);

      // Pedestrian Crossing Signal Box (過路公仔燈) facing across the zebra crossing!
      const pedBox = new THREE.Group();
      pedBox.position.set(pedFaceDirX * 0.16, 2.34, 0);

      const pedCase = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.54, 0.28), signalBlackMat);
      pedCase.castShadow = true;
      pedBox.add(pedCase);

      const pedFace = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.48), pedFaceMat);
      pedFace.position.set(pedFaceDirX * 0.105, 0, 0);
      pedFace.rotation.y = pedFaceDirX > 0 ? Math.PI / 2 : -Math.PI / 2;
      pedBox.add(pedFace);

      // Twin pedestrian signal lens hoods
      for (const hy of [0.11, -0.11]) {
        const hood = markSkipPrintEdges(
          new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.20), signalBlackMat)
        );
        hood.position.set(pedFaceDirX * 0.15, hy + 0.085, 0);
        pedBox.add(hood);
      }
      sig.add(pedBox);

      // Iconic Yellow Hong Kong Tactile Pedestrian Audio-Button Box (y = 1.16)
      const btnBox = new THREE.Group();
      btnBox.position.set(0, 1.16, 0.11);

      const yellowBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.12), safetyYellowMat);
      yellowBody.castShadow = true;
      btnBox.add(yellowBody);

      const speakerPlate = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.02), darkMetalMat)
      );
      speakerPlate.position.set(0, 0.04, 0.06);
      btnBox.add(speakerPlate);

      const waitStrip = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.022), waitLabelMat)
      );
      waitStrip.position.set(0, -0.05, 0.06);
      btnBox.add(waitStrip);

      // Signature underside spinning tactile cone for visually impaired pedestrians
      const tactileKnob = markSkipPrintEdges(
        new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.055, 8), darkMetalMat)
      );
      tactileKnob.rotation.x = Math.PI;
      tactileKnob.position.set(0, -0.155, 0);
      btnBox.add(tactileKnob);

      sig.add(btnBox);
      group.add(sig);
      addRoundAO(x, z, 0.30, 0.45);
    };

    // Primary West Crossing Signal flanking north edge of zebra crossing (z = +3.4)
    addHKTrafficSignal(-5.45, 2.1, 1);
    // Companion East Crossing Signal facing west across the wider zebra crossing
    addHKTrafficSignal(5.45, 2.1, -1);
  }

  // =========================================================================
  // 3. CLASSIC HONG KONG RED CAST-IRON FIRE HYDRANT (香港紅色消防龍頭),
  // BLACK-YELLOW STRIPED BOLLARDS & WEATHERED ELECTRICAL FEEDER BOX (電箱)
  // =========================================================================
  {
    // A. Classic Hong Kong Red Cast-Iron Fire Hydrant at (5.65, Y0, 8.4)
    const hyd = new THREE.Group();
    hyd.name = 'HK_FireHydrant';
    hyd.position.set(5.65, Y0, 8.4);

    const hydRedMat = new THREE.MeshStandardMaterial({
      color: 0xbd2224,
      roughness: 0.36,
      metalness: 0.28
    });
    const brassCapMat = new THREE.MeshStandardMaterial({
      color: 0xd4ad5a,
      roughness: 0.30,
      metalness: 0.76
    });

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.175, 0.08, 12), hydRedMat);
    plinth.position.y = 0.04;
    hyd.add(plinth);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.56, 12), hydRedMat);
    barrel.position.y = 0.36;
    barrel.castShadow = true;
    hyd.add(barrel);

    const collar = markSkipPrintEdges(new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.055, 12), hydRedMat));
    collar.position.y = 0.62;
    hyd.add(collar);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hydRedMat
    );
    dome.position.y = 0.64;
    hyd.add(dome);

    const topNut = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.055), brassCapMat));
    topNut.position.y = 0.78;
    hyd.add(topNut);

    // Twin side outlet nozzles with chained brass/red caps
    for (const side of [-1, 1]) {
      const nozzle = markSkipPrintEdges(
        new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.11, 10), hydRedMat)
      );
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.set(side * 0.135, 0.48, 0);
      hyd.add(nozzle);

      const nCap = markSkipPrintEdges(
        new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.03, 8), brassCapMat)
      );
      nCap.rotation.z = Math.PI / 2;
      nCap.position.set(side * 0.195, 0.48, 0);
      hyd.add(nCap);
    }

    const frontNozzle = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.10, 10), hydRedMat)
    );
    frontNozzle.rotation.x = Math.PI / 2;
    frontNozzle.position.set(0, 0.44, 0.13);
    hyd.add(frontNozzle);

    group.add(hyd);
    addRoundAO(5.65, 8.4, 0.28, 0.46);

    // B. Black-and-Yellow Striped Hong Kong Roadside Bollards framing zebra, tram stop & parking bay corners
    const addHKBollard = (bx: number, bz: number) => {
      const b = new THREE.Group();
      b.position.set(bx, Y0, bz);
      const segments = 5;
      const segH = 0.145;
      for (let s = 0; s < segments; s++) {
        const cyl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.072, 0.076, segH, 10),
          s % 2 === 0 ? signalBlackMat : safetyYellowMat
        );
        cyl.position.y = (s + 0.5) * segH;
        cyl.castShadow = true;
        b.add(cyl);
      }
      const bCap = markSkipPrintEdges(new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 6), signalBlackMat));
      bCap.scale.set(1, 0.65, 1);
      bCap.position.y = segments * segH;
      b.add(bCap);

      group.add(b);
      addRoundAO(bx, bz, 0.20, 0.42);
    };

    addHKBollard(5.38, 4.42);
    addHKBollard(5.38, 9.26);
    addHKBollard(-5.38, 5.72);

    // C. Weathered Roadside Electrical Feeder Box (電箱 HKE-042) tucked cleanly beside kiosk east wall
    const eBox = new THREE.Group();
    eBox.name = 'HK_ElectricalFeederBox';
    eBox.position.set(9.95, Y0, 8.25);

    const eSideMat = new THREE.MeshStandardMaterial({
      color: 0x576661,
      roughness: 0.72,
      metalness: 0.34
    });
    const eFrontMat = new THREE.MeshStandardMaterial({
      map: createElectricalBoxTexture(),
      roughness: 0.68,
      metalness: 0.32
    });
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x6f7b85, roughness: 0.88 });

    const ePlinth = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.14, 0.60), plinthMat);
    ePlinth.position.y = 0.07;
    eBox.add(ePlinth);

    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 1.24, 0.54),
      [eSideMat, eSideMat, eSideMat, eSideMat, eFrontMat, eSideMat]
    );
    cabinet.position.y = 0.14 + 0.62;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    eBox.add(cabinet);

    // Overhanging pitched weatherproof steel roof cap
    const eCap = new THREE.Mesh(new THREE.BoxGeometry(1.00, 0.09, 0.62), eSideMat);
    eCap.position.y = 1.42;
    eCap.rotation.x = 0.08;
    eCap.castShadow = true;
    eBox.add(eCap);

    // Miniature padlock hasp on center door seam
    const hasp = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.04), darkMetalMat));
    hasp.position.set(0, 0.78, 0.28);
    eBox.add(hasp);

    group.add(eBox);
    addRoundAO(9.95, 8.25, 0.66, 0.52);
  }

  // =========================================================================
  // 4. DAI PAI DONG STREET-CORNER CLUTTER BESIDE 明記雲吞麵 (B2)
  // Folding stainless-steel round table, stacked iconic Hong Kong red plastic
  // stools (紅色膠凳), and rolled blue-white-red tarp (紅白藍膠布) neatly tucked!
  // =========================================================================
  {
    const dpdGroup = new THREE.Group();
    dpdGroup.name = 'DaiPaiDong_CornerClutter';

    // Helper: Iconic Hong Kong Red Plastic Stool (紅色膠凳) with center finger hole & 4 splayed legs
    const addHKRedStool = (sx: number, sy: number, sz: number, rotY = 0) => {
      const stool = markSkipPrintEdges(new THREE.Group());
      stool.position.set(sx, Y0 + sy, sz);
      stool.rotation.y = rotY;

      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.042, 0.25), hkRedStoolMat);
      seat.position.y = 0.40;
      seat.castShadow = true;
      stool.add(seat);

      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.046, 8), darkMetalMat);
      hole.position.y = 0.40;
      stool.add(hole);

      for (const [lx, lz] of [
        [-0.095, -0.095],
        [0.095, -0.095],
        [-0.095, 0.095],
        [0.095, 0.095]
      ]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.013, 0.40, 6), hkRedStoolMat);
        leg.position.set(lx * 1.12, 0.20, lz * 1.12);
        leg.rotation.set(lz * 0.72, 0, -lx * 0.72);
        stool.add(leg);
      }

      dpdGroup.add(stool);
    };

    // Folding stainless-steel round Dai Pai Dong table outside 明記雲吞麵 (B2 east edge x = -6.6)
    const tableX = -5.92;
    const tableZ = 0.55;
    const fTable = new THREE.Group();
    fTable.position.set(tableX, Y0, tableZ);

    const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.032, 16), chromeSteelMat);
    topDisc.position.y = 0.67;
    topDisc.castShadow = true;
    topDisc.receiveShadow = true;
    fTable.add(topDisc);

    // Crossed chrome tubular folding legs
    for (const ang of [0, Math.PI * 0.5]) {
      for (const tilt of [-0.34, 0.34]) {
        const leg = markSkipPrintEdges(
          new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.72, 6), chromeSteelMat)
        );
        leg.position.y = 0.335;
        leg.rotation.y = ang;
        leg.rotation.z = tilt;
        fTable.add(leg);
      }
    }

    // Miniature red plastic chopsticks cup & soy-sauce bottle on the table!
    const chopCup = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.085, 8), hkRedStoolMat)
    );
    chopCup.position.set(0.08, 0.73, -0.05);
    fTable.add(chopCup);

    const soyBottle = markSkipPrintEdges(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.026, 0.095, 8),
        new THREE.MeshStandardMaterial({ color: 0x321c12, roughness: 0.28 })
      )
    );
    soyBottle.position.set(-0.07, 0.735, 0.06);
    fTable.add(soyBottle);

    dpdGroup.add(fTable);
    addRoundAO(tableX, tableZ, 0.44, 0.46);

    // Two active stools beside the folding table
    addHKRedStool(-5.92, 0, 0.04, 0.18);
    addHKRedStool(-5.92, 0, 1.06, -0.35);

    // Neat nested stack of 4 iconic Hong Kong red plastic stools tucked against B2 shopfront!
    for (let st = 0; st < 4; st++) {
      addHKRedStool(-6.44, st * 0.062, 1.48, 0.08 + st * 0.05);
    }
    addRoundAO(-6.44, 1.48, 0.26, 0.44);

    // Rolled iconic Hong Kong Blue-White-Red Tarp (紅白藍膠布) tucked neatly beside the stools!
    const tarpMat = new THREE.MeshStandardMaterial({
      map: createRedWhiteBlueTarpTexture(),
      roughness: 0.56,
      metalness: 0.06
    });
    const tarpRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.92, 14), tarpMat);
    tarpRoll.rotation.x = Math.PI / 2;
    tarpRoll.position.set(-6.45, Y0 + 0.105, 1.98);
    tarpRoll.castShadow = true;
    dpdGroup.add(tarpRoll);

    for (const tz of [-0.26, 0.26]) {
      const tie = markSkipPrintEdges(
        new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.010, 6, 14), darkMetalMat)
      );
      tie.position.set(-6.45, Y0 + 0.105, 1.98 + tz);
      dpdGroup.add(tie);
    }

    group.add(dpdGroup);
  }

  // Iconic Hong Kong Swaying Red Plastic Dai Pai Dong Lampshade (街市紅燈罩) above folding table (-5.92, 0.55)
  const dpdLampPivot = markSkipPrintEdges(new THREE.Group());
  dpdLampPivot.name = 'HK_DaiPaiDong_RedLamp';
  dpdLampPivot.position.set(-5.92, Y0 + 2.66, 0.55);
  {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.52, 6), darkMetalMat);
    cord.position.y = -0.26;
    dpdLampPivot.add(cord);

    const redShadeMat = new THREE.MeshStandardMaterial({
      color: 0xd6362e,
      emissive: new THREE.Color(0xc83220),
      emissiveIntensity: 0.72,
      roughness: 0.36,
      side: THREE.DoubleSide
    });
    emissiveTracks.push({ mat: redShadeMat, base: 0.72 });

    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 14, 1, true), redShadeMat);
    shade.position.y = -0.54;
    dpdLampPivot.add(shade);

    const redBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c4,
      emissive: new THREE.Color(0xffbe54),
      emissiveIntensity: 2.35,
      roughness: 0.18
    });
    emissiveTracks.push({ mat: redBulbMat, base: 2.35 });
    const dpdBulb = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 6), redBulbMat);
    dpdBulb.position.y = -0.60;
    dpdLampPivot.add(dpdBulb);
  }
  group.add(dpdLampPivot);

  // =========================================================================
  // 5. CLASSIC HONG KONG ORANGE RUBBISH BINS (香港橙色垃圾桶)
  // =========================================================================
  const addHKRubbishBin = (x: number, z: number) => {
    const bin = new THREE.Group();
    bin.position.set(x, Y0, z);
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xd96128,
      roughness: 0.46,
      metalness: 0.08
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.68, 14), orangeMat);
    body.position.y = 0.34;
    body.castShadow = true;
    bin.add(body);

    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.28, 14), darkMetalMat);
    hood.position.y = 0.82;
    bin.add(hood);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), orangeMat);
    cap.position.y = 0.94;
    bin.add(cap);

    const ash = markSkipPrintEdges(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10),
        new THREE.MeshStandardMaterial({ color: 0x9aa8b4, roughness: 0.35, metalness: 0.7 })
      )
    );
    ash.position.y = 1.16;
    bin.add(ash);

    group.add(bin);
    addRoundAO(x, z, 0.38, 0.45);
  };

  addHKRubbishBin(-6.0, 8.8);
  addHKRubbishBin(13.85, 2.65);

  // =========================================================================
  // 6. T-SHAPED 灣仔道 WAN CHAI RD PLAQUE, ROUND 電車站 TRAM STOP & CONVEX MIRROR
  // =========================================================================
  {
    const plaqueTex = createStreetPlaqueTexture();
    const plaqueMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      roughness: 0.45,
      metalness: 0.1
    });
    // 6-material array so '灣仔道 WAN CHAI RD' ONLY sits on +Z front face (zero thin-edge smear!)
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.42, 0.05),
      [darkMetalMat, darkMetalMat, darkMetalMat, darkMetalMat, plaqueMat, darkMetalMat]
    );
    plaque.position.set(-7.8, Y0 + 2.68, 9.63);
    group.add(plaque);

    const stopGroup = new THREE.Group();
    stopGroup.position.set(-5.55, Y0, 7.2);
    const stopPole = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 2.55, 8), hkGreenMetalMat);
    stopPole.position.y = 1.275;
    stopPole.castShadow = true;
    stopGroup.add(stopPole);

    const tramStopTex = createTramStopSignTexture();
    const stopDiskMat = new THREE.MeshStandardMaterial({
      map: tramStopTex,
      transparent: true,
      roughness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    // Green metallic cylinder rim + two upright CircleGeometry face plaques so '電車站 TRAM STOP' is 100% upright!
    const stopRim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 24), hkGreenMetalMat);
    stopRim.rotation.z = Math.PI / 2;
    stopRim.position.y = 2.55;
    stopRim.castShadow = true;
    stopGroup.add(stopRim);

    const stopFaceGeom = new THREE.CircleGeometry(0.30, 24);
    const stopFaceEast = new THREE.Mesh(stopFaceGeom, stopDiskMat);
    stopFaceEast.position.set(0.027, 2.55, 0);
    stopFaceEast.rotation.y = Math.PI / 2;
    stopGroup.add(stopFaceEast);

    const stopFaceWest = new THREE.Mesh(stopFaceGeom, stopDiskMat);
    stopFaceWest.position.set(-0.027, 2.55, 0);
    stopFaceWest.rotation.y = -Math.PI / 2;
    stopGroup.add(stopFaceWest);

    const sched = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.44, 0.30),
      new THREE.MeshStandardMaterial({ color: 0xebe3d0, roughness: 0.55 })
    );
    sched.position.y = 1.55;
    stopGroup.add(sched);
    group.add(stopGroup);
    addRoundAO(-5.55, 7.2, 0.25, 0.42);

    const mirGroup = new THREE.Group();
    mirGroup.position.set(5.55, Y0, 4.42);
    const mirPole = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 2.45, 8), darkMetalMat);
    mirPole.position.y = 1.225;
    mirPole.castShadow = true;
    mirGroup.add(mirPole);

    const mirRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.33, 0.06, 18),
      new THREE.MeshStandardMaterial({ color: 0xd4522e, roughness: 0.45 })
    );
    mirRim.rotation.z = Math.PI / 2;
    mirRim.rotation.y = 0.55;
    mirRim.position.set(-0.08, 2.38, 0);
    mirGroup.add(mirRim);

    const mirGlass = markSkipPrintEdges(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.35),
        new THREE.MeshStandardMaterial({ color: 0xc8d8e6, roughness: 0.08, metalness: 0.92 })
      )
    );
    mirGlass.rotation.z = Math.PI / 2;
    mirGlass.rotation.y = 0.55;
    mirGlass.position.set(-0.11, 2.38, 0);
    mirGroup.add(mirGlass);
    group.add(mirGroup);
    addRoundAO(5.55, 4.42, 0.25, 0.42);
  }

  // =========================================================================
  // 7. VINTAGE CURVED HK GREEN CAST-IRON STREETLAMPS WITH ORNAMENTAL SCROLLWORK
  // GUSSETS, ULTRA-SOFT VOLUMETRIC MIST CONES & WET-PAVEMENT SPECULAR HALO DISCS
  // =========================================================================
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c8,
    emissive: new THREE.Color(0xffb858),
    emissiveIntensity: 2.35,
    roughness: 0.2
  });
  emissiveTracks.push({ mat: lampBulbMat, base: 2.35 });

  const addStreetLamp = (x: number, z: number, armDirX: number) => {
    const lamp = new THREE.Group();
    lamp.position.set(x, Y0, z);

    const poleH = 4.45;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.075, poleH, 10), hkGreenMetalMat);
    pole.position.y = poleH * 0.5;
    pole.castShadow = true;
    lamp.add(pole);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.135, 0.68, 10), hkGreenMetalMat);
    base.position.y = 0.34;
    lamp.add(base);

    // Decorative fluted cast-iron base & crown collars
    for (const [cy, cr] of [
      [0.70, 0.092],
      [poleH - 0.52, 0.068],
      [poleH - 0.08, 0.064]
    ]) {
      const collar = markSkipPrintEdges(
        new THREE.Mesh(new THREE.TorusGeometry(cr, 0.018, 6, 12), hkGreenMetalMat)
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = cy;
      lamp.add(collar);
    }

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, poleH - 0.1, 0),
      new THREE.Vector3(armDirX * 0.35, poleH + 0.34, 0),
      new THREE.Vector3(armDirX * 0.92, poleH + 0.24, 0)
    ]);
    const armMesh = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 12, 0.036, 8, false), hkGreenMetalMat);
    lamp.add(armMesh);

    // Ornamental curved cast-iron bracket scrollwork gusset under the gooseneck arm
    const scrollGroup = markSkipPrintEdges(new THREE.Group());
    const gussetCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(armDirX * 0.05, poleH - 0.50, 0),
      new THREE.Vector3(armDirX * 0.24, poleH - 0.08, 0),
      new THREE.Vector3(armDirX * 0.62, poleH + 0.25, 0)
    ]);
    scrollGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(gussetCurve, 10, 0.018, 6, false), hkGreenMetalMat)
    );
    const scrollRingA = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.014, 6, 14), hkGreenMetalMat);
    scrollRingA.position.set(armDirX * 0.24, poleH + 0.06, 0);
    scrollGroup.add(scrollRingA);
    const scrollRingB = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.012, 6, 12), hkGreenMetalMat);
    scrollRingB.position.set(armDirX * 0.44, poleH + 0.21, 0);
    scrollGroup.add(scrollRingB);
    lamp.add(scrollGroup);

    const headX = armDirX * 0.96;
    const headY = poleH + 0.18;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 12), darkMetalMat);
    hood.position.set(headX, headY + 0.06, 0);
    lamp.add(hood);

    const bulb = markSkipPrintEdges(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lampBulbMat));
    bulb.position.set(headX, headY - 0.04, 0);
    lamp.add(bulb);

    // Custom GLSL Fresnel + axial soft volumetric rain-mist halo (ZERO paper triangle edges!)
    const coneMat = createSoftLightConeMaterial(0xffc978, 0.062);
    softCones.push({ mat: coneMat, baseOpacity: 0.062 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.75, 4.1, 24, 1, true), coneMat);
    cone.position.set(headX, headY - 2.08, 0);
    cone.renderOrder = 6;
    lamp.add(cone);

    // Subtle rain-wet specular halo disc on the wet pavement beneath each lamp!
    const haloMat = new THREE.MeshBasicMaterial({
      map: lampHaloTex,
      color: 0xffc66e,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    lampHaloMats.push({ mat: haloMat, baseOpacity: 0.34 });
    const haloDisc = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), haloMat);
    haloDisc.rotation.x = -Math.PI / 2;
    // Offset slightly inward toward the curb/sidewalk edge beneath the overhanging lamp head
    haloDisc.position.set(armDirX * 0.32, 0.017, 0);
    haloDisc.renderOrder = 4;
    lamp.add(haloDisc);

    group.add(lamp);
    addRoundAO(x, z, 0.32, 0.44);
  };

  addStreetLamp(-5.55, 10.2, 1);
  addStreetLamp(5.55, 5.4, -1);
  addStreetLamp(-5.55, -0.8, 1);
  addStreetLamp(5.55, -7.2, -1);

  // =========================================================================
  // 8. SAGGING OVERHEAD STREET UTILITY WIRES (CatmullRomCurve3)
  // Re-anchored strictly to real walls (B1 x=-7.6, B2 x=-6.6) & poles (x=±5.55), clearing tram pantograph (y=5.30)!
  // =========================================================================
  {
    const cableMat = new THREE.LineBasicMaterial({
      color: 0x24303a,
      transparent: true,
      opacity: 0.56
    });
    const addSagCable = (p0: THREE.Vector3, p1: THREE.Vector3, sag: number) => {
      const mid = p0.clone().lerp(p1, 0.5);
      mid.y -= sag;
      const curve = new THREE.CatmullRomCurve3([p0, mid, p1]);
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(12)), cableMat));
    };

    addSagCable(new THREE.Vector3(-7.6, 5.15, 8.8), new THREE.Vector3(-5.55, 4.55, 10.2), 0.20);
    addSagCable(new THREE.Vector3(-7.6, 5.35, 4.2), new THREE.Vector3(-6.6, 5.25, 2.0), 0.24);
    addSagCable(new THREE.Vector3(-7.6, 5.95, 5.4), new THREE.Vector3(5.55, 5.66, 4.8), 0.26);
    addSagCable(new THREE.Vector3(-6.6, 5.45, 1.4), new THREE.Vector3(-5.55, 5.55, 4.8), 0.24);
    addSagCable(new THREE.Vector3(5.55, 5.50, 4.8), new THREE.Vector3(5.55, 4.55, 5.4), 0.10);
    addSagCable(new THREE.Vector3(-6.6, 5.18, -0.5), new THREE.Vector3(-5.55, 4.55, -0.8), 0.14);
  }

  // =========================================================================
  // 9. PAINTERLY MATTE BAUHINIA (洋紫荊) & WEEPING BANYAN (榕樹) TREES,
  // GRANITE TREE PITS, HERITAGE HK POSTBOX, VINTAGE TELEPHONE BOOTH & BENCHES
  // =========================================================================
  const foliageTex = createFoliageCanopyTexture(515);
  const foliageDarkMat = new THREE.MeshStandardMaterial({
    map: foliageTex,
    color: 0x357452,
    emissive: new THREE.Color(0x102218),
    emissiveIntensity: 0.22,
    roughness: 0.92,
    metalness: 0.0
  });
  const foliageMidMat = new THREE.MeshStandardMaterial({
    map: foliageTex,
    color: 0x4e9668,
    emissive: new THREE.Color(0x162d20),
    emissiveIntensity: 0.24,
    roughness: 0.92,
    metalness: 0.0
  });
  const foliageLightMat = new THREE.MeshStandardMaterial({
    map: foliageTex,
    color: 0x6eb884,
    emissive: new THREE.Color(0x1c3424),
    emissiveIntensity: 0.22,
    roughness: 0.92,
    metalness: 0.0
  });

  const bauhiniaShadowMatB = new THREE.MeshStandardMaterial({
    map: bauhiniaTex,
    color: 0xa65e8c,
    emissive: new THREE.Color(0x341624),
    emissiveIntensity: 0.20,
    roughness: 0.94,
    metalness: 0.0
  });
  const bauhiniaMidMat = new THREE.MeshStandardMaterial({
    map: bauhiniaTex,
    color: 0xd482ac,
    emissive: new THREE.Color(0x3e1c2a),
    emissiveIntensity: 0.22,
    roughness: 0.94,
    metalness: 0.0
  });
  const bauhiniaLightMatA = new THREE.MeshStandardMaterial({
    map: bauhiniaTex,
    color: 0xeca4c8,
    emissive: new THREE.Color(0x462230),
    emissiveIntensity: 0.22,
    roughness: 0.94,
    metalness: 0.0
  });
  const bauhiniaLightMatB = new THREE.MeshStandardMaterial({
    map: bauhiniaTex,
    color: 0xf7cae0,
    emissive: new THREE.Color(0x42222c),
    emissiveIntensity: 0.18,
    roughness: 0.94,
    metalness: 0.0
  });

  const graniteCurbMat = new THREE.MeshStandardMaterial({ color: 0x768490, roughness: 0.84 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x2c2622, roughness: 0.96 });
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x453530,
    roughness: 0.94,
    metalness: 0.0
  });

  const buildTreePitGrate = (parent: THREE.Group, size: number) => {
    const pit = new THREE.Group();
    const curbH = 0.14;
    const curbT = 0.12;
    for (const [bx, bz, w, d] of [
      [0, -size * 0.5, size + curbT, curbT],
      [0, size * 0.5, size + curbT, curbT],
      [-size * 0.5, 0, curbT, size],
      [size * 0.5, 0, curbT, size]
    ]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, curbH, d), graniteCurbMat);
      rail.position.set(bx, curbH * 0.5, bz);
      rail.receiveShadow = true;
      pit.add(rail);
    }
    const soil = new THREE.Mesh(new THREE.BoxGeometry(size - 0.08, 0.07, size - 0.08), soilMat);
    soil.position.y = 0.035;
    pit.add(soil);
    // Slotted dark cast-iron HK tree grate bars
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const bar = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(size - 0.14, 0.02, 0.045), darkMetalMat)
      );
      bar.position.set(0, 0.085, i * (size * 0.18));
      pit.add(bar);
    }
    parent.add(pit);
  };

  const addBauhiniaTree = (x: number, z: number, scale = 1.0, seedBase = 11) => {
    const tree = new THREE.Group();
    tree.position.set(x, Y0, z);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.095 * scale, 0.175 * scale, 1.94 * scale, 8), trunkMat);
    trunk.position.y = 0.97 * scale;
    trunk.rotation.z = 0.06;
    trunk.castShadow = true;
    tree.add(trunk);

    const branchSpecs: Array<[number, number, number, number, number]> = [
      [-0.36, 1.88, 0.22, 0.55, -0.45],
      [0.42, 1.94, -0.18, -0.52, 0.35],
      [0.08, 2.04, 0.36, -0.25, 0.52],
      [-0.22, 1.98, -0.32, 0.35, -0.42]
    ];
    for (const [bx, by, bz, rz, rx] of branchSpecs) {
      const br = markSkipPrintEdges(
        new THREE.Mesh(new THREE.CylinderGeometry(0.042 * scale, 0.078 * scale, 1.18 * scale, 7), trunkMat)
      );
      br.position.set(bx * scale, by * scale, bz * scale);
      br.rotation.set(rx, 0, rz);
      br.castShadow = true;
      tree.add(br);
    }

    // Authentic Hong Kong Bauhinia: airy tiered emerald leaves & cascading magenta-blush blossom fronds!
    const clusterSpecs: Array<[number, number, number, number, THREE.MeshStandardMaterial]> = [
      [-0.78, 2.06, 0.30, 0.46, foliageDarkMat],
      [0.72, 2.10, -0.28, 0.48, foliageDarkMat],
      [0.16, 2.08, 0.68, 0.44, foliageMidMat],
      [-0.38, 2.14, -0.62, 0.46, foliageDarkMat],
      [0.0, 2.26, 0.0, 0.54, foliageMidMat],
      [-1.02, 2.40, -0.04, 0.44, bauhiniaMidMat],
      [0.98, 2.42, 0.18, 0.46, bauhiniaShadowMatB],
      [-0.20, 2.46, 0.90, 0.42, bauhiniaLightMatA],
      [0.42, 2.48, -0.80, 0.42, foliageMidMat],
      [-0.56, 2.60, 0.52, 0.48, bauhiniaLightMatA],
      [0.52, 2.74, 0.44, 0.44, bauhiniaMidMat],
      [-0.52, 2.82, -0.28, 0.46, foliageLightMat],
      [0.74, 2.72, -0.26, 0.40, bauhiniaLightMatA],
      [-0.84, 2.68, -0.44, 0.38, bauhiniaShadowMatB],
      [0.24, 2.94, 0.64, 0.38, bauhiniaLightMatB],
      [-0.22, 3.00, -0.58, 0.38, bauhiniaMidMat],
      [0.14, 3.04, -0.24, 0.42, bauhiniaLightMatB],
      [-0.14, 3.12, 0.18, 0.44, bauhiniaLightMatB],
      [0.48, 2.98, -0.04, 0.36, bauhiniaLightMatA],
      [-0.48, 2.96, 0.26, 0.36, bauhiniaLightMatB]
    ];

    clusterSpecs.forEach(([px, py, pz, r, mat], idx) => {
      const geom = createOrganicFoliageGeometry(r * scale, seedBase + idx * 1.9);
      const puff = markSkipPrintEdges(new THREE.Mesh(geom, mat));
      puff.userData.printBotanical = 'bauhinia';
      puff.position.set(px * scale, py * scale, pz * scale);
      puff.rotation.set(idx * 0.35, idx * 0.85, idx * 0.25);
      puff.castShadow = true;
      puff.receiveShadow = true;
      tree.add(puff);
    });

    // Delicate fallen wet pink Bauhinia petals clinging to damp granite flagstones
    const petalMat = new THREE.MeshBasicMaterial({
      color: 0xeea8c8,
      transparent: true,
      opacity: 0.78,
      depthWrite: false
    });
    for (let i = 0; i < 22; i++) {
      const ang = (i / 22) * Math.PI * 2 + scale * 1.3;
      const dist = (0.52 + (i % 5) * 0.34) * scale;
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.056, 6), petalMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(Math.cos(ang) * dist, 0.018, Math.sin(ang) * dist);
      tree.add(p);
    }

    buildTreePitGrate(tree, 1.18 * scale);

    group.add(tree);
    addRoundAO(x, z, 1.48 * scale, 0.46);
    bauhiniaCenters.push(new THREE.Vector3(x, Y0 + 2.6 * scale, z));
  };

  // Lush Deep-Green Hong Kong Weeping Banyan / Ficus Street Tree (榕樹) with hanging aerial roots & raised granite planter
  const addBanyanPocketTree = (x: number, z: number, scale = 1.05) => {
    const tree = new THREE.Group();
    tree.name = 'HK_EastPocketBanyanTree';
    tree.position.set(x, Y0, z);

    // Raised granite pocket-park planter box with stepped seating ledge & ornamental fern shrubs
    const pSize = 1.85;
    const planterBase = new THREE.Mesh(new THREE.BoxGeometry(pSize, 0.36, pSize), graniteCurbMat);
    planterBase.position.y = 0.18;
    planterBase.castShadow = true;
    planterBase.receiveShadow = true;
    tree.add(planterBase);
    const planterLedge = new THREE.Mesh(
      new THREE.BoxGeometry(pSize + 0.14, 0.08, pSize + 0.14),
      new THREE.MeshStandardMaterial({ color: 0x8a97a2, roughness: 0.76 })
    );
    planterLedge.position.y = 0.38;
    tree.add(planterLedge);
    const soilTop = new THREE.Mesh(new THREE.BoxGeometry(pSize - 0.24, 0.06, pSize - 0.24), soilMat);
    soilTop.position.y = 0.38;
    tree.add(soilTop);

    // Gnarled multi-stem Hong Kong Banyan trunk & wide spreading boughs
    const mainTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.135 * scale, 0.24 * scale, 1.86 * scale, 9),
      trunkMat
    );
    mainTrunk.position.y = 0.38 + 0.93 * scale;
    mainTrunk.rotation.z = -0.05;
    mainTrunk.castShadow = true;
    tree.add(mainTrunk);

    const boughs: Array<[number, number, number, number, number]> = [
      [-0.46, 2.22, 0.24, 0.64, -0.35],
      [0.48, 2.26, -0.22, -0.60, 0.40],
      [0.14, 2.34, 0.44, -0.22, 0.60],
      [-0.24, 2.28, -0.40, 0.40, -0.52]
    ];
    for (const [bx, by, bz, rz, rx] of boughs) {
      const br = markSkipPrintEdges(
        new THREE.Mesh(new THREE.CylinderGeometry(0.050 * scale, 0.092 * scale, 1.28 * scale, 7), trunkMat)
      );
      br.position.set(bx * scale, by * scale, bz * scale);
      br.rotation.set(rx, 0, rz);
      br.castShadow = true;
      tree.add(br);
    }

    // Iconic slender hanging Hong Kong Banyan aerial root curtains (氣根)
    for (const [ax, az, len] of [
      [-0.64, 0.34, 1.48],
      [-0.48, 0.48, 1.24],
      [0.54, -0.28, 1.32],
      [0.24, 0.62, 1.26],
      [-0.34, -0.52, 1.38],
      [0.68, 0.24, 1.18],
      [-0.78, -0.14, 1.12],
      [0.42, 0.46, 1.08]
    ]) {
      const root = markSkipPrintEdges(
        new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.008, len * scale, 5), trunkMat)
      );
      root.position.set(ax * scale, (2.36 - len * 0.5) * scale, az * scale);
      tree.add(root);
    }

    // Airy layered rainforest-green Hong Kong Banyan umbrella crown
    const banyanClusters: Array<[number, number, number, number, THREE.MeshStandardMaterial]> = [
      [-0.92, 2.46, 0.32, 0.54, foliageDarkMat],
      [0.86, 2.48, -0.30, 0.56, foliageDarkMat],
      [0.20, 2.46, 0.80, 0.50, foliageDarkMat],
      [-0.40, 2.52, -0.76, 0.52, foliageDarkMat],
      [0.0, 2.68, 0.0, 0.64, foliageMidMat],
      [-1.12, 2.78, -0.16, 0.48, foliageMidMat],
      [1.06, 2.80, 0.24, 0.50, foliageMidMat],
      [-0.26, 2.86, 0.96, 0.46, foliageMidMat],
      [0.48, 2.88, -0.84, 0.48, foliageMidMat],
      [-0.72, 2.94, 0.62, 0.44, foliageMidMat],
      [0.72, 2.98, -0.52, 0.44, foliageMidMat],
      [-0.50, 3.08, 0.42, 0.50, foliageLightMat],
      [0.52, 3.12, 0.32, 0.48, foliageLightMat],
      [-0.42, 3.18, -0.34, 0.46, foliageLightMat],
      [0.36, 3.22, -0.44, 0.42, foliageLightMat],
      [-0.64, 3.06, -0.18, 0.42, foliageLightMat],
      [0.06, 3.34, 0.04, 0.50, foliageLightMat]
    ];
    banyanClusters.forEach(([px, py, pz, r, mat], idx) => {
      const geom = createOrganicFoliageGeometry(r * scale, 211 + idx * 2.3);
      const puff = markSkipPrintEdges(new THREE.Mesh(geom, mat));
      puff.userData.printBotanical = 'banyan';
      puff.position.set(px * scale, py * scale, pz * scale);
      puff.rotation.set(idx * 0.45, idx * 0.8, idx * 0.2);
      puff.castShadow = true;
      puff.receiveShadow = true;
      tree.add(puff);
    });

    // Low tropical fern shrubs tucked around base of the granite planter
    for (const [fx, fz] of [
      [-0.58, 0.56],
      [0.56, 0.58],
      [-0.54, -0.54],
      [0.58, -0.52]
    ]) {
      const fern = markSkipPrintEdges(new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), foliageMidMat));
      fern.userData.printBotanical = 'banyan';
      fern.scale.set(1.15, 0.72, 1.15);
      fern.position.set(fx, 0.52, fz);
      tree.add(fern);
    }

    group.add(tree);
    addRoundAO(x, z, 1.72 * scale, 0.50);
  };

  // Wide Open Front-Left Bauhinia Plaza + East Pocket Park Weeping Banyan Tree!
  addBauhiniaTree(-8.6, 12.0, 1.12, 11);
  addBauhiniaTree(-12.2, 11.2, 0.88, 37);
  addBanyanPocketTree(14.95, 8.25, 0.88);

  // Helper: Classic Hong Kong Cast-Iron & Slatted Timber Park Bench
  const addHKParkBench = (bx: number, bz: number, rotY: number) => {
    const bench = new THREE.Group();
    bench.position.set(bx, Y0, bz);
    bench.rotation.y = rotY;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.46), woodMat);
    seat.position.y = 0.42;
    seat.castShadow = true;
    bench.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.38, 0.07), woodMat);
    back.position.set(0, 0.72, -0.22);
    back.rotation.x = -0.16;
    back.castShadow = true;
    bench.add(back);

    for (const lx of [-0.58, 0.58]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.44), darkMetalMat);
      leg.position.set(lx, 0.22, 0);
      bench.add(leg);
    }
    group.add(bench);
    addRoundAO(bx, bz, 0.88, 0.42);
  };

  // Front-Left Bauhinia Plaza Bench + East Pocket Park Bench (休憩處長椅)
  addHKParkBench(-6.9, 12.5, -0.35);
  addHKParkBench(12.65, 9.55, -Math.PI * 0.82);

  // =========================================================================
  // 9B. VINTAGE HONG KONG ILLUMINATED TELEPHONE BOOTH (懷舊電話亭)
  // & HERITAGE HONG KONG PILLAR POSTBOX (郵筒) ON EAST PLAZA
  // =========================================================================
  {
    // A. Vintage Illuminated Hong Kong Telephone Booth at (10.55, 5.75) — clear of MTR Exit A3, kiosk & Banyan!
    const booth = new THREE.Group();
    booth.name = 'HK_TelephoneBooth';
    booth.position.set(10.55, Y0, 5.75);
    booth.rotation.y = -0.18;

    const boothGlassMat = new THREE.MeshStandardMaterial({
      color: 0xbce6f4,
      transparent: true,
      opacity: 0.24,
      roughness: 0.12,
      metalness: 0.25,
      depthWrite: false
    });
    const boothSignTex = createPhoneBoothSignTexture();
    const boothSignMat = new THREE.MeshStandardMaterial({
      map: boothSignTex,
      emissive: new THREE.Color(0xff7864),
      emissiveMap: boothSignTex,
      emissiveIntensity: 1.05,
      roughness: 0.30
    });
    emissiveTracks.push({ mat: boothSignMat, base: 1.05 });

    const boothLightMat = new THREE.MeshStandardMaterial({
      color: 0xfff2cf,
      emissive: new THREE.Color(0xffc068),
      emissiveIntensity: 1.95,
      roughness: 0.2
    });
    emissiveTracks.push({ mat: boothLightMat, base: 1.95 });

    const bw = 0.88;
    const bh = 2.18;
    // Aluminum plinth base & roof cap
    const bBase = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.06, 0.10, bw + 0.06), darkMetalMat);
    bBase.position.y = 0.05;
    booth.add(bBase);

    for (const [cx, cz] of [
      [-bw * 0.46, -bw * 0.46],
      [bw * 0.46, -bw * 0.46],
      [-bw * 0.46, bw * 0.46],
      [bw * 0.46, bw * 0.46]
    ]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, bh, 0.055), chromeSteelMat);
      post.position.set(cx, 0.10 + bh * 0.5, cz);
      post.castShadow = true;
      booth.add(post);
    }

    // Back solid brushed metal wall & 3-sided glazing + mid-height crimson waist kick panel
    const backP = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.04, bh, 0.05), darkMetalMat);
    backP.position.set(0, 0.10 + bh * 0.5, -bw * 0.46);
    booth.add(backP);

    for (const sx of [-bw * 0.46, bw * 0.46]) {
      const pane = markSkipPrintEdges(new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.12, bh - 0.46), boothGlassMat));
      pane.rotation.y = Math.PI / 2;
      pane.position.set(sx, 0.10 + bh * 0.54, 0);
      booth.add(pane);
    }

    // Illuminated crimson crown lightbox (電 話 · TEL) wrapping all 4 upper faces!
    const crownBox = new THREE.Mesh(
      new THREE.BoxGeometry(bw + 0.02, 0.27, bw + 0.02),
      [boothSignMat, boothSignMat, darkMetalMat, boothLightMat, boothSignMat, boothSignMat]
    );
    crownBox.position.y = 0.10 + bh + 0.135;
    crownBox.castShadow = true;
    booth.add(crownBox);

    // Interior wall-mounted HK coin payphone unit & warm interior lamp
    const phoneBox = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.14), chromeSteelMat));
    phoneBox.position.set(0, 1.32, -bw * 0.36);
    booth.add(phoneBox);
    const phoneShelf = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.24), darkMetalMat));
    phoneShelf.position.set(0, 1.02, -bw * 0.30);
    booth.add(phoneShelf);

    group.add(booth);
    addRoundAO(10.55, 5.75, 0.68, 0.48);

    // B. Heritage Hong Kong Cast-Iron Pillar Postbox (郵筒) at (6.05, 5.85)
    const postbox = new THREE.Group();
    postbox.name = 'HK_HeritagePostbox';
    postbox.position.set(6.05, Y0, 5.85);
    postbox.rotation.y = -0.35;

    const postGreenMat = new THREE.MeshStandardMaterial({
      color: 0x1e5c42,
      roughness: 0.38,
      metalness: 0.32
    });
    const postPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.22, 14), darkMetalMat);
    postPlinth.position.y = 0.11;
    postbox.add(postPlinth);
    const postBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 1.02, 14), postGreenMat);
    postBarrel.position.y = 0.73;
    postBarrel.castShadow = true;
    postbox.add(postBarrel);
    const postBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.24, 0.06, 14), postGreenMat);
    postBrim.position.y = 1.24;
    postbox.add(postBrim);
    const postCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      postGreenMat
    );
    postCap.position.y = 1.26;
    postbox.add(postCap);
    // Mail slot hood & cream collection-times plaque facing south-west
    const slot = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.06), darkMetalMat));
    slot.position.set(0, 1.06, 0.20);
    postbox.add(slot);
    const timeCard = markSkipPrintEdges(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.19, 0.03),
        new THREE.MeshStandardMaterial({ color: 0xf0e8d6, roughness: 0.52 })
      )
    );
    timeCard.position.set(0, 0.78, 0.21);
    postbox.add(timeCard);

    group.add(postbox);
    addRoundAO(6.05, 5.85, 0.36, 0.46);
  }

  // =========================================================================
  // 10. 8 UPGRADED STYLIZED RAINY HONG KONG PEDESTRIANS
  // Coat collars, scarf/briefcase/tote accents, translucent umbrellas with
  // delicate metal ribs & curved wooden J-handles, shared-umbrella couple,
  // passenger waiting at 電車站, and seated patron at 金鳳冰室!
  // =========================================================================
  const buildDetailedUmbrella = (
    colorHex: number,
    opacity: number,
    radius = 0.46
  ): THREE.Group => {
    const umbGroup = new THREE.Group();

    const shaft = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.72, 6), darkMetalMat)
    );
    shaft.position.y = 0.28;
    umbGroup.add(shaft);

    // Curved wooden J-handle at base of shaft
    const jHandle = markSkipPrintEdges(
      new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.013, 6, 10, Math.PI), woodMat)
    );
    jHandle.rotation.z = Math.PI;
    jHandle.position.set(0.042, -0.08, 0);
    umbGroup.add(jHandle);

    // Metallic ferrule tip on top of dome
    const tip = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.09, 6), chromeSteelMat)
    );
    tip.position.y = 0.66;
    umbGroup.add(tip);

    // Translucent vinyl/nylon canopy dome
    const canopyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      transparent: true,
      opacity,
      roughness: 0.24,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
      canopyMat
    );
    canopy.scale.set(1, 0.56, 1);
    canopy.position.y = 0.40;
    canopy.castShadow = true;
    umbGroup.add(canopy);

    // 8 delicate dark-metal radial umbrella ribs curving along the underside of the dome
    const ribsGroup = markSkipPrintEdges(new THREE.Group());
    ribsGroup.position.y = 0.40;
    const ribCount = 8;
    for (let i = 0; i < ribCount; i++) {
      const ang = (i / ribCount) * Math.PI * 2;
      const ribCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, radius * 0.545, 0),
        new THREE.Vector3(Math.cos(ang) * radius * 0.55, radius * 0.43, Math.sin(ang) * radius * 0.55),
        new THREE.Vector3(Math.cos(ang) * radius * 0.98, radius * 0.07, Math.sin(ang) * radius * 0.98)
      ]);
      ribsGroup.add(
        new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 6, 0.0065, 4, false), darkMetalMat)
      );
    }
    umbGroup.add(ribsGroup);

    return umbGroup;
  };

  // =========================================================================
  // 9C. EAST UNDER-VIADUCT HONG KONG BUS STOP SHELTER (城巴/九巴 101 巴士站)
  // Positioned cleanly at (6.95, -6.75) between Pier #3 (z=-3.8) and B5 (z=-8.8),
  // facing the East northbound lane (x=5.1) with backlit Route 101 lightbox!
  // =========================================================================
  {
    const busStop = new THREE.Group();
    busStop.name = 'HK_BusStopShelter_101';
    busStop.position.set(6.95, Y0, -6.75);

    const bsGlassMat = new THREE.MeshStandardMaterial({
      color: 0xaed4e6,
      transparent: true,
      opacity: 0.28,
      roughness: 0.14,
      metalness: 0.28,
      depthWrite: false
    });
    const bsMapSet = createBusShelterMapTexture();
    const bsMapMat = new THREE.MeshStandardMaterial({
      map: bsMapSet.map,
      emissive: new THREE.Color(0xf4e4c8),
      emissiveMap: bsMapSet.emissiveMap,
      emissiveIntensity: 0.54,
      roughness: 0.30
    });
    emissiveTracks.push({ mat: bsMapMat, base: 0.54 });

    // Slim dark-steel rear stanchions & cantilevered curved-edge rain roof
    for (const pz of [-1.25, 0, 1.25]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 2.38, 8), darkMetalMat);
      post.position.set(0.58, 1.19, pz);
      post.castShadow = true;
      busStop.add(post);
    }
    const bsRoof = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.10, 2.96), darkMetalMat);
    bsRoof.position.set(0.02, 2.40, 0);
    bsRoof.rotation.z = 0.06;
    bsRoof.castShadow = true;
    busStop.add(bsRoof);

    const bsBackGlass = markSkipPrintEdges(new THREE.Mesh(new THREE.PlaneGeometry(2.42, 1.85), bsGlassMat));
    bsBackGlass.rotation.y = -Math.PI / 2;
    bsBackGlass.position.set(0.54, 1.24, 0);
    busStop.add(bsBackGlass);

    // Backlit Route 101 Lightbox Display Panel on south end facing SE camera!
    const lightbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 1.72, 0.14),
      [darkMetalMat, darkMetalMat, darkMetalMat, darkMetalMat, bsMapMat, bsMapMat]
    );
    lightbox.position.set(0.08, 1.24, 1.32);
    lightbox.castShadow = true;
    busStop.add(lightbox);

    // Stainless lean-rail waiting bar inside shelter
    const leanBar = markSkipPrintEdges(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.95, 8), chromeSteelMat));
    leanBar.rotation.x = Math.PI / 2;
    leanBar.position.set(0.28, 0.72, -0.18);
    busStop.add(leanBar);

    group.add(busStop);
    addRoundAO(6.95, -6.75, 1.35, 0.44);

    // Standalone Hong Kong Bus Stop Flag Pole right at curb (5.65, -5.25)
    const flagPole = new THREE.Group();
    flagPole.position.set(5.65, Y0, -5.25);
    const poleCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 2.65, 8), chromeSteelMat);
    poleCyl.position.y = 1.325;
    poleCyl.castShadow = true;
    flagPole.add(poleCyl);
    const flagHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.48, 0.34),
      new THREE.MeshStandardMaterial({
        color: 0xd63638,
        emissive: new THREE.Color(0xa62024),
        emissiveIntensity: 0.35,
        roughness: 0.36
      })
    );
    flagHead.position.y = 2.42;
    flagPole.add(flagHead);
    const routeStrip = markSkipPrintEdges(
      new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.28), safetyYellowMat)
    );
    routeStrip.position.y = 2.50;
    flagPole.add(routeStrip);
    group.add(flagPole);
    addRoundAO(5.65, -5.25, 0.22, 0.40);
  }

  // =========================================================================
  // 10. STYLED RAINY-DAY PEDESTRIANS (Articulated Walking Stride & Umbrellas!)
  // =========================================================================
  interface WalkPathSpec {
    x0: number;
    z0: number;
    x1: number;
    z1: number;
    speed: number;
    phase: number;
    baseY?: number;
    obeySignal?: boolean;
  }

  interface WalkerEntry {
    root: THREE.Group;
    legL: THREE.Group;
    legR: THREE.Group;
    armL: THREE.Object3D;
    path: WalkPathSpec;
    dist: number;
  }

  const animatedWalkers: WalkerEntry[] = [];

  interface PedestrianOpts {
    x: number;
    z: number;
    rotY: number;
    coatColor: number;
    scarfColor?: number;
    accessory?: 'briefcase' | 'tote' | 'newspaper';
    umbrellaColor?: number;
    umbrellaOpacity?: number;
    umbrellaRadius?: number;
    umbrellaOffset?: [number, number, number];
    seated?: boolean;
    phase: number;
    skipAO?: boolean;
    walkPath?: WalkPathSpec;
  }

  const addPedestrian = (opts: PedestrianOpts): THREE.Group => {
    const ped = new THREE.Group();
    const baseY = opts.walkPath?.baseY ?? Y0;
    ped.position.set(opts.x, baseY, opts.z);
    ped.rotation.y = opts.rotY;

    const coatMat = new THREE.MeshStandardMaterial({ color: opts.coatColor, roughness: 0.78 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6c4a8, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x263240, roughness: 0.85 });

    const yOff = opts.seated ? -0.22 : 0;
    let legLPivot: THREE.Group | null = null;
    let legRPivot: THREE.Group | null = null;

    if (opts.seated) {
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.34), pantsMat);
      legs.position.set(0, 0.24, 0.14);
      ped.add(legs);
    } else {
      for (const [lx, isLeft] of [
        [-0.072, true],
        [0.072, false]
      ] as Array<[number, boolean]>) {
        const hipPivot = new THREE.Group();
        hipPivot.position.set(lx, 0.48, 0);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.044, 0.48, 8), pantsMat);
        leg.position.set(0, -0.24, 0);
        leg.castShadow = true;
        hipPivot.add(leg);
        ped.add(hipPivot);
        if (isLeft) legLPivot = hipPivot;
        else legRPivot = hipPivot;
      }
    }

    // Tapered raincoat torso + raised sculpted coat collar
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.215, 0.60, 10), coatMat);
    torso.position.set(0, 0.72 + yOff, 0);
    torso.castShadow = true;
    ped.add(torso);

    const collar = markSkipPrintEdges(
      new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.028, 6, 12), coatMat)
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.00 + yOff, 0);
    ped.add(collar);

    // Optional warm knit scarf accent
    if (opts.scarfColor !== undefined) {
      const scarfMat = new THREE.MeshStandardMaterial({ color: opts.scarfColor, roughness: 0.86 });
      const scarf = markSkipPrintEdges(
        new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.032, 6, 12), scarfMat)
      );
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(0, 1.02 + yOff, 0);
      ped.add(scarf);

      const scarfTail = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.035), scarfMat)
      );
      scarfTail.position.set(0.05, 0.90 + yOff, 0.13);
      scarfTail.rotation.z = -0.14;
      ped.add(scarfTail);
    }

    // Subtle arms (right arm slightly lifted when holding umbrella)
    const armL = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.38, 7), coatMat)
    );
    armL.position.set(-0.175, 0.75 + yOff, 0.02);
    armL.rotation.z = 0.14;
    ped.add(armL);

    const armR = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.38, 7), coatMat)
    );
    if (opts.umbrellaColor !== undefined) {
      armR.position.set(0.16, 0.84 + yOff, 0.08);
      armR.rotation.set(-0.55, 0, -0.22);
    } else {
      armR.position.set(0.175, 0.75 + yOff, 0.06);
      armR.rotation.set(-0.28, 0, -0.12);
    }
    ped.add(armR);

    // Optional handheld accessory (leather briefcase, shopping tote bag, or folded newspaper)
    if (opts.accessory === 'briefcase') {
      const bc = markSkipPrintEdges(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.24, 0.32),
          new THREE.MeshStandardMaterial({ color: 0x4b2e1f, roughness: 0.56 })
        )
      );
      bc.position.set(-0.22, 0.48 + yOff, 0.04);
      ped.add(bc);
    } else if (opts.accessory === 'tote') {
      const tote = markSkipPrintEdges(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.26, 0.24),
          new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.74 })
        )
      );
      tote.position.set(-0.22, 0.46 + yOff, 0.05);
      ped.add(tote);
    } else if (opts.accessory === 'newspaper') {
      const np = markSkipPrintEdges(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.28, 8),
          new THREE.MeshStandardMaterial({ color: 0xebe4d4, roughness: 0.78 })
        )
      );
      np.rotation.x = Math.PI / 2;
      np.position.set(-0.18, 0.68 + yOff, 0.04);
      ped.add(np);
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.122, 10, 8), skinMat);
    head.position.set(0, 1.13 + yOff, 0);
    head.castShadow = true;
    ped.add(head);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.128, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    hair.position.set(0, 1.14 + yOff, -0.01);
    ped.add(hair);

    if (opts.umbrellaColor !== undefined) {
      const umb = buildDetailedUmbrella(
        opts.umbrellaColor,
        opts.umbrellaOpacity ?? 0.65,
        opts.umbrellaRadius ?? 0.46
      );
      const [ux, uy, uz] = opts.umbrellaOffset ?? [0.13, 0.88 + yOff, 0.09];
      umb.position.set(ux, uy, uz);
      const tiltZ = -0.14;
      umb.rotation.set(0.12, 0, tiltZ);
      ped.add(umb);
      animatedUmbrellas.push({ obj: umb, phase: opts.phase, baseRotZ: tiltZ });
    }

    // Dynamic ground shadow disc attached under walking figures so their shadow moves smoothly with them!
    if (opts.walkPath && legLPivot && legRPivot) {
      const walkAO = new THREE.Mesh(
        new THREE.PlaneGeometry(0.66, 0.66),
        new THREE.MeshBasicMaterial({
          map: roundShadowTex,
          transparent: true,
          opacity: 0.46,
          depthWrite: false
        })
      );
      walkAO.rotation.x = -Math.PI / 2;
      walkAO.position.set(0, 0.014, 0);
      walkAO.renderOrder = 2;
      ped.add(walkAO);

      const dist = Math.hypot(opts.walkPath.x1 - opts.walkPath.x0, opts.walkPath.z1 - opts.walkPath.z0);
      animatedWalkers.push({
        root: ped,
        legL: legLPivot,
        legR: legRPivot,
        armL,
        path: opts.walkPath,
        dist: Math.max(0.1, dist)
      });
    } else if (!opts.seated && !opts.skipAO) {
      addRoundAO(opts.x, opts.z, 0.36, 0.48);
    }

    group.add(ped);
    return ped;
  };

  // 1. Seated figure on park bench under Front-Left Bauhinia tree
  addPedestrian({
    x: -6.96,
    z: 12.52,
    rotY: -0.35,
    coatColor: 0x3b4e63,
    scarfColor: 0xc26e52,
    umbrellaColor: 0xdcebf4,
    umbrellaOpacity: 0.54,
    seated: true,
    phase: 0.2
  });

  // 2. Passenger waiting right beside the 電車站 tram stop pole (looking toward Tram #120!)
  addPedestrian({
    x: -5.8,
    z: 6.2,
    rotY: Math.PI * 0.46,
    coatColor: 0x475a50,
    scarfColor: 0xdcb464,
    accessory: 'briefcase',
    umbrellaColor: 0xe6b64c,
    umbrellaOpacity: 0.80,
    phase: 1.5
  });

  // 3. Crossing walker near zebra crossing & 明記雲吞麵
  addPedestrian({
    x: -5.9,
    z: 3.6,
    rotY: Math.PI * 0.55,
    coatColor: 0x5c4448,
    accessory: 'tote',
    umbrellaColor: 0xdaf0f8,
    umbrellaOpacity: 0.52,
    phase: 2.8
  });

  // 4 & 5. Couple walking together under a SHARED translucent umbrella near glowing cyan vending machines!
  addPedestrian({
    x: 7.36,
    z: 4.02,
    rotY: Math.PI * 0.94,
    coatColor: 0x32465a,
    scarfColor: 0x8ea8c2,
    umbrellaColor: 0x88cde8,
    umbrellaOpacity: 0.64,
    umbrellaRadius: 0.56,
    umbrellaOffset: [-0.12, 0.92, 0.04],
    phase: 4.1
  });
  addPedestrian({
    x: 7.68,
    z: 3.96,
    rotY: Math.PI * 1.04,
    coatColor: 0x9b7a5e,
    scarfColor: 0xd94e52,
    accessory: 'tote',
    phase: 4.1,
    skipAO: true
  });

  // 6. Kiosk browser strolling beside the green newspaper kiosk (報紙檔)
  addPedestrian({
    x: 7.75,
    z: 7.62,
    rotY: Math.PI * 0.46,
    coatColor: 0x3c4752,
    accessory: 'newspaper',
    umbrellaColor: 0xc24046,
    umbrellaOpacity: 0.82,
    phase: 5.3
  });

  // 7. Seated patron enjoying milk tea inside the dry glowing 金鳳冰室 Cha Chaan Teng arcade (table 2 at -8.28, 6.82)
  addPedestrian({
    x: -8.28,
    z: 7.18,
    rotY: Math.PI,
    coatColor: 0x8c5a3c,
    scarfColor: 0xdcc498,
    seated: true,
    phase: 6.0
  });
  // Miniature HK ceramic milk-tea cup on the café table right in front of the seated patron
  const teaCup = markSkipPrintEdges(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.030, 0.068, 8),
      new THREE.MeshStandardMaterial({ color: 0xf6f0e4, roughness: 0.35 })
    )
  );
  teaCup.position.set(-8.28, Y0 + 0.74, 6.94);
  group.add(teaCup);

  // 8. East pocket-park stroller walking between the newspaper kiosk & Banyan rest plaza
  addPedestrian({
    x: 11.25,
    z: 9.35,
    rotY: -Math.PI * 0.72,
    coatColor: 0x3b4c5e,
    scarfColor: 0xc9a058,
    accessory: 'tote',
    umbrellaColor: 0x7ab496,
    umbrellaOpacity: 0.76,
    phase: 3.4
  });

  // 9. Office commuter stepping out of Wan Chai MTR Exit A3 into the misty drizzle
  addPedestrian({
    x: 10.75,
    z: 3.18,
    rotY: -Math.PI * 0.14,
    coatColor: 0x354454,
    scarfColor: 0xc8604c,
    accessory: 'briefcase',
    umbrellaColor: 0xd8ecf4,
    umbrellaOpacity: 0.56,
    phase: 2.1
  });

  // 10. Commuter waiting for Route 101 under the East Under-Viaduct Bus Stop Shelter
  addPedestrian({
    x: 6.72,
    z: -6.58,
    rotY: -Math.PI * 0.45,
    coatColor: 0x3e4b5c,
    scarfColor: 0xd6b06a,
    accessory: 'briefcase',
    phase: 0.9
  });

  // 11. LIVE STROLLING WALKER A: strolling along the wide open Front-Left Bauhinia Promenade south of 金鳳冰室 (z = 10.45)
  addPedestrian({
    x: -8.2,
    z: 10.45,
    rotY: Math.PI * 0.5,
    coatColor: 0x4b5664,
    scarfColor: 0xe0aa54,
    accessory: 'tote',
    umbrellaColor: 0xdca446,
    umbrellaOpacity: 0.78,
    phase: 0.8,
    walkPath: { x0: -13.2, z0: 10.45, x1: -6.65, z1: 10.45, speed: 0.74, phase: 0.38 }
  });

  // 12. LIVE STROLLING WALKER B: strolling along the wide open East Plaza Promenade between MTR Exit A3 & Telephone Booth (z = 4.48)
  addPedestrian({
    x: 12.9,
    z: 4.48,
    rotY: -Math.PI * 0.5,
    coatColor: 0x2e4154,
    scarfColor: 0xe6b676,
    accessory: 'briefcase',
    umbrellaColor: 0xc85a4a,
    umbrellaOpacity: 0.76,
    phase: 2.3,
    walkPath: { x0: 8.65, z0: 4.48, x1: 14.65, z1: 4.48, speed: 0.76, phase: 0.36 }
  });

  // 13. LIVE CROSSING WALKER C: obeys the 14s HK pedestrian green man across the painted Zebra Crossing (z = 3.42)!
  addPedestrian({
    x: 3.63,
    z: 3.42,
    rotY: -Math.PI * 0.5,
    coatColor: 0x6c3d46,
    scarfColor: 0xebd2b0,
    accessory: 'tote',
    umbrellaColor: 0xf2d8e4,
    umbrellaOpacity: 0.74,
    phase: 4.7,
    walkPath: { x0: 4.65, z0: 3.42, x1: -4.65, z1: 3.42, speed: 1.25, phase: 0.0, baseY: 0.04, obeySignal: true }
  });

  scene.add(group);

  // Locate roof cat pivots from the kiosk group for smooth tail & head animations
  const kioskObj = group.getObjectByName('HK_NewspaperKiosk');
  const catHeadPivot = (kioskObj?.userData.catHeadPivot as THREE.Group | undefined) ?? null;
  const catTailPivot = (kioskObj?.userData.catTailPivot as THREE.Group | undefined) ?? null;

  let currentEmissiveScale = 1.06;
  let printModeActive = false;

  const pedGreenColor = new THREE.Color(0x52ffa8);
  const pedRedColor = new THREE.Color(0xff4e42);

  return {
    group,
    bauhiniaCenters,
    setEmissiveScale: (scale) => {
      currentEmissiveScale = scale;
      for (const e of emissiveTracks) {
        e.mat.emissiveIntensity = e.base * scale;
      }
      const coneScale = Math.min(1.45, 0.4 + scale * 0.6);
      for (const c of softCones) {
        c.mat.uniforms.uOpacity.value = printModeActive ? 0 : c.baseOpacity * coneScale;
      }
      for (const h of lampHaloMats) {
        h.mat.opacity = printModeActive ? 0 : h.baseOpacity * coneScale;
      }
    },
    setPrintMode: (enabled) => {
      printModeActive = enabled;
      const coneScale = Math.min(1.45, 0.4 + currentEmissiveScale * 0.6);
      for (const c of softCones) {
        c.mat.visible = !enabled;
        c.mat.uniforms.uOpacity.value = enabled ? 0 : c.baseOpacity * coneScale;
      }
      for (const h of lampHaloMats) {
        h.mat.visible = !enabled;
        h.mat.opacity = enabled ? 0 : h.baseOpacity * coneScale;
      }
    },
    update: (simTime) => {
      // Shared authentic 14-second Hong Kong Traffic Signal clock (+2.1s phase so hero t=0.25 sits mid-steady-green)
      const sig = getHKSignalState(simTime);
      const { sigT, cycleIndex } = sig;

      // 1. Rainy-breeze umbrella sway
      for (const u of animatedUmbrellas) {
        u.obj.rotation.z = u.baseRotZ + Math.sin(simTime * 1.45 + u.phase) * 0.045;
      }

      // 2. Articulated walking pedestrians (promenade strolls + signal-synced zebra crossing walker!)
      for (const w of animatedWalkers) {
        if (w.path.obeySignal) {
          // Synced strictly to 14s HK pedestrian green window (0.85s..7.60s cross; safely on curb before 7.7s Red Man!)
          const forward = ((cycleIndex % 2) + 2) % 2 === 0;
          const isCrossing = sigT >= 0.85 && sigT <= 7.60;
          const rawU = sigT < 0.85 ? 0 : sigT > 7.60 ? 1 : (sigT - 0.85) / 6.75;
          const smoothU = rawU * rawU * (3 - 2 * rawU);
          const t = forward ? smoothU : 1.0 - smoothU;
          const px = THREE.MathUtils.lerp(w.path.x0, w.path.x1, t);
          const pz = THREE.MathUtils.lerp(w.path.z0, w.path.z1, t);
          const stepDir = Math.sign(w.path.x1 - w.path.x0) || 1;
          // Face across the road both while crossing and while waiting politely at either curb
          const faceDir = (sigT > 7.60 ? (forward ? -1 : 1) : forward ? 1 : -1) * stepDir;
          const strideAmp = isCrossing ? Math.sin(rawU * Math.PI) : 0;
          const stridePhase = simTime * 7.2 + 1.1;
          const bob = Math.abs(Math.sin(stridePhase)) * 0.032 * strideAmp;

          w.root.position.set(px, (w.path.baseY ?? Y0) + bob, pz);
          w.root.rotation.y = faceDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
          const legAng = Math.sin(stridePhase) * 0.36 * strideAmp;
          w.legL.rotation.x = legAng;
          w.legR.rotation.x = -legAng;
          w.armL.rotation.x = -legAng * 0.55;
        } else {
          const cycleDur = (w.dist / w.path.speed) * 2.0;
          const uCycle = (((simTime / cycleDur + w.path.phase) % 1.0) + 1.0) % 1.0;
          const forward = uCycle < 0.5;
          const t = forward ? uCycle * 2.0 : (1.0 - uCycle) * 2.0;
          const px = THREE.MathUtils.lerp(w.path.x0, w.path.x1, t);
          const pz = THREE.MathUtils.lerp(w.path.z0, w.path.z1, t);
          const dx = forward ? w.path.x1 - w.path.x0 : w.path.x0 - w.path.x1;
          const dz = forward ? w.path.z1 - w.path.z0 : w.path.z0 - w.path.z1;
          const stridePhase = simTime * 6.4 + w.path.phase * 12.0;
          const bob = Math.abs(Math.sin(stridePhase)) * 0.032;

          w.root.position.set(px, (w.path.baseY ?? Y0) + bob, pz);
          w.root.rotation.y = Math.atan2(dx, dz);
          const legAng = Math.sin(stridePhase) * 0.34;
          w.legL.rotation.x = legAng;
          w.legR.rotation.x = -legAng;
          w.armL.rotation.x = -legAng * 0.55;
        }
      }

      // 3. Ginger-white Hong Kong street cat perched on newspaper kiosk roof
      if (catTailPivot) {
        catTailPivot.rotation.z = Math.sin(simTime * 2.2) * 0.32;
        catTailPivot.rotation.x = Math.cos(simTime * 1.4) * 0.08;
      }
      if (catHeadPivot) {
        catHeadPivot.rotation.y = Math.sin(simTime * 0.72) * 0.34;
        catHeadPivot.rotation.x = Math.sin(simTime * 1.15) * 0.07;
      }

      // 4. Gently swaying red plastic Dai Pai Dong lampshade above noodle table
      dpdLampPivot.rotation.z = Math.sin(simTime * 1.85 + 0.6) * 0.065;
      dpdLampPivot.rotation.x = Math.cos(simTime * 1.42) * 0.045;

      // 5. Authentic 5-stage (4-vehicle-phase) 14-second Hong Kong Traffic Signal & Flashing Green Man Cycle!
      const sc = currentEmissiveScale;
      const desiredPedPhase: 'green' | 'red' = sig.ped === 'RED' ? 'red' : 'green';
      if (desiredPedPhase !== pedSigPhase) {
        pedSigPhase = desiredPedPhase;
        const tex = desiredPedPhase === 'green' ? pedSigGreen : pedSigRed;
        pedFaceMat.map = tex.map;
        pedFaceMat.emissiveMap = tex.emissiveMap;
        pedFaceMat.needsUpdate = true;
      }

      // Vehicle lamps: RED -> RED_AMBER (after Ped RED!) -> GREEN -> AMBER
      vehRedLitMat.emissiveIntensity =
        (sig.vehicle === 'RED' || sig.vehicle === 'RED_AMBER' ? 2.35 : 0.14) * sc;
      vehAmberDimMat.emissiveIntensity =
        (sig.vehicle === 'RED_AMBER' ? 2.05 : sig.vehicle === 'AMBER' ? 2.25 : 0.14) * sc;
      vehGreenDimMat.emissiveIntensity = (sig.vehicle === 'GREEN' ? 2.35 : 0.12) * sc;

      // Pedestrian signal face: STEADY_GREEN -> FLASHING_GREEN (2.8 Hz, cars still RED!) -> RED
      if (sig.ped === 'STEADY_GREEN') {
        pedFaceMat.emissive.copy(pedGreenColor);
        pedFaceMat.emissiveIntensity = 1.85 * sc;
      } else if (sig.ped === 'FLASHING_GREEN') {
        pedFaceMat.emissive.copy(pedGreenColor);
        pedFaceMat.emissiveIntensity = (sig.pedFlashOn ? 2.05 : 0.25) * sc;
      } else {
        pedFaceMat.emissive.copy(pedRedColor);
        pedFaceMat.emissiveIntensity = 1.65 * sc;
      }
    }
  };
}
