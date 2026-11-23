import * as THREE from 'three';
import { applyRadialMistFade, type RadialMistUniforms } from './atmosphere';
import {
  createGlowSpriteTexture,
  createSidewalkTexture,
  createWetRoadTextures,
  createYellowBoxTexture,
  createZebraTexture
} from './textures';

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
 * Procedural wet granite-paving roughnessMap (Linear NoColorSpace).
 * Clean subtle flagstone tile-to-tile roughness variation (effective roughness 0.48–0.72)
 * with damp grout lines and zero repeating circular spots!
 */
function createWetSidewalkRoughnessTexture(): THREE.CanvasTexture {
  const S = 512;
  const rand = mulberry32(198807);
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Base damp granite roughness (~204 / 255 * 0.78 ≈ 0.62)
  ctx.fillStyle = 'rgb(204, 204, 204)';
  ctx.fillRect(0, 0, S, S);

  // Subtle flagstone tile-to-tile roughness variation strictly in [164, 232] -> [0.50, 0.71] effective!
  const tile = 64;
  for (let ty = 0; ty < S; ty += tile) {
    for (let tx = 0; tx < S; tx += tile) {
      const tileV = Math.floor(168 + rand() * 62);
      ctx.fillStyle = `rgb(${tileV}, ${tileV}, ${tileV})`;
      ctx.fillRect(tx + 2, ty + 2, tile - 3, tile - 3);

      // Gentle directional brushed granite sheen variation inside each slab
      const g = ctx.createLinearGradient(tx, ty, tx + tile, ty + tile);
      const delta = Math.floor((rand() - 0.5) * 18);
      const vA = Math.min(234, Math.max(160, tileV + delta));
      const vB = Math.min(234, Math.max(160, tileV - delta));
      g.addColorStop(0, `rgba(${vA}, ${vA}, ${vA}, 0.45)`);
      g.addColorStop(1, `rgba(${vB}, ${vB}, ${vB}, 0.45)`);
      ctx.fillStyle = g;
      ctx.fillRect(tx + 2, ty + 2, tile - 3, tile - 3);
    }
  }

  // Fine stone micro-grain so slabs look like real damp Hong Kong granite
  for (let i = 0; i < 1600; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const w = 2 + rand() * 7;
    const h = 2 + rand() * 7;
    const v = Math.floor(172 + rand() * 58);
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.22)`;
    ctx.fillRect(x, y, w, h);
  }

  // Subtle wet rain-damp grout lines between flagstones (~158 -> ~0.48 effective roughness)
  ctx.strokeStyle = 'rgb(158, 158, 158)';
  ctx.lineWidth = 2.5;
  for (let p = 0; p <= S; p += tile) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 18);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Weathered Hong Kong thermoplastic double-yellow no-parking curb stripe texture (雙黃線).
 */
function createDoubleYellowPaintTexture(): THREE.CanvasTexture {
  const W = 64;
  const H = 256;
  const rand = mulberry32(8842);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e4b22c';
  ctx.fillRect(0, 0, W, H);

  // Subtle wet tarmac aggregate flecks & slight edge wear
  for (let i = 0; i < 240; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const s = 1 + rand() * 3.5;
    ctx.fillStyle = rand() > 0.35 ? 'rgba(34, 42, 50, 0.24)' : 'rgba(255, 232, 148, 0.22)';
    ctx.fillRect(x, y, s, s * 1.4);
  }
  ctx.fillStyle = 'rgba(26, 34, 42, 0.28)';
  ctx.fillRect(0, 0, 3, H);
  ctx.fillRect(W - 3, 0, 3, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 24);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Orthographic-compatible planar wet-road reflector.
 * Uses 512x512 HalfFloat RT without MSAA (5-tap wet-asphalt blur already antialiases smoothly)
 * and zero per-frame object allocations inside onBeforeRender.
 */
class PlanarWetReflector extends THREE.Mesh {
  private renderTarget: THREE.WebGLRenderTarget;
  private virtualCamera: THREE.OrthographicCamera;
  private textureMatrix = new THREE.Matrix4();
  private shaderMat: THREE.ShaderMaterial;

  constructor(
    width: number,
    height: number,
    mirrorY: number,
    mistUniforms: RadialMistUniforms,
    hiddenDuringReflection: THREE.Object3D[]
  ) {
    const geom = new THREE.PlaneGeometry(width, height);
    const renderTarget = new THREE.WebGLRenderTarget(512, 512, {
      type: THREE.HalfFloatType,
      samples: 0,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });

    const textureMatrix = new THREE.Matrix4();

    const mat = new THREE.ShaderMaterial({
      name: 'PlanarWetReflectorShader',
      uniforms: {
        tDiffuse: { value: renderTarget.texture },
        textureMatrix: { value: textureMatrix },
        uTint: { value: new THREE.Color(0x8ea4ba) },
        uBoost: { value: 1.22 },
        uTime: { value: 0 },
        uMistColor: mistUniforms.uMistColor,
        uMistCenter: mistUniforms.uMistCenter,
        uMistEnabled: mistUniforms.uMistEnabled
      },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vReflectUv;
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vReflectUv = textureMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec3 uTint;
        uniform float uBoost;
        uniform float uTime;
        uniform vec3 uMistColor;
        uniform vec2 uMistCenter;
        uniform float uMistEnabled;
        varying vec4 vReflectUv;
        varying vec3 vWorldPos;

        void main() {
          vec2 uv = vReflectUv.xy / max(vReflectUv.w, 0.0001);

          // Delicate rain-ripple surface shimmer on wet puddles
          float w1 = sin(vWorldPos.x * 5.2 + vWorldPos.z * 3.8 + uTime * 2.4);
          float w2 = cos(vWorldPos.x * 7.6 - vWorldPos.z * 6.1 - uTime * 1.9);
          vec2 jitter = vec2(w1 + w2 * 0.6, w2 - w1 * 0.5) * 0.0014;

          // 5-tap wet asphalt anisotropic sheen blur
          vec2 blurY = vec2(0.0, 0.0044);
          vec2 blurX = vec2(0.0018, 0.0);
          vec3 col = texture2D(tDiffuse, clamp(uv + jitter, 0.002, 0.998)).rgb * 0.36;
          col += texture2D(tDiffuse, clamp(uv + jitter + blurY, 0.002, 0.998)).rgb * 0.19;
          col += texture2D(tDiffuse, clamp(uv + jitter - blurY, 0.002, 0.998)).rgb * 0.19;
          col += texture2D(tDiffuse, clamp(uv + jitter + blurX, 0.002, 0.998)).rgb * 0.13;
          col += texture2D(tDiffuse, clamp(uv + jitter - blurX, 0.002, 0.998)).rgb * 0.13;

          // Wet dark-tar Fresnel contrast: keeps shadows rich dark slate while bright neon/shops gleam
          vec3 graded = pow(max(col, vec3(0.0)), vec3(1.12));
          vec3 reflected = graded * uTint * uBoost * 0.78;

          // Smooth radial mist dissolve matched cleanly with road/sidewalk fade
          float dist = length(vWorldPos.xz - uMistCenter);
          float mistT = smoothstep(16.5, 25.5, dist);
          mistT = mistT * mistT * (3.0 - 2.0 * mistT);
          reflected = mix(reflected, uMistColor, mistT * uMistEnabled);

          gl_FragColor = vec4(reflected, 1.0);
        }
      `
    });

    super(geom, mat);
    this.renderTarget = renderTarget;
    this.textureMatrix = textureMatrix;
    this.shaderMat = mat;
    this.virtualCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    this.rotation.x = -Math.PI / 2;
    this.position.set(0, mirrorY, 0);
    this.renderOrder = 0;

    // Pre-allocated scratch vectors (zero per-frame GC churn)
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const reflectedTarget = new THREE.Vector3();
    const rotMat = new THREE.Matrix4();
    const prevVis: boolean[] = new Array(hiddenDuringReflection.length);

    this.onBeforeRender = (renderer, scene, camera) => {
      if (!this.visible) return;

      camPos.setFromMatrixPosition(camera.matrixWorld);
      if (camPos.y <= mirrorY + 0.02) return;

      rotMat.extractRotation(camera.matrixWorld);
      camDir.set(0, 0, -1).applyMatrix4(rotMat);
      camUp.set(0, 1, 0).applyMatrix4(rotMat);

      lookTarget.copy(camPos).add(camDir);

      // Reflect position, target, and up across horizontal plane y = mirrorY
      this.virtualCamera.position.set(camPos.x, 2 * mirrorY - camPos.y, camPos.z);
      reflectedTarget.set(lookTarget.x, 2 * mirrorY - lookTarget.y, lookTarget.z);
      this.virtualCamera.up.set(camUp.x, -camUp.y, camUp.z).normalize();
      this.virtualCamera.lookAt(reflectedTarget);

      if (camera instanceof THREE.OrthographicCamera) {
        this.virtualCamera.left = camera.left;
        this.virtualCamera.right = camera.right;
        this.virtualCamera.top = camera.top;
        this.virtualCamera.bottom = camera.bottom;
        this.virtualCamera.near = camera.near;
        this.virtualCamera.far = camera.far;
        this.virtualCamera.zoom = camera.zoom;
        this.virtualCamera.updateProjectionMatrix();
      } else {
        this.virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
      }

      this.virtualCamera.updateMatrixWorld();

      this.textureMatrix.set(
        0.5, 0.0, 0.0, 0.5,
        0.0, 0.5, 0.0, 0.5,
        0.0, 0.0, 0.5, 0.5,
        0.0, 0.0, 0.0, 1.0
      );
      this.textureMatrix.multiply(this.virtualCamera.projectionMatrix);
      this.textureMatrix.multiply(this.virtualCamera.matrixWorldInverse);
      this.textureMatrix.multiply(this.matrixWorld);

      for (let i = 0; i < hiddenDuringReflection.length; i++) {
        prevVis[i] = hiddenDuringReflection[i].visible;
        hiddenDuringReflection[i].visible = false;
      }
      this.visible = false;

      const prevRT = renderer.getRenderTarget();
      const prevShadowAuto = renderer.shadowMap.autoUpdate;
      const prevXr = renderer.xr.enabled;

      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.renderTarget);
      renderer.state.buffers.depth.setMask(true);
      renderer.clear();
      renderer.render(scene, this.virtualCamera);

      renderer.setRenderTarget(prevRT);
      renderer.shadowMap.autoUpdate = prevShadowAuto;
      renderer.xr.enabled = prevXr;

      this.visible = true;
      for (let i = 0; i < hiddenDuringReflection.length; i++) {
        hiddenDuringReflection[i].visible = prevVis[i];
      }
    };
  }

  public setReflectionStyle(tintHex: number, boost: number): void {
    this.shaderMat.uniforms.uTint.value.setHex(tintHex);
    this.shaderMat.uniforms.uBoost.value = boost;
  }

  public setTime(simTime: number): void {
    this.shaderMat.uniforms.uTime.value = simTime;
  }

  public dispose(): void {
    this.renderTarget.dispose();
    this.geometry.dispose();
    this.shaderMat.dispose();
  }
}

export interface RoadAndReflectionsSystem {
  group: THREE.Group;
  reflector: PlanarWetReflector;
  setReflectionStyle: (tintHex: number, boost: number) => void;
  setPrintMode: (enabled: boolean) => void;
  setGlowScale: (scale: number) => void;
  update: (simTime: number) => void;
  dispose: () => void;
}

export function createRoadAndReflections(
  scene: THREE.Scene,
  mistUniforms: RadialMistUniforms
): RoadAndReflectionsSystem {
  const group = new THREE.Group();
  group.name = 'RoadAndReflectionsGroup';

  const hiddenDuringReflection: THREE.Object3D[] = [];
  const ROAD_LEN = 78.0;
  const roadMistFade = { innerR: 16.5, outerR: 25.5 };

  // 1. Extended mist-faded outer ground plane (180x180 at y = -0.02)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x5c6d7e,
    roughness: 0.92,
    metalness: 0.04
  });
  applyRadialMistFade(groundMat, mistUniforms, roadMistFade);
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.02;
  groundMesh.receiveShadow = true;
  groundMesh.name = 'ExtendedGroundPlane';
  group.add(groundMesh);
  hiddenDuringReflection.push(groundMesh);

  // 2. Rain-soaked dark charcoal-slate wet asphalt road (x in [-5.1, +5.1], mesh width 10.8, length 78.0)
  const roadTex = createWetRoadTextures();
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex.albedo,
    roughnessMap: roadTex.roughness,
    alphaMap: roadTex.puddleAlpha,
    transparent: true,
    roughness: 0.44,
    metalness: 0.14
  });
  applyRadialMistFade(roadMat, mistUniforms, roadMistFade);
  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(10.8, ROAD_LEN), roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(0, 0.018, 0);
  roadMesh.receiveShadow = true;
  roadMesh.renderOrder = 2;
  roadMesh.name = 'WetAsphaltRoad';
  group.add(roadMesh);
  hiddenDuringReflection.push(roadMesh);

  // 3. Road markings layer (y = 0.032): Zebra Crossing (斑馬線 z=+3.4), Yellow Box (黃格 z=+0.2), Drainage Grates
  const markingsGroup = new THREE.Group();
  markingsGroup.name = 'RoadMarkingsGroup';

  const zebraMat = new THREE.MeshStandardMaterial({
    map: createZebraTexture(),
    transparent: true,
    opacity: 0.88,
    roughness: 0.65,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  const zebraMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 1.85), zebraMat);
  zebraMesh.rotation.x = -Math.PI / 2;
  zebraMesh.position.set(0, 0.032, 3.4);
  zebraMesh.receiveShadow = true;
  zebraMesh.renderOrder = 3;
  markingsGroup.add(zebraMesh);

  const yellowBoxMat = new THREE.MeshStandardMaterial({
    map: createYellowBoxTexture(),
    transparent: true,
    opacity: 0.78,
    roughness: 0.68,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  const yellowBoxMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 2.5), yellowBoxMat);
  yellowBoxMesh.rotation.x = -Math.PI / 2;
  yellowBoxMesh.position.set(0, 0.032, 0.2);
  yellowBoxMesh.receiveShadow = true;
  yellowBoxMesh.renderOrder = 3;
  markingsGroup.add(yellowBoxMesh);

  // Signature Hong Kong painted Double Yellow No-Parking Lines (雙黃線) along BOTH curbs (x = ±4.80 & ±4.93)
  const doubleYellowTex = createDoubleYellowPaintTexture();
  const doubleYellowMat = new THREE.MeshStandardMaterial({
    map: doubleYellowTex,
    roughness: 0.40,
    metalness: 0.10,
    transparent: true,
    opacity: 0.90,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  applyRadialMistFade(doubleYellowMat, mistUniforms, roadMistFade);

  const lineGeom = new THREE.PlaneGeometry(0.062, ROAD_LEN);
  for (const side of [-1, 1]) {
    for (const xAbs of [4.80, 4.93]) {
      const line = new THREE.Mesh(lineGeom, doubleYellowMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(side * xAbs, 0.031, 0);
      line.receiveShadow = true;
      line.renderOrder = 3;
      line.userData.skipPrintEdges = true;
      markingsGroup.add(line);
    }
  }

  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x26313c,
    roughness: 0.55,
    metalness: 0.65
  });
  applyRadialMistFade(grateMat, mistUniforms, roadMistFade);
  const grateZs = [-8.8, -1.6, 5.0, 10.6];
  for (const gz of grateZs) {
    for (const gx of [-4.72, 4.72]) {
      const grate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.72), grateMat);
      grate.position.set(gx, 0.028, gz);
      grate.userData.skipPrintEdges = true;
      markingsGroup.add(grate);
    }
  }
  group.add(markingsGroup);
  hiddenDuringReflection.push(markingsGroup);

  // 4. Soft wet-surface localized warm/cyan specular spill pools (re-aligned to decompressed shops/vending/kiosk!)
  const glowGroup = new THREE.Group();
  glowGroup.name = 'WetPuddleGlowPools';
  const glowTex = createGlowSpriteTexture();
  const puddleGlows: Array<{ mat: THREE.MeshBasicMaterial; baseOpacity: number }> = [];

  const addPuddleGlow = (
    x: number,
    z: number,
    sx: number,
    sz: number,
    hex: number,
    opacity: number,
    y = 0.036
  ) => {
    const mat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: hex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 4;
    glowGroup.add(m);
    puddleGlows.push({ mat, baseOpacity: opacity });
  };

  // Warm tungsten spills on wet asphalt road outside 金鳳冰室 (B1) & 明記雲吞麵 (B2)
  addPuddleGlow(-3.3, 6.8, 6.4, 5.8, 0xff9b38, 0.26);
  addPuddleGlow(-3.2, 0.5, 6.8, 4.8, 0xff9634, 0.34);
  addPuddleGlow(-3.6, 5.4, 3.8, 3.6, 0xff5448, 0.14);
  // Crisp icy-cyan reflection spill on east wet road & east sidewalk plaza outside vending machines (7.0..8.15, 2.5)
  addPuddleGlow(3.3, 3.6, 5.8, 5.2, 0x62e2ff, 0.24);
  addPuddleGlow(7.55, 3.85, 4.6, 3.6, 0x76ebff, 0.24, 0.175);
  // Warm amber damp-granite spill outside east plaza newspaper kiosk (9.4, 7.4)
  addPuddleGlow(8.7, 8.2, 4.4, 3.8, 0xffb250, 0.20, 0.175);
  // Subtle cyan wet sheen outside far-right B4 24H convenience store (15.4, -9.6)
  addPuddleGlow(14.5, -5.8, 5.0, 3.4, 0x72e6ff, 0.18, 0.175);

  group.add(glowGroup);
  hiddenDuringReflection.push(glowGroup);

  // 5. Orthographic-compatible Planar Wet Reflector (width 10.4, length 42.0, y = 0.003)
  const reflector = new PlanarWetReflector(10.4, 42.0, 0.003, mistUniforms, hiddenDuringReflection);
  reflector.name = 'PlanarWetRoadReflector';
  group.add(reflector);

  // 6. Twin Recessed Glistening Steel Tram Rails (x = -1.85 southbound hero track and x = +1.85 northbound track)
  const railsGroup = new THREE.Group();
  railsGroup.name = 'TramRailsGroup';

  const grooveMat = new THREE.MeshStandardMaterial({
    color: 0x161e26,
    roughness: 0.72,
    metalness: 0.2
  });
  applyRadialMistFade(grooveMat, mistUniforms, roadMistFade);

  const steelRailMat = new THREE.MeshStandardMaterial({
    color: 0xa2b4c4,
    roughness: 0.22,
    metalness: 0.88
  });
  applyRadialMistFade(steelRailMat, mistUniforms, roadMistFade);

  const trackCenters = [-1.85, 1.85];
  const halfGauge = 0.42;

  for (const cx of trackCenters) {
    for (const side of [-1, 1]) {
      const rx = cx + side * halfGauge;
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.016, ROAD_LEN), grooveMat);
      groove.position.set(rx, 0.028, 0);
      railsGroup.add(groove);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.024, ROAD_LEN), steelRailMat);
      head.position.set(rx, 0.042, 0);
      railsGroup.add(head);
    }
  }
  group.add(railsGroup);
  hiddenDuringReflection.push(railsGroup);

  // 7. Wide Open-Bottom Raised Granite-Curbed Sidewalks starting at x = ±5.1 (width 36.0, length 78.0)
  const sidewalkTex = createSidewalkTexture();
  const wetSidewalkRoughnessMap = createWetSidewalkRoughnessTexture();
  wetSidewalkRoughnessMap.repeat.set(9.5, 19.5);
  const sidewalkTopMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughnessMap: wetSidewalkRoughnessMap,
    color: 0xb0becb,
    roughness: 0.78,
    metalness: 0.08
  });
  applyRadialMistFade(sidewalkTopMat, mistUniforms, roadMistFade);

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x8492a0,
    roughness: 0.72,
    metalness: 0.08
  });
  applyRadialMistFade(curbMat, mistUniforms, roadMistFade);

  const sidewalkWidth = 36.0;
  const sidewalkLen = ROAD_LEN;
  const sidewalkY = 0.16;

  const buildOpenSidewalk = (side: -1 | 1) => {
    const swGroup = new THREE.Group();
    const topDeck = new THREE.Mesh(new THREE.PlaneGeometry(sidewalkWidth, sidewalkLen), sidewalkTopMat);
    topDeck.name = 'SidewalkOuterDeck';
    topDeck.rotation.x = -Math.PI / 2;
    topDeck.position.set(side * (5.1 + sidewalkWidth * 0.5), sidewalkY, 0);
    topDeck.receiveShadow = true;
    swGroup.add(topDeck);

    const curbFace = new THREE.Mesh(new THREE.PlaneGeometry(sidewalkLen, sidewalkY), curbMat);
    curbFace.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    curbFace.position.set(side * 5.1, sidewalkY * 0.5, 0);
    curbFace.receiveShadow = true;
    swGroup.add(curbFace);

    const curbLip = new THREE.Mesh(new THREE.PlaneGeometry(0.24, sidewalkLen), curbMat);
    curbLip.rotation.x = -Math.PI / 2;
    curbLip.position.set(side * 5.22, sidewalkY + 0.006, 0);
    curbLip.receiveShadow = true;
    swGroup.add(curbLip);

    return swGroup;
  };

  group.add(buildOpenSidewalk(-1));
  group.add(buildOpenSidewalk(1));

  // 8. Classic Hong Kong Green Tubular Steel Pedestrian Railings at x = ±5.28 (mist-faded 16.0..24.5)
  const railingMat = new THREE.MeshStandardMaterial({
    color: 0x2c6852,
    roughness: 0.45,
    metalness: 0.42
  });
  applyRadialMistFade(railingMat, mistUniforms, { innerR: 16.0, outerR: 24.5 });

  const buildRailingSegment = (x: number, zStart: number, zEnd: number) => {
    const segLen = zEnd - zStart;
    if (segLen < 0.6) return;
    const zMid = (zStart + zEnd) * 0.5;
    const rGroup = new THREE.Group();

    const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, segLen, 8), railingMat);
    topRail.rotation.x = Math.PI / 2;
    topRail.position.set(x, sidewalkY + 0.86, zMid);
    topRail.castShadow = true;
    rGroup.add(topRail);

    const midRail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, segLen, 8), railingMat);
    midRail.rotation.x = Math.PI / 2;
    midRail.position.set(x, sidewalkY + 0.48, zMid);
    rGroup.add(midRail);

    const postCount = Math.max(2, Math.round(segLen / 1.25) + 1);
    for (let i = 0; i < postCount; i++) {
      const pz = zStart + (i / (postCount - 1)) * segLen;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.88, 8), railingMat);
      post.position.set(x, sidewalkY + 0.44, pz);
      post.castShadow = true;
      rGroup.add(post);
    }

    const barCount = Math.max(3, Math.floor(segLen / 0.34));
    for (let i = 1; i < barCount; i++) {
      const bz = zStart + (i / barCount) * segLen;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.02), railingMat);
      bar.position.set(x, sidewalkY + 0.67, bz);
      rGroup.add(bar);
    }

    group.add(rGroup);
  };

  // West curb railings (clean gaps for viaduct [-5.6..-2.0], zebra [2.2..4.6], and tram stop [5.6..8.4])
  buildRailingSegment(-5.28, -23.0, -5.6);
  buildRailingSegment(-5.28, -2.0, 2.2);
  buildRailingSegment(-5.28, 4.6, 5.6);
  buildRailingSegment(-5.28, 8.4, 23.0);

  // East curb railings (clean gaps for viaduct [-5.6..-2.0], zebra [2.2..4.6], and parking bay entry [9.4..13.8])
  buildRailingSegment(5.28, -23.0, -5.6);
  buildRailingSegment(5.28, -2.0, 2.2);
  buildRailingSegment(5.28, 4.6, 9.4);
  buildRailingSegment(5.28, 13.8, 23.0);

  scene.add(group);

  let currentGlowScale = 1.0;

  return {
    group,
    reflector,
    setReflectionStyle: (tintHex, boost) => {
      reflector.setReflectionStyle(tintHex, boost);
    },
    setPrintMode: (enabled) => {
      reflector.visible = !enabled;
      glowGroup.visible = !enabled;
    },
    setGlowScale: (scale) => {
      currentGlowScale = scale;
      for (const pg of puddleGlows) {
        pg.mat.opacity = pg.baseOpacity * currentGlowScale;
      }
    },
    update: (simTime) => {
      reflector.setTime(simTime);
    },
    dispose: () => {
      reflector.dispose();
      wetSidewalkRoughnessMap.dispose();
      doubleYellowTex.dispose();
    }
  };
}
