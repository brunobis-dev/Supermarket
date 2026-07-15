// Funções compartilhadas entre todas as páginas: service worker, tema,
// formatação e pequenos helpers de UI (toast, sheets). Cada página inclui
// este arquivo antes do seu próprio script.

// --- Service worker ---
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((erro) => {
      console.error('Falha ao registrar service worker:', erro);
    });
  });
}

// --- Tema (claro/escuro) ---
function temaAtivo() {
  return document.documentElement.getAttribute('data-tema') === 'dark' ? 'dark' : 'light';
}

function sincronizarThemeColor(tema) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute('content', tema === 'dark' ? '#1C1F22' : '#FFFFFF');
}

function aplicarIconeTema() {
  const btn = document.getElementById('btn-alternar-tema');
  if (!btn) return;
  const ativo = temaAtivo();
  btn.textContent = ativo === 'dark' ? '☀️' : '🌙';
  btn.setAttribute('aria-label', ativo === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro');
  sincronizarThemeColor(ativo);
}

function alternarTema() {
  const novo = temaAtivo() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-tema', novo);
  localStorage.setItem('tema', novo);
  aplicarIconeTema();
}

function configurarBotaoTema() {
  const btn = document.getElementById('btn-alternar-tema');
  if (!btn) return;
  aplicarIconeTema();
  btn.addEventListener('click', alternarTema);
}

// --- Formatação ---
function formatarReais(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarQuantidade(quantidade) {
  return Number(quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatarData(isoString) {
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function calcularValorTotalItem(item) {
  if (item.modoPreco === 'unitario') {
    return (item.valor || 0) * (item.quantidade || 0);
  }
  return item.valor || 0;
}

function formatarDetalheItem(item) {
  const partes = [];
  if (item.marca) partes.push(item.marca);
  partes.push(`${formatarQuantidade(item.quantidade)} ${item.unidade}`);
  partes.push(formatarReais(calcularValorTotalItem(item)));
  return partes.join(' · ');
}

// --- Toast ---
let toastTimeoutId = null;
function mostrarToast(mensagem) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = mensagem;
  toast.classList.add('visivel');
  clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => toast.classList.remove('visivel'), 2200);
}

// --- Sheets (modais) ---
function abrirSheet(id) {
  document.getElementById(id).hidden = false;
  document.body.classList.add('sheet-aberta');
}

function fecharSheet(id) {
  document.getElementById(id).hidden = true;
  document.body.classList.remove('sheet-aberta');
}

function configurarFechamentoDeSheets() {
  document.querySelectorAll('[data-fechar-sheet]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.sheet').forEach((sheet) => { sheet.hidden = true; });
      document.body.classList.remove('sheet-aberta');
    });
  });
}
