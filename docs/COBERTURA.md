# Cobertura de pruebas del backend

Para ejecutar las pruebas y consultar el informe:

```powershell
npm.cmd run test:coverage
```

El comando usa `node --test --experimental-test-coverage`, sin instalar otra herramienta. En Node.js 20 la medición de cobertura es experimental. El informe aparece en la terminal al terminar.

## Qué comprueban las pruebas añadidas

| Archivo | Comportamientos |
| --- | --- |
| `test/users-success.test.js` | Creación con hash verificable, normalización de nombre/correo, rol por defecto, consultas y filtros, perfil público, modificación de datos sin cambiar contraseña, cambio de contraseña con incremento solicitado de versión de tokens y registros inexistentes. |
| `test/history-queries.test.js` | Consulta general y filtrada de auditoría e inventario, paginación, respuestas vacías y rechazo de filtros inválidos antes de consultar. |
| `test/postgres-conflicts.test.js` | Traducción de errores de integridad, stock, estado y concurrencia; protección del último administrador; respuestas sin detalles privados del driver. |

Son 15 pruebas nuevas que se suman a las 30 existentes. En la ejecución del 6 de noviembre de 2026 pasaron las 45.

Se usa la aplicación Express con una conexión de base de datos simulada. Los hashes de contraseña sí se calculan y verifican con scrypt real. Las pruebas revisan los valores que llegan al SQL, la selección de columnas públicas y el contrato HTTP; no escriben en la base local.

En el cambio de contraseña se comprueba que se genere un hash válido y que el repositorio solicite incrementar `token_version`. Al editar otros datos se comprueba que no se actualicen esos campos. El comportamiento del motor de base de datos y sus triggers se verifica por separado con los scripts de PostgreSQL.

## Cambio observado en las líneas ejecutadas

| Archivo o pieza | Antes | Después |
| --- | ---: | ---: |
| Repositorio de usuarios | 51,52 % | 100 % |
| Casos de uso de usuarios | 81,48 % | 100 % |
| Repositorio de auditoría | 60 % | 100 % |
| Controlador de auditoría | 64,29 % | 100 % |
| Repositorio de inventario | 80 % | 100 % |
| Controlador de inventario | 78,57 % | 100 % |
| Traducción de errores de PostgreSQL | 90 % | 100 % |

Estos valores describen esa ejecución y pueden cambiar al modificar los archivos o las pruebas. El 100 % de líneas no implica el 100 % de ramas: por ejemplo, el repositorio de usuarios obtuvo 92,31 % de ramas.

## Cómo interpretar el resultado

- **Líneas:** qué líneas se ejecutaron.
- **Ramas:** qué caminos de las condiciones se recorrieron.
- **Funciones:** qué funciones se invocaron.

El resumen nativo también cuenta los archivos de pruebas, por lo que no debe presentarse como un porcentaje exclusivo del código de aplicación. Además, un archivo que no se cargó puede no aparecer en el informe. La ausencia de un archivo no equivale a tenerlo cubierto.

La medición no incluye SQL ni el frontend Angular. Tampoco demuestra por sí sola que una afirmación del test sea suficiente. Por eso se comprueban resultados, valores enviados y errores esperados, y se mantienen las verificaciones reales de PostgreSQL:

```powershell
npm.cmd run db:verify
npm.cmd run db:concurrency
```

La primera revierte los datos temporales de su transacción, aunque las secuencias pueden avanzar. La segunda trabaja en un esquema temporal y requiere permiso para crearlo. No es necesario ejecutar estas verificaciones para obtener el informe de cobertura JavaScript.
