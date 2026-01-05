/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { type Asteroid } from '../lib/indexedDB';
import { acceleratedRaycast, computeBatchedBoundsTree } from 'three-mesh-bvh';
import { createRadixSort, extendBatchedMeshPrototype } from '@three.ez/batched-mesh-extensions';

// Extend BatchedMesh prototype with BVH methods
extendBatchedMeshPrototype();

// Add accelerated raycast to Mesh prototype
THREE.Mesh.prototype.raycast = acceleratedRaycast;
// Add computeBoundsTree to BatchedMesh prototype
(THREE.BatchedMesh.prototype as any).computeBoundsTree = computeBatchedBoundsTree;

// Create irregular rocky geometry
function createRockyGeometry(baseGeometry: THREE.BufferGeometry, roughness: number = 0.3): THREE.BufferGeometry {
  const geometry = baseGeometry.clone();
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    const originalLength = vertex.length();
    const noise = Math.sin(vertex.x * 5) * Math.cos(vertex.y * 7) * Math.sin(vertex.z * 3);
    const noise2 = Math.cos(vertex.x * 11) * Math.sin(vertex.y * 13) * Math.cos(vertex.z * 9);
    const displacement = 1 + (noise * 0.3 + noise2 * 0.2) * roughness;
    vertex.normalize().multiplyScalar(originalLength * displacement);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  
  geometry.computeVertexNormals();
  return geometry;
}

// Asteroid belt using BatchedMesh with BVH for proper frustum culling
export class AsteroidBeltBVH {
  scene: THREE.Scene;
  
  // BatchedMesh for all asteroids
  batchedMesh: THREE.BatchedMesh | null = null;
  
  // Data
  asteroidData: Asteroid[] = [];
  private instancePositions: THREE.Vector3[] = [];
  private positionMap: Map<number, Asteroid> = new Map();
  
  // Textures
  private moonTexture: THREE.Texture | null = null;
  private moonBumpMap: THREE.Texture | null = null;
  
  // Nearby asteroid labels
  private nearbyLabels: Map<number, THREE.Sprite> = new Map();
  
  // AU scale
  private AU = 100;

  // Loading state
  private loadingAborted = false;
  
  // Performance options (stored for state tracking)
  public useBVH = true;
  public useLOD = true;
  public freeze = false;
  
  // BVH reference for toggling
  private bvhRef: unknown = null;
  private originalOnBeforeRender: typeof THREE.Object3D.prototype.onBeforeRender | null = null;
  
  // Visible count tracked internally
  private _visibleCount = 0;
  
  // Callbacks
  onLoadProgress?: (loaded: number, total: number) => void;
  onNearbyAsteroid?: (asteroid: Asteroid, position: THREE.Vector3) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loadTextures();
  }
  
  // Setters for performance options
  setFrustumCullingEnabled(enabled: boolean): void {
    this.useBVH = enabled;
    if (this.batchedMesh) {
      (this.batchedMesh as any).bvh = enabled ? this.bvhRef : null;
    }
  }
  
  setLODEnabled(enabled: boolean): void {
    this.useLOD = enabled;
    // LOD is handled by BatchedMesh extensions automatically
  }
  
  setFreeze(freeze: boolean): void {
    this.freeze = freeze;
    if (this.batchedMesh) {
      if (freeze) {
        // Freeze: disable onBeforeRender to stop culling updates
        this.batchedMesh.onBeforeRender = () => {};
      } else {
        // Unfreeze: restore original onBeforeRender
        if (this.originalOnBeforeRender) {
          this.batchedMesh.onBeforeRender = this.originalOnBeforeRender;
        }
      }
    }
  }
  
  getVisibleCount(): number {
    if (this.batchedMesh) {
      // BatchedMesh tracks visible instances internally
      this._visibleCount = (this.batchedMesh as any)._visibleCount ?? this.instancePositions.length;
      return this._visibleCount;
    }
    return 0;
  }
  
  // Get asteroid position by asteroid data
  getAsteroidPosition(asteroid: Asteroid): THREE.Vector3 {
    // Find asteroid in data
    const index = this.asteroidData.findIndex(a => 
      a.id === asteroid.id || a.name === asteroid.name || a.pdes === asteroid.pdes
    );
    
    if (index !== -1 && this.instancePositions[index]) {
      return this.instancePositions[index].clone();
    }
    
    // Fallback: calculate from orbital elements
    const a = asteroid.a * this.AU;
    const e = asteroid.e;
    const M = ((asteroid.ma || 0) * Math.PI) / 180;
    
    let E = M;
    for (let j = 0; j < 5; j++) {
      E = M + e * Math.sin(E);
    }
    
    const x = a * (Math.cos(E) - e);
    const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
    
    return new THREE.Vector3(x, 0, y);
  }

  private loadTextures(): void {
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load('/textures/moonmap1k.jpg', (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.moonTexture = texture;
    });
    
    textureLoader.load('/textures/moonbump1k.jpg', (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.moonBumpMap = texture;
    });
  }

  abort(): void {
    this.loadingAborted = true;
  }

  async loadAsteroids(asteroids: Asteroid[]): Promise<void> {
    if (this.loadingAborted) return;
    
    this.asteroidData = asteroids;
    const total = asteroids.length;
    
    if (total === 0) return;
    
    // Create geometries for different asteroid types (will be used for LOD)
    const baseGeometry = new THREE.IcosahedronGeometry(1, 2);
    const rockyGeometry = createRockyGeometry(baseGeometry, 0.4);
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8,
      metalness: 0.2,
      vertexColors: true,
      flatShading: true,
    });
    
    // Calculate vertex and index counts
    const vertexCount = rockyGeometry.attributes.position.count * 2; // Extra space for potential LOD
    const indexCount = rockyGeometry.index ? rockyGeometry.index.count * 2 : 0;
    
    // Create BatchedMesh
    this.batchedMesh = new THREE.BatchedMesh(total, vertexCount, indexCount, material);
    this.batchedMesh.name = 'AsteroidBeltBVH';
    
    // Enable radix sort for better performance
    (this.batchedMesh as any).customSort = createRadixSort(this.batchedMesh);
    
    // Add geometry to batched mesh
    const geometryId = this.batchedMesh.addGeometry(rockyGeometry);
    
    // Prepare instance data
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    
    // Process asteroids in chunks
    const CHUNK_SIZE = 1000;
    let processedCount = 0;
    
    this.onLoadProgress?.(0, total);
    
    const processChunk = async (): Promise<void> => {
      const endIndex = Math.min(processedCount + CHUNK_SIZE, total);
      
      for (let i = processedCount; i < endIndex; i++) {
        if (this.loadingAborted) return;
        
        const asteroid = asteroids[i];
        
        // Calculate position from orbital elements
        const a = asteroid.a * this.AU;
        const e = asteroid.e;
        const inc = (asteroid.i * Math.PI) / 180;
        const omega = ((asteroid.om || 0) * Math.PI) / 180;
        const w = ((asteroid.w || 0) * Math.PI) / 180;
        const M = ((asteroid.ma || Math.random() * 360) * Math.PI) / 180;
        
        // Solve Kepler's equation (simplified)
        let E = M;
        for (let j = 0; j < 5; j++) {
          E = M + e * Math.sin(E);
        }
        
        const x = a * (Math.cos(E) - e);
        const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
        
        // Rotate by argument of perihelion and longitude of ascending node
        const cosW = Math.cos(w);
        const sinW = Math.sin(w);
        const cosO = Math.cos(omega);
        const sinO = Math.sin(omega);
        const cosI = Math.cos(inc);
        const sinI = Math.sin(inc);
        
        const xEcl = (cosO * cosW - sinO * sinW * cosI) * x + (-cosO * sinW - sinO * cosW * cosI) * y;
        const yEcl = (sinO * cosW + cosO * sinW * cosI) * x + (-sinO * sinW + cosO * cosW * cosI) * y;
        const zEcl = sinW * sinI * x + cosW * sinI * y;
        
        position.set(xEcl, zEcl, yEcl);
        this.instancePositions.push(position.clone());
        this.positionMap.set(i, asteroid);
        
        // Random rotation
        quaternion.setFromEuler(new THREE.Euler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        ));
        
        // Scale based on asteroid size
        const diameter = asteroid.diameter || (0.5 + Math.random() * 2);
        const s = Math.max(0.1, Math.min(diameter * 0.3, 3));
        scale.set(s, s * (0.7 + Math.random() * 0.6), s * (0.7 + Math.random() * 0.6));
        
        // Add instance
        const instanceId = this.batchedMesh!.addInstance(geometryId);
        this.batchedMesh!.setMatrixAt(instanceId, matrix.compose(position, quaternion, scale));
        
        // Color based on asteroid type
        const isNEO = asteroid.neo === true || String(asteroid.neo).toUpperCase() === 'Y';
        const isPHA = asteroid.pha === true || String(asteroid.pha).toUpperCase() === 'Y';
        
        if (isPHA) {
          color.setHSL(0, 0.8, 0.5); // Red for potentially hazardous
        } else if (isNEO) {
          color.setHSL(0.1, 0.7, 0.5); // Orange for near-Earth
        } else {
          // Gray-brown variations
          color.setHSL(0.08 + Math.random() * 0.04, 0.2 + Math.random() * 0.2, 0.3 + Math.random() * 0.2);
        }
        
        this.batchedMesh!.setColorAt(instanceId, color);
      }
      
      processedCount = endIndex;
      this.onLoadProgress?.(processedCount, total);
      
      if (processedCount < total) {
        await new Promise(resolve => setTimeout(resolve, 1));
        await processChunk();
      }
    };
    
    await processChunk();
    
    if (this.loadingAborted) return;
    
    // Compute BLAS (bottom-level acceleration structure) BVH
    (this.batchedMesh as any).computeBoundsTree();
    
    // Compute TLAS (top-level acceleration structure) BVH
    (this.batchedMesh as any).computeBVH(THREE.WebGLCoordinateSystem);
    
    // Store BVH reference for toggling
    this.bvhRef = (this.batchedMesh as any).bvh;
    
    // Store original onBeforeRender for freeze toggle
    this.originalOnBeforeRender = this.batchedMesh.onBeforeRender;
    
    // Add to scene
    this.scene.add(this.batchedMesh);
    
    console.log(`Loaded ${total} asteroids with BatchedMesh + BVH`);
  }

  // Update nearby labels based on camera position
  updateLOD(camera: THREE.Camera): void {
    if (!this.batchedMesh) return;
    
    const cameraPos = camera.position;
    
    // Calculate distance to asteroid belt center
    const beltCenter = 2.7 * this.AU;
    const distToCenter = Math.sqrt(cameraPos.x * cameraPos.x + cameraPos.z * cameraPos.z);
    const minDist = Math.abs(distToCenter - beltCenter);
    
    // Threshold for showing labels
    const nearbyThreshold = 100;
    const nearbyAsteroids: { index: number; distance: number }[] = [];
    
    // Only check nearby asteroids if close to the belt
    if (minDist < 500) {
      const maxChecks = minDist < 100 ? 20000 : 5000;
      const step = Math.max(1, Math.floor(this.instancePositions.length / maxChecks));
      
      for (let i = 0; i < this.instancePositions.length; i += step) {
        const pos = this.instancePositions[i];
        if (!pos) continue;
        
        const dist = cameraPos.distanceTo(pos);
        
        if (dist < nearbyThreshold) {
          nearbyAsteroids.push({ index: i, distance: dist });
        }
      }
    }
    
    // Update nearby labels
    this.updateNearbyLabels(nearbyAsteroids);
  }

  private updateNearbyLabels(nearbyAsteroids: { index: number; distance: number }[]): void {
    // Sort by distance and limit to closest 5
    nearbyAsteroids.sort((a, b) => a.distance - b.distance);
    const closestAsteroids = nearbyAsteroids.slice(0, 5);
    const closestIndices = new Set(closestAsteroids.map(a => a.index));
    
    // Remove labels for asteroids no longer nearby
    for (const [index, sprite] of this.nearbyLabels) {
      if (!closestIndices.has(index)) {
        this.scene.remove(sprite);
        sprite.material.dispose();
        (sprite.material as THREE.SpriteMaterial).map?.dispose();
        this.nearbyLabels.delete(index);
      }
    }
    
    // Add labels for new nearby asteroids
    for (const { index, distance } of closestAsteroids) {
      if (!this.nearbyLabels.has(index)) {
        const asteroid = this.positionMap.get(index);
        const position = this.instancePositions[index];
        if (asteroid && position) {
          const label = this.createAsteroidLabel(asteroid, position);
          this.scene.add(label);
          this.nearbyLabels.set(index, label);
        }
      } else {
        // Update existing label position and scale based on distance
        const label = this.nearbyLabels.get(index)!;
        const position = this.instancePositions[index];
        if (position) {
          label.position.copy(position).add(new THREE.Vector3(0, 3, 0));
          const scale = Math.max(2, 8 - distance * 0.3);
          label.scale.set(scale, scale / 4, 1);
          label.material.opacity = Math.max(0.3, 1 - distance / 15);
        }
      }
    }
  }

  private createAsteroidLabel(asteroid: Asteroid, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 128;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'bold 32px Arial';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.fillText(asteroid.full_name || asteroid.name || 'Unknown', canvas.width / 2, 45);
    
    context.font = '20px Arial';
    context.fillStyle = '#aaaaaa';
    const info = `Ø ${(asteroid.diameter || 0).toFixed(1)}km`;
    context.fillText(info, canvas.width / 2, 80);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      depthTest: false,
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position).add(new THREE.Vector3(0, 3, 0));
    sprite.scale.set(8, 2, 1);
    
    return sprite;
  }

  // Get asteroid at position (for raycasting)
  getAsteroidAtIndex(index: number): Asteroid | undefined {
    return this.positionMap.get(index);
  }

  getPositionAtIndex(index: number): THREE.Vector3 | undefined {
    return this.instancePositions[index];
  }

  dispose(): void {
    this.loadingAborted = true;
    
    // Remove and dispose labels
    for (const [, sprite] of this.nearbyLabels) {
      this.scene.remove(sprite);
      sprite.material.dispose();
      (sprite.material as THREE.SpriteMaterial).map?.dispose();
    }
    this.nearbyLabels.clear();
    
    // Dispose batched mesh
    if (this.batchedMesh) {
      this.scene.remove(this.batchedMesh);
      this.batchedMesh.geometry.dispose();
      if (Array.isArray(this.batchedMesh.material)) {
        this.batchedMesh.material.forEach(m => m.dispose());
      } else {
        this.batchedMesh.material.dispose();
      }
    }
    
    // Dispose textures
    this.moonTexture?.dispose();
    this.moonBumpMap?.dispose();
  }
}
