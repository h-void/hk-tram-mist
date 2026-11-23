import * as THREE from 'three';
import {
  createArchedNeonSignTexture,
  createConcreteRoofTexture,
  createContactShadowTexture,
  createCorrugatedTinTexture,
  createFacadeTextureSet,
  createHeritageDatePlaqueTexture,
  createLouvreVentTexture,
  createMtrExitSignTexture,
  createNeonSignTexture,
  createPawnshopNeonTexture,
  createRoofTileTexture,
  createSafetyNetTexture,
  createShopInteriorTexture,
  createTileDadoTexture,
  createVendingMachineTextureSet
} from './textures';

export interface BuildingsSystem {
  group: THREE.Group;
  neonPositions: THREE.Vector3[];
  setEmissiveScale: (scale: number) => void;
  update: (simTime: number) => void;
}

interface EmissiveTrack {
  mat: THREE.MeshStandardMaterial;
  baseIntensity: number;
  flickerPhase?: number;
  flickerAmp?: number;
}

interface LaundryTrack {
  obj: THREE.Object3D;
  phase: number;
  baseRotX: number;
}

type FaceDir = '+X' | '-X' | '+Z' | '-Z';

export function createBuildings(scene: THREE.Scene): BuildingsSystem {
  const group = new THREE.Group();
  group.name = 'BuildingsGroup';

  const Y0 = 0.16; // Sidewalk top elevation
  const emissiveTracks: EmissiveTrack[] = [];
  const laundryTracks: LaundryTrack[] = [];
  const neonPositions: THREE.Vector3[] = [];
  let beaconMat: THREE.MeshStandardMaterial | null = null;

  // Tag tiny decorative sub-meshes so [P] Print Mode skips noisy ink edges on micro-details
  const markTiny = <T extends THREE.Object3D>(obj: T): T => {
    obj.traverse((child) => {
      child.userData.skipPrintEdges = true;
    });
    return obj;
  };

  // Shared procedural textures
  const rectShadowTex = createContactShadowTexture('rect');
  const concreteRoofTex = createConcreteRoofTexture(404);
  const darkRoofTileTex = createRoofTileTexture('#2d4050', 91);
  const blueRoofTileTex = createRoofTileTexture('#34525c', 117);
  const redStripeCanopyTex = createCorrugatedTinTexture('#9a3b38', '#e6dcd0');
  const greenCanopyTex = createCorrugatedTinTexture('#35564a');
  const tinRoofTex = createCorrugatedTinTexture('#536472');
  const tinPenthouseTex = createCorrugatedTinTexture('#465e5c');
  const tileDadoTex = createTileDadoTexture('#286a54', '#e8e0d0');
  const noodleDadoTex = createTileDadoTexture('#8c6a48', '#e6d8be');
  const safetyNetTex = createSafetyNetTexture();
  const louvreVentTex = createLouvreVentTexture();

  // Shared architectural materials
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x24303c,
    roughness: 0.46,
    metalness: 0.72
  });
  const castIronPipeMat = new THREE.MeshStandardMaterial({
    color: 0x2b3640,
    roughness: 0.56,
    metalness: 0.58
  });
  const brushedAluminumMat = new THREE.MeshStandardMaterial({
    color: 0xbcc8d2,
    roughness: 0.30,
    metalness: 0.78
  });
  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xc8d4dc,
    roughness: 0.24,
    metalness: 0.85
  });
  const copperPipeMat = new THREE.MeshStandardMaterial({
    color: 0x9c6548,
    roughness: 0.42,
    metalness: 0.72
  });
  const transformerBoxMat = new THREE.MeshStandardMaterial({
    color: 0x74808c,
    roughness: 0.62,
    metalness: 0.35
  });
  const warmConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x786d68,
    roughness: 0.86,
    metalness: 0.04
  });
  const coolConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x647585,
    roughness: 0.84,
    metalness: 0.05
  });
  const jadeTrimMat = new THREE.MeshStandardMaterial({
    color: 0x62857f,
    roughness: 0.78,
    metalness: 0.06
  });
  const roofFlatMat = new THREE.MeshStandardMaterial({
    map: concreteRoofTex,
    color: 0x8b98a4,
    roughness: 0.86,
    metalness: 0.04
  });
  const clayRidgeMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d5c,
    roughness: 0.68,
    metalness: 0.12
  });
  const acBodyMat = new THREE.MeshStandardMaterial({
    color: 0xb6c0c8,
    roughness: 0.60,
    metalness: 0.26
  });
  const acGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x222d37,
    roughness: 0.72,
    metalness: 0.42
  });
  const tankSteelMat = new THREE.MeshStandardMaterial({
    color: 0x8a9aa8,
    roughness: 0.40,
    metalness: 0.68
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0xbc9a64,
    roughness: 0.76,
    metalness: 0.04
  });
  const nylonKnotMat = new THREE.MeshStandardMaterial({
    color: 0x161a1e,
    roughness: 0.82,
    metalness: 0.08
  });
  const louvreMat = new THREE.MeshStandardMaterial({
    map: louvreVentTex,
    roughness: 0.52,
    metalness: 0.56
  });
  const clearGlassMat = new THREE.MeshStandardMaterial({
    color: 0xc2f2ff,
    transparent: true,
    opacity: 0.18,
    roughness: 0.08,
    metalness: 0.25,
    depthWrite: false
  });
  const dadoMat = new THREE.MeshStandardMaterial({
    map: tileDadoTex,
    roughness: 0.36,
    metalness: 0.08
  });
  const noodleDadoMat = new THREE.MeshStandardMaterial({
    map: noodleDadoTex,
    roughness: 0.44,
    metalness: 0.06
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x4b2e1e,
    roughness: 0.72
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xcfa45a,
    roughness: 0.34,
    metalness: 0.78
  });

  // =========================================================================
  // REUSABLE ARCHITECTURAL CRAFTSMANSHIP HELPERS
  // =========================================================================

  // Grounded contact Ambient Occlusion shadow decal helper
  const addContactShadow = (x: number, z: number, w: number, d: number, opacity = 0.62) => {
    const mat = new THREE.MeshBasicMaterial({
      map: rectShadowTex,
      transparent: true,
      opacity,
      depthWrite: false
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.3, d + 1.3), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, Y0 + 0.012, z);
    m.renderOrder = 3;
    group.add(m);
  };

  // Upgraded Hong Kong box window AC unit (窗口式冷氣機) with angled louvers, drip tray & copper coil loop
  const addBoxAC = (parent: THREE.Object3D, x: number, y: number, z: number, rotY = 0) => {
    const ac = new THREE.Group();

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.42), acBodyMat);
    box.castShadow = true;
    ac.add(box);

    // Recessed dark intake well
    const well = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.03), acGrilleMat);
    well.position.set(0, 0.01, 0.205);
    ac.add(well);

    // 5 angled 3D front louver slats
    const louvers = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.018, 0.032), acBodyMat);
      slat.position.set(0, -0.08 + i * 0.044, 0.222);
      slat.rotation.x = 0.35;
      louvers.add(slat);
    }
    markTiny(louvers);
    ac.add(louvers);

    // Underneath galvanized steel L-brackets + diagonal wall struts
    const hw = new THREE.Group();
    for (const bx of [-0.22, 0.22]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.46), darkSteelMat);
      br.position.set(bx, -0.195, -0.02);
      hw.add(br);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.34), darkSteelMat);
      strut.position.set(bx, -0.28, -0.10);
      strut.rotation.x = 0.68;
      hw.add(strut);
    }

    // Aluminum water drip tray (滴水盤) + condensate drain pipe
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.025, 0.46), brushedAluminumMat);
    tray.position.set(0, -0.215, 0.01);
    hw.add(tray);

    const drainPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.26, 6), castIronPipeMat);
    drainPipe.position.set(0.24, -0.34, -0.12);
    drainPipe.rotation.x = -0.35;
    hw.add(drainPipe);

    // Curved insulated copper refrigerant pipe loop entering building wall
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.28, -0.04, 0.04),
      new THREE.Vector3(0.35, -0.08, -0.04),
      new THREE.Vector3(0.34, -0.18, -0.16),
      new THREE.Vector3(0.24, -0.16, -0.25)
    ]);
    const copperCoil = new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 8, 0.015, 6, false), copperPipeMat);
    hw.add(copperCoil);

    markTiny(hw);
    ac.add(hw);

    ac.position.set(x, y, z);
    ac.rotation.y = rotY;
    parent.add(ac);
  };

  // Vertical Cast-Iron Exterior Drainage & Vent Pipes (外牆去水渠 / 污水喉) with collars & bends
  const addDrainagePipeRun = (
    parent: THREE.Object3D,
    x: number,
    z: number,
    yTop: number,
    yBot: number,
    outDir: [number, number],
    includeVent = true
  ) => {
    const pipeGroup = new THREE.Group();
    const h = Math.max(0.5, yTop - yBot);
    const yMid = (yTop + yBot) * 0.5;

    // Main soil / rainwater stack
    const mainPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.050, h, 8), castIronPipeMat);
    mainPipe.position.set(x, yMid, z);
    mainPipe.castShadow = true;
    pipeGroup.add(mainPipe);

    // Top rainwater collector hopper under eaves
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.055, 0.22, 6), castIronPipeMat);
    hopper.position.set(x, yTop - 0.11, z);
    pipeGroup.add(hopper);

    // Bottom drainage elbow shoe curving cleanly into sidewalk base
    const shoe = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.18, 8), castIronPipeMat);
    shoe.position.set(x + outDir[0] * 0.03, yBot + 0.09, z + outDir[1] * 0.03);
    shoe.rotation.z = -outDir[0] * 0.35;
    shoe.rotation.x = outDir[1] * 0.35;
    pipeGroup.add(shoe);

    // Parallel thinner vent / condensate pipe
    if (includeVent) {
      const vx = x - outDir[1] * 0.13;
      const vz = z + outDir[0] * 0.13;
      const ventPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, h - 0.25, 6), castIronPipeMat);
      ventPipe.position.set(vx, yMid - 0.10, vz);
      pipeGroup.add(ventPipe);

      // Horizontal elbow bend near top tying into facade
      const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 6), castIronPipeMat);
      elbow.position.set(vx - outDir[0] * 0.08, yTop - 0.30, vz - outDir[1] * 0.08);
      if (Math.abs(outDir[0]) > 0.5) elbow.rotation.z = Math.PI / 2;
      else elbow.rotation.x = Math.PI / 2;
      pipeGroup.add(elbow);
    }

    // Wall mounting pipe clamp collars every ~1.35 units
    const collarCount = Math.max(2, Math.floor(h / 1.35));
    for (let i = 0; i < collarCount; i++) {
      const cy = yBot + 0.65 + (i / Math.max(1, collarCount - 1)) * (h - 1.25);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.05, 8), darkSteelMat);
      collar.position.set(x, cy, z);
      pipeGroup.add(collar);
    }

    markTiny(pipeGroup);
    parent.add(pipeGroup);
  };

  // Classic Hong Kong Folded Accordion Iron Security Gate (通花鐵閘) tucked beside shop entrance
  const addAccordionGate = (
    parent: THREE.Object3D,
    x: number,
    yBase: number,
    z: number,
    height: number,
    rotY = 0
  ) => {
    const gate = new THREE.Group();
    const slatCount = 5;
    for (let i = 0; i < slatCount; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.024, height, 0.09), darkSteelMat);
      slat.position.set(i * 0.048 - 0.096, height * 0.5, 0);
      gate.add(slat);
    }
    // Horizontal diamond scissor-lattice bars
    for (const ly of [height * 0.24, height * 0.52, height * 0.80]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.075), brushedAluminumMat);
      bar.position.set(0, ly, 0);
      gate.add(bar);
    }
    gate.position.set(x, yBase, z);
    gate.rotation.y = rotY;
    markTiny(gate);
    parent.add(gate);
  };

  // 3D Window Sun-Hoods (石屎窗簷篷), Projecting Sills, Wrought-Iron Cages (花籠), & Laundry Poles (晾衫竹)
  const addFacadeWindowReliefs = (
    parent: THREE.Object3D,
    cfg: {
      cx: number;
      yBot: number;
      cz: number;
      W: number;
      H: number;
      D: number;
      cols: number;
      rows: number;
      faces: FaceDir[];
      hoodMat: THREE.Material;
      skipCells?: Array<{ face: FaceDir; col: number; row: number }>;
      cages?: Array<{ face: FaceDir; col: number; row: number; hasPlant?: boolean }>;
      laundryPoles?: Array<{ face: FaceDir; col: number; row: number; phase: number }>;
    }
  ) => {
    const isSkipped = (face: FaceDir, col: number, row: number) =>
      cfg.skipCells?.some((s) => s.face === face && s.col === col && s.row === row) ?? false;

    const clothColors = [0xd66858, 0x6ea6c8, 0xeae2d2, 0x5c9678, 0xe2b85c, 0x9c7ea8];

    for (const face of cfg.faces) {
      const isXFace = face === '+X' || face === '-X';
      const span = isXFace ? cfg.D : cfg.W;
      const winW = span * (0.66 / cfg.cols);
      const winH = cfg.H * (0.56 / cfg.rows);
      const sign = face === '+X' || face === '+Z' ? 1 : -1;
      const rotY = face === '+Z' ? 0 : face === '-Z' ? Math.PI : face === '+X' ? Math.PI / 2 : -Math.PI / 2;

      for (let r = 0; r < cfg.rows; r++) {
        const winTopY = cfg.yBot + cfg.H * (1 - (r + 0.22) / cfg.rows);
        const winBotY = cfg.yBot + cfg.H * (1 - (r + 0.78) / cfg.rows);
        const winMidY = cfg.yBot + cfg.H * (1 - (r + 0.50) / cfg.rows);

        for (let c = 0; c < cfg.cols; c++) {
          if (isSkipped(face, c, r)) continue;

          // Center coordinate along face span (symmetric across BoxGeometry UV mapping)
          const along = -span * 0.5 + (span * (c + 0.5)) / cfg.cols;
          const wx = isXFace ? cfg.cx + sign * (cfg.W * 0.5) : cfg.cx + along;
          const wz = isXFace ? cfg.cz + along : cfg.cz + sign * (cfg.D * 0.5);

          const winNode = new THREE.Group();
          winNode.position.set(wx, winMidY, wz);
          winNode.rotation.y = rotY;

          // 1. 3D Protruding Sloped Concrete Window Sun-Hood (石屎窗簷篷)
          const hood = new THREE.Mesh(
            new THREE.BoxGeometry(winW + 0.16, 0.075, 0.25),
            cfg.hoodMat
          );
          hood.position.set(0, winH * 0.5 + 0.055, 0.105);
          hood.rotation.x = 0.14;
          hood.castShadow = true;
          winNode.add(hood);

          // Tiny side corbel brackets supporting sun-hood
          for (const bx of [-(winW * 0.5 + 0.02), winW * 0.5 + 0.02]) {
            const corbel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.16), cfg.hoodMat);
            corbel.position.set(bx, winH * 0.5 - 0.02, 0.06);
            markTiny(corbel);
            winNode.add(corbel);
          }

          // 2. 3D Projecting Concrete Lower Window Sill
          const sill = new THREE.Mesh(
            new THREE.BoxGeometry(winW + 0.12, 0.068, 0.16),
            cfg.hoodMat
          );
          sill.position.set(0, -winH * 0.5 - 0.035, 0.065);
          sill.castShadow = true;
          winNode.add(sill);

          // 3. Slim recessed dark-steel side reveal moldings
          for (const sx of [-winW * 0.5, winW * 0.5]) {
            const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.038, winH + 0.04, 0.05), darkSteelMat);
            jamb.position.set(sx, 0, 0.015);
            markTiny(jamb);
            winNode.add(jamb);
          }

          // 4. Optional 3D Hong Kong Protruding Wrought-Iron Window Cage (防盜鐵窗花 / 花籠)
          const cageSpec = cfg.cages?.find((cg) => cg.face === face && cg.col === c && cg.row === r);
          if (cageSpec) {
            const cageDepth = 0.34;
            const cageW = winW + 0.06;
            const cageH = winH + 0.06;
            const cage = new THREE.Group();

            // Slanted mini corrugated tin rain-visor over top of cage
            const visor = new THREE.Mesh(
              new THREE.BoxGeometry(cageW + 0.12, 0.032, cageDepth + 0.12),
              darkSteelMat
            );
            visor.position.set(0, cageH * 0.5 + 0.04, cageDepth * 0.5 + 0.02);
            visor.rotation.x = 0.22;
            visor.castShadow = true;
            cage.add(visor);

            // Bottom steel grating tray
            const floorTray = new THREE.Mesh(
              new THREE.BoxGeometry(cageW, 0.028, cageDepth),
              darkSteelMat
            );
            floorTray.position.set(0, -cageH * 0.5, cageDepth * 0.5);
            cage.add(floorTray);

            // Outer front perimeter frame bars + slender vertical wrought-iron pickets
            const barThick = 0.02;
            for (const py of [-cageH * 0.5, 0, cageH * 0.5]) {
              const hBar = new THREE.Mesh(new THREE.BoxGeometry(cageW, barThick, barThick), darkSteelMat);
              hBar.position.set(0, py, cageDepth);
              cage.add(hBar);
            }
            const picketCount = 6;
            for (let p = 0; p < picketCount; p++) {
              const px = -cageW * 0.5 + (p / (picketCount - 1)) * cageW;
              const vBar = new THREE.Mesh(new THREE.BoxGeometry(barThick, cageH, barThick), darkSteelMat);
              vBar.position.set(px, 0, cageDepth);
              cage.add(vBar);
            }
            // Side depth bars tying cage back into wall
            for (const sx of [-cageW * 0.5, cageW * 0.5]) {
              for (const py of [-cageH * 0.5, 0, cageH * 0.5]) {
                const sBar = new THREE.Mesh(new THREE.BoxGeometry(barThick, barThick, cageDepth), darkSteelMat);
                sBar.position.set(sx, py, cageDepth * 0.5);
                cage.add(sBar);
              }
            }

            // Optional tiny potted terracotta houseplant perched inside the flower cage (花籠盆栽!)
            if (cageSpec.hasPlant) {
              const pot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.065, 0.048, 0.11, 8),
                new THREE.MeshStandardMaterial({ color: 0xa4543c, roughness: 0.85 })
              );
              pot.position.set(cageW * 0.22, -cageH * 0.5 + 0.07, cageDepth * 0.52);
              cage.add(pot);
              const foliage = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.095, 0),
                new THREE.MeshStandardMaterial({ color: 0x3b6e4c, roughness: 0.92 })
              );
              foliage.position.set(cageW * 0.22, -cageH * 0.5 + 0.17, cageDepth * 0.52);
              cage.add(foliage);
            }

            markTiny(cage);
            winNode.add(cage);
          }

          // 5. Optional Iconic HK Projecting Bamboo Laundry Pole (晾衫竹) with swaying garments!
          const poleSpec = cfg.laundryPoles?.find((lp) => lp.face === face && lp.col === c && lp.row === r);
          if (poleSpec) {
            const poleGroup = new THREE.Group();
            poleGroup.position.set(winW * 0.12, -winH * 0.26, 0.04);

            const poleLen = 1.05;
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, poleLen, 6), bambooMat);
            pole.rotation.x = Math.PI / 2 - 0.14;
            pole.position.set(0, 0.08, poleLen * 0.5);
            poleGroup.add(pole);

            // 3 tiny draped colorful hanging garments (towels/shirts) gently swaying in breeze
            for (let g = 0; g < 3; g++) {
              const gz = 0.28 + g * 0.28;
              const gy = 0.04 + gz * 0.14;
              const garmentPivot = new THREE.Group();
              garmentPivot.position.set(0, gy, gz);

              const gw = g === 1 ? 0.20 : 0.16;
              const gh = g === 0 ? 0.30 : g === 1 ? 0.26 : 0.22;
              const colHex = clothColors[(Math.round(poleSpec.phase * 10) + g) % clothColors.length];
              const clothMat = new THREE.MeshStandardMaterial({
                color: colHex,
                roughness: 0.88,
                metalness: 0.0,
                side: THREE.DoubleSide
              });
              const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.032, gh, gw), clothMat);
              cloth.position.y = -gh * 0.5;
              cloth.castShadow = true;
              garmentPivot.add(cloth);

              poleGroup.add(garmentPivot);
              laundryTracks.push({
                obj: garmentPivot,
                phase: poleSpec.phase + g * 1.15,
                baseRotX: 0
              });
            }

            markTiny(poleGroup);
            winNode.add(poleGroup);
          }

          parent.add(winNode);
          // Prevent unused-var lint on winTopY/winBotY (kept for semantic clarity)
          void winTopY;
          void winBotY;
        }
      }
    }
  };

  // Upgraded Classic Hong Kong Projecting Neon Sign with 3D diagonal steel lattice truss & transformer box (牛箱)
  const addProjectingNeon = (
    parent: THREE.Object3D,
    tex: THREE.CanvasTexture,
    opts: {
      x: number;
      y: number;
      z: number;
      width: number;
      height: number;
      rotY: number;
      bracketDir: [number, number]; // direction from sign center back to wall
      bracketLen: number;
      emissiveHex: number;
      baseIntensity: number;
      flickerPhase?: number;
    }
  ) => {
    const signGroup = new THREE.Group();
    signGroup.position.set(opts.x, opts.y, opts.z);

    const signFaceMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(opts.emissiveHex),
      emissiveMap: tex,
      emissiveIntensity: opts.baseIntensity,
      roughness: 0.34,
      metalness: 0.15
    });
    emissiveTracks.push({
      mat: signFaceMat,
      baseIntensity: opts.baseIntensity,
      flickerPhase: opts.flickerPhase,
      flickerAmp: opts.flickerPhase !== undefined ? 0.12 : 0.04
    });

    const sideMat = darkSteelMat;
    const mats = [sideMat, sideMat, sideMat, sideMat, signFaceMat, signFaceMat];
    const board = new THREE.Mesh(new THREE.BoxGeometry(opts.width, opts.height, 0.14), mats);
    board.rotation.y = opts.rotY;
    board.castShadow = true;
    signGroup.add(board);

    // Multi-bar 3D diagonal steel lattice truss + wall anchor plates + grey transformer box (牛箱)
    const truss = new THREE.Group();
    const [dx, dz] = opts.bracketDir;
    const rodLen = opts.bracketLen;
    const isAlongX = Math.abs(dx) > Math.abs(dz);
    const halfSpan = opts.width * 0.48;
    const wallDist = halfSpan + rodLen;

    // Paired upper & lower horizontal standoff truss bars
    for (const yOff of [-opts.height * 0.38, opts.height * 0.38]) {
      for (const sideOff of [-0.055, 0.055]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, rodLen + 0.08, 6), darkSteelMat);
        if (isAlongX) {
          rod.rotation.z = Math.PI / 2;
          rod.position.set(dx * (halfSpan + rodLen * 0.5), yOff, sideOff);
        } else {
          rod.rotation.x = Math.PI / 2;
          rod.position.set(sideOff, yOff, dz * (halfSpan + rodLen * 0.5));
        }
        truss.add(rod);
      }

      // Steel wall anchor mounting plate bolted to facade
      const plate = new THREE.Mesh(
        isAlongX ? new THREE.BoxGeometry(0.04, 0.16, 0.18) : new THREE.BoxGeometry(0.18, 0.16, 0.04),
        darkSteelMat
      );
      plate.position.set(dx * wallDist, yOff, dz * wallDist);
      truss.add(plate);
    }

    // Diagonal cross-bracing steel struts from top/bottom of sign back to wall
    const braceLen = Math.hypot(rodLen + opts.width * 0.42, 0.72);
    for (const sideOff of [-0.05, 0.05]) {
      const topBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, braceLen, 6), darkSteelMat);
      if (isAlongX) {
        topBrace.rotation.z = dx > 0 ? Math.PI * 0.32 : -Math.PI * 0.32;
        topBrace.position.set(dx * (rodLen * 0.5 + opts.width * 0.24), opts.height * 0.5 + 0.28, sideOff);
      } else {
        topBrace.rotation.x = dz > 0 ? -Math.PI * 0.32 : Math.PI * 0.32;
        topBrace.position.set(sideOff, opts.height * 0.5 + 0.28, dz * (rodLen * 0.5 + opts.width * 0.24));
      }
      truss.add(topBrace);
    }

    // Lower diagonal compression strut
    const botBraceLen = Math.hypot(rodLen + 0.14, 0.42);
    const botBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, botBraceLen, 6), darkSteelMat);
    if (isAlongX) {
      botBrace.rotation.z = dx > 0 ? -Math.PI * 0.28 : Math.PI * 0.28;
      botBrace.position.set(dx * (halfSpan + rodLen * 0.55), -opts.height * 0.42 - 0.14, 0);
    } else {
      botBrace.rotation.x = dz > 0 ? Math.PI * 0.28 : -Math.PI * 0.28;
      botBrace.position.set(0, -opts.height * 0.42 - 0.14, dz * (halfSpan + rodLen * 0.55));
    }
    truss.add(botBrace);

    // Grey weatherproof high-voltage neon transformer box (牛箱) mounted on wall beside sign
    const txBox = new THREE.Mesh(
      isAlongX ? new THREE.BoxGeometry(0.14, 0.22, 0.20) : new THREE.BoxGeometry(0.20, 0.22, 0.14),
      transformerBoxMat
    );
    txBox.position.set(
      dx * (wallDist - 0.05) + (isAlongX ? 0 : 0.22),
      opts.height * 0.28,
      dz * (wallDist - 0.05) + (isAlongX ? 0.22 : 0)
    );
    truss.add(txBox);

    // Armored black power conduit feeding from transformer box to sign casing
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, rodLen + 0.18, 6), darkSteelMat);
    if (isAlongX) {
      conduit.rotation.z = Math.PI / 2;
      conduit.position.set(dx * (halfSpan + rodLen * 0.46), opts.height * 0.26, 0.12);
    } else {
      conduit.rotation.x = Math.PI / 2;
      conduit.position.set(0.12, opts.height * 0.26, dz * (halfSpan + rodLen * 0.46));
    }
    truss.add(conduit);

    markTiny(truss);
    signGroup.add(truss);

    parent.add(signGroup);
    neonPositions.push(new THREE.Vector3(opts.x, opts.y, opts.z));
  };

  // =========================================================================
  // B1: Front-Left Corner Curved Tong Lau (弧角唐樓) + 金鳳冰室 Cha Chaan Teng
  // Footprint: x in [-14.0, -7.6], z in [+4.0, +9.6], height = 8.4
  // Wide 2.5m open promenade in front & 1.8m HK side-alley (後巷) to B2!
  // =========================================================================
  {
    const b1 = new THREE.Group();
    b1.name = 'B1_CornerTongLau';
    const cx = -10.8;
    const cz = 6.8;
    const W = 6.4;
    const D = 5.6;
    const eastX = cx + W * 0.5;
    const southZ = cz + D * 0.5;
    addContactShadow(cx, cz, W, D, 0.66);

    // 1. Ground Floor Open Arcade Colonnade + 3D Recessed Glowing Cha Chaan Teng (y = 0.16..2.96)
    const arcadeH = 2.8;
    const cctEastTex = createShopInteriorTexture('chachaanteng', 722, 512);
    const cctEastMat = new THREE.MeshStandardMaterial({
      map: cctEastTex,
      emissive: new THREE.Color(0xffb45c),
      emissiveMap: cctEastTex,
      emissiveIntensity: 1.38,
      roughness: 0.44
    });
    emissiveTracks.push({ mat: cctEastMat, baseIntensity: 1.38 });

    const cctSouthTex = createShopInteriorTexture('chachaanteng', 832, 512);
    const cctSouthMat = new THREE.MeshStandardMaterial({
      map: cctSouthTex,
      emissive: new THREE.Color(0xffb45c),
      emissiveMap: cctSouthTex,
      emissiveIntensity: 1.38,
      roughness: 0.44
    });
    emissiveTracks.push({ mat: cctSouthMat, baseIntensity: 1.38 });

    const cctCeilMat = new THREE.MeshStandardMaterial({
      color: 0xffe4b4,
      emissive: new THREE.Color(0xffa94c),
      emissiveIntensity: 0.72,
      roughness: 0.75
    });
    emissiveTracks.push({ mat: cctCeilMat, baseIntensity: 0.72 });

    const cctFloorMat = new THREE.MeshStandardMaterial({
      map: tileDadoTex,
      color: 0xdcc8a8,
      roughness: 0.45
    });

    // Recessed warm glowing Cha Chaan Teng back-wall core (carves 1.85-unit real 3D arcade interior!)
    const coreW = W - 1.85;
    const coreD = D - 1.65;
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(coreW, arcadeH, coreD),
      [cctEastMat, warmConcreteMat, warmConcreteMat, warmConcreteMat, cctSouthMat, warmConcreteMat]
    );
    core.position.set(cx - 0.85, Y0 + arcadeH * 0.5, cz - 0.75);
    core.castShadow = true;
    core.receiveShadow = true;
    b1.add(core);

    // Recessed arcade interior floor & warm glowing ceiling soffit
    const arcadeFloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.34, 0.04, D - 0.34), cctFloorMat);
    arcadeFloor.position.set(cx, Y0 + 0.02, cz);
    arcadeFloor.receiveShadow = true;
    b1.add(arcadeFloor);

    const arcadeSoffit = new THREE.Mesh(new THREE.BoxGeometry(W - 0.24, 0.08, D - 0.24), cctCeilMat);
    arcadeSoffit.position.set(cx, Y0 + arcadeH - 0.05, cz);
    b1.add(arcadeSoffit);

    // 3D Interior Cha Chaan Teng Water-Bar Counter (水吧) + Bakery Glass Display Case!
    const counterGroup = new THREE.Group();
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 2.55), dadoMat);
    barBase.position.set(cx + 1.70, Y0 + 0.46, cz - 0.65);
    counterGroup.add(barBase);
    const barTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.70, 0.07, 2.62),
      new THREE.MeshStandardMaterial({ color: 0xeae2d2, roughness: 0.34 })
    );
    barTop.position.set(cx + 1.72, Y0 + 0.95, cz - 0.65);
    counterGroup.add(barTop);

    // Bakery glass showcase box with miniature golden pineapple buns & egg tarts
    const pastryCase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.92), clearGlassMat);
    pastryCase.position.set(cx + 1.74, Y0 + 1.20, cz + 0.12);
    counterGroup.add(pastryCase);
    const bunMat = new THREE.MeshStandardMaterial({
      color: 0xe8a43e,
      emissive: new THREE.Color(0xc87420),
      emissiveIntensity: 0.42,
      roughness: 0.65
    });
    for (let bi = 0; bi < 6; bi++) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), bunMat);
      bun.scale.set(1, 0.62, 1);
      bun.position.set(cx + 1.74 + (bi % 2) * 0.14 - 0.07, Y0 + 1.04, cz - 0.18 + Math.floor(bi / 2) * 0.28);
      counterGroup.add(bun);
    }
    // Stainless steel silk-stocking milk-tea urns (絲襪奶茶茶壺)
    for (const uz of [cz - 1.45, cz - 1.08]) {
      const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.34, 10), stainlessMat);
      urn.position.set(cx + 1.72, Y0 + 1.15, uz);
      counterGroup.add(urn);
    }
    markTiny(counterGroup);
    b1.add(counterGroup);

    // 4 Warm Glowing Vintage Enamel Hanging Ceiling Pendant Lamps under the arcade soffit
    const cctBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff4cf,
      emissive: new THREE.Color(0xffbd58),
      emissiveIntensity: 2.1,
      roughness: 0.2
    });
    emissiveTracks.push({ mat: cctBulbMat, baseIntensity: 2.1 });
    const enamelShadeMat = new THREE.MeshStandardMaterial({
      color: 0x1e5c46,
      roughness: 0.35,
      metalness: 0.42
    });
    for (const [lx, lz] of [
      [cx + 2.32, cz - 1.5],
      [cx + 2.32, cz],
      [cx + 2.32, cz + 1.45],
      [cx + 1.05, cz + 1.85]
    ]) {
      const lampGrp = new THREE.Group();
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 6), darkSteelMat);
      cord.position.set(lx, Y0 + arcadeH - 0.28, lz);
      lampGrp.add(cord);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.11, 12), enamelShadeMat);
      shade.position.set(lx, Y0 + arcadeH - 0.50, lz);
      lampGrp.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), cctBulbMat);
      bulb.position.set(lx, Y0 + arcadeH - 0.56, lz);
      lampGrp.add(bulb);
      markTiny(lampGrp);
      b1.add(lampGrp);
    }

    // Folded Hong Kong Accordion Iron Security Gates (通花鐵閘) tucked cleanly beside arcade openings
    addAccordionGate(b1, cx + 2.88, Y0, cz - 2.24, arcadeH - 0.12, Math.PI / 2);
    addAccordionGate(b1, cx + 2.88, Y0, cz + 2.22, arcadeH - 0.12, Math.PI / 2);
    addAccordionGate(b1, cx - 2.62, Y0, cz + 2.45, arcadeH - 0.12, 0);
    addAccordionGate(b1, cx - 0.32, Y0, cz + 2.45, arcadeH - 0.12, 0);

    // Tong Lau colonnade columns with HK green-and-white ceramic wainscot tile dado & capitals
    const pillarUpperMat = new THREE.MeshStandardMaterial({
      color: 0x8a6f60,
      roughness: 0.84,
      metalness: 0.04
    });
    const pillarCoords: Array<[number, number]> = [
      [cx + 3.02, cz - 2.55],
      [cx + 3.02, cz - 0.05],
      [cx + 3.02, cz + 2.55],
      [cx, cz + 2.55],
      [cx - 2.95, cz + 2.55]
    ];
    for (const [px, pz] of pillarCoords) {
      // Granite plinth base
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.46), coolConcreteMat);
      plinth.position.set(px, Y0 + 0.18, pz);
      plinth.castShadow = true;
      b1.add(plinth);
      // HK green-and-white ceramic wainscot tile dado lower sleeve
      const dadoCol = new THREE.Mesh(new THREE.BoxGeometry(0.41, 1.18, 0.41), dadoMat);
      dadoCol.position.set(px, Y0 + 0.36 + 0.59, pz);
      dadoCol.castShadow = true;
      b1.add(dadoCol);
      // Dado stone cap collar
      const dadoCap = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), warmConcreteMat);
      dadoCap.position.set(px, Y0 + 1.56, pz);
      b1.add(dadoCap);
      // Upper plastered column shaft
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.12, 0.38), pillarUpperMat);
      shaft.position.set(px, Y0 + 1.59 + 0.56, pz);
      shaft.castShadow = true;
      b1.add(shaft);
      // Art-Deco stepped capital molding
      const capital = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), warmConcreteMat);
      capital.position.set(px, Y0 + arcadeH - 0.07, pz);
      b1.add(capital);
    }

    // Detailed Cha Chaan Teng round marble café tables, brass rims, red stools & tiny milk-tea cups!
    const tableTopMat = new THREE.MeshStandardMaterial({ color: 0xebe3d5, roughness: 0.34 });
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0xb43c36, roughness: 0.48 });
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.25 });
    const teaLiquidMat = new THREE.MeshStandardMaterial({ color: 0x9e5e2e, roughness: 0.3 });

    const tableCoords: Array<[number, number, boolean]> = [
      [cx + 2.52, cz - 1.45, true],
      [cx + 2.52, cz + 0.02, true],
      [cx + 2.52, cz + 1.45, true],
      [cx + 1.15, cz + 1.85, false]
    ];
    for (const [tx, tz, stoolsAlongZ] of tableCoords) {
      const tGrp = new THREE.Group();
      tGrp.position.set(tx, Y0, tz);

      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.045, 14), tableTopMat);
      top.position.y = 0.68;
      tGrp.add(top);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.272, 0.272, 0.03, 14, 1, true), brassMat);
      rim.position.y = 0.675;
      tGrp.add(rim);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.64, 8), darkSteelMat);
      leg.position.y = 0.33;
      tGrp.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.04, 10), darkSteelMat);
      foot.position.y = 0.02;
      tGrp.add(foot);

      // Tiny porcelain Hong Kong milk-tea cups + saucer + red chili-oil bottle
      for (const [cxOff, czOff] of [
        [-0.08, 0.06],
        [0.09, -0.07]
      ]) {
        const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.038, 0.012, 8), cupMat);
        saucer.position.set(cxOff, 0.71, czOff);
        tGrp.add(saucer);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.055, 8), cupMat);
        cup.position.set(cxOff, 0.74, czOff);
        tGrp.add(cup);
        const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 8), teaLiquidMat);
        tea.position.set(cxOff, 0.766, czOff);
        tGrp.add(tea);
      }

      // Chrome-legged red vinyl HK café stools (圓凳)
      for (const sOff of [-0.36, 0.36]) {
        const sx = stoolsAlongZ ? 0 : sOff;
        const sz = stoolsAlongZ ? sOff : 0;
        const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.13, 0.075, 12), stoolMat);
        cushion.position.set(sx, 0.41, sz);
        tGrp.add(cushion);
        const sLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.38, 8, 1, true), stainlessMat);
        sLeg.position.set(sx, 0.19, sz);
        tGrp.add(sLeg);
      }

      markTiny(tGrp);
      b1.add(tGrp);
    }

    // Corrugated red-white striped Cha Chaan Teng awnings with front valance & iron struts
    const awningMat = new THREE.MeshStandardMaterial({
      map: redStripeCanopyTex,
      roughness: 0.65,
      metalness: 0.18
    });
    const eastAwning = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.07, 4.95), awningMat);
    eastAwning.position.set(eastX + 0.39, Y0 + 2.55, cz + 0.05);
    eastAwning.rotation.z = -0.28;
    eastAwning.castShadow = true;
    b1.add(eastAwning);

    for (const sz of [cz - 2.1, cz, cz + 2.0]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.78, 6), darkSteelMat);
      strut.position.set(eastX + 0.22, Y0 + 2.28, sz);
      strut.rotation.z = 0.62;
      markTiny(strut);
      b1.add(strut);
    }

    const southAwning = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.07, 0.84), awningMat);
    southAwning.position.set(cx - 0.1, Y0 + 2.55, southZ + 0.37);
    southAwning.rotation.x = 0.28;
    southAwning.castShadow = true;
    b1.add(southAwning);

    // Glowing fascia header above Cha Chaan Teng arcade (金鳳冰室: +X face 3.60 × 0.68, AR 5.294)
    const fasciaTex = createNeonSignTexture({
      text: '金鳳冰室',
      subText: 'KAM FUNG CAFE · 絲襪奶茶',
      bgColor: '#1b352c',
      borderColor: '#f6c368',
      textColor: '#fff2cc',
      glowColor: '#ff9d3b',
      width: 960,
      height: 182
    });
    const fasciaMat = new THREE.MeshStandardMaterial({
      map: fasciaTex,
      emissive: new THREE.Color(0xffaa44),
      emissiveMap: fasciaTex,
      emissiveIntensity: 1.15,
      roughness: 0.38
    });
    emissiveTracks.push({ mat: fasciaMat, baseIntensity: 1.15 });
    const fasciaBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.68, 3.6),
      [fasciaMat, darkSteelMat, darkSteelMat, darkSteelMat, darkSteelMat, darkSteelMat]
    );
    fasciaBoard.position.set(eastX + 0.04, Y0 + 3.06, cz + 0.1);
    b1.add(fasciaBoard);

    // 2. Upper Floors (y = 2.96..8.16) — Warm Terracotta Weathered Tong Lau Plaster
    const upperH = 5.2;
    const b1Tex = createFacadeTextureSet({
      seed: 101,
      baseColor: '#7c655c',
      secondaryColor: '#5b4b46',
      trimColor: '#9b8679',
      cols: 3,
      rows: 2,
      tileStyle: 'plaster',
      litProbability: 0.65,
      warmRatio: 0.85,
      hasIronGrilles: true,
      stainStrength: 1.15
    });
    const b1WallMat = new THREE.MeshStandardMaterial({
      map: b1Tex.map,
      emissive: new THREE.Color(0xffc97e),
      emissiveMap: b1Tex.emissiveMap,
      emissiveIntensity: 0.72,
      bumpMap: b1Tex.bumpMap,
      bumpScale: 0.045,
      roughness: 0.84,
      metalness: 0.04
    });
    emissiveTracks.push({ mat: b1WallMat, baseIntensity: 0.72 });

    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(W, upperH, D), b1WallMat);
    upperBody.position.set(cx, Y0 + arcadeH + upperH * 0.5, cz);
    upperBody.castShadow = true;
    upperBody.receiveShadow = true;
    b1.add(upperBody);

    // Curved Tong Lau Corner Turret Accent (弧角) + Smooth Curved Art-Deco Horizontal Banding
    const curveRadius = 0.78;
    const curveCX = cx + W * 0.5 - curveRadius + 0.14;
    const curveCZ = cz + D * 0.5 - curveRadius + 0.14;
    const curvedCorner = new THREE.Mesh(
      new THREE.CylinderGeometry(curveRadius, curveRadius, upperH - 0.06, 16, 1, false, 0, Math.PI * 0.5),
      b1WallMat
    );
    curvedCorner.position.set(curveCX, Y0 + arcadeH + upperH * 0.5, curveCZ);
    curvedCorner.castShadow = true;
    b1.add(curvedCorner);

    // Continuous Art-Deco Tong Lau cornice slabs + matching curved corner collar bands!
    const corniceMat = new THREE.MeshStandardMaterial({ color: 0x9b897c, roughness: 0.80 });
    const corniceYs = [Y0 + arcadeH + 0.05, Y0 + arcadeH + 2.6, Y0 + arcadeH + upperH + 0.08];
    for (const cy of corniceYs) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.34, 0.22, D + 0.34), corniceMat);
      band.position.set(cx, cy, cz);
      band.castShadow = true;
      b1.add(band);

      const curveBand = new THREE.Mesh(
        new THREE.CylinderGeometry(curveRadius + 0.16, curveRadius + 0.16, 0.24, 16, 1, false, 0, Math.PI * 0.5),
        corniceMat
      );
      curveBand.position.set(curveCX, cy, curveCZ);
      b1.add(curveBand);
    }
    // Fine Art-Deco fluted accent ribs wrapping curved corner at mid-storey heights
    for (const fy of [Y0 + arcadeH + 1.32, Y0 + arcadeH + 3.92]) {
      const rib = new THREE.Mesh(
        new THREE.CylinderGeometry(curveRadius + 0.05, curveRadius + 0.05, 0.09, 16, 1, false, 0, Math.PI * 0.5),
        corniceMat
      );
      rib.position.set(curveCX, fy, curveCZ);
      markTiny(rib);
      b1.add(rib);
    }

    // Angled corner molding pilasters on non-curved vertical corners
    for (const [px, pz] of [
      [cx - W * 0.5, cz + D * 0.5],
      [cx + W * 0.5, cz - D * 0.5],
      [cx - W * 0.5, cz - D * 0.5]
    ]) {
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.24, upperH, 0.24), corniceMat);
      pilaster.position.set(px, Y0 + arcadeH + upperH * 0.5, pz);
      pilaster.rotation.y = Math.PI * 0.25;
      b1.add(pilaster);
    }

    // 3D Window Sun-Hoods (石屎窗簷篷), Sills & Protruding Wrought-Iron Cages (花籠) on B1
    addFacadeWindowReliefs(b1, {
      cx,
      yBot: Y0 + arcadeH,
      cz,
      W,
      H: upperH,
      D,
      cols: 3,
      rows: 2,
      faces: ['+X', '+Z'],
      hoodMat: corniceMat,
      cages: [
        { face: '+X', col: 1, row: 0, hasPlant: true },
        { face: '+Z', col: 1, row: 1, hasPlant: false }
      ]
    });

    // Open wrought-iron Tong Lau balconies on +Z south face + bamboo laundry pole (晾衫竹)!
    for (const [bIdx, by] of ([Y0 + arcadeH + 0.55, Y0 + arcadeH + 3.15] as const).entries()) {
      const balX = cx - 0.6;
      const balZFront = cz + D * 0.5 + 0.52;
      const balSlab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.11, 0.58), corniceMat);
      balSlab.position.set(balX, by - 0.42, cz + D * 0.5 + 0.26);
      b1.add(balSlab);

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.045, 0.045), darkSteelMat);
      topBar.position.set(balX, by + 0.30, balZFront);
      b1.add(topBar);

      const botBar = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.035, 0.04), darkSteelMat);
      botBar.position.set(balX, by - 0.30, balZFront);
      b1.add(botBar);

      for (const sDir of [-1, 1]) {
        const sideTop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.54), darkSteelMat);
        sideTop.position.set(balX + sDir * 1.27, by + 0.30, cz + D * 0.5 + 0.26);
        b1.add(sideTop);
      }

      const spindleCount = 11;
      for (let i = 0; i < spindleCount; i++) {
        const sx = balX - 1.24 + (i / (spindleCount - 1)) * 2.48;
        const spindle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.66, 0.024), darkSteelMat);
        spindle.position.set(sx, by - 0.02, balZFront);
        markTiny(spindle);
        b1.add(spindle);
      }

      // Iconic Hong Kong Bamboo Laundry Pole poking out from upper balcony rail!
      if (bIdx === 1) {
        const poleGrp = new THREE.Group();
        poleGrp.position.set(balX + 0.55, by + 0.30, balZFront);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 1.05, 6), bambooMat);
        pole.rotation.x = Math.PI / 2 - 0.14;
        pole.position.set(0, 0.08, 0.50);
        poleGrp.add(pole);

        const clothHexes = [0xe4e0d4, 0x6ca4c4, 0xd86e5c];
        clothHexes.forEach((hex, ci) => {
          const piv = new THREE.Group();
          piv.position.set(0, 0.04 + (0.26 + ci * 0.26) * 0.14, 0.26 + ci * 0.26);
          const garment = new THREE.Mesh(
            new THREE.BoxGeometry(0.032, ci === 1 ? 0.28 : 0.24, 0.17),
            new THREE.MeshStandardMaterial({ color: hex, roughness: 0.88 })
          );
          garment.position.y = -0.14;
          garment.castShadow = true;
          piv.add(garment);
          poleGrp.add(piv);
          laundryTracks.push({ obj: piv, phase: 0.6 + ci * 1.2, baseRotX: 0 });
        });
        markTiny(poleGrp);
        b1.add(poleGrp);
      }
    }

    // Cast-iron exterior drainage pipes & downspouts on B1 corners
    addDrainagePipeRun(b1, cx - W * 0.5 - 0.06, cz + D * 0.5 + 0.04, Y0 + arcadeH + upperH + 0.08, Y0, [0, 1], true);
    addDrainagePipeRun(b1, cx + W * 0.5 + 0.06, cz - D * 0.5 + 0.12, Y0 + arcadeH + upperH + 0.08, Y0, [1, 0], false);

    // Authentic 1950s Hong Kong Curved Tong Lau Art-Deco Parapet Roof Terrace (弧角唐樓天台)
    const roofBaseY = Y0 + arcadeH + upperH + 0.14;
    const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(W - 0.14, 0.10, D - 0.14), roofFlatMat);
    roofDeck.position.set(cx, roofBaseY, cz);
    roofDeck.receiveShadow = true;
    b1.add(roofDeck);

    // Molded perimeter parapet wall wrapping the straight sides & curved SE corner
    const pH = 0.78;
    const pT = 0.24;
    const b1ParapetSpecs: Array<[number, number, number, number]> = [
      [cx - 0.34, cz + D * 0.5 - pT * 0.5, W - 0.68, pT],
      [cx, cz - D * 0.5 + pT * 0.5, W, pT],
      [cx + W * 0.5 - pT * 0.5, cz - 0.34, pT, D - 0.68],
      [cx - W * 0.5 + pT * 0.5, cz, pT, D]
    ];
    for (const [px, pz, pw, pd] of b1ParapetSpecs) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(pw, pH, pd), warmConcreteMat);
      p.position.set(px, roofBaseY + pH * 0.5, pz);
      p.castShadow = true;
      p.receiveShadow = true;
      b1.add(p);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.08, 0.08, pd + 0.08), corniceMat);
      cap.position.set(px, roofBaseY + pH + 0.04, pz);
      b1.add(cap);
    }

    // Elevated Streamline Moderne Curved Corner Pediment + Embossed Heritage '1958' Plaque!
    const curvedParapet = new THREE.Mesh(
      new THREE.CylinderGeometry(curveRadius + 0.02, curveRadius + 0.02, pH + 0.34, 16, 1, false, 0, Math.PI * 0.5),
      corniceMat
    );
    curvedParapet.position.set(curveCX, roofBaseY + (pH + 0.34) * 0.5, curveCZ);
    curvedParapet.castShadow = true;
    b1.add(curvedParapet);

    const curvedCap = new THREE.Mesh(
      new THREE.CylinderGeometry(curveRadius + 0.10, curveRadius + 0.10, 0.10, 16, 1, false, 0, Math.PI * 0.5),
      corniceMat
    );
    curvedCap.position.set(curveCX, roofBaseY + pH + 0.38, curveCZ);
    b1.add(curvedCap);

    // Embossed '1958' plaque angled cleanly across the curved corner pediment facing SE camera!
    const plaqueMat1958 = new THREE.MeshStandardMaterial({
      map: createHeritageDatePlaqueTexture(),
      roughness: 0.68,
      metalness: 0.06
    });
    const datePlaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.36, 0.06),
      [corniceMat, corniceMat, corniceMat, corniceMat, plaqueMat1958, corniceMat]
    );
    datePlaque.position.set(curveCX + 0.58, roofBaseY + pH + 0.08, curveCZ + 0.58);
    datePlaque.rotation.y = Math.PI * 0.25;
    b1.add(datePlaque);

    // Tiled Rooftop Stair Bulkhead (天台樓梯屋) with pitched slate-tile roof & glowing stairwell transom!
    const pitchedRoofMat = new THREE.MeshStandardMaterial({
      map: darkRoofTileTex,
      roughness: 0.72,
      metalness: 0.12
    });
    const stairX = cx - 1.35;
    const stairZ = cz - 1.05;
    const stairBody = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.48, 1.95), warmConcreteMat);
    stairBody.position.set(stairX, roofBaseY + 0.74, stairZ);
    stairBody.castShadow = true;
    b1.add(stairBody);

    const stairRoof = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.12, 2.24), pitchedRoofMat);
    stairRoof.position.set(stairX, roofBaseY + 1.54, stairZ);
    stairRoof.rotation.x = 0.12;
    stairRoof.castShadow = true;
    b1.add(stairRoof);

    const stairDoorB1 = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.12, 0.06), darkSteelMat);
    stairDoorB1.position.set(stairX + 0.35, roofBaseY + 0.58, stairZ + 0.99);
    markTiny(stairDoorB1);
    b1.add(stairDoorB1);

    const stairTransomMat = new THREE.MeshStandardMaterial({
      color: 0xffdf9a,
      emissive: new THREE.Color(0xffa63e),
      emissiveIntensity: 1.25,
      roughness: 0.35
    });
    emissiveTracks.push({ mat: stairTransomMat, baseIntensity: 1.25 });
    const stairTransom = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.20, 0.06), stairTransomMat);
    stairTransom.position.set(stairX + 0.35, roofBaseY + 1.26, stairZ + 0.99);
    markTiny(stairTransom);
    b1.add(stairTransom);

    // Corrugated tin rooftop garden canopy + potted terracotta rooftop plants & clothesline
    const terraceShade = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.06, 1.55),
      new THREE.MeshStandardMaterial({ map: greenCanopyTex, roughness: 0.68, metalness: 0.22 })
    );
    terraceShade.position.set(cx + 1.35, roofBaseY + 1.28, cz - 1.35);
    terraceShade.rotation.z = -0.14;
    terraceShade.castShadow = true;
    b1.add(terraceShade);
    for (const [px, pz] of [
      [cx + 0.48, cz - 0.68],
      [cx + 2.22, cz - 0.68],
      [cx + 2.22, cz - 2.02]
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.24, 6), darkSteelMat);
      post.position.set(px, roofBaseY + 0.62, pz);
      markTiny(post);
      b1.add(post);
    }

    const roofPlantMat = new THREE.MeshStandardMaterial({ color: 0x356448, roughness: 0.94 });
    const roofPotMat = new THREE.MeshStandardMaterial({ color: 0x9c523a, roughness: 0.85 });
    for (const [px, pz] of [
      [cx + 1.65, cz + 1.35],
      [cx + 0.95, cz + 1.55],
      [cx - 0.20, cz + 1.60]
    ]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.28, 8), roofPotMat);
      pot.position.set(px, roofBaseY + 0.14, pz);
      b1.add(pot);
      const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), roofPlantMat);
      shrub.position.set(px, roofBaseY + 0.36, pz);
      markTiny(shrub);
      b1.add(shrub);
    }

    // Rooftop galvanized water tank raised on steel legs on open west-south terrace corner
    const tankGrp = new THREE.Group();
    tankGrp.position.set(cx - 1.75, roofBaseY + 0.06, cz + 1.25);
    for (const [lx, lz] of [
      [-0.26, -0.26],
      [0.26, -0.26],
      [-0.26, 0.26],
      [0.26, 0.26]
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.40, 0.055), darkSteelMat);
      leg.position.set(lx, 0.20, lz);
      markTiny(leg);
      tankGrp.add(leg);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.86, 14), tankSteelMat);
    tank.position.y = 0.82;
    tank.castShadow = true;
    tankGrp.add(tank);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10), darkSteelMat);
    hatch.position.set(0.12, 1.27, 0.09);
    markTiny(hatch);
    tankGrp.add(hatch);
    b1.add(tankGrp);

    // Enriched Narrow HK Back-Alley Micro-Life (後巷) between B1 (z=4.0) & B2 (z=2.2)
    {
      const alleyGrp = new THREE.Group();
      const alleyZ = cz - D * 0.5 - 0.85; // z ≈ 3.15
      // Overhead bare-bulb alleyway wire & warm tungsten bulb bridging B1 and B2
      const alleyWire = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1.85, 5), darkSteelMat);
      alleyWire.rotation.x = Math.PI / 2;
      alleyWire.position.set(eastX - 0.55, Y0 + 2.85, alleyZ);
      alleyGrp.add(alleyWire);
      const alleyShade = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.09, 10), enamelShadeMat);
      alleyShade.position.set(eastX - 0.55, Y0 + 2.74, alleyZ);
      alleyGrp.add(alleyShade);
      const alleyBulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), cctBulbMat);
      alleyBulb.position.set(eastX - 0.55, Y0 + 2.67, alleyZ);
      alleyGrp.add(alleyBulb);

      // Wall-mounted cast-iron HK water-meter bank & conduit box on B1 north cheek wall
      const meterBox = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.58, 0.14), transformerBoxMat);
      meterBox.position.set(eastX - 1.15, Y0 + 1.45, cz - D * 0.5 - 0.07);
      alleyGrp.add(meterBox);
      for (let mp = 0; mp < 4; mp++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.15, 6), copperPipeMat);
        pipe.position.set(eastX - 1.38 + mp * 0.14, Y0 + 0.62, cz - D * 0.5 - 0.08);
        alleyGrp.add(pipe);
      }

      // Stacked blue plastic kitchen delivery crates tucked into the alley shadow
      const alleyCrateMat = new THREE.MeshStandardMaterial({ color: 0x2662a4, roughness: 0.48 });
      for (let st = 0; st < 2; st++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.30, 0.36), alleyCrateMat);
        crate.position.set(eastX - 0.52, Y0 + 0.15 + st * 0.30, cz - D * 0.5 - 0.24);
        crate.rotation.y = st * 0.08;
        crate.castShadow = true;
        alleyGrp.add(crate);
      }
      markTiny(alleyGrp);
      b1.add(alleyGrp);
    }

    // Detailed Box AC units on B1 facades (relative to new cx/cz)
    addBoxAC(b1, eastX + 0.18, Y0 + 4.0, cz - 1.5, Math.PI / 2);
    addBoxAC(b1, eastX + 0.18, Y0 + 6.5, cz + 1.1, Math.PI / 2);
    addBoxAC(b1, cx + 1.4, Y0 + 4.1, southZ + 0.18, 0);
    addBoxAC(b1, cx - 1.5, Y0 + 6.6, southZ + 0.18, 0);

    // Projecting Hero HK Neon Signs on B1 east street face (cleanly anchored to eastX = -7.6)
    const pawnTex = createPawnshopNeonTexture();
    addProjectingNeon(b1, pawnTex, {
      x: eastX + 0.52,
      y: Y0 + 5.85,
      z: cz - 1.45,
      width: 0.88,
      height: 0.88,
      rotY: 0,
      bracketDir: [-1, 0],
      bracketLen: 0.12,
      emissiveHex: 0xff5a48,
      baseIntensity: 1.55,
      flickerPhase: 1.2
    });

    const cctVertTex = createNeonSignTexture({
      text: '金鳳冰室',
      subText: '冰室',
      vertical: true,
      bgColor: '#172c26',
      borderColor: '#ffbe58',
      textColor: '#fff5d4',
      glowColor: '#ff962e',
      width: 200,
      height: 512
    });
    addProjectingNeon(b1, cctVertTex, {
      x: eastX + 0.52,
      y: Y0 + 4.6,
      z: cz + 1.25,
      width: 0.72,
      height: 1.85,
      rotY: 0,
      bracketDir: [-1, 0],
      bracketLen: 0.18,
      emissiveHex: 0xffa83e,
      baseIntensity: 1.45,
      flickerPhase: 3.1
    });

    group.add(b1);
  }

  // =========================================================================
  // B2: Mid-Left Wan Chai Blue-Green Tiled Tong Lau (藍屋風 + 明記雲吞麵 + 竹棚)
  // Footprint: x in [-12.2, -6.6], z in [-1.4, +2.2], cleanly south of viaduct!
  // =========================================================================
  {
    const b2 = new THREE.Group();
    b2.name = 'B2_BlueTongLau';
    const cx = -9.4;
    const cz = 0.4;
    const W = 5.6;
    const D = 3.6;
    const eastX = cx + W * 0.5;
    const southZ = cz + D * 0.5;
    addContactShadow(cx, cz, W, D, 0.64);

    // 1. Physically Recessed Ground-Floor Wonton Noodle Shop (明記雲吞麵) + 3D Noodle-Cooking Stall!
    const gfH = 2.6;
    const noodleTex = createShopInteriorTexture('noodle');
    const noodleMat = new THREE.MeshStandardMaterial({
      map: noodleTex,
      emissive: new THREE.Color(0xffa848),
      emissiveMap: noodleTex,
      emissiveIntensity: 1.48,
      roughness: 0.42
    });
    emissiveTracks.push({ mat: noodleMat, baseIntensity: 1.48 });

    const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x4b6e78, roughness: 0.84 });
    const recessDepth = 0.96;
    // Recessed main back core box (east face sits at eastX - recessDepth)
    const gfBackW = W - recessDepth;
    const gfBox = new THREE.Mesh(
      new THREE.BoxGeometry(gfBackW, gfH, D - 0.14),
      [noodleMat, sideWallMat, sideWallMat, sideWallMat, sideWallMat, sideWallMat]
    );
    gfBox.position.set(cx - recessDepth * 0.5, Y0 + gfH * 0.5, cz);
    gfBox.castShadow = true;
    gfBox.receiveShadow = true;
    b2.add(gfBox);

    // Recessed shopfront cheek walls, floor & warm glowing soffit ceiling
    const noodleCeilMat = new THREE.MeshStandardMaterial({
      color: 0xffdfa8,
      emissive: new THREE.Color(0xff9c3e),
      emissiveIntensity: 0.85,
      roughness: 0.72
    });
    emissiveTracks.push({ mat: noodleCeilMat, baseIntensity: 0.85 });

    for (const czWall of [cz - D * 0.5 + 0.08, cz + D * 0.5 - 0.08]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(recessDepth, gfH, 0.14), sideWallMat);
      cheek.position.set(eastX - recessDepth * 0.5, Y0 + gfH * 0.5, czWall);
      cheek.castShadow = true;
      b2.add(cheek);
    }
    const recessFloor = new THREE.Mesh(new THREE.BoxGeometry(recessDepth + 0.05, 0.04, D - 0.16), noodleDadoMat);
    recessFloor.position.set(eastX - recessDepth * 0.5, Y0 + 0.02, cz);
    b2.add(recessFloor);

    const recessCeil = new THREE.Mesh(new THREE.BoxGeometry(recessDepth, 0.08, D - 0.16), noodleCeilMat);
    recessCeil.position.set(eastX - recessDepth * 0.5, Y0 + gfH - 0.05, cz);
    b2.add(recessCeil);

    // Timber shopfront header & corner frame posts
    const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, D), woodMat);
    headerBeam.position.set(eastX - 0.06, Y0 + gfH - 0.15, cz);
    b2.add(headerBeam);
    for (const pz of [cz - D * 0.5 + 0.12, cz + D * 0.5 - 0.12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, gfH, 0.18), woodMat);
      post.position.set(eastX - 0.06, Y0 + gfH * 0.5, pz);
      b2.add(post);
    }

    // Folded HK iron accordion security gate tucked cleanly on south side of noodle shop
    addAccordionGate(b2, eastX - 0.14, Y0, cz + D * 0.5 - 0.34, gfH - 0.18, Math.PI / 2);

    // 3D Open Noodle-Cooking Stall Counter (麵檔煮麵爐) with stainless steam hood, bowls & warm glow!
    const stallGrp = new THREE.Group();
    const stallX = eastX - 0.42;
    const stallZ = cz - 0.35;

    const stallBase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.88, 1.85), noodleDadoMat);
    stallBase.position.set(stallX, Y0 + 0.44, stallZ);
    stallBase.castShadow = true;
    stallGrp.add(stallBase);

    // Warm under-counter glowing amber light strip
    const underGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffd690,
      emissive: new THREE.Color(0xff922e),
      emissiveIntensity: 1.6,
      roughness: 0.3
    });
    emissiveTracks.push({ mat: underGlowMat, baseIntensity: 1.6 });
    const underStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 1.76), underGlowMat);
    underStrip.position.set(stallX + 0.35, Y0 + 0.82, stallZ);
    markTiny(underStrip);
    stallGrp.add(underStrip);

    // Brushed stainless-steel noodle boiler counter top + steaming vat + noodle baskets
    const stallTop = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.07, 1.92), stainlessMat);
    stallTop.position.set(stallX + 0.02, Y0 + 0.91, stallZ);
    stallGrp.add(stallTop);

    const vat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 12), stainlessMat);
    vat.position.set(stallX, Y0 + 0.98, stallZ - 0.42);
    markTiny(vat);
    stallGrp.add(vat);

    const brothMat = new THREE.MeshStandardMaterial({
      color: 0xe6a854,
      emissive: new THREE.Color(0xc87424),
      emissiveIntensity: 0.65,
      roughness: 0.25
    });
    const broth = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 10), brothMat);
    broth.position.set(stallX, Y0 + 1.05, stallZ - 0.42);
    markTiny(broth);
    stallGrp.add(broth);

    // Glass front counter cabinet with stacked miniature ceramic rooster bowls (公雞碗)
    const noodleGlass = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.88), clearGlassMat);
    noodleGlass.position.set(stallX + 0.08, Y0 + 1.22, stallZ + 0.44);
    markTiny(noodleGlass);
    stallGrp.add(noodleGlass);

    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xf4eee0, roughness: 0.28 });
    const bowlStripeMat = new THREE.MeshStandardMaterial({ color: 0xc23830, roughness: 0.4 });
    for (let st = 0; st < 2; st++) {
      for (let b = 0; b < 4; b++) {
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.048, 0.055, 10), b % 2 === 0 ? bowlMat : bowlStripeMat);
        bowl.position.set(stallX + 0.06, Y0 + 0.98 + b * 0.048, stallZ + 0.22 + st * 0.26);
        markTiny(bowl);
        stallGrp.add(bowl);
      }
    }

    // Overhead brushed stainless-steel exhaust steam hood (抽油煙罩)
    const hoodSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.34, 1.88), stainlessMat);
    hoodSkirt.position.set(stallX + 0.02, Y0 + 2.08, stallZ);
    stallGrp.add(hoodSkirt);
    const hoodFlue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 1.15), stainlessMat);
    hoodFlue.position.set(stallX - 0.06, Y0 + 2.38, stallZ);
    markTiny(hoodFlue);
    stallGrp.add(hoodFlue);

    // 3 Tiny red noodle-stall stools lined neatly outside counter (clear of Dai Pai Dong table!)
    const noodleStoolMat = new THREE.MeshStandardMaterial({ color: 0xb03a32, roughness: 0.52 });
    for (const sz of [stallZ - 0.56, stallZ, stallZ + 0.56]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.105, 0.42, 10), noodleStoolMat);
      s.position.set(eastX + 0.18, Y0 + 0.21, sz);
      markTiny(s);
      stallGrp.add(s);
    }
    b2.add(stallGrp);

    // Slanted green corrugated noodle-shop awning with diagonal support brackets
    const b2Awning = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.06, 3.25),
      new THREE.MeshStandardMaterial({ map: greenCanopyTex, roughness: 0.68, metalness: 0.2 })
    );
    b2Awning.position.set(eastX + 0.35, Y0 + 2.48, cz);
    b2Awning.rotation.z = -0.32;
    b2Awning.castShadow = true;
    b2.add(b2Awning);

    // 3 Glowing Warm Red-Amber Shopfront Lanterns with curved iron hooks, wooden caps & red tassels
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffd084,
      emissive: new THREE.Color(0xff8a32),
      emissiveIntensity: 1.82,
      roughness: 0.34
    });
    emissiveTracks.push({ mat: lanternMat, baseIntensity: 1.82 });
    const tasselMat = new THREE.MeshStandardMaterial({ color: 0xb82c26, roughness: 0.72 });

    for (const lz of [cz - 1.2, cz, cz + 1.1]) {
      const lanGrp = new THREE.Group();
      lanGrp.position.set(eastX + 0.38, Y0 + 2.15, lz);

      // Curved wrought-iron wall bracket hook
      const hookCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.42, 0.16, 0),
        new THREE.Vector3(-0.18, 0.26, 0),
        new THREE.Vector3(0, 0.22, 0),
        new THREE.Vector3(0, 0.18, 0)
      ]);
      const hook = new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 8, 0.014, 6, false), darkSteelMat);
      lanGrp.add(hook);

      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), lanternMat);
      lan.scale.set(1, 1.32, 1);
      lanGrp.add(lan);

      // Lacquered top & bottom wooden caps + hanging crimson tassel
      const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.04, 10), woodMat);
      topCap.position.y = 0.18;
      lanGrp.add(topCap);
      const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.065, 0.04, 10), woodMat);
      botCap.position.y = -0.18;
      lanGrp.add(botCap);
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.16, 6), tasselMat);
      tassel.position.y = -0.28;
      lanGrp.add(tassel);

      markTiny(lanGrp);
      b2.add(lanGrp);
    }

    // 2. Upper Wan Chai blue-green tiled walls (y = 2.76..6.56)
    const upperH = 3.8;
    const b2Tex = createFacadeTextureSet({
      seed: 202,
      baseColor: '#4e737e',
      secondaryColor: '#37545e',
      trimColor: '#7a9aa2',
      cols: 3,
      rows: 2,
      tileStyle: 'blueTile',
      litProbability: 0.62,
      warmRatio: 0.82,
      hasIronGrilles: true,
      stainStrength: 1.05
    });
    const b2WallMat = new THREE.MeshStandardMaterial({
      map: b2Tex.map,
      emissive: new THREE.Color(0xffc980),
      emissiveMap: b2Tex.emissiveMap,
      emissiveIntensity: 0.70,
      bumpMap: b2Tex.bumpMap,
      bumpScale: 0.045,
      roughness: 0.80,
      metalness: 0.06
    });
    emissiveTracks.push({ mat: b2WallMat, baseIntensity: 0.70 });

    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(W, upperH, D), b2WallMat);
    upperBody.position.set(cx, Y0 + gfH + upperH * 0.5, cz);
    upperBody.castShadow = true;
    upperBody.receiveShadow = true;
    b2.add(upperBody);

    // 3D Window Sun-Hoods, Sills & Wrought-Iron Window Cage on B2's unobstructed north-east windows
    const b2TrimMat = new THREE.MeshStandardMaterial({ color: 0x73929a, roughness: 0.78 });
    addFacadeWindowReliefs(b2, {
      cx,
      yBot: Y0 + gfH,
      cz,
      W,
      H: upperH,
      D,
      cols: 3,
      rows: 2,
      faces: ['+X'],
      hoodMat: b2TrimMat,
      skipCells: [
        { face: '+X', col: 1, row: 0 },
        { face: '+X', col: 2, row: 0 },
        { face: '+X', col: 1, row: 1 },
        { face: '+X', col: 2, row: 1 }
      ],
      cages: [{ face: '+X', col: 0, row: 0, hasPlant: true }]
    });

    // Cast-iron exterior drainage stack on B2 north-east corner
    addDrainagePipeRun(b2, cx + W * 0.5 + 0.05, cz - D * 0.5 + 0.06, Y0 + gfH + upperH, Y0, [1, 0], false);

    // Authentic Wan Chai horizontal-ridge Chinese pitched tiled gable roof (金字瓦頂)
    const b2RoofMat = new THREE.MeshStandardMaterial({
      map: blueRoofTileTex,
      roughness: 0.70,
      metalness: 0.10
    });
    const b2RoofBaseY = Y0 + gfH + upperH;
    const b2RoofH = 1.18;
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-D * 0.5 - 0.14, 0);
    gableShape.lineTo(D * 0.5 + 0.14, 0);
    gableShape.lineTo(0, b2RoofH);
    gableShape.closePath();

    const b2GableGeom = new THREE.ExtrudeGeometry(gableShape, {
      depth: W + 0.24,
      bevelEnabled: false
    });
    b2GableGeom.rotateY(Math.PI / 2);
    b2GableGeom.translate(-(W + 0.24) * 0.5, 0, 0);

    const b2Roof = new THREE.Mesh(b2GableGeom, [b2TrimMat, b2RoofMat]);
    b2Roof.position.set(cx, b2RoofBaseY, cz);
    b2Roof.castShadow = true;
    b2Roof.receiveShadow = true;
    b2.add(b2Roof);

    // Ornate horizontal clay ridge beam + end finials along X
    const mainRidge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.34, 0.16, 0.18), clayRidgeMat);
    mainRidge.position.set(cx, b2RoofBaseY + b2RoofH + 0.05, cz);
    b2.add(mainRidge);
    for (const rx of [cx - W * 0.5 - 0.12, cx + W * 0.5 + 0.12]) {
      const finial = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.22), clayRidgeMat);
      finial.position.set(rx, b2RoofBaseY + b2RoofH + 0.10, cz);
      b2.add(finial);
    }
    // Dark-steel eaves rain gutters along north & south slopes
    for (const sz of [cz - D * 0.5 - 0.16, cz + D * 0.5 + 0.16]) {
      const gutter = new THREE.Mesh(new THREE.BoxGeometry(W + 0.30, 0.08, 0.10), darkSteelMat);
      gutter.position.set(cx, b2RoofBaseY - 0.02, sz);
      markTiny(gutter);
      b2.add(gutter);
    }

    // 3. Upgraded Authentic Hong Kong BAMBOO SCAFFOLDING (竹棚) with X-braces, Instanced nylon knots & planks!
    const scaffGroup = new THREE.Group();
    const scaffY0 = Y0 + 2.85;
    const scaffH = 4.1;
    const scaffEastX = eastX + 0.26;
    const scaffSouthZ = southZ + 0.24;
    const eastPoleZs = [cz - 0.35, cz + 0.40, cz + 1.15, scaffSouthZ - 0.03];
    const southPoleXs = [scaffEastX, scaffEastX - 0.90, scaffEastX - 1.80, scaffEastX - 2.70];
    const eMidZ = (eastPoleZs[0] + eastPoleZs[eastPoleZs.length - 1]) * 0.5;
    const sMidX = (southPoleXs[0] + southPoleXs[southPoleXs.length - 1]) * 0.5;
    const ledgerYs: number[] = [];
    for (let lv = 0; lv < 5; lv++) {
      ledgerYs.push(scaffY0 + 0.35 + lv * 0.88);
    }

    // Vertical bamboo standards
    for (const pz of eastPoleZs) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, scaffH, 6), bambooMat);
      pole.position.set(scaffEastX, scaffY0 + scaffH * 0.5, pz);
      scaffGroup.add(pole);
    }
    for (const px of southPoleXs) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, scaffH, 6), bambooMat);
      pole.position.set(px, scaffY0 + scaffH * 0.5, scaffSouthZ);
      scaffGroup.add(pole);
    }

    // Horizontal bamboo ledgers + short wall tie-back putlogs
    for (const ly of ledgerYs) {
      const eBar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.48, 6), bambooMat);
      eBar.rotation.x = Math.PI / 2;
      eBar.position.set(scaffEastX, ly, eMidZ);
      scaffGroup.add(eBar);

      const sBar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.84, 6), bambooMat);
      sBar.rotation.z = Math.PI / 2;
      sBar.position.set(sMidX, ly, scaffSouthZ);
      scaffGroup.add(sBar);

      // Putlogs tying bamboo lattice back to B2 facade
      for (const pz of [eastPoleZs[0], eastPoleZs[2]]) {
        const put = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 6), bambooMat);
        put.rotation.z = Math.PI / 2;
        put.position.set(scaffEastX - 0.16, ly, pz);
        markTiny(put);
        scaffGroup.add(put);
      }
    }

    // Criss-cross X diagonal bamboo cross-braces on BOTH east (+X) and south (+Z) faces!
    for (const ang of [0.54, -0.54]) {
      const eDiag = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 4.45, 6), bambooMat);
      eDiag.rotation.x = ang;
      eDiag.position.set(scaffEastX + 0.04, scaffY0 + scaffH * 0.5, eMidZ);
      scaffGroup.add(eDiag);

      const sDiag = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 4.65, 6), bambooMat);
      sDiag.rotation.z = ang * 1.1;
      sDiag.position.set(sMidX, scaffY0 + scaffH * 0.5, scaffSouthZ + 0.04);
      scaffGroup.add(sDiag);
    }

    // InstancedMesh dark black nylon tie-knots (尼龍篾) at EVERY pole intersection!
    const knotCoords: Array<[number, number, number]> = [];
    for (const ly of ledgerYs) {
      for (const pz of eastPoleZs) knotCoords.push([scaffEastX, ly, pz]);
      for (const px of southPoleXs) {
        if (Math.abs(px - scaffEastX) > 0.05) knotCoords.push([px, ly, scaffSouthZ]);
      }
    }
    const knotGeom = new THREE.BoxGeometry(0.085, 0.085, 0.085);
    const knotInst = new THREE.InstancedMesh(knotGeom, nylonKnotMat, knotCoords.length);
    const dummy = new THREE.Object3D();
    knotCoords.forEach(([kx, ky, kz], idx) => {
      dummy.position.set(kx, ky, kz);
      dummy.rotation.set(0.35, 0.55, 0.25);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      knotInst.setMatrixAt(idx, dummy.matrix);
    });
    knotInst.instanceMatrix.needsUpdate = true;
    markTiny(knotInst);
    scaffGroup.add(knotInst);

    // Bamboo/Timber Work Platform Planks (踏板) on 2 working levels
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x9b7a4f, roughness: 0.86 });
    for (const lvIdx of [1, 3]) {
      const py = ledgerYs[lvIdx] + 0.04;
      const ePlank = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 2.30), plankMat);
      ePlank.position.set(scaffEastX - 0.12, py, eMidZ);
      markTiny(ePlank);
      scaffGroup.add(ePlank);

      const sPlank = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.045, 0.24), plankMat);
      sPlank.position.set(sMidX, py, scaffSouthZ - 0.10);
      markTiny(sPlank);
      scaffGroup.add(sPlank);
    }

    // Refined woven emerald-green HK safety netting (棚網) inside bamboo lattice
    const netMat = new THREE.MeshStandardMaterial({
      map: safetyNetTex,
      color: 0x4cc492,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.9,
      depthWrite: false
    });
    const eastNet = new THREE.Mesh(new THREE.PlaneGeometry(2.30, 3.65), netMat);
    eastNet.rotation.y = Math.PI / 2;
    eastNet.position.set(scaffEastX - 0.04, scaffY0 + 2.02, eMidZ);
    markTiny(eastNet);
    scaffGroup.add(eastNet);

    const southNet = new THREE.Mesh(new THREE.PlaneGeometry(2.68, 3.65), netMat);
    southNet.position.set(sMidX, scaffY0 + 2.02, scaffSouthZ - 0.04);
    markTiny(southNet);
    scaffGroup.add(southNet);

    b2.add(scaffGroup);

    // Projecting warm amber neon sign: 明記雲吞麵 (1.02 × 0.52, AR 1.962 -> 512 × 260)
    const noodleSignTex = createNeonSignTexture({
      text: '明記雲吞麵',
      subText: 'MING KEE NOODLES',
      bgColor: '#2d1c16',
      borderColor: '#ffad4c',
      textColor: '#fff1cc',
      glowColor: '#ff7e28',
      width: 512,
      height: 260
    });
    addProjectingNeon(b2, noodleSignTex, {
      x: eastX + 0.64,
      y: Y0 + 3.28,
      z: cz - 0.80,
      width: 1.02,
      height: 0.52,
      rotY: 0,
      bracketDir: [-1, 0],
      bracketLen: 0.16,
      emissiveHex: 0xff8c34,
      baseIntensity: 1.5,
      flickerPhase: 4.5
    });

    addBoxAC(b2, eastX + 0.18, Y0 + 4.9, cz - 1.1, Math.PI / 2);

    group.add(b2);
  }

  // =========================================================================
  // B3: Back-Left Tall Kowloon Tenement (香港大廈 + Fire Escape + 天台屋)
  // Footprint: x in [-11.4, -5.8], z in [-14.1, -8.7], height = 13.6
  // =========================================================================
  {
    const b3 = new THREE.Group();
    b3.name = 'B3_TallKowloonTenement';
    const cx = -8.6;
    const cz = -11.4;
    const W = 5.6;
    const D = 5.4;
    const H = 12.0;
    const eastX = cx + W * 0.5;
    const southZ = cz + D * 0.5;
    addContactShadow(cx, cz, W, D, 0.72);

    const b3Tex = createFacadeTextureSet({
      seed: 303,
      baseColor: '#6d8399',
      secondaryColor: '#506478',
      trimColor: '#8ea4b8',
      cols: 3,
      rows: 4,
      tileStyle: 'concrete',
      litProbability: 0.58,
      warmRatio: 0.76,
      hasIronGrilles: false,
      stainStrength: 1.12
    });
    const b3WallMat = new THREE.MeshStandardMaterial({
      map: b3Tex.map,
      emissive: new THREE.Color(0xffce84),
      emissiveMap: b3Tex.emissiveMap,
      emissiveIntensity: 0.78,
      bumpMap: b3Tex.bumpMap,
      bumpScale: 0.05,
      roughness: 0.84,
      metalness: 0.05
    });
    emissiveTracks.push({ mat: b3WallMat, baseIntensity: 0.78 });

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(W, H, D),
      [b3WallMat, b3WallMat, roofFlatMat, roofFlatMat, b3WallMat, b3WallMat]
    );
    tower.position.set(cx, Y0 + H * 0.5, cz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    b3.add(tower);

    // Concrete horizontal sun-hood ledges (遮陽板) wrapping facade
    for (let fl = 1; fl <= 3; fl++) {
      const fy = Y0 + fl * 3.0;
      const hood = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.14, D + 0.24), coolConcreteMat);
      hood.position.set(cx, fy, cz);
      b3.add(hood);
    }

    // Angled concrete corner pilasters
    for (const [px, pz] of [
      [cx + W * 0.5, cz + D * 0.5],
      [cx - W * 0.5, cz + D * 0.5],
      [cx + W * 0.5, cz - D * 0.5]
    ]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.22, H, 0.22), coolConcreteMat);
      pil.position.set(px, Y0 + H * 0.5, pz);
      pil.rotation.y = Math.PI * 0.25;
      b3.add(pil);
    }

    // 3D Window Sun-Hoods, Sills, Wrought-Iron Cages & Bamboo Laundry Pole on B3
    addFacadeWindowReliefs(b3, {
      cx,
      yBot: Y0,
      cz,
      W,
      H,
      D,
      cols: 3,
      rows: 4,
      faces: ['+X', '+Z'],
      hoodMat: coolConcreteMat,
      // Skip +Z col 0 behind the steel fire escape so zero collision!
      skipCells: [
        { face: '+Z', col: 0, row: 0 },
        { face: '+Z', col: 0, row: 1 },
        { face: '+Z', col: 0, row: 2 },
        { face: '+Z', col: 0, row: 3 }
      ],
      cages: [
        { face: '+X', col: 1, row: 1, hasPlant: false },
        { face: '+Z', col: 2, row: 0, hasPlant: true }
      ],
      laundryPoles: [{ face: '+X', col: 2, row: 0, phase: 2.4 }]
    });

    // Full-height cast-iron drainage & vent stacks down B3 corners
    addDrainagePipeRun(b3, cx + W * 0.5 + 0.06, cz + D * 0.5 - 0.14, Y0 + H, Y0, [1, 0], true);
    addDrainagePipeRun(b3, cx - W * 0.5 - 0.06, cz + D * 0.5 - 0.12, Y0 + H, Y0, [-1, 0], false);

    // Rooftop parapet, stair penthouse, illegal corrugated tin penthouse (天台鐵皮屋),
    // raised water tank, curved satellite dish (衛星天線), fishbone TV aerial & red beacon!
    const roofY = Y0 + H;
    const pThick = 0.24;
    const pH = 0.58;
    const parapetSpecs: Array<[number, number, number, number]> = [
      [cx, cz + D * 0.5 - pThick * 0.5, W, pThick],
      [cx, cz - D * 0.5 + pThick * 0.5, W, pThick],
      [cx + W * 0.5 - pThick * 0.5, cz, pThick, D],
      [cx - W * 0.5 + pThick * 0.5, cz, pThick, D]
    ];
    for (const [px, pz, pw, pd] of parapetSpecs) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(pw, pH, pd), coolConcreteMat);
      p.position.set(px, roofY + pH * 0.5, pz);
      p.castShadow = true;
      b3.add(p);
    }

    // Concrete Stair Penthouse (樓梯房) with steel fire door & glowing stairwell transom
    const stairHouse = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.68, 1.9), coolConcreteMat);
    stairHouse.position.set(cx - 1.0, roofY + 0.84, cz - 1.0);
    stairHouse.castShadow = true;
    b3.add(stairHouse);

    const stairDoor = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.18, 0.06), darkSteelMat);
    stairDoor.position.set(cx - 1.0, roofY + 0.62, cz - 0.03);
    markTiny(stairDoor);
    b3.add(stairDoor);

    // Rooftop Corrugated Tin Illegal Penthouse (天台鐵皮屋) with sloped roof & glowing tiny window!
    const tinHutMat = new THREE.MeshStandardMaterial({
      map: tinPenthouseTex,
      roughness: 0.68,
      metalness: 0.34
    });
    const hutX = cx + 0.95;
    const hutZ = cz + 1.02;
    const hutBody = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.32, 1.82), tinHutMat);
    hutBody.position.set(hutX, roofY + 0.66, hutZ);
    hutBody.castShadow = true;
    b3.add(hutBody);

    const hutRoof = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.08, 2.15),
      new THREE.MeshStandardMaterial({ map: tinRoofTex, roughness: 0.62, metalness: 0.38 })
    );
    hutRoof.position.set(hutX, roofY + 1.38, hutZ);
    hutRoof.rotation.x = 0.10;
    hutRoof.castShadow = true;
    b3.add(hutRoof);

    // Warm glowing curtained window on rooftop tin hut
    const hutWinMat = new THREE.MeshStandardMaterial({
      color: 0xffd88c,
      emissive: new THREE.Color(0xffa43c),
      emissiveIntensity: 1.35,
      roughness: 0.35
    });
    emissiveTracks.push({ mat: hutWinMat, baseIntensity: 1.35 });
    const hutWinZ = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.06), hutWinMat);
    hutWinZ.position.set(hutX - 0.15, roofY + 0.78, hutZ + 0.92);
    b3.add(hutWinZ);
    const hutWinX = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.52), hutWinMat);
    hutWinX.position.set(hutX + 1.03, roofY + 0.78, hutZ);
    b3.add(hutWinX);

    // Raised Galvanized Steel Water Tank on 4 Concrete Pier Legs + feeder pipes!
    const tankBaseX = cx + 1.25;
    const tankBaseZ = cz - 1.18;
    for (const [lx, lz] of [
      [-0.52, -0.44],
      [0.52, -0.44],
      [-0.52, 0.44],
      [0.52, 0.44]
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), coolConcreteMat);
      leg.position.set(tankBaseX + lx, roofY + 0.29, tankBaseZ + lz);
      leg.castShadow = true;
      b3.add(leg);
    }
    const roofTank = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.02, 1.22), tankSteelMat);
    roofTank.position.set(tankBaseX, roofY + 0.58 + 0.51, tankBaseZ);
    roofTank.castShadow = true;
    b3.add(roofTank);
    const tankPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 8), castIronPipeMat);
    tankPipe.position.set(tankBaseX - 0.25, roofY + 0.31, tankBaseZ + 0.22);
    markTiny(tankPipe);
    b3.add(tankPipe);

    // Curved Satellite Dish (衛星天線) on south-west roof corner
    const dishGrp = new THREE.Group();
    dishGrp.position.set(cx - 1.85, roofY + 0.42, cz + 1.75);
    const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.85, 8), darkSteelMat);
    dishMast.position.y = 0.25;
    dishGrp.add(dishMast);
    const dishHead = new THREE.Group();
    dishHead.position.y = 0.72;
    dishHead.rotation.set(-0.58, 0.75, 0);
    const dishBowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.34),
      new THREE.MeshStandardMaterial({ color: 0xcfd9e2, roughness: 0.48, metalness: 0.24, side: THREE.DoubleSide })
    );
    dishBowl.rotation.x = Math.PI;
    dishHead.add(dishBowl);
    const lnbArm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 6), darkSteelMat);
    lnbArm.rotation.x = Math.PI / 2;
    lnbArm.position.set(0, -0.04, 0.16);
    dishHead.add(lnbArm);
    const lnbTip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.07, 8), darkSteelMat);
    lnbTip.rotation.x = Math.PI / 2;
    lnbTip.position.set(0, -0.04, 0.36);
    dishHead.add(lnbTip);
    dishGrp.add(dishHead);
    markTiny(dishGrp);
    b3.add(dishGrp);

    // Expanded Hong Kong Fishbone Yagi TV Aerial (魚骨天線)
    const aerialGrp = new THREE.Group();
    const mastX = cx - 1.45;
    const mastZ = cz - 1.30;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 2.35, 6), darkSteelMat);
    mast.position.set(mastX, roofY + 2.65, mastZ);
    aerialGrp.add(mast);

    // Upper & lower Yagi horizontal booms with 5 progressively-sized fishbone director elements
    for (const [boomY, rotBoom] of [
      [roofY + 3.15, 0.45],
      [roofY + 3.62, -0.35]
    ]) {
      const boom = new THREE.Group();
      boom.position.set(mastX, boomY, mastZ);
      boom.rotation.y = rotBoom;
      const spine = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.024, 0.024), darkSteelMat);
      boom.add(spine);
      const elemLens = [0.92, 0.78, 0.66, 0.56, 0.46];
      elemLens.forEach((elen, ei) => {
        const el = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, elen), brushedAluminumMat);
        el.position.x = -0.52 + ei * 0.26;
        boom.add(el);
      });
      aerialGrp.add(boom);
    }
    markTiny(aerialGrp);
    b3.add(aerialGrp);

    // Tiny Blinking Red Aviation Rooftop Beacon Light on highest stair-house corner
    const beaconPole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.62, 6), darkSteelMat);
    beaconPole.position.set(cx - 0.14, roofY + 1.98, cz - 0.22);
    markTiny(beaconPole);
    b3.add(beaconPole);

    beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff4048,
      emissive: new THREE.Color(0xff2230),
      emissiveIntensity: 2.6,
      roughness: 0.2
    });
    const beaconBulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), beaconMat);
    beaconBulb.position.set(cx - 0.14, roofY + 2.32, cz - 0.22);
    markTiny(beaconBulb);
    b3.add(beaconBulb);

    // Upgraded External Dark-Steel Fire-Escape Staircase with Instanced individual stair steps,
    // double mid-railings & vertical caged roof-access ladder!
    const feGroup = new THREE.Group();
    const feZ = cz + D * 0.5 + 0.34;
    const feXLeft = cx - 2.2;
    const feXRight = cx - 0.5;
    const feMidX = (feXLeft + feXRight) * 0.5;
    const feSpanX = feXRight - feXLeft;
    const lvBaseY = Y0 + 1.9;
    const lvStepY = 2.55;

    // InstancedMesh for individual grated stair steps (10 steps × 3 flights = 30 steps)
    const stepsPerFlight = 10;
    const stairStepGeom = new THREE.BoxGeometry(0.24, 0.036, 0.40);
    const stairStepInst = new THREE.InstancedMesh(stairStepGeom, darkSteelMat, stepsPerFlight * 3);
    const stepDummy = new THREE.Object3D();
    let stepIdx = 0;

    for (let lv = 0; lv < 4; lv++) {
      const ly = lvBaseY + lv * lvStepY;
      // Grated steel landing platform + kick plate
      const plat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.68), darkSteelMat);
      plat.position.set(feMidX, ly, feZ);
      plat.castShadow = true;
      feGroup.add(plat);

      // Top rail + mid rail along landing front & side returns
      for (const ry of [0.36, 0.72]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.036, 0.036), darkSteelMat);
        rail.position.set(feMidX, ly + ry, feZ + 0.32);
        feGroup.add(rail);
        for (const sx of [feXLeft - 0.08, feXRight + 0.08]) {
          const sRail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.66), darkSteelMat);
          sRail.position.set(sx, ly + ry, feZ);
          markTiny(sRail);
          feGroup.add(sRail);
        }
      }

      // Vertical guardrail stanchions
      for (const ux of [feXLeft - 0.08, feMidX - 0.44, feMidX + 0.44, feXRight + 0.08]) {
        const up = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.74, 0.04), darkSteelMat);
        up.position.set(ux, ly + 0.37, feZ + 0.32);
        markTiny(up);
        feGroup.add(up);
      }

      // Flights between landings: side steel stringer beams + sloped handrails + individual instanced steps!
      if (lv < 3) {
        const goRight = lv % 2 === 0;
        const x0 = goRight ? feXLeft + 0.16 : feXRight - 0.16;
        const x1 = goRight ? feXRight - 0.16 : feXLeft + 0.16;
        const y0 = ly + 0.05;
        const y1 = ly + lvStepY - 0.05;
        const dxRun = x1 - x0;
        const dyRun = y1 - y0;
        const runLen = Math.hypot(dxRun, dyRun);
        const angleZ = Math.atan2(dyRun, dxRun);

        // Twin side stringers & sloped handrails
        for (const zOff of [-0.20, 0.20]) {
          const stringer = new THREE.Mesh(new THREE.BoxGeometry(runLen, 0.11, 0.036), darkSteelMat);
          stringer.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, feZ + zOff);
          stringer.rotation.z = angleZ;
          stringer.castShadow = true;
          feGroup.add(stringer);
        }
        const stairRail = new THREE.Mesh(new THREE.BoxGeometry(runLen, 0.032, 0.032), darkSteelMat);
        stairRail.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5 + 0.62, feZ + 0.22);
        stairRail.rotation.z = angleZ;
        markTiny(stairRail);
        feGroup.add(stairRail);

        // Individual horizontal grated stair treads!
        for (let s = 0; s < stepsPerFlight; s++) {
          const t = (s + 0.5) / stepsPerFlight;
          stepDummy.position.set(x0 + dxRun * t, y0 + dyRun * t, feZ);
          stepDummy.rotation.set(0, 0, 0);
          stepDummy.scale.set(1, 1, 1);
          stepDummy.updateMatrix();
          stairStepInst.setMatrixAt(stepIdx++, stepDummy.matrix);
        }
      }
    }
    stairStepInst.instanceMatrix.needsUpdate = true;
    markTiny(stairStepInst);
    feGroup.add(stairStepInst);

    // Main outer corner columns supporting the fire escape
    for (const fx of [feXLeft - 0.08, feXRight + 0.08]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.06, 10.2, 0.06), darkSteelMat);
      col.position.set(fx, Y0 + 5.1, feZ + 0.32);
      feGroup.add(col);
    }

    // Vertical Caged Steel Roof-Access Ladder (屋頂爬梯) from top landing over roof parapet!
    const ladderGrp = new THREE.Group();
    const ladX = feXLeft + 0.24;
    const ladZ = feZ + 0.24;
    const ladY0 = lvBaseY + 3 * lvStepY;
    const ladY1 = roofY + pH + 0.42;
    const ladH = ladY1 - ladY0;
    for (const lxOff of [-0.18, 0.18]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, ladH, 6), darkSteelMat);
      rail.position.set(ladX + lxOff, ladY0 + ladH * 0.5, ladZ);
      ladderGrp.add(rail);
    }
    const rungCount = 11;
    for (let r = 0; r < rungCount; r++) {
      const ry = ladY0 + 0.22 + (r / (rungCount - 1)) * (ladH - 0.38);
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 6), darkSteelMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(ladX, ry, ladZ);
      ladderGrp.add(rung);
    }
    // Protective semicircular steel safety cage hoops
    for (let hIdx = 0; hIdx < 4; hIdx++) {
      const hy = ladY0 + 0.85 + hIdx * 0.65;
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.016, 6, 12, Math.PI), darkSteelMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(ladX, hy, ladZ + 0.04);
      ladderGrp.add(hoop);
    }
    markTiny(ladderGrp);
    feGroup.add(ladderGrp);

    void feSpanX;
    b3.add(feGroup);

    // Vertical glowing icy-blue neon sign: 香港大廈 (0.72 × 2.25, AR 0.320 -> 192 × 600)
    const b3NeonTex = createNeonSignTexture({
      text: '香港大廈',
      subText: 'HK MANSION',
      vertical: true,
      bgColor: '#14263b',
      borderColor: '#7be4ff',
      textColor: '#e4faff',
      glowColor: '#48c8ff',
      width: 192,
      height: 600
    });
    addProjectingNeon(b3, b3NeonTex, {
      x: eastX + 0.54,
      y: Y0 + 8.0,
      z: cz + 1.7,
      width: 0.72,
      height: 2.25,
      rotY: 0,
      bracketDir: [-1, 0],
      bracketLen: 0.20,
      emissiveHex: 0x62dcff,
      baseIntensity: 1.45,
      flickerPhase: 2.1
    });

    // Classic Projecting Ornate Kowloon Neon Sign (海鮮酒家) high on B3's east face (clear above viaduct!)
    const seafoodNeonTex = createArchedNeonSignTexture({
      mainText: '海鮮酒家',
      subText: 'DRAGON SEAFOOD PALACE',
      style: 'seafood'
    });
    addProjectingNeon(b3, seafoodNeonTex, {
      x: eastX + 0.94,
      y: Y0 + 10.15,
      z: cz - 0.8,
      width: 1.44,
      height: 0.66,
      rotY: 0,
      bracketDir: [-1, 0],
      bracketLen: 0.24,
      emissiveHex: 0xff6a3c,
      baseIntensity: 1.52,
      flickerPhase: 0.4
    });

    // Warm-lit ground-floor Kowloon residential stairwell lobby (香港大廈大堂) with dark-bronze mullioned double doors
    const b3LobbyMat = new THREE.MeshStandardMaterial({
      color: 0xe8bc7a,
      emissive: new THREE.Color(0xe8943a),
      emissiveIntensity: 0.62,
      roughness: 0.48
    });
    emissiveTracks.push({ mat: b3LobbyMat, baseIntensity: 0.62 });
    const lobbyX = cx + 1.25;
    const lobbyGlass = new THREE.Mesh(new THREE.BoxGeometry(1.18, 2.02, 0.06), b3LobbyMat);
    lobbyGlass.position.set(lobbyX, Y0 + 1.04, southZ + 0.01);
    b3.add(lobbyGlass);
    // Mullioned bronze/steel lobby doorway framing + double-door divider + transom + kick plate
    for (const dx of [-0.60, 0, 0.60]) {
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.08, 0.11), darkSteelMat);
      mull.position.set(lobbyX + dx, Y0 + 1.04, southZ + 0.03);
      markTiny(mull);
      b3.add(mull);
    }
    for (const [my, mh] of [
      [0.24, 0.44],
      [1.62, 0.06],
      [2.06, 0.08]
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.26, mh, 0.11), darkSteelMat);
      bar.position.set(lobbyX, Y0 + my, southZ + 0.03);
      markTiny(bar);
      b3.add(bar);
    }
    const lobbyCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.14, 0.66), coolConcreteMat);
    lobbyCanopy.position.set(lobbyX, Y0 + 2.20, southZ + 0.30);
    lobbyCanopy.castShadow = true;
    b3.add(lobbyCanopy);

    addBoxAC(b3, eastX + 0.18, Y0 + 5.8, cz - 1.1, Math.PI / 2);
    addBoxAC(b3, eastX + 0.18, Y0 + 8.6, cz - 0.6, Math.PI / 2);
    addBoxAC(b3, cx + 1.6, Y0 + 8.7, southZ + 0.18, 0);

    group.add(b3);
  }

  // =========================================================================
  // B6: Back-West Companion Ochre Tenement (永安樓 — stepped companion beside B3!)
  // Footprint: x in [-16.6, -11.9], z in [-12.2, -7.2], height = 8.6m
  // Turns B3 from an isolated pillar into a cohesive layered Kowloon urban block!
  // =========================================================================
  {
    const b6 = new THREE.Group();
    b6.name = 'B6_BackWestTongLau';
    const cx = -14.25;
    const cz = -9.7;
    const W = 4.7;
    const D = 5.0;
    const H = 8.6;
    const eastX = cx + W * 0.5;
    const southZ = cz + D * 0.5;
    addContactShadow(cx, cz, W, D, 0.64);

    const b6Tex = createFacadeTextureSet({
      seed: 606,
      baseColor: '#8d7b6b',
      secondaryColor: '#69594d',
      trimColor: '#afa092',
      cols: 2,
      rows: 3,
      tileStyle: 'plaster',
      litProbability: 0.60,
      warmRatio: 0.80,
      hasIronGrilles: true,
      stainStrength: 1.08
    });
    const b6WallMat = new THREE.MeshStandardMaterial({
      map: b6Tex.map,
      emissive: new THREE.Color(0xffc97c),
      emissiveMap: b6Tex.emissiveMap,
      emissiveIntensity: 0.72,
      bumpMap: b6Tex.bumpMap,
      bumpScale: 0.045,
      roughness: 0.84,
      metalness: 0.04
    });
    emissiveTracks.push({ mat: b6WallMat, baseIntensity: 0.72 });

    const b6TrimMat = new THREE.MeshStandardMaterial({ color: 0xa49486, roughness: 0.80 });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(W, H, D),
      [b6WallMat, b6WallMat, roofFlatMat, roofFlatMat, b6WallMat, b6WallMat]
    );
    body.position.set(cx, Y0 + H * 0.5, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    b6.add(body);

    // Horizontal concrete sun-hood stringcourses
    for (let fl = 1; fl <= 2; fl++) {
      const fy = Y0 + fl * (H / 3);
      const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, 0.14, D + 0.22), b6TrimMat);
      band.position.set(cx, fy, cz);
      b6.add(band);
    }

    // 3D Window Sun-Hoods, Sills & Wrought-Iron Window Cage on B6
    addFacadeWindowReliefs(b6, {
      cx,
      yBot: Y0,
      cz,
      W,
      H,
      D,
      cols: 2,
      rows: 3,
      faces: ['+Z', '+X'],
      hoodMat: b6TrimMat,
      cages: [{ face: '+Z', col: 1, row: 0, hasPlant: true }]
    });

    // Rooftop parapet, tin penthouse & water tank on B6
    const roofY = Y0 + H;
    for (const [px, pz, pw, pd] of [
      [cx, cz + D * 0.5 - 0.12, W, 0.24],
      [cx, cz - D * 0.5 + 0.12, W, 0.24],
      [cx + W * 0.5 - 0.12, cz, 0.24, D],
      [cx - W * 0.5 + 0.12, cz, 0.24, D]
    ] as Array<[number, number, number, number]>) {
      const pm = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.56, pd), b6TrimMat);
      pm.position.set(px, roofY + 0.28, pz);
      pm.castShadow = true;
      b6.add(pm);
    }

    const b6Hut = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.25, 1.9),
      new THREE.MeshStandardMaterial({ map: tinPenthouseTex, roughness: 0.70, metalness: 0.30 })
    );
    b6Hut.position.set(cx - 0.65, roofY + 0.625, cz - 0.85);
    b6Hut.castShadow = true;
    b6.add(b6Hut);

    const b6Tank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.86, 12), tankSteelMat);
    b6Tank.position.set(cx + 1.15, roofY + 0.56, cz - 1.05);
    b6Tank.castShadow = true;
    b6.add(b6Tank);

    // Classic projecting Kowloon emerald-rose vertical neon sign: 賓館 HOSTEL peeking cleanly above viaduct!
    const hostelTex = createNeonSignTexture({
      text: '賓館',
      subText: 'HOSTEL',
      vertical: true,
      bgColor: '#2a1624',
      borderColor: '#ff8a9e',
      textColor: '#fff0f2',
      glowColor: '#ff5276',
      width: 196,
      height: 512
    });
    addProjectingNeon(b6, hostelTex, {
      x: cx + 1.05,
      y: Y0 + 7.95,
      z: southZ + 0.54,
      width: 0.68,
      height: 1.78,
      rotY: Math.PI / 2,
      bracketDir: [0, -1],
      bracketLen: 0.20,
      emissiveHex: 0xff6284,
      baseIntensity: 1.44,
      flickerPhase: 1.9
    });

    addBoxAC(b6, cx - 0.95, Y0 + 7.0, southZ + 0.18, 0);
    addBoxAC(b6, eastX + 0.18, Y0 + 7.1, cz + 0.9, Math.PI / 2);

    group.add(b6);
  }

  // =========================================================================
  // B4: Far-Right Jade-Green Mosaic Shophouse behind Viaduct (紙皮石唐樓 + 3D 便利店 24H!)
  // Footprint: x in [+12.4, +18.4], z in [-12.4, -6.8], cleanly north of viaduct!
  // Elevated to 3 upper storeys (upperH = 7.5) so roofline & neon signs crown proudly above viaduct!
  // =========================================================================
  {
    const b4 = new THREE.Group();
    b4.name = 'B4_JadeMosaicShophouse';
    const cx = 15.4;
    const cz = -9.6;
    const W = 6.0;
    const D = 5.6;
    const gfH = 2.8;
    const upperH = 7.5;
    addContactShadow(cx, cz, W, D, 0.66);

    // -----------------------------------------------------------------------
    // 1. REAL 3D RECESSED 24H CONVENIENCE STORE INTERIOR (便利店 24H)
    // Open wrap-around 3D recessed interior behind +Z south & -X street glass mullions!
    // -----------------------------------------------------------------------
    const martBackChillerTex = createShopInteriorTexture('mart', 1076, 512);
    const martBackChillerMat = new THREE.MeshStandardMaterial({
      map: martBackChillerTex,
      emissive: new THREE.Color(0x88f2ff),
      emissiveMap: martBackChillerTex,
      emissiveIntensity: 1.12,
      roughness: 0.32
    });
    emissiveTracks.push({ mat: martBackChillerMat, baseIntensity: 1.12 });

    const martEastChillerTex = createShopInteriorTexture('mart', 1002, 512);
    const martEastChillerMat = new THREE.MeshStandardMaterial({
      map: martEastChillerTex,
      emissive: new THREE.Color(0x88f2ff),
      emissiveMap: martEastChillerTex,
      emissiveIntensity: 1.12,
      roughness: 0.32
    });
    emissiveTracks.push({ mat: martEastChillerMat, baseIntensity: 1.12 });

    const jadeBaseMat = new THREE.MeshStandardMaterial({ color: 0x426863, roughness: 0.78 });
    const martFloorMat = new THREE.MeshStandardMaterial({
      color: 0xc2e4ec,
      emissive: new THREE.Color(0x5ac8e2),
      emissiveIntensity: 0.26,
      roughness: 0.28,
      metalness: 0.08
    });
    emissiveTracks.push({ mat: martFloorMat, baseIntensity: 0.26 });

    const martCeilMat = new THREE.MeshStandardMaterial({
      color: 0xe6fbff,
      emissive: new THREE.Color(0x9ceeff),
      emissiveIntensity: 0.92,
      roughness: 0.5
    });
    emissiveTracks.push({ mat: martCeilMat, baseIntensity: 0.92 });

    const fluoTubeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0xc2f8ff),
      emissiveIntensity: 2.35,
      roughness: 0.15
    });
    emissiveTracks.push({ mat: fluoTubeMat, baseIntensity: 2.35 });

    // Solid Structural Back (-Z) and East (+X) walls with glowing interior beverage chillers!
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.12, gfH, 0.42),
      [jadeBaseMat, jadeBaseMat, jadeBaseMat, jadeBaseMat, martBackChillerMat, jadeBaseMat]
    );
    backWall.position.set(cx, Y0 + gfH * 0.5, cz - D * 0.5 + 0.22);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    b4.add(backWall);

    const eastWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, gfH, D - 0.12),
      [jadeBaseMat, martEastChillerMat, jadeBaseMat, jadeBaseMat, jadeBaseMat, jadeBaseMat]
    );
    eastWall.position.set(cx + W * 0.5 - 0.22, Y0 + gfH * 0.5, cz);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    b4.add(eastWall);

    // Exterior utility louver grille on B4's east ground-floor wall
    const b4EastVent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 1.35), louvreMat);
    b4EastVent.position.set(cx + W * 0.5 + 0.01, Y0 + 1.45, cz - 0.85);
    markTiny(b4EastVent);
    b4.add(b4EastVent);

    // Structural jade-tile corner piers framing the recessed open corner
    for (const [px, pz] of [
      [cx - W * 0.5 + 0.22, cz - D * 0.5 + 0.22],
      [cx - W * 0.5 + 0.22, cz + D * 0.5 - 0.22],
      [cx + W * 0.5 - 0.22, cz + D * 0.5 - 0.22]
    ]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.44, gfH, 0.44), jadeBaseMat);
      pier.position.set(px, Y0 + gfH * 0.5, pz);
      pier.castShadow = true;
      b4.add(pier);
    }

    // Interior Convenience Store Floor, Glowing Ceiling & 4 Illuminated 3D Fluorescent Light Tube Strips!
    const martFloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.44, 0.05, D - 0.44), martFloorMat);
    martFloor.position.set(cx, Y0 + 0.025, cz);
    martFloor.receiveShadow = true;
    b4.add(martFloor);

    const martCeil = new THREE.Mesh(new THREE.BoxGeometry(W - 0.36, 0.08, D - 0.36), martCeilMat);
    martCeil.position.set(cx, Y0 + gfH - 0.06, cz);
    b4.add(martCeil);

    for (const dz of [-1.6, -0.53, 0.53, 1.6]) {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(W - 1.6, 0.065, 0.14), fluoTubeMat);
      tube.position.set(cx - 0.15, Y0 + gfH - 0.13, cz + dz);
      markTiny(tube);
      b4.add(tube);
    }

    // 2 Multi-Tier 3D Steel Shelving Gondola Racks inside the recessed store (deep 3D parallax!)
    const rackFrameMat = new THREE.MeshStandardMaterial({
      color: 0xdcebf0,
      emissive: new THREE.Color(0x56b8d2),
      emissiveIntensity: 0.22,
      roughness: 0.45
    });
    emissiveTracks.push({ mat: rackFrameMat, baseIntensity: 0.22 });
    const priceStripMat = new THREE.MeshStandardMaterial({
      color: 0x167858,
      emissive: new THREE.Color(0x146448),
      emissiveIntensity: 0.28,
      roughness: 0.5
    });

    const shelfTierYs = [Y0 + 0.34, Y0 + 0.78, Y0 + 1.22, Y0 + 1.66];
    const gondolaSpecs = [
      { x: cx + 0.62, z: cz + 0.62, len: 2.80 },
      { x: cx + 0.62, z: cz - 0.92, len: 2.80 }
    ];

    for (const g of gondolaSpecs) {
      const gGrp = new THREE.Group();
      // Central back divider spine
      const spine = new THREE.Mesh(new THREE.BoxGeometry(g.len, 1.72, 0.06), rackFrameMat);
      spine.position.set(g.x, Y0 + 0.90, g.z);
      gGrp.add(spine);
      // Base kick plinth
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(g.len, 0.16, 0.66), darkSteelMat);
      plinth.position.set(g.x, Y0 + 0.11, g.z);
      gGrp.add(plinth);
      // 4 Double-sided shelving tiers + front/back price strips
      for (const sy of shelfTierYs) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(g.len, 0.04, 0.68), rackFrameMat);
        shelf.position.set(g.x, sy, g.z);
        gGrp.add(shelf);
        for (const zDir of [-1, 1]) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(g.len, 0.036, 0.02), priceStripMat);
          strip.position.set(g.x, sy - 0.005, g.z + zDir * 0.345);
          gGrp.add(strip);
        }
      }
      // End-cap display headers
      for (const ex of [g.x - g.len * 0.5, g.x + g.len * 0.5]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.72, 0.68), rackFrameMat);
        cap.position.set(ex, Y0 + 0.90, g.z);
        gGrp.add(cap);
      }
      markTiny(gGrp);
      b4.add(gGrp);
    }

    // Front-Window Low Display Rack facing +Z right glass bay (clear of sliding doors!)
    const frontRackX = cx + 1.56;
    const frontRackZ = cz + D * 0.5 - 0.76;
    const frontRackLen = 1.64;
    const frontRackGrp = new THREE.Group();
    const fSpine = new THREE.Mesh(new THREE.BoxGeometry(frontRackLen, 1.18, 0.05), rackFrameMat);
    fSpine.position.set(frontRackX, Y0 + 0.62, frontRackZ - 0.14);
    frontRackGrp.add(fSpine);
    for (const sy of [Y0 + 0.32, Y0 + 0.70, Y0 + 1.06]) {
      const fs = new THREE.Mesh(new THREE.BoxGeometry(frontRackLen, 0.035, 0.34), rackFrameMat);
      fs.position.set(frontRackX, sy, frontRackZ);
      frontRackGrp.add(fs);
    }
    markTiny(frontRackGrp);
    b4.add(frontRackGrp);

    // InstancedMesh #1 & #2: ~200 Crisp Colorful Miniature Drink Bottles & Snack Packs stocked on shelves!
    const bottleTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; hex: number }> = [];
    const snackTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; hex: number }> = [];
    const drinkPalette = [0xe63c38, 0x2eb468, 0xf2b42c, 0x2c86e8, 0xf2f6fa, 0xe05294, 0x46c8b6, 0xf07a2c];
    const snackPalette = [0xf4c434, 0xdc443a, 0x3a92d8, 0x3ca866, 0xee822e, 0xe86ca4, 0xf4eee0, 0x8658c8];

    // Stock both sides of both gondolas
    gondolaSpecs.forEach((g, gIdx) => {
      shelfTierYs.forEach((sy, tIdx) => {
        const slots = 11;
        for (let i = 0; i < slots; i++) {
          const ix = g.x - g.len * 0.45 + (i / (slots - 1)) * (g.len * 0.90);
          // Front (+Z) side -> colorful drink bottles/cans
          if (tIdx <= 2 || gIdx === 0) {
            bottleTransforms.push({
              x: ix,
              y: sy + 0.115,
              z: g.z + 0.21,
              sx: 1,
              sy: (i + tIdx) % 3 === 0 ? 1.2 : 0.95,
              sz: 1,
              hex: drinkPalette[(gIdx * 5 + tIdx * 3 + i) % drinkPalette.length]
            });
          } else {
            snackTransforms.push({
              x: ix,
              y: sy + 0.12,
              z: g.z + 0.20,
              sx: 1,
              sy: 1,
              sz: 1,
              hex: snackPalette[(gIdx * 3 + tIdx * 2 + i) % snackPalette.length]
            });
          }
          // Back (-Z) side -> crisp colorful snack packs/boxes
          snackTransforms.push({
            x: ix,
            y: sy + 0.12,
            z: g.z - 0.20,
            sx: (i + tIdx) % 2 === 0 ? 1.1 : 0.85,
            sy: (i + gIdx) % 3 === 0 ? 1.15 : 0.92,
            sz: 1,
            hex: snackPalette[(gIdx * 7 + tIdx * 4 + i) % snackPalette.length]
          });
        }
      });
    });

    // Stock the front display rack visible right behind +Z glass
    [Y0 + 0.32, Y0 + 0.70, Y0 + 1.06].forEach((sy, rIdx) => {
      for (let i = 0; i < 8; i++) {
        const ix = frontRackX - frontRackLen * 0.42 + (i / 7) * (frontRackLen * 0.84);
        if (rIdx % 2 === 0) {
          bottleTransforms.push({
            x: ix,
            y: sy + 0.11,
            z: frontRackZ + 0.03,
            sx: 1.05,
            sy: 1.05,
            sz: 1.05,
            hex: drinkPalette[(rIdx * 4 + i * 2) % drinkPalette.length]
          });
        } else {
          snackTransforms.push({
            x: ix,
            y: sy + 0.115,
            z: frontRackZ + 0.03,
            sx: 1.05,
            sy: 0.95,
            sz: 1,
            hex: snackPalette[(rIdx * 3 + i) % snackPalette.length]
          });
        }
      }
    });

    const merchMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0x528898),
      emissiveIntensity: 0.26,
      roughness: 0.36
    });
    emissiveTracks.push({ mat: merchMat, baseIntensity: 0.26 });

    const bottleInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.046, 0.048, 0.19, 8),
      merchMat,
      bottleTransforms.length
    );
    const snackInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.135, 0.19, 0.11),
      merchMat,
      snackTransforms.length
    );
    const mDummy = new THREE.Object3D();
    const tmpCol = new THREE.Color();

    bottleTransforms.forEach((b, idx) => {
      mDummy.position.set(b.x, b.y, b.z);
      mDummy.rotation.set(0, 0, 0);
      mDummy.scale.set(b.sx, b.sy, b.sz);
      mDummy.updateMatrix();
      bottleInst.setMatrixAt(idx, mDummy.matrix);
      bottleInst.setColorAt(idx, tmpCol.setHex(b.hex));
    });
    bottleInst.instanceMatrix.needsUpdate = true;
    if (bottleInst.instanceColor) bottleInst.instanceColor.needsUpdate = true;
    markTiny(bottleInst);
    b4.add(bottleInst);

    snackTransforms.forEach((s, idx) => {
      mDummy.position.set(s.x, s.y, s.z);
      mDummy.rotation.set(0, 0, 0);
      mDummy.scale.set(s.sx, s.sy, s.sz);
      mDummy.updateMatrix();
      snackInst.setMatrixAt(idx, mDummy.matrix);
      snackInst.setColorAt(idx, tmpCol.setHex(s.hex));
    });
    snackInst.instanceMatrix.needsUpdate = true;
    if (snackInst.instanceColor) snackInst.instanceColor.needsUpdate = true;
    markTiny(snackInst);
    b4.add(snackInst);

    // 3D Checkout Counter (收銀處) with glowing POS terminal & warm HK fishball/siu-mai hot steamer!
    const counterX = cx - 1.82;
    const counterZ = cz + 0.12;
    const checkoutGrp = new THREE.Group();
    const coBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.94, 1.85),
      new THREE.MeshStandardMaterial({ color: 0x1a5666, roughness: 0.45 })
    );
    coBody.position.set(counterX, Y0 + 0.47, counterZ);
    checkoutGrp.add(coBody);
    const coTop = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 1.92), rackFrameMat);
    coTop.position.set(counterX, Y0 + 0.96, counterZ);
    checkoutGrp.add(coTop);

    // POS Monitor glowing crisp icy-blue
    const posScreenMat = new THREE.MeshStandardMaterial({
      color: 0xb8f2ff,
      emissive: new THREE.Color(0x48c8ff),
      emissiveIntensity: 1.4,
      roughness: 0.2
    });
    emissiveTracks.push({ mat: posScreenMat, baseIntensity: 1.4 });
    const posMonitor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.30), posScreenMat);
    posMonitor.position.set(counterX + 0.06, Y0 + 1.18, counterZ - 0.35);
    posMonitor.rotation.y = -0.3;
    checkoutGrp.add(posMonitor);

    // Warm-amber glowing HK 7-11 Hot-Food Glass Steamer Cabinet (魚蛋燒賣蒸爐!)
    const hotBoxMat = new THREE.MeshStandardMaterial({
      color: 0xffe4a4,
      emissive: new THREE.Color(0xff9a38),
      emissiveIntensity: 1.25,
      roughness: 0.28
    });
    emissiveTracks.push({ mat: hotBoxMat, baseIntensity: 1.25 });
    const hotSteamer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.56), hotBoxMat);
    hotSteamer.position.set(counterX + 0.04, Y0 + 1.21, counterZ + 0.46);
    checkoutGrp.add(hotSteamer);
    markTiny(checkoutGrp);
    b4.add(checkoutGrp);

    // 3D Aluminum Glass Mullion Storefront Frames + Automatic Sliding Doors (both +Z and -X faces!)
    const southGlassZ = cz + D * 0.5 - 0.08;
    const westGlassX = cx - W * 0.5 + 0.08;

    // South (+Z) Storefront aluminum mullions, kick plates, HK green-orange transom stripe & sliding doors
    const sKickL = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.18, 0.12), brushedAluminumMat);
    sKickL.position.set(cx - 1.78, Y0 + 0.09, southGlassZ);
    b4.add(sKickL);
    const sKickR = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 0.12), brushedAluminumMat);
    sKickR.position.set(cx + 1.58, Y0 + 0.09, southGlassZ);
    b4.add(sKickR);

    // Upper horizontal transom beam & automatic-door header sensor box
    const sTransom = new THREE.Mesh(new THREE.BoxGeometry(W - 0.88, 0.11, 0.14), brushedAluminumMat);
    sTransom.position.set(cx, Y0 + gfH - 0.32, southGlassZ);
    b4.add(sTransom);
    const sStripeG = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.90, 0.075, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x16805c, emissive: new THREE.Color(0x0c523a), emissiveIntensity: 0.5 })
    );
    sStripeG.position.set(cx, Y0 + gfH - 0.44, southGlassZ + 0.04);
    markTiny(sStripeG);
    b4.add(sStripeG);
    const sStripeO = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.90, 0.055, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xf08428, emissive: new THREE.Color(0xc45814), emissiveIntensity: 0.55 })
    );
    sStripeO.position.set(cx, Y0 + gfH - 0.51, southGlassZ + 0.04);
    markTiny(sStripeO);
    b4.add(sStripeO);

    // Vertical aluminum storefront mullions along +Z
    for (const dx of [-2.50, -1.00, 0.54, 1.56, 2.54]) {
      const mul = new THREE.Mesh(new THREE.BoxGeometry(0.075, gfH - 0.08, 0.12), brushedAluminumMat);
      mul.position.set(cx + dx, Y0 + gfH * 0.5, southGlassZ);
      b4.add(mul);
    }

    // 3D Automatic Sliding Glass Entrance Doors (between cx-1.00 and cx+0.54)
    const sensorBox = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.10, 0.18), darkSteelMat);
    sensorBox.position.set(cx - 0.23, Y0 + gfH - 0.24, southGlassZ + 0.04);
    markTiny(sensorBox);
    b4.add(sensorBox);
    for (const [dxLeaf, hOff] of [
      [cx - 0.72, 0.18],
      [cx + 0.26, -0.18]
    ]) {
      const leafGrp = new THREE.Group();
      leafGrp.position.set(dxLeaf, Y0 + 1.18, southGlassZ + 0.04);
      const topF = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.05), brushedAluminumMat);
      topF.position.y = 1.15;
      leafGrp.add(topF);
      const botF = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.05), brushedAluminumMat);
      botF.position.y = -1.12;
      leafGrp.add(botF);
      for (const sx of [-0.26, 0.26]) {
        const sF = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.34, 0.05), brushedAluminumMat);
        sF.position.x = sx;
        leafGrp.add(sF);
      }
      // Brushed stainless vertical door pull handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.52, 8), stainlessMat);
      handle.position.set(hOff, -0.05, 0.045);
      leafGrp.add(handle);
      markTiny(leafGrp);
      b4.add(leafGrp);
    }

    // Subtle semi-transparent storefront glazing (+Z face, zero Z-fighting!)
    const southGlassPane = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.94, gfH - 0.22), clearGlassMat);
    southGlassPane.position.set(cx, Y0 + gfH * 0.5, southGlassZ - 0.04);
    markTiny(southGlassPane);
    b4.add(southGlassPane);

    // West (-X) Street-Facing Storefront aluminum mullions, kick plate, stripe & semi-transparent glass
    const wKick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, D - 0.88), brushedAluminumMat);
    wKick.position.set(westGlassX, Y0 + 0.09, cz);
    b4.add(wKick);
    const wTransom = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, D - 0.88), brushedAluminumMat);
    wTransom.position.set(westGlassX, Y0 + gfH - 0.32, cz);
    b4.add(wTransom);
    const wStripeG = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.075, D - 0.90),
      new THREE.MeshStandardMaterial({ color: 0x16805c, emissive: new THREE.Color(0x0c523a), emissiveIntensity: 0.5 })
    );
    wStripeG.position.set(westGlassX - 0.04, Y0 + gfH - 0.44, cz);
    markTiny(wStripeG);
    b4.add(wStripeG);
    const wStripeO = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.055, D - 0.90),
      new THREE.MeshStandardMaterial({ color: 0xf08428, emissive: new THREE.Color(0xc45814), emissiveIntensity: 0.55 })
    );
    wStripeO.position.set(westGlassX - 0.04, Y0 + gfH - 0.51, cz);
    markTiny(wStripeO);
    b4.add(wStripeO);

    for (const dz of [-2.34, -1.17, 0.0, 1.17, 2.34]) {
      const mul = new THREE.Mesh(new THREE.BoxGeometry(0.12, gfH - 0.08, 0.075), brushedAluminumMat);
      mul.position.set(westGlassX, Y0 + gfH * 0.5, cz + dz);
      b4.add(mul);
    }
    const westGlassPane = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.92, gfH - 0.22), clearGlassMat);
    westGlassPane.rotation.y = -Math.PI / 2;
    westGlassPane.position.set(westGlassX + 0.04, Y0 + gfH * 0.5, cz);
    markTiny(westGlassPane);
    b4.add(westGlassPane);

    // Glowing icy-cyan 便利店 24H corner fascia signboards with dedicated exact-AR textures & 6-material arrays!
    const martSignWestTex = createNeonSignTexture({
      text: '便利店 24H',
      subText: 'CONVENIENCE · 冷飲小食',
      bgColor: '#123846',
      borderColor: '#7ff0ff',
      textColor: '#ecfdff',
      glowColor: '#48dcff',
      width: 1120,
      height: 182
    });
    const martSignWestMat = new THREE.MeshStandardMaterial({
      map: martSignWestTex,
      emissive: new THREE.Color(0x6eeeff),
      emissiveMap: martSignWestTex,
      emissiveIntensity: 1.12,
      roughness: 0.32
    });
    emissiveTracks.push({ mat: martSignWestMat, baseIntensity: 1.12 });

    const martSignSouthTex = createNeonSignTexture({
      text: '便利店 24H',
      subText: 'CONVENIENCE · 冷飲小食',
      bgColor: '#123846',
      borderColor: '#7ff0ff',
      textColor: '#ecfdff',
      glowColor: '#48dcff',
      width: 1180,
      height: 182
    });
    const martSignSouthMat = new THREE.MeshStandardMaterial({
      map: martSignSouthTex,
      emissive: new THREE.Color(0x6eeeff),
      emissiveMap: martSignSouthTex,
      emissiveIntensity: 1.12,
      roughness: 0.32
    });
    emissiveTracks.push({ mat: martSignSouthMat, baseIntensity: 1.12 });

    const martSignWest = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.68, 4.2),
      [darkSteelMat, martSignWestMat, darkSteelMat, darkSteelMat, darkSteelMat, darkSteelMat]
    );
    martSignWest.position.set(cx - W * 0.5 - 0.04, Y0 + gfH + 0.12, cz + 0.2);
    b4.add(martSignWest);

    const martSignSouth = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.68, 0.14),
      [darkSteelMat, darkSteelMat, darkSteelMat, darkSteelMat, martSignSouthMat, darkSteelMat]
    );
    martSignSouth.position.set(cx - 0.35, Y0 + gfH + 0.12, cz + D * 0.5 + 0.04);
    b4.add(martSignSouth);

    // Glass entrance rain canopy with 3D tension tie-rods anchoring back into facade
    const martAwning = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.06, 0.74),
      new THREE.MeshStandardMaterial({
        color: 0x9de8ff,
        transparent: true,
        opacity: 0.46,
        roughness: 0.18,
        metalness: 0.22
      })
    );
    martAwning.position.set(cx - 0.35, Y0 + gfH - 0.16, cz + D * 0.5 + 0.37);
    martAwning.rotation.x = 0.14;
    b4.add(martAwning);

    for (const dx of [-2.1, -0.35, 1.4]) {
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.84, 6), darkSteelMat);
      tie.position.set(cx + dx, Y0 + gfH + 0.16, cz + D * 0.5 + 0.34);
      tie.rotation.x = -0.82;
      markTiny(tie);
      b4.add(tie);
    }

    // -----------------------------------------------------------------------
    // 2. Upper Jade-Green Mosaic Tile Facade (紙皮石唐樓 — 3 upper storeys clearing viaduct!)
    // -----------------------------------------------------------------------
    const b4Tex = createFacadeTextureSet({
      seed: 404,
      baseColor: '#4c756f',
      secondaryColor: '#365652',
      trimColor: '#769a94',
      cols: 3,
      rows: 3,
      tileStyle: 'mosaic',
      litProbability: 0.62,
      warmRatio: 0.76,
      hasIronGrilles: true,
      stainStrength: 1.0
    });
    const b4WallMat = new THREE.MeshStandardMaterial({
      map: b4Tex.map,
      emissive: new THREE.Color(0xffcc82),
      emissiveMap: b4Tex.emissiveMap,
      emissiveIntensity: 0.72,
      bumpMap: b4Tex.bumpMap,
      bumpScale: 0.048,
      roughness: 0.72,
      metalness: 0.08
    });
    emissiveTracks.push({ mat: b4WallMat, baseIntensity: 0.72 });

    const upperBody = new THREE.Mesh(
      new THREE.BoxGeometry(W, upperH, D),
      [b4WallMat, b4WallMat, roofFlatMat, roofFlatMat, b4WallMat, b4WallMat]
    );
    upperBody.position.set(cx, Y0 + gfH + upperH * 0.5, cz);
    upperBody.castShadow = true;
    upperBody.receiveShadow = true;
    b4.add(upperBody);

    // Horizontal jade concrete stringcourses & angled corner pilasters
    for (const fy of [
      Y0 + gfH + 0.04,
      Y0 + gfH + upperH / 3,
      Y0 + gfH + (upperH * 2) / 3,
      Y0 + gfH + upperH - 0.04
    ]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.16, D + 0.24), jadeTrimMat);
      band.position.set(cx, fy, cz);
      b4.add(band);
    }
    for (const [px, pz] of [
      [cx + W * 0.5, cz + D * 0.5],
      [cx - W * 0.5, cz + D * 0.5],
      [cx + W * 0.5, cz - D * 0.5],
      [cx - W * 0.5, cz - D * 0.5]
    ]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.22, upperH, 0.22), jadeTrimMat);
      pil.position.set(px, Y0 + gfH + upperH * 0.5, pz);
      pil.rotation.y = Math.PI * 0.25;
      b4.add(pil);
    }

    // 3D Window Sun-Hoods, Sills, Protruding Wrought-Iron Cages & Bamboo Laundry Pole on B4
    addFacadeWindowReliefs(b4, {
      cx,
      yBot: Y0 + gfH,
      cz,
      W,
      H: upperH,
      D,
      cols: 3,
      rows: 3,
      faces: ['+Z', '+X', '-X'],
      hoodMat: jadeTrimMat,
      cages: [
        { face: '+Z', col: 2, row: 0, hasPlant: true },
        { face: '+X', col: 0, row: 1, hasPlant: false }
      ],
      laundryPoles: [{ face: '+X', col: 1, row: 0, phase: 4.2 }]
    });

    // Cast-iron exterior drainage pipes on B4 corners
    addDrainagePipeRun(b4, cx + W * 0.5 + 0.05, cz + D * 0.5 - 0.14, Y0 + gfH + upperH, Y0, [1, 0], true);
    addDrainagePipeRun(b4, cx - W * 0.5 - 0.05, cz - D * 0.5 + 0.14, Y0 + gfH + upperH, Y0, [-1, 0], false);

    // Rooftop parapet, upgraded corrugated tin shed, raised water tank & planter shrubs
    const roofY = Y0 + gfH + upperH;
    const pMat = new THREE.MeshStandardMaterial({ color: 0x5c827c, roughness: 0.8 });
    for (const [px, pz, pw, pd] of [
      [cx, cz + D * 0.5 - 0.12, W, 0.24],
      [cx, cz - D * 0.5 + 0.12, W, 0.24],
      [cx + W * 0.5 - 0.12, cz, 0.24, D],
      [cx - W * 0.5 + 0.12, cz, 0.24, D]
    ] as Array<[number, number, number, number]>) {
      const pm = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.62, pd), pMat);
      pm.position.set(px, roofY + 0.31, pz);
      pm.castShadow = true;
      b4.add(pm);
    }

    const tinShed = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.42, 2.1),
      new THREE.MeshStandardMaterial({ map: tinRoofTex, roughness: 0.72, metalness: 0.3 })
    );
    tinShed.position.set(cx + 1.1, roofY + 0.71, cz - 1.1);
    tinShed.castShadow = true;
    b4.add(tinShed);
    const shedOverhang = new THREE.Mesh(
      new THREE.BoxGeometry(2.68, 0.07, 2.38),
      new THREE.MeshStandardMaterial({ map: tinPenthouseTex, roughness: 0.65, metalness: 0.35 })
    );
    shedOverhang.position.set(cx + 1.1, roofY + 1.46, cz - 1.1);
    shedOverhang.rotation.x = 0.08;
    b4.add(shedOverhang);
    const shedDoor = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.12, 0.06), darkSteelMat);
    shedDoor.position.set(cx + 0.65, roofY + 0.58, cz - 0.03);
    markTiny(shedDoor);
    b4.add(shedDoor);

    // Galvanized rooftop water tank on concrete plinth
    const b4Tank = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.96, 12), tankSteelMat);
    b4Tank.position.set(cx - 1.75, roofY + 0.64, cz - 1.45);
    b4Tank.castShadow = true;
    b4.add(b4Tank);
    const b4TankBase = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.24, 0.96), coolConcreteMat);
    b4TankBase.position.set(cx - 1.75, roofY + 0.12, cz - 1.45);
    b4.add(b4TankBase);

    // Rooftop potted shrubs (matte organic multi-puff clusters)
    const bushDarkMat = new THREE.MeshStandardMaterial({ color: 0x2c523e, roughness: 0.96, metalness: 0.0 });
    const bushLightMat = new THREE.MeshStandardMaterial({ color: 0x3e6c52, roughness: 0.96, metalness: 0.0 });
    for (const [bx, bz] of [
      [cx - 1.7, cz + 1.6],
      [cx - 0.8, cz + 1.8],
      [cx + 1.4, cz + 1.7]
    ]) {
      const pot = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.36, 0.65), warmConcreteMat);
      pot.position.set(bx, roofY + 0.18, bz);
      b4.add(pot);
      for (const [ox, oy, oz, r, light] of [
        [0, 0.54, 0, 0.28, false],
        [-0.18, 0.48, 0.12, 0.22, false],
        [0.16, 0.52, -0.10, 0.23, true],
        [0.04, 0.68, 0.06, 0.21, true]
      ] as Array<[number, number, number, number, boolean]>) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), light ? bushLightMat : bushDarkMat);
        puff.position.set(bx + ox, roofY + oy, bz + oz);
        markTiny(puff);
        b4.add(puff);
      }
    }

    // Projecting vertical Hong Kong neon signs on B4 elevated cleanly ABOVE viaduct deck!
    const teaTex = createNeonSignTexture({
      text: '涼茶',
      subText: 'HERBAL TEA',
      vertical: true,
      bgColor: '#122c24',
      borderColor: '#56f2a6',
      textColor: '#e6fff0',
      glowColor: '#2ce88c',
      width: 196,
      height: 512
    });
    addProjectingNeon(b4, teaTex, {
      x: cx - W * 0.5 - 0.52,
      y: Y0 + 8.15,
      z: cz + 1.25,
      width: 0.68,
      height: 1.78,
      rotY: 0,
      bracketDir: [1, 0],
      bracketLen: 0.20,
      emissiveHex: 0x3ef09a,
      baseIntensity: 1.48,
      flickerPhase: 0.7
    });

    const pharmTex = createNeonSignTexture({
      text: '藥房',
      subText: 'DISPENSARY',
      vertical: true,
      bgColor: '#321428',
      borderColor: '#ff74bc',
      textColor: '#ffe8f5',
      glowColor: '#ff42a4',
      width: 196,
      height: 512
    });
    addProjectingNeon(b4, pharmTex, {
      x: cx - 1.05,
      y: Y0 + 8.65,
      z: cz + D * 0.5 + 0.56,
      width: 0.74,
      height: 1.92,
      rotY: Math.PI / 2,
      bracketDir: [0, -1],
      bracketLen: 0.21,
      emissiveHex: 0xff52aa,
      baseIntensity: 1.52,
      flickerPhase: 5.4
    });

    // AC units on B4
    addBoxAC(b4, cx + W * 0.5 + 0.18, Y0 + 4.4, cz + 1.15, Math.PI / 2);
    addBoxAC(b4, cx + W * 0.5 + 0.18, Y0 + 7.2, cz - 1.05, Math.PI / 2);
    addBoxAC(b4, cx + 1.15, Y0 + 8.2, cz + D * 0.5 + 0.18, 0);

    group.add(b4);
  }

  // =========================================================================
  // EAST PLAZA ARCHITECTURAL ANCHOR: HONG KONG MTR / SUBWAY EXIT A3 CANOPY
  // (灣仔站 A3 出口) + SHELTERED VENDING MACHINE NICHE (x in [6.45, 13.55], z in [0.1, 2.2])
  // Low-profile (~3.1m) so sightlines to viaduct, train, and B4 remain 100% open!
  // =========================================================================
  {
    const mtrGroup = new THREE.Group();
    mtrGroup.name = 'EastPlaza_MtrExitA3_AndVending';

    const mtrGreenSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1c4a3e,
      roughness: 0.44,
      metalness: 0.52
    });
    const mtrCanopyGlassMat = new THREE.MeshStandardMaterial({
      color: 0x98d8e6,
      transparent: true,
      opacity: 0.36,
      roughness: 0.16,
      metalness: 0.26
    });
    const mtrTileWallMat = new THREE.MeshStandardMaterial({
      map: tileDadoTex,
      color: 0xc2d8d0,
      roughness: 0.40,
      metalness: 0.08
    });
    const mtrStairMat = new THREE.MeshStandardMaterial({
      color: 0x4b5660,
      roughness: 0.82
    });
    const mtrGlowCeilingMat = new THREE.MeshStandardMaterial({
      color: 0xf4e4c4,
      emissive: new THREE.Color(0xf2cb88),
      emissiveIntensity: 0.68,
      roughness: 0.52
    });
    emissiveTracks.push({ mat: mtrGlowCeilingMat, baseIntensity: 0.68 });

    const mtrSignSet = createMtrExitSignTexture();
    const mtrSignMat = new THREE.MeshStandardMaterial({
      map: mtrSignSet.map,
      emissive: new THREE.Color(0xe6fff8),
      emissiveMap: mtrSignSet.emissiveMap,
      emissiveIntensity: 1.02,
      roughness: 0.32
    });
    emissiveTracks.push({ mat: mtrSignMat, baseIntensity: 1.02 });

    // Contact AO beneath the full MTR exit & vending shelter structure
    addContactShadow(10.0, 1.15, 7.2, 2.25, 0.56);

    // 1. East Wing: Glowing Recessed MTR Subway Stairwell Hood (x in [8.9, 13.5], z in [0.1, 2.15])
    const sx = 11.2;
    const sz = 1.12;
    const sw = 4.6;
    const sd = 2.02;

    // Glazed jade-tiled stairwell perimeter parapet walls (North, East, West — open South entrance!)
    const backWallMtr = new THREE.Mesh(new THREE.BoxGeometry(sw, 1.55, 0.18), mtrTileWallMat);
    backWallMtr.position.set(sx, Y0 + 0.775, sz - sd * 0.5 + 0.09);
    backWallMtr.castShadow = true;
    backWallMtr.receiveShadow = true;
    mtrGroup.add(backWallMtr);

    for (const sideX of [sx - sw * 0.5 + 0.09, sx + sw * 0.5 - 0.09]) {
      const sideW = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.32, sd), mtrTileWallMat);
      sideW.position.set(sideX, Y0 + 0.66, sz);
      sideW.castShadow = true;
      sideW.receiveShadow = true;
      mtrGroup.add(sideW);

      const capStone = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, sd + 0.06), coolConcreteMat);
      capStone.position.set(sideX, Y0 + 1.35, sz);
      mtrGroup.add(capStone);
    }

    // Dark recessed subway descent portal floor + stepped concrete stairs + stainless handrails
    const wellFloor = new THREE.Mesh(
      new THREE.BoxGeometry(sw - 0.36, 0.06, sd - 0.24),
      new THREE.MeshStandardMaterial({ color: 0x16222a, roughness: 0.75 })
    );
    wellFloor.position.set(sx, Y0 + 0.03, sz + 0.02);
    mtrGroup.add(wellFloor);

    // Illuminated recessed subway concourse portal glow on inner north wall
    const portalGlow = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.80, 1.18), mtrGlowCeilingMat);
    portalGlow.position.set(sx, Y0 + 0.74, sz - sd * 0.5 + 0.20);
    mtrGroup.add(portalGlow);

    // 4 Descending concrete steps with yellow anti-slip nosing strips
    for (let st = 0; st < 4; st++) {
      const stepH = 0.05 + (3 - st) * 0.035;
      const step = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.44, stepH, 0.34), mtrStairMat);
      step.position.set(sx, Y0 + stepH * 0.5, sz + 0.74 - st * 0.36);
      markTiny(step);
      mtrGroup.add(step);
    }

    // Center & side brushed stainless-steel subway handrails
    for (const rx of [sx - 1.98, sx, sx + 1.98]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.65, 8), stainlessMat);
      rail.rotation.x = Math.PI / 2 + 0.14;
      rail.position.set(rx, Y0 + 0.86, sz + 0.12);
      markTiny(rail);
      mtrGroup.add(rail);
      for (const pz of [sz - 0.55, sz + 0.82]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.88, 6), stainlessMat);
        post.position.set(rx, Y0 + 0.44, pz);
        markTiny(post);
        mtrGroup.add(post);
      }
    }

    // Structural dark-green steel canopy columns (supporting continuous hood over Exit A3 + Vending Niche!)
    for (const [px, pz] of [
      [6.55, 1.48],
      [8.95, 2.02],
      [13.45, 2.02],
      [8.95, 0.22],
      [13.45, 0.22]
    ]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.076, 2.65, 10), mtrGreenSteelMat);
      col.position.set(px, Y0 + 1.325, pz);
      col.castShadow = true;
      mtrGroup.add(col);
    }

    // Sloped dark-green framed & glass-skylight MTR canopy roof spanning Exit A3 + Vending Niche
    const mtrCanopyFrame = new THREE.Mesh(new THREE.BoxGeometry(7.35, 0.12, 2.55), mtrGreenSteelMat);
    mtrCanopyFrame.position.set(10.0, Y0 + 2.84, 1.18);
    mtrCanopyFrame.rotation.x = 0.08;
    mtrCanopyFrame.castShadow = true;
    mtrGroup.add(mtrCanopyFrame);

    const mtrSkylight = new THREE.Mesh(new THREE.BoxGeometry(6.75, 0.06, 1.92), mtrCanopyGlassMat);
    mtrSkylight.position.set(10.0, Y0 + 2.90, 1.18);
    mtrSkylight.rotation.x = 0.08;
    markTiny(mtrSkylight);
    mtrGroup.add(mtrSkylight);

    // Warm glowing linear LED soffit light bar underneath the MTR canopy
    const mtrSoffitBar = new THREE.Mesh(new THREE.BoxGeometry(4.10, 0.05, 0.22), mtrGlowCeilingMat);
    mtrSoffitBar.position.set(sx, Y0 + 2.68, sz + 0.10);
    markTiny(mtrSoffitBar);
    mtrGroup.add(mtrSoffitBar);

    // Iconic Backlit Fascia Signboard facing +Z: 灣仔站 · 出口 WAN CHAI STATION A3 (4.36 × 0.75, exact AR 5.81!)
    const mtrFascia = new THREE.Mesh(
      new THREE.BoxGeometry(4.36, 0.75, 0.16),
      [mtrGreenSteelMat, mtrGreenSteelMat, mtrGreenSteelMat, mtrGreenSteelMat, mtrSignMat, mtrGreenSteelMat]
    );
    mtrFascia.position.set(sx, Y0 + 2.48, 2.16);
    mtrFascia.castShadow = true;
    mtrGroup.add(mtrFascia);

    // 2. West Wing: Tiled Architectural Backing Wall for the 2 Outdoor Vending Machines!
    const vmBackWall = new THREE.Mesh(new THREE.BoxGeometry(2.52, 2.38, 0.18), mtrTileWallMat);
    vmBackWall.position.set(7.65, Y0 + 1.19, 1.48);
    vmBackWall.castShadow = true;
    vmBackWall.receiveShadow = true;
    mtrGroup.add(vmBackWall);

    // 3. Upgraded Non-Blown-Out Crisp Hong Kong Beverage Vending Machines nestled cleanly against the tiled wall!
    const vmSetA = createVendingMachineTextureSet('teal');
    const vmSetB = createVendingMachineTextureSet('crimson');
    const vmTealSideMat = new THREE.MeshStandardMaterial({ color: 0x265264, roughness: 0.44, metalness: 0.30 });
    const vmCrimSideMat = new THREE.MeshStandardMaterial({ color: 0x8f2e32, roughness: 0.44, metalness: 0.26 });
    const vmDarkInteriorMat = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.85 });
    const octopusPadMat = new THREE.MeshStandardMaterial({
      color: 0xf4b63c,
      emissive: new THREE.Color(0xe09420),
      emissiveIntensity: 0.72,
      roughness: 0.32
    });
    emissiveTracks.push({ mat: octopusPadMat, baseIntensity: 0.72 });

    const vmSpecs: Array<{
      x: number;
      z: number;
      texSet: { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture };
      sideMat: THREE.MeshStandardMaterial;
      emissive: number;
    }> = [
      { x: 7.05, z: 1.98, texSet: vmSetA, sideMat: vmTealSideMat, emissive: 0x8aeaff },
      { x: 8.20, z: 1.98, texSet: vmSetB, sideMat: vmCrimSideMat, emissive: 0xaef0ff }
    ];

    for (const vm of vmSpecs) {
      const vmGrp = new THREE.Group();
      vmGrp.position.set(vm.x, Y0, vm.z);

      const vmFrontMat = new THREE.MeshStandardMaterial({
        map: vm.texSet.map,
        emissive: new THREE.Color(vm.emissive),
        emissiveMap: vm.texSet.emissiveMap,
        emissiveIntensity: 0.62,
        roughness: 0.28
      });
      emissiveTracks.push({ mat: vmFrontMat, baseIntensity: 0.62 });

      // Main cabinet body flush against MTR tiled wall
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.90, 1.76, 0.66),
        [vm.sideMat, vm.sideMat, vm.sideMat, vm.sideMat, vmFrontMat, vm.sideMat]
      );
      body.position.set(0, 0.94, -0.02);
      body.castShadow = true;
      vmGrp.add(body);

      // 3D Protruding Perimeter Display Bezel Frame creating real physical recess
      const bezelTop = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.10), vm.sideMat);
      bezelTop.position.set(0, 1.80, 0.33);
      vmGrp.add(bezelTop);
      const bezelBot = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.14, 0.10), vm.sideMat);
      bezelBot.position.set(0, 0.13, 0.33);
      vmGrp.add(bezelBot);
      const bezelMid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.10, 0.10), vm.sideMat);
      bezelMid.position.set(0, 0.66, 0.33);
      vmGrp.add(bezelMid);
      for (const sxB of [-0.43, 0.43]) {
        const sideB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.76, 0.10), vm.sideMat);
        sideB.position.set(sxB, 0.94, 0.33);
        vmGrp.add(sideB);
      }

      // Outer protective showcase glass pane over upper drink bay
      const vmGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.04), clearGlassMat);
      vmGlass.position.set(0, 1.24, 0.365);
      markTiny(vmGlass);
      vmGrp.add(vmGlass);

      // Bottom recessed dark pickup chute bay + swinging metallic flap lip
      const chuteFrame = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.30, 0.08), vmDarkInteriorMat);
      chuteFrame.position.set(-0.10, 0.38, 0.32);
      markTiny(chuteFrame);
      vmGrp.add(chuteFrame);
      const chuteFlap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.09), brushedAluminumMat);
      chuteFlap.position.set(-0.10, 0.50, 0.34);
      chuteFlap.rotation.x = 0.25;
      markTiny(chuteFlap);
      vmGrp.add(chuteFlap);

      // 3D Coin/Bill acceptor module & glowing Octopus (八達通) card reader pad
      const coinPanel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.07), darkSteelMat);
      coinPanel.position.set(0.28, 0.42, 0.34);
      markTiny(coinPanel);
      vmGrp.add(coinPanel);
      const octPad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.025), octopusPadMat);
      octPad.position.set(0.28, 0.50, 0.38);
      markTiny(octPad);
      vmGrp.add(octPad);

      // 4 dark leveling feet
      for (const [fx, fz] of [
        [-0.36, -0.24],
        [0.36, -0.24],
        [-0.36, 0.24],
        [0.36, 0.24]
      ]) {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.07, 6), darkSteelMat);
        foot.position.set(fx, 0.035, fz);
        markTiny(foot);
        vmGrp.add(foot);
      }

      mtrGroup.add(vmGrp);
      addContactShadow(vm.x, vm.z, 0.88, 0.72, 0.44);
    }

    group.add(mtrGroup);
  }

  // =========================================================================
  // B5: Back-Right Concrete Substation / Mechanical Hall behind Viaduct
  // Footprint: x in [+5.7, +11.1], z in [-13.6, -8.8], cleanly behind viaduct & clear of traction pole!
  // =========================================================================
  {
    const b5 = new THREE.Group();
    b5.name = 'B5_BackRightSubstation';
    const cx = 8.4;
    const cz = -11.2;
    const W = 5.4;
    const D = 4.8;
    const H = 6.2;
    addContactShadow(cx, cz, W, D, 0.62);

    const b5Tex = createFacadeTextureSet({
      seed: 505,
      baseColor: '#637688',
      secondaryColor: '#485866',
      trimColor: '#889aab',
      cols: 3,
      rows: 2,
      tileStyle: 'concrete',
      litProbability: 0.52,
      warmRatio: 0.38,
      hasIronGrilles: false,
      stainStrength: 1.05
    });
    const b5WallMat = new THREE.MeshStandardMaterial({
      map: b5Tex.map,
      emissive: new THREE.Color(0xc8ecff),
      emissiveMap: b5Tex.emissiveMap,
      emissiveIntensity: 0.68,
      bumpMap: b5Tex.bumpMap,
      bumpScale: 0.045,
      roughness: 0.84,
      metalness: 0.06
    });
    emissiveTracks.push({ mat: b5WallMat, baseIntensity: 0.68 });

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(W, H, D),
      [b5WallMat, b5WallMat, roofFlatMat, roofFlatMat, b5WallMat, b5WallMat]
    );
    body.position.set(cx, Y0 + H * 0.5, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    b5.add(body);

    // 3D Concrete Window Sun-Hoods & Sills on upper windows
    addFacadeWindowReliefs(b5, {
      cx,
      yBot: Y0,
      cz,
      W,
      H,
      D,
      cols: 3,
      rows: 2,
      faces: ['+X'],
      hoodMat: coolConcreteMat,
      skipCells: [
        { face: '+X', col: 0, row: 1 },
        { face: '+X', col: 1, row: 1 },
        { face: '+X', col: 2, row: 1 }
      ]
    });

    // 3D Industrial Louvered Ventilation Grilles mounted inside heavy steel frames on +Z & +X!
    const addWallLouvre = (x: number, y: number, z: number, w: number, h: number, rotY: number) => {
      const vg = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.12), darkSteelMat);
      vg.add(frame);
      const face = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), louvreMat);
      face.position.z = 0.01;
      vg.add(face);
      vg.position.set(x, y, z);
      vg.rotation.y = rotY;
      b5.add(vg);
    };
    addWallLouvre(cx - 1.55, Y0 + 1.85, cz + D * 0.5 + 0.04, 1.45, 1.32, 0);
    addWallLouvre(cx + 1.55, Y0 + 1.85, cz + D * 0.5 + 0.04, 1.45, 1.32, 0);
    addWallLouvre(cx + W * 0.5 + 0.04, Y0 + 1.85, cz + 1.35, 1.25, 1.32, Math.PI / 2);
    addWallLouvre(cx + W * 0.5 + 0.04, Y0 + 1.85, cz - 1.35, 1.25, 1.32, Math.PI / 2);

    // Twin Heavy Steel Substation Service Doors on east wall center
    const doorGrp = new THREE.Group();
    const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.25, 1.36), darkSteelMat);
    doorGrp.add(doorSlab);
    const hazardBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.14, 1.18),
      new THREE.MeshStandardMaterial({ color: 0xdca832, roughness: 0.55 })
    );
    hazardBar.position.y = 0.25;
    doorGrp.add(hazardBar);
    doorGrp.position.set(cx + W * 0.5 + 0.02, Y0 + 1.14, cz);
    markTiny(doorGrp);
    b5.add(doorGrp);

    // Exterior drainage conduit down +X/+Z corner
    addDrainagePipeRun(b5, cx + W * 0.5 + 0.06, cz + D * 0.5 - 0.12, Y0 + H, Y0, [1, 0], false);

    // Wide overhanging concrete roof cornice
    const roofY = Y0 + H;
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(W + 0.52, 0.32, D + 0.52), coolConcreteMat);
    cornice.position.set(cx, roofY + 0.14, cz);
    cornice.castShadow = true;
    b5.add(cornice);

    // Glowing Recessed Clerestory Strip with 3D Concrete Hood/Sill & 7 Steel Mullion Frames!
    const clerestoryMat = new THREE.MeshStandardMaterial({
      color: 0xdff6ff,
      emissive: new THREE.Color(0x88dcff),
      emissiveIntensity: 1.18,
      roughness: 0.28
    });
    emissiveTracks.push({ mat: clerestoryMat, baseIntensity: 1.18 });
    const clW = W - 0.9;
    const clY = roofY - 0.55;
    const clZ = cz + D * 0.5 + 0.02;

    const clStrip = new THREE.Mesh(new THREE.BoxGeometry(clW, 0.46, 0.06), clerestoryMat);
    clStrip.position.set(cx, clY, clZ);
    b5.add(clStrip);

    // Protruding concrete frame box + 7 vertical dark-steel clerestory mullions
    const clTop = new THREE.Mesh(new THREE.BoxGeometry(clW + 0.22, 0.09, 0.24), coolConcreteMat);
    clTop.position.set(cx, clY + 0.26, clZ + 0.08);
    b5.add(clTop);
    const clBot = new THREE.Mesh(new THREE.BoxGeometry(clW + 0.22, 0.09, 0.22), coolConcreteMat);
    clBot.position.set(cx, clY - 0.26, clZ + 0.07);
    b5.add(clBot);
    for (let m = 0; m < 7; m++) {
      const mx = cx - clW * 0.5 + (m / 6) * clW;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.50, 0.16), darkSteelMat);
      fin.position.set(mx, clY, clZ + 0.05);
      markTiny(fin);
      b5.add(fin);
    }

    // Steel Rooftop Maintenance Safety Railings wrapping the concrete cornice perimeter!
    const railGrp = new THREE.Group();
    const rHalfW = W * 0.5 + 0.12;
    const rHalfD = D * 0.5 + 0.12;
    const rBaseY = roofY + 0.30;
    for (const ry of [0.42, 0.84]) {
      const nBar = new THREE.Mesh(new THREE.BoxGeometry(rHalfW * 2, 0.036, 0.036), darkSteelMat);
      nBar.position.set(cx, rBaseY + ry, cz - rHalfD);
      railGrp.add(nBar);
      const sBar = new THREE.Mesh(new THREE.BoxGeometry(rHalfW * 2, 0.036, 0.036), darkSteelMat);
      sBar.position.set(cx, rBaseY + ry, cz + rHalfD);
      railGrp.add(sBar);
      const eBar = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, rHalfD * 2), darkSteelMat);
      eBar.position.set(cx + rHalfW, rBaseY + ry, cz);
      railGrp.add(eBar);
      const wBar = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, rHalfD * 2), darkSteelMat);
      wBar.position.set(cx - rHalfW, rBaseY + ry, cz);
      railGrp.add(wBar);
    }
    for (let i = 0; i <= 4; i++) {
      const px = cx - rHalfW + (i / 4) * (rHalfW * 2);
      for (const pz of [cz - rHalfD, cz + rHalfD]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.86, 0.04), darkSteelMat);
        post.position.set(px, rBaseY + 0.43, pz);
        railGrp.add(post);
      }
    }
    for (let i = 1; i <= 3; i++) {
      const pz = cz - rHalfD + (i / 4) * (rHalfD * 2);
      for (const px of [cx - rHalfW, cx + rHalfW]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.86, 0.04), darkSteelMat);
        post.position.set(px, rBaseY + 0.43, pz);
        railGrp.add(post);
      }
    }
    markTiny(railGrp);
    b5.add(railGrp);

    // Upgraded Rooftop Industrial HVAC Chiller Pods + Sheet-Metal Duct & Pipe Conduit Runs (scaled cleanly to 5.4x4.8 roof)
    const hvacCoords: Array<[number, number]> = [
      [cx - 1.05, cz - 0.65],
      [cx + 0.92, cz + 0.42]
    ];
    for (const [hx, hz] of hvacCoords) {
      // Vibration-mount steel skids
      for (const sz of [-0.44, 0.44]) {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.10, 0.12), darkSteelMat);
        skid.position.set(hx, roofY + 0.35, hz + sz);
        markTiny(skid);
        b5.add(skid);
      }
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.82, 1.12), acBodyMat);
      hvac.position.set(hx, roofY + 0.80, hz);
      hvac.castShadow = true;
      b5.add(hvac);
      // Louvered intake grille panels on +Z side of chiller
      const hLouvre = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.56, 0.04), louvreMat);
      hLouvre.position.set(hx, roofY + 0.80, hz + 0.57);
      markTiny(hLouvre);
      b5.add(hLouvre);
      // Top circular exhaust fan shroud + protective core
      const fanShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.40, 0.16, 14), darkSteelMat);
      fanShroud.position.set(hx, roofY + 1.26, hz);
      b5.add(fanShroud);
      const fanCore = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.18, 12), acGrilleMat);
      fanCore.position.set(hx, roofY + 1.26, hz);
      markTiny(fanCore);
      b5.add(fanCore);
    }

    // Mechanical rooftop riser manifold + insulated sheet-metal ducts & chilled-water pipes connecting both chillers!
    const ductGrp = new THREE.Group();
    const riserBox = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.92, 0.80), tankSteelMat);
    riserBox.position.set(cx - 1.32, roofY + 0.76, cz + 1.15);
    riserBox.castShadow = true;
    ductGrp.add(riserBox);

    // Main insulated sheet-metal rectangular duct connecting Chiller A -> Riser -> Chiller B
    const ductA = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 1.24), brushedAluminumMat);
    ductA.position.set(cx - 1.22, roofY + 0.56, cz + 0.24);
    ductGrp.add(ductA);

    const ductB = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.28, 0.32), brushedAluminumMat);
    ductB.position.set(cx - 0.16, roofY + 0.56, cz + 1.12);
    ductGrp.add(ductB);

    const ductC = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.68), brushedAluminumMat);
    ductC.position.set(cx + 0.78, roofY + 0.56, cz + 0.90);
    ductGrp.add(ductC);

    // Flanged duct collar rings
    for (const fx of [cx - 0.72, cx - 0.16, cx + 0.38]) {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.38), darkSteelMat);
      flange.position.set(fx, roofY + 0.56, cz + 1.12);
      ductGrp.add(flange);
    }

    // Twin cylindrical chilled-water pipes linking the two HVAC chillers directly
    for (const pOff of [-0.14, 0.14]) {
      const pipeX = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 1.88, 8), tankSteelMat);
      pipeX.rotation.z = Math.PI / 2;
      pipeX.position.set(cx - 0.06, roofY + 0.48 + pOff * 0.2, cz - 0.56 + pOff);
      ductGrp.add(pipeX);

      const pipeZ = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 1.02, 8), tankSteelMat);
      pipeZ.rotation.x = Math.PI / 2;
      pipeZ.position.set(cx + 0.84 + pOff, roofY + 0.48 + pOff * 0.2, cz - 0.08);
      ductGrp.add(pipeZ);
    }
    markTiny(ductGrp);
    b5.add(ductGrp);

    group.add(b5);
  }

  scene.add(group);

  let currentEmissiveScale = 1.15;

  const setEmissiveScale = (scale: number) => {
    currentEmissiveScale = scale;
    for (const track of emissiveTracks) {
      track.mat.emissiveIntensity = track.baseIntensity * currentEmissiveScale;
    }
  };

  const update = (simTime: number) => {
    for (const track of emissiveTracks) {
      if (track.flickerPhase !== undefined && track.flickerAmp) {
        // Gentle authentic neon ballast shimmer + rare micro-flutter
        const wave = Math.sin(simTime * 3.2 + track.flickerPhase) * 0.035;
        const flutter =
          Math.pow(Math.max(0, Math.sin(simTime * 1.1 + track.flickerPhase * 2.3)), 18) *
          Math.sin(simTime * 42.0) *
          track.flickerAmp;
        track.mat.emissiveIntensity = Math.max(
          0.2,
          track.baseIntensity * currentEmissiveScale * (1.0 + wave - Math.abs(flutter))
        );
      }
    }

    // Subtle rainy-breeze sway on bamboo-pole hanging laundry garments
    for (const l of laundryTracks) {
      l.obj.rotation.x = l.baseRotX + Math.sin(simTime * 2.1 + l.phase) * 0.11;
      l.obj.rotation.z = Math.cos(simTime * 1.65 + l.phase * 1.3) * 0.06;
    }

    // Slow rhythmic red rooftop aviation beacon pulse on B3
    if (beaconMat) {
      const pulse = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(simTime * 2.6), 4);
      beaconMat.emissiveIntensity = (0.65 + 2.8 * pulse) * Math.max(0.55, currentEmissiveScale);
    }
  };

  return {
    group,
    neonPositions,
    setEmissiveScale,
    update
  };
}
