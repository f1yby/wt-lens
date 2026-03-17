import { useState, useEffect, useRef } from 'react';
import type { StatsMonthRange, GameMode } from '../types';

/**
 * Configuration for detail page loading optimization.
 * Supports progressive loading: light list -> current vehicle data -> comparison vehicles on demand.
 */
export interface DetailPageLoaderConfig<V> {
  /** Load lightweight vehicle list without stats/performance */
  loadLightList: () => Promise<V[]>;
  
  /** Load stats for specific vehicle IDs */
  loadStatsForIds?: (vehicles: V[], ids: string[], range: StatsMonthRange, mode: GameMode) => Promise<V[]>;
  
  /** Load detail data for a single vehicle */
  loadDetail?: (id: string) => Promise<{ economy?: unknown; performance?: unknown } | null>;
  
  /** Get vehicle ID */
  getId: (v: V) => string;
  
  /** Check if vehicle has stats loaded */
  hasStats: (v: V) => boolean;
  
  /** Check if vehicle has detail loaded (e.g., performance for ground vehicles) */
  hasDetail?: (v: V) => boolean;
  
  /** Get BR for filtering */
  getBR: (v: V, mode: GameMode) => number;
  
  /** Get type for filtering */
  getType: (v: V) => string;
}

interface DetailPageLoaderState<V> {
  vehicles: V[];
  loading: boolean;
  loadingStats: boolean;
}

/**
 * Hook for optimized detail page data loading.
 * 
 * Loading strategy:
 * 1. Initial: Load light list + current vehicle's stats + current vehicle's detail
 * 2. On filter change: Load missing stats and details for vehicles in filter range
 * 
 * This reduces initial load time by not loading all vehicles' data upfront.
 */
export function useDetailPageLoader<V>(
  config: DetailPageLoaderConfig<V>,
  currentVehicleId: string | undefined,
  statsMonthRange: StatsMonthRange,
  gameMode: GameMode,
  filterTypes: string[],
  brRange: [number, number],
): DetailPageLoaderState<V> {
  const [vehicles, setVehicles] = useState<V[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Track loaded data to avoid duplicate loads
  const loadedStatsRef = useRef<Set<string>>(new Set());
  const loadedDetailRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Step 1: Load lightweight vehicle list + current vehicle data
  useEffect(() => {
    setLoading(true);
    loadedStatsRef.current = new Set();
    loadedDetailRef.current = new Set();
    initializedRef.current = false;
    
    config.loadLightList()
      .then(list => {
        setVehicles(list);
        setLoading(false);
        
        // Immediately load current vehicle's stats and detail
        if (currentVehicleId) {
          // Load detail if available
          const detailPromise = config.loadDetail 
            ? config.loadDetail(currentVehicleId).then(detail => {
                if (detail) {
                  setVehicles(prev => prev.map(v => 
                    config.getId(v) === currentVehicleId
                      ? { ...v, ...detail }
                      : v
                  ));
                  loadedDetailRef.current.add(currentVehicleId);
                }
              })
            : Promise.resolve();
          
          // Mark current vehicle as having stats loaded (will be loaded via loadStatsForIds if available)
          if (config.loadStatsForIds && list.find(v => config.getId(v) === currentVehicleId)) {
            return config.loadStatsForIds(list, [currentVehicleId], statsMonthRange, gameMode)
              .then(withStats => {
                setVehicles(withStats);
                loadedStatsRef.current.add(currentVehicleId);
                return detailPromise;
              });
          }
          
          return detailPromise;
        }
      })
      .catch(() => setLoading(false));
  }, [currentVehicleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: Load comparison vehicles' data on demand (when filter changes)
  useEffect(() => {
    if (loading || !currentVehicleId || vehicles.length === 0) return;
    if (!config.loadStatsForIds && !config.loadDetail) return;
    
    // Find vehicles in filter range that need data
    const idsNeedingStats: string[] = [];
    const idsNeedingDetail: string[] = [];
    
    for (const v of vehicles) {
      const id = config.getId(v);
      if (id === currentVehicleId) continue; // Already loaded
      
      const br = config.getBR(v, gameMode);
      if (br < brRange[0] || br > brRange[1]) continue;
      
      const type = config.getType(v);
      if (filterTypes.length > 0 && !filterTypes.includes(type)) continue;
      
      // Check what data is missing
      if (config.loadStatsForIds && !loadedStatsRef.current.has(id) && !config.hasStats(v)) {
        idsNeedingStats.push(id);
      }
      if (config.loadDetail && !loadedDetailRef.current.has(id) && config.hasDetail && !config.hasDetail(v)) {
        idsNeedingDetail.push(id);
      }
    }
    
    if (idsNeedingStats.length === 0 && idsNeedingDetail.length === 0) return;
    
    // Skip if already loading
    if (loadingStats) return;
    
    setLoadingStats(true);
    
    // Load stats and details in parallel
    const statsPromise = idsNeedingStats.length > 0 && config.loadStatsForIds
      ? config.loadStatsForIds(vehicles, idsNeedingStats, statsMonthRange, gameMode)
      : Promise.resolve(vehicles);
    
    const detailPromise = idsNeedingDetail.length > 0 && config.loadDetail
      ? Promise.all(idsNeedingDetail.map(id => config.loadDetail!(id)))
          .then(details => new Map(details.filter(Boolean).map(d => [config.getId(d as V), d])))
      : Promise.resolve(new Map<string, unknown>());
    
    Promise.all([statsPromise, detailPromise]).then(([vehiclesWithStats, detailMap]) => {
      // Update loaded refs
      idsNeedingStats.forEach(id => loadedStatsRef.current.add(id));
      idsNeedingDetail.forEach(id => loadedDetailRef.current.add(id));
      
      // Merge both updates
      setVehicles(vehiclesWithStats.map(v => {
        const id = config.getId(v);
        const detail = detailMap.get(id);
        return detail ? { ...v, ...detail } : v;
      }));
      setLoadingStats(false);
    });
    
  }, [loading, currentVehicleId, vehicles.length, statsMonthRange, gameMode, filterTypes.join(','), brRange[0], brRange[1], loadingStats]); // eslint-disable-line react-hooks/exhaustive-deps

  return { vehicles, loading, loadingStats };
}

/**
 * Simpler hook for detail pages that don't need progressive loading.
 * Loads all data at once (for backwards compatibility).
 */
export function useSimpleDetailLoader<V>(
  loadVehicles: () => Promise<V[]>,
  currentVehicleId: string | undefined,
  loadDetail?: (id: string) => Promise<{ economy?: unknown } | null>,
): { vehicles: V[]; loading: boolean } {
  const [vehicles, setVehicles] = useState<V[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    loadVehicles()
      .then(data => {
        setVehicles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load detail for current vehicle
  useEffect(() => {
    if (!currentVehicleId || !loadDetail || vehicles.length === 0) return;
    
    const vehicle = vehicles.find(v => (v as { id: string }).id === currentVehicleId);
    if (!vehicle) return;
    
    loadDetail(currentVehicleId).then(detail => {
      if (detail?.economy) {
        setVehicles(prev => prev.map(v => 
          (v as { id: string }).id === currentVehicleId
            ? { ...v, economy: detail.economy }
            : v
        ));
      }
    });
  }, [currentVehicleId, vehicles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return { vehicles, loading };
}
