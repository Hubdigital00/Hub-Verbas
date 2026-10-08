const AJUDA: Record<string, string> = {
  CLICKUP_TOKEN: "token pessoal do ClickUp (Configurações > Apps > Token de API)",
  CLICKUP_LIST_ID: "ID da lista CONTROLE DE VERBA (número na URL da lista)",
  APP_PASSWORD: "senha única de acesso ao sistema",
};

export default function ConfigFaltando({ faltando }: { faltando: string[] }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <div className="card space-y-3">
        <h1 className="text-lg font-semibold">Configuração incompleta</h1>
        <p className="text-sm text-texto-suave">
          O servidor não encontrou {faltando.length === 1 ? "esta variável" : "estas variáveis"} de ambiente:
        </p>
        <ul className="space-y-1 text-sm">
          {faltando.map((n) => (
            <li key={n}>
              <code className="rounded bg-primaria-suave px-1.5 py-0.5">{n}</code>
              <span className="text-texto-suave"> — {AJUDA[n] ?? "obrigatória"}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-texto-suave">
          Em desenvolvimento, defina no arquivo <code>.env.local</code> (na raiz do projeto) e reinicie. Na Hostinger,
          defina no hPanel e refaça o deploy. Veja o <code>.env.example</code>.
        </p>
      </div>
    </main>
  );
}
