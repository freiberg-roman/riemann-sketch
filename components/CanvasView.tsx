import React, { useRef, useEffect, useState } from 'react';
import { AppState, CubeGeometry, ProjectedPoint } from '../types';
import { Vector3, Quaternion, Matrix4 } from 'three';
import { projectPoint } from '../utils/math';
import { VIEWPORT_PADDING, DEG2RAD } from '../constants';
import { WasmCore, wasmReady, getWasm, readOut } from '../utils/wasmCore';

interface CanvasViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ state, setState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selection State
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  // Navigation State
  const [isRotating, setIsRotating] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (state.selectionMode) {
      setIsSelecting(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
    } else {
      setIsRotating(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isSelecting) {
      setSelectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else if (isRotating) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      const pr = pendingRot.current;
      pr.dx += dx; pr.dy += dy;
      if (!pr.raf) pr.raf = requestAnimationFrame(flushRotation);
    }
  };

  const handleMouseUp = () => {
    if (isSelecting) {
      setIsSelecting(false);
      const x1 = Math.min(selectionStart.x, selectionEnd.x);
      const y1 = Math.min(selectionStart.y, selectionEnd.y);
      const w = Math.abs(selectionStart.x - selectionEnd.x);
      const h = Math.abs(selectionStart.y - selectionEnd.y);

      if (w < 10 || h < 10) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const centerX = canvas.clientWidth / 2;
      const centerY = canvas.clientHeight / 2;
      const selCenterX = x1 + w / 2;
      const selCenterY = y1 + h / 2;
      const zoomMultiplier = Math.min(canvas.clientWidth / w, canvas.clientHeight / h);

      setState(prev => {
        const newZoom = prev.viewSettings.zoom * zoomMultiplier;
        const curRelX = selCenterX - centerX - prev.viewSettings.offsetX;
        const curRelY = selCenterY - centerY - prev.viewSettings.offsetY;
        const newOffsetX = -curRelX * zoomMultiplier;
        const newOffsetY = -curRelY * zoomMultiplier;

        return {
          ...prev,
          selectionMode: false,
          viewSettings: {
            zoom: newZoom,
            offsetX: newOffsetX,
            offsetY: newOffsetY
          }
        };
      });
    }
    setIsRotating(false);
  };

  const handleMouseLeave = () => {
    setIsRotating(false);
    setIsSelecting(false);
  };

  // Coalesce rotation drags to at most one state update per frame
  const pendingRot = useRef({ dx: 0, dy: 0, raf: 0 });
  const flushRotation = () => {
    const pr = pendingRot.current;
    pr.raf = 0;
    const { dx, dy } = pr;
    pr.dx = 0; pr.dy = 0;
    if (dx === 0 && dy === 0) return;
    const sensitivity = 0.005;
    setState(prev => {
      const newRot = prev.cameraRotation.clone();
      newRot.z -= dx * sensitivity;
      newRot.x -= dy * sensitivity;
      return { ...prev, cameraRotation: newRot };
    });
  };

  const [wasm, setWasm] = useState<WasmCore | null>(getWasm());
  useEffect(() => { if (!wasm) wasmReady.then(setWasm); }, []);

  // Track container size (CSS px) without polling every frame
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setSize({ w: container.clientWidth, h: container.clientHeight, dpr: Math.min(2, window.devicePixelRatio || 1) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  const renderRef = useRef<(isExporting: boolean) => void>(() => { });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = (isExporting = false) => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !wasm || size.w === 0 || size.h === 0) return;

      const width = size.w, height = size.h, dpr = size.dpr;
      const pw = Math.round(width * dpr), ph = Math.round(height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { cameraRotation, showGrid, gridAngle, geometries, renderDetail, viewSettings, isDarkMode } = state;

      const adaptiveFactor = Math.min(10, Math.sqrt(viewSettings.zoom));
      const gridStep = 4 / (renderDetail * adaptiveFactor);
      const edgeSteps = Math.max(1, Math.round(10 * renderDetail * adaptiveFactor));
      const infiniteSteps = Math.max(1, Math.round(50 * renderDetail * adaptiveFactor));

      if (isExporting) {
        ctx.clearRect(0, 0, width, height);
      } else {
        ctx.fillStyle = isDarkMode ? '#0f172a' : '#f8fafc';
        ctx.fillRect(0, 0, width, height);
      }

      const scale = (Math.min(width, height) / 2 - VIEWPORT_PADDING) * viewSettings.zoom;
      const centerX = width / 2 + viewSettings.offsetX;
      const centerY = height / 2 + viewSettings.offsetY;

      // Inverse camera rotation as a 3x3 row-major matrix
      const e = new Matrix4().makeRotationFromEuler(cameraRotation).elements; // column-major R
      // R^T rows = R columns
      const margin = 4;
      wasm.set_view(
        e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10],
        scale, centerX, centerY, (width * viewSettings.zoom) / 3, 0.25 / dpr,
        Math.max(0, centerX - scale) - margin, Math.max(0, centerY - scale) - margin,
        Math.min(width, centerX + scale) + margin, Math.min(height, centerY + scale) + margin
      );
      const project = (x: number, y: number, z: number) =>
        projectPoint(new Vector3(x, y, z), cameraRotation, width, height, viewSettings);

      const TWO_PI = Math.PI * 2;
      const greatCircle = (a: number[], b: number[], minDt: number, t0 = 0, t1 = TWO_PI, base = 64) =>
        wasm.curve(0, a[0], a[1], a[2], b[0], b[1], b[2], t0, t1, base, minDt);
      const segment = (s: Vector3, en: Vector3, steps: number) =>
        wasm.curve(1, s.x, s.y, s.z, en.x - s.x, en.y - s.y, en.z - s.z, 0, 1, Math.min(16, steps), 1 / steps);

      // Stroke everything currently in the wasm buffer as a single path
      const strokeOut = (color: string, lw: number, dash: number[] = []) => {
        const buf = readOut(wasm);
        if (buf.length < 4) { wasm.reset(); return; }
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i < buf.length; i += 2) {
          const x = buf[i];
          if (x !== x) { pen = false; continue; }
          if (pen) ctx.lineTo(x, buf[i + 1]); else { ctx.moveTo(x, buf[i + 1]); pen = true; }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.setLineDash(dash);
        ctx.stroke();
        if (dash.length) ctx.setLineDash([]);
        wasm.reset();
      };

      const gridColorV = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.4)';
      const gridColorH = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(220, 38, 38, 0.4)';
      const gridColorC = isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.4)';
      const axisColorV = isDarkMode ? '#10b981' : '#059669';
      const axisColorH = isDarkMode ? '#ef4444' : '#dc2626';
      const labelColor = isDarkMode ? '#3b82f6' : '#2563eb';
      const boundaryColor = isDarkMode ? '#334155' : '#cbd5e1';

      ctx.save();
      ctx.lineJoin = 'round';

      // Outer Boundary
      ctx.beginPath();
      ctx.arc(centerX, centerY, scale, 0, Math.PI * 2);
      ctx.strokeStyle = boundaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, scale, 0, Math.PI * 2);
      ctx.clip();

      const fontSize = Math.max(8, 10 * Math.sqrt(viewSettings.zoom));
      const fontNormal = `normal ${fontSize}px monospace`;
      const fontBold = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      const labels: { t: string; x: number; y: number; c: string; b: boolean }[] = [];

      // --- Grid Rendering (batched per color) ---
      if (showGrid) {
        const gridDt = Math.max(1e-7, gridStep * DEG2RAD);
        const angles: number[] = [];
        for (let i = 180 % gridAngle; i < 360; i += gridAngle) angles.push(i);
        const isAxis = (i: number) => Math.abs(i - 180) < 0.1;

        // Vertical Arcs (Longitude) - Green
        for (const i of angles) if (!isAxis(i)) {
          const th = (i - 180) * DEG2RAD;
          greatCircle([-Math.sin(th), Math.cos(th), 0], [0, 0, 1], gridDt);
        }
        strokeOut(gridColorV, 1);
        for (const i of angles) if (isAxis(i)) greatCircle([0, 1, 0], [0, 0, 1], gridDt);
        strokeOut(axisColorV, 2);

        // Horizontal Arcs (Latitude) - Red
        for (const i of angles) if (!isAxis(i)) {
          const ph = (i - 180) * DEG2RAD;
          greatCircle([0, Math.cos(ph), Math.sin(ph)], [1, 0, 0], gridDt);
        }
        strokeOut(gridColorH, 1);
        for (const i of angles) if (isAxis(i)) greatCircle([0, 1, 0], [1, 0, 0], gridDt);
        strokeOut(axisColorH, 2);

        // Central Arcs - Blue
        for (const i of angles) {
          const ph = (i - 180) * DEG2RAD;
          greatCircle([Math.cos(ph), 0, Math.sin(ph)], [0, 1, 0], gridDt);
        }
        strokeOut(gridColorC, 1);

        for (const i of angles) {
          const th = (i - 180) * DEG2RAD;
          const lv = project(-Math.sin(th), Math.cos(th), 0);
          if (lv.visible) labels.push({ t: `${i - 180}°`, x: lv.x, y: lv.y, c: axisColorV, b: isAxis(i) });
          const lh = project(0, Math.cos(th), Math.sin(th));
          if (lh.visible) labels.push({ t: `${i - 180}°`, x: lh.x, y: lh.y, c: axisColorH, b: isAxis(i) });
        }
      }

      // --- Geometry Rendering ---
      const infDt = Math.PI / infiniteSteps;
      for (const geo of geometries) {
        if (!geo.visible || geo.type !== 'cube') continue;
        const c = geo as CubeGeometry;
        const q = new Quaternion().setFromEuler(c.rotation);
        const h = c.size.clone().multiplyScalar(0.5);

        const cornersWorld = [
          new Vector3(-h.x, -h.y, -h.z), new Vector3(h.x, -h.y, -h.z),
          new Vector3(h.x, -h.y, h.z), new Vector3(-h.x, -h.y, h.z),
          new Vector3(-h.x, h.y, -h.z), new Vector3(h.x, h.y, -h.z),
          new Vector3(h.x, h.y, h.z), new Vector3(-h.x, h.y, h.z)
        ].map(v => v.applyQuaternion(q).add(c.center));

        if (c.showEdgeGuides) {
          // Line O + D*t through the projection == great circle O cos(a) + D*200 sin(a);
          // a in [-pi/2, pi/2] is the half from VP(-D) to VP(D), [-pi/2, 3pi/2] the full circle.
          const t1 = c.showFullGuide ? 1.5 * Math.PI : 0.5 * Math.PI;
          const guide = (idxs: number[], axis: Vector3) => {
            const d = axis.applyQuaternion(q).normalize().multiplyScalar(200);
            for (const idx of idxs) {
              const o = cornersWorld[idx];
              greatCircle([o.x, o.y, o.z], [d.x, d.y, d.z], infDt, -0.5 * Math.PI, t1, c.showFullGuide ? 32 : 16);
            }
          };
          guide([0, 3, 4, 7], new Vector3(1, 0, 0));
          guide([0, 1, 2, 3], new Vector3(0, 1, 0));
          guide([0, 1, 4, 5], new Vector3(0, 0, 1));
          strokeOut(c.color, 0.4, [3, 6]);
        }

        for (const [s, en] of CUBE_EDGES) segment(cornersWorld[s], cornersWorld[en], edgeSteps);
        strokeOut(c.color, 2);
      }

      for (const l of labels) {
        ctx.font = l.b ? fontBold : fontNormal;
        ctx.fillStyle = l.c;
        ctx.fillText(l.t, l.x, l.y);
      }

      ctx.restore();

      // --- Static Outer Rim Degree Indicators ---
      if (showGrid) {
        ctx.font = fontBold;
        ctx.fillStyle = labelColor;
        for (let i = 90 % gridAngle; i < 360; i += gridAngle) {
          const angleRad = (i - 90) * DEG2RAD;
          const tr = scale + 20;
          ctx.fillText(`${i}°`, centerX + tr * Math.cos(angleRad), centerY + tr * Math.sin(angleRad));
        }
      }

      // --- Selection UI ---
      if (isSelecting) {
        ctx.strokeStyle = '#f472b6';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeRect(selectionStart.x, selectionStart.y, selectionEnd.x - selectionStart.x, selectionEnd.y - selectionStart.y);
        ctx.fillStyle = 'rgba(244, 114, 182, 0.1)';
        ctx.fillRect(selectionStart.x, selectionStart.y, selectionEnd.x - selectionStart.x, selectionEnd.y - selectionStart.y);
        ctx.setLineDash([]);
      }
      ctx.restore();
    };
    renderRef.current = render;

    // Draw once per change, synchronized to the next frame
    const id = requestAnimationFrame(() => render(false));
    return () => cancelAnimationFrame(id);
  }, [state, isSelecting, selectionStart, selectionEnd, wasm, size]);

  useEffect(() => {
    (window as any).renderForExport = () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      renderRef.current(true);
      const data = canvas.toDataURL("image/png");
      renderRef.current(false);
      return data;
    };
  }, []);

  return (
    <div ref={containerRef} className={`absolute left-96 inset-0 z-0 overflow-hidden ${state.isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`block w-full h-full ${state.selectionMode ? 'cursor-crosshair' :
          isRotating ? 'cursor-grabbing' : 'cursor-grab'
          }`}
      />
    </div>
  );
};

const CUBE_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
