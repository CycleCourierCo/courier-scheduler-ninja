
/// <reference types="vite/client" />

// Add react-leaflet type overrides
declare module 'react-leaflet' {
  import * as L from 'leaflet';
  import * as React from 'react';

  export interface MapContainerProps extends React.DOMAttributes<HTMLDivElement> {
    center: L.LatLngExpression;
    zoom: number;
    scrollWheelZoom?: boolean;
    style?: React.CSSProperties;
    className?: string;
    id?: string;
  }

  export interface TileLayerProps extends React.DOMAttributes<HTMLDivElement> {
    attribution: string;
    url: string;
  }
  
  export const MapContainer: React.FC<MapContainerProps>;
  export const TileLayer: React.FC<TileLayerProps>;
  export const Popup: React.FC<any>;
  export const Marker: React.FC<any>;
}
