import { redirect } from "next/navigation";
import { sair } from "@/app/actions";
import ConfigFaltando from "@/components/ConfigFaltando";
import Tabela from "@/components/Tabela";
import { ClickUpError, listarClientes, mensagemErro } from "@/lib/clickup";
import { lerConfig } from "@/lib/config";
import { sessaoValida } from "@/lib/sessao";
import type { Cliente } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function Principal() {
  const conf = lerConfig();
  if (!conf.ok) return <ConfigFaltando faltando={conf.faltando} />;
  if (!(await sessaoValida(conf.cfg.senha))) redirect("/login");

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
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Hub Verbas</h1>
          <p className="text-sm text-slate-600">Campo: {conf.cfg.campo}</p>
        </div>
        <form action={sair}>
          <button className="btn-sec" type="submit">Sair</button>
        </form>
      </header>
      {erro ? (
        <p className="alerta-erro">Não foi possível carregar os clientes do ClickUp. {erro}</p>
      ) : (
        <Tabela clientesIniciais={clientes} campo={conf.cfg.campo} />
      )}
    </div>
  );
}
