/**
 * Aircraft Detail Page - uses generic DetailPage with aircraft config
 */
import { useLocation } from 'react-router-dom';
import DetailPage from './DetailPage';
import { createAircraftConfig } from '../config/vehicleConfigs';

export default function AircraftDetailPage() {
  const location = useLocation();
  const isHelicopter = location.pathname.startsWith('/helicopter');
  const config = createAircraftConfig(isHelicopter);
  
  return <DetailPage config={config} />;
}
