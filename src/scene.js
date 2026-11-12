import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// Normaliza os modelos do gerador 3D (que chegam com escala arbitrária).
// Os tamanhos são estimativas ajustáveis, não medidas dos alimentos reais.
export async function loadProduct(product, onProgress) {
  // O GLB continua sendo preparado antes da câmera, como na V10.
  const gltf = await loader.loadAsync(product.url, onProgress);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const rawBounds = new THREE.Box3().setFromObject(model);
  if (rawBounds.isEmpty()) throw Error('O GLB não contém geometria visível.');
  const size = rawBounds.getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z);
  if (!Number.isFinite(footprint) || footprint <= 0.00001) throw Error('O GLB tem dimensões inválidas.');

  const scale = product.diameter / footprint;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(model);
  const center = b.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= b.min.y;
  model.position.z -= center.z;

  // Alguns GLBs gerados por IA chegam com metallicFactor = 1, como se comida fosse metal.
  // Corrigir preservando as texturas originais melhora a resposta à luz física do ambiente.
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.frustumCulled = true;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((mat) => {
      if (!mat || !mat.isMeshStandardMaterial) return;
      mat.metalness = 0.0;
      mat.roughness = product.roughness ?? 0.72;
      mat.envMapIntensity = 0.65;
      mat.needsUpdate = true;
    });
  });

  const root = new THREE.Group();
  root.add(model);
  return root;
}

export function createFallbackLights(scene, type = 'viewer') {
  const group = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x566052, type === 'ar' ? 1.0 : 1.45);
  const key = new THREE.DirectionalLight(0xfff5e5, type === 'ar' ? 1.55 : 2.5);
  key.position.set(1.8, 3.6, 2.4);
  group.add(hemi, key);
  scene.add(group);
  return group;
}

// Pequena sombra de contato; não é uma sombra calculada sobre a mesa física.
export function createContactShadow(radius) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 7, 64, 64, 63);
  g.addColorStop(0, 'rgba(0,0,0,0.50)');
  g.addColorStop(.45, 'rgba(0,0,0,0.23)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.45, radius * 1.45),
    new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, opacity: .64, toneMapped: false, side: THREE.DoubleSide})
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.renderOrder = -1;
  return mesh;
}

export function disposeObject(root) {
  root?.traverse(obj => {
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const value of Object.values(mat)) {
        if (value?.isTexture) value.dispose();
      }
      mat.dispose?.();
    }
  });
}
