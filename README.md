# ImoAssistenteAI

Painel de trabalho para consultores imobiliários, em português de Portugal. Reúne num só sítio a carteira de clientes, a agenda de visitas, os imóveis, mensagens prontas, análises de imóveis com IA e a criação de vídeos a partir de fotografias.

- **Online:** https://imoassistenteai.web.app
- **Página de apresentação:** `/` (a raiz do site)
- **Painel:** `/painel` (exige login com Google)

## O que a aplicação faz

| Área do menu | O que faz | Usa IA? |
| --- | --- | --- |
| Visão geral | Plano da semana (tarefas por dia), alertas de imóveis por confirmar e de follow-ups em atraso | Não |
| Agenda | Marcar visitas (cliente, imóvel, morada, contacto, duração) e ver a semana | Não |
| Carteira de clientes | Fichas de clientes, estado, próximo contacto, perfil de procura | Não |
| Imóvel para cliente | Gera ligações pré-filtradas para Idealista, Imovirtual e Casa Sapo e uma mensagem para enviar ao cliente | Não |
| Histórico | Registo de contactos e visitas por cliente | Não |
| Mensagens padrão | Modelos de mensagem editáveis, com envio manual por WhatsApp | Não |
| Análise do imóvel | Relatório (resumo, vantagens, desvantagens, valorização) e descritivo do anúncio em três tons | Sim (Gemini) |
| Vídeo do imóvel | Cria um vídeo MP4 no browser a partir de fotografias (música, legendas, movimento) e prepara clips para o Google Flow | Parcial |
| Administração | Métricas de utilização e custo estimado da IA (só para administradores) | Não |

A descrição detalhada de cada página está em [docs/funcionalidades.md](docs/funcionalidades.md). Como o sistema funciona por dentro (login, sincronização, IA, segurança) está em [docs/arquitetura.md](docs/arquitetura.md).

## Tecnologias

- **React 19 + TypeScript + Vite** (aplicação de página única, sem servidor próprio)
- **Firebase**: Hosting, Authentication (Google), Firestore, AI Logic (Gemini) e App Check
- **Zod** para validar dados, **motion** para animações, **lucide-react** para ícones, **pdfjs-dist** para ler plantas em PDF
- **vitest** para testes e **oxlint** para análise estática

Não há Cloud Functions. Por isso o projeto funciona no plano gratuito (Spark) do Firebase.

## Começar

Requisitos: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env     # e preenche os valores (ver abaixo)
npm run dev              # http://localhost:5173
```

### Variáveis de ambiente (`.env`)

O ficheiro `.env` **nunca** vai para o git. O modelo é o `.env.example`.

| Variável | Para quê |
| --- | --- |
| `VITE_FIREBASE_*` | Configuração da app web do Firebase (`firebase apps:sdkconfig WEB <appId> --project <projeto>`) |
| `VITE_APPCHECK_SITE_KEY` | Chave do reCAPTCHA Enterprise usada pelo App Check |
| `VITE_ADMIN_EMAILS` | E-mails (separados por vírgula) que veem o menu Administração |
| `VITE_AI_BACKEND` | Opcional. `firebase` ou `proxy` para forçar o transporte da IA |
| `VITE_AI_MODEL` | Opcional. Modelo Gemini a usar (por omissão `gemini-3.8-flash`) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Só para desenvolvimento local: o Vite faz de proxy para o Gemini |

Sem as variáveis do Firebase, a aplicação continua a abrir, mas sem login nem sincronização.

> As chaves `VITE_*` ficam visíveis no código do browser por desenho. A proteção dos dados está nas regras do Firestore e no App Check, não em esconder estas chaves.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Verifica os tipos e gera a pasta `dist/` |
| `npm test` | Corre os testes (os de Firestore ficam ignorados sem emulador) |
| `npm run test:cloud` | Corre os testes das regras do Firestore no emulador (precisa de Java 21 e do Firebase CLI) |
| `npm run lint` | Análise estática com oxlint |

## Publicar

```bash
npm run build
firebase deploy --only hosting --project imoassistenteai
```

As regras do Firestore publicam-se à parte: `firebase deploy --only firestore:rules`.

## Estrutura do projeto

```
src/
  App.tsx              rotas: "/" é a apresentação, "/painel" é o painel
  pages/               uma página por área do menu + Landing (apresentação) + Admin
  components/          AuthGate (login), WeeklyPlan, WeekCalendar, FlowClips, gráficos
  lib/                 lógica sem interface: sincronização, IA, regras de negócio e testes
  assets/landing/      imagens da página de apresentação
public/videos/         vídeo de exemplo da apresentação
firestore.rules        regras de segurança do Firestore
firebase.json          Hosting, Firestore e emulador
docs/                  documentação
```

## Limitações conhecidas

- O Google Flow não pode ser incorporado na página nem preenchido automaticamente. A aplicação abre-o numa janela ao lado, copia o prompt e descarrega as fotografias; o utilizador carrega em gerar.
- O custo na Administração é uma **estimativa** (tokens × preço editável), não a fatura real.
- Os portais imobiliários bloqueiam a apresentação dentro de outras páginas. As pesquisas abrem em separadores novos.
- Os filtros de cada portal são limitados. A página indica o que ficou aplicado e o que o consultor tem de marcar no site.
