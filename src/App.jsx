import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import data from './data/sales.json'

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

const BRAND_COLORS = {
  'Flash Data': '#ff3d46',
  'Kroon': '#c05ae0',
  'Pluger': '#ffb02e',
  'Marca Propia': '#ff5c6a',
}
const CAT_COLORS = ['#ff3d46', '#ffb02e', '#c05ae0', '#ff5c6a', '#3ddcdc', '#7a2f85']
// Años más recientes con colores más fuertes
const YEAR_COLORS = {}
{
  const strong = ['#ff3d46', '#ffb02e', '#8d81a0', '#4f4661']
  ;[...data.years].sort((a, b) => b - a).forEach((y, i) => {
    YEAR_COLORS[y] = strong[Math.min(i, strong.length - 1)]
  })
}

const GRID = 'rgba(255,255,255,0.08)'
const TICK = { fontSize: 12, fill: '#e8e2ee', fontWeight: 700 }
const OUTLINE = {
  filter:
    'drop-shadow(1px 0 0 rgba(0,0,0,0.85)) drop-shadow(-1px 0 0 rgba(0,0,0,0.85)) drop-shadow(0 1px 0 rgba(0,0,0,0.85)) drop-shadow(0 -1px 0 rgba(0,0,0,0.85))',
}
const TOOLTIP_STYLE = {
  background: 'rgba(18,14,26,0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  color: '#f2eef4',
}
const hideOnError = (e) => { e.currentTarget.parentElement.style.display = 'none' }

const fmt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-MX'))
const pct = (n) => (n == null || !isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`)

function Delta({ value }) {
  if (value == null || !isFinite(value)) return <span className="delta neutral">sin base de comparación</span>
  const cls = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '■'
  return <span className={`delta ${cls}`}>{arrow} {pct(value)}</span>
}

export default function App() {
  const years = data.years
  const currentYear = Math.max(...years)
  const [year, setYear] = useState(currentYear)
  const [brandSel, setBrandSel] = useState([]) // vacío = todas
  const [catSel, setCatSel] = useState([])
  const [sortBy, setSortBy] = useState({ key: 'total', dir: -1 })

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const filtered = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (brandSel.length === 0 || brandSel.includes(r.marca)) &&
          (catSel.length === 0 || catSel.includes(r.categoria))
      ),
    [brandSel, catSel]
  )
  const rowsYear = useMemo(() => filtered.filter((r) => r.year === year), [filtered, year])
  const rowsPrev = useMemo(() => filtered.filter((r) => r.year === year - 1), [filtered, year])

  // Último mes con datos del año seleccionado
  const lastMonth = useMemo(() => {
    let lm = -1
    for (const r of rowsYear) r.months.forEach((v, i) => { if (v != null && v > 0 && i > lm) lm = i })
    return lm
  }, [rowsYear])

  const sumMonths = (rows, from = 0, to = 11) =>
    rows.reduce((a, r) => a + r.months.slice(from, to + 1).reduce((x, y) => x + (y || 0), 0), 0)

  // KPIs
  const totalYear = sumMonths(rowsYear)
  const ytdCurr = sumMonths(rowsYear, 0, lastMonth)
  const ytdPrev = sumMonths(rowsPrev, 0, lastMonth)
  const yoy = ytdPrev > 0 ? ytdCurr / ytdPrev - 1 : null
  const mCurr = lastMonth >= 0 ? sumMonths(rowsYear, lastMonth, lastMonth) : 0
  const mPrev = lastMonth >= 1 ? sumMonths(rowsYear, lastMonth - 1, lastMonth - 1) : 0
  const mom = mPrev > 0 ? mCurr / mPrev - 1 : null
  const mLYSame = sumMonths(rowsPrev, lastMonth, lastMonth)
  const momYoY = mLYSame > 0 ? mCurr / mLYSame - 1 : null
  const totalGeneral = filtered.reduce((a, r) => a + r.total, 0)
  const activeSkus = new Set(rowsYear.filter((r) => r.total > 0).map((r) => r.sku)).size

  // Serie mensual multi-año
  const monthlySeries = useMemo(
    () =>
      MESES.map((m, i) => {
        const point = { mes: m }
        for (const y of years) {
          const s = filtered
            .filter((r) => r.year === y)
            .reduce((a, r) => a + (r.months[i] || 0), 0)
          point[y] = y === year && i > lastMonth ? null : s
        }
        return point
      }),
    [filtered, years, year, lastMonth]
  )

  // Por marca (año seleccionado, con comparativo)
  const byBrand = useMemo(
    () =>
      data.brands
        .filter((b) => brandSel.length === 0 || brandSel.includes(b))
        .map((b) => ({
          marca: b,
          [year]: sumMonths(rowsYear.filter((r) => r.marca === b)),
          [year - 1]: sumMonths(rowsPrev.filter((r) => r.marca === b), 0, lastMonth) || undefined,
        })),
    [rowsYear, rowsPrev, brandSel, year, lastMonth]
  )

  // Mix por categoría
  const byCat = useMemo(() => {
    const map = {}
    for (const r of rowsYear) map[r.categoria] = (map[r.categoria] || 0) + r.total
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [rowsYear])

  // Tabla SKU con YoY (YTD comparable)
  const skuTable = useMemo(() => {
    const prevMap = {}
    for (const r of rowsPrev) prevMap[r.sku] = r
    const list = rowsYear.map((r) => {
      const p = prevMap[r.sku]
      const curr = r.months.slice(0, lastMonth + 1).reduce((a, b) => a + (b || 0), 0)
      const prevYtd = p ? p.months.slice(0, lastMonth + 1).reduce((a, b) => a + (b || 0), 0) : null
      return {
        sku: r.sku, producto: r.producto, marca: r.marca, categoria: r.categoria,
        total: r.total, ytd: curr, prevYtd,
        yoy: prevYtd > 0 ? curr / prevYtd - 1 : null,
        prom: lastMonth >= 0 ? curr / (lastMonth + 1) : 0,
      }
    })
    const { key, dir } = sortBy
    return list.sort((a, b) => {
      const va = a[key], vb = b[key]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return (va > vb ? 1 : va < vb ? -1 : 0) * dir
    })
  }, [rowsYear, rowsPrev, lastMonth, sortBy])

  const sort = (key) =>
    setSortBy((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))

  const arrow = (key) => (sortBy.key === key ? (sortBy.dir === -1 ? ' ↓' : ' ↑') : '')

  return (
    <>
      <header className="header">
        <video className="header-video" src="/cerro.mp4" autoPlay muted loop playsInline />
        <div className="header-overlay" />
        <div className="header-inner">
          <div className="header-side">
            <span className="ch"><img src="/logo-megalo.png" alt="Megalo" onError={hideOnError} /></span>
            <span className="ch"><img src="/logo-7eleven.png" alt="7-Eleven" onError={hideOnError} /></span>
          </div>
          <div className="titles">
            <h1>Dashboard Sell Out</h1>
            <div className="sub brandfont">UNIDADES · {data.brands.length} MARCAS · {years.join(' / ')}</div>
          </div>
          <div className="header-side">
            <span className="ch"><img src="/logo-masbodega.png" alt="Mas Logística" onError={hideOnError} /></span>
            <span className="ch"><img src="/logo-iconn.png" alt="Iconn" onError={hideOnError} /></span>
          </div>
        </div>
      </header>

      <div className="container">
        {/* Filtros */}
        <div className="filters">
          <label>Año</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[...years].sort((a, b) => b - a).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <label style={{ marginLeft: 12 }}>Marca</label>
          {data.brands.map((b) => (
            <button
              key={b}
              className={`chip ${brandSel.includes(b) || brandSel.length === 0 ? 'active' : ''}`}
              style={brandSel.includes(b) || brandSel.length === 0 ? { background: BRAND_COLORS[b] || '#8a2e90' } : {}}
              onClick={() => toggle(brandSel, setBrandSel, b)}
            >
              {b}
            </button>
          ))}
          <label style={{ marginLeft: 12 }}>Categoría</label>
          {data.categories.map((c, i) => (
            <button
              key={c}
              className={`chip ${catSel.includes(c) || catSel.length === 0 ? 'active' : ''}`}
              style={catSel.includes(c) || catSel.length === 0 ? { background: CAT_COLORS[i % CAT_COLORS.length] } : {}}
              onClick={() => toggle(catSel, setCatSel, c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div className="kpis">
          <div className="kpi">
            <div className="label">Total {year}</div>
            <div className="value">{fmt(totalYear)}</div>
            <Delta value={yoy} />
            <div className="delta neutral">vs {year - 1} (ene–{MESES[Math.max(lastMonth, 0)].toLowerCase()})</div>
          </div>
          <div className="kpi k2">
            <div className="label">Último mes ({lastMonth >= 0 ? MESES[lastMonth] : '—'} {year})</div>
            <div className="value">{fmt(mCurr)}</div>
            <Delta value={mom} />
            <div className="delta neutral">vs mes anterior · {pct(momYoY)} vs {MESES[Math.max(lastMonth, 0)]} {year - 1}</div>
          </div>
          <div className="kpi k3">
            <div className="label">SKUs activos {year}</div>
            <div className="value">{fmt(activeSkus)}</div>
            <div className="delta neutral">con venta registrada</div>
          </div>
          <div className="kpi k4">
            <div className="label">Total general ({years[0]}–{years[years.length - 1]})</div>
            <div className="value">{fmt(totalGeneral)}</div>
            <div className="delta neutral">unidades acumuladas</div>
          </div>
        </div>

        {/* Tendencia mensual multi-año */}
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Tendencia mensual — comparativo por año</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="mes" tick={TICK} stroke={GRID} />
              <YAxis tick={TICK} stroke={GRID} tickFormatter={fmt} width={70} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: '#9b93a6' }} />
              {[...years].sort().map((y) => (
                <Line
                  key={y}
                  type="monotone"
                  dataKey={y}
                  stroke={YEAR_COLORS[y]}
                  strokeWidth={y === year ? 3 : 2}
                  dot={{ r: y === year ? 3 : 2, fill: YEAR_COLORS[y], strokeWidth: 0 }}
                  connectNulls={false}
                  style={
                    y === year
                      ? { filter: `${OUTLINE.filter} drop-shadow(0 0 6px ${YEAR_COLORS[y]})` }
                      : OUTLINE
                  }
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid2">
          <div className="card">
            <h3>Unidades por marca — {year} vs {year - 1} (YTD comparable)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byBrand}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="marca" tick={TICK} stroke={GRID} />
                <YAxis tick={TICK} stroke={GRID} tickFormatter={fmt} width={70} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Legend wrapperStyle={{ color: '#9b93a6' }} />
                <Bar dataKey={year - 1} fill="#4f4661" stroke="rgba(0,0,0,0.85)" strokeWidth={1.5} radius={[4, 4, 0, 0]} />
                <Bar dataKey={year} stroke="rgba(0,0,0,0.85)" strokeWidth={1.5} radius={[4, 4, 0, 0]}>
                  {byBrand.map((d) => (
                    <Cell key={d.marca} fill={BRAND_COLORS[d.marca] || '#c05ae0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3>Mix por categoría — {year}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3} stroke="rgba(0,0,0,0.85)" strokeWidth={2}>
                  {byCat.map((d, i) => (
                    <Cell key={d.name} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: '#9b93a6' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabla SKU */}
        <div className="card">
          <h3>Detalle por SKU — {year} <span style={{ color: '#8a8078', fontWeight: 400 }}>(clic en encabezados para ordenar)</span></h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th onClick={() => sort('sku')}>SKU{arrow('sku')}</th>
                  <th onClick={() => sort('producto')}>Producto{arrow('producto')}</th>
                  <th onClick={() => sort('marca')}>Marca{arrow('marca')}</th>
                  <th onClick={() => sort('categoria')}>Categoría{arrow('categoria')}</th>
                  <th className="num" onClick={() => sort('total')}>Total {year}{arrow('total')}</th>
                  <th className="num" onClick={() => sort('prom')}>Prom/mes{arrow('prom')}</th>
                  <th className="num" onClick={() => sort('prevYtd')}>YTD {year - 1}{arrow('prevYtd')}</th>
                  <th className="num" onClick={() => sort('yoy')}>YoY{arrow('yoy')}</th>
                </tr>
              </thead>
              <tbody>
                {skuTable.map((r) => (
                  <tr key={r.sku + r.marca}>
                    <td style={{ fontWeight: 600 }}>{r.sku}</td>
                    <td>{r.producto}</td>
                    <td>
                      <span className="tag" style={{ background: `${BRAND_COLORS[r.marca]}18`, color: BRAND_COLORS[r.marca] }}>
                        {r.marca}
                      </span>
                    </td>
                    <td>{r.categoria}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{fmt(r.total)}</td>
                    <td className="num">{fmt(r.prom)}</td>
                    <td className="num">{fmt(r.prevYtd)}</td>
                    <td className="num">
                      <Delta value={r.yoy} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="footer brandfont">
          MEGALO · datos actualizados: {new Date(data.generatedAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </>
  )
}
