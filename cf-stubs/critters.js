// Stub vazio pra critters (CSS inliner opcional do Next 16). Não usamos a
// feature `experimental.optimizeCss`, então o require nunca executa em runtime
// — só precisa existir pra o esbuild bundler do wrangler resolver o módulo.
class Critters {
  constructor() {}
  async process(html) { return html; }
}
module.exports = Critters;
module.exports.default = Critters;
