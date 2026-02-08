import { DEPOT_LOCATION } from "@/constants/depot";

export interface ClusterPoint {
  id: string;
  lat: number;
  lon: number;
  type: 'collection' | 'delivery';
  orderId: string;
  bikeQuantity: number;
  trackingNumber: string;
}

export interface Cluster {
  id: number;
  centroid: { lat: number; lon: number };
  points: ClusterPoint[];
  color: string;
}

export interface ClusterResult {
  clusters: Cluster[];
  outliers: ClusterPoint[];
}

// Cluster colors for visualization
const CLUSTER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#6366f1', // indigo
];

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate geographic centroid of a set of points
 */
const calculateCentroid = (points: ClusterPoint[]): { lat: number; lon: number } => {
  if (points.length === 0) {
    return { lat: DEPOT_LOCATION.lat, lon: DEPOT_LOCATION.lon };
  }
  
  const sumLat = points.reduce((sum, p) => sum + p.lat, 0);
  const sumLon = points.reduce((sum, p) => sum + p.lon, 0);
  
  return {
    lat: sumLat / points.length,
    lon: sumLon / points.length
  };
};

/**
 * K-Means++ initialization - select initial centroids with better distribution
 */
const initializeCentroidsKMeansPlusPlus = (
  points: ClusterPoint[],
  k: number
): { lat: number; lon: number }[] => {
  if (points.length === 0 || k === 0) return [];
  
  const centroids: { lat: number; lon: number }[] = [];
  
  // Pick first centroid randomly
  const firstIdx = Math.floor(Math.random() * points.length);
  centroids.push({ lat: points[firstIdx].lat, lon: points[firstIdx].lon });
  
  // Pick remaining centroids with probability proportional to distance squared
  while (centroids.length < k && centroids.length < points.length) {
    const distances = points.map(point => {
      const minDist = Math.min(
        ...centroids.map(c => haversineDistance(point.lat, point.lon, c.lat, c.lon))
      );
      return minDist * minDist; // Square for probability weighting
    });
    
    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;
    
    let random = Math.random() * totalDist;
    let selectedIdx = 0;
    
    for (let i = 0; i < distances.length; i++) {
      random -= distances[i];
      if (random <= 0) {
        selectedIdx = i;
        break;
      }
    }
    
    centroids.push({ lat: points[selectedIdx].lat, lon: points[selectedIdx].lon });
  }
  
  return centroids;
};

/**
 * Assign each point to nearest centroid
 */
const assignPointsToClusters = (
  points: ClusterPoint[],
  centroids: { lat: number; lon: number }[]
): Map<number, ClusterPoint[]> => {
  const assignments = new Map<number, ClusterPoint[]>();
  
  centroids.forEach((_, idx) => assignments.set(idx, []));
  
  points.forEach(point => {
    let minDist = Infinity;
    let nearestCluster = 0;
    
    centroids.forEach((centroid, idx) => {
      const dist = haversineDistance(point.lat, point.lon, centroid.lat, centroid.lon);
      if (dist < minDist) {
        minDist = dist;
        nearestCluster = idx;
      }
    });
    
    assignments.get(nearestCluster)!.push(point);
  });
  
  return assignments;
};

/**
 * K-Means clustering with Haversine distance
 */
export const kMeansCluster = (
  points: ClusterPoint[],
  k: number,
  maxIterations: number = 50
): ClusterResult => {
  if (points.length === 0) {
    return { clusters: [], outliers: [] };
  }
  
  // Adjust k if we have fewer points
  const actualK = Math.min(k, points.length);
  
  if (actualK === 0) {
    return { clusters: [], outliers: points };
  }
  
  // Initialize centroids using K-Means++
  let centroids = initializeCentroidsKMeansPlusPlus(points, actualK);
  
  let assignments: Map<number, ClusterPoint[]> = new Map();
  let iteration = 0;
  let converged = false;
  
  while (iteration < maxIterations && !converged) {
    // Assign points to nearest centroid
    assignments = assignPointsToClusters(points, centroids);
    
    // Calculate new centroids
    const newCentroids = centroids.map((_, idx) => {
      const clusterPoints = assignments.get(idx) || [];
      return calculateCentroid(clusterPoints);
    });
    
    // Check for convergence (centroids stopped moving)
    converged = centroids.every((centroid, idx) => {
      const dist = haversineDistance(
        centroid.lat, centroid.lon,
        newCentroids[idx].lat, newCentroids[idx].lon
      );
      return dist < 0.1; // Less than 100m movement
    });
    
    centroids = newCentroids;
    iteration++;
  }
  
  // Build final clusters
  const clusters: Cluster[] = [];
  
  centroids.forEach((centroid, idx) => {
    const clusterPoints = assignments.get(idx) || [];
    if (clusterPoints.length > 0) {
      clusters.push({
        id: idx,
        centroid,
        points: clusterPoints,
        color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length]
      });
    }
  });
  
  return { clusters, outliers: [] };
};

/**
 * Calculate optimal number of clusters using the Elbow method with silhouette score
 */
export const determineOptimalK = (
  points: ClusterPoint[],
  maxBikesPerVan: number = 10,
  maxDistancePerRoute: number = 600
): number => {
  if (points.length === 0) return 0;
  if (points.length === 1) return 1;
  
  // Minimum clusters based on bike capacity
  const totalBikes = points
    .filter(p => p.type === 'collection')
    .reduce((sum, p) => sum + p.bikeQuantity, 0);
  const minByCapacity = Math.ceil(totalBikes / maxBikesPerVan);
  
  // Consider geographic spread
  const latitudes = points.map(p => p.lat);
  const longitudes = points.map(p => p.lon);
  const latRange = Math.max(...latitudes) - Math.min(...latitudes);
  const lonRange = Math.max(...longitudes) - Math.min(...longitudes);
  
  // Rough estimate: 1 degree latitude ≈ 111 km
  const spreadKm = Math.max(latRange * 111, lonRange * 85);
  const kmPerRoute = maxDistancePerRoute * 1.60934; // miles to km
  const minByDistance = Math.ceil(spreadKm / (kmPerRoute / 2)); // Divide by 2 for round trips
  
  // Use higher of capacity or distance constraints
  const minClusters = Math.max(1, minByCapacity, minByDistance);
  
  // Cap at reasonable max
  const maxClusters = Math.min(points.length, 10);
  
  return Math.min(minClusters, maxClusters);
};

/**
 * Main clustering function that auto-determines optimal clusters
 */
export const clusterJobs = (
  points: ClusterPoint[],
  options?: {
    maxBikesPerVan?: number;
    maxDistancePerRoute?: number;
    forceK?: number;
  }
): ClusterResult => {
  const maxBikes = options?.maxBikesPerVan ?? 10;
  const maxDistance = options?.maxDistancePerRoute ?? 600;
  
  const k = options?.forceK ?? determineOptimalK(points, maxBikes, maxDistance);
  
  return kMeansCluster(points, k);
};

/**
 * Get cluster name based on geographic position relative to depot
 */
export const getClusterName = (cluster: Cluster): string => {
  const { lat, lon } = cluster.centroid;
  const depotLat = DEPOT_LOCATION.lat;
  const depotLon = DEPOT_LOCATION.lon;
  
  const distFromDepot = haversineDistance(lat, lon, depotLat, depotLon);
  
  // Within 80km of depot = Local
  if (distFromDepot < 80) {
    return 'Local';
  }
  
  // Determine direction from depot
  const latDiff = lat - depotLat;
  const lonDiff = lon - depotLon;
  
  if (latDiff > 1.5) {
    return 'North';
  } else if (latDiff < -1.0) {
    return 'South';
  } else if (lonDiff < -1.5) {
    return 'Wales/West';
  } else if (lonDiff > 0.5) {
    return 'East';
  }
  
  return 'Central';
};
