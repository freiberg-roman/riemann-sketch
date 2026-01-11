import React, { useState } from 'react';
import { CanvasView } from './components/CanvasView';
import { Sidebar } from './components/Sidebar';
import { CoordinateGizmo } from './components/CoordinateGizmo';
import { AppState } from './types';
import { Euler } from 'three';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    cameraRotation: new Euler(0, 0, 0),
    showGrid: true,
    gridAngle: 15,
    snapToGrid: true,
    renderDetail: 50,
    geometries: [],
    viewSettings: {
      zoom: 1,
      offsetX: 0,
      offsetY: 0
    },
    selectionMode: false,
    isDarkMode: true
  });

  return (
    <div className={`relative w-screen h-screen overflow-hidden font-sans selection:bg-cyan-500/30 ${state.isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <CanvasView state={state} setState={setState} />
      <CoordinateGizmo rotation={state.cameraRotation} isDarkMode={state.isDarkMode} />
      <Sidebar state={state} setState={setState} />
    </div>
  );
};

export default App;
