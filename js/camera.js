// Fase 2 (ainda NÃO implementada) — reconhecimento de produto por foto.
// Este arquivo existe só como placeholder da estrutura; nenhuma função
// daqui é chamada pelo app.js hoje (o botão de câmera mostra um toast
// "em breve" direto, sem passar por aqui).
//
// Quando essa fase for implementada, o fluxo pretendido é:
//   1. Capturar a foto com <input type="file" accept="image/*" capture="environment">.
//   2. Enviar a imagem para um proxy serverless próprio (Cloudflare Worker
//      ou Vercel Function) — NUNCA chamar a API da Anthropic direto do
//      cliente, porque isso exporia a API key no código do PWA.
//   3. O proxy guarda a API key em variável de ambiente no servidor, chama
//      o modelo com visão e devolve nome/marca/peso/preço em JSON.
//   4. O resultado só preenche o formulário de adicionar item — o usuário
//      sempre confirma/edita antes de salvar, a IA nunca salva sozinha.
//   5. Cada chamada tem custo (API paga por uso): nunca disparar
//      automaticamente, só em resposta a um toque explícito do usuário.
