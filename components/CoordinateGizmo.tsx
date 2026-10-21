import React from 'react';
import { Euler, Quaternion, Vector3 } from 'three';
import { Vec3 } from '../types';
import { DEG } from '../utils/scene';

const AXES: [string, string, Vector3][] = [
  ['X', '#ef4444', new Vector3(1, 0, 0)], ['Y', '#22c55e', new Vector3(0, 1, 0)], ['Z', '#3b82f6', new Vector3(0, 0, 1)],
];

export const CoordinateGizmo: React.FC<{ camera: Vec3 }> = ({ camera }) => {
  const q = new Quaternion().setFromEuler(new Euler(...camera.map(a => a * DEG) as Vec3)).invert();
  return (
    <svg viewBox="-40 -40 80 80" className="w-16 h-16 md:w-20 md:h-20 rounded-full border shadow-xl backdrop-blur-sm pointer-events-none bg-white/80 border-slate-200 dark:bg-slate-900/60 dark:border-slate-700/50">
      {AXES.map(([label, color, v]) => {
        const d = v.clone().applyQuaternion(q);
        return (
          <g key={label} fill={color}>
            <line x2={d.x * 26} y2={-d.z * 26} stroke={color} strokeWidth="2" strokeLinecap="round" />
            <text x={d.x * 33} y={-d.z * 33} fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{label}</text>
          </g>
        );
      })}
      <circle r="1.5" className="fill-black dark:fill-white" />
    </svg>
  );
};
