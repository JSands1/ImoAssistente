# Arquitetura

Este documento explica como a aplicação funciona por dentro, para quem nunca viu o código.

## Visão geral

Aplicação de página única (React + Vite) servida pelo Firebase Hosting. **Não há servidor próprio.** O browser fala diretamente com o Firebase:

```
Browser (React)
  ├─ Firebase Auth ............ login com Google
  ├─ Firestore ................ cópia na nuvem dos dados do utilizador
  ├─ Firebase AI Logic ........ chamadas ao Gemini (análises e descritivos)
  └─ App Check ................ prova ao Firebase que o pedido vem do nosso site
```

Os dados vivem primeiro no `localStorage` do browser. A nuvem é uma cópia que se sincroniza em segundo plano. Assim a aplicação é rápida e funciona mesmo com a ligação instável.

## Rotas

[src/App.tsx](../src/App.tsx):

- `/painel` → `AuthGate` (login) → `Dashboard`
- qualquer outro endereço → `Landing` (página de apresentação)

O `Dashboard` ([src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx)) guarda a vista ativa e mostra a página escolhida no menu. Aceita `?feature=<vista>` para abrir diretamente uma vista.

## Login e conta

[src/components/AuthGate.tsx](../src/components/AuthGate.tsx) trata dos estados: a carregar, sem sessão, a sincronizar, erro e com sessão. O login é por popup do Google. Depois do login, o `AuthGate`:

1. carrega os dados da nuvem (`hydrate`);
2. liga o envio automático de alterações (`createUploader`);
3. instala a interceção do `localStorage` (`installStorageSync`);
4. publica as estatísticas de utilização do utilizador.

O contexto de conta (`AccountContext`, em [src/lib/account.ts](../src/lib/account.ts)) disponibiliza o utilizador às páginas.

## Sincronização com o Firestore

Código em [src/lib/cloud-sync.ts](../src/lib/cloud-sync.ts) (lógica, testada) e [src/lib/firestore-remote.ts](../src/lib/firestore-remote.ts) (acesso ao Firestore).

- 14 chaves do `localStorage` estão marcadas como sincronizadas (`syncedKeys`): histórico, imóveis, agenda, assinatura, modelos de mensagem, etc.
- Cada chave é guardada em `users/{uid}/data/{chave sem o prefixo "casanexa-"}` como `{ value: <texto JSON>, updatedAt }`. O limite por valor é de 900 000 caracteres.
- **Ao entrar**, a nuvem tem prioridade. Se o valor local for diferente, uma cópia fica em `casanexa-sync-backup` para não perder trabalho.
- **Troca de conta** no mesmo browser: as chaves sincronizadas locais são limpas, para uma conta nunca ver dados de outra. A conta dona dos dados locais fica em `casanexa-sync-owner`.
- **Envio**: as alterações são agrupadas (espera de 800 ms), comparadas com o último valor enviado e repetidas ao fim de 5 s se falharem.
- **Como deteta alterações**: `installStorageSync` substitui `Storage.prototype.setItem/removeItem`. Não substitui `localStorage.setItem` diretamente.
- **Sair da conta**: espera que o envio termine e só então limpa os dados locais sincronizados.
- Uma chave de painéis recolhidos não é sincronizada, de propósito (é preferência do dispositivo).

## Inteligência artificial

[src/lib/property-ai.ts](../src/lib/property-ai.ts) escolhe o transporte em `callApi`:

- **Firebase AI Logic** (produção): `firebase/ai` com `GoogleAIBackend`, em [src/lib/ai-firebase.ts](../src/lib/ai-firebase.ts). Não há chave de API no browser; o acesso é controlado pelo Firebase e pelo App Check.
- **Proxy local** (desenvolvimento): o Vite expõe `/api/ai/*` ([vite.config.ts](../vite.config.ts)) e usa `GEMINI_API_KEY` do `.env`.

A regra: usa o Firebase se estiver configurado e (`VITE_AI_BACKEND=firebase` ou, não sendo `proxy`, não estiver em desenvolvimento).

Os pedidos (prompts, esquemas de resposta, limites de imagens) estão em [src/lib/ai-requests.ts](../src/lib/ai-requests.ts) e são partilhados pelos dois transportes. Em caso de erro 503 há nova tentativa. O modelo por omissão é `gemini-3.8-flash`.

As respostas da IA são sempre apresentadas como **rascunho a rever**. A análise não dá preço nem valor de mercado.

## App Check

[src/lib/firebase.ts](../src/lib/firebase.ts) inicializa o App Check com `ReCaptchaEnterpriseProvider` e a chave `VITE_APPCHECK_SITE_KEY`. Em desenvolvimento usa um token de depuração. Sem App Check válido, o Firebase AI Logic recusa o pedido (erro 401), e a aplicação mostra uma mensagem a explicar.

A chave tem de ser do tipo **reCAPTCHA Enterprise** (registada em "Fraud Defense"). Uma chave clássica v3 não funciona.

## Regras de segurança (Firestore)

[firestore.rules](../firestore.rules):

| Caminho | Quem lê | Quem escreve |
| --- | --- | --- |
| `users/{uid}/**` | o próprio utilizador | o próprio utilizador |
| `usage/{id}` | só administradores | o utilizador autenticado, a criar (nunca alterar nem apagar), com campos validados e `at == request.time` |
| `stats/{uid}` | o próprio ou um administrador | o próprio, com validação |

Administrador = e-mail verificado e presente numa lista fixa nas regras. O menu "Administração" no browser usa `VITE_ADMIN_EMAILS`, mas isso é só interface: **a segurança real está nas regras**. Se mudares os administradores, atualiza as duas listas.

## Administração e custos

- Cada chamada à IA grava um evento em `usage` (tipo, tokens de entrada e de saída; os tokens de "pensamento" contam como saída), em [src/lib/usage.ts](../src/lib/usage.ts).
- Cada utilizador publica um resumo em `stats/{uid}` ao entrar e, no máximo, uma vez por minuto enquanto usa a app.
- [src/pages/Admin.tsx](../src/pages/Admin.tsx) lê tudo, com períodos de 7, 30 e 90 dias: totais, gráfico por dia, por tipo de pedido e tabela por utilizador.
- O custo é calculado em [src/lib/admin-metrics.ts](../src/lib/admin-metrics.ts): tokens × preço por milhão (valores por omissão: 0,75 USD entrada e 3,75 USD saída; câmbio 0,92 EUR/USD). Os preços são editáveis na página e ficam em `casanexa-admin-pricing`. É uma **estimativa**.

## Vídeo do imóvel

[src/pages/VideoStudio.tsx](../src/pages/VideoStudio.tsx) cria o vídeo no browser (canvas + MediaRecorder), com:

- movimento de câmara ([camera-motion.ts](../src/lib/camera-motion.ts));
- música ambiente gerada por código ([ambient-music.ts](../src/lib/ambient-music.ts)) ou faixa do utilizador;
- legendas com preço e dados do imóvel;
- percurso pela planta ([plan-render.ts](../src/lib/plan-render.ts)).

As fotografias não são enviadas para nenhum servidor.

**Google Flow (opcional)**: [src/components/FlowClips.tsx](../src/components/FlowClips.tsx) abre o Flow numa janela ao lado, copia o prompt para a área de transferência e descarrega um ZIP com as fotografias ([zip.ts](../src/lib/zip.ts)). O utilizador gera os clips no Flow e depois junta-os com [join-clips.ts](../src/lib/join-clips.ts). Os vídeos animados por IA levam sempre o aviso "Imagem animada por IA".

## Página de apresentação

- [src/pages/Landing.tsx](../src/pages/Landing.tsx) e [Landing.css](../src/pages/Landing.css) (classes com prefixo `lp-`).
- [LandingScenes.tsx](../src/pages/LandingScenes.tsx) tem quatro cenas animadas (vídeo, análises, clientes, mensagens). O estado base do CSS é o estado final, por isso quem pede "reduzir movimento" vê a cena completa e parada.
- A cena do vídeo usa `public/videos/exemplo-imovel.mp4`, com início aos 2,4 s para saltar uma legenda errada gerada pela IA no começo do ficheiro.
- `src/App.css` ainda tem classes partilhadas (`.eyebrow`, `.button`, `.brand`, `.text-link`) e CSS antigo da apresentação que já não é usado.

## Testes

- `npm test`: testes unitários da lógica em `src/lib/*.test.ts` (plano semanal, sincronização, métricas, ligações para portais, etc.).
- `npm run test:cloud`: testa as regras do Firestore no emulador (isolamento entre contas, regras de `usage` e `stats`, administradores). Precisa de Java 21 e do Firebase CLI. Sem emulador, estes testes ficam ignorados.

## Chaves do localStorage

Todas começam por `casanexa-`. As sincronizadas estão em `syncedKeys` ([cloud-sync.ts](../src/lib/cloud-sync.ts)). Fora da sincronização ficam, por exemplo, `casanexa-admin-pricing`, `casanexa-sync-owner`, `casanexa-sync-backup` e o estado dos painéis recolhidos.
