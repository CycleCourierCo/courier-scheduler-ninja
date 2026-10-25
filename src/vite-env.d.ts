
/// <reference types="vite/client" />
/// <reference types="leaflet" />

declare module 'react-leaflet' {
  import * as L from 'leaflet';
  import { ReactNode } from 'react';

  export interface MapContainerProps {
    preferCanvas?: boolean;
    zoomAnimation?: boolean;
    fadeAnimation?: boolean;
    markerZoomAnimation?: boolean;
    center: L.LatLngExpression;
    zoom: number;
    children?: ReactNode;
    scrollWheelZoom?: boolean;
    className?: string;
    style?: React.CSSProperties;
    whenCreated?: (map: L.Map) => void;
  }

  export interface TileLayerProps {
    url: string;
    attribution?: string;
  }

  export interface MarkerProps {
    position: L.LatLngExpression;
    children?: ReactNode;
    key?: any;
    icon?: L.Icon | L.DivIcon;
  }

  export interface GeoJSONProps {
    data: any;
    style?: (feature: any) => L.PathOptions;
    onEachFeature?: (feature: any, layer: L.Layer) => void;
  }

  export const MapContainer: React.FC<MapContainerProps>;
  export const TileLayer: React.FC<TileLayerProps>;
  export const Marker: React.FC<MarkerProps>;
  export const Popup: React.FC<{children?: ReactNode}>;
  export const GeoJSON: React.FC<GeoJSONProps>;
  export const Polyline: React.FC<{ positions: L.LatLngExpression[]; pathOptions?: L.PathOptions; children?: ReactNode }>;
  export const CircleMarker: React.FC<{ center: L.LatLngExpression; radius?: number; pathOptions?: L.PathOptions; children?: ReactNode }>;
  export const Tooltip: React.FC<{ children?: ReactNode; permanent?: boolean; direction?: L.Direction; offset?: L.PointExpression }>;
  export function useMap(): L.Map;
}
