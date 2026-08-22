# nfce-proxy

Cloudflare Worker que busca e interpreta a página pública de consulta de
NFC-e da SEFAZ-SP, pra contornar CORS e devolver os dados da nota (itens,
valores, data) como JSON pro app.

Detalhes de escopo e decisões de arquitetura estão em
`../docs/superpowers/specs/2026-08-18-escanear-nfce-design.md`.

## Deploy

Requer uma conta Cloudflare (o plano free cobre bem esse uso).

```
npm install -g wrangler
cd worker
wrangler login
wrangler deploy
```

O comando final imprime a URL pública do Worker, algo como
`https://nfce-proxy.<seu-subdominio>.workers.dev`. Copie essa URL e cole
na constante `WORKER_URL` no topo de `../js/escanear.js`.

## Testar localmente

```
wrangler dev
```

Sobe em `http://localhost:8787`. Teste com:

```
curl -X POST http://localhost:8787/consultar \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=<chave>|2|1|1|<hash>\"}"
```

## Endpoint

`POST /consultar` — corpo `{ "url": "<url decodificada do QR code>" }`.

Resposta de sucesso (200):

```json
{
  "chaveAcesso": "35240845543915098211650170000016801096369037",
  "estabelecimento": "HIPER Presidente Prudente",
  "data": "2024-08-08T13:01:00-03:00",
  "valorTotal": 80.39,
  "itens": [
    { "nome": "AMC ROUP CONCE DOWNY", "quantidade": 1, "unidade": "un", "valorUnitario": 54.99, "valorTotal": 54.99 }
  ]
}
```

Resposta de erro (400/422/502): `{ "erro": "<mensagem>" }`.

## Nota sobre a extração

O parsing é feito com regex sobre o HTML puro (não `HTMLRewriter`) — mais
simples de testar localmente com Node, e a página da SEFAZ-SP é pequena
o bastante (10-20KB) pra não precisar de parsing em streaming. A lógica
foi validada contra duas notas reais antes de entrar aqui (uma delas de
supermercado, com múltiplos itens — ver `test-worker-parse.js` mencionado
no histórico do projeto). Se a SEFAZ-SP mudar o HTML da página de
consulta, esses seletores (`#tabResult`, `.txtTit`, `.Rqtd`, `.RUN`,
`.RvlUnit`, `.valor`, `#u20`, `#totalNota`, `.chave`) vão parar de bater
e a extração vai passar a cair no erro "Não foi possível encontrar os
itens desta nota" — não há teste automatizado rodando contra a SEFAZ de
verdade, então isso só vai aparecer quando alguém escanear uma nota.
