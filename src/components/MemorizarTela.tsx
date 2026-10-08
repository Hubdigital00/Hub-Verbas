"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const CHAVE = "hub-verbas:ultima-tela";
type Tela = "painel" | "criativivo";

/**
 * Guarda no navegador a última tela usada. Com `aoEntrar` (chegada do login), leva direto
 * para a tela guardada; o botão "Só a lista" volta ao painel sem esse parâmetro e não é desviado.
 */
export default function MemorizarTela({ tela, aoEntrar = false }: { tela: Tela; aoEntrar?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    try {
      if (aoEntrar && localStorage.getItem(CHAVE) === "criativivo") {
        router.replace("/criativivo");
        return;
      }
      localStorage.setItem(CHAVE, tela);
    } catch {
      /* sem localStorage: segue sem lembrar */
    }
  }, [tela, aoEntrar, router]);
  return null;
}
