"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarVerba } from "@/app/actions";
import { arredondar, lerValor, moeda, valorPermitido } from "@/lib/formato";
import ColarCriativivo from "@/components/ColarCriativivo";
import type { Cliente } from "@/lib/tipos";

type FiltroPag = "todos" | "pix" | "boleto" | "cartao";
const FILTROS: { id: FiltroPag; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "pix", rotulo: "PIX" },
  { id: "boleto", rotulo: "Boleto" },
  { id: "cartao", rotulo: "Cartão" },
];

const COR_PAGAMENTO: Record<string, string> = {
  pix: "bg-sky-100 text-sky-900",
  boleto: "bg-pink-100 text-pink-900",
  cartao: "bg-purple-100 text-purple-900",
};

function SeloPagamento({ nome }: { nome: string | null }) {
  if (!nome) return <span className="text-texto-suave">—</span>;
  const cor = COR_PAGAMENTO[semAcento(nome)] ?? "bg-primaria-suave text-texto";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cor}`}>{nome}</span>;
}

type Estado = { fase: "enviando" | "ok" | "erro"; msg: string };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Tabela({ clientesIniciais, campo }: { clientesIniciais: Cliente[]; campo: string }) {
  const router = useRouter();
  const [clientes, setClientes] = useState(clientesIniciais);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, Estado>>({});
  const [busca, setBusca] = useState("");
  const [filtroPag, setFiltroPag] = useState<FiltroPag>("todos");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const tabela = useRef<HTMLTableElement>(null);

  // Estado de cada linha: sem alteração, inválida ou alterada.
  const linhas = useMemo(
    () =>
      clientes.map((c) => {
        const txt = (valores[c.taskId] ?? "").trim();
        const n = txt ? lerValor(txt) : null;
        const invalido = txt !== "" && (n === null || !valorPermitido(n));
        const novo = !invalido && n !== null ? arredondar(n) : null;
        return { c, txt, invalido, novo, alterado: novo !== null && novo !== c.verbaAtual };
      }),
    [clientes, valores],
  );
  const alterados = linhas.filter((l) => l.alterado);
  const invalidos = linhas.filter((l) => l.invalido);
  const filtro = semAcento(busca.trim());
  const visiveis = linhas.filter(
    (l) => (!filtro || semAcento(l.c.nome).includes(filtro)) && (filtroPag === "todos" || semAcento(l.c.pagamento ?? "") === filtroPag),
  );

  // Enter pula para a próxima caixa de verba (Tab já segue a ordem da tela).
  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const campos = Array.from(tabela.current?.querySelectorAll<HTMLInputElement>("input[data-verba]") ?? []);
    campos[campos.indexOf(e.currentTarget) + 1]?.focus();
  }

  async function confirmar() {
    const lista = alterados.map((l) => ({ id: l.c.taskId, txt: l.txt }));
    setConfirmando(false);
    setEnviando(true);
    setResumo(null);
    let ok = 0;
    let erro = 0;
    for (const item of lista) {
      setStatus((s) => ({ ...s, [item.id]: { fase: "enviando", msg: "Enviando…" } }));
      let r;
      try {
        r = await salvarVerba(item.id, item.txt);
      } catch {
        r = { ok: false, anterior: null, mensagem: "Falha de comunicação com o servidor." };
      }
      setStatus((s) => ({ ...s, [item.id]: { fase: r.ok ? "ok" : "erro", msg: r.mensagem } }));
      if (r.ok) {
        ok++;
        const novo = arredondar(lerValor(item.txt) ?? 0);
        setClientes((cs) => cs.map((c) => (c.taskId === item.id ? { ...c, verbaAtual: novo } : c)));
        setValores((v) => ({ ...v, [item.id]: "" }));
      } else erro++;
    }
    setEnviando(false);
    setResumo(`${ok} gravado(s) com sucesso${erro ? `, ${erro} com erro (os valores continuam digitados para nova tentativa)` : ""}.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-72">
          <label className="label" htmlFor="busca">Buscar cliente</label>
          <input className="input" id="busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do cliente" />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-sec" type="button" disabled={enviando} onClick={() => router.refresh()}>Recarregar do ClickUp</button>
          <ColarCriativivo clientes={clientes} disabled={enviando} onAplicar={(v) => setValores((x) => ({ ...x, ...v }))} />
          <button className="btn" type="button" disabled={enviando || alterados.length === 0 || invalidos.length > 0} onClick={() => setConfirmando(true)}>
            {enviando ? "Salvando…" : `Salvar tudo${alterados.length ? ` (${alterados.length})` : ""}`}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por forma de pagamento">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtroPag === f.id}
            onClick={() => setFiltroPag(f.id)}
            className={filtroPag === f.id ? "btn" : "btn-sec"}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {invalidos.length > 0 && (
        <p className="alerta-erro">
          Valor inválido em: {invalidos.map((l) => l.c.nome).join(", ")}. Use um formato como 1.234,56.
        </p>
      )}
      {resumo && <p className={resumo.includes("erro") ? "alerta-aviso" : "alerta-ok"}>{resumo}</p>}

      <div className="card overflow-x-auto p-0">
        <table ref={tabela} className="w-full min-w-[820px] text-left max-[700px]:min-w-0 text-sm">
          <thead className="border-b border-borda bg-primaria text-fundo">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-2">Pagamento</th>
              <th className="max-[700px]:hidden">Plataforma</th>
              <th className="text-right max-[700px]:hidden">Valor mensal</th>
              <th className="text-right">{campo}</th>
              <th className="w-44 px-3">Nova verba</th>
              <th className="px-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map(({ c, invalido, alterado }) => {
              const st = status[c.taskId];
              return (
                <tr key={c.taskId} className={`border-b border-borda last:border-0 ${alterado ? "bg-primaria-suave" : ""}`}>
                  <td className="px-4 py-2 font-medium">{c.nome}</td>
                  <td className="px-2"><SeloPagamento nome={c.pagamento} /></td>
                  <td className="max-[700px]:hidden">{c.plataforma ?? "—"}</td>
                  <td className="text-right max-[700px]:hidden">{c.valorMensal !== null ? moeda(c.valorMensal) : "—"}</td>
                  <td className="text-right">{c.verbaAtual !== null ? moeda(c.verbaAtual) : "—"}</td>
                  <td className="px-3 py-1.5">
                    <input
                      data-verba
                      className={`input text-right ${invalido ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Nova verba de ${c.nome}`}
                      aria-invalid={invalido}
                      placeholder="0,00"
                      disabled={enviando}
                      value={valores[c.taskId] ?? ""}
                      onChange={(e) => setValores((v) => ({ ...v, [c.taskId]: e.target.value }))}
                      onKeyDown={aoTeclar}
                    />
                  </td>
                  <td className="px-3 text-xs">
                    {st ? (
                      <span className={st.fase === "ok" ? "text-green-700" : st.fase === "erro" ? "text-red-700" : "text-texto-suave"}>
                        {st.fase === "ok" ? "✓ " : st.fase === "erro" ? "✗ " : ""}
                        {st.msg}
                      </span>
                    ) : alterado ? (
                      <span className="text-primaria">Alterado</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {visiveis.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-texto-suave">{clientes.length ? "Nenhum cliente encontrado." : "Nenhuma tarefa na lista."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-overlay p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-conf">
          <div className="card max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto">
            <h2 id="titulo-conf" className="text-lg font-semibold">Confirmar {alterados.length} alteração(ões)</h2>
            <ul className="divide-y divide-borda text-sm">
              {alterados.map((l) => (
                <li key={l.c.taskId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{l.c.nome}</span>
                  <span>
                    {l.c.verbaAtual !== null ? moeda(l.c.verbaAtual) : "sem valor"} → <strong>{moeda(l.novo!)}</strong>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-texto-suave">Cada valor será gravado no campo "{campo}" do ClickUp, com um comentário na tarefa.</p>
            <div className="flex justify-end gap-2">
              <button className="btn-sec" onClick={() => setConfirmando(false)}>Cancelar</button>
              <button className="btn" onClick={confirmar} autoFocus>Confirmar e gravar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
