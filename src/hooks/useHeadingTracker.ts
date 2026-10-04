import { useState, useEffect } from 'react';
import { Magnetometer } from 'expo-sensors';

export function useHeadingTracker() {
  const [heading, setHeading] = useState<number>(0);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    async function initMagnetometer() {
      try {
        Magnetometer.setUpdateInterval(80);

        subscription = Magnetometer.addListener(data => {
          if (!data) return;
          let angle = Math.atan2(-data.x, data.y) * (180 / Math.PI);
          if (angle < 0) {
            angle += 360;
          }
          setHeading(Math.round(angle));
        });

        const available = await Magnetometer.isAvailableAsync().catch(() => true);
        setIsAvailable(available);
      } catch (err) {
        console.warn('Magnetometer init error:', err);
      }
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
