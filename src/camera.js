import * as THREE from 'three';

export function movementInView(x, y, yaw) {
  return { x: x * Math.cos(yaw) + y * Math.sin(yaw), z: -x * Math.sin(yaw) + y * Math.cos(yaw) };
}

// In perspective, a cursor over a large head must target that zombie rather
// than the ground several metres behind it. Damage remains server-authoritative.
export function characterUnderAim(ray, targets) {
  let nearest = Infinity, selected = null;
  for (const target of targets) {
    const bounds = new THREE.Box3(
      new THREE.Vector3(target.x - target.radius, 0, target.z - target.radius),
      new THREE.Vector3(target.x + target.radius, target.height, target.z + target.radius),
    );
    const hit = ray.intersectBox(bounds, new THREE.Vector3());
    const distance = hit ? ray.origin.distanceTo(hit) : Infinity;
    if (distance < nearest) { nearest = distance; selected = target; }
  }
  return selected;
}

// Keep the third-person camera on the player's side of solid scenery.
export function unobstructedCamera(anchor, desired, obstacles) {
  const direction = desired.clone().sub(anchor);
  const distance = direction.length();
  if (!distance) return desired.clone();
  direction.normalize();
  const ray = new THREE.Ray(anchor, direction);
  let allowed = distance;
  for (const o of obstacles) {
    const bounds = new THREE.Box3(
      new THREE.Vector3(o.x - o.w / 2 - 0.18, -0.2, o.z - o.d / 2 - 0.18),
      new THREE.Vector3(o.x + o.w / 2 + 0.18, o.h + 0.5, o.z + o.d / 2 + 0.18),
    );
    const hit = ray.intersectBox(bounds, new THREE.Vector3());
    if (hit) allowed = Math.min(allowed, Math.max(0.2, anchor.distanceTo(hit) - 0.2));
  }
  return anchor.clone().addScaledVector(direction, allowed);
}
