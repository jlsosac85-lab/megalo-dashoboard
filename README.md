# Megalo · Dashboard Sell Out

Dashboard de ventas por unidades para las 4 marcas de Megalo (Flash Data, Kroon, Pluger, Marca Propia), con comparativos mes a mes, año contra año (YTD comparable), total año y total general.

## Cómo funciona

Los archivos Excel viven en la carpeta `/data`. En cada build, el script `scripts/parse-excel.mjs` los lee, detecta los bloques por año (2024, 2025, 2026...) y genera `src/data/sales.json`, que alimenta el dashboard. No hay base de datos ni backend.

## Despliegue inicial (una sola vez, ~10 minutos)

1. **Crear el repositorio en GitHub**
   - Entra a github.com → botón **New repository** → nombre: `megalo-dashboard` → **Private** → Create.
   - En tu computadora, dentro de esta carpeta, ejecuta:
     ```
     git init
     git add .
     git commit -m "Dashboard Megalo inicial"
     git branch -M main
     git remote add origin https://github.com/TU_USUARIO/megalo-dashboard.git
     git push -u origin main
     ```
   - Alternativa sin terminal: en la página del repo nuevo usa **uploading an existing file** y arrastra toda la carpeta (excepto `node_modules` y `dist`).

2. **Conectar Vercel**
   - Entra a vercel.com → **Add New → Project** → **Import** tu repo `megalo-dashboard`.
   - Vercel detecta Vite automáticamente. No cambies nada. → **Deploy**.
   - En ~1 minuto tendrás tu URL (ej. `megalo-dashboard.vercel.app`).

## Actualización mensual (~2 minutos)

1. Actualiza tus 4 Excel como siempre (mismo formato: bloques por año, ENE–DIC).
2. En GitHub, entra a la carpeta `data` del repo → **Add file → Upload files** → arrastra los 4 Excel actualizados → **Commit changes**.
3. Vercel detecta el cambio y redespliega solo. En 1–2 minutos el dashboard muestra los datos nuevos.

Para agregar un año nuevo (2027), solo agrega el bloque nuevo arriba en cada Excel con el título `VENTAS POR UNIDADES MARCA <NOMBRE> 2027`. El código lo detecta sin cambios.

## Ajustar categorías

Las categorías (Cables, Cargadores, Audio, Pilas) se infieren del nombre del producto. Las reglas están al inicio de `scripts/parse-excel.mjs` en `CATEGORY_RULES`. Si un SKU queda mal clasificado, agrega o reordena una regla ahí.

## Desarrollo local (opcional)

```
npm install
npm run dev
```

## Reglas del formato Excel que el parser espera

- Una marca por archivo; el nombre de la marca sale del título del bloque.
- Cada bloque: fila título con el año → fila de encabezados (contiene "MEGALO SKU") → filas de SKU → fila de totales (sin SKU) que cierra el bloque.
- Meses en columnas D a O (ENE–DIC). Celdas vacías = sin venta.
