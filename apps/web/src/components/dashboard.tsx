"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleAlert, HeartPulse, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/format";

const CashChart = dynamic(() => import("@/components/dashboard-chart"), { ssr: false, loading: () => <div className="skeleton" style={{ minHeight: 320 }} /> });
const currencies = ["BRL", "USD", "EUR"];
const extract = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value as Record<string, unknown>[] : value && typeof value === "object" && "data" in value && Array.isArray((value as { data: unknown }).data) ? (value as { data: Record<string, unknown>[] }).data : [];
const pick = (data: Record<string, unknown>, keys: string[]) => keys.map((key) => data[key]).find((value) => value !== undefined && value !== null);

function MoneyValue({ value, currency, fallback = "—" }: { value: unknown; currency: string; fallback?: string }) {
  return <>{value === undefined || value === null ? fallback : formatMoney(String(value), currency)}</>;
}

export function Dashboard() {
  const [currency, setCurrency] = useState("BRL");
  const overview = useQuery({ queryKey: ["dashboard", "overview", currency], queryFn: () => api("/dashboard/overview", { query: { currency } }) });
  const cash = useQuery({ queryKey: ["dashboard", "cash", currency], queryFn: () => api("/dashboard/cash-flow", { query: { currency, groupBy: "day" } }) });
  const recent = useQuery({ queryKey: ["dashboard", "recent", currency], queryFn: () => api("/dashboard/recent-transactions", { query: { currency, limit: 7 } }) });
  const data = extract(overview.data);
  const balance = pick(data, ["balance", "currentBalance", "netWorth", "totalBalance"]);
  const hasBalance = balance !== undefined && balance !== null;
  const income = pick(data, ["income", "totalIncome"]);
  const expenses = pick(data, ["expenses", "totalExpenses"]);
  const net = pick(data, ["net", "netAmount", "cashFlow"]);
  const transactions = rows(recent.data);

  return <div className="page dashboard-page">
    <div className="page-head dashboard-head">
      <div><h1>Visão geral</h1><p>Seu panorama financeiro, sem misturar moedas.</p></div>
      <label className="currency-field"><span>Moeda</span><select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Moeda do painel">{currencies.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>

    {overview.isError ? <section className="panel error-state" role="alert"><h2>Não foi possível carregar seu panorama</h2><p className="muted">Verifique a conexão com a API. Nenhum valor foi estimado no navegador.</p><button className="btn" onClick={() => void overview.refetch()}>Tentar novamente</button></section> :
      <section className="money-hero" aria-labelledby="money-title">
        <div className="hero-primary"><span id="money-title">Patrimônio atual</span>{overview.isLoading ? <div className="skeleton" /> : hasBalance ? <strong className="amount"><MoneyValue value={balance} currency={currency} /></strong> : <strong className="no-data">Dados insuficientes</strong>}<small>Valores confirmados na moeda selecionada · {currency}</small></div>
        <div className="hero-facts">
          <div><span>Receitas</span><strong className="amount positive"><MoneyValue value={income} currency={currency} /></strong><small>Período atual</small></div>
          <div><span>Despesas</span><strong className="amount critical"><MoneyValue value={expenses} currency={currency} /></strong><small>Período atual</small></div>
          <div><span>Resultado</span><strong className="amount"><MoneyValue value={net} currency={currency} /></strong><small>Receitas menos despesas</small></div>
        </div>
      </section>}

    <div className="dashboard-grid open-section">
      <section className="cash-section" aria-labelledby="cash-title">
        <div className="section-head"><div><h2 id="cash-title">Como estou indo</h2><p>Receitas, despesas e resultado do período</p></div><div className="legend" aria-hidden="true"><span className="income">Receitas</span><span className="expense">Despesas</span><span className="net">Resultado</span></div></div>
        {cash.isError ? <div className="error-state" role="alert">O fluxo de caixa não pôde ser carregado.</div> : cash.isLoading ? <div className="skeleton" style={{ minHeight: 320 }} /> : <CashChart data={cash.data} currency={currency} />}
      </section>
      <aside className="period-summary" aria-labelledby="period-title">
        <div className="section-head"><div><h2 id="period-title">O que mudou</h2><p>Leitura objetiva do período</p></div></div>
        <div className="summary-list">
          <div><TrendingUp aria-hidden="true" /><span>Entradas registradas</span><strong className="amount"><MoneyValue value={income} currency={currency} /></strong></div>
          <div><TrendingDown aria-hidden="true" /><span>Saídas registradas</span><strong className="amount"><MoneyValue value={expenses} currency={currency} /></strong></div>
          <div><CircleAlert aria-hidden="true" /><span>Resultado líquido</span><strong className="amount"><MoneyValue value={net} currency={currency} /></strong></div>
        </div>
        <Link className="text-link" href="/reports">Abrir análise completa <ArrowRight /></Link>
      </aside>
    </div>

    <div className="lower-grid open-section">
      <section aria-labelledby="attention-title"><div className="section-head"><div><h2 id="attention-title">O que merece atenção</h2><p>Próximos passos com base nos seus registros</p></div></div><div className="attention-list">
        <Link href="/financial-health"><HeartPulse /><div><strong>Entenda sua saúde financeira</strong><span>Veja a qualidade dos dados e os componentes avaliados pelo Atlas.</span></div><ArrowRight /></Link>
        <Link href="/budgets"><CircleAlert /><div><strong>Revise seus orçamentos</strong><span>Acompanhe limites, consumo e saldo por categoria.</span></div><ArrowRight /></Link>
        <Link href="/goals"><TrendingUp /><div><strong>Acompanhe suas metas</strong><span>Confira o progresso sem combinar moedas diferentes.</span></div><ArrowRight /></Link>
      </div></section>
      <section aria-labelledby="recent-title"><div className="section-head"><div><h2 id="recent-title">Transações recentes</h2><p>Últimas movimentações em {currency}</p></div><Link className="text-link" href="/transactions">Ver todas</Link></div>
        {recent.isLoading ? <div className="skeleton" /> : transactions.length === 0 ? <div className="compact-empty">Nenhuma movimentação neste período.</div> : <div className="recent-list">{transactions.map((item, index) => <div key={String(item.id ?? index)}><div><strong>{String(item.description ?? "Movimentação")}</strong><span>{formatDate(String(item.transactionDate ?? ""))}</span></div><b className="amount"><MoneyValue value={item.amount} currency={String(item.currency ?? currency)} /></b></div>)}</div>}
      </section>
    </div>
    <style jsx>{`
      .currency-field{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;color:var(--text-secondary)}.currency-field select{height:42px;min-width:92px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);background:var(--surface);padding:0 12px;color:var(--text);font-weight:700}
      .money-hero{display:grid;grid-template-columns:minmax(280px,1.15fr) 1.85fr;gap:42px;padding:18px 0 30px}.hero-primary{display:flex;flex-direction:column;gap:7px}.hero-primary>span{color:var(--text-secondary);font-size:14px;font-weight:700}.hero-primary strong{font-size:clamp(36px,4.5vw,62px);line-height:1;letter-spacing:-.065em;white-space:nowrap}.hero-primary .no-data{font-size:clamp(26px,3vw,38px);letter-spacing:-.045em;white-space:normal}.hero-primary small,.hero-facts small{color:var(--muted)}.hero-primary .skeleton{height:62px}.hero-facts{display:grid;grid-template-columns:repeat(3,1fr);align-self:end}.hero-facts>div{min-height:96px;display:flex;flex-direction:column;gap:8px;padding:5px 24px;border-left:1px solid var(--border)}.hero-facts span{font-size:12px;color:var(--muted)}.hero-facts strong{font-size:19px}.positive{color:var(--positive)}.critical{color:var(--critical)}
      .dashboard-grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(300px,.9fr);gap:34px}.legend{display:flex;gap:15px;color:var(--muted);font-size:11px}.legend span{display:flex;align-items:center;gap:6px}.legend span:before{content:"";width:14px;height:2px;background:var(--chart-1)}.legend .expense:before{background:var(--chart-2)}.legend .net:before{height:7px;background:var(--chart-3);opacity:.65}.period-summary{border-left:1px solid var(--border);padding-left:28px}.summary-list{margin:16px 0 14px}.summary-list>div{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:16px 0;border-bottom:1px solid var(--border)}.summary-list svg{width:16px;color:var(--muted)}.summary-list span{font-size:13px}.summary-list strong{font-size:13px}.text-link{display:inline-flex;align-items:center;gap:7px;text-decoration:none;color:var(--atlas);font-size:13px;font-weight:750}.text-link :global(svg){width:15px}
      .lower-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:34px}.lower-grid>section+section{border-left:1px solid var(--border);padding-left:28px}.attention-list,.recent-list{margin-top:12px}.attention-list a{display:grid;grid-template-columns:35px 1fr 18px;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border);text-decoration:none}.attention-list a:hover strong{color:var(--atlas)}.attention-list :global(svg){width:18px;color:var(--atlas)}.attention-list div{display:flex;flex-direction:column;gap:3px}.attention-list strong{font-size:13px}.attention-list span{font-size:12px;color:var(--muted);line-height:1.45}.recent-list>div{display:flex;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px solid var(--border)}.recent-list>div>div{display:flex;flex-direction:column;gap:3px}.recent-list strong,.recent-list b{font-size:13px}.recent-list span,.compact-empty{font-size:12px;color:var(--muted)}.compact-empty{padding:32px 0}
      @media(max-width:1150px){.money-hero{grid-template-columns:1fr}.hero-facts{align-self:auto}.dashboard-grid,.lower-grid{grid-template-columns:1fr}.period-summary,.lower-grid>section+section{border-left:0;padding-left:0;border-top:1px solid var(--border);padding-top:22px}}
      @media(max-width:600px){.dashboard-head{gap:14px}.currency-field{align-self:flex-start}.money-hero{gap:24px;padding-top:4px}.hero-primary strong{font-size:39px;white-space:normal}.hero-facts{grid-template-columns:1fr 1fr}.hero-facts>div{padding:12px 12px 12px 0;border-left:0;border-top:1px solid var(--border);min-height:auto}.hero-facts>div:last-child{grid-column:1/-1}.legend{display:none}.dashboard-grid{gap:24px}.period-summary{padding-top:20px}.summary-list>div{grid-template-columns:20px 1fr}.summary-list strong{grid-column:2;text-align:left}.attention-list span{display:none}}
    `}</style>
  </div>;
}
