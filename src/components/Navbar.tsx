import { AppBar, Toolbar, Typography, Box, Container } from '@mui/material';
import { Analytics, GitHub } from '@mui/icons-material';

export default function Navbar() {
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
              flexGrow: 1,
              fontWeight: 700,
              color: '#171717',
              letterSpacing: '0.5px',
            }}
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
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              variant="body2"
              sx={{ color: '#525252', display: { xs: 'none', sm: 'block' } }}
            >
              陆战历史模式
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
