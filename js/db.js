// Camada de acesso ao IndexedDB. IndexedDB puro (sem lib idb) — zero
// dependências externas, nada para o service worker precisar cachear de CDN.
const DB_NOME = 'listaDeMercadoDB';
const DB_VERSAO = 1;

const STORE_CATALOGO = 'catalogo';
const STORE_LISTA_ATUAL = 'listaAtual';
const STORE_HISTORICO = 'historico';

let dbPromise = null;

// Faixa Unicode dos diacríticos combinantes (U+0300–U+036F), construída a
// partir dos códigos numéricos para evitar depender de caracteres literais
// no arquivo-fonte.
const REGEX_DIACRITICOS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g'
);

function normalizarTexto(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(REGEX_DIACRITICOS, '')
    .trim()
    .toLowerCase();
}

function promisificarRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function abrirDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);

    req.onupgradeneeded = (evento) => {
      const db = evento.target.result;

      if (!db.objectStoreNames.contains(STORE_CATALOGO)) {
        const catalogoStore = db.createObjectStore(STORE_CATALOGO, { keyPath: 'id', autoIncrement: true });
        catalogoStore.createIndex('nomeNormalizado', 'nomeNormalizado', { unique: false });
        catalogoStore.createIndex('categoria', 'categoria', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_LISTA_ATUAL)) {
        db.createObjectStore(STORE_LISTA_ATUAL, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORE_HISTORICO)) {
        db.createObjectStore(STORE_HISTORICO, { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = (evento) => {
      const db = evento.target.result;
      semearCatalogoSeVazio(db).then(() => resolve(db)).catch(reject);
    };

    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function semearCatalogoSeVazio(db) {
  return new Promise((resolve, reject) => {
    const txLeitura = db.transaction(STORE_CATALOGO, 'readonly');
    const contagemReq = txLeitura.objectStore(STORE_CATALOGO).count();

    contagemReq.onsuccess = () => {
      if (contagemReq.result > 0) {
        resolve();
        return;
      }

      const txEscrita = db.transaction(STORE_CATALOGO, 'readwrite');
      const store = txEscrita.objectStore(STORE_CATALOGO);
      for (const item of CATALOGO_INICIAL) {
        store.add({
          nome: item.nome,
          nomeNormalizado: normalizarTexto(item.nome),
          categoria: item.categoria,
          unidadePadrao: item.unidadePadrao,
        });
      }
      txEscrita.oncomplete = () => resolve();
      txEscrita.onerror = () => reject(txEscrita.error);
    };

    contagemReq.onerror = () => reject(contagemReq.error);
  });
}

async function getAll(nomeStore) {
  const db = await abrirDB();
  const tx = db.transaction(nomeStore, 'readonly');
  return promisificarRequest(tx.objectStore(nomeStore).getAll());
}

async function adicionar(nomeStore, objeto) {
  const db = await abrirDB();
  const tx = db.transaction(nomeStore, 'readwrite');
  return promisificarRequest(tx.objectStore(nomeStore).add(objeto));
}

async function atualizar(nomeStore, objeto) {
  const db = await abrirDB();
  const tx = db.transaction(nomeStore, 'readwrite');
  return promisificarRequest(tx.objectStore(nomeStore).put(objeto));
}

async function remover(nomeStore, id) {
  const db = await abrirDB();
  const tx = db.transaction(nomeStore, 'readwrite');
  return promisificarRequest(tx.objectStore(nomeStore).delete(id));
}

async function limparStore(nomeStore) {
  const db = await abrirDB();
  const tx = db.transaction(nomeStore, 'readwrite');
  return promisificarRequest(tx.objectStore(nomeStore).clear());
}

// --- API de domínio usada pelo app.js ---

async function buscarCatalogo() {
  const itens = await getAll(STORE_CATALOGO);
  return itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function encontrarNoCatalogoPorNome(nome) {
  const alvo = normalizarTexto(nome);
  const itens = await getAll(STORE_CATALOGO);
  return itens.find((item) => item.nomeNormalizado === alvo) || null;
}

async function adicionarAoCatalogo({ nome, categoria, unidadePadrao }) {
  return adicionar(STORE_CATALOGO, {
    nome,
    nomeNormalizado: normalizarTexto(nome),
    categoria,
    unidadePadrao,
  });
}

async function buscarListaAtual() {
  return getAll(STORE_LISTA_ATUAL);
}

async function adicionarItemLista(item) {
  return adicionar(STORE_LISTA_ATUAL, item);
}

async function atualizarItemLista(item) {
  return atualizar(STORE_LISTA_ATUAL, item);
}

async function removerItemLista(id) {
  return remover(STORE_LISTA_ATUAL, id);
}

async function limparListaAtual() {
  return limparStore(STORE_LISTA_ATUAL);
}

async function buscarHistorico() {
  const itens = await getAll(STORE_HISTORICO);
  return itens.sort((a, b) => new Date(b.data) - new Date(a.data));
}

async function buscarCompraPorId(id) {
  const db = await abrirDB();
  const tx = db.transaction(STORE_HISTORICO, 'readonly');
  return promisificarRequest(tx.objectStore(STORE_HISTORICO).get(id));
}

async function salvarCompraNoHistorico(compra) {
  return adicionar(STORE_HISTORICO, compra);
}

async function exportarBackup() {
  const [catalogo, listaAtual, historico] = await Promise.all([
    getAll(STORE_CATALOGO),
    getAll(STORE_LISTA_ATUAL),
    getAll(STORE_HISTORICO),
  ]);
  return {
    versao: DB_VERSAO,
    exportadoEm: new Date().toISOString(),
    catalogo,
    listaAtual,
    historico,
  };
}

async function importarBackup(dados) {
  const db = await abrirDB();
  const tx = db.transaction([STORE_CATALOGO, STORE_LISTA_ATUAL, STORE_HISTORICO], 'readwrite');

  tx.objectStore(STORE_CATALOGO).clear();
  tx.objectStore(STORE_LISTA_ATUAL).clear();
  tx.objectStore(STORE_HISTORICO).clear();

  for (const item of dados.catalogo || []) {
    const { id, ...resto } = item;
    tx.objectStore(STORE_CATALOGO).add(resto);
  }
  for (const item of dados.listaAtual || []) {
    const { id, ...resto } = item;
    tx.objectStore(STORE_LISTA_ATUAL).add(resto);
  }
  for (const item of dados.historico || []) {
    const { id, ...resto } = item;
    tx.objectStore(STORE_HISTORICO).add(resto);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
