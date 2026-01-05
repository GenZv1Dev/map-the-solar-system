import * as THREE from 'three';
import { type Asteroid } from '../lib/indexedDB';

// Simpler asteroid belt using InstancedMesh with progressive loading
// This avoids the memory issues of BatchedMesh for large datasets
export class AsteroidBeltOptimized {
  scene: THREE.Scene;
  instancedMesh: THREE.InstancedMesh | null = null;
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

  // Load asteroids with slow progressive loading to avoid blocking
  async loadAsteroids(asteroids: Asteroid[], maxCount = 200000): Promise<void> {
    // Abort any existing load
    this.loadingAborted = true;
    await new Promise(resolve => setTimeout(resolve, 50));
    this.loadingAborted = false;
    
    // Limit count for performance - 200k is reasonable for InstancedMesh
    const limitedAsteroids = asteroids.slice(0, maxCount);
    this.asteroidData = limitedAsteroids;
    const total = limitedAsteroids.length;
    
    // Remove existing mesh
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    this.positionMap.clear();
    
    if (total === 0) {
      return;
    }
    
    // Create simple low-poly geometry
    const geometry = new THREE.OctahedronGeometry(1, 0); // Very low poly - 8 faces
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.7,
      metalness: 0.3,
      vertexColors: true,
      emissive: 0x111111,
      emissiveIntensity: 0.2,
    });
    
    // Create InstancedMesh
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, total);
    this.instancedMesh.name = 'AsteroidBelt';
    this.instancedMesh.frustumCulled = true;
    
    // Set up color attribute
    const colors = new Float32Array(total * 3);
    
    const dummy = new THREE.Object3D();
    
    // Progressive loading - process in very small chunks with delays
    const CHUNK_SIZE = 500; // Small chunks for smooth UI
    const DELAY_MS = 1; // 1ms delay between chunks
    let processedCount = 0;
    
    // Report initial progress
    this.onLoadProgress?.(0, total);
    
    const processChunk = async (): Promise<boolean> => {
      const chunkEnd = Math.min(processedCount + CHUNK_SIZE, total);
      
      for (let i = processedCount; i < chunkEnd; i++) {
        if (this.loadingAborted) {
          return false;
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
        
        dummy.position.copy(pos);
        dummy.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        
        const s = this.estimateRadius(asteroid);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        
        this.instancedMesh!.setMatrixAt(i, dummy.matrix);
        
        // Set color
        const color = this.getColor(asteroid);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        // Store mapping
        this.positionMap.set(i, asteroid);
      }
      
      processedCount = chunkEnd;
      
      // Report progress
      this.onLoadProgress?.(processedCount, total);
      
      return processedCount < total;
    };
    
    // Process all chunks with delays
    while (!this.loadingAborted) {
      const hasMore = await processChunk();
      if (!hasMore) break;
      
      // Small delay to allow UI updates
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
    
    if (this.loadingAborted || !this.instancedMesh) {
      return;
    }
    
    // Apply colors
    geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    
    // Update instance matrix
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    
    this.scene.add(this.instancedMesh);
    
    console.log(`Loaded ${total} asteroids with InstancedMesh`);
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
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
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
