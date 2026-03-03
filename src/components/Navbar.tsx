import { AppBar, Toolbar, Typography, Box, Container, Button } from '@mui/material';
import { Analytics, GitHub } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const isHelicopterPage = currentPath === '/helicopter' || currentPath.startsWith('/helicopter/');
  const isAircraft = currentPath === '/aircraft' || currentPath.startsWith('/aircraft/');
  const isShipPage = currentPath === '/ship' || currentPath.startsWith('/ship/');
  const isGroundPage = !isAircraft && !isHelicopterPage && !isShipPage;

  return (
    <AppBar
      position="fixed"
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #e5e5e5',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Analytics sx={{ mr: 1, color: '#16a34a' }} />
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              fontWeight: 700,
              color: '#171717',
              letterSpacing: '0.5px',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            WT Lens
            <Typography
              component="span"
              sx={{
                ml: 1,
                fontSize: '0.75rem',
                color: '#16a34a',
                fontWeight: 500,
              }}
            >
              战争雷霆数据分析
            </Typography>
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {/* Mode Switcher */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#f5f5f5',
              borderRadius: 2,
              p: 0.5,
              mr: 2,
            }}
          >
            <Button
              size="small"
              onClick={() => navigate('/')}
              sx={{
                backgroundColor: isGroundPage ? '#fff' : 'transparent',
                color: isGroundPage ? '#16a34a' : '#737373',
                fontWeight: 600,
                boxShadow: isGroundPage ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                '&:hover': {
                  backgroundColor: isGroundPage ? '#fff' : 'rgba(0,0,0,0.05)',
                },
              }}
            >
              陆战
            </Button>
            <Button
              size="small"
              onClick={() => navigate('/aircraft')}
              sx={{
                backgroundColor: isAircraft ? '#fff' : 'transparent',
                color: isAircraft ? '#16a34a' : '#737373',
                fontWeight: 600,
                boxShadow: isAircraft ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                '&:hover': {
                  backgroundColor: isAircraft ? '#fff' : 'rgba(0,0,0,0.05)',
                },
              }}
            >
              空战
            </Button>
            <Button
              size="small"
              onClick={() => navigate('/helicopter')}
              sx={{
                backgroundColor: isHelicopterPage ? '#fff' : 'transparent',
                color: isHelicopterPage ? '#16a34a' : '#737373',
                fontWeight: 600,
                boxShadow: isHelicopterPage ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                '&:hover': {
                  backgroundColor: isHelicopterPage ? '#fff' : 'rgba(0,0,0,0.05)',
                },
              }}
            >
              直升机
            </Button>
            <Button
              size="small"
              onClick={() => navigate('/ship')}
              sx={{
                backgroundColor: isShipPage ? '#fff' : 'transparent',
                color: isShipPage ? '#16a34a' : '#737373',
                fontWeight: 600,
                boxShadow: isShipPage ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                '&:hover': {
                  backgroundColor: isShipPage ? '#fff' : 'rgba(0,0,0,0.05)',
                },
              }}
            >
              海战
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              variant="body2"
              sx={{ color: '#525252', display: { xs: 'none', sm: 'block' } }}
            >
              {isShipPage ? '海战历史模式' : isHelicopterPage ? '直升机历史模式' : isAircraft ? '空战历史模式' : '陆战历史模式'}
            </Typography>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#525252', display: 'flex', alignItems: 'center' }}
            >
              <GitHub sx={{ fontSize: 20 }} />
            </a>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
