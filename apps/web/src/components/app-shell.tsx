"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight, ChartNoAxesCombined, FileChartColumn, HeartPulse, Import,
  LayoutDashboard, Lightbulb, LogOut, Menu, ReceiptText, Repeat2,
  Settings, Target, WalletCards, X,
} from "lucide-react";
import { useAuth } from "@/stores/auth";

type NavIcon = typeof LayoutDashboard;
type NavItem = { href: string; label: string; icon: NavIcon };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Visão geral", items: [{ href: "/dashboard", label: "Visão geral", icon: LayoutDashboard }] },
  { label: "Finanças", items: [
    { href: "/accounts", label: "Contas", icon: WalletCards },
    { href: "/transactions", label: "Transações", icon: ReceiptText },
    { href: "/transfers", label: "Transferências", icon: ArrowLeftRight },
  ] },
  { label: "Planejamento", items: [
    { href: "/budgets", label: "Orçamentos", icon: ChartNoAxesCombined },
    { href: "/goals", label: "Metas", icon: Target },
    { href: "/recurring", label: "Recorrências", icon: Repeat2 },
  ] },
  { label: "Inteligência", items: [
    { href: "/financial-health", label: "Saúde financeira", icon: HeartPulse },
    { href: "/insights", label: "Insights", icon: Lightbulb },
    { href: "/reports", label: "Relatórios", icon: FileChartColumn },
  ] },
  { label: "Dados", items: [{ href: "/imports", label: "Importações", icon: Import }] },
];

const frequent = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ReceiptText },
  { href: "/budgets", label: "Orçamentos", icon: ChartNoAxesCombined },
  { href: "/insights", label: "Insights", icon: Lightbulb },
];

function AtlasMark() {
  return <span className="atlas-mark" aria-hidden="true"><span /></span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => { void useAuth.getState().bootstrap(); }, []);
  useEffect(() => {
    if (auth.status === "unauthenticated" || auth.status === "expired") {
      router.replace(`/login?next=${encodeURIComponent(path)}`);
    }
  }, [auth.status, path, router]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  if (auth.status === "loading") {
    return <div className="app-loading" aria-busy="true" aria-label="Carregando sua área financeira"><div className="skeleton" /><div className="skeleton" /></div>;
  }

  const nav = <>
    <div className="brand"><AtlasMark /><strong>Atlas Finance</strong><button className="drawer-close" aria-label="Fechar menu" onClick={() => setOpen(false)}><X /></button></div>
    <nav aria-label="Navegação principal">
      {groups.map((group) => <section key={group.label} aria-labelledby={`nav-${group.label}`}>
        <span id={`nav-${group.label}`}>{group.label}</span>
        {group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={path.startsWith(href) ? "page" : undefined} className={path.startsWith(href) ? "active" : ""}><Icon aria-hidden="true" />{label}</Link>)}
      </section>)}
    </nav>
    <div className="nav-footer">
      <Link href="/settings" className={path.startsWith("/settings") ? "active" : ""}><Settings aria-hidden="true" />Configurações</Link>
      <button className="logout" onClick={async () => { await auth.logout(); router.replace("/login"); }}><LogOut aria-hidden="true" />Sair</button>
    </div>
  </>;

  return <div className="shell">
    <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
    <aside>{nav}</aside>
    {open && <><button className="drawer-scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} /><div className="mobile-drawer">{nav}</div></>}
    <main>
      <header className="app-header">
        <button className="menu icon-button" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
        <div className="app-context"><strong>Atlas</strong><small>Finanças claras, decisões seguras.</small></div>
      </header>
      <div className="content" id="main-content" tabIndex={-1}>{children}</div>
    </main>
    <nav className="bottom" aria-label="Navegação rápida">
      {frequent.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined} className={path.startsWith(href) ? "active" : ""}><Icon /><span>{label}</span></Link>)}
      <button onClick={() => setOpen(true)} aria-label="Abrir mais opções"><Menu /><span>Mais</span></button>
    </nav>
    <style jsx global>{`
      .shell{min-height:100dvh;display:grid;grid-template-columns:252px minmax(0,1fr)}
      .shell>aside,.mobile-drawer{background:var(--nav);color:#fff;padding:22px 14px;display:flex;flex-direction:column}
      .brand{height:46px;display:flex;align-items:center;gap:11px;padding:0 10px;font-size:17px;letter-spacing:-.02em}
      .atlas-mark{width:23px;height:28px;display:grid;place-items:center;transform:rotate(45deg);border-radius:5px;background:linear-gradient(135deg,#25b88b,#0b715c);position:relative;overflow:hidden}
      .atlas-mark span{width:1px;height:34px;background:#a4e4cf;opacity:.7;transform:rotate(-18deg)}
      .drawer-close{display:none;background:none;border:0;color:#fff;margin-left:auto;cursor:pointer}.drawer-close svg{width:20px}
      .shell nav section{margin-top:21px}.shell nav section>span{display:block;padding:0 10px 7px;color:#8eb1ae;font-size:10px;text-transform:uppercase;letter-spacing:.09em}
      .shell nav a,.nav-footer a,.nav-footer button{display:flex;align-items:center;gap:11px;min-height:40px;padding:0 11px;color:#d8e7e4;text-decoration:none;border-radius:var(--radius-sm);font-size:13px;border:0;width:100%;background:transparent;cursor:pointer}
      .shell nav a svg,.nav-footer svg{width:17px;height:17px;stroke-width:1.8}.shell nav a:hover,.shell nav a.active,.nav-footer a.active{background:var(--nav-hover);color:#fff}
      .nav-footer{margin-top:auto;border-top:1px solid #255054;padding-top:12px}.logout{margin-top:3px}
      .shell main{min-width:0}.app-header{height:70px;padding:0 30px;background:rgb(255 255 255/.82);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);display:flex;align-items:center;position:sticky;top:0;z-index:20}
      .app-context{display:flex;flex-direction:column}.app-context strong{font-size:14px}.app-context small{color:var(--muted);margin-top:2px;font-size:12px}.content{padding:30px clamp(22px,3vw,46px) 50px;max-width:1580px;margin:auto;outline:none}
      .menu,.mobile-drawer,.bottom,.drawer-scrim{display:none}.app-loading{padding:32px;display:grid;gap:16px}.app-loading .skeleton:first-child{height:130px}
      @media(max-width:900px){
        .shell{display:block;padding-bottom:calc(72px + env(safe-area-inset-bottom))}.shell>aside{display:none}.app-header{height:calc(62px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 15px 0}.menu{display:inline-grid;margin-right:8px}.content{padding:22px 16px 36px}
        .drawer-scrim{display:block;position:fixed;inset:0;z-index:49;border:0;background:rgb(0 25 27/.54)}.mobile-drawer{display:flex;position:fixed;inset:0 18% 0 0;z-index:50;padding-top:max(22px,env(safe-area-inset-top));padding-bottom:max(22px,env(safe-area-inset-bottom));box-shadow:20px 0 50px rgb(0 21 24/.25);overflow:auto;overscroll-behavior:contain}.mobile-drawer .drawer-close{display:block}
        .bottom{display:flex;position:fixed;z-index:40;bottom:0;left:0;right:0;height:calc(72px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:rgb(255 255 255/.96);border-top:1px solid var(--border);justify-content:space-around}
        .bottom a,.bottom button{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;color:var(--muted);text-decoration:none;border:0;background:none;font-size:10px;min-width:0;min-height:44px}.bottom a.active{color:var(--atlas);background:transparent}.bottom svg{width:19px;height:19px}.bottom span{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:10px;white-space:nowrap}
      }
      @media(max-width:340px){.bottom span{font-size:9px}.content{padding-inline:12px}.mobile-drawer{right:10%}}
    `}</style>
  </div>;
}
