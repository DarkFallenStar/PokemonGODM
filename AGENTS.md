This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Spec-Driven Development (SDD) & Codebase Memory

Este proyecto opera bajo el marco de ingeniería **Spec-Driven Development (SDD)** asistido por **Codebase Memory MCP**:

1. **Topología Primero**: Antes de diseñar o codificar, inspeccionar las relaciones y símbolos con `codebase-memory`:
   - Consultar arquitectura y dependencias con `get_architecture`.
   - Localizar símbolos con `search_graph` y cadenas de llamada con `trace_path`.
2. **Especificación Previa (`.specs/*.spec.md`)**:
   - Cada feature o cambio no trivial debe contar con su especificación detallando contratos de TypeScript, componentes afectados y escenarios Given-When-Then.
3. **Implementación Estricta**:
   - Codificar únicamente lo establecido en el spec, respetando las versiones del Expo SDK actual.
4. **Verificación y Sincronización**:
   - Validar con `npx tsc --noEmit` y linters.
   - Sincronizar el grafo con `detect_changes` o re-indexar si hay cambios estructurales.
5. **Documentación Obligatoria por Módulo (`docs/README_MODULO_X.md`)**:
   - Cada etapa concluida DEBE generar obligatoriamente su archivo `docs/README_MODULO_X.md`.
   - **Estructura Requerida sin Excepción**:
     1. Fundamento técnico y matemático de los algoritmos implementados.
     2. **Guía Paso a Paso para Probar y Sustentar en Vivo**: Procedimiento explícito de cómo el estudiante o evaluador debe operar la app (o scripts) para validar el 100% de los criterios de la rúbrica.
     3. Instrucciones de ejecución y advertencia expresa de recompilación nativa (`npx eas-cli build -p android --profile development`) si se incorporaron módulos nativos.
     4. Mínimo 3 preguntas técnicas de sustentación con sus respuestas modelo (100% de la nota).
6. **Memoria de Arquitectura (ADR en Codebase-Memory)**:
   - Registrar las decisiones estructurales y reglas de verificación directamente en el grafo mediante `manage_adr`.

