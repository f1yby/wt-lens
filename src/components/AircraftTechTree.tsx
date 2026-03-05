import type { AircraftVehicle, GameMode } from '../types';
import VehicleTechTree from './VehicleTechTree';
import { getAircraftImagePath } from '../utils/paths';
import { getAircraftStatsByMode } from '../data/aircraft';

interface AircraftTechTreeProps {
  aircraft: AircraftVehicle[];
  gameMode?: GameMode;
  /** Whether to use ground combined battle BR */
  useGroundBR?: boolean;
}

export default function AircraftTechTree({ aircraft, gameMode = 'historical', useGroundBR = false }: AircraftTechTreeProps) {
  return (
    <VehicleTechTree
      vehicles={aircraft}
      gameMode={gameMode}
      getImagePath={(item) => getAircraftImagePath(item.id)}
      getNavPath={(item) => item.aircraftType === 'helicopter' ? `/helicopter/${item.id}` : `/aircraft/${item.id}`}
      getStats={(item, mode) => getAircraftStatsByMode(item, mode)}
      getBR={useGroundBR ? (item) => item.groundBattleRating ?? item.battleRating : undefined}
      emptyText="没有找到符合条件的飞机"
    />
  );
}
