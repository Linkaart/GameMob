import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const templates = new Map();
let loading;
export function loadEnvironmentAssets() {
  if (!loading) {
    const loader = new GLTFLoader();
    loading = Promise.allSettled(['vehicle-truck-green','vehicle-truck-red','vehicle-motorcycle','decoration-tents'].map(async name => {
      templates.set(name, (await loader.loadAsync(`/assets/environment/${name}.glb`)).scene);
    }));
  }
  return loading;
}

export function createEnvironmentAsset(name, width, height, depth, turn = 0) {
  const template = templates.get(name); if (!template) return null;
  const root = new THREE.Group(), model = template.clone(true); root.add(model); model.rotation.y = turn;
  root.userData.environmentAsset = name;
  // Each world instance owns its GPU resources; the cached source remains reusable.
  const textures = new Map(), materials = new Map(), geometries = new Map();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (!geometries.has(mesh.geometry)) geometries.set(mesh.geometry, mesh.geometry.clone());
    mesh.geometry = geometries.get(mesh.geometry);
    const cloneMaterial = original => {
      if (materials.has(original)) return materials.get(original);
      const mat = original.clone(); mat.color.multiply(new THREE.Color('#aaa28e')); mat.roughness = .87; mat.metalness = .12;
      for (const key of Object.keys(mat)) {
        const texture = mat[key]; if (!texture?.isTexture) continue;
        if (!textures.has(texture)) { const owned = texture.clone(); owned.needsUpdate = true; textures.set(texture, owned); }
        mat[key] = textures.get(texture);
      }
      materials.set(original, mat); return mat;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMaterial) : cloneMaterial(mesh.material);
    mesh.castShadow = mesh.receiveShadow = true;
  });
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  root.scale.set(width / size.x, height / size.y, depth / size.z);
  return root;
}
