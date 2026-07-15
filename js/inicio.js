// Boot da página de início. Não abre o banco — essa tela não renderiza
// nada dinâmico, só navega pra lista.html ou historico.html.
document.addEventListener('DOMContentLoaded', () => {
  registrarServiceWorker();
  configurarBotaoTema();
});
