import * as THREE from 'three';
import {
  applyRadialMistFade,
  createSoftLightConeMaterial,
  type RadialMistUniforms
} from './atmosphere';
import {
  createContactShadowTexture,
  createGlowSpriteTexture,
  createTaxiFaceTexture,
  createTaxiRoofSignTexture,
  createTramBillboardTexture,
  createTramDestinationTexture
} from './textures';

export interface ViaductAndVehiclesSystem {
  group: THREE.Group;
  tramGroup: THREE.Group;
  trainGroup: THREE.Group;
  taxiGroup: THREE.Group;
  getTramPosition: () => THREE.Vector3;
  getTrainPosition: () => THREE.Vector3;
  getTramProximity: () => number;
  getTrainProximity: () => number;
  setEmissiveScale: (scale: number) => void;
  setPrintMode: (enabled: boolean) => void;
  update: (simTime: number) => void;
}

const HK_SANS = "'Noto Sans CJK HK', 'Noto Sans CJK TC', 'PingFang HK', 'Microsoft JhengHei', sans-serif";
const HK_SERIF = "'Noto Serif CJK HK', 'Noto Serif CJK TC', 'Songti TC', Georgia, serif";

function markSkipPrintEdges<T extends THREE.Object3D>(obj: T): T {
  obj.userData.skipPrintEdges = true;
  return obj;
}

function makeLocalTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
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
 * Glowing amber LED destination matrix for the HK Metro-Cammell elevated train cab (觀塘 KWUN TONG).
 * Canvas 404 × 80 (AR = 5.050) matching PlaneGeometry(0.96, 0.19) (AR = 5.053) 1:1!
 */
function createTrainLedDestTexture(): THREE.CanvasTexture {
  return makeLocalTexture(404, 80, (ctx, W, H) => {
    ctx.fillStyle = '#0e1114';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#3a4652';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // Subtle LED dot-matrix grid backdrop
    ctx.fillStyle = 'rgba(255, 160, 48, 0.08)';
    for (let y = 8; y < H - 8; y += 6) {
      for (let x = 10; x < W - 10; x += 6) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff9824';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd474';
    fitFontSize(ctx, '觀   塘', 800, 34, 18, HK_SANS, W - 36);
    ctx.fillText('觀   塘', W * 0.5, 29);
    ctx.fillStyle = '#ffb648';
    fitFontSize(ctx, 'KWUN TONG', 700, 17, 11, HK_SANS, W - 36);
    ctx.fillText('KWUN TONG', W * 0.5, 61);
  });
}

/**
 * Warm backlit Metro-Cammell passenger & door window texture with tungsten interior glow,
 * subtle overhead grab-handrail bar, and faint commuter silhouettes.
 */
function createMetroWindowTexture(isDoorPane = false): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const W = isDoorPane ? 96 : 192;
  const H = 192;

  const draw = (emissiveOnly: boolean) =>
    makeLocalTexture(W, H, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      if (emissiveOnly) {
        grad.addColorStop(0, '#ffe39a');
        grad.addColorStop(0.45, '#f2ab4c');
        grad.addColorStop(0.82, '#c86f24');
        grad.addColorStop(1, '#7a3c12');
      } else {
        grad.addColorStop(0, '#fff0c4');
        grad.addColorStop(0.42, '#f4b860');
        grad.addColorStop(0.82, '#c4742a');
        grad.addColorStop(1, '#6c3816');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Overhead warm ceiling light reflection bar
      ctx.fillStyle = emissiveOnly ? 'rgba(255, 248, 212, 0.72)' : 'rgba(255, 252, 232, 0.85)';
      ctx.fillRect(6, 10, w - 12, 14);

      // Subtle interior handrail & commuter silhouette depth
      ctx.fillStyle = emissiveOnly ? 'rgba(18, 10, 6, 0.55)' : 'rgba(42, 26, 18, 0.48)';
      ctx.fillRect(0, h * 0.24, w, 4);

      if (!isDoorPane) {
        // Two faint seated/standing passenger silhouettes inside the warm train carriage
        for (const px of [w * 0.30, w * 0.70]) {
          ctx.beginPath();
          ctx.arc(px, h * 0.56, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(px - 18, h * 0.66, 36, h * 0.34);
        }
        // Subtle lower window sash mullion
        ctx.fillStyle = emissiveOnly ? 'rgba(0, 0, 0, 0.65)' : 'rgba(38, 46, 54, 0.55)';
        ctx.fillRect(0, h * 0.32, w, 5);
      } else {
        // Subtle standing commuter shoulder shadow behind sliding door pane
        ctx.beginPath();
        ctx.arc(w * 0.52, h * 0.50, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(w * 0.52 - 15, h * 0.60, 30, h * 0.40);
      }

      // Subtle rain-wet cool specular diagonal sheen on albedo only
      if (!emissiveOnly) {
        ctx.fillStyle = 'rgba(204, 228, 248, 0.16)';
        ctx.beginPath();
        ctx.moveTo(w * 0.12, 0);
        ctx.lineTo(w * 0.38, 0);
        ctx.lineTo(w * 0.16, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
      }
    });

  return { map: draw(false), emissiveMap: draw(true) };
}

/**
 * Heritage emerald & brass waist fascia lettering strip for Hong Kong Tram #120.
 * Canvas 1146 × 80 (AR = 14.325) matching PlaneGeometry(4.87, 0.34) (AR = 14.324) 1:1!
 */
function createTramWaistPlaqueTexture(): THREE.CanvasTexture {
  return makeLocalTexture(1146, 80, (ctx, W, H) => {
    ctx.fillStyle = '#1b5a41';
    ctx.fillRect(0, 0, W, H);

    // Gold/brass top & bottom heritage pinstripes
    ctx.fillStyle = '#d9b872';
    ctx.fillRect(0, 4, W, 5);
    ctx.fillRect(0, H - 9, W, 5);

    // Subtle brass rivets along edges
    ctx.fillStyle = 'rgba(12, 34, 24, 0.38)';
    for (let x = 22; x < W - 12; x += 56) {
      ctx.beginPath();
      ctx.arc(x, 15, 2.5, 0, Math.PI * 2);
      ctx.arc(x, H - 15, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const legend = '香 港 電 車   ·   120   ·   HONG KONG TRAMWAYS';
    ctx.fillStyle = '#f6e7c4';
    fitFontSize(ctx, legend, 700, 32, 16, HK_SERIF, W - 72);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(legend, W * 0.5, H * 0.52);
  });
}

/**
 * Heritage brass-bordered crimson fleet number plate (#120) for tram front/rear dash.
 * Canvas 128 × 64 (AR = 2.000) matching PlaneGeometry(0.32, 0.16) (AR = 2.000) 1:1!
 */
function createTramNumberPlateTexture(): THREE.CanvasTexture {
  return makeLocalTexture(128, 64, (ctx, W, H) => {
    ctx.fillStyle = '#8e2624';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#dfc078';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.fillStyle = '#fff3d4';
    fitFontSize(ctx, '120', 800, 34, 18, HK_SERIF, W - 24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('120', W * 0.5, H * 0.54);
  });
}

/**
 * Trackside Hong Kong railway signal identification plate (KT-14).
 * Canvas 128 × 64 (AR = 2.000) matching idPlate side faces (0.42 × 0.21, AR = 2.000) 1:1!
 */
function createSignalPlateTexture(): THREE.CanvasTexture {
  return makeLocalTexture(128, 64, (ctx, W, H) => {
    ctx.fillStyle = '#14191e';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e8edf2';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.fillStyle = '#f4f8fc';
    fitFontSize(ctx, 'KT-14', 800, 30, 16, HK_SANS, W - 22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KT-14', W * 0.5, H * 0.54);
  });
}

/**
 * Classic Hong Kong taxi illuminated windshield FOR HIRE / 有客 flag.
 * Canvas 148 × 80 (AR = 1.850) matching BoxGeometry(0.24, 0.13, 0.025) front/back (AR = 1.846) 1:1!
 */
function createTaxiFlagTexture(): THREE.CanvasTexture {
  return makeLocalTexture(148, 80, (ctx, W, H) => {
    ctx.fillStyle = '#d42c2c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ffdf92';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = '#fff5dc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFontSize(ctx, 'FOR HIRE', 900, 24, 12, HK_SANS, W - 20);
    ctx.fillText('FOR HIRE', W * 0.5, 28);
    ctx.fillStyle = '#ffe58c';
    fitFontSize(ctx, '有  客', 800, 24, 12, HK_SANS, W - 20);
    ctx.fillText('有  客', W * 0.5, 58);
  });
}

/**
 * Perforated grated steel deck texture for viaduct maintenance catwalk.
 */
function createCatwalkGrateTexture(): THREE.CanvasTexture {
  const tex = makeLocalTexture(128, 64, (ctx, W, H) => {
    ctx.fillStyle = '#334250';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1c2630';
    for (let y = 4; y < H; y += 8) {
      for (let x = 4; x < W; x += 12) {
        ctx.fillRect(x, y, 7, 4);
      }
    }
    ctx.strokeStyle = '#536678';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(34, 1);
  return tex;
}

/**
 * Classic Hong Kong blue square "P" roadside metered parking sign texture (泊車).
 * Canvas 130 × 160 (AR = 0.8125) matching BoxGeometry(0.52, 0.64, 0.05) (AR = 0.8125) 1:1!
 */
function createParkingSignTexture(): THREE.CanvasTexture {
  return makeLocalTexture(130, 160, (ctx, W, H) => {
    // Classic HK Transport Dept deep cobalt blue parking sign
    ctx.fillStyle = '#1b5da8';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#eef3f8';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    ctx.fillStyle = '#f5f8fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFontSize(ctx, 'P', 900, 84, 48, HK_SANS, W - 36);
    ctx.fillText('P', W * 0.5, 68);

    // Lower subtle bilingual metered-bay strip
    ctx.fillStyle = '#eef3f8';
    ctx.fillRect(14, 114, W - 28, 32);
    ctx.fillStyle = '#14447c';
    fitFontSize(ctx, '泊車 · TAXI', 800, 18, 10, HK_SANS, W - 36);
    ctx.fillText('泊車 · TAXI', W * 0.5, 131);
  });
}

/**
 * Rain-damp concrete/asphalt metered kerbside parking bay pad with crisp white stall markings.
 * Canvas 340 × 440 (AR = 0.7727) matching 3.4 × 4.4 parking pad (AR = 0.7727) 1:1!
 */
function createParkingPadTexture(): THREE.CanvasTexture {
  return makeLocalTexture(340, 440, (ctx, W, H) => {
    ctx.fillStyle = '#2d3844';
    ctx.fillRect(0, 0, W, H);

    // Subtle rain-damp aggregate speckle & tire-wear tracks
    for (let i = 0; i < 1200; i++) {
      const px = (i * 73) % W;
      const py = (i * 139 + Math.floor(i / 4) * 19) % H;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(180, 198, 214, 0.06)' : 'rgba(12, 18, 26, 0.14)';
      ctx.fillRect(px, py, 3, 3);
    }
    ctx.fillStyle = 'rgba(14, 20, 28, 0.20)';
    ctx.fillRect(W * 0.24, 44, 44, H - 88);
    ctx.fillRect(W * 0.64, 44, 44, H - 88);

    // Crisp weathered white painted parking stall boundary box
    ctx.strokeStyle = 'rgba(232, 238, 244, 0.78)';
    ctx.lineWidth = 9;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // Stenciled TAXI bay legend near south entry at true 1:1 proportions
    ctx.fillStyle = 'rgba(230, 236, 242, 0.54)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFontSize(ctx, '的 士 泊 位', 800, 34, 18, HK_SANS, W - 76);
    ctx.fillText('的 士 泊 位', W * 0.5, H - 56);
  });
}

export function createViaductAndVehicles(
  scene: THREE.Scene,
  mistUniforms: RadialMistUniforms
): ViaductAndVehiclesSystem {
  const group = new THREE.Group();
  group.name = 'ViaductAndVehiclesGroup';

  const emissiveTracks: Array<{ mat: THREE.MeshStandardMaterial; base: number }> = [];
  const spillMaterials: Array<{ mat: THREE.MeshBasicMaterial; baseOpacity: number }> = [];
  const softCones: Array<{ mat: THREE.ShaderMaterial; baseOpacity: number }> = [];
  const movingLights: Array<{ light: THREE.PointLight; baseIntensity: number }> = [];

  const shadowTex = createContactShadowTexture('rect');
  const glowTex = createGlowSpriteTexture();

  // =========================================================================
  // 1. DIAGONAL ELEVATED HK RAILWAY VIADUCT (z = -3.8, x in [-39, +39])
  // Smoothly mist-faded across R in [18.0, 27.0]
  // =========================================================================
  const viaductGroup = new THREE.Group();
  viaductGroup.name = 'ElevatedViaduct';

  const bridgeLen = 78.0;
  const bridgeZ = -3.8;
  const soffitY = 6.20;
  const deckTopY = 6.94;
  const railTopY = 7.12;

  const viaductFade = { innerR: 18.0, outerR: 27.0 };

  const viaductConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x627383,
    roughness: 0.86,
    metalness: 0.05
  });
  applyRadialMistFade(viaductConcreteMat, mistUniforms, viaductFade);

  const viaductTrimConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x728496,
    roughness: 0.82,
    metalness: 0.06
  });
  applyRadialMistFade(viaductTrimConcreteMat, mistUniforms, viaductFade);

  const bridgeSteelMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d5e,
    roughness: 0.56,
    metalness: 0.52
  });
  applyRadialMistFade(bridgeSteelMat, mistUniforms, viaductFade);

  const conduitMat = new THREE.MeshStandardMaterial({
    color: 0x4f6172,
    roughness: 0.52,
    metalness: 0.58
  });
  applyRadialMistFade(conduitMat, mistUniforms, viaductFade);

  const catwalkGrateMat = new THREE.MeshStandardMaterial({
    map: createCatwalkGrateTexture(),
    color: 0x7b8ea0,
    roughness: 0.62,
    metalness: 0.55
  });
  applyRadialMistFade(catwalkGrateMat, mistUniforms, viaductFade);

  const ballastMat = new THREE.MeshStandardMaterial({
    color: 0x38434e,
    roughness: 0.92,
    metalness: 0.06
  });
  applyRadialMistFade(ballastMat, mistUniforms, viaductFade);

  const sleeperMat = new THREE.MeshStandardMaterial({
    color: 0x4b423b,
    roughness: 0.88,
    metalness: 0.05
  });
  applyRadialMistFade(sleeperMat, mistUniforms, viaductFade);

  const railSteelMat = new THREE.MeshStandardMaterial({
    color: 0xa6b8ca,
    roughness: 0.22,
    metalness: 0.88
  });
  applyRadialMistFade(railSteelMat, mistUniforms, viaductFade);

  const ceramicInsulatorMat = new THREE.MeshStandardMaterial({
    color: 0xd9e1e6,
    roughness: 0.26,
    metalness: 0.14
  });
  applyRadialMistFade(ceramicInsulatorMat, mistUniforms, viaductFade);

  // Main concrete box deck slab + chamfered concrete drip-edge ledges along both soffit sides
  const deckSlab = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeLen, deckTopY - soffitY, 3.2),
    viaductConcreteMat
  );
  deckSlab.position.set(0, (soffitY + deckTopY) * 0.5, bridgeZ);
  deckSlab.castShadow = true;
  deckSlab.receiveShadow = true;
  viaductGroup.add(deckSlab);

  for (const side of [-1, 1]) {
    const dripEdge = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeLen, 0.12, 0.14),
      viaductTrimConcreteMat
    );
    dripEdge.position.set(0, soffitY + 0.04, bridgeZ + side * 1.62);
    viaductGroup.add(dripEdge);

    // Cable conduit troughs running cleanly along both outer girder webs
    const trough = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.14, 0.13), conduitMat);
    trough.position.set(0, soffitY + 0.36, bridgeZ + side * 1.79);
    viaductGroup.add(trough);

    const conduitPipe = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, bridgeLen, 6), bridgeSteelMat)
    );
    conduitPipe.rotation.z = Math.PI / 2;
    conduitPipe.position.set(0, soffitY + 0.50, bridgeZ + side * 1.77);
    viaductGroup.add(conduitPipe);
  }

  const ballast = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.12, 2.7), ballastMat);
  ballast.position.set(0, deckTopY + 0.05, bridgeZ);
  ballast.receiveShadow = true;
  viaductGroup.add(ballast);

  const girderZs = [bridgeZ - 1.64, bridgeZ + 1.64];
  for (const gz of girderZs) {
    const botChord = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.22, 0.22), bridgeSteelMat);
    botChord.position.set(0, soffitY + 0.08, gz);
    botChord.castShadow = true;
    viaductGroup.add(botChord);

    const topChord = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.18, 0.20), bridgeSteelMat);
    topChord.position.set(0, deckTopY + 0.58, gz);
    topChord.castShadow = true;
    viaductGroup.add(topChord);

    const midChord = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.10, 0.14), bridgeSteelMat);
    midChord.position.set(0, deckTopY + 0.16, gz);
    viaductGroup.add(midChord);
  }

  const trussSpan = 1.9;
  const trussCount = Math.floor(bridgeLen / trussSpan);
  const strutGeom = new THREE.BoxGeometry(0.11, 1.38, 0.14);
  const strutInst = new THREE.InstancedMesh(strutGeom, bridgeSteelMat, trussCount * 4);
  strutInst.castShadow = true;
  const dummy = new THREE.Object3D();
  let sIdx = 0;

  for (const gz of girderZs) {
    for (let i = 0; i < trussCount; i++) {
      const tx = -bridgeLen * 0.5 + (i + 0.5) * trussSpan;
      dummy.position.set(tx - trussSpan * 0.5, soffitY + 0.72, gz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      strutInst.setMatrixAt(sIdx++, dummy.matrix);

      dummy.position.set(tx, soffitY + 0.72, gz);
      dummy.rotation.set(0, 0, i % 2 === 0 ? 0.68 : -0.68);
      dummy.scale.set(0.85, 1.24, 0.85);
      dummy.updateMatrix();
      strutInst.setMatrixAt(sIdx++, dummy.matrix);
    }
  }
  strutInst.count = sIdx;
  strutInst.instanceMatrix.needsUpdate = true;
  viaductGroup.add(strutInst);

  // Side Maintenance Catwalk Walkway + Perforated Steel Safety Handrail along South Girder
  {
    const cwZ = bridgeZ + 2.04;
    const cwY = deckTopY + 0.08;
    const cwDeck = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.06, 0.56), catwalkGrateMat);
    cwDeck.position.set(0, cwY, cwZ);
    cwDeck.castShadow = true;
    cwDeck.receiveShadow = true;
    viaductGroup.add(cwDeck);

    // Outer toe-board kickplate
    const kickplate = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.12, 0.03), bridgeSteelMat);
    kickplate.position.set(0, cwY + 0.07, cwZ + 0.275);
    viaductGroup.add(kickplate);

    // Safety handrails (top & mid tubular bars)
    for (const ry of [cwY + 0.56, cwY + 1.00]) {
      const hRail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, bridgeLen, 6), bridgeSteelMat);
      hRail.rotation.z = Math.PI / 2;
      hRail.position.set(0, ry, cwZ + 0.27);
      viaductGroup.add(hRail);
    }

    // Cantilevered steel brackets + vertical handrail stanchions (InstancedMesh, skipPrintEdges)
    const cwSpan = 2.6;
    const cwCount = Math.floor(bridgeLen / cwSpan);
    const stanchionInst = markSkipPrintEdges(
      new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 1.04, 0.04), bridgeSteelMat, cwCount)
    );
    const bracketInst = markSkipPrintEdges(
      new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.68), bridgeSteelMat, cwCount)
    );
    const diagBracketInst = markSkipPrintEdges(
      new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.72), bridgeSteelMat, cwCount)
    );
    for (let i = 0; i < cwCount; i++) {
      const cx = -bridgeLen * 0.5 + (i + 0.5) * cwSpan;
      dummy.position.set(cx, cwY + 0.52, cwZ + 0.27);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stanchionInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(cx, cwY - 0.06, cwZ - 0.04);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bracketInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(cx, cwY - 0.26, cwZ - 0.08);
      dummy.rotation.set(-0.56, 0, 0);
      dummy.updateMatrix();
      diagBracketInst.setMatrixAt(i, dummy.matrix);
    }
    stanchionInst.instanceMatrix.needsUpdate = true;
    bracketInst.instanceMatrix.needsUpdate = true;
    diagBracketInst.instanceMatrix.needsUpdate = true;
    viaductGroup.add(stanchionInst, bracketInst, diagBracketInst);
  }

  // Sleepers + Steel Running Rails + Inner Safety Check Rails
  const sleeperSpacing = 0.56;
  const sleeperCount = Math.floor(bridgeLen / sleeperSpacing);
  const sleeperGeom = new THREE.BoxGeometry(0.18, 0.08, 2.05);
  const sleeperInst = new THREE.InstancedMesh(sleeperGeom, sleeperMat, sleeperCount);
  for (let i = 0; i < sleeperCount; i++) {
    const sx = -bridgeLen * 0.5 + i * sleeperSpacing;
    dummy.position.set(sx, deckTopY + 0.11, bridgeZ);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    sleeperInst.setMatrixAt(i, dummy.matrix);
  }
  sleeperInst.instanceMatrix.needsUpdate = true;
  viaductGroup.add(sleeperInst);

  for (const rOff of [-0.56, 0.56]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.08, 0.075), railSteelMat);
    rail.position.set(0, railTopY - 0.02, bridgeZ + rOff);
    viaductGroup.add(rail);

    const checkRail = markSkipPrintEdges(
      new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.065, 0.04), bridgeSteelMat)
    );
    checkRail.position.set(0, railTopY - 0.03, bridgeZ + rOff * 0.72);
    viaductGroup.add(checkRail);
  }

  // Concrete Viaduct Piers straddling wider road cleanly at x = ±6.5 and outer flanks ±16.8
  const pierXs = [-16.8, -6.5, 6.5, 16.8];
  const pierShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.56,
    depthWrite: false
  });
  for (const px of pierXs) {
    const capBeam = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.44, 3.44), viaductConcreteMat);
    capBeam.position.set(px, soffitY - 0.30, bridgeZ);
    capBeam.castShadow = true;
    capBeam.receiveShadow = true;
    viaductGroup.add(capBeam);

    // Chamfered top cap drip collar
    const capTrim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.10, 3.52), viaductTrimConcreteMat);
    capTrim.position.set(px, soffitY - 0.11, bridgeZ);
    viaductGroup.add(capTrim);

    // Elastomeric steel bearing pads supporting girders
    for (const bz of [-1.24, 1.24]) {
      const bearing = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.44), bridgeSteelMat)
      );
      bearing.position.set(px, soffitY - 0.04, bridgeZ + bz);
      viaductGroup.add(bearing);
    }

    for (const pzOff of [-1.18, 1.18]) {
      const colH = soffitY - 0.52 - 0.16;
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.62, colH, 0.62), viaductConcreteMat);
      col.position.set(px, 0.16 + colH * 0.5, bridgeZ + pzOff);
      col.castShadow = true;
      col.receiveShadow = true;
      viaductGroup.add(col);

      // Flared trapezoidal concrete pier corbel capital transitioning into cap beam
      const corbel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.43, 0.42, 4),
        viaductTrimConcreteMat
      );
      corbel.rotation.y = Math.PI * 0.25;
      corbel.position.set(px, soffitY - 0.72, bridgeZ + pzOff);
      viaductGroup.add(corbel);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.44, 0.78), viaductTrimConcreteMat);
      foot.position.set(px, 0.16 + 0.22, bridgeZ + pzOff);
      viaductGroup.add(foot);

      const ao = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), pierShadowMat);
      ao.rotation.x = -Math.PI / 2;
      ao.position.set(px, 0.174, bridgeZ + pzOff);
      ao.renderOrder = 3;
      viaductGroup.add(ao);
    }
  }

  // Overhead Railway Catenary Masts, Registration Arms, Ceramic Insulators & Vertical Dropper Wires
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x2a3744,
    transparent: true,
    opacity: 0.74
  });
  applyRadialMistFade(wireMat, mistUniforms, { innerR: 18.0, outerR: 27.0, fadeAlpha: true });

  const catMastXs = [-26, -15, -4, 7, 18, 28];
  const contactY = 9.95;
  const messengerY = 10.65;
  for (const mx of catMastXs) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.95, 0.14), bridgeSteelMat);
    mast.position.set(mx, deckTopY + 1.98, bridgeZ - 1.72);
    mast.castShadow = true;
    viaductGroup.add(mast);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.05), bridgeSteelMat);
    arm.position.set(mx, contactY + 0.42, bridgeZ - 0.72);
    viaductGroup.add(arm);

    // Diagonal upper tension stay rod + ceramic insulator
    const stay = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.92, 6), bridgeSteelMat)
    );
    stay.rotation.x = 1.24;
    stay.position.set(mx, messengerY - 0.10, bridgeZ - 0.85);
    viaductGroup.add(stay);

    const ins = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 8), ceramicInsulatorMat)
    );
    ins.rotation.x = Math.PI / 2;
    ins.position.set(mx, contactY + 0.42, bridgeZ - 1.46);
    viaductGroup.add(ins);

    const drop = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), bridgeSteelMat));
    drop.position.set(mx, contactY + 0.21, bridgeZ);
    viaductGroup.add(drop);
  }

  const contactPts = [new THREE.Vector3(-37, contactY, bridgeZ), new THREE.Vector3(37, contactY, bridgeZ)];
  viaductGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(contactPts), wireMat));

  // Sagging messenger curves + vertical catenary dropper wires every ~2.4 units (InstancedMesh)
  const dropperMatrices: THREE.Matrix4[] = [];
  for (let i = 0; i < catMastXs.length - 1; i++) {
    const x0 = catMastXs[i];
    const x1 = catMastXs[i + 1];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, messengerY, bridgeZ),
      new THREE.Vector3((x0 + x1) * 0.5, contactY + 0.22, bridgeZ),
      new THREE.Vector3(x1, messengerY, bridgeZ)
    ]);
    viaductGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(14)), wireMat));

    const spanLen = x1 - x0;
    const steps = Math.max(2, Math.floor(spanLen / 2.4));
    for (let k = 1; k < steps; k++) {
      const u = k / steps;
      const pt = curve.getPoint(u);
      const h = Math.max(0.08, pt.y - contactY);
      dummy.position.set(pt.x, contactY + h * 0.5, bridgeZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      dropperMatrices.push(dummy.matrix.clone());
    }
  }
  const dropperInst = markSkipPrintEdges(
    new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.011, 0.011, 1.0, 5),
      bridgeSteelMat,
      dropperMatrices.length
    )
  );
  dropperMatrices.forEach((m, idx) => dropperInst.setMatrixAt(idx, m));
  dropperInst.instanceMatrix.needsUpdate = true;
  viaductGroup.add(dropperInst);

  // Glowing Trackside Hong Kong Railway Signal Post (hooded dark steel head with emerald-green & red lamps!)
  {
    const sigGroup = new THREE.Group();
    sigGroup.name = 'HK_RailwaySignalPost';
    sigGroup.position.set(10.2, deckTopY + 0.08, bridgeZ + 2.02);

    const sigDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1c242c,
      roughness: 0.46,
      metalness: 0.62
    });
    applyRadialMistFade(sigDarkMat, mistUniforms, viaductFade);

    const sigGreenMat = new THREE.MeshStandardMaterial({
      color: 0x52ffa8,
      emissive: new THREE.Color(0x18f07c),
      emissiveIntensity: 2.6,
      roughness: 0.14
    });
    applyRadialMistFade(sigGreenMat, mistUniforms, viaductFade);
    emissiveTracks.push({ mat: sigGreenMat, base: 2.6 });

    const sigRedDimMat = new THREE.MeshStandardMaterial({
      color: 0x58181c,
      emissive: new THREE.Color(0x981a1e),
      emissiveIntensity: 0.35,
      roughness: 0.25
    });
    applyRadialMistFade(sigRedDimMat, mistUniforms, viaductFade);
    emissiveTracks.push({ mat: sigRedDimMat, base: 0.35 });

    const sigPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.072, 2.85, 10), sigDarkMat);
    sigPost.position.y = 1.425;
    sigPost.castShadow = true;
    sigGroup.add(sigPost);

    // Maintenance access ladder behind signal mast
    const ladderGroup = markSkipPrintEdges(new THREE.Group());
    for (const lz of [-0.08, 0.08]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.35, 5), sigDarkMat);
      rail.position.set(0.11, 1.18, lz);
      ladderGroup.add(rail);
    }
    for (let r = 0; r < 8; r++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.18, 5), sigDarkMat);
      rung.rotation.x = Math.PI / 2;
      rung.position.set(0.11, 0.26 + r * 0.28, 0);
      ladderGroup.add(rung);
    }
    sigGroup.add(ladderGroup);

    // Signal ID plate KT-14 (+X/-X wide faces 0.42 × 0.21, AR = 2.000 exact match, dark steel thin edges!)
    const plateMat = new THREE.MeshStandardMaterial({
      map: createSignalPlateTexture(),
      roughness: 0.45
    });
    applyRadialMistFade(plateMat, mistUniforms, viaductFade);
    const idPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.21, 0.42),
      [plateMat, plateMat, sigDarkMat, sigDarkMat, sigDarkMat, sigDarkMat]
    );
    idPlate.position.set(-0.07, 1.48, 0);
    sigGroup.add(idPlate);

    // Hooded dark-steel 2-aspect signal head facing -X (approaching train) with slight angle toward camera
    const head = new THREE.Group();
    head.position.set(-0.06, 2.52, -0.02);
    head.rotation.y = -0.22;

    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.34), sigDarkMat);
    headBox.castShadow = true;
    head.add(headBox);

    // Rounded top & bottom caps on signal head
    for (const cy of [-0.39, 0.39]) {
      const cap = markSkipPrintEdges(
        new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.24, 12), sigDarkMat)
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.y = cy;
      head.add(cap);
    }

    // Upper red aspect + lower luminous emerald-green aspect + deep cylindrical hoods
    const aspects: Array<{ y: number; mat: THREE.MeshStandardMaterial; active: boolean }> = [
      { y: 0.18, mat: sigRedDimMat, active: false },
      { y: -0.18, mat: sigGreenMat, active: true }
    ];
    for (const asp of aspects) {
      const lens = markSkipPrintEdges(
        new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.06, 12), asp.mat)
      );
      lens.rotation.z = Math.PI / 2;
      lens.position.set(-0.12, asp.y, 0);
      head.add(lens);

      const hood = markSkipPrintEdges(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.125, 0.125, 0.22, 12, 1, true, 0.12, Math.PI - 0.24),
          sigDarkMat
        )
      );
      hood.rotation.z = Math.PI / 2;
      hood.position.set(-0.21, asp.y, 0);
      head.add(hood);
    }

    // Soft emerald signal mist bloom sprite right in front of green aspect
    const sigGlowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0x3cff9a,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    spillMaterials.push({ mat: sigGlowMat, baseOpacity: 0.52 });
    const sigGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), sigGlowMat);
    sigGlow.position.set(-0.20, -0.18, 0.04);
    sigGlow.rotation.y = -Math.PI * 0.32;
    sigGlow.renderOrder = 6;
    head.add(sigGlow);

    sigGroup.add(head);
    viaductGroup.add(sigGroup);
  }

  group.add(viaductGroup);

  // =========================================================================
  // 2. ANIMATED 2-CAR RETRO HK METRO-CAMMELL ELEVATED TRAIN (z = -3.8, y = 7.12)
  // Sculpted beveled-roof profile, stainless side flutes, 3D sliding doors,
  // angled cab windshield + wipers, amber LED destination & diamond pantograph!
  // =========================================================================
  const vehicleFade = { innerR: 18.0, outerR: 27.0 };

  const trainGroup = new THREE.Group();
  trainGroup.name = 'HK_MetroCammell_Train';

  const trainLedTex = createTrainLedDestTexture();
  const trainWideWinTex = createMetroWindowTexture(false);
  const trainDoorWinTex = createMetroWindowTexture(true);

  const trainShellMat = new THREE.MeshStandardMaterial({
    color: 0xb8c4d0,
    roughness: 0.36,
    metalness: 0.42
  });
  applyRadialMistFade(trainShellMat, mistUniforms, vehicleFade);

  const trainRoofMat = new THREE.MeshStandardMaterial({
    color: 0x5c6a78,
    roughness: 0.54,
    metalness: 0.36
  });
  applyRadialMistFade(trainRoofMat, mistUniforms, vehicleFade);

  const trainCrimsonMat = new THREE.MeshStandardMaterial({
    color: 0xa62c2c,
    roughness: 0.38,
    metalness: 0.24
  });
  applyRadialMistFade(trainCrimsonMat, mistUniforms, vehicleFade);

  const trainCreamStripeMat = new THREE.MeshStandardMaterial({
    color: 0xeee5d4,
    roughness: 0.44,
    metalness: 0.12
  });
  applyRadialMistFade(trainCreamStripeMat, mistUniforms, vehicleFade);

  const trainSilverMat = new THREE.MeshStandardMaterial({
    color: 0xcad4de,
    roughness: 0.28,
    metalness: 0.62
  });
  applyRadialMistFade(trainSilverMat, mistUniforms, vehicleFade);

  const trainFluteMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4ed,
    roughness: 0.24,
    metalness: 0.72
  });
  applyRadialMistFade(trainFluteMat, mistUniforms, vehicleFade);

  const trainWideWinMat = new THREE.MeshStandardMaterial({
    map: trainWideWinTex.map,
    emissive: new THREE.Color(0xffbe5c),
    emissiveMap: trainWideWinTex.emissiveMap,
    emissiveIntensity: 1.42,
    roughness: 0.18,
    metalness: 0.16
  });
  applyRadialMistFade(trainWideWinMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: trainWideWinMat, base: 1.42 });

  const trainDoorWinMat = new THREE.MeshStandardMaterial({
    map: trainDoorWinTex.map,
    emissive: new THREE.Color(0xffba56),
    emissiveMap: trainDoorWinTex.emissiveMap,
    emissiveIntensity: 1.32,
    roughness: 0.18,
    metalness: 0.16
  });
  applyRadialMistFade(trainDoorWinMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: trainDoorWinMat, base: 1.32 });

  const trainUnderMat = new THREE.MeshStandardMaterial({
    color: 0x20272f,
    roughness: 0.76,
    metalness: 0.42
  });
  applyRadialMistFade(trainUnderMat, mistUniforms, vehicleFade);

  const trainRubberMat = new THREE.MeshStandardMaterial({
    color: 0x161b20,
    roughness: 0.88,
    metalness: 0.08
  });
  applyRadialMistFade(trainRubberMat, mistUniforms, vehicleFade);

  const trainHeadMat = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: new THREE.Color(0xffdfa0),
    emissiveIntensity: 2.25,
    roughness: 0.14
  });
  applyRadialMistFade(trainHeadMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: trainHeadMat, base: 2.25 });

  const trainTailMat = new THREE.MeshStandardMaterial({
    color: 0xff3b3b,
    emissive: new THREE.Color(0xff2828),
    emissiveIntensity: 1.95,
    roughness: 0.18
  });
  applyRadialMistFade(trainTailMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: trainTailMat, base: 1.95 });

  const trainLedMat = new THREE.MeshStandardMaterial({
    map: trainLedTex,
    emissive: new THREE.Color(0xffb844),
    emissiveMap: trainLedTex,
    emissiveIntensity: 1.75,
    roughness: 0.24
  });
  applyRadialMistFade(trainLedMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: trainLedMat, base: 1.75 });

  const cabWindshieldMat = new THREE.MeshStandardMaterial({
    color: 0x223344,
    emissive: new THREE.Color(0xdda052),
    emissiveIntensity: 0.48,
    roughness: 0.14,
    metalness: 0.42
  });
  applyRadialMistFade(cabWindshieldMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: cabWindshieldMat, base: 0.48 });

  const trainInsulatorMat = new THREE.MeshStandardMaterial({
    color: 0xdfe6ec,
    roughness: 0.25,
    metalness: 0.12
  });
  applyRadialMistFade(trainInsulatorMat, mistUniforms, vehicleFade);

  // Beveled-roof EMU cross-section geometry (profile in ZY extruded along X)
  const carLen = 5.66;
  const carW = 1.86;
  const halfW = carW * 0.5;
  // ExtrudeGeometry bevelSize = 0.025 extends outer side wall to halfW + 0.025!
  const shellBevel = 0.025;
  const outerZ = halfW + shellBevel;

  const emuShape = new THREE.Shape();
  emuShape.moveTo(-halfW + 0.06, 0.34);
  emuShape.lineTo(halfW - 0.06, 0.34);
  emuShape.lineTo(halfW, 0.56);
  emuShape.lineTo(halfW, 2.08);
  emuShape.lineTo(halfW - 0.16, 2.30);
  emuShape.quadraticCurveTo(0, 2.44, -halfW + 0.16, 2.30);
  emuShape.lineTo(-halfW, 2.08);
  emuShape.lineTo(-halfW, 0.56);
  emuShape.closePath();

  const emuShellGeom = new THREE.ExtrudeGeometry(emuShape, {
    depth: carLen,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: shellBevel,
    bevelSegments: 2,
    curveSegments: 10
  });
  // Rotate so extrusion axis runs along X and center along X
  emuShellGeom.rotateY(Math.PI / 2);
  emuShellGeom.translate(-carLen * 0.5, 0, 0);

  const buildMetroCar = (xOffset: number, isFront: boolean) => {
    const car = new THREE.Group();
    car.position.set(xOffset, railTopY, 0);
    const noseDir = isFront ? 1 : -1;

    // 1. Sculpted beveled-roof brushed silver-aluminum EMU shell + slate roof crown cap
    const shell = new THREE.Mesh(emuShellGeom, trainShellMat);
    shell.castShadow = true;
    shell.receiveShadow = true;
    car.add(shell);

    const roofCrownCap = new THREE.Mesh(
      new THREE.BoxGeometry(carLen - 0.08, 0.05, carW - 0.46),
      trainRoofMat
    );
    roofCrownCap.position.y = 2.39;
    car.add(roofCrownCap);

    // 2. Real 3D Recessed Glowing Warm Amber Passenger Windows, Recessed Sliding Doors,
    // Crimson Roof/Waist Stripes & 3D Stainless Flutes cleanly OUTSIDE outerZ (zero shell clipping!)
    const innerLen = carLen - 0.32;
    const secW = innerLen / 6;

    for (const side of [-1, 1]) {
      const sz = side * outerZ;

      // Vivid Hong Kong Metro crimson upper cantrail roof stripe & lower waist stripe + cream pinstripe
      const cantrail = new THREE.Mesh(new THREE.BoxGeometry(carLen - 0.02, 0.21, 0.045), trainCrimsonMat);
      cantrail.position.set(0, 2.04, sz + side * 0.004);
      car.add(cantrail);

      const lowerCrimson = new THREE.Mesh(new THREE.BoxGeometry(carLen - 0.04, 0.25, 0.032), trainCrimsonMat);
      lowerCrimson.position.set(0, 0.72, sz + side * 0.008);
      car.add(lowerCrimson);

      const creamLine = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(carLen - 0.04, 0.045, 0.034), trainCreamStripeMat)
      );
      creamLine.position.set(0, 0.87, sz + side * 0.009);
      car.add(creamLine);

      // 3D protruding stainless-steel horizontal side flutes/ribs along lower body skirt
      for (const fy of [0.58, 0.67, 0.76]) {
        const flute = markSkipPrintEdges(
          new THREE.Mesh(new THREE.BoxGeometry(carLen - 0.14, 0.024, 0.022), trainFluteMat)
        );
        flute.position.set(0, fy, sz + side * 0.022);
        car.add(flute);
      }

      // 6 Architectural Bays along each side: 4 wide glowing passenger windows + 2 twin sliding door pairs
      for (let sec = 0; sec < 6; sec++) {
        const bx = -innerLen * 0.5 + (sec + 0.5) * secW;
        const isDoor = sec === 1 || sec === 4;

        if (isDoor) {
          const doorW = secW - 0.10;
          const doorGroup = new THREE.Group();
          doorGroup.position.set(bx, 1.30, sz + side * 0.012);

          // Brushed stainless sliding door surround stiles + header + lower recessed step
          const doorMicro = markSkipPrintEdges(new THREE.Group());
          for (const sx of [-doorW * 0.5, doorW * 0.5]) {
            const stile = new THREE.Mesh(new THREE.BoxGeometry(0.042, 1.44, 0.032), trainSilverMat);
            stile.position.x = sx;
            doorMicro.add(stile);
          }
          const topFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.04, 0.04, 0.032), trainSilverMat);
          topFrame.position.y = 0.72;
          doorMicro.add(topFrame);

          // Central vertical black rubber sliding-door meeting seal
          const rubberSeal = new THREE.Mesh(new THREE.BoxGeometry(0.042, 1.42, 0.038), trainRubberMat);
          doorMicro.add(rubberSeal);

          const stepPlate = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.04, 0.055), trainSilverMat);
          stepPlate.position.set(0, -0.72, side * 0.015);
          doorMicro.add(stepPlate);

          // Twin glowing warm amber upper glass panes inside the sliding door leaves!
          for (const dxOff of [-doorW * 0.24, doorW * 0.24]) {
            const bezel = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.38, 0.68, 0.026), trainRubberMat);
            bezel.position.set(dxOff, 0.16, side * 0.008);
            doorMicro.add(bezel);

            const dGlass = new THREE.Mesh(
              new THREE.PlaneGeometry(doorW * 0.32, 0.61),
              trainDoorWinMat
            );
            dGlass.position.set(dxOff, 0.16, side * 0.023);
            if (side === -1) dGlass.rotation.y = Math.PI;
            doorMicro.add(dGlass);
          }

          doorGroup.add(doorMicro);
          car.add(doorGroup);
        } else {
          // Real 3D recessed glowing warm amber wide passenger window bay!
          const winW = secW - 0.12;
          const winH = 0.78;
          const winY = 1.46;

          const bezel = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.06, winH + 0.06, 0.034), trainRubberMat);
          bezel.position.set(bx, winY, sz + side * 0.010);
          car.add(bezel);

          const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), trainWideWinMat);
          glass.position.set(bx, winY, sz + side * 0.029);
          if (side === -1) glass.rotation.y = Math.PI;
          car.add(glass);

          // Crisp horizontal silver upper hopper window sash rail
          const sashRail = markSkipPrintEdges(
            new THREE.Mesh(new THREE.BoxGeometry(winW + 0.02, 0.028, 0.022), trainSilverMat)
          );
          sashRail.position.set(bx, winY + winH * 0.20, sz + side * 0.032);
          car.add(sashRail);
        }
      }
    }

    // 3. Detailed Under-Chassis Bogies (2 per car) + Air-Brake Tanks + Traction Resistor Boxes
    for (const bx of [-1.78, 1.78]) {
      const bogie = new THREE.Group();
      bogie.position.set(bx, 0, 0);

      const bolster = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.20, 1.38), trainUnderMat);
      bolster.position.y = 0.24;
      bogie.add(bolster);

      const bogieMicro = markSkipPrintEdges(new THREE.Group());
      for (const side of [-1, 1]) {
        const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.14, 0.10), trainUnderMat);
        sideFrame.position.set(0, 0.21, side * 0.72);
        bogieMicro.add(sideFrame);

        // Primary axle boxes & coil springs
        for (const ax of [-0.50, 0.50]) {
          const axleBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.14), trainUnderMat);
          axleBox.position.set(ax, 0.19, side * 0.76);
          bogieMicro.add(axleBox);

          const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 8), trainSilverMat);
          spring.position.set(ax * 0.56, 0.26, side * 0.73);
          bogieMicro.add(spring);

          // Flanged steel wheel seated on railTopY (y = 0 in car space!)
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.075, 12), railSteelMat);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(ax, 0.19, side * 0.56);
          bogieMicro.add(wheel);
        }
      }
      bogie.add(bogieMicro);
      car.add(bogie);
    }

    // Under-belly air-brake reservoir tanks & traction resistor grille boxes between bogies
    const underEquip = markSkipPrintEdges(new THREE.Group());
    const resistorBox = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.26, 1.18), trainUnderMat);
    resistorBox.position.set(-0.22, 0.24, 0);
    underEquip.add(resistorBox);

    for (const tz of [-0.46, 0.46]) {
      const airTank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.82, 10), trainUnderMat);
      airTank.rotation.z = Math.PI / 2;
      airTank.position.set(0.68, 0.22, tz);
      underEquip.add(airTank);
    }
    car.add(underEquip);

    // 4. Rooftop Twin Beveled AC Pods with Recessed Circular Fan Grilles
    for (const ax of [-1.42, 1.32]) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.20, 1.16), trainSilverMat);
      ac.position.set(ax, 2.42, 0);
      ac.castShadow = true;
      car.add(ac);

      const acCap = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 1.04), trainRoofMat);
      acCap.position.set(ax, 2.53, 0);
      car.add(acCap);

      // Twin recessed circular AC cooling fan grilles
      for (const fx of [-0.30, 0.30]) {
        const fanRing = markSkipPrintEdges(
          new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), trainUnderMat)
        );
        fanRing.position.set(ax + fx, 2.555, 0);
        car.add(fanRing);

        const fanHub = markSkipPrintEdges(
          new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), trainSilverMat)
        );
        fanHub.position.set(ax + fx, 2.56, 0);
        car.add(fanHub);
      }
    }

    // 5. Crisp 3D Diamond Pantograph on Ribbed Ceramic Insulators (Rear Car)
    if (!isFront) {
      const pantoGroup = new THREE.Group();
      const pantoBaseY = 2.40;
      const wireRelY = contactY - railTopY; // 2.83
      const pantoH = wireRelY - pantoBaseY; // ~0.43

      // Base steel cradle frame + 4 ribbed ceramic insulators
      const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.86), trainUnderMat);
      baseFrame.position.set(0, pantoBaseY + 0.06, 0);
      pantoGroup.add(baseFrame);

      const pantoDetail = markSkipPrintEdges(new THREE.Group());
      for (const ix of [-0.30, 0.30]) {
        for (const iz of [-0.34, 0.34]) {
          const ins = new THREE.Mesh(
            new THREE.CylinderGeometry(0.038, 0.048, 0.09, 8),
            trainInsulatorMat
          );
          ins.position.set(ix, pantoBaseY + 0.02, iz);
          pantoDetail.add(ins);
        }
      }

      // True open 3D Diamond (Rhombus) scissor frame spanning pantoBaseY+0.09 -> wireRelY-0.02
      const midY = pantoBaseY + 0.08 + (pantoH - 0.10) * 0.5;
      const spreadX = 0.42;
      const strutLen = Math.hypot(spreadX, (pantoH - 0.10) * 0.5);
      const tilt = Math.atan2(spreadX, (pantoH - 0.10) * 0.5);

      for (const pz of [-0.24, 0.24]) {
        // Lower-left & lower-right diverging arms
        const lowL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, strutLen, 6), trainCrimsonMat);
        lowL.position.set(-spreadX * 0.5, (pantoBaseY + 0.08 + midY) * 0.5, pz);
        lowL.rotation.z = tilt;
        pantoDetail.add(lowL);

        const lowR = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, strutLen, 6), trainCrimsonMat);
        lowR.position.set(spreadX * 0.5, (pantoBaseY + 0.08 + midY) * 0.5, pz);
        lowR.rotation.z = -tilt;
        pantoDetail.add(lowR);

        // Upper-left & upper-right converging arms
        const upL = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, strutLen, 6), trainCrimsonMat);
        upL.position.set(-spreadX * 0.5, (midY + wireRelY - 0.02) * 0.5, pz);
        upL.rotation.z = -tilt;
        pantoDetail.add(upL);

        const upR = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, strutLen, 6), trainCrimsonMat);
        upR.position.set(spreadX * 0.5, (midY + wireRelY - 0.02) * 0.5, pz);
        upR.rotation.z = tilt;
        pantoDetail.add(upR);
      }

      // Elbow tie rods
      for (const ex of [-spreadX, spreadX]) {
        const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 6), trainSilverMat);
        tie.rotation.x = Math.PI / 2;
        tie.position.set(ex, midY, 0);
        pantoDetail.add(tie);
      }

      // Twin carbon collector contact strips with curved end ski horns riding on wireRelY
      for (const sx of [-0.055, 0.055]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 1.06), trainSilverMat);
        strip.position.set(sx, wireRelY - 0.018, 0);
        pantoDetail.add(strip);
      }
      for (const sz of [-0.56, 0.56]) {
        const horn = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.14), trainSilverMat);
        horn.position.set(0, wireRelY - 0.055, sz);
        horn.rotation.x = sz > 0 ? 0.52 : -0.52;
        pantoDetail.add(horn);
      }

      pantoGroup.add(pantoDetail);
      car.add(pantoGroup);
    }

    // 6. Sculpted Crimson Front/Rear Cab Nose, Angled Windshield, Wipers & Glowing LED Destination Board
    const noseX = noseDir * (carLen * 0.5);
    const noseFace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.88, carW - 0.08), trainCrimsonMat);
    noseFace.position.set(noseX + noseDir * 0.03, 1.32, 0);
    car.add(noseFace);

    // Recessed angled front cab windshield frame & tilted glass panes
    const windBezel = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.78, 1.54), trainRubberMat);
    windBezel.position.set(noseX + noseDir * 0.08, 1.54, 0);
    windBezel.rotation.z = noseDir * 0.09;
    car.add(windBezel);

    for (const wz of [-0.36, 0.36]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.64, 0.64), cabWindshieldMat);
      pane.position.set(noseX + noseDir * 0.115, 1.54, wz);
      pane.rotation.z = noseDir * 0.09;
      car.add(pane);

      // Miniature windshield wiper blade
      const wiper = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.022), trainRubberMat)
      );
      wiper.position.set(noseX + noseDir * 0.155, 1.44, wz + 0.08);
      wiper.rotation.set(0.28, 0, noseDir * 0.09);
      car.add(wiper);
    }

    // Glowing Amber LED Cab Destination Board (觀塘 KWUN TONG) above windshield!
    const ledHousing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 1.06), trainUnderMat);
    ledHousing.position.set(noseX + noseDir * 0.08, 2.08, 0);
    car.add(ledHousing);

    const ledFace = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.19), trainLedMat);
    ledFace.position.set(noseX + noseDir * 0.145, 2.08, 0);
    ledFace.rotation.y = isFront ? Math.PI / 2 : -Math.PI / 2;
    car.add(ledFace);

    // Anti-climber ribbed silver bumper & automatic Scharfenberg coupler
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.20, carW - 0.12), trainSilverMat);
    bumper.position.set(noseX + noseDir * 0.10, 0.50, 0);
    car.add(bumper);

    const autoCoupler = markSkipPrintEdges(
      new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.26), trainUnderMat)
    );
    autoCoupler.position.set(noseX + noseDir * 0.22, 0.34, 0);
    car.add(autoCoupler);

    if (isFront) {
      for (const hz of [-0.52, 0.52]) {
        const bezel = markSkipPrintEdges(
          new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12), trainSilverMat)
        );
        bezel.rotation.z = Math.PI / 2;
        bezel.position.set(noseX + 0.09, 0.86, hz);
        car.add(bezel);

        const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.09, 10), trainHeadMat);
        hl.rotation.z = Math.PI / 2;
        hl.position.set(noseX + 0.105, 0.86, hz);
        car.add(hl);

        // Ultra-soft Fresnel+axial volumetric headlight mist beam (ZERO hard rim!)
        const coneMat = createSoftLightConeMaterial(0xffdc92, 0.068);
        softCones.push({ mat: coneMat, baseOpacity: 0.068 });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.95, 5.8, 24, 1, true), coneMat);
        cone.rotation.z = Math.PI / 2 + 0.12;
        cone.position.set(noseX + 2.9, 0.52, hz * 0.75);
        cone.renderOrder = 6;
        car.add(cone);
      }

      // Soft elongated warm track-surface headlight sheen sweeping over wet rails
      const trackSpillMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        color: 0xffd27c,
        transparent: true,
        opacity: 0.74,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      spillMaterials.push({ mat: trackSpillMat, baseOpacity: 0.74 });
      const trackSpill = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 2.35), trackSpillMat);
      trackSpill.rotation.x = -Math.PI / 2;
      trackSpill.position.set(noseX + 4.05, 0.09, 0);
      trackSpill.renderOrder = 5;
      car.add(trackSpill);

      const innerSpillMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        color: 0xffe8b0,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      spillMaterials.push({ mat: innerSpillMat, baseOpacity: 0.58 });
      const innerSpill = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.5), innerSpillMat);
      innerSpill.rotation.x = -Math.PI / 2;
      innerSpill.position.set(noseX + 1.95, 0.10, 0);
      innerSpill.renderOrder = 5;
      car.add(innerSpill);
    } else {
      for (const hz of [-0.54, 0.54]) {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.24), trainTailMat);
        tl.position.set(noseX - 0.10, 0.84, hz);
        car.add(tl);
      }
    }

    return car;
  };

  trainGroup.add(buildMetroCar(3.04, true));
  trainGroup.add(buildMetroCar(-3.04, false));

  // Corrugated Inter-Car Accordion Gangway Bellows
  {
    const gangway = new THREE.Group();
    gangway.position.set(0, railTopY + 1.24, 0);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.72, 1.36), trainUnderMat);
    gangway.add(core);
    for (let i = -2; i <= 2; i++) {
      const rib = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.78, 1.44), trainRubberMat)
      );
      rib.position.x = i * 0.09;
      gangway.add(rib);
    }
    trainGroup.add(gangway);
  }

  trainGroup.position.set(2.2, 0, bridgeZ);
  group.add(trainGroup);

  // =========================================================================
  // 3. OVERHEAD COPPER TRAM TROLLEY WIRES (x = ±1.85, y = 5.30) & VINTAGE GREEN HK POLES (x = ±5.55)
  // =========================================================================
  const trolleyY = 5.30;
  const trolleyWireMat = new THREE.LineBasicMaterial({
    color: 0x3b4844,
    transparent: true,
    opacity: 0.64
  });
  applyRadialMistFade(trolleyWireMat, mistUniforms, { innerR: 17.5, outerR: 26.5, fadeAlpha: true });

  for (const tx of [-1.85, 1.85]) {
    const pts = [new THREE.Vector3(tx, trolleyY, -36), new THREE.Vector3(tx, trolleyY, 36)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), trolleyWireMat));
  }

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x265442,
    roughness: 0.48,
    metalness: 0.55
  });
  applyRadialMistFade(poleMat, mistUniforms, { innerR: 18.0, outerR: 27.0 });

  const poleZs = [-13.5, 4.8, 13.8];
  for (const pz of poleZs) {
    for (const side of [-1, 1]) {
      const px = side * 5.55;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 5.55, 10), poleMat);
      pole.position.set(px, 0.16 + 2.775, pz);
      pole.castShadow = true;
      group.add(pole);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.145, 0.92, 10), poleMat);
      base.position.set(px, 0.16 + 0.46, pz);
      group.add(base);

      // Decorative cast-iron pole collar & finial ball
      const collar = markSkipPrintEdges(
        new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.022, 6, 12), poleMat)
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.set(px, 0.16 + 0.92, pz);
      group.add(collar);

      const finial = markSkipPrintEdges(new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), poleMat));
      finial.position.set(px, 0.16 + 5.58, pz);
      group.add(finial);
    }
    const spanCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.55, trolleyY + 0.25, pz),
      new THREE.Vector3(0, trolleyY + 0.02, pz),
      new THREE.Vector3(5.55, trolleyY + 0.25, pz)
    ]);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(spanCurve.getPoints(10)), trolleyWireMat));
  }

  // =========================================================================
  // 4. HERO DOUBLE-DECKER HONG KONG TRAM (叮叮車 #120) on x = -1.85, heading +Z!
  // True multi-part scale-model coach: chamfered emerald waist, real 3D recessed
  // window bays over glowing 3D interior cabin (benches, brass poles, staircase,
  // 3D seated passengers), vaulted barrel-arch roof, cowcatcher fender, detailed
  // Brill 21E bogie truck, and brass bow pantograph riding y = 5.30 trolley wire!
  // =========================================================================
  const tramGroup = new THREE.Group();
  tramGroup.name = 'HK_DoubleDecker_Tram_120';

  const tramBillboardTex = createTramBillboardTexture();
  const tramDestTex = createTramDestinationTexture();
  const tramWaistTex = createTramWaistPlaqueTexture();
  const tramNumTex = createTramNumberPlateTexture();

  const tramEmeraldMat = new THREE.MeshStandardMaterial({
    color: 0x1b5a41,
    roughness: 0.32,
    metalness: 0.24
  });
  applyRadialMistFade(tramEmeraldMat, mistUniforms, vehicleFade);

  const tramDarkGreenMat = new THREE.MeshStandardMaterial({
    color: 0x123e2d,
    roughness: 0.42,
    metalness: 0.22
  });
  applyRadialMistFade(tramDarkGreenMat, mistUniforms, vehicleFade);

  const tramCreamMat = new THREE.MeshStandardMaterial({
    color: 0xf0e4c8,
    roughness: 0.44,
    metalness: 0.08
  });
  applyRadialMistFade(tramCreamMat, mistUniforms, vehicleFade);

  const tramTeakMat = new THREE.MeshStandardMaterial({
    color: 0x4f301b,
    roughness: 0.62,
    metalness: 0.06
  });
  applyRadialMistFade(tramTeakMat, mistUniforms, vehicleFade);

  const tramBenchWoodMat = new THREE.MeshStandardMaterial({
    color: 0x9b6232,
    emissive: new THREE.Color(0x6e3a12),
    emissiveIntensity: 0.36,
    roughness: 0.66,
    metalness: 0.04
  });
  applyRadialMistFade(tramBenchWoodMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: tramBenchWoodMat, base: 0.36 });

  const tramRoofMat = new THREE.MeshStandardMaterial({
    color: 0x5d564c,
    roughness: 0.72,
    metalness: 0.14
  });
  applyRadialMistFade(tramRoofMat, mistUniforms, vehicleFade);

  const tramBrassMat = new THREE.MeshStandardMaterial({
    color: 0xd6b064,
    roughness: 0.28,
    metalness: 0.82
  });
  applyRadialMistFade(tramBrassMat, mistUniforms, vehicleFade);

  const tramWaistPlaqueMat = new THREE.MeshStandardMaterial({
    map: tramWaistTex,
    roughness: 0.36,
    metalness: 0.22
  });
  applyRadialMistFade(tramWaistPlaqueMat, mistUniforms, vehicleFade);

  const tramNumPlateMat = new THREE.MeshStandardMaterial({
    map: tramNumTex,
    roughness: 0.34,
    metalness: 0.28
  });
  applyRadialMistFade(tramNumPlateMat, mistUniforms, vehicleFade);

  // Warm illuminated interior surfaces (makes the 3D cabin glow jewel-like from within!)
  const tramCabinWarmWallMat = new THREE.MeshStandardMaterial({
    color: 0xf0d29c,
    emissive: new THREE.Color(0xffb44c),
    emissiveIntensity: 1.15,
    roughness: 0.70
  });
  applyRadialMistFade(tramCabinWarmWallMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: tramCabinWarmWallMat, base: 1.15 });

  const tramCeilingStripMat = new THREE.MeshStandardMaterial({
    color: 0xfff4d6,
    emissive: new THREE.Color(0xffcd6e),
    emissiveIntensity: 2.15,
    roughness: 0.2
  });
  applyRadialMistFade(tramCeilingStripMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: tramCeilingStripMat, base: 2.15 });

  // Translucent rain-misted amber cabin glass (lets 3D interior benches, brass poles & passengers show through!)
  const tramWindowGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffd286,
    emissive: new THREE.Color(0xffa93e),
    emissiveIntensity: 0.76,
    transparent: true,
    opacity: 0.42,
    roughness: 0.14,
    metalness: 0.22,
    depthWrite: false
  });
  applyRadialMistFade(tramWindowGlassMat, mistUniforms, { ...vehicleFade, fadeAlpha: true });
  emissiveTracks.push({ mat: tramWindowGlassMat, base: 0.76 });

  const tramPaxCoatMats = [0x2a3542, 0x3b2c2a, 0x263834, 0x45382e].map((hex) => {
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.82 });
    applyRadialMistFade(m, mistUniforms, vehicleFade);
    return m;
  });
  const tramPaxSkinMat = new THREE.MeshStandardMaterial({ color: 0xdab492, roughness: 0.74 });
  applyRadialMistFade(tramPaxSkinMat, mistUniforms, vehicleFade);

  const tramW = 1.54;
  const tramL = 5.56;
  const halfTW = tramW * 0.5;
  const halfTL = tramL * 0.5;

  // Ground contact AO shadow
  const tramAO = new THREE.Mesh(
    new THREE.PlaneGeometry(tramW + 0.9, tramL + 0.9),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.68,
      depthWrite: false
    })
  );
  tramAO.rotation.x = -Math.PI / 2;
  tramAO.position.set(0, 0.038, 0);
  tramAO.renderOrder = 3;
  tramGroup.add(tramAO);

  // --- 4A. Detailed Brill 21E Undercarriage Bogie Truck, Flanged Wheels, Springs & Cowcatcher ---
  {
    const underGroup = new THREE.Group();
    const chassisCore = new THREE.Mesh(new THREE.BoxGeometry(tramW - 0.58, 0.28, 3.05), trainUnderMat);
    chassisCore.position.y = 0.34;
    underGroup.add(chassisCore);

    const truckMicro = markSkipPrintEdges(new THREE.Group());
    // Longitudinal truck side frames, axle boxes & primary coil springs
    for (const side of [-1, 1]) {
      const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 3.22), trainUnderMat);
      sideFrame.position.set(side * 0.51, 0.31, 0);
      truckMicro.add(sideFrame);

      const leafSpring = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.35), tramBrassMat);
      leafSpring.position.set(side * 0.53, 0.39, 0);
      truckMicro.add(leafSpring);

      for (const wz of [-1.18, 1.18]) {
        // Flanged steel wheel seated squarely on rail top y = 0.054 (radius 0.235 -> center y = 0.289)
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.082, 16), railSteelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 0.42, 0.289, wz);
        truckMicro.add(wheel);

        const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.268, 0.268, 0.024, 16), trainUnderMat);
        flange.rotation.z = Math.PI / 2;
        flange.position.set(side * 0.375, 0.289, wz);
        truckMicro.add(flange);

        // Axle box + twin stacked coil springs
        const axleBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.19, 0.20), trainUnderMat);
        axleBox.position.set(side * 0.55, 0.29, wz);
        truckMicro.add(axleBox);

        for (const cz of [-0.22, 0.22]) {
          for (let ring = 0; ring < 3; ring++) {
            const coil = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.013, 6, 10), tramBrassMat);
            coil.rotation.x = Math.PI / 2;
            coil.position.set(side * 0.53, 0.29 + ring * 0.036, wz + cz);
            truckMicro.add(coil);
          }
        }
      }
    }

    // Steel axles connecting left & right wheels
    for (const wz of [-1.18, 1.18]) {
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.96, 8), trainUnderMat);
      axle.rotation.z = Math.PI / 2;
      axle.position.set(0, 0.289, wz);
      truckMicro.add(axle);
    }

    // Slatted Vintage Wooden/Steel Cowcatcher Fender Guards (護柵) tucked below front & rear bumpers
    for (const endDir of [1, -1]) {
      const fz = endDir * (halfTL - 0.16);
      const cradle = new THREE.Group();
      cradle.position.set(0, 0.24, fz);
      cradle.rotation.x = endDir * 0.36;

      for (const sx of [-0.52, 0, 0.52]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.24, 0.045), trainUnderMat);
        rail.position.x = sx;
        cradle.add(rail);
      }
      for (let s = 0; s < 4; s++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.036, 0.026), tramBenchWoodMat);
        slat.position.set(0, -0.09 + s * 0.06, endDir * 0.025);
        cradle.add(slat);
      }
      truckMicro.add(cradle);

      // Recessed folding entrance platform steps on both corners (+X curb boarding side & -X side)
      for (const side of [-1, 1]) {
        const stepZ = endDir * (halfTL - 0.44);
        const stepLow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.62), trainUnderMat);
        stepLow.position.set(side * (halfTW - 0.06), 0.27, stepZ);
        truckMicro.add(stepLow);

        const stepEdge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.038, 0.62), tramBrassMat);
        stepEdge.position.set(side * (halfTW + 0.04), 0.27, stepZ);
        truckMicro.add(stepEdge);

        const stepHigh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.035, 0.58), tramTeakMat);
        stepHigh.position.set(side * (halfTW - 0.12), 0.42, stepZ);
        truckMicro.add(stepHigh);
      }
    }

    underGroup.add(truckMicro);
    tramGroup.add(underGroup);
  }

  // --- 4B. Sculpted Chamfered Emerald-Green Waist Panels, Deck Floors & Raised Brass/Cream Trim ---
  const createChamferedDeckGeometry = (w: number, l: number, h: number, chamfer: number) => {
    const hw = w * 0.5;
    const hl = l * 0.5;
    const c = chamfer;
    const sh = new THREE.Shape();
    sh.moveTo(-hw + c, -hl);
    sh.lineTo(hw - c, -hl);
    sh.quadraticCurveTo(hw, -hl, hw, -hl + c);
    sh.lineTo(hw, hl - c);
    sh.quadraticCurveTo(hw, hl, hw - c, hl);
    sh.lineTo(-hw + c, hl);
    sh.quadraticCurveTo(-hw, hl, -hw, hl - c);
    sh.lineTo(-hw, -hl + c);
    sh.quadraticCurveTo(-hw, -hl, -hw + c, -hl);
    const geom = new THREE.ExtrudeGeometry(sh, {
      depth: h,
      bevelEnabled: false,
      curveSegments: 6
    });
    // Rotate so shape is in XZ and depth extends along +Y
    geom.rotateX(-Math.PI / 2);
    return geom;
  };

  // Lower emerald-green waist skirt (y = 0.50..1.18) with rounded chamfered HK tram corners!
  const lowerSkirt = new THREE.Mesh(
    createChamferedDeckGeometry(tramW, tramL, 0.68, 0.16),
    tramEmeraldMat
  );
  lowerSkirt.position.y = 0.50;
  lowerSkirt.castShadow = true;
  lowerSkirt.receiveShadow = true;
  tramGroup.add(lowerSkirt);

  // Inter-deck emerald-green waist fascia (y = 2.12..2.56)
  const midFascia = new THREE.Mesh(
    createChamferedDeckGeometry(tramW + 0.015, tramL + 0.015, 0.44, 0.16),
    tramEmeraldMat
  );
  midFascia.position.y = 2.12;
  midFascia.castShadow = true;
  midFascia.receiveShadow = true;
  tramGroup.add(midFascia);

  // Upper eave header frieze (y = 3.84..3.98)
  const topFrieze = new THREE.Mesh(
    createChamferedDeckGeometry(tramW + 0.02, tramL + 0.02, 0.14, 0.16),
    tramEmeraldMat
  );
  topFrieze.position.y = 3.84;
  topFrieze.castShadow = true;
  tramGroup.add(topFrieze);

  // Raised cream & brass horizontal waist trim moldings (腰線) wrapping the coach
  const trimMoldings: Array<{ y: number; h: number; mat: THREE.MeshStandardMaterial; extra: number }> = [
    { y: 0.53, h: 0.055, mat: tramBrassMat, extra: 0.045 },
    { y: 1.15, h: 0.06, mat: tramCreamMat, extra: 0.04 },
    { y: 2.11, h: 0.05, mat: tramBrassMat, extra: 0.055 },
    { y: 2.54, h: 0.055, mat: tramCreamMat, extra: 0.045 },
    { y: 3.83, h: 0.045, mat: tramBrassMat, extra: 0.05 }
  ];
  for (const tm of trimMoldings) {
    const molding = markSkipPrintEdges(
      new THREE.Mesh(
        createChamferedDeckGeometry(tramW + tm.extra, tramL + tm.extra, tm.h, 0.17),
        tm.mat
      )
    );
    molding.position.y = tm.y;
    tramGroup.add(molding);
  }

  // Heritage lettering plaque strips flush along both sides of the inter-deck waist fascia (4.87 × 0.34, AR = 14.324)
  for (const side of [-1, 1]) {
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.87, 0.34), tramWaistPlaqueMat);
    plaque.position.set(side * (halfTW + 0.018), 2.34, 0);
    plaque.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
    tramGroup.add(plaque);
  }

  // --- 4C. Real Illuminated Warm 3D Interior Cabin (Benches, Brass Poles, Staircase, Seated Passengers) ---
  {
    const cabin = new THREE.Group();
    const cabinDetail = markSkipPrintEdges(new THREE.Group());

    // Warm glowing interior core floors & ceiling light strips (lower & upper decks)
    const lowerFloor = new THREE.Mesh(new THREE.BoxGeometry(tramW - 0.16, 0.06, tramL - 0.30), tramTeakMat);
    lowerFloor.position.y = 0.54;
    cabinDetail.add(lowerFloor);

    const lowerCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(tramW - 0.18, 0.06, tramL - 0.30),
      tramCabinWarmWallMat
    );
    lowerCeiling.position.y = 2.10;
    cabinDetail.add(lowerCeiling);

    const lowerLightStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.04, tramL - 0.95),
      tramCeilingStripMat
    );
    lowerLightStrip.position.y = 2.06;
    cabinDetail.add(lowerLightStrip);

    const upperFloor = new THREE.Mesh(
      new THREE.BoxGeometry(tramW - 0.16, 0.06, tramL - 0.30),
      tramCabinWarmWallMat
    );
    upperFloor.position.y = 2.57;
    cabinDetail.add(upperFloor);

    const upperCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(tramW - 0.18, 0.06, tramL - 0.32),
      tramCabinWarmWallMat
    );
    upperCeiling.position.y = 3.84;
    cabinDetail.add(upperCeiling);

    const upperLightStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.045, tramL - 0.90),
      tramCeilingStripMat
    );
    upperLightStrip.position.y = 3.80;
    cabinDetail.add(upperLightStrip);

    // Subtle warm backlit center aisle divider ribs (gives rich warm depth visible from every angle!)
    const warmBackdropLower = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.92, tramL - 1.5),
      tramCabinWarmWallMat
    );
    warmBackdropLower.position.set(0, 1.54, -0.10);
    cabinDetail.add(warmBackdropLower);

    // Lower deck longitudinal teak benches + vertical brass grab poles
    for (const side of [-1, 1]) {
      const lowBench = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.10, 3.35), tramBenchWoodMat);
      lowBench.position.set(side * 0.44, 0.96, 0);
      cabinDetail.add(lowBench);

      const lowBack = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 3.35), tramBenchWoodMat);
      lowBack.position.set(side * 0.58, 1.18, 0);
      cabinDetail.add(lowBack);
    }

    // Upper deck transverse wooden bench rows (5 rows on both sides of the central aisle!)
    const upperBenchZs = [-1.42, -0.70, 0.02, 0.74, 1.46];
    for (const bz of upperBenchZs) {
      for (const side of [-1, 1]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.32), tramBenchWoodMat);
        seat.position.set(side * 0.38, 2.94, bz);
        cabinDetail.add(seat);

        const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.06), tramBenchWoodMat);
        backrest.position.set(side * 0.38, 3.14, bz - 0.14);
        cabinDetail.add(backrest);
      }
    }

    // Vertical brass grab poles on both decks
    for (const gz of [-1.55, -0.55, 0.45, 1.45]) {
      for (const gx of [-0.20, 0.20]) {
        const poleLow = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.52, 6), tramBrassMat);
        poleLow.position.set(gx, 1.32, gz);
        cabinDetail.add(poleLow);

        const poleUp = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.24, 6), tramBrassMat);
        poleUp.position.set(gx, 3.20, gz);
        cabinDetail.add(poleUp);
      }
    }

    // Rear curved staircase hint (z = -2.18, spiraling treads + curved brass handrail!)
    for (let st = 0; st < 7; st++) {
      const ang = (st / 6) * Math.PI * 0.72;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.19), tramTeakMat);
      tread.position.set(Math.cos(ang) * 0.24 - 0.08, 0.78 + st * 0.25, -2.12 - Math.sin(ang) * 0.16);
      tread.rotation.y = -ang * 0.7;
      cabinDetail.add(tread);
    }
    const stairRailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.32, 1.25, -2.02),
      new THREE.Vector3(0.10, 1.92, -2.30),
      new THREE.Vector3(-0.24, 2.65, -2.12)
    ]);
    cabinDetail.add(
      new THREE.Mesh(new THREE.TubeGeometry(stairRailCurve, 10, 0.018, 6, false), tramBrassMat)
    );

    // Front driver brass controller pedestal & handbrake wheel (z = +2.28)
    const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.22), tramDarkGreenMat);
    ctrlBox.position.set(-0.22, 0.92, 2.34);
    cabinDetail.add(ctrlBox);
    const ctrlHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10), tramBrassMat);
    ctrlHandle.position.set(-0.22, 1.30, 2.34);
    cabinDetail.add(ctrlHandle);

    // 3D Seated Miniature Passenger Silhouettes (Upper & Lower Decks) + Tram Driver!
    const addSeatedPassenger = (px: number, py: number, pz: number, matIdx: number) => {
      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.135, 0.34, 8),
        tramPaxCoatMats[matIdx % tramPaxCoatMats.length]
      );
      torso.position.set(px, py + 0.18, pz);
      cabinDetail.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.088, 8, 6), tramPaxSkinMat);
      head.position.set(px, py + 0.42, pz);
      cabinDetail.add(head);

      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.092, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58),
        trainUnderMat
      );
      hair.position.set(px, py + 0.43, pz - 0.01);
      cabinDetail.add(hair);
    };

    // Upper deck seated passengers (clearly visible through 3D recessed window bays!)
    addSeatedPassenger(0.36, 2.98, 1.46, 0);
    addSeatedPassenger(-0.36, 2.98, 1.46, 1);
    addSeatedPassenger(0.38, 2.98, 0.74, 2);
    addSeatedPassenger(-0.38, 2.98, 0.02, 3);
    addSeatedPassenger(0.38, 2.98, -0.70, 1);
    addSeatedPassenger(-0.36, 2.98, -1.42, 0);

    // Lower deck passengers + standing tram driver at front platform
    addSeatedPassenger(0.42, 1.02, 0.85, 2);
    addSeatedPassenger(-0.42, 1.02, -0.25, 0);
    addSeatedPassenger(0.42, 1.02, -1.10, 3);
    // Tram driver standing behind brass controller
    addSeatedPassenger(-0.18, 1.24, 2.08, 0);

    cabin.add(cabinDetail);
    tramGroup.add(cabin);
  }

  // --- 4D. Real 3D Recessed Window Bays along BOTH Sides (+X and -X) ---
  {
    const bayCount = 6;
    const bayStartZ = -2.02;
    const bayEndZ = 2.02;
    const baySpan = (bayEndZ - bayStartZ) / bayCount;

    for (const side of [-1, 1]) {
      const outerX = side * (halfTW - 0.03);
      const glassX = side * (halfTW - 0.075);

      // Recessed translucent warm glass panes for upper & lower decks
      const lowerGlass = new THREE.Mesh(new THREE.PlaneGeometry(tramL - 0.56, 0.92), tramWindowGlassMat);
      lowerGlass.position.set(glassX, 1.65, 0);
      lowerGlass.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
      tramGroup.add(lowerGlass);

      const upperGlass = new THREE.Mesh(new THREE.PlaneGeometry(tramL - 0.52, 1.24), tramWindowGlassMat);
      upperGlass.position.set(glassX, 3.20, 0);
      upperGlass.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
      tramGroup.add(upperGlass);

      // Protruding 3D cream window pillars separating the 6 window bays + vestibule corners
      for (let i = 0; i <= bayCount; i++) {
        const pz = bayStartZ + i * baySpan;
        const pW = i === 0 || i === bayCount ? 0.11 : 0.085;

        const upPillar = new THREE.Mesh(new THREE.BoxGeometry(0.095, 1.30, pW), tramCreamMat);
        upPillar.position.set(outerX, 3.20, pz);
        upPillar.castShadow = true;
        tramGroup.add(upPillar);

        const lowPillar = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.96, pW), tramCreamMat);
        lowPillar.position.set(outerX, 1.65, pz);
        lowPillar.castShadow = true;
        tramGroup.add(lowPillar);

        // Inner dark teak window sash edge for deep crisp recess contrast
        const teakTrimUp = markSkipPrintEdges(
          new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.24, pW + 0.045), tramTeakMat)
        );
        teakTrimUp.position.set(side * (halfTW - 0.058), 3.20, pz);
        tramGroup.add(teakTrimUp);

        const teakTrimLow = markSkipPrintEdges(
          new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.90, pW + 0.045), tramTeakMat)
        );
        teakTrimLow.position.set(side * (halfTW - 0.058), 1.65, pz);
        tramGroup.add(teakTrimLow);
      }

      // Corner vestibule pillars & horizontal teak window transom rails
      for (const ez of [-halfTL + 0.18, halfTL - 0.18]) {
        const cornerUp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.30, 0.14), tramCreamMat);
        cornerUp.position.set(outerX, 3.20, ez);
        tramGroup.add(cornerUp);

        const cornerLow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.96, 0.14), tramCreamMat);
        cornerLow.position.set(outerX, 1.65, ez);
        tramGroup.add(cornerLow);

        // Vertical brass entrance boarding rail beside vestibule step
        const grabRail = markSkipPrintEdges(
          new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.94, 6), tramBrassMat)
        );
        grabRail.position.set(side * (halfTW + 0.02), 1.48, ez - Math.sign(ez) * 0.22);
        tramGroup.add(grabRail);
      }

      // Horizontal cream window lintels/sills & recessed teak transom bars
      const horizBars: Array<[number, number, number, THREE.MeshStandardMaterial]> = [
        [2.60, 0.06, outerX, tramCreamMat],
        [3.79, 0.07, outerX, tramCreamMat],
        [3.52, 0.036, side * (halfTW - 0.055), tramTeakMat],
        [1.21, 0.055, outerX, tramCreamMat],
        [2.08, 0.06, outerX, tramCreamMat],
        [1.89, 0.034, side * (halfTW - 0.055), tramTeakMat]
      ];
      for (const [hy, hh, hx, mat] of horizBars) {
        const bar = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(0.065, hh, tramL - 0.34), mat));
        bar.position.set(hx, hy, 0);
        tramGroup.add(bar);
      }
    }
  }

  // --- 4E. Classic Curved/Chamfered HK Tram Front & Rear Dashes, 3-Pane Windows, Rollsign & Headlamp ---
  const destMat = new THREE.MeshStandardMaterial({
    map: tramDestTex,
    emissive: new THREE.Color(0xffd27a),
    emissiveMap: tramDestTex,
    emissiveIntensity: 1.32,
    roughness: 0.30
  });
  applyRadialMistFade(destMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: destMat, base: 1.32 });

  for (const endDir of [1, -1]) {
    const ez = endDir * (halfTL - 0.04);

    // Recessed front/rear translucent glass panes on upper & lower decks
    const upEndGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.12), tramWindowGlassMat);
    upEndGlass.position.set(0, 3.20, ez - endDir * 0.03);
    if (endDir === -1) upEndGlass.rotation.y = Math.PI;
    tramGroup.add(upEndGlass);

    const lowEndGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.20, 0.86), tramWindowGlassMat);
    lowEndGlass.position.set(0, 1.65, ez - endDir * 0.03);
    if (endDir === -1) lowEndGlass.rotation.y = Math.PI;
    tramGroup.add(lowEndGlass);

    // Cream & teak 3-pane vertical mullions across front & rear bows
    for (const mx of [-0.62, -0.22, 0.22, 0.62]) {
      const mW = Math.abs(mx) > 0.5 ? 0.11 : 0.055;
      const mat = Math.abs(mx) > 0.5 ? tramCreamMat : tramTeakMat;
      const upM = new THREE.Mesh(new THREE.BoxGeometry(mW, 1.24, 0.08), mat);
      upM.position.set(mx, 3.20, ez);
      tramGroup.add(upM);

      const lowM = new THREE.Mesh(new THREE.BoxGeometry(mW, 0.92, 0.08), mat);
      lowM.position.set(mx, 1.65, ez);
      tramGroup.add(lowM);
    }

    // Horizontal lintels, sills & transom bars on front/rear ends
    for (const [hy, hh, mat] of [
      [3.79, 0.08, tramCreamMat],
      [3.52, 0.036, tramTeakMat],
      [2.60, 0.08, tramCreamMat],
      [2.08, 0.07, tramCreamMat],
      [1.88, 0.034, tramTeakMat],
      [1.21, 0.07, tramCreamMat]
    ] as Array<[number, number, THREE.MeshStandardMaterial]>) {
      const bar = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(1.36, hh, 0.08), mat));
      bar.position.set(0, hy, ez);
      tramGroup.add(bar);
    }

    // 3D Projecting Destination Rollsign Box (跑馬地 HAPPY VALLEY) with curved rain hood canopy!
    const destBox = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.31, 0.15), tramDarkGreenMat);
    destBox.position.set(0, 3.88, ez + endDir * 0.07);
    tramGroup.add(destBox);

    const destFace = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.25), destMat);
    destFace.position.set(0, 3.88, ez + endDir * 0.148);
    if (endDir === -1) destFace.rotation.y = Math.PI;
    tramGroup.add(destFace);

    // Curved overhanging rain visor hood above destination box
    const destHood = markSkipPrintEdges(
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.13,
          0.13,
          1.14,
          10,
          1,
          false,
          endDir === 1 ? 0 : Math.PI * 0.35,
          Math.PI * 0.65
        ),
        tramDarkGreenMat
      )
    );
    destHood.rotation.z = Math.PI / 2;
    destHood.position.set(0, 3.96, ez + endDir * 0.08);
    tramGroup.add(destHood);

    // Heritage fleet number plate (#120) on dash waist
    const numPlate = markSkipPrintEdges(new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), tramNumPlateMat));
    numPlate.position.set(0, 2.34, ez + endDir * 0.056);
    if (endDir === -1) numPlate.rotation.y = Math.PI;
    tramGroup.add(numPlate);

    // Stepped vintage brass & iron front/rear bumpers
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(tramW + 0.04, 0.13, 0.16), tramBrassMat);
    bumper.position.set(0, 0.56, ez + endDir * 0.09);
    tramGroup.add(bumper);

    const bumperTrim = markSkipPrintEdges(
      new THREE.Mesh(new THREE.BoxGeometry(tramW - 0.12, 0.05, 0.04), trainUnderMat)
    );
    bumperTrim.position.set(0, 0.56, ez + endDir * 0.17);
    tramGroup.add(bumperTrim);
  }

  // Iconic Single Centered Vintage Brass Headlamp (+Z front) with Curved Upper Visor + Soft Volumetric Beam
  {
    const hz = halfTL + 0.05;
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.18, 0.18, 14), tramBrassMat);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0, 0.96, hz);
    tramGroup.add(housing);

    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.06, 14), trainHeadMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.96, hz + 0.08);
    tramGroup.add(lens);

    const bezel = markSkipPrintEdges(
      new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.025, 8, 16), tramBrassMat)
    );
    bezel.position.set(0, 0.96, hz + 0.10);
    tramGroup.add(bezel);

    // Classic curved brass headlamp rain visor hood arching cleanly over the top (+Y)
    const lampVisor = markSkipPrintEdges(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.16, 14, 1, true, Math.PI * 0.54, Math.PI * 0.92),
        tramBrassMat
      )
    );
    lampVisor.rotation.x = Math.PI / 2;
    lampVisor.position.set(0, 0.96, hz + 0.14);
    tramGroup.add(lampVisor);

    // Front brass driver windshield wiper
    const tramWiper = markSkipPrintEdges(
      new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.34, 0.018), trainUnderMat)
    );
    tramWiper.position.set(-0.22, 1.56, halfTL + 0.01);
    tramWiper.rotation.z = 0.25;
    tramGroup.add(tramWiper);
  }

  // Ultra-soft Fresnel+axial misty tram headlight cone (ZERO hard silhouette!)
  const tramBeamMat = createSoftLightConeMaterial(0xffd788, 0.072);
  softCones.push({ mat: tramBeamMat, baseOpacity: 0.072 });
  const tramBeam = new THREE.Mesh(new THREE.ConeGeometry(1.25, 5.4, 24, 1, true), tramBeamMat);
  tramBeam.rotation.x = -Math.PI / 2 + 0.14;
  tramBeam.position.set(0, 0.62, halfTL + 2.68);
  tramBeam.renderOrder = 6;
  tramGroup.add(tramBeam);

  // Elongated warm wet-track headlight reflection sheen directly ahead of tram
  const tramPoolMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xffc666,
    transparent: true,
    opacity: 0.54,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  spillMaterials.push({ mat: tramPoolMat, baseOpacity: 0.54 });
  const tramPool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.2), tramPoolMat);
  tramPool.rotation.x = -Math.PI / 2;
  tramPool.position.set(0, 0.044, halfTL + 2.92);
  tramPool.renderOrder = 4;
  tramGroup.add(tramPool);

  const tramHeadLight = new THREE.PointLight(0xffca72, 9.5, 10.0, 1.65);
  tramHeadLight.position.set(0, 1.25, halfTL + 1.45);
  tramGroup.add(tramHeadLight);
  movingLights.push({ light: tramHeadLight, baseIntensity: 9.5 });

  // Twin ruby jewel tail lamps in brass cups on -Z rear
  for (const rx of [-0.52, 0.52]) {
    const cup = markSkipPrintEdges(
      new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.095, 0.08, 10), tramBrassMat)
    );
    cup.rotation.x = Math.PI / 2;
    cup.position.set(rx, 0.94, -halfTL - 0.02);
    tramGroup.add(cup);

    const tl = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), trainTailMat);
    tl.position.set(rx, 0.94, -halfTL - 0.06);
    tramGroup.add(tl);
  }

  // --- 4F. Vaulted Curved Barrel-Arch Roof (ExtrudeGeometry) + Drip Rails + Heritage Roof Billboards ---
  {
    const archW = tramW + 0.06;
    const archH = 0.28;
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-archW * 0.5, 0);
    roofShape.lineTo(archW * 0.5, 0);
    roofShape.lineTo(archW * 0.5, 0.05);
    roofShape.quadraticCurveTo(0, archH * 1.82, -archW * 0.5, 0.05);
    roofShape.closePath();

    const roofLen = tramL + 0.04;
    const vaultedRoofGeom = new THREE.ExtrudeGeometry(roofShape, {
      depth: roofLen,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.025,
      bevelSegments: 2,
      curveSegments: 14
    });
    vaultedRoofGeom.translate(0, 0, -roofLen * 0.5);

    const vaultedRoof = new THREE.Mesh(vaultedRoofGeom, tramRoofMat);
    vaultedRoof.position.y = 3.96;
    vaultedRoof.castShadow = true;
    vaultedRoof.receiveShadow = true;
    tramGroup.add(vaultedRoof);

    // Rain drip rails along both eaves + miniature rooftop torpedo ventilators
    for (const side of [-1, 1]) {
      const dripRail = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, roofLen + 0.02), tramCreamMat)
      );
      dripRail.position.set(side * (archW * 0.5 + 0.015), 3.99, 0);
      tramGroup.add(dripRail);
    }

    for (const vz of [-1.85, 1.55]) {
      const vent = markSkipPrintEdges(
        new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.09, 10), tramRoofMat)
      );
      vent.position.set(0, 4.28, vz);
      tramGroup.add(vent);
    }

    // Side heritage roof billboards supported by slim brass mounting feet
    const billboardMat = new THREE.MeshStandardMaterial({
      map: tramBillboardTex,
      emissive: new THREE.Color(0xffe6b6),
      emissiveMap: tramBillboardTex,
      emissiveIntensity: 0.30,
      roughness: 0.50
    });
    applyRadialMistFade(billboardMat, mistUniforms, vehicleFade);
    emissiveTracks.push({ mat: billboardMat, base: 0.30 });

    for (const side of [-1, 1]) {
      const bb = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.40, 4.60),
        [billboardMat, billboardMat, tramDarkGreenMat, tramDarkGreenMat, tramDarkGreenMat, tramDarkGreenMat]
      );
      bb.position.set(side * (halfTW - 0.03), 4.35, 0);
      tramGroup.add(bb);

      for (const fz of [-1.95, 0, 1.95]) {
        const foot = markSkipPrintEdges(
          new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), tramBrassMat)
        );
        foot.position.set(side * (halfTW - 0.04), 4.10, fz);
        tramGroup.add(foot);
      }
    }
  }

  // --- 4G. Detailed Brass Bow Pantograph (集電弓) with Insulators, Springs & Twin Contact Strips ---
  // Rides cleanly on y = trolleyY (5.30), well below viaduct soffit y = 6.20!
  {
    const panto = new THREE.Group();
    const baseY = 4.24;
    const baseZ = -0.18;

    const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.68), trainUnderMat);
    pBase.position.set(0, baseY + 0.06, baseZ);
    panto.add(pBase);

    const pMicro = markSkipPrintEdges(new THREE.Group());

    // 4 ribbed ceramic roof insulators
    for (const ix of [-0.22, 0.22]) {
      for (const iz of [-0.26, 0.26]) {
        const ins = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.046, 0.09, 8),
          trainInsulatorMat
        );
        ins.position.set(ix, baseY + 0.015, baseZ + iz);
        pMicro.add(ins);
      }
    }

    // Twin coiled tension springs at the base hinge
    for (const sx of [-0.14, 0.14]) {
      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.26, 8), tramBrassMat);
      spring.rotation.x = Math.PI / 2;
      spring.position.set(sx, baseY + 0.12, baseZ + 0.04);
      pMicro.add(spring);
    }

    // Triangular brass bow A-frame struts rising cleanly from baseY+0.10 to trolleyY-0.02 (5.28)
    const pivotY = baseY + 0.10; // 4.34
    const elbowY = 4.86;
    const topY = trolleyY - 0.02; // 5.28
    const elbowZ = baseZ - 0.42;
    const topZ = baseZ - 0.18;

    const addStrut = (p0: THREE.Vector3, p1: THREE.Vector3, r: number, mat: THREE.Material) => {
      const dir = new THREE.Vector3().subVectors(p1, p0);
      const len = dir.length();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 7), mat);
      mesh.position.copy(p0).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      pMicro.add(mesh);
    };

    for (const side of [-1, 1]) {
      const basePt = new THREE.Vector3(side * 0.24, pivotY, baseZ - 0.05);
      const bracePt = new THREE.Vector3(side * 0.20, pivotY, baseZ + 0.22);
      const elbowPt = new THREE.Vector3(side * 0.30, elbowY, elbowZ);
      const headPt = new THREE.Vector3(side * 0.36, topY - 0.02, topZ);

      addStrut(basePt, elbowPt, 0.018, tramBrassMat);
      addStrut(bracePt, elbowPt, 0.013, tramBrassMat);
      addStrut(elbowPt, headPt, 0.016, tramBrassMat);
    }

    // Diagonal cross-bracing inside the bow frame
    addStrut(
      new THREE.Vector3(-0.24, pivotY, baseZ - 0.05),
      new THREE.Vector3(0.30, elbowY, elbowZ),
      0.011,
      tramBrassMat
    );
    addStrut(
      new THREE.Vector3(0.24, pivotY, baseZ - 0.05),
      new THREE.Vector3(-0.30, elbowY, elbowZ),
      0.011,
      tramBrassMat
    );
    addStrut(
      new THREE.Vector3(-0.30, elbowY, elbowZ),
      new THREE.Vector3(0.30, elbowY, elbowZ),
      0.014,
      tramBrassMat
    );

    // Twin parallel brass contact collector strips + upturned end horns riding trolley wire!
    for (const cz of [-0.045, 0.045]) {
      const contactStrip = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.028, 0.032), tramBrassMat);
      contactStrip.position.set(0, topY, topZ + cz);
      pMicro.add(contactStrip);
    }
    for (const sx of [-0.48, 0.48]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.024, 0.13), tramBrassMat);
      horn.position.set(sx, topY - 0.04, topZ);
      horn.rotation.z = sx > 0 ? -0.58 : 0.58;
      pMicro.add(horn);
    }

    panto.add(pMicro);
    tramGroup.add(panto);
  }

  tramGroup.traverse((obj) => {
    obj.userData.isTram = true;
  });

  tramGroup.position.set(-1.85, 0, 5.6);
  group.add(tramGroup);

  // =========================================================================
  // 5. CLASSIC RED HONG KONG TAXI (紅的 Toyota Crown Comfort)
  // True sculpted 3-box sedan profile (ExtrudeGeometry), sloped A/C-pillars &
  // windshields, twin front-fender wing mirrors, recessed wheel arches, chrome
  // grille + amber signals + rear cluster lamps, glowing FOR HIRE flag & TAXI sign!
  // =========================================================================
  const taxiGroup = new THREE.Group();
  taxiGroup.name = 'HK_Red_Taxi';

  const taxiRedMat = new THREE.MeshStandardMaterial({
    color: 0xa82226,
    roughness: 0.28,
    metalness: 0.34
  });
  applyRadialMistFade(taxiRedMat, mistUniforms, vehicleFade);

  const taxiFrontMat = new THREE.MeshStandardMaterial({
    map: createTaxiFaceTexture(false),
    roughness: 0.34,
    metalness: 0.34
  });
  applyRadialMistFade(taxiFrontMat, mistUniforms, vehicleFade);

  const taxiRearMat = new THREE.MeshStandardMaterial({
    map: createTaxiFaceTexture(true),
    roughness: 0.34,
    metalness: 0.30
  });
  applyRadialMistFade(taxiRearMat, mistUniforms, vehicleFade);

  const taxiSilverMat = new THREE.MeshStandardMaterial({
    color: 0xcdd6de,
    roughness: 0.28,
    metalness: 0.54
  });
  applyRadialMistFade(taxiSilverMat, mistUniforms, vehicleFade);

  const taxiChromeMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf4,
    roughness: 0.16,
    metalness: 0.88
  });
  applyRadialMistFade(taxiChromeMat, mistUniforms, vehicleFade);

  const taxiGlassMat = new THREE.MeshStandardMaterial({
    color: 0x1e2e3d,
    emissive: new THREE.Color(0xffbe74),
    emissiveIntensity: 0.24,
    roughness: 0.12,
    metalness: 0.42
  });
  applyRadialMistFade(taxiGlassMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: taxiGlassMat, base: 0.24 });

  const taxiAmberMat = new THREE.MeshStandardMaterial({
    color: 0xff9b28,
    emissive: new THREE.Color(0xff8418),
    emissiveIntensity: 1.4,
    roughness: 0.22
  });
  applyRadialMistFade(taxiAmberMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: taxiAmberMat, base: 1.4 });

  const taxiWhiteLensMat = new THREE.MeshStandardMaterial({
    color: 0xf4f8fc,
    emissive: new THREE.Color(0xdceeff),
    emissiveIntensity: 0.65,
    roughness: 0.22
  });
  applyRadialMistFade(taxiWhiteLensMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: taxiWhiteLensMat, base: 0.65 });

  const taxiSignTex = createTaxiRoofSignTexture();
  const taxiSignMat = new THREE.MeshStandardMaterial({
    map: taxiSignTex,
    emissive: new THREE.Color(0xffc948),
    emissiveMap: taxiSignTex,
    emissiveIntensity: 1.55,
    roughness: 0.24
  });
  applyRadialMistFade(taxiSignMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: taxiSignMat, base: 1.55 });

  // Plain glowing warm-amber plastic end caps for taxi roof sign (±X square ends — zero crushed text!)
  const taxiSignEndMat = new THREE.MeshStandardMaterial({
    color: 0xf6c95a,
    emissive: new THREE.Color(0xffbf38),
    emissiveIntensity: 1.35,
    roughness: 0.26
  });
  applyRadialMistFade(taxiSignEndMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: taxiSignEndMat, base: 1.35 });

  const taxiFlagTex = createTaxiFlagTexture();
  const taxiFlagMat = new THREE.MeshStandardMaterial({
    map: taxiFlagTex,
    emissive: new THREE.Color(0xff5242),
    emissiveMap: taxiFlagTex,
    emissiveIntensity: 1.5,
    roughness: 0.28
  });
  applyRadialMistFade(taxiFlagMat, mistUniforms, vehicleFade);
  emissiveTracks.push({ mat: taxiFlagMat, base: 1.5 });

  const taxiAO = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 4.15),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.68,
      depthWrite: false
    })
  );
  taxiAO.rotation.x = -Math.PI / 2;
  taxiAO.position.set(0, 0.012, 0);
  taxiAO.renderOrder = 3;
  taxiGroup.add(taxiAO);

  // 1. Sculpted Crimson Lower 3-Box Sedan Body (ExtrudeGeometry side profile in ZY, extruded along X)
  // Note: -Z is front nose facing zebra crossing, +Z is rear trunk facing camera!
  {
    const lowerProfile = new THREE.Shape();
    lowerProfile.moveTo(-1.60, 0.27);
    lowerProfile.lineTo(1.60, 0.27);
    lowerProfile.lineTo(1.64, 0.40);
    lowerProfile.lineTo(1.61, 0.72);
    lowerProfile.lineTo(0.96, 0.76);
    lowerProfile.lineTo(-0.80, 0.75);
    lowerProfile.lineTo(-1.58, 0.69);
    lowerProfile.lineTo(-1.64, 0.44);
    lowerProfile.closePath();

    const lowerBodyW = 1.32;
    const lowerGeom = new THREE.ExtrudeGeometry(lowerProfile, {
      depth: lowerBodyW,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 2
    });
    // Map shape X -> world Z, shape Y -> world Y, depth -> world X
    lowerGeom.rotateY(-Math.PI / 2);
    lowerGeom.translate(lowerBodyW * 0.5, 0, 0);

    const lowerMesh = new THREE.Mesh(lowerGeom, taxiRedMat);
    lowerMesh.castShadow = true;
    lowerMesh.receiveShadow = true;
    taxiGroup.add(lowerMesh);

    // Subtle sculpted Crown Comfort hood power-dome crease & trunk lid edge
    const hoodCrease = markSkipPrintEdges(
      new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.035, 0.74), taxiRedMat)
    );
    hoodCrease.position.set(0, 0.755, -1.20);
    hoodCrease.rotation.x = 0.04;
    taxiGroup.add(hoodCrease);
  }

  // 2. Sculpted Silver Upper Greenhouse Cabin with Sloped A-Pillars & C-Pillars (ExtrudeGeometry)
  {
    const cabinProfile = new THREE.Shape();
    cabinProfile.moveTo(-0.84, 0.75);
    cabinProfile.lineTo(0.98, 0.75);
    cabinProfile.lineTo(0.58, 1.24);
    cabinProfile.quadraticCurveTo(0.08, 1.29, -0.44, 1.24);
    cabinProfile.closePath();

    const cabinW = 1.18;
    const cabinGeom = new THREE.ExtrudeGeometry(cabinProfile, {
      depth: cabinW,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.025,
      bevelSegments: 2,
      curveSegments: 8
    });
    cabinGeom.rotateY(-Math.PI / 2);
    cabinGeom.translate(cabinW * 0.5, 0, 0);

    const cabinMesh = new THREE.Mesh(cabinGeom, taxiSilverMat);
    cabinMesh.castShadow = true;
    cabinMesh.receiveShadow = true;
    taxiGroup.add(cabinMesh);
  }

  // 3. Slanted Recessed Front Windshield, Rear Window & Side Door Windows with B-Pillar Dividers
  {
    // Slanted front windshield matching A-pillar slope (-0.84, 0.75) -> (-0.44, 1.24)
    const frontWind = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.50, 0.04), taxiGlassMat);
    frontWind.position.set(0, 1.00, -0.66);
    frontWind.rotation.x = 0.68;
    taxiGroup.add(frontWind);

    // Slanted rear window matching C-pillar slope (0.98, 0.75) -> (0.58, 1.24)
    const rearWind = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.50, 0.04), taxiGlassMat);
    rearWind.position.set(0, 1.00, 0.80);
    rearWind.rotation.x = -0.68;
    taxiGroup.add(rearWind);

    // Glowing red/amber FOR HIRE / 有客 flag perched inside the slanted front windshield (6-mat: zero edge smear!)
    const hireFlag = markSkipPrintEdges(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.13, 0.025),
        [trainRubberMat, trainRubberMat, trainRubberMat, trainRubberMat, taxiFlagMat, taxiFlagMat]
      )
    );
    hireFlag.position.set(-0.28, 0.90, -0.69);
    hireFlag.rotation.x = -0.22;
    taxiGroup.add(hireFlag);

    // Side window panes (thin solid extruded trapezoidal glass so both sides face outward with exact A/C slopes)
    const sideWinShape = new THREE.Shape();
    sideWinShape.moveTo(-0.72, 0.79);
    sideWinShape.lineTo(0.84, 0.79);
    sideWinShape.lineTo(0.52, 1.19);
    sideWinShape.lineTo(-0.38, 1.19);
    sideWinShape.closePath();
    const sideWinGeom = new THREE.ExtrudeGeometry(sideWinShape, {
      depth: 0.04,
      bevelEnabled: false
    });
    sideWinGeom.rotateY(-Math.PI / 2);
    sideWinGeom.translate(0.02, 0, 0);

    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(sideWinGeom, taxiGlassMat);
      sw.position.x = side * 0.615;
      taxiGroup.add(sw);

      // Vertical B-pillar & rear quarter window divider bar
      const bPillar = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.44, 0.065), taxiSilverMat)
      );
      bPillar.position.set(side * 0.62, 0.99, 0.04);
      taxiGroup.add(bPillar);

      const qBar = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.40, 0.03), trainRubberMat)
      );
      qBar.position.set(side * 0.625, 0.98, 0.54);
      taxiGroup.add(qBar);

      // Chrome side beltline rub-strip & 2 chrome door handles per side
      const rubStrip = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.035, 1.88), taxiChromeMat)
      );
      rubStrip.position.set(side * 0.70, 0.52, 0.02);
      taxiGroup.add(rubStrip);

      for (const hz of [-0.14, 0.48]) {
        const handle = markSkipPrintEdges(
          new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.13), taxiChromeMat)
        );
        handle.position.set(side * 0.70, 0.68, hz);
        taxiGroup.add(handle);
      }

      // SIGNATURE HONG KONG CROWN COMFORT DETAIL: Twin Front-Fender Mounted Wing Mirrors!
      const mirrorGroup = markSkipPrintEdges(new THREE.Group());
      mirrorGroup.position.set(side * 0.62, 0.74, -1.24);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.12, 6), trainRubberMat);
      stalk.position.set(side * 0.03, 0.05, 0);
      stalk.rotation.z = -side * 0.42;
      mirrorGroup.add(stalk);

      const mHead = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.045), trainRubberMat);
      mHead.position.set(side * 0.075, 0.105, 0);
      mirrorGroup.add(mHead);

      const mGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.055), taxiChromeMat);
      mGlass.position.set(side * 0.075, 0.105, 0.025);
      mirrorGroup.add(mGlass);
      taxiGroup.add(mirrorGroup);
    }
  }

  // 4. Sculpted Glowing Yellow TAXI 的士 Roof Sign on Chrome Bar
  {
    const signBar = markSkipPrintEdges(
      new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 0.06), taxiChromeMat)
    );
    signBar.position.set(0, 1.29, 0.04);
    taxiGroup.add(signBar);

    const roofSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.20, 0.20),
      [taxiSignEndMat, taxiSignEndMat, taxiSilverMat, taxiSilverMat, taxiSignMat, taxiSignMat]
    );
    roofSign.position.set(0, 1.40, 0.04);
    taxiGroup.add(roofSign);
  }

  // 5. Front Chrome Grille + License Plate Face, Rear Trunk Plate Face, Bumpers & Lamp Clusters
  {
    const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.40), taxiFrontMat);
    frontFace.position.set(0, 0.50, -1.682);
    frontFace.rotation.y = Math.PI;
    taxiGroup.add(frontFace);

    const rearFace = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.42), taxiRearMat);
    rearFace.position.set(0, 0.52, 1.682);
    taxiGroup.add(rearFace);

    // Sculpted chrome-capped impact bumpers
    for (const bz of [-1.70, 1.70]) {
      const bmp = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.13, 0.11), trainRubberMat);
      bmp.position.set(0, 0.30, bz);
      taxiGroup.add(bmp);

      const bmpChrome = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.035, 0.12), taxiChromeMat)
      );
      bmpChrome.position.set(0, 0.34, bz);
      taxiGroup.add(bmpChrome);
    }

    // Twin rectangular headlamps + amber wrap-around corner turn signals + 3-tone rear cluster lamps
    for (const side of [-1, 1]) {
      // Front rectangular headlamp + chrome bezel
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.06), trainHeadMat);
      hl.position.set(side * 0.44, 0.56, -1.67);
      taxiGroup.add(hl);

      // Front amber wrap-around corner turn signal
      const fTurn = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), taxiAmberMat)
      );
      fTurn.position.set(side * 0.62, 0.56, -1.64);
      taxiGroup.add(fTurn);

      // Rear 3-tone Crown Comfort lamp cluster (ruby tail + amber corner indicator + white reverse bar)
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.06), trainTailMat);
      tl.position.set(side * 0.45, 0.58, 1.67);
      taxiGroup.add(tl);

      const rTurn = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.09), taxiAmberMat)
      );
      rTurn.position.set(side * 0.62, 0.58, 1.65);
      taxiGroup.add(rTurn);

      const rRev = markSkipPrintEdges(
        new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.062), taxiWhiteLensMat)
      );
      rRev.position.set(side * 0.44, 0.54, 1.676);
      taxiGroup.add(rRev);
    }
  }

  // 6. Four Sculpted Wheel Arches with Recessed Dark Wells, Tires & Chrome Dish Hubcaps
  {
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a2026, roughness: 0.85 });
    applyRadialMistFade(tireMat, mistUniforms, vehicleFade);

    const tireGeom = new THREE.CylinderGeometry(0.255, 0.255, 0.18, 16);
    const hubGeom = new THREE.CylinderGeometry(0.145, 0.145, 0.20, 12);
    const wellGeom = new THREE.CylinderGeometry(0.31, 0.31, 0.20, 14, 1, false, 0, Math.PI);
    const archGeom = new THREE.TorusGeometry(0.31, 0.032, 6, 14, Math.PI);

    for (const wz of [-1.02, 1.02]) {
      for (const side of [-1, 1]) {
        const wx = side * 0.64;

        // Recessed dark wheel well + crimson wheel arch flare arching cleanly over +Y
        const well = markSkipPrintEdges(new THREE.Mesh(wellGeom, trainRubberMat));
        well.rotation.z = Math.PI / 2;
        well.position.set(side * 0.63, 0.28, wz);
        taxiGroup.add(well);

        const arch = markSkipPrintEdges(new THREE.Mesh(archGeom, taxiRedMat));
        arch.rotation.y = Math.PI / 2;
        arch.position.set(side * 0.70, 0.28, wz);
        taxiGroup.add(arch);

        const tire = new THREE.Mesh(tireGeom, tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(wx, 0.255, wz);
        taxiGroup.add(tire);

        const hub = markSkipPrintEdges(new THREE.Mesh(hubGeom, taxiChromeMat));
        hub.rotation.z = Math.PI / 2;
        hub.position.set(wx, 0.255, wz);
        taxiGroup.add(hub);
      }
    }
  }

  // Wet parking-bay headlight & taillight reflection pools
  const taxiHeadPoolMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xffdfa2,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  spillMaterials.push({ mat: taxiHeadPoolMat, baseOpacity: 0.34 });
  const taxiHeadPool = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.3), taxiHeadPoolMat);
  taxiHeadPool.rotation.x = -Math.PI / 2;
  taxiHeadPool.position.set(0, 0.016, -2.15);
  taxiHeadPool.renderOrder = 4;
  taxiGroup.add(taxiHeadPool);

  const taxiTailPoolMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xff3b3b,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  spillMaterials.push({ mat: taxiTailPoolMat, baseOpacity: 0.28 });
  const taxiTailPool = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.55), taxiTailPoolMat);
  taxiTailPool.rotation.x = -Math.PI / 2;
  taxiTailPool.position.set(0, 0.016, 2.05);
  taxiTailPool.renderOrder = 4;
  taxiGroup.add(taxiTailPool);

  // =========================================================================
  // 5B. AUTHENTIC HONG KONG METERED KERBSIDE TAXI PARKING BAY (泊車位 + P 牌 + 圍欄)
  // Echoing the foreground parking lot in IMG_1635: x in [5.8, 9.2], z in [9.4, 13.8]
  // =========================================================================
  {
    const bayGroup = new THREE.Group();
    bayGroup.name = 'HK_MeteredTaxiParkingBay';
    const bayCX = 7.5;
    const bayCZ = 11.6;
    const bayW = 3.4;
    const bayD = 4.4;
    const bayY = 0.16;

    const bayPadMat = new THREE.MeshStandardMaterial({
      map: createParkingPadTexture(),
      roughness: 0.42,
      metalness: 0.14
    });
    applyRadialMistFade(bayPadMat, mistUniforms, viaductFade);

    const bayFenceMat = new THREE.MeshStandardMaterial({
      color: 0x26323e,
      roughness: 0.50,
      metalness: 0.62
    });
    applyRadialMistFade(bayFenceMat, mistUniforms, viaductFade);

    const bayCurbMat = new THREE.MeshStandardMaterial({
      color: 0x707e8c,
      roughness: 0.78,
      metalness: 0.08
    });
    applyRadialMistFade(bayCurbMat, mistUniforms, viaductFade);

    // Wet dark-asphalt concrete parking pad with painted white stall outline (+Y top face only!)
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(bayW, 0.024, bayD),
      [bayCurbMat, bayCurbMat, bayPadMat, bayCurbMat, bayCurbMat, bayCurbMat]
    );
    pad.position.set(bayCX, bayY + 0.012, bayCZ);
    pad.receiveShadow = true;
    bayGroup.add(pad);

    // Gentle dropped-curb driveway apron linking the wet road (x=5.1) to the parking bay (x=5.8)
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.020, bayD - 0.36), bayCurbMat);
    apron.position.set(5.46, bayY + 0.008, bayCZ);
    apron.receiveShadow = true;
    bayGroup.add(apron);

    // Concrete wheel-stop curb bumper near north head of bay
    const wheelStop = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.11, 0.16), bayCurbMat);
    wheelStop.position.set(bayCX, bayY + 0.075, bayCZ - 1.72);
    wheelStop.castShadow = true;
    bayGroup.add(wheelStop);

    // Low 3-sided dark-iron perimeter fence enclosing North (z=9.4), East (x=9.2), and South (z=13.8)
    // leaving West (x=5.8) driveway open to the wet avenue!
    const fenceH = 0.68;
    const addFenceRun = (x0: number, z0: number, x1: number, z1: number, posts: number) => {
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      const midX = (x0 + x1) * 0.5;
      const midZ = (z0 + z1) * 0.5;
      const angY = Math.atan2(dx, dz);

      for (const ry of [0.34, fenceH]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 8), bayFenceMat);
        rail.rotation.x = Math.PI / 2;
        rail.rotation.y = angY;
        rail.position.set(midX, bayY + ry, midZ);
        rail.castShadow = true;
        bayGroup.add(rail);
      }

      for (let i = 0; i < posts; i++) {
        const t = i / Math.max(1, posts - 1);
        const px = x0 + dx * t;
        const pz = z0 + dz * t;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.030, fenceH + 0.04, 8), bayFenceMat);
        post.position.set(px, bayY + (fenceH + 0.04) * 0.5, pz);
        post.castShadow = true;
        bayGroup.add(post);
      }
    };

    const xMin = bayCX - bayW * 0.5; // 5.8
    const xMax = bayCX + bayW * 0.5; // 9.2
    const zMin = bayCZ - bayD * 0.5; // 9.4
    const zMax = bayCZ + bayD * 0.5; // 13.8

    addFenceRun(xMin, zMin, xMax, zMin, 4); // North side
    addFenceRun(xMax, zMin, xMax, zMax, 5); // East side
    addFenceRun(xMin, zMax, xMax, zMax, 4); // South side

    // Classic Hong Kong Blue Square "P" Parking Signpost & Meter cleanly north of bay rail (5.85, 9.22)
    const pSignGroup = new THREE.Group();
    pSignGroup.position.set(5.85, bayY, 9.22);

    const pPost = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 2.25, 8), bayFenceMat);
    pPost.position.y = 1.125;
    pPost.castShadow = true;
    pSignGroup.add(pPost);

    const pFaceMat = new THREE.MeshStandardMaterial({
      map: createParkingSignTexture(),
      roughness: 0.38,
      metalness: 0.12
    });
    applyRadialMistFade(pFaceMat, mistUniforms, viaductFade);

    const pBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.64, 0.05),
      [bayFenceMat, bayFenceMat, bayFenceMat, bayFenceMat, pFaceMat, pFaceMat]
    );
    pBoard.position.set(0, 2.08, 0);
    pBoard.castShadow = true;
    pSignGroup.add(pBoard);

    // Slim Hong Kong Octopus Roadside Parking Meter (咪錶) right beside the P sign
    const meterPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 1.05, 8), bayFenceMat);
    meterPost.position.set(0.46, 0.525, -0.02);
    meterPost.castShadow = true;
    pSignGroup.add(meterPost);

    const meterHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.16), viaductTrimConcreteMat);
    meterHead.position.set(0.46, 1.16, -0.02);
    meterHead.castShadow = true;
    pSignGroup.add(meterHead);

    const meterScreenMat = new THREE.MeshStandardMaterial({
      color: 0x7ef2c4,
      emissive: new THREE.Color(0x38d898),
      emissiveIntensity: 0.95,
      roughness: 0.25
    });
    applyRadialMistFade(meterScreenMat, mistUniforms, viaductFade);
    emissiveTracks.push({ mat: meterScreenMat, base: 0.95 });
    const meterScreen = markSkipPrintEdges(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.02), meterScreenMat));
    meterScreen.position.set(0.46, 1.22, 0.065);
    pSignGroup.add(meterScreen);

    bayGroup.add(pSignGroup);
    group.add(bayGroup);
  }

  taxiGroup.position.set(7.5, 0.185, 11.6);
  taxiGroup.rotation.y = 0.0;
  group.add(taxiGroup);

  scene.add(group);

  let currentTramZ = 5.6;
  let currentTrainX = 2.2;
  let printModeActive = false;

  const update = (simTime: number) => {
    const tramRange = 60.0;
    const tramSpeed = 1.55;
    const tramOffset = ((5.6 + 30.0 + simTime * tramSpeed) % tramRange + tramRange) % tramRange;
    currentTramZ = tramOffset - 30.0;
    const tramSway = Math.sin(simTime * 4.2) * 0.008;
    tramGroup.position.set(-1.85, 0, currentTramZ);
    tramGroup.rotation.z = tramSway;

    const trainRange = 68.0;
    const trainSpeed = 2.75;
    const trainOffset = ((2.2 + 34.0 + simTime * trainSpeed) % trainRange + trainRange) % trainRange;
    currentTrainX = trainOffset - 34.0;
    trainGroup.position.set(currentTrainX, 0, bridgeZ);
  };

  update(0);

  return {
    group,
    tramGroup,
    trainGroup,
    taxiGroup,
    getTramPosition: () => new THREE.Vector3(-1.85, 2.2, currentTramZ),
    getTrainPosition: () => new THREE.Vector3(currentTrainX, railTopY + 1.2, bridgeZ),
    getTramProximity: () => Math.max(0, 1 - Math.abs(currentTramZ - 3.0) / 22.0),
    getTrainProximity: () => Math.max(0, 1 - Math.abs(currentTrainX - 1.0) / 24.0),
    setEmissiveScale: (scale) => {
      for (const e of emissiveTracks) {
        e.mat.emissiveIntensity = e.base * scale;
      }
      for (const l of movingLights) {
        l.light.intensity = printModeActive ? 0 : l.baseIntensity * Math.min(1.45, scale);
      }
      const beamScale = Math.min(1.4, 0.45 + scale * 0.55);
      for (const b of spillMaterials) {
        b.mat.opacity = printModeActive ? 0 : b.baseOpacity * beamScale;
      }
      for (const c of softCones) {
        c.mat.uniforms.uOpacity.value = printModeActive ? 0 : c.baseOpacity * beamScale;
      }
    },
    setPrintMode: (enabled) => {
      printModeActive = enabled;
      for (const b of spillMaterials) {
        b.mat.visible = !enabled;
      }
      for (const c of softCones) {
        c.mat.visible = !enabled;
      }
      for (const l of movingLights) {
        l.light.visible = !enabled;
      }
    },
    update
  };
}
