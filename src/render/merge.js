// Phones choke on draw calls, and every piece of furniture here is a few
// boxes plus an ink outline each. This bakes everything that never moves
// into one mesh per material: hundreds of draw calls become a couple dozen.
// Anything under an object with userData.dynamic = true is left alone.
import * as THREE from 'three';

function isDynamic(o, root) {
  for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return true;
  return false;
}

function mergeGeometries(geos, withUv) {
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  const uv = withUv ? new Float32Array(count * 2) : null;
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

// Can this mesh (and everything under it) be baked?
function bakeable(o, root) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || isDynamic(o, root)) return false;
  if (Array.isArray(o.material) || o.material.transparent) return false;
  const g = o.geometry;
  if (!g.attributes.position || !g.attributes.normal) return false;
  if (o.material.map && !g.attributes.uv) return false;
  return o.children.every((c) => bakeable(c, root));
}

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();      // material -> { geos, cast, receive }
  const taken = [];
  const visit = (o) => {
    if (o.isMesh && bakeable(o, root)) {
      o.traverse((m) => {
        const withUv = !!m.material.map;
        let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) {
          if (name !== 'position' && name !== 'normal' && !(withUv && name === 'uv')) g.deleteAttribute(name);
        }
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld));
        let b = buckets.get(m.material);
        if (!b) buckets.set(m.material, (b = { geos: [], cast: false, receive: false, withUv }));
        b.geos.push(g);
        b.cast ||= m.castShadow; b.receive ||= m.receiveShadow;
      });
      taken.push(o);
      return;                     // its children went in with it
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);
  for (const o of taken) o.parent.remove(o);
  for (const [mat, b] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(b.geos, b.withUv), mat);
    m.castShadow = b.cast; m.receiveShadow = b.receive;
    m.userData.merged = true;
    root.add(m);
  }
  return { meshes: taken.length, buckets: buckets.size };
}
