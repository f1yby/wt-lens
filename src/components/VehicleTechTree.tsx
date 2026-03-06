import { Box, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { Vehicle, AircraftVehicle, ShipVehicle, GameMode, VehicleStats, EconomicType } from '../types';
import { BATTLE_RATINGS } from '../types';
import { getVehicleImagePath, getAircraftImagePath, getShipImagePath, getFlagImagePath } from '../utils/paths';
import { getVehicleStatsByMode } from '../data/vehicles';
import { getAircraftStatsByMode } from '../data/aircraft';
import { getShipStatsByMode } from '../data/ships';
import { getWinRateColor } from '../utils/gameMode';

/** Common fields shared by Vehicle and AircraftVehicle for the tech tree */
interface TechTreeItem {
  id: string;
  localizedName: string;
  nation: string;
  battleRating: number;
  economicType: EconomicType;
  imageUrl?: string;
  unreleased?: boolean;
}

interface VehicleTechTreeProps<T extends TechTreeItem> {
  vehicles: T[];
  gameMode?: GameMode;
  /** Get image path for the item */
  getImagePath?: (item: T) => string;
  /** Get navigation path for click */
  getNavPath?: (item: T) => string;
  /** Get stats for the current game mode */
  getStats?: (item: T, mode: GameMode) => VehicleStats | undefined;
  /** Custom BR resolver (default: item.battleRating) */
  getBR?: (item: T) => number;
  /** Empty state text */
  emptyText?: string;
}

export default function VehicleTechTree<T extends TechTreeItem>({
  vehicles,
  gameMode = 'historical',
  getImagePath,
  getNavPath,
  getStats,
  getBR,
  emptyText = '没有找到符合条件的载具',
}: VehicleTechTreeProps<T>) {
  const navigate = useNavigate();

  // Resolve default functions based on data type
  const resolveImagePath = getImagePath ?? ((item: T) => {
    // If imageUrl is empty/missing, skip the 404 and go straight to placeholder
    if (!item.imageUrl) {
      return `https://placehold.co/120x90/e5e5e5/666?text=${encodeURIComponent(item.localizedName.slice(0, 10))}`;
    }
    if ('shipType' in item) return getShipImagePath(item.id);
    if ('aircraftType' in item) return getAircraftImagePath(item.id);
    return getVehicleImagePath(item.id);
  });

  const resolveNavPath = getNavPath ?? ((item: T) => {
    if ('shipType' in item) return `/ship/${item.id}`;
    if ('aircraftType' in item) return `/aircraft/${item.id}`;
    return `/vehicle/${item.id}`;
  });

  const resolveStats = getStats ?? ((item: T, mode: GameMode) => {
    if ('shipType' in item) return getShipStatsByMode(item as unknown as ShipVehicle, mode);
    if ('aircraftType' in item) return getAircraftStatsByMode(item as unknown as AircraftVehicle, mode);
    return getVehicleStatsByMode(item as unknown as Vehicle, mode);
  });

  // BR resolver: custom or default
  const resolveBR = getBR ?? ((item: T) => item.battleRating);

  // 按 BR 分组载具
  const vehiclesByBR = BATTLE_RATINGS.reduce((acc, br) => {
    const brVehicles = vehicles.filter(v => Math.abs(resolveBR(v) - br) < 0.01);
    if (brVehicles.length > 0) {
      acc[br] = brVehicles;
    }
    return acc;
  }, {} as Record<number, T[]>);

  const brList = Object.keys(vehiclesByBR)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Box>
      <Box>
        {brList.map(br => (
          <Paper
            key={br}
            elevation={0}
            sx={{
              display: 'flex',
              mb: 1,
              backgroundColor: 'transparent',
              border: 'none',
            }}
          >
            {/* BR 标签列 */}
            <Box
              sx={{
                width: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#e5e5e5',
                borderRadius: '4px 0 0 4px',
                border: '1px solid #d4d4d4',
                borderRight: 'none',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  color: '#16a34a',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
              >
                {br.toFixed(1)}
              </Typography>
            </Box>

            {/* 载具网格 */}
            <Box
              sx={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 1,
                p: 1,
                backgroundColor: '#ffffff',
                borderRadius: '0 4px 4px 0',
                border: '1px solid #d4d4d4',
                minWidth: 0,
              }}
            >
              {vehiclesByBR[br].map(vehicle => {
                const modeStats = resolveStats(vehicle, gameMode);
                const hasStats = modeStats && modeStats.battles > 100;

                const getEconomicBgColor = () => {
                  switch (vehicle.economicType) {
                    case 'premium':
                      return '#fef9c3';
                    case 'clan':
                      return '#dcfce7';
                    default:
                      return '#dbeafe';
                  }
                };

                return (
                  <Box
                    key={vehicle.id}
                    onClick={() => navigate(resolveNavPath(vehicle))}
                    sx={{
                      position: 'relative',
                      aspectRatio: '4/3',
                      backgroundColor: getEconomicBgColor(),
                      borderRadius: 1,
                      border: vehicle.unreleased ? '1px dashed #f97316' : '1px solid #d4d4d4',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      opacity: vehicle.unreleased ? 0.7 : 1,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: '#16a34a',
                        transform: 'scale(1.05)',
                        zIndex: 10,
                        opacity: 1,
                      },
                    }}
                  >
                    {/* DEV 角标 */}
                    {vehicle.unreleased && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          backgroundColor: '#f97316',
                          color: '#fff',
                          fontSize: '0.5rem',
                          fontWeight: 700,
                          px: 0.5,
                          py: 0.125,
                          borderRadius: 0.5,
                          zIndex: 3,
                          lineHeight: 1.2,
                        }}
                      >
                        DEV
                      </Box>
                    )}
                    {/* 国旗背景 */}
                    <Box
                      component="img"
                      src={getFlagImagePath(vehicle.nation)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.25,
                        zIndex: 0,
                      }}
                    />

                    {/* 载具图片 */}
                    <Box
                      component="img"
                      src={resolveImagePath(vehicle)}
                      alt={vehicle.localizedName}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://placehold.co/120x90/e5e5e5/666?text=${encodeURIComponent(vehicle.localizedName.slice(0, 10))}`;
                      }}
                      sx={{
                        width: '80%',
                        height: '50%',
                        objectFit: 'contain',
                        position: 'absolute',
                        top: '8%',
                        left: '10%',
                        zIndex: 1,
                      }}
                    />

                    {/* 信息覆盖层 */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '45%',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        p: 0.5,
                        zIndex: 2,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "'WTSymbols', 'Roboto', Tahoma, sans-serif",
                          color: '#fff',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {vehicle.localizedName}
                      </Typography>

                      {/* 胜率指示 */}
                      {hasStats && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.6rem',
                            color: getWinRateColor(modeStats!.winRate),
                          }}
                        >
                          {modeStats!.winRate.toFixed(1)}% · {modeStats!.battles >= 1000 ? (modeStats!.battles / 1000).toFixed(1) + 'k' : modeStats!.battles}场
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        ))}

        {brList.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: '#737373' }}>
              {emptyText}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
