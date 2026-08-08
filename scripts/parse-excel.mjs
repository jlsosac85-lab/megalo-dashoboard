/**
 * MEGALO — Parser de sell out
 * Lee todos los .xlsx en /data y genera src/data/sales.json.
 *
 * Formato esperado por archivo (una marca por archivo):
 *   - Bloques apilados por año. Cada bloque inicia con una fila título
 *     "VENTAS POR UNIDADES MARCA <NOMBRE> <AÑO>", luego una fila de
 *     encabezados (SKU | SKU alterno | PRODUCTO | ENE..DIC | TOTAL) y
 *     luego una fila por SKU. La fila de totales (sin SKU/producto) cierra el bloque.
 *
 * Para actualizar datos: reemplaza los .xlsx en /data, haz commit y push.
 * Vercel corre este script en cada build (prebuild) automáticamente.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '..', 'data')
const OUT_FILE = resolve(__dirname, '..', 'src', 'data', 'sales.json')

const TITLE_RE = /VENTAS\s+POR\s+UNIDADES\s+MARCA\s+(.+?)\s+(\d{4})/i

// Reglas de categorización por nombre de producto (orden importa).
// Ajusta aquí si un SKU queda mal clasificado.
const CATEGORY_RULES = [
  { cat: 'Pilas', re: /PILA/i },
  { cat: 'Audio', re: /AUDIFONO|BOCINA|MANOS LIBRES|AUXILIAR/i },
  { cat: 'Cargadores', re: /CARGADOR|CARRO|PARED\b|AUTO\b/i },
  { cat: 'Cables', re: /CABLE|IPHONE|TIPO C|ANDROID|ZIPPER|PULPO|LLAVERO/i },
]
const categorize = (producto) =>
  (CATEGORY_RULES.find((r) => r.re.test(producto)) || { cat: 'Otros' }).cat

const rows = []
const files = readdirSync(DATA_DIR).filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith('~$'))
if (files.length === 0) {
  console.error('No se encontraron archivos .xlsx en /data')
  process.exit(1)
}

for (const file of files) {
  const wb = XLSX.read(readFileSync(join(DATA_DIR, file)), { type: 'buffer' })
  for (const sheetName of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null })
    let brand = null
    let year = null
    let inBlock = false
    for (const row of grid) {
      const c0 = row[0] == null ? '' : String(row[0]).trim()
      const title = c0.match(TITLE_RE)
      if (title) {
        brand = title[1].trim().replace(/\s+/g, ' ')
        year = Number(title[2])
        inBlock = false
        continue
      }
      if (c0.toUpperCase().includes('MEGALO')) {
        inBlock = true // fila de encabezados
        continue
      }
      if (!inBlock || !brand) continue
      const sku = c0
      const producto = row[2] == null ? '' : String(row[2]).trim()
      if (!sku || !producto) {
        // fila de totales o vacía → cierra el bloque
        if (!sku && !producto) inBlock = false
        continue
      }
      const months = []
      for (let m = 0; m < 12; m++) {
        const v = row[3 + m]
        months.push(typeof v === 'number' ? v : null)
      }
      rows.push({
        marca: normalizeBrand(brand),
        year,
        sku,
        altSku: row[1] == null ? null : String(row[1]).trim(),
        producto,
        categoria: categorize(producto),
        months,
        total: months.reduce((a, b) => a + (b || 0), 0),
      })
    }
  }
}

function normalizeBrand(b) {
  const u = b.toUpperCase()
  if (u.includes('FLASH')) return 'Flash Data'
  if (u.includes('KROON')) return 'Kroon'
  if (u.includes('PLUGER')) return 'Pluger'
  if (u.includes('PROPIA')) return 'Marca Propia'
  return b
}

const years = [...new Set(rows.map((r) => r.year))].sort()
const brands = [...new Set(rows.map((r) => r.marca))].sort()
const categories = [...new Set(rows.map((r) => r.categoria))].sort()

const out = {
  generatedAt: new Date().toISOString(),
  years,
  brands,
  categories,
  rows,
}

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(out))

// Resumen de control para validar contra los Excel
console.log(`Archivos: ${files.join(', ')}`)
console.log(`Filas SKU-año: ${rows.length} | Años: ${years.join(', ')} | Marcas: ${brands.join(', ')}`)
for (const y of years) {
  const t = rows.filter((r) => r.year === y).reduce((a, r) => a + r.total, 0)
  console.log(`  Total ${y}: ${t.toLocaleString('es-MX')} unidades`)
}
