import { redirect } from "next/navigation";
import { entrar } from "@/app/actions";
import ConfigFaltando from "@/components/ConfigFaltando";
import { lerConfig } from "@/lib/config";
import { sessaoValida } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const conf = lerConfig();
  if (!conf.ok) return <ConfigFaltando faltando={conf.faltando} />;
  if (await sessaoValida(conf.cfg.senha)) redirect("/");

  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold">Hub Verbas</h1>
      <p className="mb-6 text-sm text-slate-600">Digite a senha para continuar.</p>
      <form action={entrar} className="card space-y-4">
        {erro === "bloqueado" && <p className="alerta-erro">Muitas tentativas. Aguarde 15 minutos.</p>}
        {erro === "1" && <p className="alerta-erro">Senha incorreta.</p>}
        <div>
          <label className="label" htmlFor="senha">Senha</label>
          <input className="input" id="senha" name="senha" type="password" required autoFocus autoComplete="current-password" />
        </div>
        <button className="btn w-full" type="submit">Entrar</button>
      </form>
    </main>
  );
}
