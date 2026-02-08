import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { OrderData } from '@/pages/JobScheduling';
import { Cluster, ClusterPoint, clusterJobs, getClusterName } from '@/services/clusteringService';
import { DEPOT_LOCATION } from '@/constants/depot';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';

// Fix Leaflet icon issues
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
};

interface ClusterMapProps {
  orders?: OrderData[];
  showClusters?: boolean;
  onClusterChange?: (clusters: Cluster[]) => void;
}

// Determine which jobs are needed based on order status
const getJobsForOrder = (order: OrderData): ('collection' | 'delivery')[] => {
  const status = order.status;
  const isCollected = order.order_collected === true;
  
  if (['delivered', 'cancelled'].includes(status)) return [];
  if (['collected', 'driver_to_delivery', 'delivery_scheduled'].includes(status)) {
    return ['delivery'];
  }
  if (status === 'collection_scheduled') {
    // Hide collection marker if already collected
    return isCollected ? [] : ['collection'];
  }
  
  // For other statuses, hide collection if already collected
  const jobs: ('collection' | 'delivery')[] = [];
  if (!isCollected) {
    jobs.push('collection');
  }
  jobs.push('delivery');
  return jobs;
};

// Extract cluster points from orders
const extractClusterPoints = (orders: OrderData[]): ClusterPoint[] => {
  const points: ClusterPoint[] = [];
  
  orders.forEach(order => {
    const jobTypes = getJobsForOrder(order);
    
    jobTypes.forEach(type => {
      const isCollection = type === 'collection';
      const contact = isCollection ? order.sender : order.receiver;
      
      if (contact.address.lat && contact.address.lon) {
        points.push({
          id: `${order.id}-${type}`,
          lat: contact.address.lat,
          lon: contact.address.lon,
          type,
          orderId: order.id,
          bikeQuantity: order.bike_quantity || 1
        });
      }
    });
  });
  
  return points;
};

// Create colored marker icon
const createColoredIcon = (color: string, isCollection: boolean) => {
  const iconColor = isCollection ? 'green' : 'red';
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${iconColor}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Create cluster centroid icon using div icon
const createCentroidIcon = (color: string, label: string) => {
  return L.divIcon({
    className: 'cluster-centroid-icon',
    html: `<div style="
      background-color: ${color};
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    ">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

const ClusterMap: React.FC<ClusterMapProps> = ({ 
  orders = [], 
  showClusters = true,
  onClusterChange 
}) => {
  const mapRef = React.useRef<L.Map | null>(null);
  
  useEffect(() => {
    fixLeafletIcon();
  }, []);
  
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [orders]);
  
  // Extract points and cluster them
  const { clusters, points } = useMemo(() => {
    const extractedPoints = extractClusterPoints(orders);
    
    if (!showClusters || extractedPoints.length === 0) {
      return { clusters: [], points: extractedPoints };
    }
    
    const result = clusterJobs(extractedPoints);
    return { clusters: result.clusters, points: extractedPoints };
  }, [orders, showClusters]);
  
  // Notify parent of cluster changes
  useEffect(() => {
    if (onClusterChange) {
      onClusterChange(clusters);
    }
  }, [clusters, onClusterChange]);
  
  // Calculate map center
  const center = useMemo(() => {
    if (points.length === 0) {
      return { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lon };
    }
    
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
    
    return { lat: avgLat, lng: avgLon };
  }, [points]);
  
  // Create depot icon
  const depotIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Create GeoJSON for cluster connections
  const clusterLines = useMemo(() => {
    if (!showClusters || clusters.length === 0) return null;
    
    const features = clusters.flatMap(cluster => 
      cluster.points.map(point => ({
        type: 'Feature' as const,
        properties: { color: cluster.color },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [point.lon, point.lat],
            [cluster.centroid.lon, cluster.centroid.lat]
          ]
        }
      }))
    );
    
    return {
      type: 'FeatureCollection' as const,
      features
    };
  }, [clusters, showClusters]);

  return (
    <div className="space-y-4">
      {/* Cluster Legend */}
      {showClusters && clusters.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
          <span className="text-sm font-medium mr-2">Clusters:</span>
          {clusters.map(cluster => (
            <Badge 
              key={cluster.id} 
              variant="outline"
              style={{ 
                borderColor: cluster.color, 
                backgroundColor: `${cluster.color}20`,
                color: cluster.color
              }}
            >
              {getClusterName(cluster)} ({cluster.points.length} jobs)
            </Badge>
          ))}
          <Badge variant="secondary" className="ml-auto">
            {clusters.length} cluster{clusters.length !== 1 ? 's' : ''} • {points.length} total jobs
          </Badge>
        </div>
      )}
      
      <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border" id="cluster-map-container">
        <MapContainer 
          center={[center.lat, center.lng]} 
          zoom={6} 
          style={{ height: '100%', width: '100%' }}
          whenCreated={(map) => {
            mapRef.current = map;
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {/* Cluster connection lines */}
          {clusterLines && (
            <GeoJSON 
              key={JSON.stringify(clusterLines)}
              data={clusterLines as any}
              style={(feature) => ({
                color: feature?.properties?.color || '#3b82f6',
                weight: 1,
                opacity: 0.3,
                dashArray: '5, 5'
              })}
            />
          )}
          
          {/* Depot Marker */}
          <Marker 
            position={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lon]}
            icon={depotIcon}
          >
            <Popup>
              <div className="p-2">
                <p className="font-semibold">🏭 Depot</p>
                <p className="text-sm text-muted-foreground">{DEPOT_LOCATION.address}</p>
              </div>
            </Popup>
          </Marker>
          
          {/* Render cluster centroids */}
          {showClusters && clusters.map(cluster => (
            <Marker
              key={`centroid-${cluster.id}`}
              position={[cluster.centroid.lat, cluster.centroid.lon]}
              icon={createCentroidIcon(cluster.color, String(cluster.points.length))}
            >
              <Popup>
                <div className="p-2">
                  <p className="font-semibold" style={{ color: cluster.color }}>
                    {getClusterName(cluster)} Cluster
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {cluster.points.length} jobs
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Collections: {cluster.points.filter(p => p.type === 'collection').length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deliveries: {cluster.points.filter(p => p.type === 'delivery').length}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Render clustered job points */}
          {showClusters && clusters.flatMap(cluster => 
            cluster.points.map(point => (
              <Marker
                key={point.id}
                position={[point.lat, point.lon]}
                icon={createColoredIcon(cluster.color, point.type === 'collection')}
              >
                <Popup>
                  <div className="p-2">
                    <p className="font-semibold">
                      {point.type === 'collection' ? '📦 Collection' : '🚚 Delivery'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Bikes: {point.bikeQuantity}
                    </p>
                    <p className="text-xs mt-1" style={{ color: cluster.color }}>
                      Cluster: {getClusterName(cluster)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))
          )}
          
          {/* Render non-clustered points if clustering is disabled */}
          {!showClusters && points.map(point => (
            <Marker
              key={point.id}
              position={[point.lat, point.lon]}
              icon={createColoredIcon('#3b82f6', point.type === 'collection')}
            >
              <Popup>
                <div className="p-2">
                  <p className="font-semibold">
                    {point.type === 'collection' ? '📦 Collection' : '🚚 Delivery'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bikes: {point.bikeQuantity}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default ClusterMap;
