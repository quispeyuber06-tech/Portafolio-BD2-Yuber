# Portafolio de Yuber · Base de Datos II

## Abrir y usar

1. Descarga **Portafolio-BD2-Profesional.html** y ábrelo en un navegador (Chrome, Edge, Firefox o Safari actualizado).
2. Inicia sesión con el correo y la contraseña que creaste para este portafolio en Supabase. La cuenta estudiante y la cuenta administradora siguen siendo las existentes.
3. Abre **Trabajos**, selecciona la unidad, semana y día, y pulsa **Subir**.
4. Elige un archivo de hasta 20 MB, revisa el título y pulsa **Guardar trabajos**. Espera la confirmación.
5. En otro dispositivo, abre el mismo HTML con internet, inicia sesión con la misma cuenta y pulsa **Actualizar**.

La conexión pública de tu proyecto ya viene configurada. No necesitas volver a crear las tablas ni ejecutar el SQL en tu proyecto actual. El HTML no incluye tu contraseña ni una sesión iniciada.

Si el teléfono abre una vista previa de WhatsApp o del gestor de archivos, descarga el HTML y ábrelo en un navegador que ejecute JavaScript. Una vista previa de un archivo no siempre ejecuta una aplicación HTML. También puedes usar tu propia dirección de GitHub Pages.

## Qué cambió

- Una sola cabecera y navegación para Inicio, Sobre mí, Universidad, Trabajos, Progreso y Recursos; cuenta y notificaciones accesibles desde ella.
- Tu nueva foto integrada, entrada animada, marcos y composición diferentes según el tema.
- Dos temas: Jujutsu Kaisen y Videojuego, con ilustraciones integradas, fondos animados, tarjetas y colores propios.
- Perfil con presentación, motivación, forma de aprender, objetivo y herramientas en aprendizaje. Puedes personalizar estos textos.
- Trabajos como página completa: búsqueda, filtros, unidades, semanas, portadas, destacados y modo presentación.
- **Guardar trabajos** explícito; consulta posterior a la escritura; reintentos de una misma entrega con el mismo identificador para evitar duplicados.
- **Editar** título, descripción y archivo. Historial, restauración y eliminación con confirmación. Una edición vuelve a dejar la entrega pendiente de evaluación.
- Administrador con revisión, notas de 0 a 20 y observaciones; estudiante con notificaciones y progreso calculado con las evidencias.
- Asistente local mediante el personaje, sin el letrero inferior. Incluye navegación, respuestas de ayuda, progreso, notas y voz opcional del navegador.

Las animaciones de las ilustraciones son efectos de la página sobre imágenes integradas; no son clips de video. La voz opcional usa síntesis en español del navegador, no una grabación del actor de Luffy. Puedes pausar animaciones en el pie de página; también se respeta la preferencia de movimiento reducido del dispositivo.

## Dónde se guarda cada cosa

| Contenido | Guardado |
| --- | --- |
| Trabajos, versiones, portadas, destacados, notas y comentarios | Proyecto existente de Supabase; requiere tu cuenta e internet |
| Foto y diseño | Incluidos en el HTML |
| Presentación personal editada | En este navegador; se incorpora al descargar el HTML actualizado |
| Preferencia de tema y pausa de animaciones | En este navegador |
| Copia sin conexión | Archivo HTML que contiene las evidencias al momento de descargarla |

**HTML conectado:** consulta el contenido actual de tu cuenta. **Copia sin conexión:** conserva un momento del portafolio; sus cambios no se suben automáticamente. Conserva tus copias y los archivos originales.

En **Mi cuenta → Importar trabajos** puedes seleccionar un HTML anterior que contenga archivos. Si la copia anterior no incluía los bytes de tus trabajos, vuelve al dispositivo donde los guardaste y exporta una copia con archivos. La importación conserva el original y omite los trabajos ya importados. Las notas locales requieren evaluación del administrador.

## Tu GitHub

Descarga el HTML conectado, cambia su nombre a **index.html** y reemplaza el archivo del repositorio que tú utilizas para GitHub Pages. Los archivos académicos siguen almacenados en Supabase, aunque cambies el diseño del HTML. No se ha publicado ni modificado tu repositorio en esta revisión.

Referencia oficial: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [acceso con contraseña en Supabase](https://supabase.com/docs/guides/auth/passwords), [acceso a Storage](https://supabase.com/docs/guides/storage/security/access-control).

## Código fuente

Este paquete contiene el HTML y sus fuentes para futuras mejoras. Para abrir el portafolio solo necesitas el HTML.

Para reconstruirlo con Node.js 20 o superior:

```sh
npm ci
npm run build
```

`src/app.js` contiene la interfaz. `src/style.css`, los dos temas. `src/cloud-api.js` conserva el contrato con el esquema 1 (`bd2_session`, `bd2_list`, `bd2_save` y el almacenamiento privado `bd2-works`). `src/local-api.js` permite leer copias offline y recuperar el almacenamiento de la versión anterior. `base-de-datos.sql` se incluye como referencia del esquema existente; no es una instrucción para volver a ejecutarlo.

Las imágenes, las fuentes, el código y la configuración pública se integran en el HTML al compilar. No hay dependencias externas de imágenes, fuentes ni bibliotecas para mostrar el diseño. La conexión con Supabase sí requiere internet.

## Verificación

Las pruebas de navegador están en `tests/`. Usan Chromium y un servicio Supabase simulado; comprueban el comportamiento de dos dispositivos independientes sin modificar los datos reales. El servicio real se consulta solo para comprobar la configuración pública y el acceso protegido al procedimiento de sesión. No se dispone de tus contraseñas para realizar una subida real en tu cuenta.

En Linux, con Python 3 disponible:

```sh
npm run test:prepare
npm test
```

Los resultados de esta entrega se adjuntan como JSON en `tests/`. Las pruebas de escritura en el servicio real quedan reservadas al inicio de sesión del propietario.

Las ilustraciones de los temas se generaron para esta revisión. El tema Videojuego usa consolas y personajes originales; la ilustración de Jujutsu Kaisen es arte de aficionado. El logo UPLA y el personaje del asistente se conservaron de la versión anterior. La foto del perfil es la que proporcionaste.
