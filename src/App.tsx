import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';

// 懒加载页面组件
const HomePage = lazy(() => import('./pages/HomePage'));
const VehicleDetailPage = lazy(() => import('./pages/VehicleDetailPage'));
const LanzOdermattPage = lazy(() => import('./pages/LanzOdermattPage'));
const DeMarrePage = lazy(() => import('./pages/DeMarrePage'));
const AircraftPage = lazy(() => import('./pages/AircraftPage'));
const AircraftDetailPage = lazy(() => import('./pages/AircraftDetailPage'));
const HelicopterPage = lazy(() => import('./pages/HelicopterPage'));
const ShipPage = lazy(() => import('./pages/ShipPage'));
const ShipDetailPage = lazy(() => import('./pages/ShipDetailPage'));

// 加载状态组件
function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );
}

const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 768,
      lg: 1280,
      xl: 1920,
    },
  },
  palette: {
    mode: 'light',
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    primary: {
      main: '#16a34a',
    },
    secondary: {
      main: '#2563eb',
    },
    text: {
      primary: '#171717',
      secondary: '#525252',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Inter", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename="/wt-lens">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/vehicle/:id" element={<VehicleDetailPage />} />
            <Route path="/lo-calculator" element={<LanzOdermattPage />} />
            <Route path="/demarre-calculator" element={<DeMarrePage />} />
            <Route path="/aircraft" element={<AircraftPage />} />
            <Route path="/aircraft/:id" element={<AircraftDetailPage />} />
            <Route path="/helicopter" element={<HelicopterPage />} />
            <Route path="/helicopter/:id" element={<AircraftDetailPage />} />
            <Route path="/ship" element={<ShipPage />} />
            <Route path="/ship/:id" element={<ShipDetailPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
