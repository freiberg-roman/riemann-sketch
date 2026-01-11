import React, { useRef, useState } from 'react';
import { AppState, GeometryType, CubeGeometry } from '../types';
import { Vector3, Euler } from 'three';
import {
  Plus, Box, Rotate3D, Eye, Trash2, Maximize, Activity, ChevronDown, ChevronRight,
  Crop, RefreshCw, Moon, Sun, Image, Move, Settings
} from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';

interface SidebarProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, setState }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const updateCamRotation = (axis: 'x' | 'y' | 'z', value: number) => {
    const newRot = state.cameraRotation.clone();
    newRot[axis] = value * (Math.PI / 180);
    setState(prev => ({ ...prev, cameraRotation: newRot }));
  };

  const resetView = () => {
    setState(prev => ({
      ...prev,
      viewSettings: { zoom: 1, offsetX: 0, offsetY: 0 },
      selectionMode: false
    }));
  };

  const exportToTransparentPNG = () => {
    const imgData = (window as any).renderForExport?.();
    if (!imgData) return;
    const link = document.createElement('a');
    link.download = 'riemann_sketch_transparent.png';
    link.href = imgData;
    link.click();
  };

  const addGeometry = (type: GeometryType) => {
    const id = Math.random().toString(36).substr(2, 9);
    if (type === 'cube') {
      const count = state.geometries.filter(g => g.type === 'cube').length + 1;
      setState(prev => ({
        ...prev,
        geometries: [
          ...prev.geometries,
          {
            id,
            name: `Cube ${count}`,
            collapsed: false,
            type: 'cube',
            center: new Vector3(0, 0, 0),
            size: new Vector3(2, 2, 2),
            rotation: new Euler(0, 0, 0),
            color: state.isDarkMode ? '#f472b6' : '#db2777',
            visible: true,
            showEdgeGuides: true,
            showCenterGuides: true,
            showFullGuide: false
          }
        ]
      }));
    }
  };

  const updateGeometry = (id: string, updates: any) => {
    setState(prev => ({
      ...prev,
      geometries: prev.geometries.map(g => g.id === id ? { ...g, ...updates } : g)
    }));
  };

  const sidebarClass = state.isDarkMode
    ? "bg-slate-900/95 border-slate-700 text-slate-100 shadow-2xl"
    : "bg-white/95 border-slate-200 text-slate-900 shadow-xl";

  const buttonClass = state.isDarkMode
    ? "bg-slate-800 hover:bg-slate-700 text-cyan-400"
    : "bg-slate-100 hover:bg-slate-200 text-cyan-600";

  const inputClass = `border rounded px-1 py-0.5 text-[10px] text-right focus:outline-none transition-colors ${state.isDarkMode
    ? 'bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500'
    : 'bg-white border-slate-300 text-slate-800 focus:border-cyan-600'
    }`;

  return (
    <div className={`absolute top-0 left-0 h-full w-96 border-r p-6 flex flex-col gap-6 overflow-y-auto text-sm z-10 custom-scrollbar backdrop-blur-md transition-colors ${sidebarClass}`}>

      {/* Header & Theme & Scene Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Riemann<span className="text-cyan-500">Sketch</span></h1>
          <p className={`text-[10px] mt-1 uppercase tracking-widest font-bold ${state.isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {state.viewSettings.zoom > 1.1 ? `ROI Active (${state.viewSettings.zoom.toFixed(1)}x)` : 'Full Sphere View'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setState(p => ({ ...p, isDarkMode: !p.isDarkMode }))}
            className={`p-2 rounded transition-colors ${buttonClass}`}
            title="Toggle Theme"
          >
            {state.isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`p-2 rounded transition-colors ${buttonClass}`}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <SettingsPanel state={state} setState={setState} onClose={() => setIsSettingsOpen(false)} />
      )}

      {/* Advanced Tools */}
      <div className={`flex flex-col gap-2 p-1 rounded-lg border ${state.isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex gap-2">
          <button
            onClick={() => setState(p => ({ ...p, selectionMode: !p.selectionMode }))}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded transition-all font-bold text-xs ${state.selectionMode ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/20' : state.isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 hover:text-slate-700 border border-slate-200'}`}
          >
            <Crop size={14} /> ROI Select
          </button>
          <button
            onClick={resetView}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded transition-colors font-bold text-xs ${state.isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 hover:text-slate-700 border border-slate-200'}`}
          >
            <RefreshCw size={14} /> Reset
          </button>
        </div>
        <button
          onClick={exportToTransparentPNG}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded transition-colors font-bold text-xs border ${state.isDarkMode ? 'bg-slate-900 text-pink-400 border-pink-400/20 hover:bg-pink-600 hover:text-white' : 'bg-white text-pink-600 border-pink-600/20 hover:bg-pink-50'}`}
        >
          <Image size={14} /> Export Transparent PNG (Alpha)
        </button>
      </div>

      {/* Camera Controls */}
      <div className={`space-y-4 p-4 rounded-lg border ${state.isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100 border-slate-200'}`}>
        <div className={`flex items-center gap-2 font-semibold border-b pb-2 ${state.isDarkMode ? 'text-slate-200 border-slate-700' : 'text-slate-700 border-slate-200'}`}>
          <Eye size={16} className="text-cyan-500" /> View Orientation
        </div>
        <div className="grid grid-cols-1 gap-4">
          {['x', 'y', 'z'].map((axis) => (
            <div key={axis} className="flex items-center gap-3">
              <label className="w-4 uppercase text-slate-500 font-bold text-[10px]">{axis}</label>
              <input
                type="range" min="-180" max="180" step={state.snapToGrid ? 5 : 1}
                value={(state.cameraRotation[axis as 'x' | 'y' | 'z'] || 0) * (180 / Math.PI)}
                onChange={(e) => updateCamRotation(axis as any, parseFloat(e.target.value))}
                className="flex-1 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <span className={`w-8 text-right text-xs font-mono ${state.isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {Math.round((state.cameraRotation[axis as 'x' | 'y' | 'z'] || 0) * (180 / Math.PI))}°
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid Settings */}


      {/* Geometry List */}
      <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
        <div className={`flex items-center justify-between font-semibold border-b pb-2 ${state.isDarkMode ? 'text-slate-200 border-slate-700' : 'text-slate-700 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Box size={16} className="text-pink-500" /> Geometries
          </div>
          <button onClick={() => addGeometry('cube')} className={`p-1 rounded transition-colors border ${state.isDarkMode ? 'bg-pink-600/20 text-pink-400 border-pink-600/30 hover:bg-pink-600/30' : 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100'}`}>
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {state.geometries.map((geo) => {
            const cube = geo as CubeGeometry;
            return (
              <div key={geo.id} className={`rounded border overflow-hidden group ${state.isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center gap-2 p-2 ${state.isDarkMode ? 'bg-slate-800/80' : 'bg-slate-50'}`}>
                  <button onClick={() => updateGeometry(geo.id, { collapsed: !geo.collapsed })} className="text-slate-500">
                    {geo.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <input type="text" value={geo.name} onChange={(e) => updateGeometry(geo.id, { name: e.target.value })}
                    className="bg-transparent border-none text-[10px] font-bold focus:outline-none w-full uppercase tracking-tighter" />
                  <input type="color" value={geo.color} onChange={(e) => updateGeometry(geo.id, { color: e.target.value })}
                    className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer rounded overflow-hidden" />
                  <button onClick={() => setState(p => ({ ...p, geometries: p.geometries.filter(g => g.id !== geo.id) }))} className="text-red-400 hover:bg-red-400/10 p-1 rounded">
                    <Trash2 size={12} />
                  </button>
                </div>
                {!geo.collapsed && (
                  <div className={`p-3 pt-2 space-y-4 border-t ${state.isDarkMode ? 'border-slate-700/50' : 'border-slate-100'}`}>
                    {/* Position */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Move size={10} /> Position</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['x', 'y', 'z'].map((axis) => (
                          <div key={axis} className="relative">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-slate-500 uppercase">{axis}</span>
                            <input type="number" step="0.1" value={cube.center[axis as 'x' | 'y' | 'z']}
                              onChange={(e) => {
                                const v = cube.center.clone();
                                v[axis as 'x' | 'y' | 'z'] = parseFloat(e.target.value) || 0;
                                updateGeometry(geo.id, { center: v });
                              }}
                              className={`${inputClass} w-full pl-3`} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rotation */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Rotate3D size={10} /> Rotation (Deg)</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['x', 'y', 'z'].map((axis) => (
                          <div key={axis} className="relative">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-slate-500 uppercase">{axis}</span>
                            <input type="number" step="1" value={Math.round(cube.rotation[axis as 'x' | 'y' | 'z'] * (180 / Math.PI))}
                              onChange={(e) => {
                                const v = cube.rotation.clone();
                                v[axis as 'x' | 'y' | 'z'] = (parseFloat(e.target.value) || 0) * (Math.PI / 180);
                                updateGeometry(geo.id, { rotation: v });
                              }}
                              className={`${inputClass} w-full pl-3`} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Size */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Maximize size={10} /> Size</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['x', 'y', 'z'].map((axis) => (
                          <div key={axis} className="relative">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-slate-500 uppercase">{axis}</span>
                            <input type="number" step="0.1" min="0.1" value={cube.size[axis as 'x' | 'y' | 'z']}
                              onChange={(e) => {
                                const v = cube.size.clone();
                                v[axis as 'x' | 'y' | 'z'] = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                                updateGeometry(geo.id, { size: v });
                              }}
                              className={`${inputClass} w-full pl-3`} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Guides */}
                    <div className="flex flex-col gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={cube.showEdgeGuides}
                          onChange={(e) => updateGeometry(geo.id, { showEdgeGuides: e.target.checked })}
                          className="rounded border-slate-300 text-pink-500 focus:ring-pink-500" />
                        <span className="text-[9px] text-slate-500 group-hover:text-slate-300 transition-colors uppercase font-bold">Infinite Edge Guides</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group ml-4">
                        <input type="checkbox" checked={!!cube.showFullGuide}
                          onChange={(e) => updateGeometry(geo.id, { showFullGuide: e.target.checked })}
                          disabled={!cube.showEdgeGuides}
                          className="rounded border-slate-300 text-pink-500 focus:ring-pink-500 disabled:opacity-50" />
                        <span className="text-[9px] text-slate-500 group-hover:text-slate-300 transition-colors uppercase font-bold">Full Circle</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={cube.visible}
                          onChange={(e) => updateGeometry(geo.id, { visible: e.target.checked })}
                          className="rounded border-slate-300 text-cyan-500 focus:ring-cyan-500" />
                        <span className="text-[9px] text-slate-500 group-hover:text-slate-300 transition-colors uppercase font-bold">Visible</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
