// Lógica da página detalhe.html — lê o id da compra da query string
// (?id=N) e mostra os itens daquela compra, só leitura.

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  registrarServiceWorker();
  await abrirDB();

  const id = Number(new URLSearchParams(location.search).get('id'));
  const compra = id ? await buscarCompraPorId(id) : null;

  if (!compra) {
    document.getElementById('detalhe-itens').innerHTML = '<p class="estado-vazio">Compra não encontrada.</p>';
    return;
  }

  renderizarDetalhe(compra);
}

function renderizarDetalhe(compra) {
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
}
