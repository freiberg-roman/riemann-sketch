import React, { useEffect, useRef, useState } from 'react';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { AppState, Geometry, SetState } from '../types';
import { DEG, wrapDeg } from '../utils/scene';
import { WasmCore, wasmReady, getWasm, readOut } from '../utils/wasmCore';

const PAD = 30;
const TAU = Math.PI * 2;
const hexRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

/** Rotation * scale matrix (row-major 3x3) for a geometry's local -> world transform. */
const modelMatrix = (g: Geometry) => {
  const e = new Matrix4().makeRotationFromEuler(new Euler(...g.rotation.map(a => a * DEG) as [number, number, number])).elements;
  return [0, 1, 2].flatMap(r => [0, 1, 2].map(c => e[c * 4 + r] * g.size[c]));
};

interface Props { state: AppState; setState: SetState; exportRef: React.MutableRefObject<() => string | null> }

export const CanvasView: React.FC<Props> = ({ state, setState, exportRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wasm, setWasm] = useState<WasmCore | null>(getWasm());
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  const [sel, setSel] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const renderRef = useRef<(transparent: boolean) => void>(() => { });

  useEffect(() => { if (!wasm) wasmReady.then(setWasm); }, []);

  useEffect(() => {
    const c = canvasRef.current!;
    const update = () => setSize({ w: c.clientWidth, h: c.clientHeight, dpr: Math.min(2, devicePixelRatio || 1) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(c);
    // Wheel zoom must be non-passive to prevent page scroll
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro.disconnect(); c.removeEventListener('wheel', onWheel); };
  }, []);

  // Zoom by factor f keeping screen point (px, py) fixed
  const zoomAt = (px: number, py: number, f: number, dx = 0, dy = 0) => setState(p => {
    const c = canvasRef.current!, w2 = c.clientWidth / 2, h2 = c.clientHeight / 2;
    const zoom = Math.min(500, Math.max(0.3, p.view.zoom * f));
    f = zoom / p.view.zoom;
    return {
      ...p, view: {
        zoom,
        offsetX: px + (w2 + p.view.offsetX - px) * f - w2 + dx,
        offsetY: py + (h2 + p.view.offsetY - py) * f - h2 + dy,
      }
    };
  });

  const local = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    canvasRef.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (state.selectionMode && pointers.current.size === 1) setSel({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const ps = pointers.current, prev = ps.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    if (ps.size === 2) {
      const [a, b] = [...ps.values()];
      const other = a === prev ? b : a;
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(p.x - other.x, p.y - other.y);
      zoomAt((p.x + other.x) / 2, (p.y + other.y) / 2, d0 > 0 ? d1 / d0 : 1, (p.x - prev.x) / 2, (p.y - prev.y) / 2);
    } else if (sel) {
      setSel(s => s && { ...s, x1: p.x, y1: p.y });
    } else if (ps.size === 1) {
      const k = 0.005 / DEG / Math.sqrt(state.view.zoom);
      setState(s => ({ ...s, camera: [wrapDeg(s.camera[0] - (p.y - prev.y) * k), s.camera[1], wrapDeg(s.camera[2] - (p.x - prev.x) * k)] }));
    }
    ps.set(e.pointerId, p);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (!sel) return;
    setSel(null);
    const w = Math.abs(sel.x1 - sel.x0), h = Math.abs(sel.y1 - sel.y0);
    if (w < 10 || h < 10) return;
    const c = canvasRef.current!, f = Math.min(c.clientWidth / w, c.clientHeight / h);
    setState(p => ({
      ...p, selectionMode: false, view: {
        zoom: p.view.zoom * f,
        offsetX: -((sel.x0 + sel.x1) / 2 - c.clientWidth / 2 - p.view.offsetX) * f,
        offsetY: -((sel.y0 + sel.y1) / 2 - c.clientHeight / 2 - p.view.offsetY) * f,
      }
    }));
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const render = (transparent: boolean) => {
      const ctx = canvas.getContext('2d');
      const { w: width, h: height, dpr } = size;
      if (!ctx || !wasm || !width || !height) return;
      const pw = Math.round(width * dpr), ph = Math.round(height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { camera, showGrid, gridAngle, geometries, detail, view, dark } = state;
      const adaptive = Math.min(10, Math.sqrt(view.zoom));
      const edgeSteps = Math.max(1, Math.round(10 * detail * adaptive));
      const gridDt = Math.max(1e-7, (4 / (detail * adaptive)) * DEG);
      const infDt = Math.PI / Math.max(1, Math.round(50 * detail * adaptive));

      ctx.clearRect(0, 0, width, height);
      if (!transparent) { ctx.fillStyle = dark ? '#0f172a' : '#f8fafc'; ctx.fillRect(0, 0, width, height); }

      const s = (Math.min(width, height) / 2 - PAD) * view.zoom;
      const cx = width / 2 + view.offsetX, cy = height / 2 + view.offsetY;
      // World -> camera = R^T; rows of R^T are the columns of R (column-major elements)
      const e = new Matrix4().makeRotationFromEuler(new Euler(camera[0] * DEG, camera[1] * DEG, camera[2] * DEG)).elements;
      const jump = (width * view.zoom) / 3;
      wasm.set_view(e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10], s, cx, cy, jump, 0.25 / dpr,
        Math.max(0, cx - s) - 4, Math.max(0, cy - s) - 4, Math.min(width, cx + s) + 4, Math.min(height, cy + s) + 4);

      // Stereographic projection (camera looks along +Y, Z up); null if at the antipode
      const project = (x: number, y: number, z: number): [number, number] | null => {
        const X = e[0] * x + e[1] * y + e[2] * z, Y = e[4] * x + e[5] * y + e[6] * z, Z = e[8] * x + e[9] * y + e[10] * z;
        const r = Math.hypot(X, Y, Z);
        if (r < 1e-5) return [cx, cy];
        if (Y / r < -0.999) return null;
        return [cx + (X / (r + Y)) * s, cy - (Z / (r + Y)) * s];
      };
      const circle = (a: number[], b: number[], dt: number, t0 = 0, t1 = TAU, base = 64) =>
        wasm.curve(0, a[0], a[1], a[2], b[0], b[1], b[2], t0, t1, base, dt);
      const stroke = (color: string, lw: number, dash: number[] = []) => {
        const buf = readOut(wasm);
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i < buf.length; i += 2) {
          if (buf[i] !== buf[i]) { pen = false; continue; }
          pen ? ctx.lineTo(buf[i], buf[i + 1]) : ctx.moveTo(buf[i], buf[i + 1]);
          pen = true;
        }
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);
        wasm.reset();
      };

      const col = dark
        ? { v: '#10b981', h: '#ef4444', c: '#3b82f6', a: 0.2, rim: '#334155' }
        : { v: '#059669', h: '#dc2626', c: '#2563eb', a: 0.4, rim: '#cbd5e1' };
      const fontSize = Math.max(8, 10 * Math.sqrt(view.zoom));
      ctx.lineJoin = 'round';
      ctx.textAlign = 'center';

      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, TAU);
      ctx.strokeStyle = col.rim; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.clip();

      // --- Grid: longitude (green), latitude (red), central (blue) great circles ---
      const labels: [string, number, number, string, boolean][] = [];
      if (showGrid) {
        const angles: number[] = [];
        for (let i = 180 % gridAngle; i < 360; i += gridAngle) angles.push((i - 180) * DEG);
        const families: [string, (t: number) => number[], number[], boolean][] = [
          [col.v, t => [-Math.sin(t), Math.cos(t), 0], [0, 0, 1], true],
          [col.h, t => [0, Math.cos(t), Math.sin(t)], [1, 0, 0], true],
          [col.c, t => [Math.cos(t), 0, Math.sin(t)], [0, 1, 0], false],
        ];
        ctx.globalAlpha = col.a;
        for (const [c, a, b] of families) { for (const t of angles) circle(a(t), b, gridDt); stroke(c, 1); }
        ctx.globalAlpha = 1;
        for (const [c, a, b, axis] of families) if (axis) {
          circle(a(0), b, gridDt); stroke(c, 2);
          for (const t of angles) {
            const p = project(...(a(t) as [number, number, number]));
            if (p) labels.push([`${Math.round(t / DEG)}°`, p[0], p[1], c, Math.abs(t) < 1e-6]);
          }
        }
      }

      // --- Geometry ---
      for (const g of geometries) {
        if (!g.visible) continue;
        const m = modelMatrix(g), [ox, oy, oz] = g.center;
        const world = (x: number, y: number, z: number) => [
          m[0] * x + m[1] * y + m[2] * z + ox, m[3] * x + m[4] * y + m[5] * z + oy, m[6] * x + m[7] * y + m[8] * z + oz];

        if (g.kind === 'mesh' && g.mesh) {
          // Painter's algorithm: back-face cull, headlight shading, far-to-near fill
          const src = g.mesh, n = src.length / 9;
          const pts = new Float32Array(n * 6), depth = new Float32Array(n), shade = new Float32Array(n), order: number[] = [];
          tri: for (let t = 0; t < n; t++) {
            const [a, b, c] = [0, 3, 6].map(k => world(src[t * 9 + k], src[t * 9 + k + 1], src[t * 9 + k + 2]));
            const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
            const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
            const mx = (a[0] + b[0] + c[0]) / 3, my = (a[1] + b[1] + c[1]) / 3, mz = (a[2] + b[2] + c[2]) / 3;
            const dot = nx * mx + ny * my + nz * mz;
            if (dot >= 0) continue;
            for (let k = 0; k < 3; k++) {
              const p = project(...([a, b, c][k] as [number, number, number]));
              if (!p) continue tri;
              pts[t * 6 + k * 2] = p[0]; pts[t * 6 + k * 2 + 1] = p[1];
            }
            const d = Math.hypot(mx, my, mz);
            depth[t] = d;
            shade[t] = -dot / (Math.hypot(nx, ny, nz) * d || 1);
            order.push(t);
          }
          order.sort((a, b) => depth[b] - depth[a]);
          const rgb = hexRgb(g.color), line = `rgba(0,0,0,${dark ? 0.5 : 0.35})`;
          ctx.lineWidth = g.wireframe ? 0.6 : 0.5;
          for (const t of order) {
            const o = t * 6;
            if (Math.max(Math.abs(pts[o] - pts[o + 2]), Math.abs(pts[o] - pts[o + 4]), Math.abs(pts[o + 1] - pts[o + 3]), Math.abs(pts[o + 1] - pts[o + 5])) > jump) continue;
            const k = 0.25 + 0.75 * shade[t];
            const fill = `rgb(${rgb[0] * k | 0},${rgb[1] * k | 0},${rgb[2] * k | 0})`;
            ctx.beginPath();
            ctx.moveTo(pts[o], pts[o + 1]); ctx.lineTo(pts[o + 2], pts[o + 3]); ctx.lineTo(pts[o + 4], pts[o + 5]);
            ctx.closePath();
            ctx.fillStyle = fill; ctx.fill();
            ctx.strokeStyle = g.wireframe ? line : fill; ctx.stroke();
          }
          continue;
        }

        // Cube: corner i has local coords ±0.5 by bits (x=1, y=2, z=4)
        const corners = [...Array(8)].map((_, i) => world(i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5));
        if (g.guides) {
          // Line O + D t == great circle O cos(a) + D sin(a) (D scaled large); [-pi/2, pi/2] spans VP(-D) -> VP(D)
          const t1 = g.fullGuide ? 1.5 * Math.PI : 0.5 * Math.PI;
          for (const bit of [1, 2, 4]) {
            const ax = bit === 1 ? 0 : bit === 2 ? 1 : 2, len = 200 / g.size[ax];
            const d = [m[ax] * len, m[3 + ax] * len, m[6 + ax] * len];
            for (let i = 0; i < 8; i++) if (!(i & bit)) circle(corners[i], d, infDt, -0.5 * Math.PI, t1, g.fullGuide ? 32 : 16);
          }
          stroke(g.color, 0.4, [3, 6]);
        }
        for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) {
          const [a, b] = [corners[i], corners[i | bit]];
          wasm.curve(1, a[0], a[1], a[2], b[0] - a[0], b[1] - a[1], b[2] - a[2], 0, 1, Math.min(16, edgeSteps), 1 / edgeSteps);
        }
        stroke(g.color, 2);
      }

      for (const [t, x, y, c, bold] of labels) {
        ctx.font = `${bold ? 'bold' : 'normal'} ${fontSize}px monospace`;
        ctx.fillStyle = c;
        ctx.fillText(t, x, y);
      }
      ctx.restore();

      // --- Outer rim degree indicators ---
      if (showGrid) {
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillStyle = col.c;
        for (let i = 90 % gridAngle; i < 360; i += gridAngle) {
          const a = (i - 90) * DEG;
          ctx.fillText(`${i}°`, cx + (s + 20) * Math.cos(a), cy + (s + 20) * Math.sin(a) + 4);
        }
      }

      if (sel) {
        ctx.strokeStyle = '#f472b6'; ctx.fillStyle = 'rgba(244,114,182,0.1)';
        ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
        ctx.strokeRect(sel.x0, sel.y0, sel.x1 - sel.x0, sel.y1 - sel.y0);
        ctx.fillRect(sel.x0, sel.y0, sel.x1 - sel.x0, sel.y1 - sel.y0);
        ctx.setLineDash([]);
      }
    };
    renderRef.current = render;
    const id = requestAnimationFrame(() => render(false));
    return () => cancelAnimationFrame(id);
  }, [state, sel, wasm, size]);

  exportRef.current = () => {
    renderRef.current(true);
    const data = canvasRef.current?.toDataURL('image/png') ?? null;
    renderRef.current(false);
    return data;
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute inset-0 w-full h-full touch-none ${state.selectionMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
    />
  );
};
