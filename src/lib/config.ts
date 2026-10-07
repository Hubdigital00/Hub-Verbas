import "server-only";

export type Config = { token: string; listId: string; campo: string; senha: string };

const OBRIGATORIAS = ["CLICKUP_TOKEN", "CLICKUP_LIST_ID", "APP_PASSWORD"] as const;

/** Aceita o ID (901323557283) ou a URL colada da lista (…/v/li/901323557283?pr=…). */
export function extrairListId(valor: string): string {
  const v = valor.trim();
  if (/^\d+$/.test(v)) return v;
  const m = v.match(/\/(?:li|l)\/(\d+)/) ?? v.match(/(\d+)\/?(?:[?#].*)?$/);
  return m ? m[1] : v;
}

/** Lê as variáveis de ambiente sem quebrar: devolve a lista do que está faltando. */
export function lerConfig(): { ok: true; cfg: Config } | { ok: false; faltando: string[] } {
  const faltando = OBRIGATORIAS.filter((n) => !process.env[n]?.trim()) as string[];
  if (faltando.length) return { ok: false, faltando };
  return {
    ok: true,
    cfg: {
      token: process.env.CLICKUP_TOKEN!.trim(),
      listId: extrairListId(process.env.CLICKUP_LIST_ID!),
      campo: process.env.CLICKUP_CAMPO_VERBA?.trim() || "Verba Atual 2.0",
      senha: process.env.APP_PASSWORD!,
    },
  };
}
