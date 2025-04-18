
/// <reference types="vite/client" />
/// <reference types="leaflet" />

declare module 'react-leaflet' {
  import * as L from 'leaflet';
  import { ReactNode } from 'react';

  export interface MapContainerProps {
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

  export const MapContainer: React.FC<MapContainerProps>;
  export const TileLayer: React.FC<TileLayerProps>;
  export const Marker: React.FC<{position: L.LatLngExpression, children?: ReactNode, key?: any}>;
  export const Popup: React.FC<{children?: ReactNode}>;
}
