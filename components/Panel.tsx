import React, { useRef } from 'react';
import { Box, ChevronDown, ChevronRight, Eye, EyeOff, Grid3x3, Plus, Trash2, Upload } from 'lucide-react';
import { AppState, Geometry, SetState, Vec3 } from '../types';
import { makeGeometry, parseSTL } from '../utils/scene';

const GRID_ANGLES = [5, 6, 9, 10, 12, 15, 18, 20, 30, 36, 45];
const label = 'text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400';
const input = 'w-full min-w-0 rounded border px-1.5 py-1 text-xs text-right font-mono bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700 focus:outline-none focus:border-cyan-500';
export const iconBtn = 'p-2 rounded-md transition-colors text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700';

const Section: React.FC<{ title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, action, children }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-700">
      <h2 className="flex items-center gap-2 font-semibold text-sm">{icon}{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label: l, value, onChange, disabled }) => (
  <label className={`flex items-center justify-between gap-2 cursor-pointer ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
    <span className={label}>{l}</span>
    <button onClick={() => onChange(!value)} className={`w-9 h-5 rounded-full relative transition-colors ${value ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : ''}`} />
    </button>
  </label>
);

const Slider: React.FC<{ label: string; value: number; display: string; min: number; max: number; onChange: (v: number) => void }> = ({ label: l, value, display, min, max, onChange }) => (
  <div className="flex items-center gap-3">
    <span className={`${label} w-16 shrink-0`}>{l}</span>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} className="flex-1 accent-cyan-500 h-5" />
    <span className="w-10 text-right text-xs font-mono">{display}</span>
  </div>
);

const Vec3Input: React.FC<{ label: string; value: Vec3; step: number; onChange: (v: Vec3) => void }> = ({ label: l, value, step, onChange }) => (
  <div className="flex items-center gap-2">
    <span className={`${label} w-14 shrink-0`}>{l}</span>
    {value.map((x, i) => (
      <input key={i} type="number" inputMode="decimal" step={step} value={+x.toFixed(3)} className={input}
        onChange={e => onChange(value.map((y, j) => (j === i ? +e.target.value || 0 : y)) as Vec3)} />
    ))}
  </div>
);

const GeometryCard: React.FC<{ g: Geometry; update: (u: Partial<Geometry>) => void; remove: () => void }> = ({ g, update, remove }) => (
  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60">
    <div className="flex items-center gap-1 p-1.5">
      <button className={iconBtn} onClick={() => update({ collapsed: !g.collapsed })}>
        {g.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      <input value={g.name} onChange={e => update({ name: e.target.value })} className="flex-1 min-w-0 bg-transparent text-xs font-bold focus:outline-none" />
      <input type="color" value={g.color} onChange={e => update({ color: e.target.value })} className="w-6 h-6 shrink-0 cursor-pointer bg-transparent" />
      <button className={iconBtn} onClick={() => update({ visible: !g.visible })}>{g.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
      <button className={`${iconBtn} !text-red-400`} onClick={remove}><Trash2 size={14} /></button>
    </div>
    {!g.collapsed && (
      <div className="space-y-2 p-3 border-t border-slate-200 dark:border-slate-700">
        <Vec3Input label="Position" value={g.center} step={0.1} onChange={center => update({ center })} />
        <Vec3Input label="Rotation°" value={g.rotation} step={5} onChange={rotation => update({ rotation })} />
        <Vec3Input label="Size" value={g.size} step={0.1} onChange={size => update({ size: size.map(s => Math.max(0.01, s)) as Vec3 })} />
        {g.kind === 'cube' ? <>
          <Toggle label="Infinite edge guides" value={g.guides} onChange={guides => update({ guides })} />
          <Toggle label="Full circle guides" value={g.fullGuide} disabled={!g.guides} onChange={fullGuide => update({ fullGuide })} />
        </> : <Toggle label="Wireframe" value={g.wireframe} onChange={wireframe => update({ wireframe })} />}
      </div>
    )}
  </div>
);

export const Panel: React.FC<{ state: AppState; setState: SetState }> = ({ state, setState }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (u: Partial<AppState>) => setState(p => ({ ...p, ...u }));
  const add = (g: Geometry) => setState(p => ({ ...p, geometries: [...p.geometries, g] }));
  const update = (id: string, u: Partial<Geometry>) =>
    setState(p => ({ ...p, geometries: p.geometries.map(g => (g.id === id ? { ...g, ...u } : g)) }));

  const importSTL = async (files: FileList | null) => {
    for (const f of files ?? []) {
      try { add(makeGeometry({ kind: 'mesh', name: f.name.replace(/\.stl$/i, ''), mesh: parseSTL(await f.arrayBuffer()), collapsed: false })); }
      catch (err) { alert(`Could not read ${f.name}: ${err}`); }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-6 p-4 md:p-5 text-sm">
      <Section title="View" icon={<Grid3x3 size={16} className="text-cyan-500" />}>
        {(['X', 'Y', 'Z'] as const).map((a, i) => (
          <Slider key={a} label={`Rot ${a}`} min={-180} max={180} value={Math.round(state.camera[i])} display={`${Math.round(state.camera[i])}°`}
            onChange={v => set({ camera: state.camera.map((c, j) => (j === i ? v : c)) as Vec3 })} />
        ))}
        <Toggle label="Grid" value={state.showGrid} onChange={showGrid => set({ showGrid })} />
        <Slider label="Interval" min={0} max={GRID_ANGLES.length - 1} value={Math.max(0, GRID_ANGLES.indexOf(state.gridAngle))}
          display={`${state.gridAngle}°`} onChange={i => set({ gridAngle: GRID_ANGLES[i] })} />
        <Slider label="Detail" min={1} max={100} value={state.detail} display={`${state.detail}`} onChange={detail => set({ detail })} />
      </Section>

      <Section title="Objects" icon={<Box size={16} className="text-pink-500" />} action={
        <div className="flex gap-1">
          <button className={iconBtn} title="Add cube" onClick={() => add(makeGeometry({ kind: 'cube', name: `Cube ${state.geometries.filter(g => g.kind === "cube").length + 1}`, color: state.dark ? '#f472b6' : '#db2777', collapsed: false }))}><Plus size={16} /></button>
          <button className={iconBtn} title="Import STL" onClick={() => fileRef.current?.click()}><Upload size={16} /></button>
          <input ref={fileRef} type="file" accept=".stl,model/stl" multiple hidden onChange={e => importSTL(e.target.files)} />
        </div>
      }>
        {state.geometries.length === 0 && <p className="text-xs text-slate-500">Add a cube or import an STL file.</p>}
        {state.geometries.map(g => (
          <GeometryCard key={g.id} g={g} update={u => update(g.id, u)}
            remove={() => setState(p => ({ ...p, geometries: p.geometries.filter(x => x.id !== g.id) }))} />
        ))}
      </Section>
    </div>
  );
};
