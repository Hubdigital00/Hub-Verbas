# Publicar o Hub Verbas na Hostinger (aplicativo Node.js)

Pré-requisito: plano da Hostinger com suporte a **aplicativos Node.js** (ex.: Business) e um domínio ou subdomínio (ex.: `verbas.suaagencia.com.br`). Os nomes dos menus do hPanel podem mudar um pouco; a lógica é a mesma.

## 1. Teste local primeiro

```bash
npm install
cp .env.example .env.local     # preencha as 4 variáveis (veja abaixo)
npm run build && npm start     # http://localhost:3000
```

Só publique depois de passar pelo teste com a tarefa de teste (seção final).

## 2. Variáveis de ambiente (todas só no servidor)

| Variável | Valor |
|---|---|
| `CLICKUP_TOKEN` | ClickUp > Configurações > Apps > Token de API (`pk_...`) |
| `CLICKUP_LIST_ID` | ID da lista CONTROLE DE VERBA (número na URL da lista) |
| `CLICKUP_CAMPO_VERBA` | nome exato do campo; padrão `Verba Atual 2.0` |
| `APP_PASSWORD` | senha única do sistema; use uma longa e não reaproveite outra |

Não existe `NEXT_PUBLIC_*`: nada disso vai para o navegador.

## 3. Subir o código

1. Crie um repositório **privado** no GitHub e envie o projeto (o `.gitignore` já exclui `.env.local`, `node_modules` e `.next`).
   - Alternativa sem GitHub: compacte a pasta em ZIP **sem** `node_modules`, `.next` e `.env.local`.
2. No hPanel: **Sites → Adicionar site → Aplicativo Web Node.js** e escolha importar do GitHub (ou enviar o ZIP).

## 4. Configurar o aplicativo

- **Versão do Node:** 20 ou 22.
- **Comando de instalação:** `npm install` (normalmente automático).
- **Comando de build:** `npm run build`.
- **Comando de início:** `npm start` (executa `next start`, que lê a porta de `PORT`; a Hostinger define essa variável).
- Em **Variáveis de ambiente**, cadastre as 4 variáveis da seção 2.
- Faça o deploy e aguarde o build. Se o build falhar por falta de memória, confira o log, tente de novo e, persistindo, fale com o suporte da Hostinger.

## 5. Domínio e HTTPS

1. Aponte o domínio/subdomínio para o aplicativo.
2. Ative o **SSL gratuito** e force o redirecionamento HTTP → HTTPS (o cookie de sessão é `Secure` em produção e só funciona em HTTPS).

## 6. Conferir em produção

1. Abra a URL: deve aparecer a tela de senha. Se aparecer "Configuração incompleta", falta variável no hPanel (a tela diz qual); corrija e faça novo deploy/reinício.
2. Entre com `APP_PASSWORD` e confira se a lista de clientes carrega.
3. Faça **um** teste de gravação na tarefa de teste (seção abaixo).

## 7. Atualizar depois

`git push` e novo deploy pelo hPanel. Para trocar a senha ou o token, altere a variável no hPanel e reinicie o aplicativo (trocar `APP_PASSWORD` encerra todas as sessões).

## 8. Segurança

- Se o token do ClickUp vazar (print, chat, commit), gere outro no ClickUp e atualize no hPanel.
- A trava de login (5 erros → 15 min) é por IP e fica na memória: reiniciar o app zera a contagem. Use senha forte.
- Apenas quem tem a senha altera verbas; não compartilhe a URL com a senha.

---

## Como testar com UMA tarefa de teste (antes dos clientes reais)

O sistema grava em qualquer tarefa da lista configurada, então o teste seguro é uma **lista separada**:

1. No ClickUp, crie uma lista **TESTE VERBA** com **uma** tarefa `[TESTE] CONTROLE DE VERBA` e o mesmo campo personalizado (`Verba Atual 2.0`, tipo Número ou Moeda). Se quiser, crie também "Plataforma" e "Valor Mensal".
2. Pegue o ID da lista de teste (na URL) e coloque em `CLICKUP_LIST_ID` no `.env.local`. **Não** use o ID da lista real ainda.
3. `npm run dev`, entre com a senha e confira: aparece só o cliente `TESTE`, com o valor atual do campo.
4. Digite uma verba (ex.: `1.234,56`) e clique em **Salvar tudo**. A confirmação deve mostrar `atual → novo`. Confirme.
5. No ClickUp, confira o campo atualizado e o comentário `Verba Atual 2.0 atualizada pelo Hub Verbas: R$ x → R$ y`.
6. Teste os erros: digite `abc` (o botão bloqueia e marca a linha), e troque o token por um inválido para ver a mensagem de erro por cliente.
7. Só então troque `CLICKUP_LIST_ID` pelo ID da lista real. Na primeira vez com clientes reais, altere **um** cliente e confira no ClickUp.
