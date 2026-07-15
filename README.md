# Lista de Mercado

PWA pessoal para fazer a compra do mês no mercado. HTML/CSS/JS puro, sem
frameworks nem build tools, dados 100% locais no IndexedDB do aparelho.
Feito para instalar no iPhone via Safari ("Adicionar à Tela de Início").

## Rodar localmente

Qualquer servidor estático serve (IndexedDB e Service Worker exigem
`http://` ou `https://`, não funcionam abrindo o `index.html` direto do
disco com `file://`):

```
python -m http.server 8000
```

Depois abra `http://localhost:8000`. Para testar como PWA de verdade no
iPhone, o aparelho precisa estar na mesma rede Wi-Fi e você acessa pelo IP
da máquina (ex: `http://192.168.0.10:8000`) — o "Adicionar à Tela de
Início" e o Service Worker funcionam em `localhost`/IP da rede local mesmo
sem HTTPS (limitação de "secure context" do Safari não se aplica a
`localhost`/rede local em desenvolvimento).

## Estado atual

MVP completo:
- 4 páginas de verdade (navegação real, com reload de página):
  `index.html` (início) → `lista.html` → `historico.html` →
  `detalhe.html?id=N`
- Catálogo pré-cadastrado (~60 produtos, 9 categorias)
- Lista de compras com adicionar/editar/remover, autocomplete, categoria
  auto-sugerida, alternância entre preço total e por unidade
- Barra fixa inferior com total e progresso (itens no carrinho / total)
- Histórico de compras finalizadas, com detalhe de cada compra
- Exportar/importar backup em JSON
- Offline-first via Service Worker (cache-first do app shell)

Reconhecimento de produto por foto (via API da Anthropic) foi cogitado
mas descartado — não faz parte do app.

## Modelo de dados (IndexedDB, banco `listaDeMercadoDB`)

- **`catalogo`** — `{ id, nome, nomeNormalizado, categoria, unidadePadrao }`.
  Semeado automaticamente a partir de `js/catalogo.js` na primeira
  execução (só se a store estiver vazia).
- **`listaAtual`** — `{ id, nome, marca, categoria, quantidade, unidade,
  valor, modoPreco, noCarrinho, catalogoId, criadoEm }`. A lista em
  andamento. `marca` é opcional e fica só no item da lista, não no
  catálogo (o catálogo é genérico por produto; a marca muda a cada compra).
- **`historico`** — `{ id, data, valorTotal, itens[] }`. `itens` é um
  *snapshot* da lista no momento de finalizar a compra — não referencia o
  catálogo, então compras antigas continuam corretas mesmo se um produto
  do catálogo mudar de nome/categoria depois.

## Estrutura de arquivos

```
index.html              início — ilustração + "Iniciar compra" + link pro histórico
lista.html               tela principal — lista ativa, formulário, backup
historico.html            lista de compras finalizadas
detalhe.html              detalhe de uma compra (lê ?id=N da URL)
manifest.json             metadados do PWA (nome, ícones, cor de tema)
service-worker.js         cache-first das 4 páginas + scripts, offline-first
css/style.css             tema neutro + acento verde, mobile-first, safe-area
js/db.js                  toda a lógica do IndexedDB (sem dependências)
js/catalogo.js             seed inicial de produtos + listas de categorias/unidades
js/comum.js                tema, formatação, toast, sheets — compartilhado por todas as páginas
js/inicio.js               boot de index.html
js/lista.js                boot + toda a lógica de lista.html
js/historico.js            boot + lógica de historico.html
js/detalhe.js              boot + lógica de detalhe.html
icons/                     ícones PWA (192, 512, 512 maskable, apple-touch-icon)
scripts/generate-icons.js  gera os ícones acima (rodar com `node scripts/generate-icons.js`)
```

## Decisões de implementação

- **Páginas HTML separadas de verdade** (não SPA) — cada navegação é um
  reload real de página, com URL própria. Decisão explícita: uma primeira
  versão usava uma única `index.html` com JS trocando `.view`s + uma
  animação de deslize simulando transição de página, mas isso não deu a
  sensação de "lugares distintos" — cada tela (principalmente o início)
  precisava parecer genuinamente separada. O preço disso é um flash
  branco rápido a cada navegação (reload de verdade) — aceito
  conscientemente em troca da separação real. IndexedDB funciona igual
  em todas as páginas (mesma origem), então os dados não são afetados.
- **IndexedDB puro**, sem a lib `idb` — zero dependências externas, nada
  para o Service Worker precisar buscar de CDN antes do offline funcionar
  de verdade.
- **Autocomplete customizado**, não `<datalist>` nativo — o suporte do
  Safari iOS a `<datalist>` é inconsistente entre versões.
- **Deletar item** é um botão de lixeira direto (sem swipe-to-delete por
  enquanto) — gesto de swipe é mais confiável de ajustar testando no
  iPhone real; pode entrar como melhoria depois que o fluxo principal
  estiver validado no aparelho.
- **Ícones são placeholder** gerados por script (cesta de compras branca
  sobre fundo verde-acento) — troque os PNGs em `icons/` por uma logo de
  verdade quando tiver uma; os tamanhos/nomes de arquivo já batem com o
  `manifest.json`.
- **Tipografia**: "Iowan Old Style" (serif, títulos/valores) + "Avenir
  Next" (geométrica, corpo/UI) — ambas nativas do iOS/macOS, sem nenhum
  web font via CDN. Em dispositivos que não têm essas fontes (ex: testar
  no Windows), cai pra Georgia/Segoe UI — funciona, só não é exatamente o
  visual pretendido, que é no iPhone mesmo.
- **Modo escuro**: segue o sistema por padrão; o botão 🌙/☀️ no cabeçalho
  força um tema específico, salvo em `localStorage` (chave `tema`) e
  aplicado via atributo `data-tema` no `<html>`. Um script inline no
  `<head>` aplica isso antes do primeiro paint pra não piscar o tema
  errado ao abrir o app.
- **Textura de grão no fundo**: SVG de ruído embutido no CSS, opacidade
  bem baixa (~5%). É o único efeito visual que não consegui pré-visualizar
  (não tenho como renderizar CSS aqui) — vale conferir se ficou sutil o
  suficiente ou se é melhor remover.

## Deploy (GitHub Pages)

Ainda não configurado — fica para depois que o MVP estiver validado
localmente e no iPhone.
