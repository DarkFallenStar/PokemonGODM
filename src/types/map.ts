export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface CampusPOIMarker {
  id: string;
  name: string;
  type: 'pokestop' | 'gym';
  latitude: number;
  longitude: number;
}

export interface MapViewportState {
  userLocation: Coordinate | null;
  heading: number; // Grados azimut (0 - 360)
  isInsideGeofence: boolean;
  isLoadingGPS: boolean;
  gpsError: string | null;
  isMockedLocation: boolean;
}
