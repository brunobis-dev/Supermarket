// Script de desenvolvimento (não faz parte do PWA em si) que gera os ícones
// placeholder do app: um quadrado na cor de acento com um ícone de cesta de
// compras em branco. Usa apenas módulos nativos do Node (fs, path, zlib) —
// nenhuma dependência é adicionada ao projeto.
//
// Rodar com: node scripts/generate-icons.js
// Troque os arquivos em icons/ por uma logo de verdade quando tiver uma.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const COR_ACENTO = [46, 158, 109]; // #2E9E6D
const BRANCO = [255, 255, 255];

// --- Codificador PNG mínimo (RGBA, 8 bits, sem interlace) ---

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function criarChunk(tipo, dados) {
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const tamanhoBuf = Buffer.alloc(4);
  tamanhoBuf.writeUInt32BE(dados.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, dados])), 0);
  return Buffer.concat([tamanhoBuf, tipoBuf, dados, crcBuf]);
}

function codificarPNG(largura, altura, bufferRGBA) {
  const assinatura = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrDados = Buffer.alloc(13);
  ihdrDados.writeUInt32BE(largura, 0);
  ihdrDados.writeUInt32BE(altura, 4);
  ihdrDados[8] = 8; // bit depth
  ihdrDados[9] = 6; // color type: RGBA
  ihdrDados[10] = 0;
  ihdrDados[11] = 0;
  ihdrDados[12] = 0;
  const ihdr = criarChunk('IHDR', ihdrDados);

  const stride = largura * 4;
  const bruto = Buffer.alloc((stride + 1) * altura);
  for (let y = 0; y < altura; y++) {
    bruto[y * (stride + 1)] = 0; // filtro "none" em cada linha
    bufferRGBA.copy(bruto, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = criarChunk('IDAT', zlib.deflateSync(bruto));
  const iend = criarChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([assinatura, ihdr, idat, iend]);
}

// --- Desenho (pixel a pixel, formas geométricas simples) ---

function definirPixel(buf, largura, x, y, cor, alfa) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= largura || y < 0) return;
  const idx = (y * largura + x) * 4;
  if (idx < 0 || idx >= buf.length) return;
  buf[idx] = cor[0];
  buf[idx + 1] = cor[1];
  buf[idx + 2] = cor[2];
  buf[idx + 3] = alfa;
}

function desenharRetanguloArredondado(buf, tamanho, raio, cor) {
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      if (dentroDeRetanguloArredondado(x, y, 0, 0, tamanho - 1, tamanho - 1, raio)) {
        definirPixel(buf, tamanho, x, y, cor, 255);
      }
    }
  }
}

function dentroDeRetanguloArredondado(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  if (x < x0 + r && y < y0 + r) return Math.hypot(x - (x0 + r), y - (y0 + r)) <= r;
  if (x > x1 - r && y < y0 + r) return Math.hypot(x - (x1 - r), y - (y0 + r)) <= r;
  if (x < x0 + r && y > y1 - r) return Math.hypot(x - (x0 + r), y - (y1 - r)) <= r;
  if (x > x1 - r && y > y1 - r) return Math.hypot(x - (x1 - r), y - (y1 - r)) <= r;
  return true;
}

function desenharCirculoPreenchido(buf, largura, cx, cy, r, cor) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        definirPixel(buf, largura, cx + x, cy + y, cor, 255);
      }
    }
  }
}

function desenharAnelSuperior(buf, largura, cx, cy, rExterno, espessura, cor) {
  const rInterno = rExterno - espessura;
  for (let y = Math.floor(cy - rExterno); y <= Math.ceil(cy); y++) {
    for (let x = Math.floor(cx - rExterno); x <= Math.ceil(cx + rExterno); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rExterno && d >= rInterno) {
        definirPixel(buf, largura, x, y, cor, 255);
      }
    }
  }
}

function desenharCestaDeCompras(buf, tamanho, escala, cor) {
  const cx = tamanho / 2;
  const topo = tamanho * (0.5 - 0.16 * escala);
  const base = tamanho * (0.5 + 0.22 * escala);
  const largTopo = tamanho * 0.34 * escala;
  const largBase = tamanho * 0.24 * escala;

  for (let y = Math.round(topo); y <= Math.round(base); y++) {
    const t = (y - topo) / (base - topo);
    const larg = largTopo + (largBase - largTopo) * t;
    const xEsq = Math.round(cx - larg / 2);
    const xDir = Math.round(cx + larg / 2);
    for (let x = xEsq; x <= xDir; x++) {
      definirPixel(buf, tamanho, x, y, cor, 255);
    }
  }

  const espessuraAlca = Math.max(2, tamanho * 0.035 * escala);
  desenharAnelSuperior(buf, tamanho, cx, topo, tamanho * 0.135 * escala, espessuraAlca, cor);
}

function desenharIcone(tamanho, { arredondar, escalaGlifo }) {
  const buf = Buffer.alloc(tamanho * tamanho * 4);
  if (arredondar) {
    desenharRetanguloArredondado(buf, tamanho, Math.round(tamanho * 0.19), COR_ACENTO);
  } else {
    // Full-bleed, sem transparência: recomendado p/ apple-touch-icon e ícones maskable
    // (o próprio SO aplica sua máscara/cantos por cima).
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = COR_ACENTO[0];
      buf[i + 1] = COR_ACENTO[1];
      buf[i + 2] = COR_ACENTO[2];
      buf[i + 3] = 255;
    }
  }
  desenharCestaDeCompras(buf, tamanho, escalaGlifo, BRANCO);
  return buf;
}

const SAIDAS = [
  { nome: 'icon-192.png', tamanho: 192, arredondar: true, escalaGlifo: 1 },
  { nome: 'icon-512.png', tamanho: 512, arredondar: true, escalaGlifo: 1 },
  { nome: 'icon-512-maskable.png', tamanho: 512, arredondar: false, escalaGlifo: 0.8 },
  { nome: 'apple-touch-icon.png', tamanho: 180, arredondar: false, escalaGlifo: 1 },
];

const dirSaida = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(dirSaida)) fs.mkdirSync(dirSaida, { recursive: true });

for (const { nome, tamanho, arredondar, escalaGlifo } of SAIDAS) {
  const pixels = desenharIcone(tamanho, { arredondar, escalaGlifo });
  const png = codificarPNG(tamanho, tamanho, pixels);
  fs.writeFileSync(path.join(dirSaida, nome), png);
  console.log(`Gerado: icons/${nome} (${tamanho}x${tamanho}, ${png.length} bytes)`);
}
