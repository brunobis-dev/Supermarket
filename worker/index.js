// Proxy que busca e interpreta a página de consulta pública da NFC-e da
// SEFAZ-SP (o app é 100% estático/client-side; isso existe só porque o
// navegador não pode buscar a página da SEFAZ direto — CORS — e porque
// cada UF tem seu próprio HTML, então isto não tenta ser genérico).
//
// Lógica de extração validada em 2026-08-18 contra duas notas reais
// (uma delas de supermercado, com vários itens, quantidades fracionadas
// e categorias variadas) antes de virar código aqui.

const DOMINIO_PERMITIDO = /^https:\/\/(www\.)?nfce\.fazenda\.sp\.gov\.br\//i;

function comCors(resposta) {
  resposta.headers.set('Access-Control-Allow-Origin', '*');
  resposta.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  resposta.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return resposta;
}

function jsonComCors(corpo, status = 200) {
  return comCors(new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function parseNumeroBR(texto) {
  const limpo = (texto || '').replace(/\s+/g, '');
  const semMilhar = limpo.replace(/\.(?=\d{3}(,|$))/g, '');
  return parseFloat(semMilhar.replace(',', '.'));
}

function paraISO(dataBR) {
  const [data, hora] = dataBR.split(' ');
  const [dd, mm, yyyy] = data.split('/');
  return `${yyyy}-${mm}-${dd}T${hora}-03:00`;
}

function extrairDadosDaNota(html) {
  if (html.includes('id="hdfNotaCancelada"')) {
    return { erro: 'Esta nota fiscal foi cancelada.' };
  }
  if (html.includes('id="hdfNotaDenegada"')) {
    return { erro: 'Esta nota fiscal foi denegada.' };
  }

  const tabelaMatch = html.match(/<table[^>]*id="tabResult"[^>]*>([\s\S]*?)<\/table>/);
  if (!tabelaMatch) {
    return { erro: 'Não foi possível encontrar os itens desta nota.' };
  }

  const chaveMatch = html.match(/<span class="chave">([\s\S]*?)<\/span>/);
  const chaveAcesso = chaveMatch ? chaveMatch[1].replace(/\s+/g, '') : null;

  const estMatch = html.match(/<div id="u20"[^>]*>([\s\S]*?)<\/div>/);
  const estabelecimento = estMatch ? estMatch[1].trim() : null;

  const dataMatch = html.match(/Emiss[^:<]*:\s*<\/strong>\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
  const data = dataMatch ? paraISO(dataMatch[1]) : null;

  const totalMatch = html.match(/Valor a pagar R\$:<\/label>\s*<span class="totalNumb[^"]*">([\s\S]*?)<\/span>/);
  const valorTotal = totalMatch ? parseNumeroBR(totalMatch[1]) : null;

  const linhas = tabelaMatch[1].match(/<tr[\s\S]*?<\/tr>/g) || [];
  const itens = linhas.map((linha) => {
    const nome = (linha.match(/<span class="txtTit">([\s\S]*?)<\/span>/) || [, ''])[1].trim();
    const qtdRaw = (linha.match(/<span class="Rqtd">[\s\S]*?<\/strong>([\s\S]*?)<\/span>/) || [, ''])[1];
    const unidade = (linha.match(/<span class="RUN">[\s\S]*?<\/strong>([\s\S]*?)<\/span>/) || [, ''])[1].trim();
    const vlUnitRaw = (linha.match(/<span class="RvlUnit">[\s\S]*?<\/strong>([\s\S]*?)<\/span>/) || [, ''])[1];
    const valorRaw = (linha.match(/<span class="valor">([\s\S]*?)<\/span>/) || [, ''])[1];
    return {
      nome,
      quantidade: parseNumeroBR(qtdRaw),
      unidade,
      valorUnitario: parseNumeroBR(vlUnitRaw),
      valorTotal: parseNumeroBR(valorRaw),
    };
  }).filter((item) => item.nome);

  if (itens.length === 0) {
    return { erro: 'Nota sem itens detalhados.' };
  }

  return { chaveAcesso, estabelecimento, data, valorTotal, itens };
}

async function tratarConsulta(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return jsonComCors({ erro: 'Corpo da requisição inválido.' }, 400);
  }

  const url = corpo && corpo.url;
  if (typeof url !== 'string' || !DOMINIO_PERMITIDO.test(url)) {
    return jsonComCors({ erro: 'Esta URL não é de uma nota fiscal de SP.' }, 400);
  }

  let respostaSefaz;
  try {
    respostaSefaz = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
    });
  } catch {
    return jsonComCors({ erro: 'Não foi possível conectar à SEFAZ-SP. Tente novamente.' }, 502);
  }

  if (!respostaSefaz.ok) {
    return jsonComCors({ erro: 'A SEFAZ-SP não retornou esta nota. Tente novamente.' }, 502);
  }

  const html = await respostaSefaz.text();
  const dados = extrairDadosDaNota(html);

  if (dados.erro) {
    return jsonComCors({ erro: dados.erro }, 422);
  }

  return jsonComCors(dados, 200);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return comCors(new Response(null, { status: 204 }));
    }

    if (request.method === 'POST' && url.pathname === '/consultar') {
      return tratarConsulta(request);
    }

    return jsonComCors({ erro: 'Rota não encontrada.' }, 404);
  },
};
