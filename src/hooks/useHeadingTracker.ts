import { useState, useEffect } from 'react';
import { Magnetometer } from 'expo-sensors';

export function useHeadingTracker() {
  const [heading, setHeading] = useState<number>(0);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    async function initMagnetometer() {
      const available = await Magnetometer.isAvailableAsync();
      setIsAvailable(available);

      if (!available) {
        return;
      }

      // Intervalo de 200ms para rotación fluida y balance de energía
      Magnetometer.setUpdateInterval(200);

      subscription = Magnetometer.addListener(data => {
        // Cálculo del ángulo azimutal a partir de los vectores x e y
        let angle = Math.atan2(-data.x, data.y) * (180 / Math.PI);
        if (angle < 0) {
          angle += 360;
        }
        setHeading(Math.round(angle));
      });
    }

    initMagnetometer();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return { heading, isAvailable };
}
