import "server-only";
import type { Config } from "./config";
import type { Cliente } from "./tipos";

const BASE = "https://api.clickup.com/api/v2";

export class ClickUpError extends Error {
  constructor(
    mensagem: string,
    public status?: number,
  ) {
    super(mensagem);
  }
}

export const mensagemErro = (e: unknown) =>
  e instanceof ClickUpError ? e.message : "Erro inesperado ao falar com o ClickUp.";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

async function chamar<T>(cfg: Config, caminho: string, init: RequestInit = {}, tentativa = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + caminho, {
      ...init,
      headers: { Authorization: cfg.token, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ClickUpError("Não foi possível conectar ao ClickUp (tempo esgotado ou sem rede).");
  }

  // Limite de requisições (~100/min): espera até o reset informado e tenta de novo.
  if (res.status === 429 && tentativa < 4) {
    const reset = Number(res.headers.get("x-ratelimit-reset")); // epoch em segundos
    const espera = reset ? Math.min(Math.max(reset * 1000 - Date.now() + 500, 1500), 30_000) : 3000 * (tentativa + 1);
    await dormir(espera);
    return chamar<T>(cfg, caminho, init, tentativa + 1);
  }

  if (!res.ok) {
    // Diagnóstico no terminal do servidor: método, URL (sem token), status e corpo do erro.
    const corpo = (await res.text().catch(() => "")).slice(0, 500);
    console.error(`[clickup] ${init.method ?? "GET"} ${BASE}${caminho} -> HTTP ${res.status} ${corpo}`);
    const msg: Record<number, string> = {
      401: "Token do ClickUp inválido ou expirado.",
      403: "Sem permissão no ClickUp para este recurso.",
      404: "Tarefa, lista ou campo não encontrado no ClickUp.",
      429: "Limite de requisições do ClickUp atingido. Aguarde um minuto e tente novamente.",
    };
    throw new ClickUpError(msg[res.status] ?? `Erro do ClickUp (HTTP ${res.status}).`, res.status);
  }
  return (await res.json()) as T;
}

type Opcao = { id?: string; name?: string; label?: string; orderindex?: number };
type CampoTarefa = {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  type_config?: { options?: Opcao[] };
};
type Tarefa = { id: string; name: string; list?: { id: string }; custom_fields?: CampoTarefa[] };

/* ----------------------------- field_id (cache) ----------------------------- */

const cacheCampo = new Map<string, { id: string; ate: number }>();

/** Descobre o field_id pelo nome do campo via GET /list/{id}/field. */
export async function campoVerbaId(cfg: Config): Promise<string> {
  const chave = `${cfg.listId}:${normalizar(cfg.campo)}`;
  const hit = cacheCampo.get(chave);
  if (hit && hit.ate > Date.now()) return hit.id;

  const { fields } = await chamar<{ fields: { id: string; name: string; type: string }[] }>(
    cfg,
    `/list/${encodeURIComponent(cfg.listId)}/field`,
  );
  const campo = fields.find((f) => normalizar(f.name) === normalizar(cfg.campo));
  if (!campo) {
    throw new ClickUpError(
      `Campo "${cfg.campo}" não encontrado na lista. Campos existentes: ${fields.map((f) => f.name).join(", ") || "nenhum"}.`,
    );
  }
  if (!["currency", "number"].includes(campo.type)) {
    throw new ClickUpError(`O campo "${cfg.campo}" é do tipo "${campo.type}"; precisa ser Número ou Moeda.`);
  }
  cacheCampo.set(chave, { id: campo.id, ate: Date.now() + 10 * 60_000 });
  return campo.id;
}

/** Campo de forma de pagamento (somente leitura): id e opções, descobertos pelo nome em GET /list/{id}/field. */
async function campoPagamento(cfg: Config): Promise<{ id: string; opcoes: Opcao[] } | null> {
  const chave = `${cfg.listId}:${normalizar(cfg.campoPagamento)}`;
  const hit = cachePagamento.get(chave);
  if (hit && hit.ate > Date.now()) return hit.campo;
  let campo: { id: string; opcoes: Opcao[] } | null = null;
  try {
    const { fields } = await chamar<{ fields: { id: string; name: string; type: string; type_config?: { options?: Opcao[] } }[] }>(
      cfg,
      `/list/${encodeURIComponent(cfg.listId)}/field`,
    );
    const f = fields.find((x) => normalizar(x.name) === normalizar(cfg.campoPagamento));
    if (f) campo = { id: f.id, opcoes: f.type_config?.options ?? [] };
  } catch {
    // Pagamento é informação extra: se falhar, a tabela segue sem a coluna preenchida.
  }
  cachePagamento.set(chave, { campo, ate: Date.now() + 10 * 60_000 });
  return campo;
}

const cachePagamento = new Map<string, { campo: { id: string; opcoes: Opcao[] } | null; ate: number }>();

/** Nome da opção do drop_down: a API devolve o orderindex (ou o id) da opção escolhida. */
function pagamentoDaTarefa(t: Tarefa, campo: { id: string; opcoes: Opcao[] } | null): string | null {
  if (!campo) return null;
  const c = t.custom_fields?.find((x) => x.id === campo.id);
  const v = c?.value;
  if (v === undefined || v === null || v === "") return null;
  const opcoes = campo.opcoes.length ? campo.opcoes : (c?.type_config?.options ?? []);
  const o = opcoes.find((x) => x.id === v || (typeof v !== "object" && x.orderindex === Number(v)));
  return o?.name?.trim() || null;
}

/* -------------------------------- leitura -------------------------------- */

const numero = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Texto de um campo (lista suspensa, etiquetas ou texto). */
function texto(c: CampoTarefa | undefined): string | null {
  const v = c?.value;
  if (!c || v === undefined || v === null || v === "") return null;
  const opcoes = c.type_config?.options ?? [];
  if (c.type === "drop_down") {
    const o = opcoes.find((x) => x.orderindex === Number(v) || x.id === v);
    return o?.name ?? null;
  }
  if (c.type === "labels" && Array.isArray(v)) {
    const nomes = v.map((id) => opcoes.find((x) => x.id === id)?.label ?? opcoes.find((x) => x.id === id)?.name).filter(Boolean);
    return nomes.length ? nomes.join(", ") : null;
  }
  return typeof v === "string" ? v : null;
}

const porNome = (t: Tarefa, nome: string) =>
  t.custom_fields?.find((c) => normalizar(c.name) === normalizar(nome));

/** "[CLIENTE] CONTROLE DE VERBA" -> "CLIENTE" */
export function nomeDoCliente(nomeTarefa: string): string {
  const colchetes = nomeTarefa.match(/^\s*\[(.+?)\]/);
  if (colchetes) return colchetes[1].trim();
  return nomeTarefa.replace(/controle de verba/i, "").replace(/[-–:]+\s*$/, "").trim() || nomeTarefa;
}

export const valorDoCampo = (t: Tarefa, fieldId: string) => numero(t.custom_fields?.find((c) => c.id === fieldId)?.value);

/** GET /list/{id}/task com paginação (100 por página). */
export async function listarClientes(cfg: Config): Promise<Cliente[]> {
  const fieldId = await campoVerbaId(cfg);
  const pagto = await campoPagamento(cfg);
  const clientes: Cliente[] = [];
  for (let pagina = 0; pagina < 50; pagina++) {
    const r = await chamar<{ tasks: Tarefa[]; last_page?: boolean }>(
      cfg,
      `/list/${encodeURIComponent(cfg.listId)}/task?page=${pagina}&subtasks=false&include_closed=false`,
    );
    for (const t of r.tasks) {
      clientes.push({
        taskId: t.id,
        nome: nomeDoCliente(t.name),
        plataforma: texto(porNome(t, "Plataforma")),
        pagamento: pagamentoDaTarefa(t, pagto),
        valorMensal: numero(porNome(t, "Valor Mensal")?.value),
        verbaAtual: valorDoCampo(t, fieldId),
      });
    }
    if (r.last_page === true || r.tasks.length === 0 || (r.last_page === undefined && r.tasks.length < 100)) break;
  }
  return clientes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export const lerTarefa = (cfg: Config, taskId: string) => chamar<Tarefa>(cfg, `/task/${encodeURIComponent(taskId)}`);

/* -------------------------------- escrita -------------------------------- */

/** POST /task/{task_id}/field/{field_id} com {"value": número}. */
export async function gravarVerba(cfg: Config, taskId: string, fieldId: string, valor: number): Promise<void> {
  await chamar(cfg, `/task/${encodeURIComponent(taskId)}/field/${encodeURIComponent(fieldId)}`, {
    method: "POST",
    body: JSON.stringify({ value: valor }),
  });
}

export async function comentar(cfg: Config, taskId: string, textoComentario: string): Promise<void> {
  await chamar(cfg, `/task/${encodeURIComponent(taskId)}/comment`, {
    method: "POST",
    body: JSON.stringify({ comment_text: textoComentario, notify_all: false }),
  });
}
