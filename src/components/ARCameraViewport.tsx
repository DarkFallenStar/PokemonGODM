import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Gyroscope, Accelerometer } from 'expo-sensors';

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
  const [hasSensorSupport, setHasSensorSupport] = useState<boolean>(true);

  // Filtro complementario de posición angular
  const pitchRef = useRef<number>(0);
  const rollRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(Date.now());

  // Solicitar permiso de cámara en runtime
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  // Listener de Sensores Inerciales (Giróscopo + Acelerómetro a ~60 Hz)
  useEffect(() => {
    if (!arEnabled) {
      onOffsetChange?.({ x: 0, y: 0 });
      return;
    }

    Gyroscope.setUpdateInterval(16);
    Accelerometer.setUpdateInterval(16);

    const gyroSub = Gyroscope.addListener(gyroData => {
      const now = Date.now();
      const dt = Math.max(0.005, Math.min(0.05, (now - lastTimestampRef.current) / 1000));
      lastTimestampRef.current = now;

      // Integración de velocidad angular: pitch (eje x) y roll (eje y)
      pitchRef.current += gyroData.x * dt;
      rollRef.current += gyroData.y * dt;

      // Compensación visual inversa: mover el sprite en sentido contrario a la rotación
      const pixelPerRad = SCREEN_WIDTH / 1.1; // FOV aproximado de ~60 grados
      const rawOffsetX = -rollRef.current * pixelPerRad;
      const rawOffsetY = pitchRef.current * pixelPerRad;

      // Clamping elástico para evitar que la criatura se pierda indefinidamente
      const maxClampX = SCREEN_WIDTH * 0.45;
      const maxClampY = SCREEN_HEIGHT * 0.25;

      const clampedX = Math.max(-maxClampX, Math.min(maxClampX, rawOffsetX));
      const clampedY = Math.max(-maxClampY, Math.min(maxClampY, rawOffsetY));

      onOffsetChange?.({ x: clampedX, y: clampedY });
    });

    const accelSub = Accelerometer.addListener(accelData => {
      // Corrección de deriva (Drift) mediante el vector de gravedad estático
      const alpha = 0.96; // 96% giroscopio, 4% acelerómetro
      const staticPitch = Math.atan2(accelData.y, Math.sqrt(accelData.x ** 2 + accelData.z ** 2));
      const staticRoll = Math.atan2(-accelData.x, accelData.z);

      pitchRef.current = alpha * pitchRef.current + (1 - alpha) * staticPitch;
      rollRef.current = alpha * rollRef.current + (1 - alpha) * staticRoll;
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
});
