import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import type { Coordinate } from '../types/map';
import {
  CAMPUS_CENTER_COORDINATE,
  isPointInAuthorizedZonesWorklet,
} from '../utils/geofence';

export function useLocationTracker() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMocked, setIsMocked] = useState<boolean>(false);

  const subscriberRef = useRef<Location.LocationSubscription | null>(null);

  // Evalúa si la coordenada se encuentra dentro de las zonas autorizadas (UniSabana o Cajicá)
  const checkGeofence = useCallback((coords: Coordinate) => {
    const inside = isPointInAuthorizedZonesWorklet(coords);
    setIsInsideGeofence(inside);
  }, []);

  // Función para alternar modo simulación en campus (útil para pruebas en emulador o sustentación)
  const toggleMockLocation = useCallback(() => {
    setIsMocked(prev => {
      const nextMock = !prev;
      setIsLoading(false);
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
        if (!isMocked && !location) {
          setIsLoading(true);
        }
        setErrorMsg(null);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setErrorMsg('Permiso de localización denegado. Se requiere GPS para Pokémon GO.');
            setIsLoading(false);
          }
          return;
        }

        // 1. Obtener última posición conocida inmediatamente (0ms latencia)
        const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
        if (lastKnown && isMounted && !isMocked) {
          const coords: Coordinate = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
          setLocation(coords);
          checkGeofence(coords);
          setIsLoading(false);
        }

        // 2. Obtener posición actual con timeout para evitar colgado indefinido en interiores
        const initial = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 3500)),
        ]).catch(() => null);

        if (initial && isMounted && !isMocked) {
          const coords: Coordinate = {
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
          };
          setLocation(coords);
          checkGeofence(coords);
          setIsLoading(false);
        } else if (isMounted) {
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
