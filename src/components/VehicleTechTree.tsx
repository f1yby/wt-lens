import { Box, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { Vehicle } from '../types';
import { NATIONS, VEHICLE_TYPE_LABELS, BATTLE_RATINGS } from '../types';

// Get base URL from Vite env for subpath deployment
const BASE_URL = import.meta.env.BASE_URL || '/';

// Nation flag image mapping
const getFlagImagePath = (nation: string): string => `${BASE_URL}images/flags/unit_tooltip/country_${nation}.png`;

// Vehicle image path with base URL
const getVehicleImagePath = (imageUrl: string | undefined): string => {
  if (!imageUrl) return '';
  const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
  return `${BASE_URL}${cleanPath}`;
};

interface VehicleTechTreeProps {
  vehicles: Vehicle[];
}

export default function VehicleTechTree({ vehicles }: VehicleTechTreeProps) {
  const navigate = useNavigate();

  // 按 BR 分组载具
  const vehiclesByBR = BATTLE_RATINGS.reduce((acc, br) => {
    const brVehicles = vehicles.filter(v => Math.abs(v.battleRating - br) < 0.01);
    if (brVehicles.length > 0) {
      acc[br] = brVehicles;
    }
    return acc;
  }, {} as Record<number, Vehicle[]>);

  const brList = Object.keys(vehiclesByBR)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 800 }}>
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
              }}
            >
              {vehiclesByBR[br].map(vehicle => {
                const nation = NATIONS.find(n => n.id === vehicle.nation);
                const hasStats = vehicle.stats && vehicle.stats.battles > 100;

                // 根据经济类型设置柔和的背景色
                const getEconomicBgColor = () => {
                  switch (vehicle.economicType) {
                    case 'premium':
                      return '#fef9c3'; // 柔和金色
                    case 'clan':
                      return '#dcfce7'; // 柔和绿色
                    default:
                      return '#dbeafe'; // 柔和蓝色
                  }
                };

                return (
                  <Box
                    key={vehicle.id}
                    onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                    sx={{
                      position: 'relative',
                      aspectRatio: '4/3',
                      backgroundColor: getEconomicBgColor(),
                      borderRadius: 1,
                      border: '1px solid #d4d4d4',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: '#16a34a',
                        transform: 'scale(1.05)',
                        zIndex: 10,
                      },
                    }}
                  >
                    {/* 国旗背景 */}
                    <Box
                      component="img"
                      src={getFlagImagePath(vehicle.nation)}
                      alt=""
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
                      src={getVehicleImagePath(vehicle.imageUrl) || `https://placehold.co/120x90/e5e5e5/666?text=${vehicle.localizedName.slice(0, 10)}`}
                      alt={vehicle.localizedName}
                      sx={{
                        width: '80%',
                        height: '50%',
                        objectFit: 'contain',
                        position: 'absolute',
                        top: '8%',
                        left: '10%',
                        zIndex: 1,
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://placehold.co/120x90/e5e5e5/666?text=${vehicle.localizedName.slice(0, 10)}`;
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
                            color: vehicle.stats!.winRate > 50 ? '#4ade80' : vehicle.stats!.winRate < 48 ? '#ef4444' : '#facc15',
                          }}
                        >
                          {vehicle.stats!.winRate.toFixed(1)}% · {vehicle.stats!.avgKills.toFixed(1)}K
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
              没有找到符合条件的载具
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
