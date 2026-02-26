import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import HomePage from './pages/HomePage';
import VehicleDetailPage from './pages/VehicleDetailPage';

const darkTheme = createTheme({
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
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/vehicle/:id" element={<VehicleDetailPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
