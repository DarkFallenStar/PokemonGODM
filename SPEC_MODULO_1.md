# Especificación Técnica (SDD): Etapa 1 - Inicialización y Arquitectura Base

**Estado**: Implementado  
**Fecha**: 2026-10-03  
**Autor**: Antigravity (Senior Mobile Architect) & User  
**Versión**: 1.0.0  
**Proyecto**: Pokémon GO UniSabana  

---

## 1. Alcance y Objetivos (Scope & Objectives)

### 1.1. Problema / Necesidad
Establecer los cimientos arquitectónicos del proyecto móvil de manera ultraligera ("Cero Bloat"), configurando la conexión con la base de datos Supabase y una navegación por pestañas nativas desacoplada que no comprometa los recursos de CPU/RAM para los módulos intensivos posteriores (Mapas vectoriales, Geofencing, Cámara AR y Balística).

### 1.2. Objetivos (Goals)
1. **Auditoría e Higiene de Dependencias**: Validar `package.json` para asegurar compatibilidad estricta con Expo SDK 57 sin dependencias redundantes.
2. **Cliente Supabase Tipado**: Instanciar y exportar un cliente singleton de Supabase en `src/services/supabase.ts` con validación en tiempo de ejecución de variables de entorno y polyfill de URLs para el motor Hermes.
3. **Navegación Nativa Ultraligera**: Implementar un Bottom Tabs Navigator tipado (`MapScreen`, `InventoryScreen`, `ProfileScreen`) apoyado en `react-native-screens` para optimización de memoria.
4. **Pantallas Base**: Crear placeholders limpios utilizando exclusivamente `StyleSheet` nativo de React Native (sin librerías de UI externas).

### 1.3. Fuera de Alcance (Non-Goals)
- No se implementará renderizado de mapa real de Mapbox aún (corresponde a la Etapa 3).
- No se descargarán ni consumirán datos de Pokémon en esta etapa (corresponde a la Etapa 2).
- No se instalarán librerías de componentes UI (como NativeBase, Tamagui, UI Kitten o Paper).

### 1.4. Restricciones Técnicas
- **Expo SDK**: 57.0.26
- **React Native**: 0.86.3
- **Motor JS**: Hermes (requiere `react-native-url-polyfill` para `URL` nativo en Supabase).
- **Threading**: Main Thread (UI) debe permanecer libre para 60/120 FPS; delegar transiciones a `react-native-screens`.

---

## 2. Auditoría Topológica y Validación de `package.json`

### 2.1. Estado de Dependencias Actuales
| Paquete | Versión Actual | Estado | Rol en el Proyecto |
|---|---|---|---|
| `expo` | `~57.0.26` | Correcto | Framework runtime base |
| `react` | `19.2.3` | Correcto | Núcleo de componentes |
| `react-native` | `0.86.3` | Correcto | Runtime nativo |
| `@supabase/supabase-js` | `^2.117.2` | Correcto | SDK de persistencia y BaaS |
| `react-native-url-polyfill`| `^4.0.0` | Correcto | Polyfill crítico para cliente Supabase en Hermes |
| `@rnmapbox/maps` | `^10.3.5` | Correcto | Motor cartográfico nativo (para Etapa 3) |
| `expo-camera` | `~57.0.6` | Correcto | Acceso de hardware cámara (para Etapa 5) |
| `expo-sensors` | `~57.0.3` | Correcto | Giroscopio/Acelerómetro (para Etapa 5) |
| `react-native-reanimated` | `4.5.1` | Correcto | Motor de animaciones en UI Thread / Worklets |
| `react-native-gesture-handler`| `~2.32.0` | Correcto | Manejador nativo de gestos táctiles |

### 2.2. Dependencias Faltantes para Navegación
Para habilitar el enrutamiento requerido se precisan únicamente los núcleos de React Navigation compatibles con SDK 57:
- `@react-navigation/native`
- `@react-navigation/bottom-tabs`
- `react-native-screens`
- `react-native-safe-area-context`

---

## 3. Justificación Técnica: Selección de Librería de Navegación

### Comparativa: React Navigation vs Expo Router

| Criterio | React Navigation (Bottom Tabs) | Expo Router |
|---|---|---|
| **Paradigma** | Imperativo/Declarativo vía JSX y TypeScript Params | Basado en el sistema de archivos (`src/app`) |
| **Sobrecarga de Bundle (Overhead)** | Mínima: Solo los paquetes esenciales (`@react-navigation/*`) | Media: Requiere configuración de punto de entrada, esquemas de linking automáticos y resolvers |
| **Gestión de Memoria RAM** | **Excelente**: `react-native-screens` desacopla del árbol nativo (`detachInactiveScreens: true`) las pestañas ocultas, liberando buffers gráficos | Buena, pero introduce capas de abstracción innecesarias para 3 pestañas fijas |
| **Alineación con el Proyecto** | Se adapta de inmediato al `App.tsx` existente sin reestructurar el entrypoint | Requeriría migrar `index.ts` y reescribir la configuración de rutas de Expo |

> **Decisión Arquitectónica (ADR)**: Se implementará **React Navigation con Bottom Tabs nativas**. Ofrece el menor consumo de memoria RAM y CPU al aprovechar `react-native-screens` (que utiliza `Fragment` en Android y `UIViewController` en iOS), cumpliendo estrictamente con la regla de **"Cero Bloat"**.

---

## 4. Contratos de Datos, Tipos y Variables de Entorno

### 4.1. Variables de Entorno (`.env`)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://ugvoqswljfvwftoinyxt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 4.2. Contratos TypeScript de Navegación (`src/types/navigation.ts`)
```typescript
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Map: undefined;
  Inventory: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Capture: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MapScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Map'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type InventoryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;
```

### 4.3. Cliente Supabase Singleton (`src/services/supabase.ts`)
```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
```

---

## 5. Prevención de Bloqueos de Hilos (Thread Safety & Performance)

1. **Main Thread (UI Thread)**:
   - Toda la renderización de la barra de pestañas y contenedores de vistas será delegada a componentes nativos mediante `react-native-screens`.
   - Se activa `detachInactiveScreens: true` para evitar que pantallas no visibles mantengan peso en el buffer de GPU.
2. **JavaScript Thread**:
   - El cliente de Supabase no mantendrá polling de autenticación activo en segundo plano en esta etapa (`autoRefreshToken: false`).
3. **Cero Estilos Dinámicos Costosos**:
   - Uso de `StyleSheet.create` inmutable para evitar recomputaciones de CSS-in-JS en cada ciclo de render.

---

## 6. Criterios de Aceptación (Gherkin Syntax)

### Escenario 1: Inicialización Exitosa del Cliente Supabase
- **Given** que las variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` están definidas en `.env`.
- **When** se importa la instancia `supabase` desde `src/services/supabase.ts`.
- **Then** el cliente se inicializa como un objeto singleton válido sin lanzar excepciones.

### Escenario 2: Navegación Fluida entre Pestañas
- **Given** que la aplicación inicia en el dispositivo o emulador.
- **When** el usuario pulsa en la pestaña "Mochila" o "Perfil".
- **Then** la vista correspondiente se monta inmediatamente con el texto placeholder centrado y la barra de navegación destaca la pestaña activa.

### Escenario 3: Control de Fugas de Memoria en Navegación
- **Given** que el usuario cambia repetidamente de pestaña.
- **When** se desmonta o desacopla la pantalla anterior.
- **Then** `react-native-screens` suspende la renderización activa de la pantalla inactiva, conservando recursos para futuros módulos de sensores/mapa.

---

## 7. Plan de Archivos a Crear y Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Instalar** | Dependencias mínimas | `npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context` |
| **Crear** | `src/types/navigation.ts` | Definición de tipos estrictos `RootTabParamList` y props de pantalla |
| **Crear** | `src/services/supabase.ts` | Inicialización tipada y validada del cliente Supabase con polyfill |
| **Crear** | `src/screens/MapScreen.tsx` | Pantalla base placeholder de Mapa |
| **Crear** | `src/screens/InventoryScreen.tsx` | Pantalla base placeholder de Inventario/Pokédex |
| **Crear** | `src/screens/ProfileScreen.tsx` | Pantalla base placeholder de Perfil del Entrenador |
| **Crear** | `src/navigation/BottomTabNavigator.tsx` | Configuración del navegador de pestañas inferior |
| **Modificar** | `App.tsx` | Contenedor principal con `SafeAreaProvider` y `NavigationContainer` |
| **Crear** | `docs/README_MODULO_1.md` | Documentación pedagógica de sustentación con 3 preguntas clave |

---

## 8. Verificación y Sincronización
- Verificación de tipos: `npx tsc --noEmit`.
- Verificación de linter: `npx expo lint`.
- Indexación del grafo de arquitectura actualizado con `codebase-memory`.
