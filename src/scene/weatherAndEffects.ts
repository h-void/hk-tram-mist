import * as THREE from 'three';
import type { ViewMode } from '../ui/hud';
import { applyRadialMistFade, type RadialMistUniforms } from './atmosphere';
import { getHKSignalState } from './hkSignal';
import { createRippleTexture } from './textures';

interface PetalSeed {
  origin: THREE.Vector3;
  offsetAngle: number;
  radius: number;
  speed: number;
  phase: number;
}

interface BellPulse {
  origin: THREE.Vector3;
  followTram: boolean;
  startTime: number;
  ringA: THREE.Mesh;
  ringB: THREE.Mesh;
  matA: THREE.ShaderMaterial;
  matB: THREE.ShaderMaterial;
}

interface SteamWisp {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  dx: number;
  dz: number;
  period: number;
  phase: number;
  baseScale: number;
  curlAmp: number;
  rotSpeed: number;
}

export interface BellPulseOptions {
  followTram?: boolean;
  colorA?: number;
  colorB?: number;
}

export interface PrintEdgeSvgOptions {
  includePaperBg?: boolean;
}

export interface PrintEdgeSvgResult {
  svg: string;
  stats: {
    totalSegments: number;
    visibleSegments: number;
    paths: number;
  };
}

export interface WeatherAndEffectsSystem {
  group: THREE.Group;
  setRainOpacity: (opacity: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setPrintEdgesVisible: (visible: boolean) => void;
  getPrintEdgeSVG: (
    camera: THREE.OrthographicCamera,
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    svgOpts?: PrintEdgeSvgOptions
  ) => PrintEdgeSvgResult;
  triggerBellPulse: (origin: THREE.Vector3, simTime: number, pulseOpts?: BellPulseOptions) => void;
  update: (
    simTime: number,
    tramPos: THREE.Vector3,
    trainPos: THREE.Vector3,
    minibusPos: THREE.Vector3
  ) => void;
}

/**
 * Custom GLSL radial acoustic wavefront shader with luminous leading crest,
 * harmonic inner echo ripple, smooth Gaussian edge feathering, and radial mist fade.
 */
function createAcousticWaveMaterial(colorHex: number, initialOpacity = 0.5): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: initialOpacity }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vMistFade;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vMistFade = 1.0 - smoothstep(15.5, 24.5, length(wp.xz));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vMistFade;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0 || r < 0.34) discard;
        // glowing primary wavefront crest at r = 0.90 + harmonic trailing echo at r = 0.72 & 0.55
        float d1 = (r - 0.90) / 0.056;
        float d2 = (r - 0.72) / 0.066;
        float d3 = (r - 0.55) / 0.076;
        float crest = exp(-(d1 * d1));
        float echo = exp(-(d2 * d2)) * 0.44;
        float shimmer = exp(-(d3 * d3)) * 0.16;
        float outerMask = smoothstep(1.0, 0.93, r);
        float intensity = clamp((crest + echo + shimmer) * outerMask, 0.0, 1.0);
        float alpha = intensity * uOpacity * vMistFade;
        if (alpha < 0.006) discard;
        vec3 col = mix(uColor, vec3(1.0, 0.98, 0.94), crest * 0.36);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
}

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

/**
 * Soft organic curling steam-wisp sprite texture with strict circular zero-alpha
 * envelope by r = 0.43 * S so rising noodle-shop steam never shows hard quad edges.
 */
function createSteamWispTexture(): THREE.CanvasTexture {
  const S = 128;
  const rand = mulberry32(9951);
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);

  const core = ctx.createRadialGradient(S * 0.5, S * 0.5, 2, S * 0.5, S * 0.5, S * 0.36);
  core.addColorStop(0, 'rgba(255, 246, 232, 0.78)');
  core.addColorStop(0.45, 'rgba(255, 238, 214, 0.38)');
  core.addColorStop(0.82, 'rgba(232, 236, 242, 0.08)');
  core.addColorStop(1, 'rgba(232, 236, 242, 0.0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  // Soft wispy off-center billowing sub-puffs strictly inside safe circular radius
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + rand() * 0.6;
    const dist = (0.06 + rand() * 0.12) * S;
    const cx = S * 0.5 + Math.cos(ang) * dist;
    const cy = S * 0.5 + Math.sin(ang) * dist;
    const rad = (0.14 + rand() * 0.10) * S;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
    g.addColorStop(0, 'rgba(255, 248, 236, 0.32)');
    g.addColorStop(0.6, 'rgba(255, 240, 222, 0.10)');
    g.addColorStop(1, 'rgba(255, 240, 222, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Strict circular alpha mask hitting exact 0.0 by r = 0.43 * S
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.10, S * 0.5, S * 0.5, S * 0.43);
  mask.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  mask.addColorStop(0.60, 'rgba(255, 255, 255, 0.58)');
  mask.addColorStop(0.88, 'rgba(255, 255, 255, 0.10)');
  mask.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createWeatherAndEffects(
  scene: THREE.Scene,
  opts: {
    mistUniforms: RadialMistUniforms;
    neonPositions: THREE.Vector3[];
    bauhiniaCenters: THREE.Vector3[];
    printTargetGroups: {
      buildings: THREE.Group;
      viaductAndVehicles: THREE.Group;
      props: THREE.Group;
      road: THREE.Group;
      tramGroup: THREE.Group;
      taxiGroup: THREE.Group;
    };
  }
): WeatherAndEffectsSystem {
  const group = new THREE.Group();
  group.name = 'WeatherAndEffectsGroup';
  const rand = mulberry32(202608);

  // =========================================================================
  // 1. Tapered GLSL diagonal rain streaks (~620 streaks, GPU vertex animated)
  // =========================================================================
  const RAIN_COUNT = 620;
  const rainOrigins = new Float32Array(RAIN_COUNT * 2 * 3);
  const rainParams = new Float32Array(RAIN_COUNT * 2 * 3); // (speed, len, end)

  for (let i = 0; i < RAIN_COUNT; i++) {
    const rx = (rand() - 0.5) * 44;
    const ry0 = rand() * 19;
    const rz = (rand() - 0.5) * 44;
    const speed = 13.0 + rand() * 5.2;
    const len = 0.46 + rand() * 0.38;

    const pIdx = i * 6;
    // Top tail vertex (end = 0.0) & falling tip vertex (end = 1.0)
    rainOrigins[pIdx] = rx;
    rainOrigins[pIdx + 1] = ry0;
    rainOrigins[pIdx + 2] = rz;
    rainOrigins[pIdx + 3] = rx;
    rainOrigins[pIdx + 4] = ry0;
    rainOrigins[pIdx + 5] = rz;

    rainParams[pIdx] = speed;
    rainParams[pIdx + 1] = len;
    rainParams[pIdx + 2] = 0.0;
    rainParams[pIdx + 3] = speed;
    rainParams[pIdx + 4] = len;
    rainParams[pIdx + 5] = 1.0;
  }

  const rainGeom = new THREE.BufferGeometry();
  rainGeom.setAttribute('position', new THREE.BufferAttribute(rainOrigins, 3));
  rainGeom.setAttribute('aParams', new THREE.BufferAttribute(rainParams, 3));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0x9cb8d4) },
      uOpacity: { value: 0.16 },
      uTime: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec3 aParams;
      varying float vEnd;
      varying float vRadialFade;
      void main() {
        float speed = aParams.x;
        float len = aParams.y;
        float endFlag = aParams.z;
        vEnd = endFlag;
        float y = mod(mod(position.y - uTime * speed, 19.0) + 19.0, 19.0);
        vec3 animated = vec3(
          position.x - endFlag * len * 0.20,
          y + (1.0 - endFlag) * len,
          position.z + endFlag * len * 0.06
        );
        vec4 wp = modelMatrix * vec4(animated, 1.0);
        float dist = length(wp.xz);
        vRadialFade = 1.0 - smoothstep(14.5, 25.0, dist);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vEnd;
      varying float vRadialFade;
      void main() {
        float taper = pow(clamp(vEnd, 0.0, 1.0), 1.65);
        float alpha = uOpacity * taper * vRadialFade;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
  const rainLines = new THREE.LineSegments(rainGeom, rainMat);
  rainLines.frustumCulled = false;
  rainLines.renderOrder = 9;
  group.add(rainLines);

  // =========================================================================
  // 2. Concentric expanding wet puddle ripples (collected for single GPU InstancedMesh)
  // =========================================================================
  const rippleTex = createRippleTexture();
  const roadRippleSpecs: Array<{
    x: number;
    y: number;
    z: number;
    period: number;
    phase: number;
    minScale: number;
    scaleSpan: number;
    duty: number;
    peakOpacity: number;
    tintMix: number;
  }> = [];
  for (let i = 0; i < 34; i++) {
    roadRippleSpecs.push({
      x: (rand() - 0.5) * 8.8,
      y: 0.045,
      z: (rand() - 0.5) * 26.0,
      period: 1.15 + rand() * 1.15,
      phase: rand() * 4.0,
      minScale: 0.14,
      scaleSpan: 0.34 + rand() * 0.38,
      duty: 1.0,
      peakOpacity: 0.14,
      tintMix: 0.0
    });
  }

  // =========================================================================
  // 3. GENTLY DRIFTING BAUHINIA (洋紫荊) BLOSSOM PETALS
  // =========================================================================
  const PETAL_COUNT = 48;
  const petalSeeds: PetalSeed[] = [];
  const petalGeom = new THREE.PlaneGeometry(0.09, 0.06);
  const petalMat = new THREE.MeshBasicMaterial({
    color: 0xf0adc8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  const petalInst = new THREE.InstancedMesh(petalGeom, petalMat, PETAL_COUNT);
  petalInst.renderOrder = 7;

  const centers =
    opts.bauhiniaCenters.length > 0
      ? opts.bauhiniaCenters
      : [new THREE.Vector3(-8.6, 2.9, 12.0)];

  for (let i = 0; i < PETAL_COUNT; i++) {
    const origin = centers[i % centers.length].clone();
    petalSeeds.push({
      origin,
      offsetAngle: rand() * Math.PI * 2,
      radius: 0.35 + rand() * 2.1,
      speed: 0.48 + rand() * 0.42,
      phase: rand() * 10.0
    });
  }
  group.add(petalInst);

  // =========================================================================
  // 3B. GENTLY RISING WARM-LIT NOODLE-SHOP STEAM WISPS (熱氣騰騰雲吞麵檔白煙)
  // Curling softly up from outside 明記雲吞麵 (x = -6.2, y = 1.5..4.1, z = 0.45)
  // =========================================================================
  const steamGroup = new THREE.Group();
  steamGroup.name = 'NoodleShopSteamWisps';
  const steamTex = createSteamWispTexture();
  const steamWisps: SteamWisp[] = [];
  const STEAM_ORIGIN_X = -6.15;
  const STEAM_ORIGIN_Z = 0.45;
  const STEAM_COUNT = 14;

  for (let i = 0; i < STEAM_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: steamTex,
      color: new THREE.Color(0xffe6c2),
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 8;
    steamGroup.add(sprite);
    steamWisps.push({
      sprite,
      mat,
      dx: (rand() - 0.5) * 0.46,
      dz: (rand() - 0.5) * 1.18,
      period: 3.1 + rand() * 1.7,
      phase: (i / STEAM_COUNT) * 4.5 + rand() * 0.7,
      baseScale: 0.54 + rand() * 0.28,
      curlAmp: 0.18 + rand() * 0.17,
      rotSpeed: (rand() - 0.5) * 0.55
    });
  }
  group.add(steamGroup);

  // =========================================================================
  // 4. [A] ACOUSTIC FIELD MODE — CUSTOM GLSL MULTI-HARMONIC SOUND WAVEFRONTS
  // =========================================================================
  const acousticGroup = new THREE.Group();
  acousticGroup.name = 'AcousticFieldGroup';
  acousticGroup.visible = false;

  const flatWaveGeom = new THREE.PlaneGeometry(2.0, 2.0);
  flatWaveGeom.rotateX(-Math.PI / 2);

  // Neon transformer 50Hz hum micro-wavefronts around every projecting HK neon sign
  const neonWaveRings: Array<{
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
    origin: THREE.Vector3;
    phase: number;
  }> = [];
  opts.neonPositions.forEach((pos, idx) => {
    const colorHex = idx % 3 === 0 ? 0xff7896 : idx % 3 === 1 ? 0x62e8ff : 0xffbe5c;
    const mat = createAcousticWaveMaterial(colorHex, 0.52);
    const ring = new THREE.Mesh(flatWaveGeom, mat);
    ring.position.copy(pos);
    ring.renderOrder = 10;
    acousticGroup.add(ring);
    neonWaveRings.push({ mesh: ring, mat, origin: pos.clone(), phase: idx * 0.72 });
  });

  // Tram ambient rail-hum, Elevated Train steel viaduct resonance, and Minibus #28 engine wavefronts
  const tramHumRings: Array<{ mesh: THREE.Mesh; mat: THREE.ShaderMaterial; offset: number }> = [];
  for (let i = 0; i < 3; i++) {
    const mat = createAcousticWaveMaterial(0xffcc64, 0.58);
    const mesh = new THREE.Mesh(flatWaveGeom, mat);
    mesh.renderOrder = 10;
    acousticGroup.add(mesh);
    tramHumRings.push({ mesh, mat, offset: i / 3 });
  }

  const trainHumRings: Array<{ mesh: THREE.Mesh; mat: THREE.ShaderMaterial; offset: number }> = [];
  for (let i = 0; i < 3; i++) {
    const mat = createAcousticWaveMaterial(0x76e0ff, 0.54);
    const mesh = new THREE.Mesh(flatWaveGeom, mat);
    mesh.renderOrder = 10;
    acousticGroup.add(mesh);
    trainHumRings.push({ mesh, mat, offset: i / 3 });
  }

  const minibusHumRings: Array<{ mesh: THREE.Mesh; mat: THREE.ShaderMaterial; offset: number }> = [];
  for (let i = 0; i < 2; i++) {
    const mat = createAcousticWaveMaterial(0x52e8a4, 0.48);
    const mesh = new THREE.Mesh(flatWaveGeom, mat);
    mesh.renderOrder = 10;
    acousticGroup.add(mesh);
    minibusHumRings.push({ mesh, mat, offset: i / 2 });
  }

  // Hong Kong Electronic Audible Crossing Signal emerald pulse rings at both zebra traffic poles
  const crossingBeepRings: Array<{
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
    x: number;
    z: number;
    offset: number;
  }> = [];
  for (const sx of [-5.45, 5.45]) {
    for (let i = 0; i < 2; i++) {
      const mat = createAcousticWaveMaterial(0x52ffa8, 0.55);
      const mesh = new THREE.Mesh(flatWaveGeom, mat);
      mesh.position.set(sx, 1.38, 2.1);
      mesh.renderOrder = 10;
      acousticGroup.add(mesh);
      crossingBeepRings.push({ mesh, mat, x: sx, z: 2.1, offset: i * 0.5 });
    }
  }

  // Puddle acoustic rain-impact rings (elevated delicate cyan-white sound blooms)
  const rainAcousticRings: Array<{
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
    x: number;
    z: number;
    phase: number;
    period: number;
  }> = [];
  for (let i = 0; i < 10; i++) {
    const mat = createAcousticWaveMaterial(0x9de6ff, 0.42);
    const mesh = new THREE.Mesh(flatWaveGeom, mat);
    const rx = (rand() - 0.5) * 8.6;
    const rz = (rand() - 0.5) * 20.0;
    mesh.position.set(rx, 0.14, rz);
    mesh.renderOrder = 10;
    acousticGroup.add(mesh);
    rainAcousticRings.push({
      mesh,
      mat,
      x: rx,
      z: rz,
      phase: rand() * 3.0,
      period: 1.6 + rand() * 0.9
    });
  }

  group.add(acousticGroup);

  // Interactive Tram Bell ("叮叮") Double-Ding Golden Wavefront Pool (visible in both Diorama & Acoustic modes)
  const bellBurstGroup = new THREE.Group();
  bellBurstGroup.name = 'TramBellWaveBursts';
  group.add(bellBurstGroup);
  const activeBellPulses: BellPulse[] = [];

  const triggerBellPulse = (origin: THREE.Vector3, simTime: number, pulseOpts?: BellPulseOptions) => {
    const followTram = pulseOpts?.followTram ?? true;
    const makeBellRing = (hex: number) => {
      const mat = createAcousticWaveMaterial(hex, 0.92);
      const ring = new THREE.Mesh(flatWaveGeom, mat);
      ring.position.set(origin.x, origin.y + 1.4, origin.z);
      ring.renderOrder = 11;
      bellBurstGroup.add(ring);
      return { ring, mat };
    };

    const a = makeBellRing(pulseOpts?.colorA ?? 0xffdc78);
    const b = makeBellRing(pulseOpts?.colorB ?? 0xffa942);
    activeBellPulses.push({
      origin: origin.clone(),
      followTram,
      startTime: simTime,
      ringA: a.ring,
      ringB: b.ring,
      matA: a.mat,
      matB: b.mat
    });
  };

  // =========================================================================
  // 4B. GLIDING RAIN-MIST URBAN PIGEONS (雨霧飛鳥) & EAVE RAIN DRIPS (屋檐滴水)
  // =========================================================================
  const birdsGroup = new THREE.Group();
  birdsGroup.name = 'RainMistPigeons';
  const birdBodyMat = new THREE.MeshStandardMaterial({
    color: 0xd8e2ec,
    roughness: 0.70,
    metalness: 0.05
  });
  const birdWingMat = new THREE.MeshStandardMaterial({
    color: 0x465868,
    roughness: 0.66,
    side: THREE.DoubleSide
  });

  interface BirdEntry {
    root: THREE.Group;
    wingL: THREE.Group;
    wingR: THREE.Group;
    cx: number;
    cz: number;
    rx: number;
    rz: number;
    baseY: number;
    speed: number;
    phase: number;
  }

  const birds: BirdEntry[] = [];
  const birdConfigs = [
    { cx: -0.8, cz: -2.4, rx: 10.5, rz: 7.4, baseY: 11.4, speed: 0.24, phase: 0.4 },
    { cx: -0.2, cz: -1.8, rx: 11.2, rz: 7.9, baseY: 11.8, speed: 0.24, phase: 0.62 },
    { cx: 1.5, cz: -3.2, rx: 9.6, rz: 6.8, baseY: 10.7, speed: 0.24, phase: 0.86 }
  ];

  const wingGeom = new THREE.PlaneGeometry(0.35, 0.17);
  for (const cfg of birdConfigs) {
    const bRoot = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.32, 6), birdBodyMat);
    body.rotation.x = Math.PI / 2;
    bRoot.add(body);

    const wingL = new THREE.Group();
    wingL.position.set(-0.035, 0.012, 0);
    const wingLMesh = new THREE.Mesh(wingGeom, birdWingMat);
    wingLMesh.rotation.x = -Math.PI / 2;
    wingLMesh.position.set(-0.175, 0, 0);
    wingL.add(wingLMesh);
    bRoot.add(wingL);

    const wingR = new THREE.Group();
    wingR.position.set(0.035, 0.012, 0);
    const wingRMesh = new THREE.Mesh(wingGeom, birdWingMat);
    wingRMesh.rotation.x = -Math.PI / 2;
    wingRMesh.position.set(0.175, 0, 0);
    wingR.add(wingRMesh);
    bRoot.add(wingR);

    birdsGroup.add(bRoot);
    birds.push({ root: bRoot, wingL, wingR, ...cfg });
  }
  group.add(birdsGroup);

  // Delicate falling water beads dripping off 金鳳冰室 striped awning edge & elevated viaduct drain spouts
  interface EaveDripSeed {
    x: number;
    yTop: number;
    yBot: number;
    z: number;
    period: number;
    phase: number;
  }
  const dripSeeds: EaveDripSeed[] = [];
  // Cha Chaan Teng east & south striped awning edges (y = 2.86 -> 0.18)
  for (let i = 0; i < 8; i++) {
    dripSeeds.push({
      x: -6.28,
      yTop: 2.84,
      yBot: 0.18,
      z: 4.35 + i * 0.68,
      period: 1.05 + rand() * 0.65,
      phase: rand() * 2.0
    });
  }
  for (let i = 0; i < 6; i++) {
    dripSeeds.push({
      x: -11.45 + i * 0.92,
      yTop: 2.84,
      yBot: 0.18,
      z: 9.85,
      period: 1.10 + rand() * 0.70,
      phase: rand() * 2.0
    });
  }
  // Viaduct south deck drainage spouts (y = 5.42 -> 0.06)
  for (const vx of [-11.5, -5.2, 0.4, 5.1, 10.6, 15.8]) {
    dripSeeds.push({
      x: vx,
      yTop: 5.42,
      yBot: 0.08,
      z: -1.72,
      period: 1.25 + rand() * 0.65,
      phase: rand() * 2.5
    });
  }

  const dripMat = new THREE.MeshBasicMaterial({
    color: 0xcfe4f6,
    transparent: true,
    opacity: 0.48,
    depthWrite: false
  });
  const dripGeom = new THREE.CylinderGeometry(0.012, 0.018, 0.16, 5);
  const eaveDripsInst = new THREE.InstancedMesh(dripGeom, dripMat, dripSeeds.length);
  eaveDripsInst.renderOrder = 8;
  group.add(eaveDripsInst);

  // Synchronized GPU-animated Instanced Ripple Mesh (34 road puddle ripples + 20 eave drip impact ripples = 1 draw call)
  const allRippleSpecs = [
    ...roadRippleSpecs,
    ...dripSeeds.map((d) => ({
      x: d.x,
      y: d.yBot + 0.012,
      z: d.z,
      period: d.period,
      phase: d.phase,
      minScale: 0.08,
      scaleSpan: 0.34,
      duty: 0.42,
      peakOpacity: 0.24,
      tintMix: 1.0
    }))
  ];
  const rippleCount = allRippleSpecs.length;
  const baseRipplePlane = new THREE.PlaneGeometry(1.0, 1.0);
  baseRipplePlane.rotateX(-Math.PI / 2);
  const instRippleGeom = new THREE.InstancedBufferGeometry();
  instRippleGeom.index = baseRipplePlane.index;
  instRippleGeom.attributes.position = baseRipplePlane.attributes.position;
  instRippleGeom.attributes.uv = baseRipplePlane.attributes.uv;
  instRippleGeom.instanceCount = rippleCount;

  const rCenters = new Float32Array(rippleCount * 3);
  const rTimings = new Float32Array(rippleCount * 4);
  const rScales = new Float32Array(rippleCount * 3);
  for (let i = 0; i < rippleCount; i++) {
    const r = allRippleSpecs[i];
    rCenters[i * 3] = r.x;
    rCenters[i * 3 + 1] = r.y;
    rCenters[i * 3 + 2] = r.z;
    rTimings[i * 4] = r.period;
    rTimings[i * 4 + 1] = r.phase;
    rTimings[i * 4 + 2] = r.duty;
    rTimings[i * 4 + 3] = r.peakOpacity;
    rScales[i * 3] = r.minScale;
    rScales[i * 3 + 1] = r.scaleSpan;
    rScales[i * 3 + 2] = r.tintMix;
  }
  instRippleGeom.setAttribute('aCenter', new THREE.InstancedBufferAttribute(rCenters, 3));
  instRippleGeom.setAttribute('aTiming', new THREE.InstancedBufferAttribute(rTimings, 4));
  instRippleGeom.setAttribute('aScaleTint', new THREE.InstancedBufferAttribute(rScales, 3));

  const allRipplesMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMap: { value: rippleTex },
      uTime: { value: 0.0 },
      uRainScale: { value: 1.0 },
      uColorA: { value: new THREE.Color(0xa4c4de) },
      uColorB: { value: new THREE.Color(0xbce0f6) }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uRainScale;
      attribute vec3 aCenter;
      attribute vec4 aTiming;
      attribute vec3 aScaleTint;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vTint;
      void main() {
        vUv = uv;
        vTint = aScaleTint.z;
        float period = aTiming.x;
        float phase = aTiming.y;
        float duty = aTiming.z;
        float peakOp = aTiming.w;

        float t = mod(mod(uTime + phase, period) + period, period);
        float u = t / period;
        if (u >= duty) {
          vAlpha = 0.0;
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
        float ru = u / duty;
        float sc = aScaleTint.x + ru * aScaleTint.y;
        vAlpha = sin(ru * 3.14159265) * peakOp * uRainScale;
        vec3 wp = aCenter + position * sc;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vTint;
      void main() {
        if (vAlpha < 0.002) discard;
        vec4 tex = texture2D(uMap, vUv);
        float a = tex.a * vAlpha;
        if (a < 0.002) discard;
        vec3 col = mix(uColorA, uColorB, vTint) * tex.rgb;
        gl_FragColor = vec4(col, a);
      }
    `
  });

  const allRipplesMesh = new THREE.Mesh(instRippleGeom, allRipplesMat);
  allRipplesMesh.name = 'AllRainRipplesInstanced';
  allRipplesMesh.frustumCulled = false;
  allRipplesMesh.renderOrder = 5;
  group.add(allRipplesMesh);

  // =========================================================================
  // 5. [P] Axonometric line-art print mode (Matte Paper #F4EFE6 + Prussian/Pine/Cinnabar Ink)
  // =========================================================================
  const savedMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const savedVisibility = new Map<THREE.Object3D, boolean>();
  const printMaterialTargets: Array<{ mesh: THREE.Mesh; printMat: THREE.Material }> = [];
  const printDecalTargets: THREE.Object3D[] = [];
  const allPrintEdges: Array<{ line: THREE.LineSegments; src: THREE.Mesh }> = [];
  const dynamicPrintEdges: Array<{ line: THREE.LineSegments; src: THREE.Mesh }> = [];
  let printEdgesGroup: THREE.Group | null = null;
  let printCacheBuilt = false;
  let printModeActive = false;

  const xuanPaperMat = new THREE.MeshBasicMaterial({
    color: 0xf4efe6,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });
  const xuanWarmTintMat = new THREE.MeshBasicMaterial({
    color: 0xebe3d4,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });
  applyRadialMistFade(xuanWarmTintMat, opts.mistUniforms, {
    innerR: 17.0,
    outerR: 25.0,
    fadeAlpha: false
  });
  const xuanCinnabarTintMat = new THREE.MeshBasicMaterial({
    color: 0xf3e4dc,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });
  // Whisper-delicate botanical matte paper washes for Hong Kong Bauhinia & Weeping Banyan canopies
  const xuanBauhiniaMat = new THREE.MeshBasicMaterial({
    color: 0xeddcd7,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });
  const xuanBanyanMat = new THREE.MeshBasicMaterial({
    color: 0xe0e8de,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });

  const inkPrussianMat = new THREE.LineBasicMaterial({ color: 0x1e3a5c, transparent: true, opacity: 0.84 });
  const inkPineSootMat = new THREE.LineBasicMaterial({ color: 0x262d34, transparent: true, opacity: 0.72 });
  const inkCinnabarMat = new THREE.LineBasicMaterial({ color: 0xb83b2e, transparent: true, opacity: 0.92 });
  applyRadialMistFade(inkPrussianMat, opts.mistUniforms, {
    innerR: 16.5,
    outerR: 24.5,
    fadeAlpha: true
  });
  applyRadialMistFade(inkPineSootMat, opts.mistUniforms, {
    innerR: 16.0,
    outerR: 24.0,
    fadeAlpha: true
  });
  applyRadialMistFade(inkCinnabarMat, opts.mistUniforms, {
    innerR: 17.5,
    outerR: 25.5,
    fadeAlpha: true
  });

  const isInsideAncestor = (obj: THREE.Object3D, ancestor: THREE.Object3D): boolean => {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur === ancestor) return true;
      cur = cur.parent;
    }
    return false;
  };

  const hasSkipPrintEdges = (obj: THREE.Object3D): boolean => {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.userData && cur.userData.skipPrintEdges === true) return true;
      cur = cur.parent;
    }
    return false;
  };

  const buildPrintCacheOnce = () => {
    if (printCacheBuilt) return;
    printCacheBuilt = true;

    const { buildings, viaductAndVehicles, props, road, tramGroup, taxiGroup } =
      opts.printTargetGroups;
    const allTargets = [buildings, viaductAndVehicles, props, road];

    printEdgesGroup = new THREE.Group();
    printEdgesGroup.name = 'ArchivalPrintInkLines';
    printEdgesGroup.visible = false;
    scene.add(printEdgesGroup);

    for (const root of allTargets) {
      root.updateMatrixWorld(true);
      const isDynamicRoot = root === viaductAndVehicles || root === props;
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;

        // Override ExtendedGroundPlane to pure matte paper (#F4EFE6) without edges
        if (obj.name === 'ExtendedGroundPlane') {
          printMaterialTargets.push({ mesh: obj, printMat: xuanPaperMat });
          return;
        }

        // Skip reflector, shadow decals, puddle glows, and volumetric light cones
        const singleMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const isDecalOrBeam =
          obj.name === 'PlanarWetRoadReflector' ||
          singleMat instanceof THREE.ShaderMaterial ||
          (singleMat instanceof THREE.MeshBasicMaterial && singleMat.transparent);

        if (isDecalOrBeam) {
          if (obj.name !== 'PlanarWetRoadReflector') {
            printDecalTargets.push(obj);
          }
          return;
        }

        const isHeroAccent = isInsideAncestor(obj, tramGroup) || isInsideAncestor(obj, taxiGroup);
        const isRoadOrRail = isInsideAncestor(obj, road);
        const botanical = obj.userData.printBotanical as 'bauhinia' | 'banyan' | undefined;

        if (obj instanceof THREE.InstancedMesh) {
          printMaterialTargets.push({ mesh: obj, printMat: xuanWarmTintMat });
          return;
        }

        const printMat =
          botanical === 'bauhinia'
            ? xuanBauhiniaMat
            : botanical === 'banyan'
            ? xuanBanyanMat
            : isHeroAccent
            ? xuanCinnabarTintMat
            : isRoadOrRail
            ? xuanPaperMat
            : xuanWarmTintMat;
        printMaterialTargets.push({ mesh: obj, printMat });

        // Generate crisp 26-degree architectural ink edges ONCE and cache for instant [P] toggles
        if (
          obj.geometry &&
          obj.name !== 'WetAsphaltRoad' &&
          obj.name !== 'SidewalkOuterDeck' &&
          !hasSkipPrintEdges(obj)
        ) {
          const edgesGeom = new THREE.EdgesGeometry(obj.geometry, 26);
          if (edgesGeom.attributes.position && edgesGeom.attributes.position.count > 0) {
            const inkRole = isHeroAccent ? 'cinnabar' : isRoadOrRail ? 'pine' : 'prussian';
            const lineMat =
              inkRole === 'cinnabar'
                ? inkCinnabarMat
                : inkRole === 'pine'
                ? inkPineSootMat
                : inkPrussianMat;
            const edgeLine = new THREE.LineSegments(edgesGeom, lineMat);
            edgeLine.matrixAutoUpdate = false;
            edgeLine.matrix.copy(obj.matrixWorld);
            edgeLine.userData.sourceMesh = obj;
            edgeLine.userData.inkRole = inkRole;
            printEdgesGroup!.add(edgeLine);
            const entry = { line: edgeLine, src: obj };
            allPrintEdges.push(entry);
            if (isDynamicRoot) {
              dynamicPrintEdges.push(entry);
            }
          } else {
            edgesGeom.dispose();
          }
        }
      });
    }
  };

  const syncAllPrintEdgeMatrices = () => {
    const { buildings, viaductAndVehicles, props, road } = opts.printTargetGroups;
    buildings.updateMatrixWorld(true);
    viaductAndVehicles.updateMatrixWorld(true);
    props.updateMatrixWorld(true);
    road.updateMatrixWorld(true);
    for (let i = 0; i < allPrintEdges.length; i++) {
      const entry = allPrintEdges[i];
      entry.line.matrix.copy(entry.src.matrixWorld);
    }
  };

  const buildOrShowPrintMode = (enable: boolean) => {
    if (enable === printModeActive) return;
    printModeActive = enable;

    if (enable) {
      buildPrintCacheOnce();
      savedMaterials.clear();
      savedVisibility.clear();

      for (let i = 0; i < printMaterialTargets.length; i++) {
        const { mesh, printMat } = printMaterialTargets[i];
        savedMaterials.set(mesh, mesh.material);
        mesh.material = printMat;
      }
      for (let i = 0; i < printDecalTargets.length; i++) {
        const obj = printDecalTargets[i];
        savedVisibility.set(obj, obj.visible);
        obj.visible = false;
      }

      syncAllPrintEdgeMatrices();
      if (printEdgesGroup) {
        printEdgesGroup.visible = true;
      }
    } else {
      for (const [mesh, origMat] of savedMaterials.entries()) {
        mesh.material = origMat;
      }
      savedMaterials.clear();

      for (const [obj, vis] of savedVisibility.entries()) {
        obj.visible = vis;
      }
      savedVisibility.clear();

      if (printEdgesGroup) {
        printEdgesGroup.visible = false;
      }
    }
  };

  /**
   * Native Orthographic 24-bit Depth-Buffered Hidden-Line-Removed Vector SVG Exporter.
   * Clamps GPU render target dimensions cleanly (<= 4096 / MAX_RENDERBUFFER_SIZE / MAX_TEXTURE_SIZE),
   * matches the requested output aspect ratio without distortion, and projects live 26-degree
   * architectural edges into crisp layered <path> ink groups with radial Xuan-paper fade.
   */
  const getPrintEdgeSVG = (
    camera: THREE.OrthographicCamera,
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    svgOpts?: PrintEdgeSvgOptions
  ): PrintEdgeSvgResult => {
    const includePaperBg = svgOpts?.includePaperBg ?? false;
    const outW = Math.max(1, Math.round(width));
    const outH = Math.max(1, Math.round(height));

    if (!printEdgesGroup || !printModeActive) {
      const bgRect = includePaperBg
        ? `<rect width="${outW}" height="${outH}" fill="#F4EFE6"/>`
        : '';
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outW} ${outH}" width="${outW}" height="${outH}">${bgRect}</svg>`,
        stats: { totalSegments: 0, visibleSegments: 0, paths: 0 }
      };
    }

    syncAllPrintEdgeMatrices();

    const gl = renderer.getContext();
    const maxRb = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || 4096;
    const maxTex = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
    const maxDim = Math.min(maxRb, maxTex, 4096);
    const desiredScale = 3;
    const effectiveScale = Math.min(desiredScale, maxDim / Math.max(outW, outH));
    const rtW = Math.max(64, Math.min(maxDim, Math.round(outW * effectiveScale)));
    const rtH = Math.max(64, Math.min(maxDim, Math.round(outH * effectiveScale)));
    const scaleX = rtW / outW;
    const scaleY = rtH / outH;

    const rt = new THREE.WebGLRenderTarget(rtW, rtH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false
    });

    const depthMat = new THREE.ShaderMaterial({
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
      vertexShader: /* glsl */ `
        void main() {
          vec4 mv = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            mv = instanceMatrix * mv;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        void main() {
          float z = clamp(gl_FragCoord.z, 0.0, 1.0);
          float s = floor(z * 16777215.0 + 0.5);
          float r = floor(s / 65536.0);
          float g = floor(mod(s, 65536.0) / 256.0);
          float b = mod(s, 256.0);
          gl_FragColor = vec4(r / 255.0, g / 255.0, b / 255.0, 1.0);
        }
      `
    });

    const prevOverride = scene.overrideMaterial;
    const prevEdgesVis = printEdgesGroup.visible;
    const prevWeatherVis = group.visible;
    const prevRT = renderer.getRenderTarget();
    const prevClearCol = new THREE.Color();
    renderer.getClearColor(prevClearCol);
    const prevClearAlpha = renderer.getClearAlpha();

    // Save camera frustum so we can match requested outW/outH aspect cleanly without stretching
    const prevLeft = camera.left;
    const prevRight = camera.right;
    const prevTop = camera.top;
    const prevBottom = camera.bottom;
    const prevSpanX = prevRight - prevLeft;
    const prevSpanY = prevTop - prevBottom;
    const centerX = (prevLeft + prevRight) * 0.5;
    const centerY = (prevTop + prevBottom) * 0.5;
    const curAspect = prevSpanX / Math.max(1e-5, prevSpanY);
    const outAspect = outW / outH;
    let frustumAdjusted = false;

    const pixels = new Uint8Array(rtW * rtH * 4);
    const mvp = new THREE.Matrix4();

    try {
      if (Math.abs(outAspect - curAspect) > 1e-4) {
        let targetSpanY = prevSpanY;
        if (curAspect < 1.0 && outAspect >= 1.0) {
          targetSpanY = Math.min(prevSpanY, Math.max(32.8, prevSpanX / outAspect));
        }
        const targetSpanX = targetSpanY * outAspect;
        camera.left = centerX - targetSpanX * 0.5;
        camera.right = centerX + targetSpanX * 0.5;
        camera.top = centerY + targetSpanY * 0.5;
        camera.bottom = centerY - targetSpanY * 0.5;
        camera.updateProjectionMatrix();
        frustumAdjusted = true;
      }

      // Hide lines & weather sprites; render exact solid occluder depth map
      printEdgesGroup.visible = false;
      group.visible = false;
      scene.overrideMaterial = depthMat;
      camera.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);

      renderer.setRenderTarget(rt);
      renderer.setClearColor(0xffffff, 1);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);

      renderer.readRenderTargetPixels(rt, 0, 0, rtW, rtH, pixels);
      mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    } finally {
      if (frustumAdjusted) {
        camera.left = prevLeft;
        camera.right = prevRight;
        camera.top = prevTop;
        camera.bottom = prevBottom;
        camera.updateProjectionMatrix();
      }
      renderer.setRenderTarget(prevRT);
      renderer.setClearColor(prevClearCol, prevClearAlpha);
      scene.overrideMaterial = prevOverride;
      printEdgesGroup.visible = prevEdgesVis;
      group.visible = prevWeatherVis;
      rt.dispose();
      depthMat.dispose();
    }

    const sampleMaxDepth = (sx: number, sy: number): number => {
      const cx = Math.min(rtW - 1, Math.max(0, Math.round(sx * scaleX)));
      const cy = Math.min(rtH - 1, Math.max(0, Math.round((outH - sy) * scaleY)));
      let maxD = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const py = Math.min(rtH - 1, Math.max(0, cy + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const px = Math.min(rtW - 1, Math.max(0, cx + dx));
          const idx = (py * rtW + px) * 4;
          const d = (pixels[idx] * 65536 + pixels[idx + 1] * 256 + pixels[idx + 2]) / 16777215.0;
          if (d > maxD) maxD = d;
        }
      }
      return maxD;
    };

    const smoothstep = (e0: number, e1: number, x: number): number => {
      const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };

    const roleCfg: Record<
      'prussian' | 'pine' | 'cinnabar',
      { stroke: string; baseOp: number; width: string; innerR: number; outerR: number }
    > = {
      prussian: { stroke: '#1e3a5c', baseOp: 0.875, width: '0.42', innerR: 16.5, outerR: 24.5 },
      pine: { stroke: '#262d34', baseOp: 0.75, width: '0.40', innerR: 16.0, outerR: 24.0 },
      cinnabar: { stroke: '#b83b2e', baseOp: 1.0, width: '0.48', innerR: 17.5, outerR: 25.5 }
    };

    const buckets = new Map<string, { stroke: string; opacity: string; width: string; segs: string[] }>();
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    const pM = new THREE.Vector3();
    const nA = new THREE.Vector3();
    const nB = new THREE.Vector3();
    const nM = new THREE.Vector3();
    const DEPTH_BIAS = 0.00145;

    let totalSegments = 0;
    let visibleSegments = 0;

    for (const ch of printEdgesGroup.children) {
      if (!(ch instanceof THREE.LineSegments)) continue;
      const role = (ch.userData.inkRole as 'prussian' | 'pine' | 'cinnabar' | undefined) ?? 'prussian';
      const cfg = roleCfg[role];
      const posAttr = ch.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!posAttr) continue;
      const matW = ch.matrix;

      for (let i = 0; i < posAttr.count; i += 2) {
        v0.fromBufferAttribute(posAttr, i).applyMatrix4(matW);
        v1.fromBufferAttribute(posAttr, i + 1).applyMatrix4(matW);
        const worldLen = v0.distanceTo(v1);
        if (worldLen < 0.015) continue;

        const subSteps = Math.max(1, Math.min(28, Math.ceil(worldLen / 0.55)));
        for (let s = 0; s < subSteps; s++) {
          totalSegments++;
          const t0 = s / subSteps;
          const t1 = (s + 1) / subSteps;
          pA.lerpVectors(v0, v1, t0);
          pB.lerpVectors(v0, v1, t1);
          pM.lerpVectors(pA, pB, 0.5);

          nA.copy(pA).applyMatrix4(mvp);
          nB.copy(pB).applyMatrix4(mvp);
          nM.copy(pM).applyMatrix4(mvp);

          const x0 = (nA.x * 0.5 + 0.5) * outW;
          const y0 = (0.5 - nA.y * 0.5) * outH;
          const x1 = (nB.x * 0.5 + 0.5) * outW;
          const y1 = (0.5 - nB.y * 0.5) * outH;
          if (
            (x0 < -2 && x1 < -2) ||
            (x0 > outW + 2 && x1 > outW + 2) ||
            (y0 < -2 && y1 < -2) ||
            (y0 > outH + 2 && y1 > outH + 2)
          ) {
            continue;
          }
          if (Math.hypot(x1 - x0, y1 - y0) < 0.25) continue;

          const xm = (x0 + x1) * 0.5;
          const ym = (y0 + y1) * 0.5;
          const zM = nM.z * 0.5 + 0.5;
          if (zM > sampleMaxDepth(xm, ym) + DEPTH_BIAS) continue;

          const distXZ = Math.hypot(pM.x, pM.z);
          const mistT = smoothstep(cfg.innerR, cfg.outerR, distXZ);
          const mistSmooth = mistT * mistT * (3 - 2 * mistT);
          const rawOp = cfg.baseOp * (1 - mistSmooth);
          if (rawOp < 0.075) continue;

          const qOp =
            role === 'cinnabar' && rawOp > 0.9
              ? 1.0
              : Math.max(0.1, Math.min(cfg.baseOp, Math.round(rawOp * 8) / 8));
          const opStr = qOp.toFixed(3);
          const bKey = `${role}_${opStr}`;
          let bucket = buckets.get(bKey);
          if (!bucket) {
            bucket = { stroke: cfg.stroke, opacity: opStr, width: cfg.width, segs: [] };
            buckets.set(bKey, bucket);
          }
          bucket.segs.push(`M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`);
          visibleSegments++;
        }
      }
    }

    // Emit pine soot first, then Prussian blue, then cinnabar accent on top
    const orderRank = (k: string) => (k.startsWith('pine') ? 0 : k.startsWith('prussian') ? 1 : 2);
    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
      const dr = orderRank(a) - orderRank(b);
      return dr !== 0 ? dr : a.localeCompare(b);
    });

    const pathTags = sortedKeys.map((k) => {
      const b = buckets.get(k)!;
      return `<path d="${b.segs.join('')}" fill="none" stroke="${b.stroke}" stroke-opacity="${b.opacity}" stroke-width="${b.width}" stroke-linecap="round"/>`;
    });

    const bgRect = includePaperBg
      ? `<rect width="${outW}" height="${outH}" fill="#F4EFE6"/>`
      : '';
    const aspectAttr = includePaperBg ? '' : ' preserveAspectRatio="none"';

    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outW} ${outH}" width="${outW}" height="${outH}"${aspectAttr}>${bgRect}${pathTags.join('')}</svg>`,
      stats: { totalSegments, visibleSegments, paths: pathTags.length }
    };
  };

  let currentViewMode: ViewMode = 'diorama';

  const setViewMode = (mode: ViewMode) => {
    currentViewMode = mode;
    acousticGroup.visible = mode === 'acoustic';
    const isPrint = mode === 'print';
    rainLines.visible = !isPrint;
    allRipplesMesh.visible = !isPrint;
    petalInst.visible = !isPrint;
    steamGroup.visible = !isPrint;
    bellBurstGroup.visible = !isPrint;
    birdsGroup.visible = !isPrint;
    eaveDripsInst.visible = !isPrint;
    buildOrShowPrintMode(isPrint);
  };

  const setPrintEdgesVisible = (visible: boolean) => {
    if (printEdgesGroup) {
      printEdgesGroup.visible = visible;
    }
  };

  const dummy = new THREE.Object3D();
  const steamWarmColor = new THREE.Color(0xffe6be);
  const steamCoolColor = new THREE.Color(0xd2e2f0);

  const update = (
    simTime: number,
    tramPos: THREE.Vector3,
    trainPos: THREE.Vector3,
    minibusPos: THREE.Vector3
  ) => {
    // 1 & 2. GPU-driven diagonal rain streaks & all 54 instanced road/drip ripples (0 CPU loops, 0 VBO uploads)
    if (rainLines.visible) {
      rainMat.uniforms.uTime.value = simTime;
    }
    if (allRipplesMesh.visible) {
      allRipplesMat.uniforms.uTime.value = simTime;
    }

    // 3. Update gently drifting Bauhinia petals
    if (petalInst.visible) {
      for (let i = 0; i < PETAL_COUNT; i++) {
        const p = petalSeeds[i];
        const cycle = 5.5;
        const u = (((simTime * p.speed + p.phase) % cycle) + cycle) % cycle / cycle;
        const px = p.origin.x + Math.cos(p.offsetAngle + simTime * 0.4) * p.radius + Math.sin(simTime * 1.4 + p.phase) * 0.4;
        const py = p.origin.y + 0.5 - u * (p.origin.y - 0.22);
        const pz = p.origin.z + Math.sin(p.offsetAngle + simTime * 0.35) * p.radius + u * 0.85;
        dummy.position.set(px, py, pz);
        dummy.rotation.set(simTime * 1.8 + p.phase, simTime * 1.3, simTime * 0.9);
        const fadeScale = Math.sin(u * Math.PI);
        dummy.scale.setScalar(0.5 + fadeScale * 0.7);
        dummy.updateMatrix();
        petalInst.setMatrixAt(i, dummy.matrix);
      }
      petalInst.instanceMatrix.needsUpdate = true;
    }

    // 3B. Update rising warm-lit noodle-shop steam wisps deterministically from simTime
    if (steamGroup.visible) {
      for (const w of steamWisps) {
        const t = (((simTime + w.phase) % w.period) + w.period) % w.period;
        const u = t / w.period; // 0 -> 1 as wisp rises from y = 1.55 to y = 4.05
        const curlX = Math.sin(u * Math.PI * 2.0 + w.phase) * w.curlAmp + u * 0.32;
        const curlZ = Math.cos(u * Math.PI * 1.6 + w.phase * 1.3) * (w.curlAmp * 0.85) + u * 0.15;
        w.sprite.position.set(
          STEAM_ORIGIN_X + w.dx + curlX,
          1.55 + u * 2.5,
          STEAM_ORIGIN_Z + w.dz + curlZ
        );
        const sc = w.baseScale * (0.70 + u * 1.52);
        w.sprite.scale.set(sc, sc * 1.14, 1);
        w.mat.rotation = w.phase + simTime * w.rotSpeed;
        // Soft warm amber-cream near awning transitioning smoothly into cool rainy mist aloft
        w.mat.color.copy(steamWarmColor).lerp(steamCoolColor, u * 0.62);
        const fadeEnv = Math.sin(u * Math.PI) * (1.0 - u * 0.24);
        w.mat.opacity = fadeEnv * 0.36;
      }
    }

    // 3C. Update gliding rain-mist urban pigeons (flap-and-glide bank above viaduct)
    if (birdsGroup.visible) {
      for (const b of birds) {
        const ang = simTime * b.speed + b.phase;
        const bx = b.cx + Math.cos(ang) * b.rx;
        const bz = b.cz + Math.sin(ang) * b.rz;
        const by = b.baseY + Math.sin(ang * 2.0 + b.phase) * 0.65;
        const vx = -Math.sin(ang) * b.rx;
        const vz = Math.cos(ang) * b.rz;
        b.root.position.set(bx, by, bz);
        b.root.rotation.set(0, Math.atan2(vx, vz), -0.18);
        // Alternating brisk wingbeat bursts + soaring glide
        const glideEnv = Math.max(0.18, Math.sin(simTime * 1.3 + b.phase * 3.0) * 0.5 + 0.5);
        const flap = Math.sin(simTime * 11.5 + b.phase * 7.0) * 0.62 * glideEnv;
        b.wingL.rotation.z = -flap;
        b.wingR.rotation.z = flap;
      }
    }

    // 3D. Update falling eave rain drips (landing impact ripples are synchronized on GPU in allRipplesMesh)
    if (eaveDripsInst.visible) {
      for (let i = 0; i < dripSeeds.length; i++) {
        const d = dripSeeds[i];
        const t = (((simTime + d.phase) % d.period) + d.period) % d.period;
        const u = t / d.period;
        // Brief hanging bead pause (0..0.28), then smooth quadratic gravity drop (0.28..1.0)
        const fallU = u < 0.28 ? 0 : (u - 0.28) / 0.72;
        const dy = d.yTop - fallU * fallU * (d.yTop - d.yBot);
        dummy.position.set(d.x, dy, d.z);
        dummy.rotation.set(0, 0, 0);
        const sy = u < 0.28 ? 0.35 + u * 1.4 : 0.75 + fallU * 0.95;
        const sxz = u < 0.28 ? 0.95 : 0.65;
        dummy.scale.set(sxz, sy, sxz);
        dummy.updateMatrix();
        eaveDripsInst.setMatrixAt(i, dummy.matrix);
      }
      eaveDripsInst.instanceMatrix.needsUpdate = true;
    }

    // 4. Update [A] Acoustic Field custom GLSL multi-harmonic wavefronts
    if (currentViewMode === 'acoustic') {
      const sig = getHKSignalState(simTime);

      for (const nw of neonWaveRings) {
        const u = (((simTime * 0.68 + nw.phase) % 1.0) + 1.0) % 1.0;
        const r = 0.40 + u * 2.35;
        nw.mesh.position.copy(nw.origin);
        nw.mesh.scale.set(r, 1, r);
        nw.mat.uniforms.uOpacity.value = (1 - u) * (1 - u) * 0.68;
      }

      for (const tw of tramHumRings) {
        const u = (((simTime * 0.52 + tw.offset) % 1.0) + 1.0) % 1.0;
        const r = 0.95 + u * 5.4;
        tw.mesh.position.set(tramPos.x, 0.24, tramPos.z);
        tw.mesh.scale.set(r, 1, r);
        tw.mat.uniforms.uOpacity.value = (1 - u) * 0.64;
      }

      for (const rw of trainHumRings) {
        const u = (((simTime * 0.62 + rw.offset) % 1.0) + 1.0) % 1.0;
        const r = 1.05 + u * 5.0;
        rw.mesh.position.set(trainPos.x, trainPos.y - 0.9, trainPos.z);
        rw.mesh.scale.set(r, 1, r);
        rw.mat.uniforms.uOpacity.value = (1 - u) * 0.56;
      }

      for (const mw of minibusHumRings) {
        const u = (((simTime * 0.72 + mw.offset) % 1.0) + 1.0) % 1.0;
        const r = 0.75 + u * 3.4;
        mw.mesh.position.set(minibusPos.x, 0.24, minibusPos.z);
        mw.mesh.scale.set(r, 1, r);
        mw.mat.uniforms.uOpacity.value = (1 - u) * 0.52;
      }

      // Hong Kong pedestrian audible crossing signal emerald wavefronts synced to 14s HK clock
      const crossingActive = sig.crossingAudioActive;
      const crossingRate = sig.crossingAudioUrgent ? 2.8 : 1.15;
      for (const cw of crossingBeepRings) {
        if (!crossingActive) {
          cw.mesh.visible = false;
          continue;
        }
        cw.mesh.visible = true;
        const u = (((simTime * crossingRate + cw.offset) % 1.0) + 1.0) % 1.0;
        const r = 0.35 + u * 2.55;
        cw.mesh.position.set(cw.x, 1.38 + u * 0.32, cw.z);
        cw.mesh.scale.set(r, 1, r);
        cw.mat.uniforms.uOpacity.value = (1 - u) * (1 - u) * 0.62;
      }

      for (const aw of rainAcousticRings) {
        const u = ((((simTime + aw.phase) % aw.period) + aw.period) % aw.period) / aw.period;
        const r = 0.30 + u * 2.05;
        aw.mesh.position.set(aw.x, 0.14 + u * 0.55, aw.z);
        aw.mesh.scale.set(r, 1, r);
        aw.mat.uniforms.uOpacity.value = (1 - u) * 0.44;
      }
    }

    // 5. Update Interactive Tram Bell Double-Ding & Horn Wavefront Pulses ("叮-叮")
    for (let i = activeBellPulses.length - 1; i >= 0; i--) {
      const bp = activeBellPulses[i];
      const dtA = simTime - bp.startTime;
      const dtB = dtA - 0.17; // Classic double-ding interval
      const dur = 1.65;

      if (dtA < 0 || dtA > dur + 0.25) {
        bellBurstGroup.remove(bp.ringA);
        bellBurstGroup.remove(bp.ringB);
        bp.matA.dispose();
        bp.matB.dispose();
        activeBellPulses.splice(i, 1);
        continue;
      }

      const px = bp.followTram ? tramPos.x : bp.origin.x;
      const py = bp.followTram ? 3.6 : bp.origin.y + 1.0;
      const pz = bp.followTram ? tramPos.z : bp.origin.z;

      const uA = Math.min(1, Math.max(0, dtA / dur));
      const rA = 0.55 + uA * (bp.followTram ? 8.4 : 5.6);
      bp.ringA.position.set(px, py + uA * 0.5, pz);
      bp.ringA.scale.set(rA, 1, rA);
      bp.matA.uniforms.uOpacity.value = (1 - uA) * (1 - uA) * 0.96;

      if (dtB >= 0 && dtB <= dur) {
        const uB = dtB / dur;
        const rB = 0.55 + uB * (bp.followTram ? 8.0 : 5.2);
        bp.ringB.visible = true;
        bp.ringB.position.set(px, py + 0.3 + uB * 0.5, pz);
        bp.ringB.scale.set(rB, 1, rB);
        bp.matB.uniforms.uOpacity.value = (1 - uB) * (1 - uB) * 0.90;
      } else {
        bp.ringB.visible = false;
      }
    }

    // 6. Keep dynamic vehicle & walking pedestrian edges synced during Print Mode
    if (printModeActive && printEdgesGroup) {
      opts.printTargetGroups.viaductAndVehicles.updateMatrixWorld(true);
      opts.printTargetGroups.props.updateMatrixWorld(true);
      for (let i = 0; i < dynamicPrintEdges.length; i++) {
        const entry = dynamicPrintEdges[i];
        entry.line.matrix.copy(entry.src.matrixWorld);
      }
    }
  };

  scene.add(group);

  return {
    group,
    setRainOpacity: (opacity) => {
      rainMat.uniforms.uOpacity.value = opacity;
      allRipplesMat.uniforms.uRainScale.value = Math.min(1.45, opacity / 0.16);
    },
    setViewMode,
    setPrintEdgesVisible,
    getPrintEdgeSVG,
    triggerBellPulse,
    update
  };
}
