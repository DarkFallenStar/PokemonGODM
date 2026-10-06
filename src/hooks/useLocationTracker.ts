import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import type { Coordinate } from '../types/map';
import {
  CAMPUS_CENTER_COORDINATE,
  HOME_CAJICA_CENTER,
  isPointInAuthorizedZonesWorklet,
  isTestZoneEnabled,
} from '../utils/geofence';

export type MockGpsMode = 'real' | 'campus' | 'cajica';

export function useLocationTracker() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState<MockGpsMode>('real');

  const subscriberRef = useRef<Location.LocationSubscription | null>(null);
  const realLocationRef = useRef<Coordinate | null>(null);

  // Evalúa si la coordenada se encuentra dentro de las zonas autorizadas (UniSabana o Cajicá)
  const checkGeofence = useCallback((coords: Coordinate) => {
    const inside = isPointInAuthorizedZonesWorklet(coords, isTestZoneEnabled());
    setIsInsideGeofence(inside);
  }, []);

  // Forzar reevaluación inmediata de geofencing (ej. tras actualizar vértices del polígono)
  const recheckGeofence = useCallback(() => {
    const testZoneActive = isTestZoneEnabled();
    const current =
      location ||
      (mockMode === 'campus'
        ? CAMPUS_CENTER_COORDINATE
        : mockMode === 'cajica'
        ? HOME_CAJICA_CENTER
        : realLocationRef.current);
    if (current) {
      const inside = isPointInAuthorizedZonesWorklet(current, testZoneActive);
      setIsInsideGeofence(inside);
      return inside;
    }
    return true;
  }, [location, mockMode]);

  // Función para alternar modo simulación (Real -> Campus UniSabana -> Cajicá -> Real)
  const toggleMockLocation = useCallback(() => {
    const testZoneActive = isTestZoneEnabled();
    setMockMode(prev => {
      let nextMode: MockGpsMode = 'real';
      if (prev === 'real') {
        nextMode = 'campus';
      } else if (prev === 'campus') {
        nextMode = testZoneActive ? 'cajica' : 'real';
      } else {
        nextMode = 'real';
      }

      setIsLoading(false);

      if (nextMode === 'campus') {
        setLocation(CAMPUS_CENTER_COORDINATE);
        checkGeofence(CAMPUS_CENTER_COORDINATE);
      } else if (nextMode === 'cajica') {
        setLocation(HOME_CAJICA_CENTER);
        checkGeofence(HOME_CAJICA_CENTER);
      } else {
        // Restaurar GPS real si existe
        if (realLocationRef.current) {
          setLocation(realLocationRef.current);
          checkGeofence(realLocationRef.current);
        }
      }

      return nextMode;
    });
  }, [checkGeofence]);

  const isMocked = mockMode !== 'real';

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
        if (lastKnown) {
          const coords: Coordinate = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
          realLocationRef.current = coords;
          if (isMounted && mockMode === 'real') {
            setLocation(coords);
            checkGeofence(coords);
            setIsLoading(false);
          }
        }

        // 2. Obtener posición actual con alta precisión y timeout rápido
        const initial = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 2500)),
        ]).catch(() => null);

        if (initial) {
          const coords: Coordinate = {
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
          };
          realLocationRef.current = coords;
          if (isMounted && mockMode === 'real') {
            setLocation(coords);
            checkGeofence(coords);
            setIsLoading(false);
          }
        } else if (isMounted) {
          setIsLoading(false);
        }

        // Suscribirse a cambios continuos con alta velocidad y receptividad GPS (1.5 segundos / 1 metro)
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1500,
            distanceInterval: 1,
          },
          newLoc => {
            const coords: Coordinate = {
              latitude: newLoc.coords.latitude,
              longitude: newLoc.coords.longitude,
            };
            realLocationRef.current = coords;
            if (isMounted && mockMode === 'real') {
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
  }, [mockMode, isMocked, checkGeofence]);

  return {
    location,
    isInsideGeofence,
    isLoading,
    errorMsg,
    isMocked,
    mockMode,
    toggleMockLocation,
    recheckGeofence,
  };
}
