import { Vector3, Euler } from 'three';

export interface ViewSettings {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface AppState {
  cameraRotation: Euler;
  showGrid: boolean;
  gridAngle: number;
  snapToGrid: boolean;
  renderDetail: number;
  geometries: GeometryItem[];
  viewSettings: ViewSettings;
  selectionMode: boolean;
  isDarkMode: boolean; // Added for theme support
}

export type GeometryType = 'cube';

export interface BaseGeometry {
  id: string;
  name: string;
  collapsed: boolean;
  type: GeometryType;
  color: string;
  visible: boolean;
}

export interface CubeGeometry extends BaseGeometry {
  type: 'cube';
  center: Vector3;
  size: Vector3;
  rotation: Euler;
  showEdgeGuides: boolean;
  showCenterGuides: boolean;
  showFullGuide?: boolean;
}

export type GeometryItem = CubeGeometry;

export interface ProjectedPoint {
  x: number;
  y: number;
  u: number; // Raw projection U
  v: number; // Raw projection V
  zScale: number;
  visible: boolean;
}
