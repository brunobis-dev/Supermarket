# Escanear NFC-e — registrar compra por QR code

## Contexto

O app "Lista de Mercado" hoje só registra compras através do fluxo manual:
montar lista → marcar itens no carrinho → "Finalizar compra" grava um
snapshot em `historico`. Esta feature adiciona um segundo jeito de gerar
uma entrada em `historico`: escanear o QR code impresso na nota fiscal
(NFC-e) do mercado e importar os itens e valores automaticamente, sem
passar pela lista.

Escopo: apenas notas emitidas em **São Paulo (SEFAZ-SP)**. Não é um parser
genérico multi-estado — se o usuário passar a comprar em outro estado, o
suporte a ele é um incremento futuro, não parte deste design.

## Fluxo

1. Na Home (`index.html`), um novo botão primário **"📷 Escanear nota
   fiscal"**, com o mesmo peso visual do "Iniciar compra" existente, leva
   para uma nova página `escanear.html`.
2. `escanear.html` abre a câmera via `getUserMedia` e decodifica frames do
   vídeo com a lib `jsQR`, vendorizada localmente em `js/jsqr.js` (baixada
   e commitada no repo, não carregada de CDN — mantém a filosofia atual do
   projeto de zero dependência externa e funcionamento com o Service
   Worker).
   - **Decisão técnica**: a `BarcodeDetector` API nativa do browser não é
     usada. Ela não é implementada em nenhum navegador iOS (todos usam
     WebKit, que nunca adicionou suporte), e o app tem o iPhone/Safari como
     alvo principal. `jsQR` decodifica por pixel e funciona igual em
     qualquer navegador, então é a única opção viável aqui — não há
     fallback dual-path porque a API nativa nunca seria usada de qualquer
     forma.
3. Ao decodificar um QR, o app valida a URL: precisa ser do domínio
   `nfce.fazenda.sp.gov.br`. Se não for (nota de outro estado, ou QR sem
   relação com NFC-e), mostra um toast de erro e mantém a câmera aberta
   para tentar outro.
4. Se a URL é válida, o app faz um `fetch` para o Worker do Cloudflare
   (ver abaixo), passando a URL da nota.
5. O Worker busca a página de consulta da SEFAZ-SP do lado do servidor
   (evita o bloqueio de CORS que existiria fazendo isso direto do
   navegador), extrai os dados com `HTMLRewriter` e devolve um JSON.
6. O app recebe o JSON e **salva direto no histórico**, sem tela de
   revisão intermediária (decisão explícita: prioriza velocidade sobre
   correção editável no momento do scan — itens mal categorizados podem
   ser corrigidos depois, manualmente, como qualquer outro dado do app).
7. Após salvar, navega para `detalhe.html?id=N` da compra recém-criada e
   mostra um toast de confirmação com o valor total.

## Worker (Cloudflare)

Vive em `worker/` no mesmo repositório do PWA (decisão: mais simples que
um repo separado; deploy independente via `wrangler`, sem acoplar ao
deploy do site estático).

**Endpoint**: `POST /consultar` — corpo `{ "url": "<url do qrcode>" }`.

**Responsabilidade**:
1. Validar que a URL é do domínio `nfce.fazenda.sp.gov.br`.
2. Buscar a página (`fetch` server-side).
3. Usar `HTMLRewriter` para extrair: nome do estabelecimento, data de
   emissão, itens (nome, quantidade, valor unitário, valor total) e valor
   total da nota.
4. Responder com JSON:

```json
{
  "chaveAcesso": "35260812345678000199650010000123451234567890",
  "estabelecimento": "Supermercado Exemplo Ltda",
  "data": "2026-08-18T14:32:00-03:00",
  "valorTotal": 214.30,
  "itens": [
    { "nome": "Arroz Tipo 1 5kg", "quantidade": 1, "valorUnitario": 24.90, "valorTotal": 24.90 }
  ]
}
```

5. Em caso de falha (nota cancelada, chave inválida, SEFAZ fora do ar,
   página sem itens detalhados), responde com erro HTTP + `{ "erro":
   "<motivo>" }`, e o app traduz isso num toast apropriado (ver tabela de
   erros).

CORS: o Worker precisa responder `Access-Control-Allow-Origin` liberado
para a origem onde o PWA está hospedado, já que é chamado via `fetch` do
navegador.

## Mapeamento de dados

Cada item do JSON do Worker vira um item de `historico.itens[]`, seguindo
a mesma forma usada hoje pelo fluxo manual:

| Campo | Origem |
|---|---|
| `nome` | direto da nota |
| `marca` | vazio (a nota não separa marca de forma confiável) |
| `categoria` / `unidadePadrao` | `encontrarNoCatalogoPorNome()` (mesma função do fluxo manual); se achar no catálogo, usa a categoria/unidade dele; se não achar, **"Outros"** / **"un"** |
| `valor` | `valorTotal` do item na nota |
| `modoPreco` | sempre `'total'` |
| `catalogoId` | id do catálogo se casou, senão `null` |
| `criadoEm` | data da nota |

Diferente do fluxo manual, **não há prompt de "adicionar ao catálogo?"**
para itens não reconhecidos — isso é interativo e o fluxo de scan é
direto/rápido por decisão do usuário.

### Novo campo em `historico`

O registro salvo em `historico` ganha um campo opcional **`chaveAcesso`**
(string de 44 dígitos), presente só em compras importadas por QR code
(ausente em compras finalizadas manualmente). Usado para dedupe: antes de
salvar, o app confere se já existe uma compra no histórico com essa
`chaveAcesso` — se sim, não salva de novo, mostra "Essa compra já está no
histórico" e oferece navegar até a compra existente.

Isso é uma extensão aditiva do schema (`historico` já é `keyPath: 'id',
autoIncrement`, sem index estrito de colunas) — não precisa de uma nova
`DB_VERSAO` nem migração, só passa a existir esse campo a mais em alguns
registros.

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| QR lido não é de uma nota SP | Toast de erro, câmera continua aberta pra tentar outro |
| QR não é uma nota fiscal (link genérico, etc.) | Mesmo toast — a validação de domínio cobre os dois casos |
| Worker não consegue buscar a nota (nota cancelada, chave inválida, SEFAZ fora do ar) | Toast "Não foi possível ler esta nota. Tente novamente." + retry |
| Nota sem itens detalhados | Worker retorna erro específico; app mostra "Nota sem itens detalhados" |
| Chave já registrada no histórico | Toast "Essa compra já está no histórico", não duplica, oferece ir ao detalhe existente |
| Câmera negada/indisponível | Aviso pedindo permissão, com link pras configurações do Safari |
| Worker fora do ar / timeout de rede | Toast genérico de erro de conexão, retry manual |

## Impacto em offline-first

Diferente do resto do app (que funciona 100% offline via IndexedDB +
Service Worker cache-first), **escanear uma nota exige rede** — tanto pra
alcançar o Worker quanto pro Worker alcançar a SEFAZ. Isso é uma exceção
consciente ao princípio offline-first do projeto, restrita a essa única
tela. `escanear.html`, `js/escanear.js` e `js/jsqr.js` continuam entrando
no precache do Service Worker (pro app shell abrir offline e mostrar um
erro claro de "sem conexão" em vez de tela em branco), mas a
funcionalidade de fato só opera online.

## Fora de escopo (não faz parte deste design)

- Suporte a notas de outros estados além de SP.
- Tela de revisão/edição dos itens antes de salvar.
- Prompt de "adicionar ao catálogo?" para itens não reconhecidos.
- Reaproveitar o scan para *conferir* uma lista em andamento (fluxo
  descartado nas perguntas de escopo).
