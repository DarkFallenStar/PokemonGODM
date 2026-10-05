import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Gyroscope, Accelerometer } from 'expo-sensors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ARCameraViewportProps {
  children: React.ReactNode;
  onOffsetChange?: (offset: { x: number; y: number }) => void;
  arEnabled?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ARCameraViewport: React.FC<ARCameraViewportProps> = ({
  children,
  onOffsetChange,
  arEnabled = true,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();

  // Filtro complementario de posición angular
  const pitchRef = useRef<number>(0);
  const yawRef = useRef<number>(0);
  const baselinePitchRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(Date.now());
  const lastSentOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Solicitar permiso de cámara en runtime
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  // Función para recentrar inmediatamente la criatura en pantalla
  const handleRecenter = useCallback(() => {
    pitchRef.current = 0;
    yawRef.current = 0;
    baselinePitchRef.current = null;
    lastSentOffsetRef.current = { x: 0, y: 0 };
    onOffsetChange?.({ x: 0, y: 0 });
  }, [onOffsetChange]);

  // Listener de Sensores Inerciales (Giróscopo + Acelerómetro a ~40 Hz)
  useEffect(() => {
    if (!arEnabled) {
      pitchRef.current = 0;
      yawRef.current = 0;
      baselinePitchRef.current = null;
      lastSentOffsetRef.current = { x: 0, y: 0 };
      onOffsetChange?.({ x: 0, y: 0 });
      return;
    }

    Gyroscope.setUpdateInterval(25);
    Accelerometer.setUpdateInterval(25);

    const gyroSub = Gyroscope.addListener(gyroData => {
      const now = Date.now();
      const dt = Math.max(0.005, Math.min(0.06, (now - lastTimestampRef.current) / 1000));
      lastTimestampRef.current = now;

      // Integración de velocidad angular en ejes del dispositivo:
      // gyroData.x: velocidad angular en Pitch (eje X, inclinación arriba/abajo)
      // gyroData.y: velocidad angular en Yaw (eje Y vertical, giro izquierda/derecha)
      pitchRef.current += gyroData.x * dt;
      yawRef.current += gyroData.y * dt;

      // Leaky integrator suave en Yaw para contrarrestar la deriva a largo plazo
      yawRef.current *= 0.998;

      // Factor de escala angular según campo visual (FOV ~60 grados)
      const pixelPerRad = SCREEN_WIDTH / 1.05;

      // Compensación espacial AR realista:
      // - Al girar a la IZQUIERDA (yaw > 0), el Pokémon debe desplazarse a la DERECHA (+X).
      // - Al girar a la DERECHA (yaw < 0), el Pokémon debe desplazarse a la IZQUIERDA (-X).
      const rawOffsetX = yawRef.current * pixelPerRad;

      // - Al inclinar hacia ARRIBA (pitch > 0), la cámara mira arriba, el Pokémon se desplaza hacia ABAJO (+Y).
      // - Al inclinar hacia ABAJO (pitch < 0), la cámara mira abajo, el Pokémon se desplaza hacia ARRIBA (-Y).
      const rawOffsetY = pitchRef.current * pixelPerRad;

      // Clamping elástico para mantener al Pokémon en el área visible interactiva
      const maxClampX = SCREEN_WIDTH * 0.44;
      const maxClampY = SCREEN_HEIGHT * 0.28;

      const clampedX = Math.max(-maxClampX, Math.min(maxClampX, rawOffsetX));
      const clampedY = Math.max(-maxClampY, Math.min(maxClampY, rawOffsetY));

      // Throttling de re-renders para optimizar el hilo de Javascript
      const delta = Math.hypot(
        clampedX - lastSentOffsetRef.current.x,
        clampedY - lastSentOffsetRef.current.y
      );

      if (delta > 0.8) {
        lastSentOffsetRef.current = { x: clampedX, y: clampedY };
        onOffsetChange?.({ x: clampedX, y: clampedY });
      }
    });

    const accelSub = Accelerometer.addListener(accelData => {
      // Estimación del ángulo Pitch respecto a la gravedad:
      // En modo Portrait: +Y apunta hacia arriba y +Z hacia la cara del usuario.
      // Cuando se sostiene vertical, az ~ 0 y ay ~ 9.8.
      // Cuando se inclina hacia atrás (mirando al cielo), az se torna positivo.
      const planarMagnitude = Math.sqrt(accelData.x ** 2 + accelData.y ** 2);
      if (planarMagnitude > 0.05) {
        const measuredPitch = Math.atan2(accelData.z, planarMagnitude);

        // Calibrar la postura inicial del usuario al ingresar a la captura
        if (baselinePitchRef.current === null) {
          baselinePitchRef.current = measuredPitch;
        }

        const relativePitch = measuredPitch - baselinePitchRef.current;

        // Filtro complementario: 94% giroscopio a alta frecuencia, 6% acelerómetro para anclar el horizonte
        const alpha = 0.94;
        pitchRef.current = alpha * pitchRef.current + (1 - alpha) * relativePitch;
      }
    });

    return () => {
      gyroSub.remove();
      accelSub.remove();
    };
  }, [arEnabled, onOffsetChange]);

  const canUseCamera = arEnabled && permission?.granted;

  return (
    <View style={styles.container}>
      {canUseCamera ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        // Fallback de Estudio: Fondo 2D inmersivo de césped y cielo virtual
        <View style={[StyleSheet.absoluteFill, styles.studioBackground]}>
          <View style={styles.studioSky} />
          <View style={styles.studioGround}>
            <View style={styles.captureRingDecor} />
          </View>
          {!permission?.granted && arEnabled && (
            <TouchableOpacity
              style={styles.permissionBadge}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionText}>
                📷 Activar cámara en vivo
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Botón de Recentrado Rápido AR */}
      {canUseCamera && (
        <TouchableOpacity
          style={[styles.recenterBadge, { top: insets.top + 54 }]}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Text style={styles.recenterText}>🎯 Centrar</Text>
        </TouchableOpacity>
      )}

      {/* Capa de Realidad Aumentada y Elementos del Juego */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  studioBackground: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  studioSky: {
    flex: 1,
    backgroundColor: '#1E293B',
  },
  studioGround: {
    height: SCREEN_HEIGHT * 0.45,
    backgroundColor: '#166534',
    borderTopWidth: 4,
    borderTopColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureRingDecor: {
    width: 220,
    height: 110,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(34, 197, 94, 0.35)',
    transform: [{ scaleY: 0.5 }],
  },
  permissionBadge: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  permissionText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  recenterBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38BDF8',
    zIndex: 10,
  },
  recenterText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
});
