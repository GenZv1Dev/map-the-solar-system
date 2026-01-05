import * as THREE from 'three';
import { type Asteroid } from '../lib/indexedDB';

// Asteroid belt rendering using instanced meshes for performance
export class AsteroidBelt {
  scene: THREE.Scene;
  instancedMesh: THREE.InstancedMesh | null = null;
  asteroidData: Asteroid[] = [];
  
  // Position lookup for clicking/hovering
  private positionMap: Map<number, Asteroid> = new Map();
  private dummy = new THREE.Object3D();
  
  // AU scale
  private AU = 100;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // Convert orbital elements to 3D position
  private orbitalToCartesian(
    a: number, // semi-major axis (AU)
    e: number, // eccentricity
    i: number, // inclination (degrees)
    om: number, // longitude of ascending node (degrees)
    w: number, // argument of perihelion (degrees)
    ma: number // mean anomaly (degrees)
  ): THREE.Vector3 {
    // Convert to radians
    const iRad = THREE.MathUtils.degToRad(i);
    const omRad = THREE.MathUtils.degToRad(om);
    const wRad = THREE.MathUtils.degToRad(w);
    const maRad = THREE.MathUtils.degToRad(ma);
    
    // Solve Kepler's equation for eccentric anomaly (simplified iteration)
    let E = maRad;
    for (let j = 0; j < 5; j++) {
      E = maRad + e * Math.sin(E);
    }
    
    // True anomaly
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
    
    // Distance from focus
    const r = a * (1 - e * Math.cos(E));
    
    // Position in orbital plane
    const xOrbit = r * Math.cos(nu);
    const yOrbit = r * Math.sin(nu);
    
    // Transform to 3D coordinates
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

  // Estimate size from absolute magnitude
  private estimateRadius(asteroid: Asteroid): number {
    if (asteroid.diameter > 0) {
      // Use actual diameter, scale for visibility (increased scale)
      return Math.max(0.1, Math.min(2, asteroid.diameter * 0.01));
    }
    
    // Estimate from absolute magnitude
    const H = asteroid.H || 15;
    const albedo = asteroid.albedo || 0.1;
    const diameter = 1329 / Math.sqrt(albedo) * Math.pow(10, -0.2 * H);
    return Math.max(0.1, Math.min(2, diameter * 0.01));
  }

  // Get color based on asteroid properties
  private getColor(asteroid: Asteroid): THREE.Color {
    const albedo = asteroid.albedo || 0.1;
    const className = asteroid.class || '';
    
    // Color based on spectral class
    if (className.startsWith('C')) {
      return new THREE.Color(0x4a4a4a); // Dark carbonaceous
    } else if (className.startsWith('S')) {
      return new THREE.Color(0x8b7355); // Rocky/silicaceous
    } else if (className.startsWith('M')) {
      return new THREE.Color(0xa8a8a8); // Metallic
    }
    
    // Fallback based on albedo
    const brightness = 0.3 + albedo * 0.7;
    return new THREE.Color(brightness, brightness * 0.9, brightness * 0.8);
  }

  // Load asteroids and create instanced mesh
  async loadAsteroids(asteroids: Asteroid[], maxCount = 100000): Promise<void> {
    // Limit for performance
    const limitedAsteroids = asteroids.slice(0, maxCount);
    this.asteroidData = limitedAsteroids;
    
    // Remove existing mesh
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
    }
    
    // Create geometry (low-poly for performance)
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    
    // Create material with emissive glow for visibility
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.4,
      vertexColors: true,
      emissive: 0x222222,
      emissiveIntensity: 0.3,
    });
    
    // Create instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, limitedAsteroids.length);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;
    this.instancedMesh.name = 'AsteroidBelt';
    
    // Set up color attribute
    const colors = new Float32Array(limitedAsteroids.length * 3);
    
    // Position each asteroid
    limitedAsteroids.forEach((asteroid, index) => {
      // Calculate position from orbital elements
      const position = this.orbitalToCartesian(
        asteroid.a || 2.5,
        asteroid.e || 0.1,
        asteroid.i || 0,
        asteroid.om || 0,
        asteroid.w || 0,
        asteroid.ma || Math.random() * 360
      );
      
      // Random rotation
      this.dummy.position.copy(position);
      this.dummy.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      // Scale based on size
      const scale = this.estimateRadius(asteroid);
      this.dummy.scale.setScalar(scale);
      
      this.dummy.updateMatrix();
      this.instancedMesh!.setMatrixAt(index, this.dummy.matrix);
      
      // Color
      const color = this.getColor(asteroid);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      
      // Store position mapping
      this.positionMap.set(index, asteroid);
    });
    
    // Apply colors
    geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.instancedMesh);
    
    console.log(`Loaded ${limitedAsteroids.length} asteroids into scene`);
  }

  // Raycast to find asteroid under cursor
  getAsteroidAtIndex(index: number): Asteroid | undefined {
    return this.positionMap.get(index);
  }

  // Get position of specific asteroid
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

  // Cleanup
  dispose(): void {
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

// Create decorative asteroid belt for visualization
export function createDecorativeBelt(
  scene: THREE.Scene,
  innerRadius: number,
  outerRadius: number,
  count: number,
  height: number,
  color: number = 0x888888
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
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    const y = (Math.random() - 0.5) * height;
    
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
