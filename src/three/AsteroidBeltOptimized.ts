import * as THREE from 'three';
import { type Asteroid } from '../lib/indexedDB';

// Create irregular rocky geometry by distorting vertices
function createRockyGeometry(baseGeometry: THREE.BufferGeometry, roughness: number = 0.3): THREE.BufferGeometry {
  const geometry = baseGeometry.clone();
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  
  // Use seeded random for consistent shapes
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    
    // Get original distance from center
    const originalLength = vertex.length();
    
    // Apply irregular displacement based on vertex position
    // This creates consistent bumps/craters
    const noise = Math.sin(vertex.x * 5) * Math.cos(vertex.y * 7) * Math.sin(vertex.z * 3);
    const noise2 = Math.cos(vertex.x * 11) * Math.sin(vertex.y * 13) * Math.cos(vertex.z * 9);
    const displacement = 1 + (noise * 0.3 + noise2 * 0.2) * roughness;
    
    // Scale vertex
    vertex.normalize().multiplyScalar(originalLength * displacement);
    
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  
  geometry.computeVertexNormals();
  return geometry;
}

// Asteroid belt using InstancedMesh with LOD, rocky geometry, and dynamic labels
export class AsteroidBeltOptimized {
  scene: THREE.Scene;
  
  // Multiple LOD meshes
  private lodMeshes: THREE.InstancedMesh[] = [];
  private currentLOD: number = 1;
  
  asteroidData: Asteroid[] = [];
  instancedMesh: THREE.InstancedMesh | null = null;
  
  // Position lookup
  private positionMap: Map<number, Asteroid> = new Map();
  private instancePositions: THREE.Vector3[] = [];
  
  // Store matrices and colors
  private instanceMatrices: Float32Array | null = null;
  private instanceColors: Float32Array | null = null;
  
  // Textures for close-up view
  private moonTexture: THREE.Texture | null = null;
  private moonBumpMap: THREE.Texture | null = null;
  
  // Nearby asteroid labels
  private nearbyLabels: Map<number, THREE.Sprite> = new Map();
  
  // AU scale
  private AU = 100;

  // Loading state
  private loadingAborted = false;
  
  // Callbacks
  onLoadProgress?: (loaded: number, total: number) => void;
  onNearbyAsteroid?: (asteroid: Asteroid, position: THREE.Vector3) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loadTextures();
  }

  private loadTextures(): void {
    const textureLoader = new THREE.TextureLoader();
    
    // Load moon texture for close-up asteroids
    textureLoader.load('/textures/moonmap1k.jpg', (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.moonTexture = texture;
      this.updateHighLODMaterial();
    });
    
    textureLoader.load('/textures/moonbump1k.jpg', (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.moonBumpMap = texture;
      this.updateHighLODMaterial();
    });
  }

  private updateHighLODMaterial(): void {
    if (!this.moonTexture || !this.moonBumpMap) return;
    if (this.lodMeshes.length < 4) return;
    
    // Update high LOD material with textures
    const highLODMesh = this.lodMeshes[3];
    if (highLODMesh) {
      const material = highLODMesh.material as THREE.MeshStandardMaterial;
      material.map = this.moonTexture;
      material.bumpMap = this.moonBumpMap;
      material.bumpScale = 0.05;
      material.needsUpdate = true;
      console.log('Asteroid high LOD texture applied');
    }
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
      return new THREE.Color(0x4a4a4a); // Dark carbonaceous
    } else if (className.startsWith('S')) {
      return new THREE.Color(0x8b7355); // Stony/silicaceous
    } else if (className.startsWith('M')) {
      return new THREE.Color(0xa8a8a8); // Metallic
    } else if (className.startsWith('V')) {
      return new THREE.Color(0x6a5a7a); // Vestoid (basaltic)
    }
    
    const albedo = asteroid.albedo || 0.1;
    const brightness = 0.3 + albedo * 0.7;
    return new THREE.Color(brightness, brightness * 0.9, brightness * 0.8);
  }

  // Create asteroid label sprite
  private createAsteroidLabel(asteroid: Asteroid, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    
    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
    ctx.fill();
    
    // Draw name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(asteroid.name || `Asteroid ${asteroid.spkid}`, canvas.width / 2, 25);
    
    // Draw value if available
    if (asteroid.estimatedValue && asteroid.estimatedValue > 0) {
      ctx.fillStyle = '#00ff88';
      ctx.font = '14px Arial';
      const valueStr = asteroid.estimatedValue >= 1e12 
        ? `$${(asteroid.estimatedValue / 1e12).toFixed(1)}T`
        : asteroid.estimatedValue >= 1e9
        ? `$${(asteroid.estimatedValue / 1e9).toFixed(1)}B`
        : `$${(asteroid.estimatedValue / 1e6).toFixed(1)}M`;
      ctx.fillText(valueStr, canvas.width / 2, 48);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position).add(new THREE.Vector3(0, 3, 0));
    sprite.scale.set(8, 2, 1);
    
    return sprite;
  }

  // Load asteroids with progressive loading
  async loadAsteroids(asteroids: Asteroid[], maxCount = 200000): Promise<void> {
    this.loadingAborted = true;
    await new Promise(resolve => setTimeout(resolve, 50));
    this.loadingAborted = false;
    
    const limitedAsteroids = asteroids.slice(0, maxCount);
    this.asteroidData = limitedAsteroids;
    const total = limitedAsteroids.length;
    
    this.disposeLODMeshes();
    this.positionMap.clear();
    this.instancePositions = [];
    
    if (total === 0) return;
    
    // Create rocky LOD geometries with vertex displacement
    const lodGeometries = [
      // LOD 0: Very far - simple octahedron (8 faces)
      createRockyGeometry(new THREE.OctahedronGeometry(1, 0), 0.4),
      // LOD 1: Far - slightly more detail (32 faces)
      createRockyGeometry(new THREE.OctahedronGeometry(1, 1), 0.35),
      // LOD 2: Medium - icosahedron (80 faces)
      createRockyGeometry(new THREE.IcosahedronGeometry(1, 1), 0.3),
      // LOD 3: Close - high detail with texture (320 faces)
      createRockyGeometry(new THREE.IcosahedronGeometry(1, 2), 0.25),
    ];
    
    // Materials for each LOD level
    const baseMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.15,
      vertexColors: true,
      flatShading: true, // Makes rocky appearance more pronounced
    });
    
    // High LOD gets texture when loaded
    const highLODMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.2,
      vertexColors: true,
      flatShading: false, // Smooth for textured
      map: this.moonTexture,
      bumpMap: this.moonBumpMap,
      bumpScale: 0.05,
    });
    
    // Create LOD meshes
    for (let i = 0; i < lodGeometries.length; i++) {
      const material = i === 3 ? highLODMaterial : baseMaterial.clone();
      const mesh = new THREE.InstancedMesh(lodGeometries[i], material, total);
      mesh.name = `AsteroidBelt_LOD${i}`;
      mesh.frustumCulled = true;
      mesh.visible = (i === 1);
      this.lodMeshes.push(mesh);
    }
    
    this.instancedMesh = this.lodMeshes[1];
    this.instanceMatrices = new Float32Array(total * 16);
    this.instanceColors = new Float32Array(total * 3);
    
    const dummy = new THREE.Object3D();
    
    const CHUNK_SIZE = 500;
    const DELAY_MS = 1;
    let processedCount = 0;
    
    this.onLoadProgress?.(0, total);
    
    const processChunk = async (): Promise<boolean> => {
      const chunkEnd = Math.min(processedCount + CHUNK_SIZE, total);
      
      for (let i = processedCount; i < chunkEnd; i++) {
        if (this.loadingAborted) return false;
        
        const asteroid = limitedAsteroids[i];
        
        const pos = this.orbitalToCartesian(
          asteroid.a || 2.5,
          asteroid.e || 0.1,
          asteroid.i || 0,
          asteroid.om || 0,
          asteroid.w || 0,
          asteroid.ma || Math.random() * 360
        );
        
        // Store position for nearby detection
        this.instancePositions[i] = pos.clone();
        
        dummy.position.copy(pos);
        dummy.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        
        const s = this.estimateRadius(asteroid);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        
        dummy.matrix.toArray(this.instanceMatrices!, i * 16);
        
        for (const mesh of this.lodMeshes) {
          mesh.setMatrixAt(i, dummy.matrix);
        }
        
        const color = this.getColor(asteroid);
        this.instanceColors![i * 3] = color.r;
        this.instanceColors![i * 3 + 1] = color.g;
        this.instanceColors![i * 3 + 2] = color.b;
        
        this.positionMap.set(i, asteroid);
      }
      
      processedCount = chunkEnd;
      this.onLoadProgress?.(processedCount, total);
      return processedCount < total;
    };
    
    while (!this.loadingAborted) {
      const hasMore = await processChunk();
      if (!hasMore) break;
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
    
    if (this.loadingAborted || this.lodMeshes.length === 0) return;
    
    // Apply colors
    const colorAttr = new THREE.InstancedBufferAttribute(this.instanceColors!, 3);
    for (const mesh of this.lodMeshes) {
      mesh.geometry.setAttribute('color', colorAttr.clone());
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }
    
    console.log(`Loaded ${total} asteroids with rocky geometry and ${this.lodMeshes.length} LOD levels`);
  }

  // Update LOD and nearby labels based on camera
  updateLOD(camera: THREE.Camera): void {
    if (this.lodMeshes.length === 0) return;
    
    const cameraPos = camera.position;
    
    // Find distance to nearest asteroid for LOD
    let minDist = Infinity;
    const nearbyThreshold = 15; // Distance to show labels
    const nearbyAsteroids: { index: number; distance: number }[] = [];
    
    // Sample positions for performance (check every Nth asteroid)
    const sampleRate = Math.max(1, Math.floor(this.instancePositions.length / 10000));
    
    for (let i = 0; i < this.instancePositions.length; i += sampleRate) {
      const pos = this.instancePositions[i];
      if (!pos) continue;
      
      const dist = cameraPos.distanceTo(pos);
      if (dist < minDist) minDist = dist;
      
      if (dist < nearbyThreshold) {
        nearbyAsteroids.push({ index: i, distance: dist });
      }
    }
    
    // Also check non-sampled asteroids if we're very close
    if (minDist < 50) {
      for (let i = 0; i < this.instancePositions.length; i++) {
        if (i % sampleRate === 0) continue; // Already checked
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
    
    // Determine LOD based on nearest distance
    let newLOD: number;
    if (minDist > 500) {
      newLOD = 0;
    } else if (minDist > 200) {
      newLOD = 1;
    } else if (minDist > 50) {
      newLOD = 2;
    } else {
      newLOD = 3;
    }
    
    if (newLOD !== this.currentLOD) {
      if (this.lodMeshes[this.currentLOD]) {
        this.lodMeshes[this.currentLOD].visible = false;
      }
      if (this.lodMeshes[newLOD]) {
        this.lodMeshes[newLOD].visible = true;
        this.instancedMesh = this.lodMeshes[newLOD];
      }
      this.currentLOD = newLOD;
    }
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
          // Scale label based on distance (bigger when closer)
          const scale = Math.max(2, 8 - distance * 0.3);
          label.scale.set(scale, scale / 4, 1);
          // Fade out at edges
          label.material.opacity = Math.max(0.3, 1 - distance / 15);
        }
      }
    }
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

  private disposeLODMeshes(): void {
    for (const mesh of this.lodMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.lodMeshes = [];
    this.instancedMesh = null;
    
    // Dispose labels
    for (const [, sprite] of this.nearbyLabels) {
      this.scene.remove(sprite);
      sprite.material.dispose();
      (sprite.material as THREE.SpriteMaterial).map?.dispose();
    }
    this.nearbyLabels.clear();
  }

  dispose(): void {
    this.loadingAborted = true;
    this.disposeLODMeshes();
    this.positionMap.clear();
    this.instancePositions = [];
    this.asteroidData = [];
    this.moonTexture?.dispose();
    this.moonBumpMap?.dispose();
  }
}

// Create decorative belt with rocky geometry
export function createDecorativeBelt(
  scene: THREE.Scene,
  innerRadius: number,
  outerRadius: number,
  count: number,
  height: number,
  color: number = 0x888888,
  torusShape: boolean = false
): THREE.InstancedMesh {
  // Create rocky geometry
  const baseGeometry = new THREE.IcosahedronGeometry(1, 1);
  const geometry = createRockyGeometry(baseGeometry, 0.4);
  
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.15,
    flatShading: true,
    emissive: color,
    emissiveIntensity: 0.05,
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
