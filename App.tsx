import React, { useRef, useState } from 'react';
import { Crop, Image, Moon, RefreshCw, SlidersHorizontal, Sun, X } from 'lucide-react';
import { CanvasView } from './components/CanvasView';
import { CoordinateGizmo } from './components/CoordinateGizmo';
import { Panel, iconBtn } from './components/Panel';
import { AppState } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    camera: [0, 0, 0], showGrid: true, gridAngle: 15, detail: 50, geometries: [],
    view: { zoom: 1, offsetX: 0, offsetY: 0 }, selectionMode: false, dark: true,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const exportRef = useRef<() => string | null>(() => null);

  const exportPNG = () => {
    const href = exportRef.current();
    if (href) Object.assign(document.createElement('a'), { href, download: 'riemann_sketch.png' }).click();
  };

  const tools: [string, React.ReactNode, () => void, boolean?][] = [
    ['ROI zoom (drag a box)', <Crop size={18} />, () => setState(p => ({ ...p, selectionMode: !p.selectionMode })), state.selectionMode],
    ['Reset view', <RefreshCw size={18} />, () => setState(p => ({ ...p, camera: [0, 0, 0], view: { zoom: 1, offsetX: 0, offsetY: 0 }, selectionMode: false }))],
    ['Export transparent PNG', <Image size={18} />, exportPNG],
    ['Toggle theme', state.dark ? <Sun size={18} /> : <Moon size={18} />, () => setState(p => ({ ...p, dark: !p.dark }))],
  ];

  return (
    <div className={`${state.dark ? 'dark' : ''} h-[100dvh] w-screen flex flex-col-reverse md:flex-row overflow-hidden font-sans`}>
      <aside className={`${panelOpen ? 'block' : 'hidden'} md:block shrink-0 max-h-[50dvh] md:max-h-none md:w-80 overflow-y-auto custom-scrollbar border-t md:border-t-0 md:border-r
        bg-white text-slate-900 border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700`}>
        <header className="hidden md:block px-5 pt-5">
          <h1 className="text-2xl font-bold tracking-tight">Riemann<span className="text-cyan-500">Sketch</span></h1>
          <p className="text-[10px] mt-1 uppercase tracking-widest font-bold text-slate-500">5-point curvilinear perspective</p>
        </header>
        <Panel state={state} setState={setState} />
      </aside>

      <main className="relative flex-1 min-h-0 bg-slate-50 dark:bg-slate-900">
        <CanvasView state={state} setState={setState} exportRef={exportRef} />
        <div className="absolute top-3 left-3 flex gap-1 p-1 rounded-lg border shadow-lg backdrop-blur-md bg-white/80 border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
          <button className={`${iconBtn} md:hidden`} title="Settings" onClick={() => setPanelOpen(o => !o)}>
            {panelOpen ? <X size={18} /> : <SlidersHorizontal size={18} />}
          </button>
          {tools.map(([title, icon, onClick, active]) => (
            <button key={title} title={title} onClick={onClick} className={`${iconBtn} ${active ? '!bg-pink-600 !text-white' : ''}`}>{icon}</button>
          ))}
        </div>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
          <CoordinateGizmo camera={state.camera} />
          {state.view.zoom > 1.05 && <span className="text-[10px] font-mono text-slate-500">{state.view.zoom.toFixed(1)}×</span>}
        </div>
      </main>
    </div>
  );
};

export default App;
