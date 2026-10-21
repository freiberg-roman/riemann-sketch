import type { Dispatch, SetStateAction } from 'react';

export type Vec3 = [number, number, number];

export interface Geometry {
  id: string;
  name: string;
  kind: 'cube' | 'mesh';
  color: string;
  visible: boolean;
  collapsed: boolean;
  center: Vec3;
  size: Vec3;
  rotation: Vec3; // degrees
  guides: boolean; // cube: infinite edge guides
  fullGuide: boolean; // cube: full great circles
  wireframe: boolean; // mesh: draw triangle edges
  mesh?: Float32Array; // mesh: triangle soup (9 floats / tri), normalized to a unit box
}

export interface AppState {
  camera: Vec3; // degrees
  showGrid: boolean;
  gridAngle: number;
  detail: number;
  geometries: Geometry[];
  view: { zoom: number; offsetX: number; offsetY: number };
  selectionMode: boolean;
  dark: boolean;
}

export type SetState = Dispatch<SetStateAction<AppState>>;
