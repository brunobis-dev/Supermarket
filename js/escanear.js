// Lógica da página escanear.html — abre a câmera, decodifica o QR code da
// nota fiscal com jsQR (sem depender de BarcodeDetector: essa API nunca
// foi implementada em navegador nenhum do iOS, que é o alvo principal do
// app), busca os dados no Worker e salva a compra direto no histórico.

// TODO: substituir pela URL real depois de rodar `wrangler deploy` em
// worker/ (veja worker/README.md).
const WORKER_URL = 'https://nfce-proxy.SEU-SUBDOMINIO.workers.dev';

const DOMINIO_PERMITIDO = /^https:\/\/(www\.)?nfce\.fazenda\.sp\.gov\.br\//i;

let catalogoCache = [];
let streamAtual = null;
let processando = false;
let ultimoTextoLido = null;
let ultimoTextoLidoEm = 0;

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  registrarServiceWorker();
  await abrirDB();
  catalogoCache = await buscarCatalogo();

  document.getElementById('btn-tentar-de-novo').addEventListener('click', iniciarCamera);

  iniciarCamera();
}

// --- Câmera e loop de decodificação ---

async function iniciarCamera() {
  document.getElementById('escanear-permissao').hidden = true;
  document.getElementById('escanear-video-wrap').hidden = false;
  definirStatus('Aponte a câmera para o QR code da nota fiscal.');

  try {
    streamAtual = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (erro) {
    console.error('Falha ao acessar a câmera:', erro);
    mostrarErroDeCamera();
    return;
  }

  const video = document.getElementById('escanear-video');
  video.srcObject = streamAtual;
  await video.play();

  processando = false;
  requestAnimationFrame(loopDeDecodificacao);
}

function mostrarErroDeCamera() {
  document.getElementById('escanear-video-wrap').hidden = true;
  document.getElementById('escanear-permissao').hidden = false;
}

function loopDeDecodificacao() {
  const video = document.getElementById('escanear-video');

  if (processando) {
    requestAnimationFrame(loopDeDecodificacao);
    return;
  }

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const canvas = document.getElementById('escanear-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const contexto = canvas.getContext('2d', { willReadFrequently: true });
    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
    const codigo = jsQR(imagem.data, imagem.width, imagem.height);

    if (codigo && codigo.data) {
      tratarTextoLido(codigo.data);
    }
  }

  requestAnimationFrame(loopDeDecodificacao);
}

function tratarTextoLido(texto) {
  const agora = Date.now();
  if (texto === ultimoTextoLido && agora - ultimoTextoLidoEm < 2500) return;
  ultimoTextoLido = texto;
  ultimoTextoLidoEm = agora;

  if (!DOMINIO_PERMITIDO.test(texto)) {
    mostrarToast('Este app só lê notas fiscais de São Paulo.');
    return;
  }

  buscarNotaEContinuar(texto);
}

// --- Busca no Worker e gravação no histórico ---

async function buscarNotaEContinuar(urlDaNota) {
  processando = true;
  definirStatus('Buscando dados da nota...');

  let resposta;
  try {
    resposta = await fetch(`${WORKER_URL}/consultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlDaNota }),
    });
  } catch (erro) {
    console.error('Falha ao chamar o worker:', erro);
    retomarAposErro('Erro de conexão. Verifique sua internet e tente novamente.');
    return;
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch (erro) {
    retomarAposErro('Não foi possível ler a resposta da SEFAZ-SP.');
    return;
  }

  if (!resposta.ok || dados.erro) {
    retomarAposErro(dados.erro || 'Não foi possível ler esta nota. Tente novamente.');
    return;
  }

  await salvarNotaComoCompra(dados);
}

function retomarAposErro(mensagem) {
  mostrarToast(mensagem);
  definirStatus('Aponte a câmera para o QR code da nota fiscal.');
  processando = false;
}

async function salvarNotaComoCompra(dadosNota) {
  const existente = dadosNota.chaveAcesso
    ? await buscarCompraPorChaveAcesso(dadosNota.chaveAcesso)
    : null;

  if (existente) {
    mostrarToast('Essa compra já está no histórico.');
    setTimeout(() => {
      location.href = `./detalhe.html?id=${existente.id}`;
    }, 1200);
    return;
  }

  const compra = {
    data: dadosNota.data || new Date().toISOString(),
    valorTotal: dadosNota.valorTotal,
    itens: dadosNota.itens.map((item) => mapearItemDaNota(item, dadosNota.data)),
    chaveAcesso: dadosNota.chaveAcesso,
  };

  const novoId = await salvarCompraNoHistorico(compra);

  mostrarToast(`Compra registrada! ${formatarReais(compra.valorTotal)}`);
  setTimeout(() => {
    location.href = `./detalhe.html?id=${novoId}`;
  }, 1200);
}

function mapearItemDaNota(itemNota, dataDaNota) {
  const doCatalogo = catalogoCache.find(
    (item) => item.nomeNormalizado === normalizarTexto(itemNota.nome)
  );

  return {
    nome: itemNota.nome,
    marca: '',
    quantidade: itemNota.quantidade || 1,
    unidade: doCatalogo ? doCatalogo.unidadePadrao : (itemNota.unidade || 'un').toLowerCase(),
    categoria: doCatalogo ? doCatalogo.categoria : 'Outros',
    valor: itemNota.valorTotal,
    modoPreco: 'total',
    catalogoId: doCatalogo ? doCatalogo.id : null,
    criadoEm: dataDaNota || new Date().toISOString(),
  };
}

// --- Status na tela ---

function definirStatus(texto) {
  document.getElementById('escanear-status').textContent = texto;
}
