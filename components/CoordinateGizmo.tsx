import React, { useMemo } from 'react';
import { Euler, Vector3, Quaternion } from 'three';

interface CoordinateGizmoProps {
  rotation: Euler;
  isDarkMode: boolean;
}

export const CoordinateGizmo: React.FC<CoordinateGizmoProps> = ({ rotation, isDarkMode }) => {
  const size = 80;
  const center = size / 2;
  const axisLength = 30;

  const axes = useMemo(() => {
    const basisX = new Vector3(1, 0, 0);
    const basisY = new Vector3(0, 1, 0);
    const basisZ = new Vector3(0, 0, 1);

    const q = new Quaternion().setFromEuler(rotation).invert();

    const rotX = basisX.applyQuaternion(q);
    const rotY = basisY.applyQuaternion(q);
    const rotZ = basisZ.applyQuaternion(q);

    return [
      { label: 'X', color: '#ef4444', dir: rotX },
      { label: 'Y', color: isDarkMode ? '#22c55e' : '#16a34a', dir: rotY },
      { label: 'Z', color: '#3b82f6', dir: rotZ },
    ];
  }, [rotation, isDarkMode]);

  const bgColor = isDarkMode ? 'bg-slate-900/60' : 'bg-white/80';
  const borderColor = isDarkMode ? 'border-slate-700/50' : 'border-slate-200';

  return (
    <div className={`absolute top-6 right-6 w-20 h-20 backdrop-blur-sm rounded-full border shadow-xl pointer-events-none z-20 flex items-center justify-center transition-colors ${bgColor} ${borderColor}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {axes.map((axis) => {
          const x = center + axis.dir.x * axisLength;
          const y = center - axis.dir.z * axisLength; 
          
          return (
            <g key={axis.label}>
              <line
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke={axis.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={x} cy={y} r="2" fill={axis.color} />
              <text
                x={x + (axis.dir.x * 8)}
                y={y - (axis.dir.z * 8)}
                fill={axis.color}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ textShadow: isDarkMode ? '0 0 4px rgba(0,0,0,0.8)' : '0 0 4px rgba(255,255,255,0.8)' }}
              >
                {axis.label}
              </text>
            </g>
          );
        })}
        <circle cx={center} cy={center} r="1.5" fill={isDarkMode ? 'white' : 'black'} />
      </svg>
    </div>
  );
};