import { redirect } from "next/navigation";
import { entrar } from "@/app/actions";
import ConfigFaltando from "@/components/ConfigFaltando";
import { lerConfig } from "@/lib/config";
import { sessaoValida } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const conf = lerConfig();
  if (!conf.ok) return <ConfigFaltando faltando={conf.faltando} />;
  if (await sessaoValida(conf.cfg.senha)) redirect("/?inicio=1");

  const { erro } = await searchParams;
  return (
    <main className="min-h-screen bg-primaria px-4">
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center">
        <img src="/logo-branca.png" alt="Hub Verbas" width={200} height={107} className="mx-auto mb-6 h-auto w-[200px] max-w-full" />
        <div className="card">
          <h1 className="mb-1 text-2xl font-semibold">Hub Verbas</h1>
          <p className="mb-6 text-sm text-texto-suave">Digite a senha para continuar.</p>
          <form action={entrar} className="space-y-4">
            {erro === "bloqueado" && <p className="alerta-erro">Muitas tentativas. Aguarde 15 minutos.</p>}
            {erro === "1" && <p className="alerta-erro">Senha incorreta.</p>}
            <div>
              <label className="label" htmlFor="senha">Senha</label>
              <input className="input" id="senha" name="senha" type="password" required autoFocus autoComplete="current-password" />
            </div>
            <button className="btn w-full" type="submit">Entrar</button>
          </form>
        </div>
      </div>
    </main>
  );
}
