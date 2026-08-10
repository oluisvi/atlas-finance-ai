"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

export type CashRow = { label: string; income: number; expense: number; net: number };

export function cashRows(data: unknown): CashRow[] {
  const source = Array.isArray(data) ? data : data && typeof data === "object" && "data" in data && Array.isArray((data as { data: unknown }).data) ? (data as { data: Record<string, unknown>[] }).data : [];
  return source.map((row: Record<string, unknown>) => {
    const income = Number(row.income ?? row.totalIncome ?? 0);
    const expense = Number(row.expenses ?? row.expense ?? row.totalExpenses ?? 0);
    return { label: String(row.date ?? row.period ?? ""), income, expense, net: Number(row.net ?? income - expense) };
  });
}

export default function DashboardChart({ data, currency }: { data: unknown; currency: string }) {
  const rows = cashRows(data);
  if (!rows.length) return <div className="chart-empty"><div><strong>Dados insuficientes para o gráfico</strong><span>O fluxo aparecerá quando houver receitas ou despesas confirmadas nesta moeda.</span></div><style jsx>{`.chart-empty{height:300px;display:grid;place-items:center;border-top:1px solid var(--border);color:var(--muted);text-align:center}.chart-empty div{display:flex;flex-direction:column;gap:7px}.chart-empty strong{color:var(--text);font-size:15px}`}</style></div>;

  return <>
    <div className="chart-canvas" role="img" aria-label={`Fluxo de caixa em ${currency}, comparando receitas, despesas e resultado líquido por período.`}>
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 2 }}>
          <defs><linearGradient id="atlasNet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--chart-3)" stopOpacity=".42"/><stop offset="1" stopColor="var(--chart-3)" stopOpacity=".04"/></linearGradient></defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <YAxis axisLine={false} tickLine={false} width={54} tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <Tooltip formatter={(value, name) => [formatMoney(String(value ?? 0), currency), name === "income" ? "Receitas" : name === "expense" ? "Despesas" : "Resultado"]} contentStyle={{ border: "1px solid var(--border)", borderRadius: 6, boxShadow: "none" }} />
          <Area type="monotone" dataKey="net" stroke="var(--chart-3)" fill="url(#atlasNet)" strokeWidth={2} />
          <Area type="monotone" dataKey="income" stroke="var(--chart-1)" fill="transparent" strokeWidth={2.2} />
          <Area type="monotone" dataKey="expense" stroke="var(--chart-2)" fill="transparent" strokeWidth={2.2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <table className="sr-only"><caption>Dados do fluxo de caixa</caption><thead><tr><th>Período</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th><td>{formatMoney(String(row.income), currency)}</td><td>{formatMoney(String(row.expense), currency)}</td><td>{formatMoney(String(row.net), currency)}</td></tr>)}</tbody></table>
    <style jsx>{`.chart-canvas{height:320px;width:100%;margin-top:8px}`}</style>
  </>;
}
