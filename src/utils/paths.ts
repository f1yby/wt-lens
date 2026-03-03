/** Base URL from Vite env for subpath deployment */
export const BASE_URL = import.meta.env.BASE_URL || '/';

/** Get vehicle image path (local webp) */
export const getVehicleImagePath = (vehicleId: string): string =>
  `${BASE_URL}vehicles/${vehicleId}.webp`;

/** Get aircraft image path (local webp) */
export const getAircraftImagePath = (aircraftId: string): string =>
  `${BASE_URL}aircrafts/${aircraftId}.webp`;

/** Get ship image path (local webp) */
export const getShipImagePath = (shipId: string): string =>
  `${BASE_URL}ships/${shipId}.webp`;

/** Get nation flag image path */
export const getFlagImagePath = (nation: string): string =>
  `${BASE_URL}images/flags/unit_tooltip/country_${nation}.webp`;
