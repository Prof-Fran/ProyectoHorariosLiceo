BASE_DE_DATOS.md
Modelo de Base de Datos
Objetivo
La base de datos almacenará toda la información necesaria para el armado de horarios docentes.
Debe diseñarse siguiendo principios de normalización (hasta 3FN), evitando redundancias y permitiendo futuras ampliaciones.
Se utilizará PostgreSQL.

Convenciones
Claves primarias
Todas las tablas utilizarán una clave primaria llamada:
id
Tipo:
SERIAL o GENERATED ALWAYS AS IDENTITY

Claves foráneas
Todas deberán nombrarse utilizando el patrón:
id_tabla
Ejemplo:
id_nivel
id_docente
id_turno

Restricciones
Siempre que sea posible utilizar:
NOT NULL
UNIQUE
CHECK
FOREIGN KEY
No depender únicamente de validaciones en JavaScript.

Modelo de entidades
El sistema estará compuesto por las siguientes entidades.
Nivel
Turno
HorarioTurno
Grupo
Asignatura
Docente
DocenteAsignatura
GrupoAsignatura
Asignacion_Docente
DisponibilidadDocente
HorarioGrupo

Tabla: niveles
Representa los niveles educativos.
Campos
id
nombre
Ejemplos:
7°
8°
9°
1° EMS
2° EMS
3° EMS
Restricciones
nombre UNIQUE

Tabla: turnos
Representa los turnos de funcionamiento.
Campos
id
nombre
Ejemplos
Matutino
Vespertino
Nocturno
Restricciones
nombre UNIQUE

Tabla: horarios_turno
Almacena las horas correspondientes a cada turno.
Campos
id
id_turno
numero_hora
hora_inicio
hora_fin
Restricciones
numero_hora > 0
UNIQUE
(id_turno, numero_hora)

Tabla: grupos
Representa cada grupo existente.
Campos
id
id_nivel
id_turno
numero
Ejemplos
Nivel
7°
Número
1
Resultado
7°1
Restricciones
UNIQUE
(id_nivel, id_turno, numero)

Tabla: asignaturas
Representa las asignaturas existentes para cada nivel.
Campos
id
id_nivel
nombre
carga_horaria
Observaciones
La carga horaria depende del nivel.
Por eso una misma asignatura en distintos niveles será un registro diferente.
Ejemplo
7° Informática
3 horas
8° Informática
2 horas
Restricciones
carga_horaria > 0
UNIQUE
(id_nivel, nombre)

Tabla: docentes
Información personal del docente.
Campos
id
nombre
apellido
cedula
Restricciones
cedula UNIQUE

Tabla: docente_asignatura
Relaciona docentes con las asignaturas que pueden dictar.
Un docente puede impartir varias asignaturas.
Cada asignatura puede tener varios docentes.
Campos
id
id_docente
id_asignatura
grado (del 1 al 7)
puntaje (por ejemplo 114.20)
Restricciones
grado BETWEEN 1 AND 7
puntaje >= 0
UNIQUE
(id_docente, id_asignatura)

Tabla: grupo_asignatura
Indica qué asignaturas posee cada grupo.
Campos
id
id_grupo
id_asignatura
Restricciones
UNIQUE
(id_grupo, id_asignatura)

Tabla: asognacion_docente
Asigna el docente que dictará una asignatura dentro de un grupo.
Campos
id
id_grupo
id_asignatura
id_docente_asignatura
Observaciones
Cada grupo tendrá un único docente por asignatura.
No existen dos docentes para la misma asignatura dentro del mismo grupo.
Restricciones
UNIQUE
(id_grupo, id_asignatura)

Tabla: disponibilidad_docente
Representa los horarios ocupados del docente por otras instituciones.
Campos
id
id_docente
dia_semana
numero_hora
ocupado
Valores
ocupado
TRUE
FALSE
Restricciones
UNIQUE
(id_docente, dia_semana, numero_hora)
CHECK
dia_semana BETWEEN 1 AND 5

Tabla: horario_grupo
Es la tabla principal del sistema.
Aquí se almacenará el horario definitivo de cada grupo.
Campos
id
id_grupo
dia_semana
numero_hora
id_grupo_docente
orden_dupla
Explicación
Cada registro representa una asignatura ubicada en una celda del horario.
Si existe una dupla, habrá dos registros para la misma hora.
El campo orden_dupla permitirá distinguir:
1
Primer docente
2
Segundo docente
Restricciones
CHECK
orden_dupla IN (1,2)
CHECK
dia_semana BETWEEN 1 AND 5
UNIQUE
(id_grupo, dia_semana, numero_hora, orden_dupla)

Relaciones
Nivel
↓
Asignaturas
↓
GrupoAsignatura
↓
GrupoDocente
↓
HorarioGrupo

Nivel
↓
Grupos
↓
HorarioGrupo

Turno
↓
HorariosTurno
↓
Grupos

Docente
↓
DocenteAsignatura
↓
GrupoDocente
↓
HorarioGrupo

Docente
↓
DisponibilidadDocente

Reglas de negocio
Regla 1
Una asignatura pertenece únicamente a un nivel.

Regla 2
Un grupo pertenece a un único nivel.

Regla 3
Un grupo pertenece a un único turno.

Regla 4
Un docente puede impartir múltiples asignaturas.

Regla 5
Cada asignatura del grupo tendrá un único docente.

Regla 6
La carga horaria de una asignatura nunca podrá superarse.
Esta validación será realizada por la aplicación.

Regla 7
Un docente no podrá asignarse en un horario donde ya se encuentre ocupado por otra institución.
La aplicación deberá consultar:
disponibilidad_docente

Regla 8
Un docente no podrá asignarse simultáneamente a dos grupos distintos.
La aplicación deberá verificar la tabla:
horario_grupo
antes de insertar un nuevo registro.

Regla 9
Cada grupo podrá tener como máximo dos asignaturas en un mismo bloque horario (dupla).
Nunca podrá existir un tercer registro para la misma combinación:
grupo + día + hora.

Regla 10
Los docentes deberán visualizarse ordenados automáticamente utilizando:
Grado (descendente)
Puntaje (descendente)
Este orden se calculará mediante una consulta SQL sobre la tabla docente_asignatura, sin almacenar un orden fijo.

Regla 11
Al eliminar una asignación del horario, la disponibilidad del docente y el contador de horas restantes deberán actualizarse automáticamente desde la lógica de la aplicación.
No se utilizarán triggers para esta funcionalidad.

Índices recomendados
Crear índices sobre:
id_nivel
id_turno
id_grupo
id_docente
id_asignatura
dia_semana
numero_hora
Especialmente en:
horario_grupo
disponibilidad_docente
grupo_docente
docente_asignatura
para acelerar las validaciones durante el armado del horario.

Consideraciones finales
La base de datos debe mantenerse lo más simple posible.
Toda la lógica relacionada con:
conflictos horarios;
cálculo de horas restantes;
ordenamiento visual;
validaciones de interfaz;
actualización de grillas;
exportación a Excel;
debe implementarse en JavaScript.
PostgreSQL será responsable únicamente de garantizar la integridad de los datos mediante claves, restricciones e índices, mientras que la aplicación gestionará el comportamiento del sistema y la experiencia de usuario.

