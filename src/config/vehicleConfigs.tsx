/**
 * Vehicle detail configurations
 */
import type { Vehicle, GroundVehicleType, GameMode } from '../types';
import type { AircraftVehicle, AircraftType } from '../types';
import type { ShipVehicle, ShipType } from '../types';
import { VEHICLE_TYPE_LABELS, AIRCRAFT_TYPE_LABELS, SHIP_TYPE_LABELS } from '../types';
import { loadVehicles as loadVehiclesBase, getVehicleStatsByMode, loadVehicleDetail, loadVehiclesLight, mergePackagedStatsIntoVehicles } from '../data/vehicles';
import { loadAircraft, getAircraftStatsByMode, loadAircraftDetail, loadAircraftLight, mergePackagedStatsForAircraft } from '../data/aircraft';
import { loadShips, getShipStatsByMode, loadShipDetail, loadShipsLight, mergePackagedStatsForShips } from '../data/ships';
import { getVehicleImagePath, getAircraftImagePath, getShipImagePath } from '../utils/paths';
import { generateGenericStatsComparisonData } from '../utils/vehicleComparison';
import type { VehicleDetailConfig } from './vehicleDetailConfig';
import AircraftWeaponsSection from '../components/AircraftWeaponsSection';

// ============================================================
// Ground Vehicle Config
// ============================================================

const ALL_VEHICLE_TYPES: GroundVehicleType[] = ['light_tank', 'medium_tank', 'heavy_tank', 'tank_destroyer', 'spaa'];

const vehicleGetStats = (v: Vehicle, mode: GameMode) => getVehicleStatsByMode(v, mode) ?? null;
const vehicleGetBR = (v: Vehicle, mode: GameMode) => v.br?.[mode] ?? v.battleRating;
const vehicleTypeFilter = (v: Vehicle, types: GroundVehicleType[]) => types.includes(v.vehicleType);

export const vehicleConfig: VehicleDetailConfig<Vehicle, GroundVehicleType> = {
  vehicleTypeName: '载具',
  listPath: '/',
  navPrefix: '/vehicle',
  
  // Full load (for backwards compatibility)
  loadVehicles: async () => {
    // Ground vehicles use default month range (empty = latest)
    return loadVehiclesBase({ startMonth: '', endMonth: '' });
  },
  
  // Progressive loading support
  loadLightList: loadVehiclesLight,
  loadStatsForIds: async (vehicles, _ids, range, mode) => {
    return mergePackagedStatsIntoVehicles(vehicles, range, mode);
  },
  loadDetail: loadVehicleDetail,
  
  getStats: (v, mode) => getVehicleStatsByMode(v, mode) ?? null,
  getBR: (v, mode) => v.br?.[mode] ?? v.battleRating,
  getImagePath: getVehicleImagePath,
  
  allTypes: ALL_VEHICLE_TYPES,
  typeLabels: VEHICLE_TYPE_LABELS,
  getType: (v) => v.vehicleType,
  
  generateStatsComparison: (id, metric, vehicles, mode, filter) =>
    generateGenericStatsComparisonData(
      id, metric, vehicles, mode,
      vehicleGetStats, (v) => vehicleGetBR(v, mode),
      filter, vehicleTypeFilter
    ),
  
  showMonthRangeSelector: true,
  hasStats: (v) => !!v.stats,
  
  performanceCharts: [
    { metric: 'reloadTime', title: '装填时间', unit: 's' },
    { metric: 'powerToWeight', title: '功重比', unit: 'hp/t' },
    { metric: 'penetration', title: '穿深', unit: 'mm' },
    { metric: 'traverseSpeed', title: '方向机速度', unit: '°/s' },
    { metric: 'elevationSpeed', title: '高低机速度', unit: '°/s' },
    { metric: 'maxReverseSpeed', title: '倒车速度', unit: 'km/h' },
    { metric: 'maxSpeed', title: '前进极速', unit: 'km/h' },
    { metric: 'gunnerThermal', title: '炮手热成像', unit: '像素' },
    { metric: 'commanderThermal', title: '车长热成像', unit: '像素' },
  ],
  
  // Note: renderAdditionalSections and renderHeaderStats would need React components
  // These will be handled separately in the DetailPage component
};

// ============================================================
// Aircraft Config
// ============================================================

const AIRCRAFT_TYPES_ONLY: AircraftType[] = ['fighter', 'bomber', 'assault'];
const HELICOPTER_TYPES_ONLY: AircraftType[] = ['helicopter'];

export function createAircraftConfig(isHelicopter: boolean): VehicleDetailConfig<AircraftVehicle, AircraftType> {
  const availableTypes = isHelicopter ? HELICOPTER_TYPES_ONLY : AIRCRAFT_TYPES_ONLY;
  
  const aircraftGetStats = (a: AircraftVehicle, mode: GameMode) => getAircraftStatsByMode(a, mode) ?? null;
  const aircraftGetBR = (a: AircraftVehicle) => a.battleRating;
  const aircraftTypeFilter = (a: AircraftVehicle, types: AircraftType[]) => types.includes(a.aircraftType);
  
  return {
    vehicleTypeName: isHelicopter ? '直升机' : '飞机',
    listPath: isHelicopter ? '/helicopter' : '/aircraft',
    navPrefix: isHelicopter ? '/helicopter' : '/aircraft',
    
    // Full load (for backwards compatibility)
    loadVehicles: loadAircraft,
    
    // Progressive loading support
    loadLightList: async () => {
      const all = await loadAircraftLight();
      return isHelicopter 
        ? all.filter(a => a.aircraftType === 'helicopter')
        : all.filter(a => a.aircraftType !== 'helicopter');
    },
    loadStatsForIds: async (aircraft, ids, range, mode) => {
      return mergePackagedStatsForAircraft(aircraft, ids, range, mode);
    },
    loadDetail: loadAircraftDetail,
    
    getStats: (a, mode) => getAircraftStatsByMode(a, mode) ?? null,
    getBR: (a) => a.battleRating,
    getImagePath: getAircraftImagePath,
    
    allTypes: availableTypes,
    typeLabels: AIRCRAFT_TYPE_LABELS,
    getType: (a) => a.aircraftType,
    
    generateStatsComparison: (id, metric, aircraft, mode, filter) =>
      generateGenericStatsComparisonData(
        id, metric, aircraft, mode,
        aircraftGetStats, aircraftGetBR,
        filter, aircraftTypeFilter
      ),
    
    showMonthRangeSelector: false,
    hasStats: (a) => !!a.stats,

    renderAdditionalSections: (_vehicle, _gameMode, _onNavigate, detailData) => {
      // Cast detailData to get weapons
      const detail = detailData as { weapons?: import('../types').AircraftWeapons } | undefined;
      if (detail?.weapons) {
        return <AircraftWeaponsSection weapons={detail.weapons} />;
      }
      return null;
    },
  };
}

// ============================================================
// Ship Config
// ============================================================

const ALL_SHIP_TYPES: ShipType[] = [
  'destroyer',
  'torpedo_boat',
  'submarine_chaser',
  'barge',
  'battleship',
  'battlecruiser',
  'heavy_cruiser',
  'light_cruiser',
  'frigate',
  'boat',
  'armored_boat',
  'gun_boat',
  'torpedo_gun_boat',
];

const shipGetStats = (s: ShipVehicle, mode: GameMode) => getShipStatsByMode(s, mode) ?? null;
const shipGetBR = (s: ShipVehicle) => s.battleRating;
const shipTypeFilter = (s: ShipVehicle, types: ShipType[]) => types.includes(s.shipType);

export const shipConfig: VehicleDetailConfig<ShipVehicle, ShipType> = {
  vehicleTypeName: '舰船',
  listPath: '/ship',
  navPrefix: '/ship',
  
  // Full load (for backwards compatibility)
  loadVehicles: loadShips,
  
  // Progressive loading support
  loadLightList: loadShipsLight,
  loadStatsForIds: async (ships, ids, range, mode) => {
    return mergePackagedStatsForShips(ships, ids, range, mode);
  },
  loadDetail: loadShipDetail,
  
  getStats: (s, mode) => getShipStatsByMode(s, mode) ?? null,
  getBR: (s) => s.battleRating,
  getImagePath: getShipImagePath,
  
  allTypes: ALL_SHIP_TYPES,
  typeLabels: SHIP_TYPE_LABELS,
  getType: (s) => s.shipType,
  
  generateStatsComparison: (id, metric, ships, mode, filter) =>
    generateGenericStatsComparisonData(
      id, metric, ships, mode,
      shipGetStats, shipGetBR,
      filter, shipTypeFilter
    ),
  
  showMonthRangeSelector: false,
  hasStats: (s) => !!s.stats,
};
