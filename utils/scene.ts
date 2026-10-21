import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Geometry } from '../types';

export const DEG = Math.PI / 180;
export const wrapDeg = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
export const uid = () => Math.random().toString(36).slice(2, 11);

/** Parses ASCII/binary STL into a triangle soup centered at the origin, longest side = 1. */
export function parseSTL(buf: ArrayBuffer): Float32Array {
  const src = new STLLoader().parse(buf).getAttribute('position').array as ArrayLike<number>;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < src.length; i++) {
    const k = i % 3;
    if (src[i] < min[k]) min[k] = src[i];
    if (src[i] > max[k]) max[k] = src[i];
  }
  const s = 1 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-9);
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = (src[i] - (min[i % 3] + max[i % 3]) / 2) * s;
  return out;
}

export const makeGeometry = (g: Partial<Geometry> & Pick<Geometry, 'kind' | 'name'>): Geometry => ({
  id: uid(), color: g.kind === 'cube' ? '#f472b6' : '#cbd5e1', visible: true, collapsed: true,
  center: [0, 4, 0], size: [2, 2, 2], rotation: [0, 0, 0],
  guides: true, fullGuide: false, wireframe: false, ...g,
});
