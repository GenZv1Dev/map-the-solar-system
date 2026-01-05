import { useEffect, useRef, useState, useCallback } from 'react';
import { LoadingScreen } from './components/LoadingScreen';
import { Sidebar } from './components/Sidebar';
import { AsteroidDetail } from './components/AsteroidDetail';
import { ControlsHelp, ClickToFly } from './components/ControlsHelp';
import { loadAsteroidData, type LoadProgress } from './lib/dataLoader';
import { getAsteroidsByPage, getStatistics, type Asteroid } from './lib/indexedDB';
import { SceneController } from './three/SceneController';

function App() {
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState<LoadProgress>({
    phase: 'checking',
    current: 0,
    total: 100,
    message: 'Initializing...',
  });

  // Scene controller
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneController | null>(null);
  const isLoadingStarted = useRef(false);

  // Data state
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [statistics, setStatistics] = useState({
    totalCount: 0,
    totalValue: 0,
    neoCount: 0,
    phaCount: 0,
  });
  const [navigationItems, setNavigationItems] = useState<Array<{ name: string; type: string }>>([]);

  // UI state
  const [selectedAsteroid, setSelectedAsteroid] = useState<Asteroid | null>(null);
  const [isControlsLocked, setIsControlsLocked] = useState(false);
  const [timeScale, setTimeScale] = useState(0.00001); // Default time scale

  // Load asteroid data
  useEffect(() => {
    // Prevent double fetch in StrictMode
    if (isLoadingStarted.current) return;
    isLoadingStarted.current = true;

    async function loadData() {
      try {
        await loadAsteroidData(setLoadProgress);
        
        // Load initial asteroids for display
        const initialAsteroids = await getAsteroidsByPage(0, 1000);
        setAsteroids(initialAsteroids);
        
        // Get statistics
        const stats = await getStatistics();
        setStatistics(stats);
        
        // Short delay before showing scene
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error('Failed to load asteroid data:', error);
        setLoadProgress({
          phase: 'complete',
          current: 0,
          total: 100,
          message: 'Failed to load data. Using demo mode.',
        });
        setTimeout(() => setIsLoading(false), 1000);
      }
    }
    
    loadData();
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (isLoading || !containerRef.current) return;
    
    const controller = new SceneController({
      container: containerRef.current,
      onObjectSelected: (name) => {
        console.log('Selected:', name);
      },
      onControlsLocked: setIsControlsLocked,
    });
    
    sceneRef.current = controller;
    setNavigationItems(controller.getNavigationItems());
    
    // Load asteroids into scene
    if (asteroids.length > 0) {
      controller.loadAsteroids(asteroids);
    }
    
    return () => {
      controller.dispose();
      sceneRef.current = null;
    };
  }, [isLoading, asteroids]);

  // Handlers
  const handleNavigate = useCallback((name: string) => {
    sceneRef.current?.flyTo(name);
  }, []);

  const handleAsteroidSelect = useCallback((asteroid: Asteroid) => {
    setSelectedAsteroid(asteroid);
  }, []);

  const handleFlyToAsteroid = useCallback((asteroid: Asteroid) => {
    sceneRef.current?.flyToAsteroid(asteroid);
    setSelectedAsteroid(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedAsteroid(null);
  }, []);

  const handleTimeScaleChange = useCallback((scale: number) => {
    setTimeScale(scale);
    sceneRef.current?.setTimeScale(scale);
  }, []);

  // Render loading screen
  if (isLoading) {
    return <LoadingScreen progress={loadProgress} />;
  }

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden">
      {/* Three.js canvas container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* UI Overlay */}
      <Sidebar
        navigationItems={navigationItems}
        onNavigate={handleNavigate}
        onAsteroidSelect={handleAsteroidSelect}
        statistics={statistics}
        timeScale={timeScale}
        onTimeScaleChange={handleTimeScaleChange}
      />

      {/* Asteroid detail panel */}
      {selectedAsteroid && (
        <AsteroidDetail
          asteroid={selectedAsteroid}
          onClose={handleCloseDetail}
          onFlyTo={handleFlyToAsteroid}
        />
      )}

      {/* Controls help */}
      <ControlsHelp isLocked={isControlsLocked} />
      <ClickToFly visible={!isControlsLocked} />

      {/* Title */}
      <div className="fixed top-4 right-4 z-40 text-right">
        <h1 className="text-xl font-bold bg-linear-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Solar System Explorer
        </h1>
        <p className="text-xs text-gray-500">
          {statistics.totalCount.toLocaleString()} asteroids mapped
        </p>
      </div>
    </div>
  );
}

export default App
