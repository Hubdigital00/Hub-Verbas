"use client";

import { useEffect, useMemo, useState } from "react";
import { casarCliente, extrairContas, normalizar } from "@/lib/criativivo";
import { moeda } from "@/lib/formato";
import type { Cliente } from "@/lib/tipos";

const CHAVE = "hub-verbas:vinculos-criativivo";

function lerVinculos(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function gravarVinculos(v: Record<string, string>) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(v));
  } catch {
    /* sem localStorage: segue sem lembrar */
  }
}

const paraCampo = (n: number) => Math.max(0, n).toFixed(2).replace(".", ",");

export default function ColarCriativivo({
  clientes,
  disabled,
  onAplicar,
}: {
  clientes: Cliente[];
  disabled: boolean;
  onAplicar: (valores: Record<string, string>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [usarBruto, setUsarBruto] = useState(false);
  const [vinculos, setVinculos] = useState<Record<string, string>>({});
  const [manual, setManual] = useState<Record<string, string>>({}); // id da conta -> taskId

  useEffect(() => {
    if (aberto) setVinculos(lerVinculos());
  }, [aberto]);

  const contas = useMemo(() => extrairContas(texto), [texto]);

  // Escolha manual > vínculo salvo/nome. Cada cliente recebe no máximo uma conta.
  const resolvidas = useMemo(() => {
    const usados = new Set<string>();
    return contas.map((conta) => {
      const escolha = manual[conta.id];
      let taskId: string | null = escolha === "" ? null : escolha ?? casarCliente(conta, clientes, vinculos);
      let aviso: string | null = null;
      if (taskId && usados.has(taskId)) {
        taskId = null;
        aviso = "O cliente já foi usado por outra conta.";
      }
      if (taskId) usados.add(taskId);
      const saldo = usarBruto ? conta.bruto ?? conta.liquido : conta.liquido;
      return { conta, taskId, saldo, aviso };
    });
  }, [contas, manual, clientes, vinculos, usarBruto]);

  const casadas = resolvidas.filter((r) => r.taskId && r.saldo !== null);
  const semSaldo = resolvidas.filter((r) => r.saldo === null);
  const sem = resolvidas.filter((r) => !r.taskId);
  const usadosIds = new Set(resolvidas.map((r) => r.taskId).filter(Boolean));
  const clientesSemConta = clientes.filter((c) => !usadosIds.has(c.taskId));
  const ordenados = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  function aplicar() {
    const out: Record<string, string> = {};
    const novos = { ...vinculos };
    for (const r of casadas) out[r.taskId!] = paraCampo(r.saldo!);
    for (const r of resolvidas) {
      if (r.taskId && manual[r.conta.id]) novos[normalizar(r.conta.nome)] = r.taskId;
    }
    gravarVinculos(novos);
    onAplicar(out);
    setAberto(false);
    setTexto("");
    setManual({});
  }

  return (
    <>
      <button className="btn-sec" type="button" disabled={disabled} onClick={() => setAberto(true)}>
        Colar da Criativivo
      </button>
      {aberto && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-overlay p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-colar">
          <div className="card max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto">
            <h2 id="titulo-colar" className="text-lg font-semibold">Colar da Criativivo</h2>
            <p className="text-xs text-texto-suave">
              O texto é lido aqui no navegador; nada é enviado a outro servidor. Nada é gravado no ClickUp nesta etapa.
            </p>
            <textarea
              className="input h-48 font-mono text-xs"
              placeholder="Cole aqui o texto da página de contas de anúncios da Criativivo"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={!usarBruto} onChange={() => setUsarBruto(false)} /> Saldo líquido (com desconto de impostos)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={usarBruto} onChange={() => setUsarBruto(true)} /> Saldo bruto
              </label>
            </div>

            {texto.trim() && contas.length === 0 && (
              <p className="alerta-aviso">Nenhuma conta encontrada. Confira se o texto traz as linhas "ID: …" e "Saldo disponível: …".</p>
            )}

            {casadas.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Contas casadas ({casadas.length})</h3>
                <ul className="divide-y divide-borda text-sm">
                  {casadas.map((r) => {
                    const c = clientes.find((x) => x.taskId === r.taskId)!;
                    return (
                      <li key={r.conta.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                        <span>
                          <span className="font-medium">{c.nome}</span>{" "}
                          <span className="text-xs text-texto-suave">(Criativivo: {r.conta.nome})</span>
                        </span>
                        <span>
                          {c.verbaAtual !== null ? moeda(c.verbaAtual) : "sem valor"} → <strong>{moeda(Math.max(0, r.saldo!))}</strong>
                          {r.saldo! < 0 && <span className="ml-1 text-xs text-amber-700">(saldo {moeda(r.saldo!)}; lançado como zero)</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {sem.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Sem correspondência ({sem.length})</h3>
                <ul className="divide-y divide-borda text-sm">
                  {sem.map((r) => (
                    <li key={r.conta.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span>
                        {r.conta.nome || "(sem nome)"}{" "}
                        <span className="text-xs text-texto-suave">
                          ID {r.conta.id} · {r.saldo !== null ? moeda(r.saldo) : "sem saldo"}
                        </span>
                        {r.aviso && <span className="block text-xs text-amber-700">{r.aviso}</span>}
                      </span>
                      <select
                        className="input w-56"
                        aria-label={`Cliente para ${r.conta.nome}`}
                        value={manual[r.conta.id] ?? ""}
                        onChange={(e) => setManual((m) => ({ ...m, [r.conta.id]: e.target.value }))}
                      >
                        <option value="">Escolher cliente…</option>
                        {ordenados.map((c) => (
                          <option key={c.taskId} value={c.taskId} disabled={usadosIds.has(c.taskId)}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {semSaldo.length > 0 && (
              <p className="alerta-aviso">
                Sem "Saldo disponível" no texto (não serão aplicadas): {semSaldo.map((r) => r.conta.nome || r.conta.id).join(", ")}.
              </p>
            )}

            {contas.length > 0 && clientesSemConta.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Clientes sem saldo da Criativivo ({clientesSemConta.length})</h3>
                <p className="text-sm text-texto-suave">{clientesSemConta.map((c) => c.nome).join(", ")}</p>
              </section>
            )}

            <div className="flex justify-end gap-2">
              <button className="btn-sec" type="button" onClick={() => setAberto(false)}>Cancelar</button>
              <button className="btn" type="button" disabled={casadas.length === 0} onClick={aplicar}>
                Aplicar{casadas.length ? ` (${casadas.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
