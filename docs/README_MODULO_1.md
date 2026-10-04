# Guía de Sustentación Técnica: Etapa 1 - Inicialización y Arquitectura Base

**Proyecto**: Pokémon GO UniSabana  
**Módulo**: Etapa 1 (Arquitectura Base, Cliente Supabase y Navegación "Cero Bloat")  
**Tecnologías**: React Native (Expo SDK 57), TypeScript, React Navigation, Supabase  

---

## 1. ¿Qué se implementó a nivel de código?

1. **Cliente Singleton de Supabase (`src/services/supabase.ts`)**:
   - Integración del polyfill `react-native-url-polyfill/auto` para garantizar compatibilidad con el motor JavaScript **Hermes**.
   - Carga y aserción en tiempo de ejecución de las variables de entorno `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - Configuración optimizada de sesión (`persistSession: false`, `autoRefreshToken: false`) para evitar sondeos en segundo plano que consuman ciclos de CPU innecesarios en etapas iniciales.
   - Re-exportación modular desde `src/services/index.ts`.

2. **Tipado Estricto de Navegación (`src/types/navigation.ts`)**:
   - Definición del contrato `MainTabParamList` con las rutas `'Map'` e `'Inventory'`.
   - Definición del contrato `RootStackParamList` con `'MainTabs'` y preparación para `'Capture'`.
   - Generación de tipos de props seguros (`MapScreenProps`, `InventoryScreenProps`, `RootStackScreenProps`).

3. **Arquitectura de Navegación Compuesta: RootStack + BottomTabs (`src/navigation/`)**:
   - **RootStack (`RootNavigator.tsx`)**: Utiliza `@react-navigation/native-stack`. Permite que vistas a pantalla completa (como el Modo Captura AR en el Módulo 4) se apilen por encima del navegador de pestañas sin dejar visibles los botones inferiores.
   - **MainTabs (`BottomTabNavigator.tsx`)**: Implementación de `@react-navigation/bottom-tabs` apalancado en `react-native-screens`. Conecta exclusivamente el Mapa y la Mochila/Pokédex.
   - Eliminación de pantallas no requeridas (`ProfileScreen`) para respetar la directiva de Cero Bloat y alineación estricta al GDD.

4. **Vistas Base Placeholder (`src/screens/`)**:
   - `MapScreen.tsx`: Punto de montaje para el mapa interactivo y Geofencing de la Universidad de La Sabana.
   - `InventoryScreen.tsx`: Punto de montaje para la Mochila y la Pokédex de los 151 Pokémon.

5. **Punto de Entrada (`App.tsx`)**:
   - Jerarquía limpia: `SafeAreaProvider` -> `StatusBar` -> `NavigationContainer` -> `RootNavigator`.

---

## 2. Decisiones Arquitectónicas y Fundamentos de Rendimiento

### A. ¿Por qué React Navigation nativo en lugar de Expo Router para este caso?
- **Principio de "Cero Bloat"**: Expo Router impone el sistema de archivos (`src/app`), un bundle virtual y librerías adicionales de resolución de deep links que agregan peso innecesario cuando la aplicación tiene un flujo lineal cerrado de tres pestañas principales.
- **Rendimiento de Memoria**: React Navigation delega la gestión de vistas a `react-native-screens`, lo que significa que en Android las pestañas son administradas como `Fragment` nativos y en iOS como `UIViewController`. Cuando el usuario pasa de la pantalla del Mapa a la Mochila, la vista nativa del mapa suspende su ciclo de dibujo (`detachInactiveScreens: true`), protegiendo la GPU y la RAM contra cierres por falta de memoria (OOM).

### B. ¿Por qué es indispensable `react-native-url-polyfill/auto` con Supabase?
- El motor de JavaScript predeterminado en React Native moderno es **Hermes**. Hermes está altamente optimizado para arranques rápidos y bajo uso de memoria, pero no incluye una implementación completa del estándar WHATWG de las clases globales `URL` y `URLSearchParams`.
- El cliente de Supabase (`@supabase/supabase-js`) depende internamente de estas APIs para construir consultas REST y conexiones Realtime. Sin este polyfill en el punto de entrada del servicio, la aplicación lanzaría errores fatales del tipo `ReferenceError: Property 'URL' doesn't exist`.

---

## 3. Preguntas de Sustentación Técnica (100% de Calificación)

A continuación tienes las 3 preguntas clave que un evaluador o profesor de desarrollo móvil avanzado te formularía, con la respuesta técnica exacta que debes dar:

### Pregunta 1:
> *"¿Por qué decidiste instanciar Supabase como un singleton en `src/services/supabase.ts` en lugar de crear la instancia directamente dentro de cada pantalla o hook mediante un `new createClient()`?"*

**Respuesta Ideal:**
> *"Implementé el patrón **Singleton** para garantizar que exista una única instancia compartida del cliente en toda la memoria del runtime de JavaScript. Crear múltiples instancias de `createClient()` generaría conexiones HTTP redundantes, duplicaría la gestión de tokens y cachés en memoria, y aumentaría el consumo de sockets de red y RAM. Además, al centralizar la inicialización en un único módulo, se aplica el principio de **Fail-Fast**: si las variables de entorno `EXPO_PUBLIC_SUPABASE_URL` o `EXPO_PUBLIC_SUPABASE_ANON_KEY` no existen, la aplicación arroja una excepción descriptiva de inmediato antes de que cualquier pantalla intente ejecutar operaciones inválidas."*

---

### Pregunta 2:
> *"En dispositivos móviles de gama media o baja, renderizar un mapa vectorial continuo puede degradar severamente los FPS. ¿Cómo protege la arquitectura de navegación actual el hilo principal (Main Thread) cuando el usuario cambia a la pestaña de Mochila o Perfil?"*

**Respuesta Ideal:**
> *"Nuestra navegación utiliza `@react-navigation/bottom-tabs` integrado con **`react-native-screens`**. A diferencia de una barra de pestañas construida manualmente con vistas ocultas (`display: 'none'`), `react-native-screens` utiliza los contenedores nativos del sistema operativo (`Fragment` en Android y `UIViewController` en iOS). Cuando el usuario navega a otra pestaña, la propiedad `detachInactiveScreens` desacopla la vista del mapa de la jerarquía de renderizado activa. Esto libera el contexto de renderizado de la GPU y evita que el Main Thread ejecute ciclos de cálculo de layout innecesarios mientras el usuario interactúa con la Pokédex."*

---

### Pregunta 3:
> *"Observo que las variables de entorno comienzan con el prefijo `EXPO_PUBLIC_`. ¿Qué implicación de seguridad y empaquetado tiene este prefijo en React Native con Expo?"*

**Respuesta Ideal:**
> *"En Expo, cualquier variable de entorno con el prefijo `EXPO_PUBLIC_` es incrustada en texto plano dentro del bundle de JavaScript durante la compilación (`build-time inlining`). Por esa razón, **únicamente** se debe exponer la `ANON_KEY` de Supabase, la cual está diseñada para ser pública y cuyo acceso a los datos está regulado estrictamente a nivel de base de datos mediante **Row Level Security (RLS)** y políticas de PostgreSQL. Las credenciales con privilegios elevados, como la `SERVICE_ROLE_KEY` o contraseñas maestras, jamás deben llevar este prefijo ni incluirse en el código del cliente móvil."*

---

## 4. Instrucciones de Prueba en Dispositivo Físico o Emulador

> [!CRITICAL]
> **Arquitectura de Ejecución sin Android Studio (EAS Cloud Build)**  
> Dado que tu entorno de desarrollo no cuenta con Android Studio ni Android SDK (`adb`), **no es posible compilar binarios localmente con `npx expo run:android`**.  
> Por otra parte, librerías como `@rnmapbox/maps`, `expo-camera`, `react-native-screens` y `react-native-safe-area-context` contienen código C++/Java que **no existe en la app genérica Expo Go**, lo que causaba el error:  
> `Can't find ViewManager 'RNCSafeAreaProvider' in ViewManagerRegistry`.  
>  
> La solución estándar de la industria bajo Expo es generar el binario del **Development Client en la nube mediante EAS (Expo Application Services)**:

### Flujo de Compilación y Prueba Paso a Paso:

#### Paso 1: Generar el instalador APK en la nube (Solo se ejecuta una vez o al agregar paquetes nativos)
Ejecuta en tu terminal el comando de EAS CLI (configurado con `buildType: "apk"` en `eas.json`):
```bash
npx eas-cli build -p android --profile development
```
- EAS compilará el APK en los servidores remotos de Expo (sin requerir Android Studio en tu PC).
- Al finalizar, la terminal te entregará un **link de descarga** y un **código QR**.
- Abre ese link o escanea el QR en tu teléfono Android para descargar e instalar el archivo `.apk` de tu Development Client (`PokemonGoExam`).

#### Paso 2: Iniciar el servidor Metro
Una vez que tengas la aplicación instalada en tu teléfono Android, inicia el servidor de desarrollo:
```bash
npx expo start --dev-client
```

#### Paso 3: Conectar la aplicación móvil
1. Asegúrate de que tu PC y tu teléfono Android estén en la misma red WiFi (o conectados por túnel con `npx expo start --dev-client --tunnel`).
2. Abre la app **PokemonGoExam** recién instalada en tu teléfono y escanea el código QR de la terminal, o pulsa sobre la URL de desarrollo que detecte automáticamente.
3. El bundle se cargará en segundos y la navegación por pestañas funcionará de inmediato con soporte total para todas las APIs nativas.

### Pasos de Validación en Pantalla
1. **Pestaña Mapa (🗺️)**: Muestra el contenedor con el tema oscuro `#0F172A` y la tarjeta de bienvenida de la Universidad de La Sabana.
2. **Pestaña Mochila (🎒)**: Transiciona de inmediato mostrando la vista de inventario y Pokédex.
3. **Barra de Navegación**: Observa que la barra inferior respeta los bordes seguros del dispositivo sin traslaparse con la barra de gestos del sistema.
4. **Verificación de Tipos**: Ejecuta `npx tsc --noEmit` en cualquier momento para confirmar que no existen discrepancias en contratos de TypeScript.

---

## 5. Guía Paso a Paso para Probar y Sustentar en Vivo (Evaluación Oral)

Para obtener el 100% de la calificación en la sustentación de este módulo, sigue este procedimiento ante el evaluador:

1. **Demostración de Navegación y Cero Bloat:**
   - Abre la app en el dispositivo físico conectado a Metro (`npx expo start --dev-client`).
   - Muestra la barra inferior con únicamente dos pestañas: **Mapa** y **Mochila**.
   - **Explicación al evaluador:** *«La arquitectura implementa un RootStack nativo sobre un BottomTabNavigator estricto. Se eliminaron pantallas de perfil o configuraciones innecesarias respetando la directiva de Cero Bloat y optimizando el ciclo de vida de componentes».*

2. **Demostración de Desacoplamiento de Pantallas en Memoria (`react-native-screens`):**
   - Cambia alternadamente entre la pestaña **Mapa** y la pestaña **Mochila**.
   - **Explicación al evaluador:** *«Las pestañas no son vistas ocultas por CSS; están respaldadas por Fragments nativos en Android y UIViewControllers en iOS. Gracias a `detachInactiveScreens`, la vista inactiva se suspende del pipeline de dibujo de la GPU, previniendo fugas de memoria o cierres por OOM».*

3. **Demostración del Cliente Singleton Supabase:**
   - Abre el archivo `src/services/supabase.ts` en el editor.
   - Señala la importación de `react-native-url-polyfill/auto` y la aserción de `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - **Explicación al evaluador:** *«Hermes no implementa la especificación WHATWG de URLs de forma nativa. El polyfill garantiza que las consultas REST y canales Realtime de Supabase no colapsen en runtime, mientras que el patrón Singleton asegura una sola instancia de red compartida para toda la aplicación».*

4. **Verificación Estática de Tipado:**
   - En la terminal del proyecto, ejecuta:
     ```bash
     npx tsc --noEmit
     ```
   - Demuestra que el compilador finaliza con **0 errores**, validando los contratos de TypeScript de rutas y parámetros.

