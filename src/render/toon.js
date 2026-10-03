// The comic look: three-band toon shading and thick ink outlines.
import * as THREE from 'three';

const gradient = (() => {
  const data = new Uint8Array([40, 110, 190, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const cache = new Map();
export function toon(color, opts = {}) {
  const k = `${color}|${JSON.stringify(opts)}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...opts }));
  return cache.get(k);
}

export const INK = 0x14110f;
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

// Inverted-hull outline: a slightly fattened black copy drawn back faces only.
export function outlined(mesh, thickness = 0.025) {
  const hull = new THREE.Mesh(mesh.geometry, inkMat);
  const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
  const size = box.getSize(new THREE.Vector3());
  hull.scale.set(
    1 + (2 * thickness) / Math.max(size.x, 0.01),
    1 + (2 * thickness) / Math.max(size.y, 0.01),
    1 + (2 * thickness) / Math.max(size.z, 0.01),
  );
  // Keep the hull centred on the geometry's own centre.
  const c = box.getCenter(new THREE.Vector3());
  hull.position.copy(c).multiply(new THREE.Vector3(1 - hull.scale.x, 1 - hull.scale.y, 1 - hull.scale.z));
  hull.castShadow = false;
  hull.userData.isHull = true;
  mesh.add(hull);
  return mesh;
}

// A box with its outline, positioned by its bottom-centre.
export function inkBox(w, h, d, color, x = 0, y = 0, z = 0, thickness) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return outlined(m, thickness);
}

export function inkMesh(geometry, color, thickness) {
  const m = new THREE.Mesh(geometry, toon(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return outlined(m, thickness);
}

// Line segments in ink (used for wall edges).
export function inkLines(points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: INK }));
}

// Canvas texture helper.
export function canvasTexture(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}
