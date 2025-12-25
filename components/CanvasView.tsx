import React, { useRef, useEffect, useState } from 'react';
import { AppState, CubeGeometry, ProjectedPoint } from '../types';
import { Vector3, Euler, Quaternion } from 'three';
import { projectPoint, getProjectedInfiniteLine, sampleProjectedLine } from '../utils/math';
import { COLOR_STL } from '../constants';

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

      const sensitivity = 0.005;

      setState(prev => {
        const newRot = prev.cameraRotation.clone();
        // Horizontal drag maps to Z rotation (Yaw/Roll)
        // Vertical drag maps to X rotation (Pitch)
        newRot.z -= dx * sensitivity;
        newRot.x -= dy * sensitivity;
        return { ...prev, cameraRotation: newRot };
      });
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

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const selCenterX = x1 + w / 2;
      const selCenterY = y1 + h / 2;
      const zoomMultiplier = Math.min(canvas.width / w, canvas.height / h);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animationFrameId: number;

    const render = (isExporting = false) => {
      if (!isExporting && (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight)) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const { width, height } = canvas;
      const { cameraRotation, showGrid, gridAngle, geometries, renderDetail, viewSettings, isDarkMode } = state;

      const adaptiveFactor = Math.min(10, Math.sqrt(viewSettings.zoom));
      const gridStep = 4 / (renderDetail * adaptiveFactor);
      const edgeSteps = Math.round(10 * renderDetail * adaptiveFactor);
      const infiniteSteps = Math.round(50 * renderDetail * adaptiveFactor);

      if (isExporting) {
        ctx.clearRect(0, 0, width, height);
      } else {
        ctx.fillStyle = isDarkMode ? '#0f172a' : '#f8fafc';
        ctx.fillRect(0, 0, width, height);
      }

      const scale = (Math.min(width, height) / 2 - 30) * viewSettings.zoom;
      const centerX = width / 2 + viewSettings.offsetX;
      const centerY = height / 2 + viewSettings.offsetY;

      const gridColorV = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.4)';
      const gridColorH = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(220, 38, 38, 0.4)';
      const axisColorV = isDarkMode ? '#10b981' : '#059669';
      const axisColorH = isDarkMode ? '#ef4444' : '#dc2626';
      const labelColor = isDarkMode ? '#3b82f6' : '#2563eb';
      const boundaryColor = isDarkMode ? '#334155' : '#cbd5e1';

      ctx.save();

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

      const drawPolyline = (points: ProjectedPoint[], color: string, width: number = 1, dash: number[] = []) => {
        if (points.length < 2) return;
        ctx.beginPath();
        let first = true;
        for (const p of points) {
          if (!p.visible) { first = true; continue; }
          if (first) { ctx.moveTo(p.x, p.y); first = false; }
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      const drawText = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = "center", weight: string = "normal") => {
        ctx.fillStyle = color;
        ctx.font = `${weight} ${Math.max(8, 10 * Math.sqrt(viewSettings.zoom))}px monospace`;
        ctx.textAlign = align;
        ctx.fillText(text, x, y);
      };

      // --- Grid Rendering ---
      if (showGrid) {
        // Vertical Arcs (Longitude/Azimuth) - Green
        for (let i = 180 % gridAngle; i < 360; i += gridAngle) {
          const theta = (i - 180) * (Math.PI / 180);
          const pts: ProjectedPoint[] = [];
          for (let alpha = 0; alpha <= 360; alpha += gridStep) {
            const a = alpha * (Math.PI / 180);
            const p = new Vector3(-Math.sin(theta) * Math.cos(a), Math.cos(theta) * Math.cos(a), Math.sin(a));
            pts.push(projectPoint(p, cameraRotation, width, height, viewSettings));
          }
          const groups = filterJumps(pts, width * viewSettings.zoom);
          const isAxis = Math.abs(i - 180) < 0.1;
          groups.forEach(g => drawPolyline(g, isAxis ? axisColorV : gridColorV, isAxis ? 2 : 1));

          // Labels for Green Arcs
          // Always show labels for the specified subdivision
          // Sample at alpha=0 (Equator relative to grid construction)
          const labelPos = new Vector3(-Math.sin(theta), Math.cos(theta), 0);
          const lp = projectPoint(labelPos, cameraRotation, width, height, viewSettings);
          // Only draw if within bounds and not too far zoomed out
          if (lp.visible) {
            drawText(`${i - 180}°`, lp.x, lp.y, axisColorV, "center", isAxis ? "bold" : "normal");
          }
        }

        // Horizontal Arcs (Latitude/Elevation) - Red
        for (let i = 180 % gridAngle; i < 360; i += gridAngle) {
          const phi = (i - 180) * (Math.PI / 180);
          const pts: ProjectedPoint[] = [];
          for (let alpha = 0; alpha <= 360; alpha += gridStep) {
            const a = alpha * (Math.PI / 180);
            const p = new Vector3(Math.sin(a), Math.cos(a) * Math.cos(phi), Math.cos(a) * Math.sin(phi));
            pts.push(projectPoint(p, cameraRotation, width, height, viewSettings));
          }
          const groups = filterJumps(pts, width * viewSettings.zoom);
          const isAxis = Math.abs(i - 180) < 0.1;
          groups.forEach(g => drawPolyline(g, isAxis ? axisColorH : gridColorH, isAxis ? 2 : 1));

          // Labels for Red Arcs
          // Sample at alpha=0
          const labelPos = new Vector3(0, Math.cos(phi), Math.sin(phi));
          const lp = projectPoint(labelPos, cameraRotation, width, height, viewSettings);
          if (lp.visible) {
            drawText(`${i - 180}°`, lp.x, lp.y, axisColorH, "center", isAxis ? "bold" : "normal");
          }
        }
      }

      // --- Geometry Rendering ---
      geometries.forEach(geo => {
        if (!geo.visible || geo.type !== 'cube') return;
        const c = geo as CubeGeometry;
        const q = new Quaternion().setFromEuler(c.rotation);
        const h = c.size.clone().multiplyScalar(0.5);

        const cornersLocal = [
          new Vector3(-h.x, -h.y, -h.z), new Vector3(h.x, -h.y, -h.z),
          new Vector3(h.x, -h.y, h.z), new Vector3(-h.x, -h.y, h.z),
          new Vector3(-h.x, h.y, -h.z), new Vector3(h.x, h.y, -h.z),
          new Vector3(h.x, h.y, h.z), new Vector3(-h.x, h.y, h.z)
        ];
        const cornersWorld = cornersLocal.map(v => v.applyQuaternion(q).add(c.center));
        const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

        // Infinite perspective lines (Spiderweb)
        if (c.showEdgeGuides) {
          const axisX = new Vector3(1, 0, 0).applyQuaternion(q).normalize();
          const axisY = new Vector3(0, 1, 0).applyQuaternion(q).normalize();
          const axisZ = new Vector3(0, 0, 1).applyQuaternion(q).normalize();

          // Trace infinite lines for all edges of the cube
          // For X-direction edges
          [0, 3, 4, 7].forEach(idx => {
            const linePts = getProjectedInfiniteLine(cornersWorld[idx], axisX, cameraRotation, width, height, infiniteSteps, viewSettings);
            filterJumps(linePts, width * viewSettings.zoom).forEach(g => drawPolyline(g, c.color, 0.4, [3, 6]));
          });
          // For Y-direction edges
          [0, 1, 2, 3].forEach(idx => {
            const linePts = getProjectedInfiniteLine(cornersWorld[idx], axisY, cameraRotation, width, height, infiniteSteps, viewSettings);
            filterJumps(linePts, width * viewSettings.zoom).forEach(g => drawPolyline(g, c.color, 0.4, [3, 6]));
          });
          // For Z-direction edges
          [0, 1, 4, 5].forEach(idx => {
            const linePts = getProjectedInfiniteLine(cornersWorld[idx], axisZ, cameraRotation, width, height, infiniteSteps, viewSettings);
            filterJumps(linePts, width * viewSettings.zoom).forEach(g => drawPolyline(g, c.color, 0.4, [3, 6]));
          });
        }

        // Cube Edges
        edges.forEach(([s, e]) => {
          const pts = sampleProjectedLine(cornersWorld[s], cornersWorld[e], cameraRotation, width, height, edgeSteps, viewSettings);
          filterJumps(pts, width * viewSettings.zoom).forEach(g => drawPolyline(g, c.color, 2));
        });
      });

      ctx.restore();

      // --- Static Outer Rim Degree Indicators ---
      if (showGrid) {
        for (let i = 0; i < 360; i += gridAngle) {
          const angleRad = (i - 90) * (Math.PI / 180);
          const tr = scale + 20;
          const lx = centerX + tr * Math.cos(angleRad);
          const ly = centerY + tr * Math.sin(angleRad);
          drawText(`${i}°`, lx, ly, labelColor, "center", "bold");
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

      if (!isExporting) {
        animationFrameId = requestAnimationFrame(() => render(false));
      }
    };

    (window as any).renderForExport = () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      render(true);
      const data = canvas.toDataURL("image/png");
      render(false);
      return data;
    };

    render(false);
    return () => cancelAnimationFrame(animationFrameId);
  }, [state, isSelecting, selectionStart, selectionEnd, isRotating]);

  return (
    <div ref={containerRef} className={`absolute left-96 inset-0 z-0 overflow-hidden ${state.isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`block w-full h-full transition-all ${state.selectionMode ? 'cursor-crosshair' :
          isRotating ? 'cursor-grabbing' : 'cursor-grab'
          }`}
      />
    </div>
  );
};

function filterJumps(points: ProjectedPoint[], threshold: number): ProjectedPoint[][] {
  const groups: ProjectedPoint[][] = [];
  let currentGroup: ProjectedPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p.visible) {
      if (currentGroup.length > 0) { groups.push(currentGroup); currentGroup = []; }
      continue;
    }
    if (currentGroup.length > 0) {
      const prev = currentGroup[currentGroup.length - 1];
      // If the distance between consecutive points is too large, it's likely a wrap-around singularity jump
      if (Math.hypot(p.x - prev.x, p.y - prev.y) > threshold / 3) {
        groups.push(currentGroup); currentGroup = [];
      }
    }
    currentGroup.push(p);
  }
  if (currentGroup.length > 0) groups.push(currentGroup);
  return groups;
}
