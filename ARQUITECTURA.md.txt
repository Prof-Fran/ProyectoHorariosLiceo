ARQUITECTURA.md
Arquitectura del proyecto
Objetivo
La aplicación será un sistema web que funcionará completamente en local para asistir el armado manual de horarios de una institución educativa.
Utilizará autenticación: El usuario debe ser: Admin y la constrseña: 905011_Yo, no múltiples usuarios ni sincronización.
Todo el proyecto estará orientado a la simplicidad, mantenibilidad y velocidad de uso.

Stack tecnológico
Frontend
HTML5
CSS3
JavaScript ES6+
No utilizar frameworks pesados.
Se podrán utilizar pequeñas librerías únicamente cuando aporten una mejora importante a la experiencia de usuario.
Ejemplos:
SheetJS (exportación a Excel)
Font Awesome (iconografía)

Backend
No existirá un backend tradicional.
Toda la aplicación deberá poder ejecutarse localmente.
En futuras versiones podrá incorporarse un backend, pero la arquitectura deberá facilitar esa migración.

Base de datos
PostgreSQL
Toda la lógica de negocio deberá mantenerse en JavaScript.
La base de datos será únicamente responsable del almacenamiento de información.

Principios de desarrollo
Simplicidad
Siempre preferir soluciones simples.
No agregar funcionalidades que no hayan sido solicitadas.

Modularidad
Cada módulo deberá ser independiente.
Ejemplo:
Gestión de docentes
Gestión de grupos
Gestión de asignaturas
Armado de horarios
Cada uno deberá tener su propio código.

Escalabilidad
Aunque el sistema sea local, el código debe permitir futuras ampliaciones.
Ejemplo:
Agregar exportación PDF.
Agregar impresión.
Agregar nuevos niveles.
Agregar nuevas instituciones.
Sin necesidad de reescribir la aplicación.

Legibilidad
Todo el código deberá estar correctamente comentado.
Los nombres de variables deberán estar escritos en español.
Ejemplo:
docenteSeleccionado

grupoActual

horasRestantes

horarioDocente
Evitar abreviaturas innecesarias.

Estructura recomendada
proyecto/

│

├── index.html

│

├── css/

│   ├── estilos.css

│   ├── dashboard.css

│   ├── formularios.css

│   └── horario.css

│

├── js/

│   ├── app.js

│   ├── database.js

│   ├── ui.js

│   ├── validaciones.js

│   ├── exportar.js

│   └── utilidades.js

│

├── modulos/

│   ├── docentes.js

│   ├── grupos.js

│   ├── niveles.js

│   ├── asignaturas.js

│   ├── horarios.js

│   ├── disponibilidad.js

│   └── armado.js

│

├── sql/

│   ├── esquema.sql

│   ├── datos_iniciales.sql

│   └── vistas.sql

│

└── docs/

    ├── CONTEXTO.md

    ├── ARQUITECTURA.md

    └── BASE_DE_DATOS.md

Arquitectura lógica
La aplicación estará dividida en tres capas.
Capa de datos
Responsable únicamente del acceso a PostgreSQL.
Debe contener:
consultas
inserciones
actualizaciones
eliminaciones
No debe contener lógica de negocio.

Capa de negocio
Aquí vivirán todas las validaciones.
Ejemplos:
verificar conflictos
calcular horas restantes
ordenar docentes
impedir superposición de horarios
Toda la inteligencia del sistema estará aquí.

Capa de presentación
Toda la interfaz gráfica.
Debe actualizarse dinámicamente sin recargar la página.

Flujo de navegación
Dashboard
Desde aquí se accederá a todos los módulos.
Opciones:
Niveles
Turnos
Horarios
Asignaturas
Docentes
Grupos
Disponibilidad
Armado de horarios
Exportación

Pantalla de armado
La pantalla principal deberá dividirse en tres paneles.
Panel izquierdo
Grilla semanal del grupo.

Panel derecho
Listado de docentes ordenados por:
grado
puntaje
Cada docente mostrará:
asignatura
horas asignadas
horas restantes

Panel superior
Información del grupo.
Ejemplo:
Grupo
Nivel
Turno

Reglas generales
Toda modificación realizada sobre la grilla deberá actualizar automáticamente:
disponibilidad del docente
horario del grupo
contador de horas
validaciones
No deberán existir botones de guardar para cada cambio.
La interfaz debe responder inmediatamente.

Estados visuales
Utilizar colores consistentes.
Verde
Disponible.
Rojo
Ocupado por otra institución.
Azul
Ocupado dentro del liceo.
Gris
Celda vacía.
Amarillo
Advertencia.

Validaciones
Nunca permitir:
superar carga horaria
superponer docentes, solo en caso de duplas(dos profesores trabajando en simultaneo). No debe permitir mas de dos duplas por grupo.
más de dos asignaturas por bloque
asignar docentes ocupados
Las validaciones deberán mostrarse mediante mensajes claros y no mediante errores técnicos.

Rendimiento
Toda la aplicación deberá sentirse instantánea.
No realizar consultas innecesarias.
Mantener en memoria la información utilizada durante el armado de horarios.

Estilo visual
Inspiración:
Notion
Linear
Stripe Dashboard
Características:
tema oscuro
glassmorphism ligero
sombras suaves
tarjetas
iconografía consistente
espaciados amplios
diseño minimalista
La aplicación será utilizada durante reuniones largas proyectadas en una pantalla, por lo que la legibilidad debe ser una prioridad.

