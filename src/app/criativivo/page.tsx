import Link from "next/link";
import { redirect } from "next/navigation";
import { sair } from "@/app/actions";
import MemorizarTela from "@/components/MemorizarTela";
import ConfigFaltando from "@/components/ConfigFaltando";
import Tabela from "@/components/Tabela";
import { ClickUpError, listarClientes, mensagemErro } from "@/lib/clickup";
import { lerConfig } from "@/lib/config";
import { sessaoValida } from "@/lib/sessao";
import type { Cliente } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const SITE = "https://criativivo.com.br";

/** O navegador não deixa ler se o iframe foi recusado; por isso checamos os cabeçalhos do site no servidor. */
async function siteBloqueiaIframe(): Promise<boolean> {
  try {
    const r = await fetch(SITE, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000), cache: "no-store" });
    const xfo = r.headers.get("x-frame-options")?.toLowerCase() ?? "";
    const csp = r.headers.get("content-security-policy")?.toLowerCase() ?? "";
    const fa = csp.match(/frame-ancestors([^;]*)/)?.[1] ?? "";
    return xfo.includes("deny") || xfo.includes("sameorigin") || (fa !== "" && !fa.includes("*"));
  } catch {
    return false; // não deu para verificar: tenta exibir mesmo assim
  }
}

export default async function Criativivo() {
  const conf = lerConfig();
  if (!conf.ok) return <ConfigFaltando faltando={conf.faltando} />;
  if (!(await sessaoValida(conf.cfg.senha))) redirect("/login");

  let clientes: Cliente[] = [];
  let erro: string | null = null;
  try {
    clientes = await listarClientes(conf.cfg);
  } catch (e) {
    erro = mensagemErro(e);
    if (!(e instanceof ClickUpError)) console.error("[criativivo]", e);
  }
  const bloqueado = await siteBloqueiaIframe();

  return (
    <div className="flex h-screen flex-col px-4 py-4">
      <MemorizarTela tela="criativivo" />
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0">
            <img src="/logo.png" alt="Hub Verbas" width={75} height={40} className="h-8 w-auto sm:h-10" />
          </Link>
          <div className="min-w-0">
          <h1 className="text-xl font-semibold"><span className="sr-only">Hub Verbas · </span>Criativivo</h1>
          <p className="text-sm text-texto-suave">Campo: {conf.cfg.campo}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="btn min-h-11">Só a lista (tela cheia)</Link>
          <form action={sair}>
            <button className="btn-sec min-h-11" type="submit">Sair</button>
          </form>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="min-h-0 overflow-y-auto">
          {erro ? (
            <p className="alerta-erro">Não foi possível carregar os clientes do ClickUp. {erro}</p>
          ) : (
            <Tabela clientesIniciais={clientes} campo={conf.cfg.campo} />
          )}
        </section>
        <section className="flex h-[70vh] min-h-0 flex-col overflow-hidden rounded border border-borda bg-superficie lg:h-auto">
          {bloqueado ? (
            <div className="m-auto max-w-sm p-6 text-center">
              <p className="mb-2 font-semibold">A Criativivo não permite ser exibida dentro do Hub.</p>
              <p className="mb-4 text-sm text-texto-suave">O site recusa abrir em quadro embutido. Abra em outra aba para usá-lo normalmente.</p>
              <a className="btn" href={SITE} target="_blank" rel="noopener noreferrer">Abrir a Criativivo em outra aba</a>
            </div>
          ) : (
            <>
              <iframe src={SITE} title="Criativivo" className="min-h-0 w-full flex-1" referrerPolicy="no-referrer" />
              <p className="border-t border-borda p-2 text-center text-xs text-texto-suave">
                Em branco ou com erro?{" "}
                <a className="underline" href={SITE} target="_blank" rel="noopener noreferrer">Abrir a Criativivo em outra aba</a>
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
