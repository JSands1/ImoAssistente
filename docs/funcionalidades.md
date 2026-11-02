# Funcionalidades

Resumo do que cada área do painel faz. O detalhe das regras e dos campos de cada página está em [property-analysis.md](property-analysis.md), que descreve também o que foi experimentado e não ficou.

Todos os dados do consultor (clientes, imóveis, visitas, mensagens) são **dele**, guardados com a sua conta Google. A aplicação não traz dados de exemplo.

## Visão geral

Plano da semana por dia útil, construído com regras (sem IA) em [src/lib/weekly-plan.ts](../src/lib/weekly-plan.ts): contactos em atraso, visitas, pedidos de feedback, marcação de visitas, imóveis por confirmar, fichas incompletas, prospeção e pós-venda. Mostra também verificações de saúde da carteira (bom, atenção, mau). Os alertas de imóveis sem confirmação há mais de 7 dias e de follow-ups pendentes aparecem no topo.

## Agenda

Marcar visitas com cliente, imóvel, data e hora, morada, ligação do anúncio, contacto do vendedor e duração (30 a 120 minutos ou outra). Calendário semanal em [WeekCalendar.tsx](../src/components/WeekCalendar.tsx).

## Carteira de clientes e Histórico

Duas vistas dos **mesmos registos** (`casanexa-history`):

- **Carteira**: fichas com estado, perfil de procura, orçamento, próximo contacto e imóveis que encaixam.
- **Histórico**: registo cronológico de contactos e visitas por cliente.

O perfil de procura usa [matching.ts](../src/lib/matching.ts) para sugerir quais dos clientes encaixam num imóvel (por zona, tipologia e preço).

## Imóvel para cliente (sem IA)

Escolhe-se um cliente e a aplicação gera ligações já filtradas para o **Idealista**, o **Imovirtual** e o **Casa Sapo** ([portal-links.ts](../src/lib/portal-links.ts)), mais uma mensagem editável para enviar por WhatsApp. O envio é sempre manual e nenhum dado do cliente sai da aplicação.

Cada portal aceita filtros diferentes. A página mostra o que foi aplicado e o que falta marcar no site.

## Mensagens padrão (sem IA)

Modelos de mensagem editáveis para as situações habituais (primeiro contacto, seguimento da procura, confirmar visita…), com o nome do cliente preenchido e envio por WhatsApp ([message-templates.ts](../src/lib/message-templates.ts)). Registar o envio atualiza a ficha do cliente.

## Análise do imóvel (com IA)

O consultor indica as características e, se quiser, junta a planta (PDF ou imagem). A IA devolve:

- resumo, vantagens, desvantagens e o que falta confirmar;
- sugestões de valorização, com impacto e esforço;
- descritivo do anúncio em três tons.

É sempre um rascunho a rever. Não dá preço nem valor de mercado. As análises ficam numa lista ("As tuas análises") e podem ser descarregadas em HTML, imprimível em PDF.

## Vídeo do imóvel

Cria um vídeo MP4 no browser a partir de fotografias, com música, legendas e movimento de câmara. Opcionalmente prepara clips para animar as fotografias no Google Flow e junta-os depois. Detalhes em [arquitetura.md](arquitetura.md#vídeo-do-imóvel).

## Administração (só administradores)

Métricas de utilização (clientes, pedidos à IA, tokens) e custo estimado, por período e por utilizador. Detalhes em [arquitetura.md](arquitetura.md#administração-e-custos).

## Página de apresentação

Página pública em `/` que apresenta o produto: criação de vídeos, análises automáticas, acompanhamento de clientes e mensagens padrão, com cenas animadas e perguntas frequentes.
