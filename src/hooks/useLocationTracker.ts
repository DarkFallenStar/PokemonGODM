import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import type { Coordinate } from '../types/map';
import { UNISABANA_POLYGON, CAMPUS_CENTER_COORDINATE, isPointInPolygonWorklet } from '../utils/geofence';

export function useLocationTracker() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMocked, setIsMocked] = useState<boolean>(false);

  const subscriberRef = useRef<Location.LocationSubscription | null>(null);

  // Evalúa si la coordenada se encuentra dentro del polígono del campus
  const checkGeofence = useCallback((coords: Coordinate) => {
    const inside = isPointInPolygonWorklet(coords, UNISABANA_POLYGON);
    setIsInsideGeofence(inside);
  }, []);

  // Función para alternar modo simulación en campus (útil para pruebas en emulador o sustentación)
  const toggleMockLocation = useCallback(() => {
    setIsMocked(prev => {
      const nextMock = !prev;
      if (nextMock) {
        // Simular ubicación dentro del campus
        setLocation(CAMPUS_CENTER_COORDINATE);
        checkGeofence(CAMPUS_CENTER_COORDINATE);
      }
      return nextMock;
    });
  }, [checkGeofence]);

  useEffect(() => {
    let isMounted = true;

    async function startWatching() {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setErrorMsg('Permiso de localización denegado. Se requiere GPS para Pokémon GO.');
            setIsLoading(false);
          }
          return;
        }

        // Obtener posición inicial inmediata
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted && !isMocked) {
          const coords: Coordinate = {
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
          };
          setLocation(coords);
          checkGeofence(coords);
          setIsLoading(false);
        }

        // Suscribirse a cambios continuos con balance de consumo de batería
        // timeInterval >= 3000ms (3.5 segundos) según requerimiento de rúbrica
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 3500,
            distanceInterval: 3,
          },
          newLoc => {
            if (isMounted && !isMocked) {
              const coords: Coordinate = {
                latitude: newLoc.coords.latitude,
                longitude: newLoc.coords.longitude,
              };
              setLocation(coords);
              checkGeofence(coords);
            }
          }
        );

        subscriberRef.current = sub;
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'Error al iniciar listener de localización');
          setIsLoading(false);
        }
      }
    }

    startWatching();

    return () => {
      isMounted = false;
      if (subscriberRef.current) {
        subscriberRef.current.remove();
        subscriberRef.current = null;
      }
    };
  }, [isMocked, checkGeofence]);

  return {
    location,
    isInsideGeofence,
    isLoading,
    errorMsg,
    isMocked,
    toggleMockLocation,
  };
}
