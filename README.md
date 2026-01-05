# Solar System Explorer - Complete Project Prompt

Created a comprehensive 3D solar system visualization application that maps all 958,524 asteroids from the dataset, with realistic planets, moons, rings, and advanced visual effects. This is a full-stack web application using modern web technologies.

## Project Setup

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4.x
- **3D Engine**: Three.js with post-processing
- **Icons**: Lucide React
- **Data Storage**: IndexedDB for asteroid data caching
- **Performance**: BVH (Bounding Volume Hierarchy), LOD (Level of Detail), instancing

## Core Dependencies

```json
{
  "dependencies": {
    "three": "^0.182.0",
    "postprocessing": "^6.38.2",
    "three-mesh-bvh": "^0.9.4",
    "@three.ez/batched-mesh-extensions": "^0.0.11",
    "idb": "^8.0.3",
    "lucide-react": "^0.562.0",
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  }
}
```

## Data Management

### Dataset Loading
- On first load, fetch `public/data/dataset.csv` (138MB file)
- Parse CSV into JSON objects
- Store in IndexedDB for subsequent fast loads
- Show detailed progress bar during initial loading
- Handle partial loads gracefully (resume if interrupted)

### Asteroid Data Structure
Based on the provided CSV sample:
```typescript
interface Asteroid {
  id: string;
  spkid: string;
  full_name: string;
  pdes: string;
  name?: string;
  neo: 'Y' | 'N';
  pha: 'Y' | 'N';
  H: number; // Absolute magnitude
  diameter: number; // km
  albedo: number;
  orbit_id: string;
  epoch: number;
  // ... all orbital parameters
  class: string; // MBA, etc.
}
```

### Value Estimation
- Calculate asteroid value based on size and albedo
- Formula: `value = size³ * albedo * material_factor`
- Values can reach $10 trillion+ for large, valuable asteroids
- Display in human-readable format (e.g., "$1.2T" instead of "$1200000000000")

## 3D Scene Architecture

### Solar System
- **Scale**: Realistic proportions (1 AU = 100 units)
- **Planets**: All 8 planets with accurate orbital parameters
- **Moons**: All major moons orbiting their planets
- **Rings**: Realistic rings for Saturn, subtle rings for other gas giants
- **Textures**: High-quality 4K textures from Three.js examples
  - Earth: Day/night cycle, atmosphere, clouds
  - Mars: Red moon texture tinted red
  - Other planets: Procedural or colored moon textures

### Asteroid Belt
- **Main Belt**: Between Mars and Jupiter
- **Kuiper Belt**: Doughnut-shaped region beyond Neptune
- **Rendering**: 958,524 individual asteroids
- **LOD System**: Distance-based detail reduction
- **BVH Optimization**: Frustum culling and spatial queries
- **Instancing**: Performance optimization for distant asteroids

### Black Hole
- Positioned far from solar system (center of Milky Way visualization)
- Massive scale, visible from distance
- Event horizon effects

### Labels and UI
- **3D Labels**: Text meshes facing camera, scale with distance
- **Interest Points**: Planets, belts, black hole, galaxy features
- **Color Coding**: Planet colors, outline for visibility
- **Dynamic Scaling**: Always readable regardless of distance

## Visual Effects (from Three.js Examples)

### Core Effects
- **Unreal Bloom**: Applied to sun, planets with atmospheres
- **Lens Flares**: From sun, affecting nearby objects
- **Post-Processing**: Tone mapping, color grading

### Advanced Effects
- **Lava**: Surface effects on sun and volcanic planets
- **Fire/Smoke**: Solar corona, planetary atmospheres
- **Water**: Ocean effects on Earth (subtle when zoomed)
- **Galaxy Background**: Distant stars and nebulae
- **Tornado Effects**: Atmospheric phenomena on gas giants
- **Marching Cubes**: Liquid planets (Mercury concept)

### Lighting
- **Realistic Sun**: Point light with proper falloff
- **Shadows**: Soft shadows on planets and large asteroids
- **Ambient**: Subtle ambient lighting for visibility

## Controls and Camera

### Fly Controls
- **Activation**: Left/right click to lock mouse
- **Movement**: WASD for directional movement
- **Speed**: Base speed adjustable, shift for boost
- **Progressive Speed**: Longer shift hold = faster movement
- **Realism**: Speed relative to solar system scale

### Focus Mode
- **Activation**: Click planet/asteroid in UI or scene
- **Tracking**: Camera follows target orbit
- **Exit**: Dedicated button to exit focus mode
- **Smooth Transitions**: Fly-to animations

## User Interface

### Loading Screen
- **Progress Bar**: Accurate download/storage progress
- **Phases**: Download → Parse → Store → Load
- **Smooth Animation**: No jerky progress updates

### Sidebar (Left Panel)
- **Navigation**: Scrollable list of interest points
- **Categories**: Planets, Moons, Belts, Features
- **Click to Fly**: Smooth camera transitions
- **Statistics**: Total asteroids, value, NEO/PHA counts

### Asteroid Browser
- **Search**: Lazy loading with pagination
- **Filters**: NEO, PHA, size, value, distance
- **Sorting**: By value, size, distance, etc.
- **Details**: Full asteroid properties, mining difficulty
- **Progress Bar**: Search loading indicator

### HUD (Top Overlay)
- **Speed Indicator**: Current fly speed (human readable)
- **Time Scale**: Simulation speed multiplier
- **Simulated Date**: Current date in simulation
- **Elapsed Time**: Time since simulation start

### Performance Settings
- **Asteroid Visibility**: Toggle asteroid rendering
- **Label Visibility**: Toggle 3D labels
- **Bloom Effects**: Toggle post-processing
- **LOD Controls**: From BVH example (useBVH, useLOD, freeze)

## Performance Optimizations

### Rendering
- **Batched Meshes**: Group similar objects
- **Frustum Culling**: Only render visible objects
- **LOD System**: Reduce detail with distance
- **Instancing**: Efficient rendering of similar asteroids

### Data Handling
- **Progressive Loading**: Load asteroids in chunks
- **Memory Management**: Dispose unused geometries
- **Web Workers**: Background data processing

### Monitoring
- **FPS Counter**: Real-time performance display
- **Memory Usage**: Track resource consumption
- **Loading Times**: Optimize initial load

## Time and Animation

### Orbital Mechanics
- **Realistic Orbits**: Keplerian elements from dataset
- **Time Scale**: Default 0.0084x (1 year = ~119 days real time)
- **Synchronization**: All objects move together
- **Pausable**: Stop/start simulation

### Date/Time System
- **Start Date**: Current real date/time
- **Progression**: Based on time scale
- **Display**: Human-readable dates and elapsed time

## Audio (Optional Enhancement)

- **Ambient Sounds**: Sci-fi background audio
- **Spatial Audio**: Volume based on camera distance
- **Dynamic**: Different sounds for different regions

## Assets and Resources

### Textures
- **Source**: Three.js repository examples
- **Resolution**: 4K where possible
- **Optimization**: Compressed formats, mipmaps

### Models
- **Planets**: Sphere geometries with textures
- **Asteroids**: Varied shapes (not just spheres)
- **Moons**: Scaled appropriately

## Development Guidelines

### Code Structure
```
src/
  components/     # React UI components
  lib/           # Utilities (data loading, IndexedDB)
  three/         # 3D scene components
  types/         # TypeScript definitions
  hooks/         # Custom React hooks
```

### Best Practices
- **TypeScript**: Strict typing throughout
- **Performance**: Profile and optimize rendering
- **Modularity**: Reusable 3D components
- **Error Handling**: Graceful fallbacks
- **Accessibility**: Keyboard navigation support

### Testing
- **Unit Tests**: Component and utility functions
- **Integration**: 3D scene loading and interactions
- **Performance**: Frame rate and memory benchmarks

## Deployment

- **Build**: Optimized Vite production build
- **Assets**: Pre-compressed textures and models
- **CDN**: Static assets served from CDN
- **PWA**: Service worker for offline asteroid data

## Future Enhancements

- **VR Support**: WebXR integration
- **Multiplayer**: Shared exploration sessions
- **Real-time Data**: Live asteroid tracking updates
- **Educational Mode**: Interactive lessons about solar system
- **Mining Simulation**: Economic asteroid exploitation model

This prompt covers the complete vision for the Solar System Explorer, incorporating all requested features, optimizations, and visual effects. Build incrementally, starting with core solar system rendering, then adding asteroid belt, then advanced effects and optimizations.

## THREE.js Earth Moon and Sun

Earth textures: [PlanetPixelEmporium](https://planetpixelemporium.com/earth.html)
