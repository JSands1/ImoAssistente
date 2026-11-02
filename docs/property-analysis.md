# Páginas do painel

## Análise do imóvel (com IA)

Em [src/pages/PropertyAnalysis.tsx](../src/pages/PropertyAnalysis.tsx).

1. **Características** do imóvel introduzidas pelo consultor (localização, tipo, tipologia, área útil, ano, classificação energética, estado, piso, elevador, estacionamento, exterior, exposição, preço pedido e notas). Ficam guardadas no browser por imóvel.
2. **Planta (opcional)**: PDF, PNG ou JPEG, convertida em imagem no browser (máx. 4 páginas) e não guardada. Usada só na análise, não no descritivo.
3. **Análise por IA (Gemini)**: resumo, vantagens, desvantagens, sugestões para valorizar (impacto e esforço qualitativos), informação em falta e limitações. Não dá preço nem valor de mercado.
4. **Descritivo para o anúncio**: título, descrição longa e destaques, em três tons. Usa só as características e as notas, com um parágrafo geral sobre a zona (conhecimento da IA, a confirmar).

Cada análise ou descritivo gerado fica guardado na lista **As tuas análises**, no topo da página (neste browser, `casanexa-analysis-history`, até 100): mostra o imóvel, a data e o que tem, e permite abrir ou apagar. Gerar o descritivo junta-se à análise aberta; gerar uma nova análise cria outra entrada. A planta e os preços da zona não ficam guardados. A página tem ainda **Descarregar análise** (HTML, imprimível em PDF) e **Limpar** (não apaga a lista).

## Imóvel para cliente (sem IA)

Em [src/pages/ClientSearch.tsx](../src/pages/ClientSearch.tsx) e [src/lib/portal-links.ts](../src/lib/portal-links.ts).

1. **Cliente da carteira**: escolhes um cliente e os critérios dele (tipo, tipologia, distrito, concelho, orçamento e características) aparecem preenchidos, lidos da ficha. O que alterares aí atualiza a ficha do cliente. A área, o estado e as preferências em texto ficam guardados só para essa pesquisa (`casanexa-search-extras`). A "pesquisa livre" não está ligada a nenhum cliente (`casanexa-free-search`) e não altera a carteira.
2. **Ligações para os portais**, com os filtros que cada portal aceita. A página mostra, por baixo de cada ligação, o que ficou aplicado e o que o consultor ainda tem de marcar no site, e a mensagem repete esse aviso.
   - **Imovirtual** (testado a mudar o número de resultados): tipo, estado (`nova-construcao` ou `casas-usadas`), tipologia, preço, área (`areaMin`, `areaMax`) e extras `LIFT`, `GARAGE`, `BALCONY`, `TERRACE`, `GARDEN`. Piscina, ar condicionado e mobilado não funcionaram.
   - **Casa Sapo**: só tipologia e preço máximo (`?gp=`). O resto não foi possível confirmar.
   - **Idealista**: nomes dos filtros copiados de páginas reais do site (`preco-min_`, `preco-max_`, `tamanho-min_`, `tamanho-max_`, `apartamentos`, `moradias`, `novo`, `bom-estado`, `para-reformar`, `elevador`, `garagem`, `piscina`, `arcondicionado`, `jardim`, `terraco-e-varanda`). O Idealista bloqueia robôs, por isso o endereço final não foi aberto automaticamente.
   Os filtros combinam-se todos (E): muitos filtros juntos podem dar zero resultados.
3. **Mensagem** para o cliente com as ligações, editável, com cópia e abertura no WhatsApp (o envio é sempre manual).

Esta página não usa IA e não envia dados do cliente para fora. Os portais bloqueiam a apresentação dentro de outra página (`X-Frame-Options`), por isso as pesquisas abrem em separadores.

## Painel com dados reais

O painel (`/painel`) não traz clientes, imóveis nem visitas de exemplo.

- **Clientes**: a única fonte é o Histórico (`casanexa-history`). Os clientes ativos, os follow-ups (data de "próximo contacto" da ficha) e o formulário da agenda leem daí.
- **Imóveis** e **visitas**: criados pelo utilizador na própria app (`casanexa-properties`, `casanexa-appointments`). As referências são sequenciais (CN-1001, CN-1002…). Um imóvel pode ser removido.
- **Estados vazios**: sem dados, a Visão geral mostra três passos para começar; a Análise e o Vídeo pedem um imóvel; a Agenda pede um cliente.
- **Nome do consultor**: definido clicando no canto superior direito; a saudação muda com a hora do dia.
- **Dados de versões anteriores**: os clientes, imóveis e visitas de exemplo que tenham ficado gravados no browser são ignorados ao carregar (ids `c1-c3`, `p1-p4`, `a1-a2`). Os clientes criados à mão na antiga "Caixa de entrada" passam para o Histórico, com o mesmo id, na primeira abertura.

## Carteira de clientes (sem IA)

Em [src/pages/Portfolio.tsx](../src/pages/Portfolio.tsx) e [src/lib/history.ts](../src/lib/history.ts). Está no menu logo abaixo de "Imóveis" e usa os **mesmos registos do Histórico** (`casanexa-history`), por isso um cliente criado numa página aparece na outra.

- **Resumo**: total de clientes, em procura, já compraram, desistiram e com prioridade quente.
- **Ficha**: contacto (nome, telemóvel, email, como chegou, início e próximo contacto); estado (em procura, comprou, desistiu), tipo de cliente (comprador, vendedor, investidor, compra e vende), prioridade (quente, morno, frio), prazo para decidir e financiamento; critérios de procura (tipo de casa, tipologia, distrito, concelho, outras zonas, orçamento mínimo e máximo, características e notas).
- **Filtros**: texto, estado, tipo de cliente, prioridade, tipo de casa, zona e orçamento (o intervalo do cliente tem de se sobrepor ao pedido). A lista ordena primeiro quem ainda procura, depois a prioridade e o próximo contacto.
- **Ligações**: "Abrir no Histórico" abre a ficha do cliente (visitas, notas e compra); "Procurar imóveis para este cliente" abre a página de procura com o cliente escolhido e os critérios preenchidos.
- Ao marcar um cliente como "Comprou", cria-se o registo da compra, que se detalha no Histórico.
- **Apagar um cliente** (ícone na lista, botão no topo e no fim da ficha, e no Histórico): pede confirmação e remove também a ficha, as visitas, a compra, as marcações da agenda desse cliente e os dados da procura. Não dá para desfazer; convém descarregar uma cópia no Histórico antes.

## Ligação entre as páginas

A Carteira é a base: o Histórico, a Procura, a Agenda e a Visão geral usam os mesmos clientes (`casanexa-history`).

**Novo cliente**: o botão "+ Novo cliente" (Carteira e Histórico) só abre um formulário vazio e desce até ele; nada é gravado até carregares em "Guardar cliente" (o nome é obrigatório). "Cancelar" descarta o formulário (pede confirmação se já preencheste algo). Enquanto o cliente não está guardado, não há apagar, visitas, mensagens nem procura.

**Tipo de casa e tipologia**: o cliente pode procurar mais do que um tipo e mais do que uma tipologia (T0 a T6+, também em caixas de seleção). Fichas antigas com um só valor são convertidas automaticamente, e um imóvel encaixa se coincidir com qualquer uma das tipologias. Quanto ao tipo, (caixas de seleção: apartamento, moradia, terreno…), e ao guardar um cliente novo é preciso escolher pelo menos um. Fichas antigas com um só tipo são convertidas automaticamente. A Procura pesquisa nos portais um tipo de cada vez (apartamento, ou moradia se o cliente só procurar moradia).

- **Imóveis**: cada imóvel disponível mostra os clientes da carteira (ainda à procura) que encaixam, com uma percentagem. Zona vale 40 pontos (se o cliente indicou zona, o imóvel tem de estar nela), tipologia 30 (10 se o cliente não indicou) e orçamento 30 (15 se o preço ultrapassa o máximo até 10%). Só aparecem com 60 pontos ou mais. Clicar abre a ficha na Carteira.
- **Histórico** e **Procura**: têm um botão "Abrir na Carteira". Os follow-ups da Visão geral abrem a ficha do cliente na Carteira.
- **Agenda**: o formulário de visitas usa os clientes da carteira.
- **Dados de versões anteriores**: os perfis da antiga página de procura passam para a carteira (o perfil de exemplo "João" é descartado) e os extras ficam por cliente.

## Histórico de clientes (sem IA)

Em [src/pages/History.tsx](../src/pages/History.tsx) e [src/lib/history.ts](../src/lib/history.ts).

- **Ficha do cliente**: nome, telemóvel, email, data de início, estado (em procura, comprou, desistiu), notas gerais e um resumo editável do que o cliente procura.
- **Visitas**: data, imóvel visitado, ligação do anúncio, opinião (gostou, talvez, não gostou) e notas. A ficha mostra o número de visitas, em quantas gostou e a data da última.
- **Compra** (estado "Comprou"): data, tipo, tipologia, localização, preço, área e descrição da casa.
- **Pesquisa**: texto (nome, email, telefone, notas, notas das visitas, sem distinguir acentos), estado, período da compra, tipo de casa, tipologia e localização da compra. Os filtros da compra só mostram clientes com estado "Comprou".
- **Contacto**: mensagem pronta ("possível comprador, quer vender a casa?" ou "retomar a procura"), editável, com envio por **WhatsApp** (telemóvel) e por **email** (`mailto:`). O envio é sempre manual e fica registado o último contacto.
- **Cópia de segurança**: descarregar e carregar um ficheiro JSON. Os dados ficam só no `localStorage` do browser (`casanexa-history`), sem cópia automática.

Não usa IA e não envia dados para fora. Contactar clientes antigos para estes fins exige autorização (RGPD).

## Chave da API

`GEMINI_API_KEY` no `.env` (ignorado pelo git). O browser nunca a vê: os pedidos passam por um proxy em [vite.config.ts](../vite.config.ts), que só existe em `vite dev` e `vite preview`. Para publicar, tem de passar para uma função de servidor, com limite de utilização por utilizador.

## O que foi experimentado e não ficou

- **Pesquisa de casas pela IA** (Gemini com pesquisa na web): devolveu anúncios inexistentes ou com a mesma ligação em casas diferentes, e cada pedido fazia dezenas de pesquisas pagas. Para mostrar casas dentro da app é preciso uma fonte de dados autorizada (API de portal ou agregador).
- **Leitura de divisões e áreas da planta**: pouco fiável com plantas de várias frações.
- **Preços da zona e gráfico**: dependiam da pesquisa na web. O código de apoio (`market-stats`, gráfico) mantém-se no projeto, sem ser usado pelas páginas.

## Vídeo do imóvel: movimento da câmara

Por baixo da pré-visualização do vídeo há o painel "Movimento da câmara", com uma pré-visualização em tempo real (as primeiras fotos em ciclo, com Pausar e Do início) que reage a cada ajuste; os controlos ficam ao lado dela. Controlos ajustáveis: duração de cada foto, duração da transição e arranque na transição (efeito gimbal: entra depressa e trava). Zoom (150%), deslize (170%), inclinação (0°), flutuação (65%) e desfoque de movimento (10%) são valores fixos. As escolhas guardam-se neste browser (`casanexa-video-motion`) e o vídeo gerado usa exatamente as mesmas definições (`src/lib/camera-motion.ts` e `src/lib/photo-frame.ts`).

## Agenda: calendário semanal

A Agenda é a segunda opção do menu. Mostra a semana (segunda a domingo) com blocos nas horas ocupadas por cada visita (verde: confirmada; tracejado laranja: por confirmar), navegação semana a semana e botão "Hoje". Visitas à mesma hora ficam lado a lado. Clicar numa hora livre abre o formulário com a data preenchida; cada visita tem duração (30 a 120 min, uma hora por omissão para as antigas) e, se coincidir com outra, pede confirmação antes de marcar. Lógica em `src/lib/week.ts`, ecrã em `src/components/WeekCalendar.tsx`.
Cada visita pode ter ainda a morada do imóvel, o link do anúncio e o contacto do vendedor (opcionais); aparecem na lista da Agenda, com o link e o telefone clicáveis (`src/lib/visit.ts`).

## Mensagens padrão (sem IA)

Menu "Mensagens padrão", a seguir ao Histórico. Tem oito modelos de origem (primeiro contacto, seguimento, novas opções, confirmar e lembrar visita, depois da visita, sem resposta, pós-venda). Os campos `{nome}`, `{consultor}`, `{imovel}`, `{morada}`, `{data}` e `{hora}` preenchem-se com o cliente escolhido e, se ele tiver uma visita marcada, com o imóvel, a morada, o dia e a hora dessa visita. O texto pode ser editado antes de enviar. "Enviar no WhatsApp" abre `wa.me` com o texto já escrito; só é enviado quando carregares em enviar no WhatsApp. Por omissão regista a data de hoje como último contacto na ficha (o que alimenta a análise da semana). Os modelos podem ser editados, criados e apagados; ficam em `casanexa-message-templates`. Código em `src/lib/message-templates.ts` e `src/pages/Messages.tsx`.

## Análise da semana (Visão geral, sem IA)

Mostra os próximos 6 dias úteis com as visitas de cada dia e as tarefas sugeridas (contactos em atraso, follow-ups, clientes quentes sem visita, opiniões por registar, imóveis por confirmar, fichas incompletas, pós-venda e prospeção), e quatro verificações sobre se os clientes em procura estão bem acompanhados. São regras fixas sobre os dados guardados, em `src/lib/weekly-plan.ts`.
