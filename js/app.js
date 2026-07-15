// Estado em memória (espelha o IndexedDB; recarregado após cada escrita —
// os volumes de dados aqui são pequenos o bastante pra isso ser trivial).
let catalogoCache = [];
let listaAtualCache = [];
let itemEmEdicaoId = null; // null = criando um item novo
let modoPrecoAtual = 'total'; // 'total' | 'unitario'
let sugestaoSelecionada = null; // item do catálogo casado com o texto digitado

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  mostrarView('inicio');
  registrarServiceWorker();
  aplicarIconeTema();
  await abrirDB();
  catalogoCache = await buscarCatalogo();
  listaAtualCache = await buscarListaAtual();
  renderizarLista();
  configurarEventos();
}

// --- Tema (claro/escuro) ---

function temaAtivo() {
  return document.documentElement.getAttribute('data-tema') === 'dark' ? 'dark' : 'light';
}

function aplicarIconeTema() {
  const btn = document.getElementById('btn-alternar-tema');
  if (!btn) return;
  const ativo = temaAtivo();
  btn.textContent = ativo === 'dark' ? '☀️' : '🌙';
  btn.setAttribute('aria-label', ativo === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro');
  sincronizarThemeColor(ativo);
}

function sincronizarThemeColor(tema) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute('content', tema === 'dark' ? '#1C1F22' : '#FFFFFF');
}

function alternarTema() {
  const novo = temaAtivo() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-tema', novo);
  localStorage.setItem('tema', novo);
  aplicarIconeTema();
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((erro) => {
      console.error('Falha ao registrar service worker:', erro);
    });
  });
}

// --- Navegação entre views ---

function mostrarView(nomeView, direcao) {
  const viewAnterior = document.querySelector('.view:not([hidden])');

  document.querySelectorAll('.view').forEach((el) => {
    el.hidden = el.dataset.view !== nomeView;
  });
  document.getElementById('bottom-bar').hidden = nomeView !== 'lista';
  document.getElementById('btn-abrir-adicionar').hidden = nomeView !== 'lista';

  if (!direcao) return;

  const viewAlvo = document.querySelector(`.view[data-view="${nomeView}"]`);
  if (!viewAlvo || viewAlvo === viewAnterior) return;

  const classe = direcao === 'voltar' ? 'view-entrando-voltar' : 'view-entrando-frente';
  viewAlvo.classList.remove('view-entrando-frente', 'view-entrando-voltar');
  void viewAlvo.offsetWidth; // força reflow pra reiniciar a animação mesmo entrando na mesma view de novo
  viewAlvo.classList.add(classe);
}

// --- Renderização da lista ativa ---

let primeiraRenderizacaoLista = true;

function renderizarLista() {
  const container = document.getElementById('lista-itens');
  container.innerHTML = '';
  const animar = primeiraRenderizacaoLista;
  primeiraRenderizacaoLista = false;

  if (listaAtualCache.length === 0) {
    container.innerHTML = '<p class="estado-vazio"><span class="estado-vazio-icone">🛒</span><br>Sua lista está vazia.<br>Toque em "+" para adicionar um item.</p>';
    renderizarTotais();
    return;
  }

  const porCategoria = agruparPorCategoria(listaAtualCache);
  const categorias = Object.keys(porCategoria).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  let indice = 0;
  for (const categoria of categorias) {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-categoria';

    const titulo = document.createElement('h3');
    titulo.className = 'titulo-categoria';
    titulo.textContent = categoria;
    grupo.appendChild(titulo);

    for (const item of porCategoria[categoria]) {
      const linha = criarLinhaItem(item);
      if (animar) {
        linha.classList.add('entrada-item');
        linha.style.animationDelay = `${Math.min(indice * 30, 300)}ms`;
      }
      indice++;
      grupo.appendChild(linha);
    }
    container.appendChild(grupo);
  }

  renderizarTotais();
}

function agruparPorCategoria(itens) {
  return itens.reduce((acc, item) => {
    (acc[item.categoria] = acc[item.categoria] || []).push(item);
    return acc;
  }, {});
}

function criarLinhaItem(item) {
  const linha = document.createElement('div');
  linha.className = 'item-linha' + (item.noCarrinho ? ' no-carrinho' : '');

  const valorTotalItem = calcularValorTotalItem(item);

  const checkbox = document.createElement('button');
  checkbox.className = 'item-checkbox';
  checkbox.setAttribute('aria-label', 'Marcar como no carrinho');
  checkbox.textContent = item.noCarrinho ? '✓' : '';
  checkbox.addEventListener('click', () => alternarCarrinho(item.id));

  const info = document.createElement('div');
  info.className = 'item-info';
  const nomeEl = document.createElement('span');
  nomeEl.className = 'item-nome';
  nomeEl.textContent = item.nome;
  const detalheEl = document.createElement('span');
  detalheEl.className = 'item-detalhe';
  detalheEl.textContent = formatarDetalheItem(item);
  info.appendChild(nomeEl);
  info.appendChild(detalheEl);
  info.addEventListener('click', () => abrirFormularioItem(item));

  const remover = document.createElement('button');
  remover.className = 'item-remover';
  remover.setAttribute('aria-label', 'Remover item');
  remover.textContent = '🗑';
  remover.addEventListener('click', () => removerItem(item.id));

  linha.appendChild(checkbox);
  linha.appendChild(info);
  linha.appendChild(remover);

  return linha;
}

// --- Totais ---

function calcularValorTotalItem(item) {
  if (item.modoPreco === 'unitario') {
    return (item.valor || 0) * (item.quantidade || 0);
  }
  return item.valor || 0;
}

function renderizarTotais() {
  const total = listaAtualCache.reduce((soma, item) => soma + calcularValorTotalItem(item), 0);
  const noCarrinho = listaAtualCache.filter((item) => item.noCarrinho).length;
  document.getElementById('total-valor').textContent = formatarReais(total);
  document.getElementById('total-progresso').textContent = `${noCarrinho}/${listaAtualCache.length} itens`;
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

function formatarDetalheItem(item) {
  const partes = [];
  if (item.marca) partes.push(item.marca);
  partes.push(`${formatarQuantidade(item.quantidade)} ${item.unidade}`);
  partes.push(formatarReais(calcularValorTotalItem(item)));
  return partes.join(' · ');
}

// --- Formulário de adicionar/editar item ---

function abrirFormularioItem(itemExistente) {
  itemEmEdicaoId = itemExistente ? itemExistente.id : null;
  sugestaoSelecionada = null;

  document.getElementById('form-item').reset();
  document.getElementById('sheet-titulo').textContent = itemExistente ? 'Editar item' : 'Adicionar item';
  document.getElementById('campo-nome').value = itemExistente ? itemExistente.nome : '';
  document.getElementById('campo-marca').value = itemExistente ? (itemExistente.marca || '') : '';
  document.getElementById('campo-quantidade').value = itemExistente ? itemExistente.quantidade : 1;
  document.getElementById('campo-unidade').value = itemExistente ? itemExistente.unidade : 'un';
  document.getElementById('campo-categoria').value = itemExistente ? itemExistente.categoria : 'Mercearia';
  document.getElementById('campo-valor').value = itemExistente ? formatarValorParaInput(itemExistente.valor) : '';
  document.getElementById('btn-excluir-item').hidden = !itemExistente;
  document.getElementById('banner-confirmar-catalogo').hidden = true;

  definirModoPreco(itemExistente ? itemExistente.modoPreco : 'total');
  esconderSugestoes();
  abrirSheet('sheet-item');
  document.getElementById('campo-nome').focus();
}

function fecharFormularioItem() {
  fecharSheet('sheet-item');
  itemEmEdicaoId = null;
}

function definirModoPreco(modo) {
  modoPrecoAtual = modo;
  document.getElementById('btn-modo-total').classList.toggle('ativo', modo === 'total');
  document.getElementById('btn-modo-unitario').classList.toggle('ativo', modo === 'unitario');
  document.getElementById('rotulo-valor').textContent = modo === 'total' ? 'Valor total' : 'Valor por unidade';
}

// --- Autocomplete a partir do catálogo ---

function onInputNomeProduto(evento) {
  const termo = normalizarTexto(evento.target.value);
  sugestaoSelecionada = null;

  if (!termo) {
    esconderSugestoes();
    return;
  }

  const correspondencias = catalogoCache
    .filter((item) => item.nomeNormalizado.includes(termo))
    .slice(0, 6);

  if (correspondencias.length === 0) {
    esconderSugestoes();
    return;
  }

  const lista = document.getElementById('lista-sugestoes');
  lista.innerHTML = '';
  for (const item of correspondencias) {
    const li = document.createElement('li');
    li.textContent = `${item.nome} · ${item.categoria}`;
    li.addEventListener('click', () => selecionarSugestao(item));
    lista.appendChild(li);
  }
  lista.hidden = false;
}

function selecionarSugestao(item) {
  sugestaoSelecionada = item;
  document.getElementById('campo-nome').value = item.nome;
  document.getElementById('campo-categoria').value = item.categoria;
  document.getElementById('campo-unidade').value = item.unidadePadrao;
  esconderSugestoes();
}

function esconderSugestoes() {
  const lista = document.getElementById('lista-sugestoes');
  lista.hidden = true;
  lista.innerHTML = '';
}

// --- Campo de valor (máscara de moeda) ---

function onInputValor(evento) {
  const somenteDigitos = evento.target.value.replace(/\D/g, '');
  if (!somenteDigitos) {
    evento.target.value = '';
    return;
  }
  const centavos = parseInt(somenteDigitos, 10);
  evento.target.value = (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lerValorDoInput(inputEl) {
  const limpo = inputEl.value.replace(/\./g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
}

function formatarValorParaInput(valor) {
  return (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- Salvar / remover item da lista ---

async function salvarItem(evento) {
  evento.preventDefault();

  const nome = document.getElementById('campo-nome').value.trim();
  const marca = document.getElementById('campo-marca').value.trim();
  const quantidade = parseFloat(document.getElementById('campo-quantidade').value) || 0;
  const unidade = document.getElementById('campo-unidade').value;
  const categoria = document.getElementById('campo-categoria').value;
  const valor = lerValorDoInput(document.getElementById('campo-valor'));

  if (!nome || quantidade <= 0) {
    mostrarToast('Preencha nome e quantidade.');
    return;
  }

  const itemExistente = itemEmEdicaoId ? listaAtualCache.find((i) => i.id === itemEmEdicaoId) : null;

  const item = {
    nome,
    marca,
    quantidade,
    unidade,
    categoria,
    valor,
    modoPreco: modoPrecoAtual,
    noCarrinho: itemExistente ? itemExistente.noCarrinho : false,
    catalogoId: sugestaoSelecionada ? sugestaoSelecionada.id : (itemExistente ? itemExistente.catalogoId : null),
    criadoEm: itemExistente ? itemExistente.criadoEm : new Date().toISOString(),
  };

  if (itemEmEdicaoId) {
    item.id = itemEmEdicaoId;
    await atualizarItemLista(item);
  } else {
    await adicionarItemLista(item);
  }

  const eraNovo = !itemEmEdicaoId;
  fecharFormularioItem();
  await recarregarListaAtual();
  mostrarToast(eraNovo ? 'Item adicionado.' : 'Item atualizado.');

  if (eraNovo) {
    const jaExisteNoCatalogo = await encontrarNoCatalogoPorNome(nome);
    if (!jaExisteNoCatalogo) {
      perguntarAdicionarAoCatalogo({ nome, categoria, unidadePadrao: unidade });
    }
  }
}

function perguntarAdicionarAoCatalogo(itemNovo) {
  const banner = document.getElementById('banner-confirmar-catalogo');
  document.getElementById('banner-confirmar-texto').textContent = `Adicionar "${itemNovo.nome}" ao catálogo para próximas compras?`;
  banner.hidden = false;
  abrirSheet('sheet-item');

  const botaoSim = document.getElementById('banner-sim');
  const botaoNao = document.getElementById('banner-nao');

  const onSim = async () => {
    await adicionarAoCatalogo(itemNovo);
    await recarregarCatalogo();
    encerrar();
  };
  const onNao = () => encerrar();

  function encerrar() {
    banner.hidden = true;
    botaoSim.removeEventListener('click', onSim);
    botaoNao.removeEventListener('click', onNao);
  }

  botaoSim.addEventListener('click', onSim);
  botaoNao.addEventListener('click', onNao);
}

async function alternarCarrinho(id) {
  const item = listaAtualCache.find((i) => i.id === id);
  if (!item) return;
  item.noCarrinho = !item.noCarrinho;
  await atualizarItemLista(item);
  await recarregarListaAtual();
}

async function removerItem(id) {
  if (!confirm('Remover este item da lista?')) return;
  await removerItemLista(id);
  await recarregarListaAtual();
  mostrarToast('Item removido.');
}

async function recarregarListaAtual() {
  listaAtualCache = await buscarListaAtual();
  renderizarLista();
}

async function recarregarCatalogo() {
  catalogoCache = await buscarCatalogo();
}

// --- Finalizar compra ---

async function finalizarCompra() {
  if (listaAtualCache.length === 0) {
    mostrarToast('Sua lista está vazia.');
    return;
  }
  if (!confirm('Finalizar esta compra e salvar no histórico?')) return;

  const valorTotal = listaAtualCache.reduce((soma, item) => soma + calcularValorTotalItem(item), 0);
  const compra = {
    data: new Date().toISOString(),
    valorTotal,
    itens: listaAtualCache.map(({ id, ...resto }) => resto),
  };

  await salvarCompraNoHistorico(compra);
  await limparListaAtual();
  await recarregarListaAtual();
  mostrarToast('Compra finalizada e salva no histórico!');
}

// --- Histórico ---

async function abrirHistorico(direcao) {
  const historico = await buscarHistorico();
  const container = document.getElementById('lista-historico');
  container.innerHTML = '';

  if (historico.length === 0) {
    container.innerHTML = '<p class="estado-vazio"><span class="estado-vazio-icone">🧾</span><br>Nenhuma compra finalizada ainda.</p>';
  } else {
    historico.forEach((compra, indice) => {
      const linha = document.createElement('button');
      linha.className = 'historico-linha entrada-item';
      linha.style.animationDelay = `${Math.min(indice * 30, 300)}ms`;

      const dataEl = document.createElement('span');
      dataEl.className = 'historico-data';
      dataEl.textContent = formatarData(compra.data);

      const totalEl = document.createElement('span');
      totalEl.className = 'historico-total';
      totalEl.textContent = formatarReais(compra.valorTotal);

      linha.appendChild(dataEl);
      linha.appendChild(totalEl);
      linha.addEventListener('click', () => abrirDetalheCompra(compra));
      container.appendChild(linha);
    });
  }
  mostrarView('historico', direcao || 'frente');
}

function abrirDetalheCompra(compra) {
  document.getElementById('detalhe-data').textContent = formatarData(compra.data);
  document.getElementById('detalhe-total').textContent = formatarReais(compra.valorTotal);

  const container = document.getElementById('detalhe-itens');
  container.innerHTML = '';

  compra.itens.forEach((item, indice) => {
    const linha = document.createElement('div');
    linha.className = 'item-linha somente-leitura entrada-item';
    linha.style.animationDelay = `${Math.min(indice * 30, 300)}ms`;

    const info = document.createElement('div');
    info.className = 'item-info';
    const nomeEl = document.createElement('span');
    nomeEl.className = 'item-nome';
    nomeEl.textContent = item.nome;
    const detalheEl = document.createElement('span');
    detalheEl.className = 'item-detalhe';
    detalheEl.textContent = formatarDetalheItem(item);
    info.appendChild(nomeEl);
    info.appendChild(detalheEl);
    linha.appendChild(info);
    container.appendChild(linha);
  });

  mostrarView('detalhe', 'frente');
}

// --- Backup (exportar / importar JSON) ---

async function exportarBackupParaArquivo() {
  const dados = await exportarBackup();
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-mercado-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  mostrarToast('Backup exportado.');
}

function acionarImportarBackup() {
  document.getElementById('input-backup-import').click();
}

async function onArquivoBackupSelecionado(evento) {
  const arquivo = evento.target.files[0];
  if (!arquivo) return;

  if (!confirm('Importar este backup vai substituir todos os dados atuais. Continuar?')) {
    evento.target.value = '';
    return;
  }

  try {
    const texto = await arquivo.text();
    const dados = JSON.parse(texto);
    await importarBackup(dados);
    await recarregarCatalogo();
    await recarregarListaAtual();
    mostrarToast('Backup importado com sucesso.');
    fecharSheet('sheet-backup');
  } catch (erro) {
    console.error(erro);
    mostrarToast('Falha ao importar backup. Verifique o arquivo.');
  } finally {
    evento.target.value = '';
  }
}

// --- Sheets genéricas ---

function abrirSheet(id) {
  document.getElementById(id).hidden = false;
  document.body.classList.add('sheet-aberta');
}

function fecharSheet(id) {
  document.getElementById(id).hidden = true;
  document.body.classList.remove('sheet-aberta');
}

// --- Toast ---

let toastTimeoutId = null;
function mostrarToast(mensagem) {
  const toast = document.getElementById('toast');
  toast.textContent = mensagem;
  toast.classList.add('visivel');
  clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => toast.classList.remove('visivel'), 2200);
}

// --- Wiring de eventos ---

function configurarEventos() {
  document.getElementById('btn-iniciar-compra').addEventListener('click', () => mostrarView('lista', 'frente'));
  document.getElementById('btn-alternar-tema').addEventListener('click', alternarTema);
  document.getElementById('btn-abrir-adicionar').addEventListener('click', () => abrirFormularioItem(null));
  document.getElementById('btn-fechar-sheet').addEventListener('click', fecharFormularioItem);
  document.getElementById('form-item').addEventListener('submit', salvarItem);
  document.getElementById('campo-nome').addEventListener('input', onInputNomeProduto);
  document.getElementById('campo-valor').addEventListener('input', onInputValor);
  document.getElementById('btn-modo-total').addEventListener('click', () => definirModoPreco('total'));
  document.getElementById('btn-modo-unitario').addEventListener('click', () => definirModoPreco('unitario'));

  document.getElementById('btn-excluir-item').addEventListener('click', async () => {
    if (!itemEmEdicaoId) return;
    const id = itemEmEdicaoId;
    fecharFormularioItem();
    await removerItem(id);
  });

  document.getElementById('btn-finalizar-compra').addEventListener('click', finalizarCompra);

  document.getElementById('btn-ir-historico').addEventListener('click', () => abrirHistorico('frente'));
  document.getElementById('btn-voltar-lista').addEventListener('click', () => mostrarView('lista', 'voltar'));
  document.getElementById('btn-voltar-historico').addEventListener('click', () => abrirHistorico('voltar'));

  document.getElementById('btn-abrir-backup').addEventListener('click', () => abrirSheet('sheet-backup'));
  document.getElementById('btn-fechar-backup').addEventListener('click', () => fecharSheet('sheet-backup'));
  document.getElementById('btn-exportar-backup').addEventListener('click', exportarBackupParaArquivo);
  document.getElementById('btn-importar-backup').addEventListener('click', acionarImportarBackup);
  document.getElementById('input-backup-import').addEventListener('change', onArquivoBackupSelecionado);

  document.querySelectorAll('[data-fechar-sheet]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.sheet').forEach((sheet) => { sheet.hidden = true; });
      document.body.classList.remove('sheet-aberta');
    });
  });
}
