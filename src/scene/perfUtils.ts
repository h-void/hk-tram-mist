import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface MergeStaticOptions {
  /** Dynamic object roots (and all their descendants) that must NOT be merged */
  excludeRoots?: Iterable<THREE.Object3D>;
  /** Tag merged & singleton micro-detail (`skipPrintEdges`) meshes with `skipReflection = true` */
  skipTinyInReflection?: boolean;
  /** Optional prefix for merged mesh names */
  namePrefix?: string;
}

const RESERVED_NAMES = new Set([
  'ExtendedGroundPlane',
  'WetAsphaltRoad',
  'SidewalkOuterDeck',
  'PlanarWetRoadReflector'
]);

/**
 * Builds an indexed XY-plane BufferGeometry matching THREE.PlaneGeometry(width, height) UVs
 * identically, with a clean rectangular opening cut out (4 quads = 8 triangles, 0 seams).
 * Note: After rotating the mesh by `rotation.x = -Math.PI / 2` at `(cx, y, cz)`,
 * world `(wx, wz)` maps to local `(localX = wx - cx, localY = cz - wz)`.
 */
export function createPlaneWithRectHole(
  width: number,
  height: number,
  holeMinX: number,
  holeMaxX: number,
  holeMinY: number,
  holeMaxY: number
): THREE.BufferGeometry {
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const hx0 = Math.max(-halfW, Math.min(halfW, holeMinX));
  const hx1 = Math.max(-halfW, Math.min(halfW, holeMaxX));
  const hy0 = Math.max(-halfH, Math.min(halfH, holeMinY));
  const hy1 = Math.max(-halfH, Math.min(halfH, holeMaxY));

  const rects: Array<[number, number, number, number]> = [];
  const pushRect = (x0: number, x1: number, y0: number, y1: number) => {
    if (x1 - x0 > 1e-5 && y1 - y0 > 1e-5) {
      rects.push([x0, x1, y0, y1]);
    }
  };

  // Bottom strip, top strip, left strip, right strip around the rectangular hole
  pushRect(-halfW, halfW, -halfH, hy0);
  pushRect(-halfW, halfW, hy1, halfH);
  pushRect(-halfW, hx0, hy0, hy1);
  pushRect(hx1, halfW, hy0, hy1);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < rects.length; i++) {
    const [x0, x1, y0, y1] = rects[i];
    const base = i * 4;
    const u0 = (x0 + halfW) / width;
    const u1 = (x1 + halfW) / width;
    const v0 = (y0 + halfH) / height;
    const v1 = (y1 + halfH) / height;

    positions.push(
      x0, y0, 0,
      x1, y0, 0,
      x1, y1, 0,
      x0, y1, 0
    );
    normals.push(
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1
    );
    uvs.push(
      u0, v0,
      u1, v0,
      u1, v1,
      u0, v1
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
  return geom;
}

function isDescendantOfAny(obj: THREE.Object3D, roots: Set<THREE.Object3D>): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (roots.has(cur)) return true;
    cur = cur.parent;
  }
  return false;
}

function getEffectiveFlag(
  obj: THREE.Object3D,
  stopAt: THREE.Object3D,
  key: string
): unknown {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData && cur.userData[key] !== undefined) {
      return cur.userData[key];
    }
    if (cur === stopAt) break;
    cur = cur.parent;
  }
  return undefined;
}

/**
 * Extracts a compact, standalone BufferGeometry slice for a single geometry group
 * (e.g., one face of a multi-material BoxGeometry) so all faces sharing the same
 * material can merge directly into shared material batches instead of issuing 6 draw calls.
 */
function extractGroupSubGeometry(
  src: THREE.BufferGeometry,
  start: number,
  count: number
): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const srcIndex = src.getIndex();

  if (srcIndex) {
    const idxArr = srcIndex.array;
    const end = Math.min(idxArr.length, start + count);
    const remap = new Map<number, number>();
    const newIndices: number[] = [];
    const usedVerts: number[] = [];

    for (let i = start; i < end; i++) {
      const oldV = idxArr[i];
      let newV = remap.get(oldV);
      if (newV === undefined) {
        newV = usedVerts.length;
        remap.set(oldV, newV);
        usedVerts.push(oldV);
      }
      newIndices.push(newV);
    }

    for (const [name, attr] of Object.entries(src.attributes)) {
      if (!(attr instanceof THREE.BufferAttribute)) continue;
      const itemSize = attr.itemSize;
      const data = new Float32Array(usedVerts.length * itemSize);
      const srcArr = attr.array;
      for (let vi = 0; vi < usedVerts.length; vi++) {
        const oldBase = usedVerts[vi] * itemSize;
        const newBase = vi * itemSize;
        for (let k = 0; k < itemSize; k++) {
          data[newBase + k] = srcArr[oldBase + k];
        }
      }
      out.setAttribute(name, new THREE.BufferAttribute(data, itemSize, attr.normalized));
    }
    out.setIndex(newIndices);
  } else {
    const end = Math.min(src.attributes.position.count, start + count);
    const sliceLen = Math.max(0, end - start);
    for (const [name, attr] of Object.entries(src.attributes)) {
      if (!(attr instanceof THREE.BufferAttribute)) continue;
      const itemSize = attr.itemSize;
      const data = new Float32Array(sliceLen * itemSize);
      const srcArr = attr.array;
      const base = start * itemSize;
      for (let i = 0; i < data.length; i++) {
        data[i] = srcArr[base + i];
      }
      out.setAttribute(name, new THREE.BufferAttribute(data, itemSize, attr.normalized));
    }
  }

  return out;
}

/**
 * Merges static THREE.Mesh descendants of `targetRoot` (including splitting multi-material
 * boxes by `geometry.groups`) into batched BufferGeometries grouped by material + render
 * state + Print/Reflection metadata. Preserves exact world transforms, shadows, Print Mode
 * edges, and interactive vehicle tags while dramatically slashing WebGL draw calls.
 */
export function mergeStaticGroupByMaterial(
  targetRoot: THREE.Object3D,
  opts: MergeStaticOptions = {}
): void {
  const excludeSet = new Set<THREE.Object3D>(opts.excludeRoots ?? []);
  targetRoot.updateMatrixWorld(true);

  const rootWorldInv = new THREE.Matrix4().copy(targetRoot.matrixWorld).invert();
  const relMatrix = new THREE.Matrix4();

  interface BucketEntry {
    srcMesh: THREE.Mesh;
    geom: THREE.BufferGeometry;
    ownedGeom: boolean;
    matrix: THREE.Matrix4;
  }

  interface Bucket {
    material: THREE.Material;
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    skipPrintEdges: boolean;
    printBotanical: string | undefined;
    skipReflection: boolean;
    vehicleTag: 'tram' | 'minibus' | 'taxi' | undefined;
    entries: BucketEntry[];
    hasMultiMaterialSource: boolean;
  }

  const buckets = new Map<string, Bucket>();
  const geomUseCounts = new Map<THREE.BufferGeometry, number>();

  targetRoot.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.geometry) {
      geomUseCounts.set(obj.geometry, (geomUseCounts.get(obj.geometry) ?? 0) + 1);
    }
  });

  const candidates: THREE.Mesh[] = [];
  targetRoot.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj instanceof THREE.InstancedMesh) return;
    if (!obj.geometry) return;
    if (RESERVED_NAMES.has(obj.name)) return;
    if (obj.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    if (excludeSet.size > 0 && isDescendantOfAny(obj, excludeSet)) return;
    candidates.push(obj);
  });

  const addEntry = (
    mesh: THREE.Mesh,
    mat: THREE.Material,
    geom: THREE.BufferGeometry,
    ownedGeom: boolean,
    matCopy: THREE.Matrix4,
    fromMultiMat: boolean
  ) => {
    const attrSig = Object.keys(geom.attributes).sort().join(',');
    const skipPrintEdges = getEffectiveFlag(mesh, targetRoot, 'skipPrintEdges') === true;
    const printBotanical = getEffectiveFlag(mesh, targetRoot, 'printBotanical') as
      | string
      | undefined;
    const explicitSkipRefl = getEffectiveFlag(mesh, targetRoot, 'skipReflection') === true;
    const skipReflection =
      explicitSkipRefl || (Boolean(opts.skipTinyInReflection) && skipPrintEdges);
    const vehicleTag = mesh.userData.isTram
      ? 'tram'
      : mesh.userData.isMinibus
      ? 'minibus'
      : mesh.userData.isTaxi
      ? 'taxi'
      : undefined;

    const key = [
      mat.uuid,
      attrSig,
      mesh.castShadow ? '1' : '0',
      mesh.receiveShadow ? '1' : '0',
      mesh.renderOrder,
      skipPrintEdges ? '1' : '0',
      printBotanical ?? '',
      skipReflection ? '1' : '0',
      vehicleTag ?? ''
    ].join('|');

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: mat,
        castShadow: mesh.castShadow,
        receiveShadow: mesh.receiveShadow,
        renderOrder: mesh.renderOrder,
        skipPrintEdges,
        printBotanical,
        skipReflection,
        vehicleTag,
        entries: [],
        hasMultiMaterialSource: false
      };
      buckets.set(key, bucket);
    }
    if (fromMultiMat) {
      bucket.hasMultiMaterialSource = true;
    }
    bucket.entries.push({ srcMesh: mesh, geom, ownedGeom, matrix: matCopy });
  };

  for (const mesh of candidates) {
    relMatrix.multiplyMatrices(rootWorldInv, mesh.matrixWorld);
    if (relMatrix.determinant() <= 1e-8) continue;

    const matCopy = relMatrix.clone();
    if (Array.isArray(mesh.material)) {
      const groups = mesh.geometry.groups;
      if (!groups || groups.length === 0) continue;
      for (const grp of groups) {
        const m = mesh.material[grp.materialIndex ?? 0];
        if (!m || grp.count <= 0) continue;
        const subGeom = extractGroupSubGeometry(mesh.geometry, grp.start, grp.count);
        addEntry(mesh, m, subGeom, true, matCopy, true);
      }
    } else {
      addEntry(mesh, mesh.material, mesh.geometry, false, matCopy, false);
    }
  }

  const removedMeshes = new Set<THREE.Mesh>();
  let batchIdx = 0;

  for (const bucket of buckets.values()) {
    // Keep standalone single-material singletons untouched (still stamp skipReflection if micro-detail!)
    if (bucket.entries.length === 1 && !bucket.hasMultiMaterialSource) {
      const only = bucket.entries[0];
      if (bucket.skipReflection) {
        only.srcMesh.userData.skipReflection = true;
      }
      if (only.ownedGeom) only.geom.dispose();
      continue;
    }

    const allIndexed = bucket.entries.every((e) => e.geom.index !== null);
    const transformed: THREE.BufferGeometry[] = [];
    for (let i = 0; i < bucket.entries.length; i++) {
      const entry = bucket.entries[i];
      const g =
        allIndexed || entry.geom.index === null
          ? entry.ownedGeom
            ? entry.geom
            : entry.geom.clone()
          : entry.geom.toNonIndexed();
      if (entry.ownedGeom && g !== entry.geom) {
        entry.geom.dispose();
      }
      g.applyMatrix4(entry.matrix);
      transformed.push(g);
    }

    const merged = transformed.length === 1 ? transformed[0] : mergeGeometries(transformed, false);
    if (transformed.length > 1) {
      for (const g of transformed) g.dispose();
    }
    if (!merged) continue;

    merged.computeBoundingSphere();
    merged.computeBoundingBox();

    const mergedMesh = new THREE.Mesh(merged, bucket.material);
    mergedMesh.name = `${opts.namePrefix ?? targetRoot.name ?? 'StaticBatch'}_${batchIdx++}`;
    mergedMesh.castShadow = bucket.castShadow;
    mergedMesh.receiveShadow = bucket.receiveShadow;
    mergedMesh.renderOrder = bucket.renderOrder;
    mergedMesh.matrixAutoUpdate = false;
    mergedMesh.updateMatrix();

    if (bucket.skipPrintEdges) mergedMesh.userData.skipPrintEdges = true;
    if (bucket.printBotanical) mergedMesh.userData.printBotanical = bucket.printBotanical;
    if (bucket.skipReflection) mergedMesh.userData.skipReflection = true;
    if (bucket.vehicleTag === 'tram') mergedMesh.userData.isTram = true;
    if (bucket.vehicleTag === 'minibus') mergedMesh.userData.isMinibus = true;
    if (bucket.vehicleTag === 'taxi') mergedMesh.userData.isTaxi = true;

    for (const entry of bucket.entries) {
      removedMeshes.add(entry.srcMesh);
    }

    targetRoot.add(mergedMesh);
  }

  for (const src of removedMeshes) {
    src.parent?.remove(src);
    const rem = (geomUseCounts.get(src.geometry) ?? 1) - 1;
    geomUseCounts.set(src.geometry, rem);
    if (rem <= 0) {
      src.geometry.dispose();
    }
  }

  // Prune now-empty intermediate static groups (keeping excluded roots and named top-level anchors)
  const pruneEmpty = (node: THREE.Object3D) => {
    for (let i = node.children.length - 1; i >= 0; i--) {
      const ch = node.children[i];
      if (excludeSet.has(ch)) continue;
      if (ch.type === 'Group' && ch.children.length > 0) {
        pruneEmpty(ch);
      }
      if (ch.type === 'Group' && ch.children.length === 0 && !ch.name) {
        node.remove(ch);
      }
    }
  };
  pruneEmpty(targetRoot);
}

/**
 * Freezes local matrices on static Object3D subtrees (skipping excluded animated roots)
 * so Three.js does not recompute unchanged transforms every frame.
 */
export function freezeStaticTransforms(
  root: THREE.Object3D,
  excludeRoots: Iterable<THREE.Object3D> = []
): void {
  const excludeSet = new Set<THREE.Object3D>(excludeRoots);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (obj === root) return;
    if (excludeSet.size > 0 && isDescendantOfAny(obj, excludeSet)) return;
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
  });
}
