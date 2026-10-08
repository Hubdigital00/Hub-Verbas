import Link from "next/link";
import { redirect } from "next/navigation";
import { sair } from "@/app/actions";
import ConfigFaltando from "@/components/ConfigFaltando";
import MemorizarTela from "@/components/MemorizarTela";
import Tabela from "@/components/Tabela";
import { ClickUpError, listarClientes, mensagemErro } from "@/lib/clickup";
import { lerConfig } from "@/lib/config";
import { sessaoValida } from "@/lib/sessao";
import type { Cliente } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function Principal({ searchParams }: { searchParams: Promise<{ inicio?: string }> }) {
  const conf = lerConfig();
  if (!conf.ok) return <ConfigFaltando faltando={conf.faltando} />;
  if (!(await sessaoValida(conf.cfg.senha))) redirect("/login");

  const { inicio } = await searchParams;
  let clientes: Cliente[] = [];
  let erro: string | null = null;
  try {
    clientes = await listarClientes(conf.cfg);
  } catch (e) {
    erro = mensagemErro(e);
    if (!(e instanceof ClickUpError)) console.error("[principal]", e);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <MemorizarTela tela="painel" aoEntrar={inicio === "1"} />
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0">
            <img src="/logo.png" alt="Hub Verbas" width={75} height={40} className="h-8 w-auto sm:h-10" />
          </Link>
          <div className="min-w-0">
          <h1 className="sr-only">Hub Verbas</h1>
          <p className="text-sm text-texto-suave">Campo: {conf.cfg.campo}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/criativivo" className="btn min-h-11">Abrir Criativivo ao lado</Link>
          <form action={sair}>
            <button className="btn-sec min-h-11" type="submit">Sair</button>
          </form>
        </div>
      </header>
      {erro ? (
        <p className="alerta-erro">Não foi possível carregar os clientes do ClickUp. {erro}</p>
      ) : (
        <Tabela clientesIniciais={clientes} campo={conf.cfg.campo} />
      )}
    </div>
  );
}
