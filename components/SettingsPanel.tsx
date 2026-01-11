import React from 'react';
import { AppState } from '../types';
import { Rotate3D, Activity, X } from 'lucide-react';

interface SettingsPanelProps {
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ state, setState, onClose }) => {
    const inputClass = `border rounded px-1 py-0.5 text-[10px] text-right focus:outline-none transition-colors ${state.isDarkMode
        ? 'bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500'
        : 'bg-white border-slate-300 text-slate-800 focus:border-cyan-600'
        }`;

    return (
        <div className={`absolute top-0 right-0 h-full w-full sm:w-80 p-6 shadow-2xl z-20 transition-colors border-l backdrop-blur-md ${state.isDarkMode
            ? "bg-slate-900/95 border-slate-700 text-slate-100"
            : "bg-white/95 border-slate-200 text-slate-900"
            }`}>

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Rotate3D size={18} className="text-cyan-500" /> Settings
                </h2>
                <button onClick={onClose} className={`p-1 rounded hover:bg-slate-500/10 transition-colors`}>
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-6">
                {/* Grid Settings */}
                <div className={`space-y-4 p-4 rounded-lg border ${state.isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100 border-slate-200'}`}>
                    <div className={`flex items-center justify-between border-b pb-2 ${state.isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <span className={`font-semibold text-sm ${state.isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            Show Grid
                        </span>
                        <button
                            onClick={() => setState(p => ({ ...p, showGrid: !p.showGrid }))}
                            className={`w-10 h-6 rounded-full transition-colors relative ${state.showGrid ? 'bg-cyan-600' : 'bg-slate-400'}`}
                        >
                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${state.showGrid ? 'translate-x-4' : ''}`} />
                        </button>
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                            <span className="text-xs">Interval (Deg)</span>
                            <span className="font-mono text-xs">{state.gridAngle}°</span>
                        </div>
                        <input
                            type="range" min="0" max="10" step="1"
                            value={[5, 6, 9, 10, 12, 15, 18, 20, 30, 36, 45].indexOf(state.gridAngle) >= 0 ? [5, 6, 9, 10, 12, 15, 18, 20, 30, 36, 45].indexOf(state.gridAngle) : 0}
                            onChange={(e) => {
                                const values = [5, 6, 9, 10, 12, 15, 18, 20, 30, 36, 45];
                                setState(prev => ({ ...prev, gridAngle: values[parseInt(e.target.value)] }));
                            }}
                            className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                </div>

                {/* Performance / Precision */}
                <div className={`space-y-4 p-4 rounded-lg border ${state.isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100 border-slate-200'}`}>
                    <div className={`flex items-center justify-between border-b pb-2 ${state.isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <span className={`font-semibold text-sm flex items-center gap-2 ${state.isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            <Activity size={16} className="text-pink-500" /> Precision
                        </span>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs">Base Resolution</span>
                            <input
                                type="number" min="1" max="1000" value={state.renderDetail}
                                onChange={(e) => setState(prev => ({ ...prev, renderDetail: parseInt(e.target.value) || 1 }))}
                                className={inputClass}
                            />
                        </div>
                        <input
                            type="range" min="1" max="100" step="1" value={state.renderDetail > 100 ? 100 : state.renderDetail}
                            onChange={(e) => setState(prev => ({ ...prev, renderDetail: parseFloat(e.target.value) }))}
                            className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
