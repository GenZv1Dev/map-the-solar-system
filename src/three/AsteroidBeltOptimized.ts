import * as THREE from 'three';
import { type Asteroid } from '../lib/indexedDB';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { extendBatchedMeshPrototype, createRadixSort } from '@three.ez/batched-mesh-extensions';

// Extend prototypes for BVH acceleration
THREE.Mesh.prototype.raycast = acceleratedRaycast;
// @ts-expect-error - adding BVH methods
THREE.Mesh.prototype.computeBoundsTree = computeBoundsTree;
// @ts-expect-error - adding BVH methods
THREE.Mesh.prototype.disposeBoundsTree = disposeBoundsTree;

// Extend BatchedMesh prototype
extendBatchedMeshPrototype();

// Optimized asteroid belt using BatchedMesh with BVH and LOD
export class AsteroidBeltOptimized {
  scene: THREE.Scene;
  batchedMesh: THREE.BatchedMesh | null = null;
  asteroidData: Asteroid[] = [];
  
  // Position lookup for clicking/hovering
  private positionMap: Map<number, Asteroid> = new Map();
  
  // AU scale
  private AU = 100;

  // Loading state
  private loadingAborted = false;
  
  // Callbacks
  onLoadProgress?: (loaded: number, total: number) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // Convert orbital elements to 3D position
  private orbitalToCartesian(
    a: number,
    e: number,
    i: number,
    om: number,
    w: number,
    ma: number
  ): THREE.Vector3 {
    const iRad = THREE.MathUtils.degToRad(i);
    const omRad = THREE.MathUtils.degToRad(om);
    const wRad = THREE.MathUtils.degToRad(w);
    const maRad = THREE.MathUtils.degToRad(ma);
    
    let E = maRad;
    for (let j = 0; j < 5; j++) {
      E = maRad + e * Math.sin(E);
    }
    
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
    
    const r = a * (1 - e * Math.cos(E));
    const xOrbit = r * Math.cos(nu);
    const yOrbit = r * Math.sin(nu);
    
    const cosOm = Math.cos(omRad);
    const sinOm = Math.sin(omRad);
    const cosI = Math.cos(iRad);
    const sinI = Math.sin(iRad);
    const cosW = Math.cos(wRad);
    const sinW = Math.sin(wRad);
    
    const x = (cosOm * cosW - sinOm * sinW * cosI) * xOrbit + 
              (-cosOm * sinW - sinOm * cosW * cosI) * yOrbit;
    const y = (sinOm * cosW + cosOm * sinW * cosI) * xOrbit + 
              (-sinOm * sinW + cosOm * cosW * cosI) * yOrbit;
    const z = (sinW * sinI) * xOrbit + (cosW * sinI) * yOrbit;
    
    return new THREE.Vector3(x * this.AU, z * this.AU, y * this.AU);
  }

  private estimateRadius(asteroid: Asteroid): number {
    if (asteroid.diameter > 0) {
      return Math.max(0.1, Math.min(2, asteroid.diameter * 0.01));
    }
    const H = asteroid.H || 15;
    const albedo = asteroid.albedo || 0.1;
    const diameter = 1329 / Math.sqrt(albedo) * Math.pow(10, -0.2 * H);
    return Math.max(0.1, Math.min(2, diameter * 0.01));
  }

  private getColor(asteroid: Asteroid): THREE.Color {
    const className = asteroid.class || '';
    
    if (className.startsWith('C')) {
      return new THREE.Color(0x4a4a4a);
    } else if (className.startsWith('S')) {
      return new THREE.Color(0x8b7355);
    } else if (className.startsWith('M')) {
      return new THREE.Color(0xa8a8a8);
    }
    
    const albedo = asteroid.albedo || 0.1;
    const brightness = 0.3 + albedo * 0.7;
    return new THREE.Color(brightness, brightness * 0.9, brightness * 0.8);
  }

  // Load asteroids using chunked loading for smooth UI
  async loadAsteroids(asteroids: Asteroid[], maxCount = 1000000): Promise<void> {
    // Abort any existing load
    this.loadingAborted = true;
    await new Promise(resolve => setTimeout(resolve, 10));
    this.loadingAborted = false;
    
    const limitedAsteroids = asteroids.slice(0, maxCount);
    this.asteroidData = limitedAsteroids;
    const total = limitedAsteroids.length;
    
    // Remove existing mesh
    if (this.batchedMesh) {
      this.scene.remove(this.batchedMesh);
      this.batchedMesh.dispose();
      this.batchedMesh = null;
    }
    this.positionMap.clear();
    
    if (total === 0) {
      return;
    }
    
    // Create LOD geometries (high, medium, low detail)
    const geometryHigh = new THREE.IcosahedronGeometry(1, 2); // 80 faces
    const geometryMed = new THREE.IcosahedronGeometry(1, 1);  // 20 faces
    const geometryLow = new THREE.OctahedronGeometry(1, 0);   // 8 faces
    
    // Calculate vertex/index counts
    const vertexCount = geometryHigh.attributes.position.count + 
                        geometryMed.attributes.position.count + 
                        geometryLow.attributes.position.count;
    const indexCount = (geometryHigh.index?.count || 0) + 
                       (geometryMed.index?.count || 0) + 
                       (geometryLow.index?.count || 0);
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.7,
      metalness: 0.3,
    });
    
    // Create BatchedMesh with capacity for all asteroids
    this.batchedMesh = new THREE.BatchedMesh(
      total,
      vertexCount * total, // Vertex capacity
      indexCount * total,  // Index capacity
      material
    );
    this.batchedMesh.name = 'AsteroidBelt';
    
    // Enable sorting for better performance (extension method)
    const mesh = this.batchedMesh as THREE.BatchedMesh & { customSort?: unknown };
    if ('customSort' in mesh) {
      mesh.customSort = createRadixSort(this.batchedMesh);
    }
    
    // Add geometries
    const geoIdHigh = this.batchedMesh.addGeometry(geometryHigh);
    const geoIdMed = this.batchedMesh.addGeometry(geometryMed);
    const geoIdLow = this.batchedMesh.addGeometry(geometryLow);
    
    // Choose geometry based on asteroid importance
    const getGeometryId = (asteroid: Asteroid): number => {
      // PHAs and NEOs get high detail
      if (asteroid.pha || asteroid.neo) return geoIdHigh;
      // Large asteroids get medium detail
      if (asteroid.diameter > 10) return geoIdMed;
      // Everything else gets low detail
      return geoIdLow;
    };
    
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    
    // Chunked loading - process in batches with requestAnimationFrame
    const CHUNK_SIZE = 5000; // Process 5000 asteroids per frame
    let processedCount = 0;
    
    const processChunk = (): Promise<void> => {
      return new Promise((resolve) => {
        const chunkEnd = Math.min(processedCount + CHUNK_SIZE, total);
        
        for (let i = processedCount; i < chunkEnd; i++) {
          if (this.loadingAborted) {
            resolve();
            return;
          }
          
          const asteroid = limitedAsteroids[i];
          
          // Calculate position
          const pos = this.orbitalToCartesian(
            asteroid.a || 2.5,
            asteroid.e || 0.1,
            asteroid.i || 0,
            asteroid.om || 0,
            asteroid.w || 0,
            asteroid.ma || Math.random() * 360
          );
          
          position.copy(pos);
          quaternion.set(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
          ).normalize();
          
          const s = this.estimateRadius(asteroid);
          scale.setScalar(s);
          
          matrix.compose(position, quaternion, scale);
          
          // Add instance
          const geometryId = getGeometryId(asteroid);
          const instanceId = this.batchedMesh!.addInstance(geometryId);
          this.batchedMesh!.setMatrixAt(instanceId, matrix);
          
          // Set color
          color.copy(this.getColor(asteroid));
          this.batchedMesh!.setColorAt(instanceId, color);
          
          // Store mapping
          this.positionMap.set(instanceId, asteroid);
        }
        
        processedCount = chunkEnd;
        
        // Report progress
        this.onLoadProgress?.(processedCount, total);
        
        if (processedCount < total && !this.loadingAborted) {
          // Schedule next chunk
          requestAnimationFrame(() => {
            processChunk().then(resolve);
          });
        } else {
          resolve();
        }
      });
    };
    
    // Start processing
    await processChunk();
    
    if (this.loadingAborted || !this.batchedMesh) {
      return;
    }
    
    // Compute BVH for fast raycasting and frustum culling
    try {
      const meshWithBVH = this.batchedMesh as THREE.BatchedMesh & { computeBVH?: (coordSystem: number) => void };
      if (meshWithBVH.computeBVH) {
        meshWithBVH.computeBVH(THREE.WebGLCoordinateSystem);
      }
    } catch (e) {
      console.warn('Could not compute BVH:', e);
    }
    
    this.scene.add(this.batchedMesh);
    
    console.log(`Loaded ${total} asteroids with BatchedMesh optimization`);
  }

  getAsteroidAtIndex(index: number): Asteroid | undefined {
    return this.positionMap.get(index);
  }

  getAsteroidPosition(asteroid: Asteroid): THREE.Vector3 {
    return this.orbitalToCartesian(
      asteroid.a || 2.5,
      asteroid.e || 0.1,
      asteroid.i || 0,
      asteroid.om || 0,
      asteroid.w || 0,
      asteroid.ma || 0
    );
  }

  dispose(): void {
    this.loadingAborted = true;
    if (this.batchedMesh) {
      this.scene.remove(this.batchedMesh);
      this.batchedMesh.dispose();
      this.batchedMesh = null;
    }
    this.positionMap.clear();
    this.asteroidData = [];
  }
}

// Create decorative belt (unchanged - already efficient for small counts)
export function createDecorativeBelt(
  scene: THREE.Scene,
  innerRadius: number,
  outerRadius: number,
  count: number,
  height: number,
  color: number = 0x888888,
  torusShape: boolean = false
): THREE.InstancedMesh {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.1,
  });
  
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  
  const midRadius = (innerRadius + outerRadius) / 2;
  const tubeRadius = (outerRadius - innerRadius) / 2;
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    
    let radius: number;
    let y: number;
    
    if (torusShape) {
      const crossSectionAngle = Math.random() * Math.PI * 2;
      const crossSectionRadius = Math.random() * tubeRadius;
      radius = midRadius + Math.cos(crossSectionAngle) * crossSectionRadius;
      y = Math.sin(crossSectionAngle) * crossSectionRadius * (height / tubeRadius);
    } else {
      radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      y = (Math.random() - 0.5) * height;
    }
    
    dummy.position.set(
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius
    );
    
    dummy.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    
    const scale = 0.2 + Math.random() * 0.5;
    dummy.scale.setScalar(scale);
    
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  
  return mesh;
}
