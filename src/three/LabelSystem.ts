import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface LabelData {
  name: string;
  position: THREE.Vector3;
  type: 'planet' | 'moon' | 'asteroid' | 'region' | 'blackhole';
  onClick?: () => void;
  data?: Record<string, unknown>;
}

export class LabelSystem {
  private labelRenderer: CSS2DRenderer;
  private labels: Map<string, CSS2DObject> = new Map();
  private container: HTMLElement;
  private camera: THREE.Camera;
  
  // Distance thresholds for label visibility
  private readonly LABEL_VISIBLE_DISTANCE = 5000;
  private readonly LABEL_FADE_START = 1000;

  constructor(container: HTMLElement, camera: THREE.Camera) {
    this.container = container;
    this.camera = camera;
    
    // Create CSS2D renderer
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.left = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.labelRenderer.domElement);
  }

  createLabel(data: LabelData): CSS2DObject {
    const labelDiv = document.createElement('div');
    labelDiv.className = this.getLabelClass(data.type);
    labelDiv.innerHTML = this.getLabelContent(data);
    
    if (data.onClick) {
      labelDiv.style.pointerEvents = 'auto';
      labelDiv.style.cursor = 'pointer';
      labelDiv.addEventListener('click', data.onClick);
    }
    
    const label = new CSS2DObject(labelDiv);
    label.position.copy(data.position);
    label.name = data.name;
    
    this.labels.set(data.name, label);
    return label;
  }

  private getLabelClass(type: LabelData['type']): string {
    const baseClass = 'label px-2 py-1 rounded text-white text-sm font-semibold whitespace-nowrap transition-all duration-200';
    
    switch (type) {
      case 'planet':
        return `${baseClass} bg-blue-600/80 border border-blue-400`;
      case 'moon':
        return `${baseClass} bg-gray-600/80 border border-gray-400 text-xs`;
      case 'asteroid':
        return `${baseClass} bg-amber-700/80 border border-amber-500 text-xs`;
      case 'region':
        return `${baseClass} bg-purple-600/80 border border-purple-400 text-lg`;
      case 'blackhole':
        return `${baseClass} bg-black border border-red-500 text-red-400`;
      default:
        return baseClass;
    }
  }

  private getLabelContent(data: LabelData): string {
    const icon = this.getTypeIcon(data.type);
    return `<span class="flex items-center gap-1">${icon}<span>${data.name}</span></span>`;
  }

  private getTypeIcon(type: LabelData['type']): string {
    switch (type) {
      case 'planet':
        return '🪐';
      case 'moon':
        return '🌙';
      case 'asteroid':
        return '☄️';
      case 'region':
        return '🌌';
      case 'blackhole':
        return '⚫';
      default:
        return '';
    }
  }

  updateLabel(name: string, position: THREE.Vector3): void {
    const label = this.labels.get(name);
    if (label) {
      label.position.copy(position);
    }
  }

  removeLabel(name: string): void {
    const label = this.labels.get(name);
    if (label) {
      label.parent?.remove(label);
      this.labels.delete(name);
    }
  }

  update(scene: THREE.Scene): void {
    // Update label visibility based on distance
    this.labels.forEach((label) => {
      const distance = this.camera.position.distanceTo(label.position);
      const element = label.element as HTMLElement;
      
      if (distance > this.LABEL_VISIBLE_DISTANCE) {
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
      } else if (distance > this.LABEL_FADE_START) {
        const opacity = 1 - (distance - this.LABEL_FADE_START) / (this.LABEL_VISIBLE_DISTANCE - this.LABEL_FADE_START);
        element.style.opacity = String(opacity);
        element.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
      } else {
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
      }
    });
    
    this.labelRenderer.render(scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.labelRenderer.setSize(width, height);
  }

  getLabels(): CSS2DObject[] {
    return Array.from(this.labels.values());
  }

  dispose(): void {
    this.labels.forEach((label) => {
      label.parent?.remove(label);
      label.element.remove();
    });
    this.labels.clear();
    
    this.container.removeChild(this.labelRenderer.domElement);
  }
}
