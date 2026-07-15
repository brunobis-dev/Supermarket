// Lógica da página historico.html — lista de compras finalizadas, cada
// linha leva pra detalhe.html?id=N.

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  registrarServiceWorker();
  await abrirDB();
  await renderizarHistorico();
}

async function renderizarHistorico() {
  const historico = await buscarHistorico();
  const container = document.getElementById('lista-historico');
  container.innerHTML = '';

  if (historico.length === 0) {
    container.innerHTML = '<p class="estado-vazio"><span class="estado-vazio-icone">🧾</span><br>Nenhuma compra finalizada ainda.</p>';
    return;
  }

  historico.forEach((compra, indice) => {
    const linha = document.createElement('a');
    linha.className = 'historico-linha entrada-item';
    linha.href = `./detalhe.html?id=${compra.id}`;
    linha.style.animationDelay = `${Math.min(indice * 30, 300)}ms`;

    const dataEl = document.createElement('span');
    dataEl.className = 'historico-data';
    dataEl.textContent = formatarData(compra.data);

    const totalEl = document.createElement('span');
    totalEl.className = 'historico-total';
    totalEl.textContent = formatarReais(compra.valorTotal);

    linha.appendChild(dataEl);
    linha.appendChild(totalEl);
    container.appendChild(linha);
  });
}
