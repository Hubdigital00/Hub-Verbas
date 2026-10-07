# CLAUDE.md — Hub Verbas

Ferramenta interna, simples, para a agência atualizar a **verba** dos clientes direto no **ClickUp (API v2)**. **Sem banco de dados e sem Supabase: o ClickUp é a única fonte de dados.** Versão anterior (com Supabase, dashboard público e histórico em banco) está guardada fora do projeto em `../hub-verbas-v1-supabase`.

Stack: Next.js 16 (App Router, TypeScript), Tailwind 4. Hospedagem: **Hostinger (aplicativo Node.js)**, não Vercel.

## Idioma

Interface, mensagens de erro, commits e docs em **português do Brasil**. Valores `R$ 1.234,56`; o campo de digitação aceita vírgula decimal (`lerValor` em `src/lib/formato.ts`).

## Segredos (regra inviolável)

- Variáveis só no servidor, nunca no navegador: `CLICKUP_TOKEN`, `CLICKUP_LIST_ID`, `CLICKUP_CAMPO_VERBA` (padrão "Verba Atual 2.0"), `APP_PASSWORD`. Nenhuma tem prefixo `NEXT_PUBLIC_`.
- Nada de token/senha no código, em logs ou em respostas. `.env.example` só com nomes; `.env.local` fica fora do git.
- Variável faltando **não quebra o app**: `src/lib/config.ts` devolve a lista e `ConfigFaltando` mostra na tela.
- Se um segredo vazar, revogar e gerar outro.

## Restrições de hospedagem

Só recursos padrão do Next.js: `next build` + `next start` (lê `PORT`). Dependências enxutas (hoje: next, react, react-dom). Estado em memória (cache do `field_id`, trava de login por IP) é só otimização; o processo pode reiniciar.

## Arquitetura

- `src/lib/clickup.ts`: único ponto de contato com o ClickUp. Descobre o `field_id` por nome (`GET /list/{id}/field`, cache 10 min), lista tarefas com paginação (`GET /list/{id}/task`), grava (`POST /task/{id}/field/{field_id}` com `{"value": número}`) e comenta (`POST /task/{id}/comment`). Trata 401/403/404/timeout e 429 (espera o `x-ratelimit-reset`, até 4 tentativas).
- `src/lib/sessao.ts`: senha única; cookie `hv_sessao` httpOnly, assinado com HMAC (chave derivada de `APP_PASSWORD`), 8 h. Comparações em tempo constante.
- `src/app/actions.ts`: `entrar`/`sair` (trava 5 erros → 15 min por IP) e `salvarVerba(taskId, valor)`, que grava **um cliente por chamada** (o navegador chama em sequência para mostrar progresso por cliente e evitar timeout). Cada chamada revalida sessão, valor e se a tarefa pertence à `CLICKUP_LIST_ID`; lê o valor anterior direto do ClickUp para o comentário.
- `src/components/Tabela.tsx`: tabela, busca, confirmação "atual → novo" só dos alterados, status por cliente. Tab percorre as caixas de verba; Enter pula para a próxima.
- Cliente = nome da tarefa `[CLIENTE] CONTROLE DE VERBA` → `CLIENTE`. Plataforma vem do campo personalizado "Plataforma"; valor mensal de "Valor Mensal".

## Comandos

```bash
npm run dev        # desenvolvimento
npm run typecheck  # tsc --noEmit
npm run build      # build de produção
npm start          # next start
```

## Antes de entregar uma mudança

- [ ] Nenhum segredo no código ou exposto ao navegador
- [ ] Toda Server Action de escrita valida sessão e entrada
- [ ] Erros do ClickUp aparecem por cliente, em português
- [ ] `npm run typecheck` e `npm run build` passam
- [ ] Testado com UMA tarefa de teste, nunca direto em cliente real
