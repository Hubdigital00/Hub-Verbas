"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ClickUpError, campoVerbaId, comentar, gravarVerba, lerTarefa, mensagemErro, valorDoCampo } from "@/lib/clickup";
import { lerConfig } from "@/lib/config";
import { arredondar, lerValor, moeda, valorPermitido } from "@/lib/formato";
import { criarSessao, encerrarSessao, senhaCorreta, sessaoValida } from "@/lib/sessao";

/* ------------------------------- Login ------------------------------- */

// Trava simples por IP: 5 erros => 15 minutos bloqueado (memória do processo).
const tentativas = new Map<string, { n: number; ate: number }>();
const MAX_ERROS = 5;
const BLOQUEIO_MS = 15 * 60_000;

export async function entrar(formData: FormData) {
  const conf = lerConfig();
  if (!conf.ok) redirect("/login");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const agora = Date.now();
  const t = tentativas.get(ip);
  if (t && t.ate > agora && t.n >= MAX_ERROS) redirect("/login?erro=bloqueado");

  if (!senhaCorreta(String(formData.get("senha") ?? ""), conf.cfg.senha)) {
    const atual = t && t.ate > agora ? t : { n: 0, ate: agora + BLOQUEIO_MS };
    tentativas.set(ip, { n: atual.n + 1, ate: atual.ate });
    redirect("/login?erro=1");
  }
  tentativas.delete(ip);
  await criarSessao(conf.cfg.senha);
  redirect("/");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}

/* ------------------------------- Salvar ------------------------------- */

export type ResultadoSalvar = { ok: boolean; anterior: number | null; mensagem: string };

/**
 * Grava a verba de UM cliente (o navegador chama um por vez, para mostrar o progresso
 * e não estourar tempo de requisição). Valida sessão, valor e se a tarefa é da lista.
 */
export async function salvarVerba(taskId: string, novoTxt: string): Promise<ResultadoSalvar> {
  const falha = (mensagem: string): ResultadoSalvar => ({ ok: false, anterior: null, mensagem });

  const conf = lerConfig();
  if (!conf.ok) return falha("Configuração incompleta no servidor.");
  const { cfg } = conf;
  if (!(await sessaoValida(cfg.senha))) return falha("Sessão expirada. Recarregue a página e entre novamente.");
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(taskId)) return falha("ID de tarefa inválido.");

  const lido = lerValor(novoTxt);
  if (lido === null || !valorPermitido(lido)) return falha("Valor inválido. Use um formato como 1.234,56.");
  const novo = arredondar(lido);

  try {
    const fieldId = await campoVerbaId(cfg);
    const tarefa = await lerTarefa(cfg, taskId);
    if (tarefa.list?.id !== cfg.listId) throw new ClickUpError("Esta tarefa não pertence à lista configurada.");
    const anterior = valorDoCampo(tarefa, fieldId);

    await gravarVerba(cfg, taskId, fieldId, novo);

    // O comentário é um extra: se falhar, a verba já foi gravada.
    try {
      await comentar(
        cfg,
        taskId,
        `${cfg.campo} atualizada pelo Hub Verbas: ${anterior === null ? "sem valor" : moeda(anterior)} → ${moeda(novo)}`,
      );
      return { ok: true, anterior, mensagem: "Gravado e comentado." };
    } catch {
      return { ok: true, anterior, mensagem: "Gravado, mas não foi possível criar o comentário." };
    }
  } catch (e) {
    return falha(mensagemErro(e));
  }
}
