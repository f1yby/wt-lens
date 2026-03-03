import type { ShipVehicle, GameMode } from '../types';
import VehicleTechTree from './VehicleTechTree';
import { getShipImagePath } from '../utils/paths';
import { getShipStatsByMode } from '../data/ships';

interface ShipTechTreeProps {
  ships: ShipVehicle[];
  gameMode?: GameMode;
}

export default function ShipTechTree({ ships, gameMode = 'historical' }: ShipTechTreeProps) {
  return (
    <VehicleTechTree
      vehicles={ships}
      gameMode={gameMode}
      getImagePath={(item) => getShipImagePath(item.id)}
      getNavPath={(item) => `/ship/${item.id}`}
      getStats={(item, mode) => getShipStatsByMode(item, mode)}
      emptyText="没有找到符合条件的舰船"
    />
  );
}
