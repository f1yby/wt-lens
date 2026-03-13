/**
 * Ship Detail Page - uses generic DetailPage with ship config
 */
import DetailPage from './DetailPage';
import { shipConfig } from '../config/vehicleConfigs';

export default function ShipDetailPage() {
  return <DetailPage config={shipConfig} />;
}
