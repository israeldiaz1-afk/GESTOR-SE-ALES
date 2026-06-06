# 🛣️ RoadSign Evaluator - FASE 1: PWA Base + Captura de Modos

## ✅ Estado: FASE 1 Completada

Se han creado todos los archivos base para la primera fase de desarrollo.

## 📂 Estructura de Archivos

```
roadsign-evaluator/
├── index.html                 # Página principal (todas las pantallas)
├── manifest.json             # Configuración PWA para instalación
├── sw.js                     # Service Worker (caché y offline)
│
├── css/
│   ├── styles.css           # Estilos principales (layout, responsive)
│   ├── dark-mode.css        # Tema oscuro/claro
│   └── components.css       # Componentes específicos
│
├── js/
│   ├── db.js               # Gestor de IndexedDB (7 stores)
│   ├── modes.js            # Detección auto de modo + selector manual
│   ├── camera.js           # Acceso a cámara, captura foto/video
│   └── app.js              # Lógica principal de la aplicación
│
└── README.md               # Este archivo
```

## 🚀 Cómo Usar

### 1. Clonar/Descargar los archivos
```bash
# Copiar todos los archivos a una carpeta
roadsign-evaluator/
```

### 2. Servir la aplicación (necesario para PWA)

**Opción A: Con Python 3**
```bash
cd roadsign-evaluator
python3 -m http.server 8000
```
Luego abre: `http://localhost:8000`

**Opción B: Con Node.js (http-server)**
```bash
npm install -g http-server
cd roadsign-evaluator
http-server
```

**Opción C: Con Live Server (VS Code)**
- Instala la extensión "Live Server"
- Click derecho en index.html → "Open with Live Server"

### 3. Acceder desde Android
- Accede desde tu navegador Android a: `http://<IP-DE-TU-PC>:8000`
- O abre en una carpeta con HTTPS (para PWA instalable)

### 4. Instalar como PWA
- En Chrome: Menú → "Instalar RoadSign Evaluator"
- En Edge: Menú → "Instalar esta aplicación"
- En otros navegadores: Busca la opción de "Agregar a pantalla de inicio"

## 🎮 Funcionalidades Implementadas en FASE 1

✅ **Estructura PWA completa**
- Manifest.json configurado
- Service Worker para offline
- Instalable en Android

✅ **Selector de Modo (3 opciones)**
- Conducción en coche
- Foto/Barrido estático
- Auto-detección por GPS

✅ **Auto-detección de Modo**
- Monitorea GPS continuamente
- Cambia automáticamente entre conducción/estático
- Calcula velocidad basada en posición

✅ **Acceso a Cámara**
- Video en tiempo real
- Captura de fotos
- FPS counter
- Permisos manejados

✅ **Base de Datos (IndexedDB)**
- 7 Object Stores inicializados
- Evaluaciones
- Sesiones
- Zonas y Calles
- Pesos de Aprendizaje
- Parámetros
- Reportes

✅ **Interfaz Responsive**
- Diseño mobile-first
- Optimizado para 6"
- Tema oscuro/claro automático
- Bottom navigation (Android standard)

✅ **Navegación**
- Pantalla selector de modo
- Pantalla de captura en vivo
- Modal de evaluación
- Pantalla de inicio
- Navigation bar inferior

## 📱 Pantallas Implementadas

1. **Selector de Modo** - Elegir o auto-detectar modo
2. **Captura en Vivo** - Video en tiempo real con detección
3. **Evaluación Detallada** - Modal con formulario (Módulo BASE)
4. **Home** - Resumen de última sesión + alertas de cobertura
5. **Dashboard** - (Placeholder para FASE 7)
6. **Configuración** - (Placeholder para FASE 9)

## 🔧 Características Técnicas

### JavaScript Modules
- **db.js**: RoadsignDB class con métodos para CRUD
- **modes.js**: ModesManager para detección automática
- **camera.js**: CameraManager con captura de frames
- **app.js**: RoadSignApp orquestación principal

### CSS Arquitectura
- Variables CSS para temas
- Mobile-first design
- Responsive a partir de 320px
- Soporte para safe-area-inset (notch)

### PWA Features
- Service Worker con caché de red
- Instalable en Android
- Funciona offline (assets cacheados)
- Notificaciones push (preparado para Fase posterior)

## 🎯 Próximos Pasos (FASE 2-3)

### FASE 2: Recolección de Datos + Sistema de Parámetros
- [ ] Identificar datasets públicos de señales viales
- [ ] Crear interfaz de carga de imágenes
- [ ] Estructura de parámetros módulos

### FASE 3: Entrenamiento del Modelo IA
- [ ] Entrenar en Google Colab
- [ ] Integrar TensorFlow.js
- [ ] Detección en tiempo real

### FASE 4: Sistema de Aprendizaje
- [ ] Captura de feedback
- [ ] Ajuste de pesos
- [ ] Mejora automática de precisión

## 🐛 Problemas Conocidos

1. **Pantallas adicionales no implementadas**: Dashboard, Configuración
2. **Modal de evaluación**: Formulario base solo, módulos dinámicos en FASE 5
3. **Almacenamiento de fotos**: Se guarda el path, no la imagen (optimizar en FASE 2)
4. **Geolocalización**: Requiere HTTPS en producción

## 💡 Tips de Desarrollo

### Para depuración en Chrome:
```javascript
// En consola
roadsignDB.getStats()  // Ver estadísticas de DB
modesManager.getCurrentMode()  // Ver modo actual
cameraManager.getFPS()  // Ver FPS actual
```

### Ver logs:
- Abre DevTools (F12)
- Ve a Console
- Busca `[App]`, `[Modes]`, `[Camera]`, `[DB]`

### Reset completo:
```javascript
// En consola
roadsignDB.clearAll()  // Borra todas las evaluaciones
```

## 📚 Referencias Técnicas

- **PWA Manifest**: https://developer.mozilla.org/en-US/docs/Web/Manifest
- **Service Workers**: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **IndexedDB**: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **getUserMedia**: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- **Geolocation**: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation

## 📝 Notas

- La aplicación funciona en modo offline para assets cacheados
- Las evaluaciones se guardan en IndexedDB (local)
- Los temas oscuro/claro se activan automáticamente según preferencias del sistema
- Android es la plataforma objetivo (puede funcionar en iOS pero sin optimizaciones específicas)

## ✨ Arquitectura General

```
┌─────────────────────────────────────┐
│     index.html (Single Page App)    │
│  - Todas las pantallas (hidden)      │
│  - Componentes reutilizables         │
└────────────┬────────────────────────┘
             │
     ┌───────┴────────┐
     │                │
┌────▼──────┐   ┌────▼─────────┐
│   CSS     │   │   JavaScript  │
├────────────┤   ├───────────────┤
│ styles    │   │ db.js         │
│ dark-mode │   │ modes.js      │
│components │   │ camera.js     │
└────────────┘   │ app.js        │
                 └───────────────┘
                        │
             ┌──────────┼──────────┐
             │          │          │
        ┌────▼──┐  ┌────▼──┐  ┌───▼────┐
        │IndexedDB│ │Camera │ │GPS/Geo │
        └─────────┘  └───────┘  └────────┘
```

## 📞 Soporte

Para reportar bugs o sugerencias, actualiza este README con la información relevante.

---

**Versión:** 1.0 - FASE 1 Completada  
**Fecha:** 15 Enero 2024  
**Estado:** ✅ Listo para Pruebas
