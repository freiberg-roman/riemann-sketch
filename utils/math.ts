import { Vector3, Euler, Quaternion } from 'three';
import { ProjectedPoint, ViewSettings } from '../types';

/**
 * Projects a 3D point onto the 2D plane using Stereographic Projection.
 */
export function projectPoint(
  point: Vector3,
  cameraRotation: Euler,
  width: number,
  height: number,
  viewSettings?: ViewSettings
): ProjectedPoint {
  // 1. Apply Camera Rotation
  const p = point.clone();
  const quaternion = new Quaternion();
  quaternion.setFromEuler(cameraRotation);
  quaternion.invert(); 
  p.applyQuaternion(quaternion);

  const r = p.length();
  if (r < 0.00001) {
    return { x: width / 2, y: height / 2, u: 0, v: 0, zScale: 1, visible: true };
  }

  const nx = p.x / r;
  const ny = p.y / r;
  const nz = p.z / r;

  // Singularity handling at ny = -1
  if (ny < -0.999) {
    return { x: 0, y: 0, u: 0, v: 0, zScale: 0, visible: false };
  }

  const denom = 1 + ny;
  const u = nx / denom;
  const v = nz / denom;

  // Mapping to screen coordinates with zoom and offset
  const baseScale = Math.min(width, height) / 2;
  const effectiveScale = baseScale * (viewSettings?.zoom ?? 1);
  
  const screenX = width / 2 + (u * effectiveScale) + (viewSettings?.offsetX ?? 0);
  const screenY = height / 2 - (v * effectiveScale) + (viewSettings?.offsetY ?? 0); 

  return {
    x: screenX,
    y: screenY,
    u,
    v,
    zScale: 1,
    visible: true
  };
}

export function sampleProjectedLine(
  start: Vector3,
  end: Vector3,
  cameraRotation: Euler,
  width: number,
  height: number,
  steps: number = 20,
  viewSettings?: ViewSettings
): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];
  const delta = new Vector3().subVectors(end, start);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = new Vector3().copy(start).addScaledVector(delta, t);
    points.push(projectPoint(p, cameraRotation, width, height, viewSettings));
  }
  return points;
}

export function getVanishingPoint(
  direction: Vector3,
  cameraRotation: Euler,
  width: number,
  height: number,
  viewSettings?: ViewSettings
): ProjectedPoint {
  const dirNorm = direction.clone().normalize();
  return projectPoint(dirNorm, cameraRotation, width, height, viewSettings);
}

export function getProjectedInfiniteLine(
  origin: Vector3,
  direction: Vector3,
  cameraRotation: Euler,
  width: number,
  height: number,
  steps: number = 100,
  viewSettings?: ViewSettings
): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];
  const vpBack = getVanishingPoint(direction.clone().negate(), cameraRotation, width, height, viewSettings);
  points.push(vpBack);
  
  for (let i = 0; i <= steps; i++) {
    const alpha = (i / steps) * Math.PI - (Math.PI / 2);
    const safeAlpha = Math.max(-1.5, Math.min(1.5, alpha)); 
    const t = Math.tan(safeAlpha) * 200; 
    const p = new Vector3().copy(origin).addScaledVector(direction, t);
    points.push(projectPoint(p, cameraRotation, width, height, viewSettings));
  }

  const vpFront = getVanishingPoint(direction, cameraRotation, width, height, viewSettings);
  points.push(vpFront);
  
  return points;
}
