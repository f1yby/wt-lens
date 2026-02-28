import { Card, CardContent, CardMedia, Typography, Chip, Box, Tooltip } from '@mui/material';
import { GpsFixed, Bolt } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { Vehicle } from '../types';
import { NATIONS, VEHICLE_TYPE_LABELS } from '../types';

/** Get stabilizer display info */
function getStabilizerInfo(type: Vehicle['performance']['stabilizerType']) {
  switch (type) {
    case 'both': return { label: '双向', color: '#16a34a' };
    case 'horizontal': return { label: '水平', color: '#3b82f6' };
    case 'vertical': return { label: '垂直', color: '#8b5cf6' };
    default: return { label: '无', color: '#9ca3af' };
  }
}

/** Get best APFSDS ammo name for display */
function getBestAmmoName(vehicle: Vehicle): string | null {
  if (!vehicle.performance.ammunitions) return null;
  
  const apfsds = vehicle.performance.ammunitions.filter(a => 
    a.type.includes('apds_fs')
  );
  
  if (apfsds.length === 0) return null;
  
  // Return the one with highest penetration
  const best = apfsds.reduce((prev, curr) => 
    (curr.penetration0m || 0) > (prev.penetration0m || 0) ? curr : prev
  );
  
  return best.name.replace(/^\d+mm_/, '').replace(/_/g, '-').toUpperCase();
}

interface VehicleCardProps {
  vehicle: Vehicle;
}

// Get base URL from Vite env for subpath deployment
const BASE_URL = import.meta.env.BASE_URL || '/';

// Vehicle image path helper - use local webp images
const getVehicleImagePath = (vehicleId: string): string => {
  return `${BASE_URL}vehicles/${vehicleId}.webp`;
};

export default function VehicleCard({ vehicle }: VehicleCardProps) {
  const navigate = useNavigate();
  const nation = NATIONS.find(n => n.id === vehicle.nation);

  return (
    <Card
      onClick={() => navigate(`/vehicle/${vehicle.id}`)}
      sx={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: '#16a34a',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box
        sx={{
          height: 160,
          background: vehicle.economicType === 'premium' 
            ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
            : vehicle.economicType === 'clan'
            ? 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)'
            : 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          p: 2,
        }}
      >
        <Box
          component="img"
          src={getVehicleImagePath(vehicle.id)}
          alt={vehicle.localizedName}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/300x200/e5e5e5/666?text=${encodeURIComponent(vehicle.localizedName)}`;
          }}
          sx={{
            maxWidth: '90%',
            maxHeight: '90%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </Box>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: nation?.color || '#171717',
              fontWeight: 600,
            }}
          >
            {nation?.flagIcon} {nation?.nameZh}
          </Typography>
          <Chip
            label={`${vehicle.battleRating.toFixed(1)}`}
            size="small"
            sx={{
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              color: '#16a34a',
              fontWeight: 600,
              height: 22,
              fontSize: '0.75rem',
            }}
          />
        </Box>
        
        <Typography
          variant="h6"
          sx={{
            fontFamily: "'WTSymbols', 'Roboto', Tahoma, sans-serif",
            color: '#171717',
            fontWeight: 600,
            fontSize: '1rem',
            mb: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {vehicle.localizedName}
        </Typography>
        
        <Typography
          variant="body2"
          sx={{
            color: '#737373',
            fontSize: '0.8rem',
          }}
        >
          {VEHICLE_TYPE_LABELS[vehicle.vehicleType]}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mt: 1.5, pt: 1.5, borderTop: '1px solid #e5e5e5', alignItems: 'center' }}>
          {vehicle.stats && (
            <>
              <Box>
                <Typography variant="caption" sx={{ color: '#737373', display: 'block' }}>
                  胜率
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: vehicle.stats.winRate > 50 ? '#16a34a' : vehicle.stats.winRate < 48 ? '#dc2626' : '#ca8a04',
                    fontWeight: 600,
                  }}
                >
                  {vehicle.stats.winRate.toFixed(1)}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#737373', display: 'block' }}>
                  KR
                </Typography>
                <Typography variant="body2" sx={{ color: '#171717', fontWeight: 600 }}>
                  {vehicle.stats.killPerSpawn.toFixed(1)}
                </Typography>
              </Box>
            </>
          )}
          
          {/* Penetration Data */}
          {vehicle.performance.penetration > 0 && (
            <Tooltip title={getBestAmmoName(vehicle) || '穿甲弹'} arrow>
              <Box>
                <Typography variant="caption" sx={{ color: '#737373', display: 'block' }}>
                  穿深
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Bolt sx={{ fontSize: 12, color: '#f59e0b' }} />
                  <Typography variant="body2" sx={{ color: '#171717', fontWeight: 600 }}>
                    {Math.round(vehicle.performance.penetration)}mm
                  </Typography>
                </Box>
              </Box>
            </Tooltip>
          )}
          
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <GpsFixed sx={{ 
              fontSize: 14, 
              color: getStabilizerInfo(vehicle.performance.stabilizerType).color 
            }} />
            <Typography 
              variant="caption" 
              sx={{ 
                color: getStabilizerInfo(vehicle.performance.stabilizerType).color,
                fontWeight: 600,
              }}
            >
              {getStabilizerInfo(vehicle.performance.stabilizerType).label}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
