import * as THREE from 'three';
import type { PresetName } from '../ui/hud';
import { createMistCloudTexture } from './textures';

export interface RadialMistUniforms {
  uMistColor: { value: THREE.Color };
  uMistCenter: { value: THREE.Vector2 };
  uMistEnabled: { value: number };
}

export interface RadialMistOptions {
  innerR?: number;
  outerR?: number;
  fadeAlpha?: boolean;
}

/**
 * Custom GLSL soft volumetric light-cone ShaderMaterial.
 * Smoothly fades to 0.0 at BOTH grazing Fresnel edges (exact for Orthographic & Perspective)
 * AND at both the wide far rim (vUv.y -> 0) and sharp tip (vUv.y -> 1), eliminating any
 * hard-edged cardboard cone or triangle silhouette.
 */
export function createSoftLightConeMaterial(
  colorHex: number,
  baseOpacity = 0.065
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: baseOpacity }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vViewNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        // projectionMatrix is built into vertex shaders; exact for both Ortho and Perspective
        vViewDir = (projectionMatrix[3][3] > 0.5)
          ? vec3(0.0, 0.0, 1.0)
          : normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;

      void main() {
        float ndotv = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
        float fresnelSoft = pow(clamp(ndotv, 0.0, 1.0), 2.2);

        // ConeGeometry UVs: vUv.y = 1.0 at apex tip, 0.0 at open wide base rim
        float rimFade = pow(smoothstep(0.0, 0.88, vUv.y), 1.75);
        float apexFade = smoothstep(1.0, 0.84, vUv.y);
        float alpha = uOpacity * fresnelSoft * rimFade * apexFade;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(uColor * alpha, alpha);
      }
    `
  });
}

/**
 * Patches any standard Three.js material (MeshStandardMaterial, MeshBasicMaterial,
 * LineBasicMaterial, InstancedMesh materials) with a seamless world-space radial mist
 * dissolve so ground, road, sidewalks, rails, viaduct, and passing vehicles smoothly melt
 * into the surrounding mist with ZERO hard rectangular diorama edges.
 */
export function applyRadialMistFade(
  material: THREE.Material,
  sharedUniforms: RadialMistUniforms,
  options: RadialMistOptions = {}
): void {
  const innerR = options.innerR ?? 12.0;
  const outerR = options.outerR ?? 19.5;
  const fadeAlpha = options.fadeAlpha ?? false;

  if (fadeAlpha) {
    material.transparent = true;
  }

  const cacheKey = `hk_radial_mist_${innerR.toFixed(1)}_${outerR.toFixed(1)}_${fadeAlpha ? 'a' : 'c'}`;
  material.customProgramCacheKey = () => cacheKey;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMistColor = sharedUniforms.uMistColor;
    shader.uniforms.uMistCenter = sharedUniforms.uMistCenter;
    shader.uniforms.uMistEnabled = sharedUniforms.uMistEnabled;
    shader.uniforms.uMistInnerR = { value: innerR };
    shader.uniforms.uMistOuterR = { value: outerR };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vMistWorldPos;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vec4 hkMistWp = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  hkMistWp = instanceMatrix * hkMistWp;
#endif
hkMistWp = modelMatrix * hkMistWp;
vMistWorldPos = hkMistWp.xyz;`
      );

    const fadeCode = fadeAlpha
      ? `
float hkMistDist = length( vMistWorldPos.xz - uMistCenter );
float hkMistT = smoothstep( uMistInnerR, uMistOuterR, hkMistDist );
hkMistT = hkMistT * hkMistT * ( 3.0 - 2.0 * hkMistT );
gl_FragColor.rgb = mix( gl_FragColor.rgb, uMistColor, hkMistT * 0.72 * uMistEnabled );
gl_FragColor.a *= ( 1.0 - hkMistT * uMistEnabled );
if ( gl_FragColor.a < 0.004 ) discard;
`
      : `
float hkMistDist = length( vMistWorldPos.xz - uMistCenter );
float hkMistT = smoothstep( uMistInnerR, uMistOuterR, hkMistDist );
hkMistT = hkMistT * hkMistT * ( 3.0 - 2.0 * hkMistT );
gl_FragColor.rgb = mix( gl_FragColor.rgb, uMistColor, hkMistT * uMistEnabled );
`;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uMistColor;
uniform vec2 uMistCenter;
uniform float uMistEnabled;
uniform float uMistInnerR;
uniform float uMistOuterR;
varying vec3 vMistWorldPos;`
      )
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${fadeCode}`);
  };
  material.needsUpdate = true;
}

export interface AtmospherePresetConfig {
  name: PresetName;
  bgHex: number;
  cssBg: string;
  mistCloudHex: number;
  towerTintHex: number;
  keyColor: number;
  keyIntensity: number;
  keyPos: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fillColor: number;
  fillIntensity: number;
  emissiveScale: number;
  shopLightScale: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  reflectTint: number;
  reflectBoost: number;
  mistOpacity: number;
  rainOpacity: number;
  rainAudioIntensity: number;
}

export const ATMOSPHERE_PRESETS: Record<PresetName, AtmospherePresetConfig> = {
  dusk: {
    name: 'dusk',
    bgHex: 0x89a0b6,
    cssBg: '#89a0b6',
    mistCloudHex: 0xb2c5d6,
    towerTintHex: 0x62788f,
    keyColor: 0xd0e0f4,
    keyIntensity: 1.54,
    keyPos: [25, 34, 19],
    hemiSky: 0xa4bcd2,
    hemiGround: 0x3b4c5c,
    hemiIntensity: 1.06,
    fillColor: 0x7a96b4,
    fillIntensity: 0.44,
    emissiveScale: 1.06,
    shopLightScale: 0.96,
    bloomStrength: 0.28,
    bloomRadius: 0.52,
    bloomThreshold: 0.89,
    reflectTint: 0x90a8c0,
    reflectBoost: 1.24,
    mistOpacity: 0.27,
    rainOpacity: 0.16,
    rainAudioIntensity: 1.0
  },
  midnight: {
    name: 'midnight',
    bgHex: 0x162032,
    cssBg: '#162032',
    mistCloudHex: 0x263750,
    towerTintHex: 0x0d1524,
    keyColor: 0x6c8cc2,
    keyIntensity: 0.66,
    keyPos: [22, 32, 18],
    hemiSky: 0x2e4366,
    hemiGround: 0x121b2c,
    hemiIntensity: 0.58,
    fillColor: 0x3e5884,
    fillIntensity: 0.34,
    emissiveScale: 1.42,
    shopLightScale: 1.38,
    bloomStrength: 0.42,
    bloomRadius: 0.60,
    bloomThreshold: 0.78,
    reflectTint: 0x9ab4d2,
    reflectBoost: 1.48,
    mistOpacity: 0.21,
    rainOpacity: 0.17,
    rainAudioIntensity: 1.25
  },
  dawn: {
    name: 'dawn',
    bgHex: 0xb6c7d6,
    cssBg: '#b6c7d6',
    mistCloudHex: 0xd6e2ec,
    towerTintHex: 0x8ea4b8,
    keyColor: 0xffe4c6,
    keyIntensity: 1.82,
    keyPos: [30, 22, 14],
    hemiSky: 0xcadbe8,
    hemiGround: 0x5c6b7c,
    hemiIntensity: 1.18,
    fillColor: 0x90a8c2,
    fillIntensity: 0.46,
    emissiveScale: 0.62,
    shopLightScale: 0.60,
    bloomStrength: 0.20,
    bloomRadius: 0.44,
    bloomThreshold: 0.94,
    reflectTint: 0x7e92a4,
    reflectBoost: 0.88,
    mistOpacity: 0.29,
    rainOpacity: 0.12,
    rainAudioIntensity: 0.68
  }
};

interface MistCloudEntry {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  basePos: THREE.Vector3;
  baseScale: THREE.Vector2;
  baseOpacity: number;
  driftSpeed: number;
  driftAmp: number;
  phase: number;
}

export interface AtmosphereSystem {
  group: THREE.Group;
  mistGroup: THREE.Group;
  towersGroup: THREE.Group;
  mistUniforms: RadialMistUniforms;
  keyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  fillLight: THREE.DirectionalLight;
  localLights: Array<{ light: THREE.PointLight; baseIntensity: number }>;
  applyPreset: (preset: PresetName) => AtmospherePresetConfig;
  setPrintMode: (enabled: boolean) => void;
  update: (simTime: number) => void;
}

export function createAtmosphere(scene: THREE.Scene): AtmosphereSystem {
  const group = new THREE.Group();
  group.name = 'AtmosphereGroup';

  const mistUniforms: RadialMistUniforms = {
    uMistColor: { value: new THREE.Color(ATMOSPHERE_PRESETS.dusk.bgHex) },
    uMistCenter: { value: new THREE.Vector2(0, 0) },
    uMistEnabled: { value: 1.0 }
  };

  scene.background = new THREE.Color(ATMOSPHERE_PRESETS.dusk.bgHex);

  const keyLight = new THREE.DirectionalLight(0xd0e0f4, 1.54);
  keyLight.position.set(25, 34, 19);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 6;
  keyLight.shadow.camera.far = 112;
  keyLight.shadow.camera.left = -30;
  keyLight.shadow.camera.right = 30;
  keyLight.shadow.camera.top = 30;
  keyLight.shadow.camera.bottom = -30;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.032;
  group.add(keyLight);

  const hemiLight = new THREE.HemisphereLight(0xa4bcd2, 0x3b4c5c, 1.06);
  group.add(hemiLight);

  // Side-rim fill positioned perpendicular to the SE camera axis (avoiding mirror specular glare on wet road!)
  const fillLight = new THREE.DirectionalLight(0x7a96b4, 0.44);
  fillLight.position.set(-28, 22, 14);
  group.add(fillLight);

  // Localized warm tungsten & icy-cyan hero street/shop point lights synced with refined urban layout
  const localLightSpecs: Array<{
    pos: [number, number, number];
    color: number;
    intensity: number;
    distance: number;
    decay: number;
  }> = [
    // B1 金鳳冰室 Cha Chaan Teng arcade
    { pos: [-6.8, 2.3, 6.8], color: 0xffa648, intensity: 14.5, distance: 13.5, decay: 1.55 },
    // B2 明記雲吞麵 Noodle stall & narrow side-alley warm glow
    { pos: [-5.8, 2.1, 0.7], color: 0xff9d3c, intensity: 15.2, distance: 13.5, decay: 1.52 },
    // East plaza MTR Exit A3 canopy + outdoor beverage vending machines (balanced so cans stay crisp!)
    { pos: [8.4, 2.35, 3.6], color: 0x76e6ff, intensity: 8.6, distance: 11.5, decay: 1.62 },
    // MTR Exit A3 recessed stairwell warm-white glow (softened so steps & handrails stay legible)
    { pos: [11.2, 2.15, 2.1], color: 0xffe4b2, intensity: 5.4, distance: 8.5, decay: 1.68 },
    // Far-right B4 24H convenience store behind viaduct (unobstructed hero corner!)
    { pos: [14.5, 2.3, -5.8], color: 0x82ecff, intensity: 13.2, distance: 13.0, decay: 1.56 },
    // East plaza green newspaper & flower kiosk + phone booth warm pocket
    { pos: [10.4, 2.15, 7.4], color: 0xffb85c, intensity: 10.6, distance: 10.5, decay: 1.60 },
    // Elevated viaduct warm train corridor bounce
    { pos: [0.6, 5.2, -3.2], color: 0xffb35e, intensity: 8.8, distance: 12.5, decay: 1.65 },
    // Front-left vintage streetlamp (-5.55, 10.2)
    { pos: [-5.0, 4.4, 10.2], color: 0xffbd6b, intensity: 8.4, distance: 11.0, decay: 1.68 },
    // East zebra/vending vintage streetlamp (+5.55, 5.4)
    { pos: [4.8, 4.4, 5.4], color: 0xffc070, intensity: 7.2, distance: 10.5, decay: 1.70 },
    // B1 大押 crimson neon warm splash
    { pos: [-6.6, 5.8, 5.4], color: 0xff6258, intensity: 5.6, distance: 8.5, decay: 1.78 },
    // B3 / B6 back-left alley warm stairwell bounce under viaduct
    { pos: [-10.8, 2.4, -7.2], color: 0xffaa4c, intensity: 6.8, distance: 9.5, decay: 1.68 }
  ];

  const localLights: Array<{ light: THREE.PointLight; baseIntensity: number }> = [];
  for (const spec of localLightSpecs) {
    const pt = new THREE.PointLight(spec.color, spec.intensity, spec.distance, spec.decay);
    pt.position.set(...spec.pos);
    group.add(pt);
    localLights.push({ light: pt, baseIntensity: spec.intensity });
  }

  // 36 Layered Drifting Volumetric Mist Clouds (strict circular alpha texture -> ZERO quad seams!)
  const mistGroup = new THREE.Group();
  mistGroup.name = 'DriftingMistClouds';
  const cloudTexA = createMistCloudTexture(2026);
  const cloudTexB = createMistCloudTexture(7711);
  const mistClouds: MistCloudEntry[] = [];

  const addCloud = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    opacity: number,
    speed: number,
    amp: number,
    phase: number,
    useB = false
  ) => {
    const mat = new THREE.SpriteMaterial({
      map: useB ? cloudTexB : cloudTexA,
      color: new THREE.Color(ATMOSPHERE_PRESETS.dusk.mistCloudHex),
      transparent: true,
      opacity,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(sx, sy, 1);
    sprite.renderOrder = 8;
    mistGroup.add(sprite);
    mistClouds.push({
      sprite,
      mat,
      basePos: new THREE.Vector3(x, y, z),
      baseScale: new THREE.Vector2(sx, sy),
      baseOpacity: opacity,
      driftSpeed: speed,
      driftAmp: amp,
      phase
    });
  };

  // Ring of 22 perimeter drifting mist billows pushed outward to R in [22.5, 33.0]
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.08;
    const radius = 22.8 + (i % 4) * 3.2;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const cy = 1.8 + (i % 5) * 1.4;
    const sx = 16.0 + (i % 4) * 3.6;
    const sy = 8.2 + (i % 3) * 2.4;
    const isCameraFront = cx > 7 && cz > 7;
    const op = (0.19 + (i % 3) * 0.065) * (isCameraFront ? 0.45 : 1.0);
    addCloud(cx, cy, cz, sx, sy, op, 0.14 + (i % 5) * 0.03, 1.3 + (i % 3) * 0.5, i * 0.9, i % 2 === 1);
  }

  // 8 dedicated portal mist billows enveloping the viaduct (z=-3.8) & road exits cleanly
  const portalSpecs: Array<[number, number, number, number, number, number]> = [
    [-25.5, 6.8, -3.8, 17.0, 9.0, 0.36],
    [-29.5, 7.6, -4.0, 20.0, 10.0, 0.44],
    [25.5, 6.6, -3.8, 17.0, 9.0, 0.36],
    [29.5, 7.4, -3.4, 20.0, 10.0, 0.44],
    [-1.0, 2.0, 23.0, 18.0, 7.8, 0.28],
    [1.6, 1.8, 26.8, 21.0, 9.0, 0.38],
    [0.4, 3.0, -22.5, 18.0, 8.4, 0.34],
    [-2.5, 4.4, -26.5, 21.0, 10.0, 0.44]
  ];
  portalSpecs.forEach(([x, y, z, sx, sy, op], idx) => {
    addCloud(x, y, z, sx, sy, op, 0.16 + idx * 0.02, 1.2, idx * 1.3, idx % 2 === 0);
  });

  // 6 soft background atmospheric wisps curling behind B3, B6, B5, B4 & outer alleys
  const lowMistSpecs: Array<[number, number, number, number, number, number]> = [
    [-19.5, 4.8, -16.8, 16.0, 8.0, 0.24],
    [17.5, 4.8, -18.5, 16.5, 8.2, 0.24],
    [-21.2, 2.8, 6.0, 15.0, 6.8, 0.22],
    [21.5, 2.8, 5.2, 15.0, 6.8, 0.20],
    [-2.8, 12.2, -23.0, 20.5, 9.2, 0.25],
    [23.5, 7.8, -13.5, 16.5, 8.0, 0.23]
  ];
  lowMistSpecs.forEach(([x, y, z, sx, sy, op], idx) => {
    addCloud(x, y, z, sx, sy, op, 0.12 + idx * 0.025, 1.5, idx * 1.7 + 0.5, idx % 2 === 1);
  });

  group.add(mistGroup);

  // Distant Hong Kong Horizon Skyline Silhouettes:
  // Depth-tested opaque far backdrop strictly behind the north horizon so ZERO overlapping transparent seams appear!
  const towersGroup = new THREE.Group();
  towersGroup.name = 'DistantGhostTowers';

  const towerMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uMistColor: mistUniforms.uMistColor,
      uTowerColor: { value: new THREE.Color(ATMOSPHERE_PRESETS.dusk.towerTintHex) },
      uStrength: { value: 0.22 },
      uWindowGlow: { value: 0.10 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMistColor;
      uniform vec3 uTowerColor;
      uniform float uStrength;
      uniform float uWindowGlow;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        float baseFade = smoothstep(0.08, 0.44, vUv.y);
        float topFade = 1.0 - smoothstep(0.76, 1.0, vUv.y) * 0.72;
        float horizFade = 1.0 - smoothstep(12.0, 24.0, abs(vWorldPos.x));
        // Subtle directional side-plane differentiation so horizon towers have gentle 3D volume
        float sideShade = mix(0.86, 1.06, clamp(dot(vNormalW, normalize(vec3(0.7, 0.4, 0.5))) * 0.5 + 0.5, 0.0, 1.0));
        vec3 baseCol = mix(uMistColor, uTowerColor * sideShade, uStrength * baseFade * topFade * mix(0.35, 1.0, horizFade));

        // Whisper-faint distant high-rise window pinpoints muted near screen edges
        float isWall = 1.0 - abs(vNormalW.y);
        vec2 winGrid = vec2(floor(vWorldPos.x * 1.8 + vWorldPos.z * 1.8), floor(vWorldPos.y * 1.45));
        vec2 winCell = fract(vec2(vWorldPos.x * 1.8 + vWorldPos.z * 1.8, vWorldPos.y * 1.45));
        float winMask = step(0.32, winCell.x) * step(winCell.x, 0.68) * step(0.35, winCell.y) * step(winCell.y, 0.66);
        float winRand = hash21(winGrid);
        float lit = step(0.89, winRand) * winMask * isWall * smoothstep(0.28, 0.54, vUv.y) * (1.0 - smoothstep(0.72, 0.90, vUv.y)) * horizFade;
        vec3 winColor = mix(vec3(0.96, 0.78, 0.50), vec3(0.64, 0.86, 0.98), step(0.95, winRand));
        vec3 finalCol = baseCol + winColor * lit * uWindowGlow * 0.15;

        float alpha = clamp(baseFade * topFade * 0.92, 0.0, 1.0);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(finalCol, alpha);
      }
    `
  });

  // Tightly composed Hong Kong background horizon cluster strictly behind the north-west / north backdrop
  const towerSpecs: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    stepped?: boolean;
    spire?: boolean;
  }> = [
    { x: -24, z: -34, w: 5.4, d: 4.8, h: 25, stepped: true },
    { x: -13, z: -38, w: 5.8, d: 5.0, h: 31, spire: true },
    { x: 0, z: -40, w: 6.2, d: 4.8, h: 27 },
    { x: 13, z: -38, w: 5.4, d: 5.0, h: 29, stepped: true },
    { x: 25, z: -33, w: 5.6, d: 5.0, h: 24 }
  ];

  for (const t of towerSpecs) {
    const geom = new THREE.BoxGeometry(t.w, t.h, t.d);
    const mesh = new THREE.Mesh(geom, towerMat);
    mesh.position.set(t.x, t.h * 0.5 - 2.0, t.z);
    mesh.renderOrder = 1;
    towersGroup.add(mesh);

    if (t.stepped) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.62, t.h * 0.20, t.d * 0.62), towerMat);
      cap.position.set(t.x, t.h + t.h * 0.10 - 2.1, t.z);
      towersGroup.add(cap);
    }
    if (t.spire) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(t.w * 0.40, 6.0, 4), towerMat);
      crown.rotation.y = Math.PI * 0.25;
      crown.position.set(t.x, t.h + 1.0, t.z);
      towersGroup.add(crown);
    }
  }
  group.add(towersGroup);

  let currentMistOpacityScale = 1.0;
  let printModeActive = false;
  let activePreset: PresetName = 'dusk';

  const applyPreset = (presetName: PresetName): AtmospherePresetConfig => {
    activePreset = presetName;
    const cfg = ATMOSPHERE_PRESETS[presetName];

    if (!printModeActive) {
      scene.background = new THREE.Color(cfg.bgHex);
      mistUniforms.uMistColor.value.setHex(cfg.bgHex);
      mistUniforms.uMistEnabled.value = 1.0;
      document.documentElement.style.background = cfg.cssBg;
      document.body.style.background = cfg.cssBg;
    }

    keyLight.color.setHex(cfg.keyColor);
    keyLight.intensity = cfg.keyIntensity;
    keyLight.position.set(...cfg.keyPos);

    hemiLight.color.setHex(cfg.hemiSky);
    hemiLight.groundColor.setHex(cfg.hemiGround);
    hemiLight.intensity = cfg.hemiIntensity;

    fillLight.color.setHex(cfg.fillColor);
    fillLight.intensity = cfg.fillIntensity;

    for (const item of localLights) {
      item.light.intensity = printModeActive ? 0 : item.baseIntensity * cfg.shopLightScale;
    }

    currentMistOpacityScale = cfg.mistOpacity / 0.27;
    for (const c of mistClouds) {
      c.mat.color.setHex(cfg.mistCloudHex);
      c.mat.opacity = c.baseOpacity * currentMistOpacityScale;
    }

    towerMat.uniforms.uTowerColor.value.setHex(cfg.towerTintHex);
    towerMat.uniforms.uStrength.value =
      presetName === 'midnight' ? 0.34 : presetName === 'dawn' ? 0.16 : 0.20;
    towerMat.uniforms.uWindowGlow.value =
      presetName === 'midnight' ? 0.28 : presetName === 'dawn' ? 0.02 : 0.08;

    return cfg;
  };

  const setPrintMode = (enabled: boolean) => {
    printModeActive = enabled;
    const cfg = ATMOSPHERE_PRESETS[activePreset];
    if (enabled) {
      scene.background = new THREE.Color(0xf4efe6);
      mistUniforms.uMistColor.value.setHex(0xf4efe6);
      mistUniforms.uMistEnabled.value = 1.0;
      mistGroup.visible = false;
      towersGroup.visible = false;
      for (const item of localLights) {
        item.light.intensity = 0;
      }
    } else {
      mistGroup.visible = true;
      towersGroup.visible = true;
      applyPreset(activePreset);
    }
    document.body.style.background = enabled ? '#f4efe6' : cfg.cssBg;
  };

  const update = (simTime: number) => {
    if (printModeActive) return;
    for (const c of mistClouds) {
      const dx = Math.sin(simTime * c.driftSpeed + c.phase) * c.driftAmp;
      const dz = Math.cos(simTime * c.driftSpeed * 0.7 + c.phase * 1.3) * (c.driftAmp * 0.65);
      const dy = Math.sin(simTime * c.driftSpeed * 0.5 + c.phase * 2.1) * 0.25;
      c.sprite.position.set(c.basePos.x + dx, c.basePos.y + dy, c.basePos.z + dz);
      const pulse = 0.92 + 0.08 * Math.sin(simTime * 0.28 + c.phase);
      c.mat.opacity = c.baseOpacity * currentMistOpacityScale * pulse;
    }
  };

  scene.add(group);
  applyPreset('dusk');

  return {
    group,
    mistGroup,
    towersGroup,
    mistUniforms,
    keyLight,
    hemiLight,
    fillLight,
    localLights,
    applyPreset,
    setPrintMode,
    update
  };
}
