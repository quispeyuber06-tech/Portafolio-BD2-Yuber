# Portafolio de Yuber · versión 16

## Subir esta versión a tu GitHub

1. Descomprime el ZIP.
2. En tu repositorio, reemplaza `index.html` con el de esta entrega, en la raíz. Ya tiene el nombre correcto. Puedes reemplazar también las carpetas y archivos fuente incluidos.
3. Confirma los cambios y espera que termine el despliegue de GitHub Pages.
4. Abre tu enlace habitual y actualiza con Ctrl + F5.

El HTML incluye estilos, JavaScript, imágenes y tipografías. No necesita una compilación en GitHub Pages. El código de `src/` se incluye para poder modificar y reconstruir la aplicación. Cambiar únicamente `src/` no actualiza el HTML ya compilado: ejecuta `npm run build` y sube también el `index.html` resultante.

Esta entrega no publica cambios en tu repositorio por sí sola.

## Administrador dentro del mismo portafolio

En la cabecera aparece **Administrador**, junto al acceso a la cuenta. También puedes elegir Administrador en el formulario inicial.

- Usuario: `ADMIN`, o `quispeyuber06+admin@gmail.com`.
- Contraseña: la de esa cuenta existente en Supabase.

`ADMIN` es un alias del correo. La contraseña se comprueba con Supabase Auth; no está incluida en el HTML y no se ha cambiado a `ADMIN`. Solo una cuenta con rol `admin` en tu base obtiene acceso a las evaluaciones.

El panel tiene una interfaz propia con entregas de Yuber, filtros, pendientes, promedio, apertura de archivos e historial. Abre una entrega, pulsa **Evaluar**, escribe una nota entera entre 0 y 20 y un comentario, y pulsa **Guardar evaluación**. Espera la confirmación. Si el estudiante cambió el trabajo mientras lo revisabas, se solicita actualizar antes de calificarlo.

**Volver al portafolio** cambia la vista conservando la sesión administradora. **Cerrar sesión** termina esa sesión y vuelve al inicio; para actuar como estudiante, inicia sesión con su cuenta. Por diseño, recargar el documento pide iniciar sesión otra vez.

## Entregas y notificaciones del estudiante

1. Inicia sesión con `quispeyuber06@gmail.com` y su contraseña existente.
2. En **Trabajos**, elige unidad, semana y día, y pulsa **Subir**.
3. Selecciona un archivo de hasta 20 MB y completa sus datos.
4. Pulsa **Guardar trabajos** y espera la confirmación. Elegir el archivo por sí solo no lo guarda.
5. Tras la evaluación, abre la campana: muestra nota, comentario y contador de revisiones sin leer.

La aplicación consulta novedades cada 15 segundos mientras la ventana está activa y al volver a ella. También puedes actualizar manualmente. Una edición del trabajo vuelve a dejarlo pendiente de revisión. Las notificaciones son internas del portafolio, no correos ni avisos del sistema operativo.

## Misma base de datos

Se conserva el proyecto `axhngpimswxslllnajog` de Supabase, sus cuentas, el portafolio asignado y el contrato existente: `bd2_session`, `bd2_list`, `bd2_save` y bucket privado `bd2-works`.

**No vuelvas a ejecutar `base-de-datos.sql` en tu proyecto actual.** Se incluye como referencia del esquema existente. Esta actualización no necesita nuevas tablas, cambios de contraseña ni una nueva base de datos.

Los trabajos y evaluaciones se guardan en Supabase, no en GitHub. Necesitas internet y una cuenta autorizada. La configuración pública incluida permite conectarse, pero no sustituye el inicio de sesión ni los permisos de la base.

| Contenido | Ubicación |
| --- | --- |
| Entregas, versiones, notas y comentarios | Supabase existente |
| Foto, ilustraciones, diseño y código | Dentro de index.html |
| Tema y pausa de movimiento | Navegador actual |
| Presentación personal editada | Navegador; se incorpora al descargar HTML actualizado |
| Copia sin conexión | Archivo exportado; no sincroniza cambios automáticamente |

## Mejoras visuales

- Acceso a administrador siempre visible en la cabecera, con panel adaptado a celular.
- Foto original con mejor encuadre y presentación.
- Gojo y Yuji en una escena animada de combate ilustrado; robots en el tema Videojuego. Son personajes SVG articulados con desplazamientos, golpes y efectos, no videos del anime ni un videojuego completo.
- Personajes pequeños que recorren la pantalla y controles para ocultarlos o repetir la escena.
- Pausa de movimiento y respeto a la preferencia de movimiento reducido del dispositivo.
- Campana disponible también en celular; títulos y contenido en flujo normal para evitar superposiciones.
- Se mantiene el asistente local y sus funciones de ayuda. No incorpora un servicio de IA externo.

## Código y reconstrucción

Con Node.js 20 o superior:

```sh
npm ci
npm run build
```

| Archivo | Función |
| --- | --- |
| src/app.js | Navegación, formularios, trabajos y notificaciones |
| src/admin.js | Interfaz de revisión del administrador |
| src/cloud-api.js | Autenticación y acceso al esquema existente |
| src/local-api.js | Copias locales y compatibilidad anterior |
| src/characters.js | Personajes y escena animada |
| src/style.css | Estilos base |
| src/admin.css | Panel administrador y ajustes de celular |
| src/characters.css | Animaciones y presentación visual |
| build.mjs | Compila todos los recursos dentro de index.html |

## Qué se probó

Se ejecutaron 14 comprobaciones funcionales en Chromium con Supabase **simulado**, incluyendo dos sesiones independientes: entrega con guardado explícito, rechazo de permisos incorrectos, apertura del archivo, nota/comentario, notificación, lectura, conflicto de versiones, cierre de sesión y errores de red. También se comprobó que comentarios con HTML se muestran como texto.

Las pruebas visuales recorren seis secciones a 320, 390, 768 y 1440 píxeles, verifican la campana, el cambio de tema y que pausar animaciones no oculte páginas o formularios.

Resultados: `tests/resultado.json` y `tests/visual-resultado.json`. El sondeo de conexión real está en `tests/conexion-real.json`: el RPC protegido rechazó el acceso anónimo; una consulta de configuración agotó el tiempo. **No se realizó una subida ni una evaluación con tus cuentas reales**, porque no se dispone de sus contraseñas.

Para repetir las pruebas en Linux:

```sh
npm ci
npm run build
npm run test:prepare
npm test
```

Verificación final con tus cuentas: guarda un archivo de prueba como estudiante, ábrelo desde otra sesión como administrador, asigna una nota y comentario, cierra sesión y comprueba la notificación como estudiante. Así confirmas el recorrido completo en tu base real.
