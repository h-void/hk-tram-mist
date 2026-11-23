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
    bgHex: 0x8ea4b8,
    cssBg: '#8ea4b8',
    mistCloudHex: 0xb5c6d6,
    towerTintHex: 0x6f859b,
    keyColor: 0xc8daf0,
    keyIntensity: 1.48,
    keyPos: [24, 34, 18],
    hemiSky: 0x9cb4ca,
    hemiGround: 0x354452,
    hemiIntensity: 0.98,
    fillColor: 0x728ca8,
    fillIntensity: 0.42,
    emissiveScale: 1.08,
    shopLightScale: 1.0,
    bloomStrength: 0.30,
    bloomRadius: 0.54,
    bloomThreshold: 0.88,
    reflectTint: 0x8ea4ba,
    reflectBoost: 1.22,
    mistOpacity: 0.28,
    rainOpacity: 0.14,
    rainAudioIntensity: 1.0
  },
  midnight: {
    name: 'midnight',
    bgHex: 0x192336,
    cssBg: '#192336',
    mistCloudHex: 0x2a3b56,
    towerTintHex: 0x101828,
    keyColor: 0x6684b8,
    keyIntensity: 0.60,
    keyPos: [20, 32, 16],
    hemiSky: 0x2b3e5e,
    hemiGround: 0x0f1624,
    hemiIntensity: 0.54,
    fillColor: 0x395078,
    fillIntensity: 0.32,
    emissiveScale: 1.45,
    shopLightScale: 1.45,
    bloomStrength: 0.46,
    bloomRadius: 0.64,
    bloomThreshold: 0.74,
    reflectTint: 0xa0b8d4,
    reflectBoost: 1.55,
    mistOpacity: 0.22,
    rainOpacity: 0.19,
    rainAudioIntensity: 1.25
  },
  dawn: {
    name: 'dawn',
    bgHex: 0xb6c6d4,
    cssBg: '#b6c6d4',
    mistCloudHex: 0xd4e0e9,
    towerTintHex: 0x8fa3b6,
    keyColor: 0xffe2c2,
    keyIntensity: 1.78,
    keyPos: [30, 22, 12],
    hemiSky: 0xc8d8e6,
    hemiGround: 0x566474,
    hemiIntensity: 1.15,
    fillColor: 0x8ca4be,
    fillIntensity: 0.45,
    emissiveScale: 0.64,
    shopLightScale: 0.62,
    bloomStrength: 0.22,
    bloomRadius: 0.45,
    bloomThreshold: 0.94,
    reflectTint: 0x7c8f9f,
    reflectBoost: 0.86,
    mistOpacity: 0.30,
    rainOpacity: 0.08,
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

  const keyLight = new THREE.DirectionalLight(0xc8daf0, 1.48);
  keyLight.position.set(24, 34, 18);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 6;
  keyLight.shadow.camera.far = 105;
  keyLight.shadow.camera.left = -28;
  keyLight.shadow.camera.right = 28;
  keyLight.shadow.camera.top = 28;
  keyLight.shadow.camera.bottom = -28;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.032;
  group.add(keyLight);

  const hemiLight = new THREE.HemisphereLight(0x9cb4ca, 0x354452, 0.98);
  group.add(hemiLight);

  const fillLight = new THREE.DirectionalLight(0x728ca8, 0.42);
  fillLight.position.set(-22, 18, -24);
  group.add(fillLight);

  // Localized warm tungsten & icy-cyan hero street/shop point lights synced with decompressed layout
  const localLightSpecs: Array<{
    pos: [number, number, number];
    color: number;
    intensity: number;
    distance: number;
    decay: number;
  }> = [
    // B1 金鳳冰室 Cha Chaan Teng arcade
    { pos: [-6.8, 2.3, 6.8], color: 0xffa648, intensity: 15.0, distance: 13.5, decay: 1.55 },
    // B2 明記雲吞麵 Noodle stall
    { pos: [-5.8, 2.1, 0.5], color: 0xff9d3c, intensity: 16.0, distance: 13.5, decay: 1.52 },
    // East plaza outdoor icy-cyan beverage vending machines
    { pos: [7.5, 2.2, 3.4], color: 0x72e4ff, intensity: 14.5, distance: 12.5, decay: 1.58 },
    // Far-right B4 24H convenience store behind viaduct
    { pos: [14.5, 2.3, -6.0], color: 0x80ecff, intensity: 13.0, distance: 12.5, decay: 1.58 },
    // East plaza green newspaper & flower kiosk
    { pos: [9.4, 2.1, 8.1], color: 0xffb85c, intensity: 10.5, distance: 9.5, decay: 1.62 },
    // Elevated viaduct warm train corridor bounce
    { pos: [0.6, 5.2, -3.2], color: 0xffb35e, intensity: 9.2, distance: 12.5, decay: 1.65 },
    // Front-left vintage streetlamp (-5.55, 10.2)
    { pos: [-5.0, 4.4, 10.2], color: 0xffbd6b, intensity: 8.6, distance: 11.0, decay: 1.68 },
    // East zebra/vending vintage streetlamp (+5.55, 5.4)
    { pos: [4.8, 4.4, 5.4], color: 0xffc070, intensity: 7.4, distance: 10.5, decay: 1.70 },
    // B1 大押 crimson neon warm splash
    { pos: [-6.6, 5.8, 5.4], color: 0xff6258, intensity: 5.8, distance: 8.5, decay: 1.78 }
  ];

  const localLights: Array<{ light: THREE.PointLight; baseIntensity: number }> = [];
  for (const spec of localLightSpecs) {
    const pt = new THREE.PointLight(spec.color, spec.intensity, spec.distance, spec.decay);
    pt.position.set(...spec.pos);
    group.add(pt);
    localLights.push({ light: pt, baseIntensity: spec.intensity });
  }

  // 36 Layered Drifting Volumetric Mist Clouds (strict circular alpha texture -> ZERO quad seams!)
  // Kept nicely outside the hero wet road foreground so the dark rain-soaked asphalt stays crisp!
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

  // Ring of 22 perimeter drifting mist billows pushed outward to R in [21.5, 32.0]
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.08;
    const radius = 21.8 + (i % 4) * 3.2;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const cy = 1.6 + (i % 5) * 1.4;
    const sx = 15.5 + (i % 4) * 3.6;
    const sy = 8.0 + (i % 3) * 2.4;
    // Keep foreground camera-facing quadrant slightly subtler so wet road, parking bay & kiosk shine cleanly
    const isCameraFront = cx > 8 && cz > 8;
    const op = (0.20 + (i % 3) * 0.07) * (isCameraFront ? 0.50 : 1.0);
    addCloud(cx, cy, cz, sx, sy, op, 0.14 + (i % 5) * 0.03, 1.3 + (i % 3) * 0.5, i * 0.9, i % 2 === 1);
  }

  // 8 dedicated portal mist billows enveloping the wider viaduct (z=-3.8) & road exits cleanly (x=±25..29, z=±22..26)
  const portalSpecs: Array<[number, number, number, number, number, number]> = [
    [-25.0, 6.8, -3.8, 16.5, 8.8, 0.36],
    [-29.0, 7.6, -4.0, 19.5, 9.8, 0.44],
    [25.0, 6.6, -3.8, 16.5, 8.8, 0.36],
    [29.0, 7.4, -3.4, 19.5, 9.8, 0.44],
    [-1.2, 2.0, 22.5, 17.5, 7.6, 0.30],
    [1.6, 1.8, 26.2, 20.5, 8.8, 0.40],
    [0.4, 3.0, -22.2, 17.5, 8.2, 0.34],
    [-2.5, 4.4, -26.0, 20.5, 9.8, 0.44]
  ];
  portalSpecs.forEach(([x, y, z, sx, sy, op], idx) => {
    addCloud(x, y, z, sx, sy, op, 0.16 + idx * 0.02, 1.2, idx * 1.3, idx % 2 === 0);
  });

  // 6 soft background atmospheric wisps curling behind B3, B5, B4 & outer alleys
  const lowMistSpecs: Array<[number, number, number, number, number, number]> = [
    [-16.8, 4.5, -16.2, 15.5, 7.8, 0.24],
    [16.5, 4.8, -18.5, 16.5, 8.2, 0.26],
    [-19.8, 2.6, 6.0, 15.0, 6.8, 0.24],
    [19.5, 2.8, 5.2, 15.0, 6.8, 0.22],
    [-2.8, 11.4, -22.5, 20.0, 9.0, 0.26],
    [22.8, 7.8, -13.5, 16.5, 8.0, 0.24]
  ];
  lowMistSpecs.forEach(([x, y, z, sx, sy, op], idx) => {
    addCloud(x, y, z, sx, sy, op, 0.12 + idx * 0.025, 1.5, idx * 1.7 + 0.5, idx % 2 === 1);
  });

  group.add(mistGroup);

  // 8 Distant Ghostly Hong Kong High-Rise Tower Silhouettes pushed outward to R in [31, 43]
  const towersGroup = new THREE.Group();
  towersGroup.name = 'DistantGhostTowers';

  const towerMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMistColor: mistUniforms.uMistColor,
      uTowerColor: { value: new THREE.Color(ATMOSPHERE_PRESETS.dusk.towerTintHex) },
      uOpacity: { value: 0.30 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMistColor;
      uniform vec3 uTowerColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float baseFade = smoothstep(0.0, 0.34, vUv.y);
        float topFade = 1.0 - smoothstep(0.84, 1.0, vUv.y) * 0.45;
        float alpha = uOpacity * baseFade * topFade;
        vec3 col = mix(uMistColor, uTowerColor, 0.55);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const towerSpecs: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    stepped?: boolean;
    spire?: boolean;
  }> = [
    { x: -30, z: -22, w: 5.2, d: 4.6, h: 25, stepped: true },
    { x: -20, z: -32, w: 5.8, d: 4.8, h: 31, spire: true },
    { x: -5, z: -36, w: 6.4, d: 4.6, h: 27 },
    { x: 11, z: -34, w: 5.4, d: 5.0, h: 29, stepped: true },
    { x: 26, z: -27, w: 5.8, d: 5.2, h: 25 },
    { x: 34, z: -15, w: 5.0, d: 4.8, h: 21 },
    { x: -33, z: -8, w: 5.0, d: 5.0, h: 19 },
    { x: 31, z: 3, w: 4.6, d: 4.6, h: 16 }
  ];

  for (const t of towerSpecs) {
    const geom = new THREE.BoxGeometry(t.w, t.h, t.d);
    const mesh = new THREE.Mesh(geom, towerMat);
    mesh.position.set(t.x, t.h * 0.5 - 1.5, t.z);
    mesh.renderOrder = 1;
    towersGroup.add(mesh);

    if (t.stepped) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.62, t.h * 0.22, t.d * 0.62), towerMat);
      cap.position.set(t.x, t.h + t.h * 0.11 - 1.6, t.z);
      towersGroup.add(cap);
    }
    if (t.spire) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(t.w * 0.42, 6.2, 4), towerMat);
      crown.rotation.y = Math.PI * 0.25;
      crown.position.set(t.x, t.h + 1.5, t.z);
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

    currentMistOpacityScale = cfg.mistOpacity / 0.28;
    for (const c of mistClouds) {
      c.mat.color.setHex(cfg.mistCloudHex);
      c.mat.opacity = c.baseOpacity * currentMistOpacityScale;
    }

    towerMat.uniforms.uTowerColor.value.setHex(cfg.towerTintHex);
    towerMat.uniforms.uOpacity.value = presetName === 'midnight' ? 0.40 : 0.28;

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
