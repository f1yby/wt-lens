import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Box, CircularProgress } from '@mui/material';

// 懒加载页面组件
const HomePage = lazy(() => import('./pages/HomePage'));
const VehicleDetailPage = lazy(() => import('./pages/VehicleDetailPage'));

// 加载状态组件
function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );
}

const darkTheme = createTheme({
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
    mode: 'dark',
    background: {
      default: '#0a0a0a',
      paper: '#171717',
    },
    primary: {
      main: '#4ade80',
    },
    secondary: {
      main: '#3b82f6',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a3a3a3',
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

const lightTheme = createTheme({
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
  // Force light theme for better visibility
  const theme = lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename="/wt-lens">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/vehicle/:id" element={<VehicleDetailPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
