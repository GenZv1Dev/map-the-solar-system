import * as THREE from 'three';
import { SolarSystem, AU } from './SolarSystem';
import { AsteroidBelt, createDecorativeBelt } from './AsteroidBelt';
import { BlackHole } from './BlackHole';
import { Label3DSystem } from './Label3D';
import { FlyControls } from './FlyControls';
import { SolarFlares } from './SolarFlares';
import { type Asteroid } from '../lib/indexedDB';

export interface SceneConfig {
  container: HTMLElement;
  onObjectSelected?: (name: string, position: THREE.Vector3) => void;
  onControlsLocked?: (locked: boolean) => void;
}

export class SceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: FlyControls;
  private clock: THREE.Clock;
  
  private solarSystem: SolarSystem;
  private asteroidBelt: AsteroidBelt;
  private blackHole: BlackHole;
  private labelSystem: Label3DSystem;
  private solarFlares: SolarFlares;
  
  // Decorative belts
  private mainBelt: THREE.InstancedMesh | null = null;
  private kuiperBelt: THREE.InstancedMesh | null = null;
  
  private isRunning = false;
  private animationId: number | null = null;
  
  // Tracking mode
  private trackingTarget: string | null = null;
  private trackingOffset: THREE.Vector3 = new THREE.Vector3(0, 20, 50);
  
  // Callbacks
  private onObjectSelected?: (name: string, position: THREE.Vector3) => void;
  private onControlsLocked?: (locked: boolean) => void;

  constructor(config: SceneConfig) {
    this.container = config.container;
    this.onObjectSelected = config.onObjectSelected;
    this.onControlsLocked = config.onControlsLocked;
    
    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000005);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      50000
    );
    this.camera.position.set(0, 50, 200);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer - disable shadows to avoid Earth shadow issues
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);
    
    // Clock
    this.clock = new THREE.Clock();
    
    // Controls
    this.controls = new FlyControls(this.camera, this.renderer.domElement);
    this.controls.movementSpeed = 100;
    this.controls.onLock = () => this.onControlsLocked?.(true);
    this.controls.onUnlock = () => this.onControlsLocked?.(false);
    this.controls.onUserInput = () => this.stopTracking();  // Break tracking on user input
    
    // Create solar system
    this.solarSystem = new SolarSystem(this.scene);
    
    // Create solar flares (particle explosions from the sun)
    this.solarFlares = new SolarFlares(this.scene, new THREE.Vector3(0, 0, 0));
    
    // Create asteroid belt manager
    this.asteroidBelt = new AsteroidBelt(this.scene);
    
    // Create decorative belts
    this.createDecorativeBelts();
    
    // Create black hole (at galactic center, extremely far from solar system)
    this.blackHole = new BlackHole(
      this.scene,
      new THREE.Vector3(-80000, 0, -80000), // Very far away to represent Milky Way center
      2000  // Much larger for visibility from distance
    );
    
    // Create label system (3D sprite-based labels)
    this.labelSystem = new Label3DSystem(this.scene, this.camera);
    this.createLabels();
    
    // Event listeners
    window.addEventListener('resize', this.handleResize);
    
    // Start animation
    this.start();
  }

  private createDecorativeBelts(): void {
    // Main asteroid belt (between Mars and Jupiter)
    this.mainBelt = createDecorativeBelt(
      this.scene,
      2.2 * AU,
      3.2 * AU,
      30000,
      0.2 * AU,
      0x666666
    );
    this.mainBelt.name = 'MainAsteroidBelt';
    
    // Kuiper belt (beyond Neptune) - vast doughnut-shaped region
    this.kuiperBelt = createDecorativeBelt(
      this.scene,
      30 * AU,
      55 * AU,  // Extended outer radius
      50000,    // More objects for icy bodies
      5 * AU,   // Thicker belt
      0x556688  // Icy bluish color
    );
    this.kuiperBelt.name = 'KuiperBelt';
  }

  private createLabels(): void {
    // Sun label
    this.labelSystem.createLabel({
      name: 'Sun',
      position: new THREE.Vector3(0, 20, 0),
      type: 'star',
    });
    
    // Planet labels (including dwarf planets)
    const planets = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Eris', 'Makemake', 'Haumea'];
    planets.forEach(name => {
      const position = this.solarSystem.getPosition(name);
      if (position) {
        position.y += 8;
        this.labelSystem.createLabel({
          name,
          position,
          type: 'planet',
        });
      }
    });
    
    // Region labels
    this.labelSystem.createLabel({
      name: 'Main Asteroid Belt',
      position: new THREE.Vector3(2.7 * AU, 30, 0),
      type: 'region',
      color: 0x888888,
    });
    
    this.labelSystem.createLabel({
      name: 'Kuiper Belt',
      position: new THREE.Vector3(40 * AU, 80, 0),
      type: 'region',
      color: 0x666688,
    });
    
    this.labelSystem.createLabel({
      name: 'Black Hole',
      position: this.blackHole.getPosition().clone().add(new THREE.Vector3(0, 100, 0)),
      type: 'blackhole',
    });
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  };

  async loadAsteroids(asteroids: Asteroid[]): Promise<void> {
    await this.asteroidBelt.loadAsteroids(asteroids);
  }

  flyTo(name: string): void {
    let targetPosition: THREE.Vector3 | null = null;
    
    if (name === 'BlackHole') {
      targetPosition = this.blackHole.getPosition();
      this.trackingOffset = new THREE.Vector3(0, 500, 2000);
    } else if (name === 'MainAsteroidBelt') {
      targetPosition = new THREE.Vector3(2.7 * AU, 0, 0);
      this.trackingTarget = null;  // Don't track belts
    } else if (name === 'KuiperBelt') {
      targetPosition = new THREE.Vector3(40 * AU, 0, 0);
      this.trackingTarget = null;  // Don't track belts
    } else {
      targetPosition = this.solarSystem.getPosition(name);
      // Set appropriate offset based on object size
      const obj = this.solarSystem.getObject(name);
      if (obj) {
        const scale = name === 'Sun' ? 100 : (name.includes('Jupiter') || name.includes('Saturn') ? 80 : 30);
        this.trackingOffset = new THREE.Vector3(0, scale * 0.5, scale);
      }
    }
    
    if (!targetPosition) return;
    
    // Enable tracking mode
    this.trackingTarget = name;
    
    // Animate camera position
    const startPosition = this.camera.position.clone();
    const duration = 2000;
    const startTime = performance.now();
    
    const animateFly = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease in-out
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      // Get updated target position (planet may have moved)
      let currentTarget = targetPosition!;
      if (this.trackingTarget === 'BlackHole') {
        currentTarget = this.blackHole.getPosition();
      } else if (this.trackingTarget) {
        const pos = this.solarSystem.getPosition(this.trackingTarget);
        if (pos) currentTarget = pos;
      }
      
      const currentCameraTarget = currentTarget.clone().add(this.trackingOffset);
      this.camera.position.lerpVectors(startPosition, currentCameraTarget, eased);
      this.camera.lookAt(currentTarget);
      
      if (progress < 1) {
        requestAnimationFrame(animateFly);
      } else {
        this.onObjectSelected?.(name, currentTarget);
      }
    };
    
    requestAnimationFrame(animateFly);
  }

  // Stop tracking and return to free flight
  stopTracking(): void {
    this.trackingTarget = null;
  }

  flyToAsteroid(asteroid: Asteroid): void {
    const position = this.asteroidBelt.getAsteroidPosition(asteroid);
    
    const offset = new THREE.Vector3(0, 2, 5);
    const cameraTarget = position.clone().add(offset);
    
    const startPosition = this.camera.position.clone();
    const duration = 2000;
    const startTime = performance.now();
    
    const animateFly = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      this.camera.position.lerpVectors(startPosition, cameraTarget, eased);
      this.controls.lookAt(position.x, position.y, position.z);
      
      if (progress < 1) {
        requestAnimationFrame(animateFly);
      } else {
        this.onObjectSelected?.(asteroid.name || asteroid.pdes, position);
      }
    };
    
    requestAnimationFrame(animateFly);
  }

  setTimeScale(scale: number): void {
    this.solarSystem.setTimeScale(scale);
  }

  private update(): void {
    const delta = this.clock.getDelta();
    
    // Only update controls if not tracking
    if (!this.trackingTarget) {
      this.controls.update(delta);
    }
    
    this.solarSystem.update(delta);
    this.blackHole.update(delta);
    this.solarFlares.update(delta);
    
    // Track target if in tracking mode
    if (this.trackingTarget) {
      let targetPosition: THREE.Vector3 | null = null;
      
      if (this.trackingTarget === 'BlackHole') {
        targetPosition = this.blackHole.getPosition();
      } else {
        targetPosition = this.solarSystem.getPosition(this.trackingTarget);
      }
      
      if (targetPosition) {
        const desiredCameraPos = targetPosition.clone().add(this.trackingOffset);
        this.camera.position.lerp(desiredCameraPos, 0.05);  // Smooth follow
        this.camera.lookAt(targetPosition);
      }
    }
    
    // Update planet labels to follow their planets (including dwarf planets)
    const planets = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Eris', 'Makemake', 'Haumea'];
    planets.forEach(name => {
      const position = this.solarSystem.getPosition(name);
      if (position) {
        position.y += 8;
        this.labelSystem.updateLabel(name, position);
      }
    });
    
    // Update all labels (scale based on camera distance)
    this.labelSystem.update();
    
    this.renderer.render(this.scene, this.camera);
  }

  private animate = (): void => {
    if (!this.isRunning) return;
    
    this.animationId = requestAnimationFrame(this.animate);
    this.update();
  };

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getNavigationItems(): Array<{ name: string; type: string }> {
    const items: Array<{ name: string; type: string }> = [
      { name: 'Sun', type: 'star' },
    ];
    
    // Add planets
    const planets = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
    planets.forEach(name => {
      items.push({ name, type: 'planet' });
    });
    
    // Add dwarf planets
    const dwarfPlanets = ['Pluto', 'Eris', 'Makemake', 'Haumea'];
    dwarfPlanets.forEach(name => {
      items.push({ name, type: 'planet' });
    });
    
    // Add regions
    items.push({ name: 'Main Asteroid Belt', type: 'region' });
    items.push({ name: 'Kuiper Belt', type: 'region' });
    items.push({ name: 'BlackHole', type: 'blackhole' });
    
    return items;
  }

  dispose(): void {
    this.stop();
    
    window.removeEventListener('resize', this.handleResize);
    
    this.controls.disconnect();
    this.labelSystem.dispose();
    this.asteroidBelt.dispose();
    this.blackHole.dispose();
    this.solarFlares.dispose();
    
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
