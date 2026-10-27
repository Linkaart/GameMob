import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { characterUnderAim, movementInView, unobstructedCamera } from '../src/camera.js';

test('forward and strafe follow the view after rotating the third-person camera', () => {
  const front = movementInView(0, -1, 0);
  assert.equal(front.x, 0); assert.equal(front.z, -1);
  const turned = movementInView(0, -1, Math.PI / 2);
  assert.ok(Math.abs(turned.x + 1) < 1e-8); assert.ok(Math.abs(turned.z) < 1e-8);
  const strafe = movementInView(1, 0, Math.PI / 2);
  assert.ok(Math.abs(strafe.x) < 1e-8); assert.ok(Math.abs(strafe.z + 1) < 1e-8);
  assert.ok(Math.abs(Math.hypot(turned.x, turned.z) - 1) < 1e-8);
});

test('the following camera stays in front of a wall between it and the player', () => {
  const anchor = new THREE.Vector3(0, 1.35, 0), desired = new THREE.Vector3(0, 4, 8);
  const result = unobstructedCamera(anchor, desired, [{ x: 0, z: 5, w: 6, d: 2, h: 6 }]);
  assert.ok(result.z < 3.82); assert.ok(result.z > 3);
  assert.ok(result.y > anchor.y);
  assert.deepEqual(unobstructedCamera(anchor, desired, []).toArray(), desired.toArray());
  const lowCar = unobstructedCamera(anchor, desired, [{ x: 0, z: 5, w: 2, d: 2, h: 1 }]);
  assert.ok(lowCar.distanceTo(desired) < 1e-8, 'A low obstacle below the camera should not shorten the view');
});

test('aiming at a large head selects that enemy, with the nearest silhouette taking priority', () => {
  const origin = new THREE.Vector3(0.55, 4, 7.4);
  const enemy = { x: 5, z: -5, radius: 0.58, height: 2.2 };
  const direction = new THREE.Vector3(enemy.x, 1.9, enemy.z).sub(origin).normalize();
  const ray = new THREE.Ray(origin, direction);
  assert.equal(characterUnderAim(ray, [enemy]), enemy);
  const behind = { x: 10, z: -19, radius: 2, height: 3 };
  assert.equal(characterUnderAim(ray, [behind, enemy]), enemy);
  assert.equal(characterUnderAim(new THREE.Ray(origin, new THREE.Vector3(0, 1, 0)), [enemy]), null);
});
