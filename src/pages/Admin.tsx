import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useAccount } from '../lib/account'
import { defaultPricing, kindLabels, summarize, type Pricing, type UsageEvent, type UserStat } from '../lib/admin-metrics'
import { loadAdminData } from '../lib/usage'
import './Admin.css'

const pricingKey = 'casanexa-admin-pricing'
const periods = [7, 30, 90] as const
const consoleUrl = 'https://console.firebase.google.com/project/imoassistenteai'

function loadPricing(): Pricing {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(pricingKey) ?? 'null')
    if (parsed && typeof parsed === 'object') {
      const { inputPerM, outputPerM, eurPerUsd } = parsed as Partial<Pricing>
      if ([inputPerM, outputPerM, eurPerUsd].every((value) => typeof value === 'number' && value >= 0)) return { inputPerM: inputPerM!, outputPerM: outputPerM!, eurPerUsd: eurPerUsd! }
    }
  } catch { /* usa os preços por omissão */ }
  return defaultPricing
}

const number = (value: number) => new Intl.NumberFormat('pt-PT').format(Math.round(value))
const euro = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: value > 0 && value < 1 ? 4 : 2 }).format(value)
const shortDate = (date: Date | null) => date ? new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date) : '—'
const dayLabel = (key: string) => key.slice(8, 10) + '/' + key.slice(5, 7)

type Result = { days: number; reload: number; at: Date; data?: { events: UsageEvent[]; stats: UserStat[]; truncated: boolean }; failed?: boolean }

export default function Admin({ loader = loadAdminData }: { loader?: typeof loadAdminData }) {
  const account = useAccount()
  const isAdmin = Boolean(account?.isAdmin)
  const [days, setDays] = useState<(typeof periods)[number]>(30)
  const [reload, setReload] = useState(0)
  const [pricing, setPricing] = useState(loadPricing)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    loader(days).then(
      (data) => { if (!cancelled) setResult({ days, reload, at: new Date(), data }) },
      () => { if (!cancelled) setResult({ days, reload, at: new Date(), failed: true }) },
    )
    return () => { cancelled = true }
  }, [isAdmin, days, reload, loader])

  useEffect(() => {
    try { localStorage.setItem(pricingKey, JSON.stringify(pricing)) } catch { /* sem armazenamento */ }
  }, [pricing])

  const loading = !result || result.days !== days || result.reload !== reload
  const data = result?.data
  const error = !loading && result?.failed ? 'Não foi possível ler as métricas. Confirma que entraste com uma conta de administrador e que as regras do Firestore estão publicadas.' : ''

  const summary = useMemo(() => result?.data ? summarize(result.data.events, result.data.stats, pricing, result.at, result.days) : null, [result, pricing])

  if (!isAdmin) return <div className="empty-state">Esta área é só para administradores.</div>

  const maxDayCost = Math.max(0, ...(summary?.byDay.map((day) => day.costEur) ?? []))
  const maxDayCalls = Math.max(0, ...(summary?.byDay.map((day) => day.calls) ?? []))
  const chartByCost = maxDayCost > 0
  const setPrice = (field: keyof Pricing, value: string) => setPricing((current) => ({ ...current, [field]: Math.max(0, Number(value) || 0) }))

  return (
    <section className="admin">
      <header className="admin-heading">
        <div>
          <span className="eyebrow">ADMINISTRAÇÃO</span>
          <h2>Utilização e custos da plataforma</h2>
          <p>Estimativa a partir do que os utilizadores usam. A fatura real está na consola da Google.</p>
        </div>
        <div className="admin-controls">
          <div className="admin-periods" role="group" aria-label="Período">
            {periods.map((value) => <button key={value} type="button" className={value === days ? 'active' : ''} aria-pressed={value === days} onClick={() => setDays(value)}>{value} dias</button>)}
          </div>
          <button className="dash-button" type="button" onClick={() => setReload((count) => count + 1)} disabled={loading}>{loading ? <Loader2 className="studio-spinner" size={14} /> : <RefreshCw size={14} />} Atualizar</button>
        </div>
      </header>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading && !summary && <div className="empty-state">A ler as métricas…</div>}

      {summary && <>
        <div className="admin-kpis">
          <article className="dash-panel"><span>Custo estimado da IA</span><strong>{euro(summary.costEur)}</strong><small>Últimos {summary.days} dias</small></article>
          <article className="dash-panel"><span>Projeção mensal</span><strong>{euro(summary.projectedMonthEur)}</strong><small>Ao ritmo deste período</small></article>
          <article className="dash-panel"><span>Pedidos à IA</span><strong>{number(summary.calls)}</strong><small>{summary.failed ? `${number(summary.failed)} falharam` : 'Sem falhas'}</small></article>
          <article className="dash-panel"><span>Utilizadores ativos</span><strong>{number(summary.activeUsers)}</strong><small>de {number(summary.totalUsers)} registados</small></article>
          <article className="dash-panel"><span>Custo por utilizador ativo</span><strong>{euro(summary.costPerActiveUserEur)}</strong><small>No período</small></article>
          <article className="dash-panel"><span>Dados guardados</span><strong>{number(summary.totalClients)}</strong><small>clientes · {number(summary.totalProperties)} imóveis · {number(summary.totalAppointments)} visitas</small></article>
        </div>

        <section className="dash-panel admin-panel">
          <div className="panel-heading"><div><span className="eyebrow">POR DIA</span><h3>{chartByCost ? 'Custo estimado da IA' : 'Pedidos à IA'}</h3></div></div>
          <div className="admin-chart" role="img" aria-label={`${chartByCost ? 'Custo' : 'Pedidos'} por dia nos últimos ${summary.days} dias`}>
            {summary.byDay.map((day) => {
              const value = chartByCost ? day.costEur : day.calls
              const max = chartByCost ? maxDayCost : maxDayCalls
              return <div className="admin-bar" key={day.day} title={`${dayLabel(day.day)} · ${number(day.calls)} pedidos · ${euro(day.costEur)}`}>
                <span style={{ height: `${max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0}%` }} />
                {(summary.days <= 7 || summary.byDay.indexOf(day) % Math.ceil(summary.days / 10) === 0) && <i>{dayLabel(day.day)}</i>}
              </div>
            })}
          </div>
          {data?.truncated && <p className="admin-note">Há mais de 5 000 pedidos neste período: só os mais recentes entram nas contas.</p>}
        </section>

        <div className="admin-two">
          <section className="dash-panel admin-panel">
            <div className="panel-heading"><div><span className="eyebrow">POR FUNCIONALIDADE</span><h3>Onde se gasta</h3></div></div>
            {summary.byKind.length === 0 ? <p className="admin-empty">Ainda não há pedidos à IA neste período.</p> : <table className="admin-table">
              <thead><tr><th>Funcionalidade</th><th>Pedidos</th><th>Custo</th></tr></thead>
              <tbody>{summary.byKind.map((item) => <tr key={item.kind}><td>{kindLabels[item.kind]}</td><td>{number(item.calls)}</td><td>{euro(item.costEur)}</td></tr>)}</tbody>
            </table>}
            <p className="admin-note">Tokens no período: {number(summary.inputTokens)} de entrada e {number(summary.outputTokens)} de saída (o raciocínio do modelo conta como saída).</p>
          </section>

          <section className="dash-panel admin-panel">
            <div className="panel-heading"><div><span className="eyebrow">PREÇOS USADOS NA ESTIMATIVA</span><h3>Tabela de custos da IA</h3></div></div>
            <div className="admin-pricing">
              <label>Entrada ($ por milhão de tokens)<input type="number" min="0" step="0.01" value={pricing.inputPerM} onChange={(event) => setPrice('inputPerM', event.target.value)} /></label>
              <label>Saída ($ por milhão de tokens)<input type="number" min="0" step="0.01" value={pricing.outputPerM} onChange={(event) => setPrice('outputPerM', event.target.value)} /></label>
              <label>Euros por dólar<input type="number" min="0" step="0.01" value={pricing.eurPerUsd} onChange={(event) => setPrice('eurPerUsd', event.target.value)} /></label>
            </div>
            <p className="admin-note">Valores por omissão: preço de lançamento do Gemini 3.8 Flash segundo sites de terceiros, que sobe em 2027. Confirma-os em ai.google.dev/pricing e ajusta aqui. Ficam guardados neste browser.</p>
            <button className="verify-button" type="button" onClick={() => setPricing(defaultPricing)}>Repor valores por omissão</button>
          </section>
        </div>

        <section className="dash-panel admin-panel">
          <div className="panel-heading"><div><span className="eyebrow">POR UTILIZADOR</span><h3>Quem usa e quanto custa</h3></div></div>
          {summary.byUser.length === 0 ? <p className="admin-empty">Ainda não há utilizadores com ficha. A ficha é criada quando cada conta entra na versão publicada.</p> : <div className="admin-scroll"><table className="admin-table">
            <thead><tr><th>Utilizador</th><th>Clientes</th><th>Imóveis</th><th>Visitas</th><th>Pedidos IA</th><th>Tokens (ent./saída)</th><th>Custo IA</th><th>Última visita</th></tr></thead>
            <tbody>{summary.byUser.map((user) => <tr key={user.uid}>
              <td><strong>{user.name || user.email || 'Sem ficha'}</strong>{user.name && user.email && <small>{user.email}</small>}</td>
              <td>{number(user.clients)}</td><td>{number(user.properties)}</td><td>{number(user.appointments)}</td>
              <td>{number(user.calls)}{user.failed > 0 && <small>{user.failed} falhas</small>}</td>
              <td>{number(user.inputTokens)} / {number(user.outputTokens)}</td>
              <td>{euro(user.costEur)}</td>
              <td>{shortDate(user.lastSeenAt)}</td>
            </tr>)}</tbody>
          </table></div>}
        </section>
      </>}

      <section className="dash-panel admin-panel">
        <div className="panel-heading"><div><span className="eyebrow">INFRAESTRUTURA</span><h3>Plano gratuito (Spark)</h3></div></div>
        <p className="admin-note">Hoje não há custos fixos: o login, os dados e a publicação estão no plano gratuito. Esta página só consegue estimar a IA. O consumo real do Firestore e do Hosting vê-se na consola, e esses números não passam por aqui.</p>
        <ul className="admin-limits">
          <li><strong>Firestore</strong><span>cota diária habitual: 50 000 leituras, 20 000 escritas e 1 GiB guardado</span></li>
          <li><strong>Hosting</strong><span>cota habitual: 10 GB guardados e 360 MB transferidos por dia</span></li>
          <li><strong>IA (Firebase AI Logic)</strong><span>camada gratuita da Gemini Developer API, com limites por minuto e por dia</span></li>
        </ul>
        <p className="admin-note">Os limites podem mudar: confirma-os na consola.</p>
        <div className="admin-links">
          <a className="dash-button" href={`${consoleUrl}/usage`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Utilização e faturação</a>
          <a className="dash-button" href={`${consoleUrl}/firestore/databases/-default-/usage`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Uso do Firestore</a>
          <a className="dash-button" href={`${consoleUrl}/ailogic`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Firebase AI Logic</a>
          <a className="dash-button" href={`${consoleUrl}/appcheck`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> App Check</a>
        </div>
      </section>
    </section>
  )
}
