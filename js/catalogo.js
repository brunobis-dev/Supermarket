// Catálogo inicial: populado no IndexedDB apenas na primeira execução
// (ver semearCatalogoSeVazio em db.js). Depois disso, o catálogo real
// vive no banco e pode ser editado/expandido pelo uso normal do app.
const CATALOGO_INICIAL = [
  // Hortifruti
  { nome: 'Banana', categoria: 'Hortifruti', unidadePadrao: 'kg' },
  { nome: 'Maçã', categoria: 'Hortifruti', unidadePadrao: 'kg' },
  { nome: 'Tomate', categoria: 'Hortifruti', unidadePadrao: 'kg' },
  { nome: 'Cebola', categoria: 'Hortifruti', unidadePadrao: 'kg' },
  { nome: 'Batata', categoria: 'Hortifruti', unidadePadrao: 'kg' },
  { nome: 'Alface', categoria: 'Hortifruti', unidadePadrao: 'un' },
  { nome: 'Limão', categoria: 'Hortifruti', unidadePadrao: 'kg' },
  { nome: 'Laranja', categoria: 'Hortifruti', unidadePadrao: 'kg' },
  { nome: 'Cenoura', categoria: 'Hortifruti', unidadePadrao: 'kg' },
  { nome: 'Alho', categoria: 'Hortifruti', unidadePadrao: 'g' },

  // Carnes
  { nome: 'Peito de Frango', categoria: 'Carnes', unidadePadrao: 'kg' },
  { nome: 'Carne Moída', categoria: 'Carnes', unidadePadrao: 'kg' },
  { nome: 'Coxa de Frango', categoria: 'Carnes', unidadePadrao: 'kg' },
  { nome: 'Linguiça', categoria: 'Carnes', unidadePadrao: 'kg' },
  { nome: 'Bisteca Suína', categoria: 'Carnes', unidadePadrao: 'kg' },
  { nome: 'Picanha', categoria: 'Carnes', unidadePadrao: 'kg' },

  // Laticínios
  { nome: 'Leite', categoria: 'Laticínios', unidadePadrao: 'L' },
  { nome: 'Queijo Mussarela', categoria: 'Laticínios', unidadePadrao: 'kg' },
  { nome: 'Iogurte', categoria: 'Laticínios', unidadePadrao: 'un' },
  { nome: 'Manteiga', categoria: 'Laticínios', unidadePadrao: 'un' },
  { nome: 'Requeijão', categoria: 'Laticínios', unidadePadrao: 'un' },
  { nome: 'Ovos', categoria: 'Laticínios', unidadePadrao: 'dz' },

  // Limpeza
  { nome: 'Detergente', categoria: 'Limpeza', unidadePadrao: 'un' },
  { nome: 'Sabão em Pó', categoria: 'Limpeza', unidadePadrao: 'kg' },
  { nome: 'Água Sanitária', categoria: 'Limpeza', unidadePadrao: 'L' },
  { nome: 'Desinfetante', categoria: 'Limpeza', unidadePadrao: 'L' },
  { nome: 'Esponja de Aço', categoria: 'Limpeza', unidadePadrao: 'un' },
  { nome: 'Amaciante', categoria: 'Limpeza', unidadePadrao: 'L' },
  { nome: 'Papel Toalha', categoria: 'Limpeza', unidadePadrao: 'un' },

  // Higiene
  { nome: 'Papel Higiênico', categoria: 'Higiene', unidadePadrao: 'un' },
  { nome: 'Sabonete', categoria: 'Higiene', unidadePadrao: 'un' },
  { nome: 'Shampoo', categoria: 'Higiene', unidadePadrao: 'un' },
  { nome: 'Creme Dental', categoria: 'Higiene', unidadePadrao: 'un' },
  { nome: 'Escova de Dente', categoria: 'Higiene', unidadePadrao: 'un' },
  { nome: 'Desodorante', categoria: 'Higiene', unidadePadrao: 'un' },
  { nome: 'Absorvente', categoria: 'Higiene', unidadePadrao: 'un' },

  // Mercearia
  { nome: 'Arroz', categoria: 'Mercearia', unidadePadrao: 'kg' },
  { nome: 'Feijão', categoria: 'Mercearia', unidadePadrao: 'kg' },
  { nome: 'Açúcar', categoria: 'Mercearia', unidadePadrao: 'kg' },
  { nome: 'Sal', categoria: 'Mercearia', unidadePadrao: 'kg' },
  { nome: 'Óleo de Soja', categoria: 'Mercearia', unidadePadrao: 'L' },
  { nome: 'Café', categoria: 'Mercearia', unidadePadrao: 'g' },
  { nome: 'Macarrão', categoria: 'Mercearia', unidadePadrao: 'g' },
  { nome: 'Molho de Tomate', categoria: 'Mercearia', unidadePadrao: 'un' },
  { nome: 'Farinha de Trigo', categoria: 'Mercearia', unidadePadrao: 'kg' },
  { nome: 'Vinagre', categoria: 'Mercearia', unidadePadrao: 'L' },
  { nome: 'Biscoito', categoria: 'Mercearia', unidadePadrao: 'un' },

  // Bebidas
  { nome: 'Água Mineral', categoria: 'Bebidas', unidadePadrao: 'L' },
  { nome: 'Refrigerante', categoria: 'Bebidas', unidadePadrao: 'L' },
  { nome: 'Suco', categoria: 'Bebidas', unidadePadrao: 'L' },
  { nome: 'Cerveja', categoria: 'Bebidas', unidadePadrao: 'un' },
  { nome: 'Vinho', categoria: 'Bebidas', unidadePadrao: 'un' },

  // Padaria
  { nome: 'Pão Francês', categoria: 'Padaria', unidadePadrao: 'kg' },
  { nome: 'Pão de Forma', categoria: 'Padaria', unidadePadrao: 'un' },
  { nome: 'Bolo', categoria: 'Padaria', unidadePadrao: 'un' },
  { nome: 'Torrada', categoria: 'Padaria', unidadePadrao: 'un' },

  // Congelados
  { nome: 'Batata Frita Congelada', categoria: 'Congelados', unidadePadrao: 'g' },
  { nome: 'Lasanha Congelada', categoria: 'Congelados', unidadePadrao: 'un' },
  { nome: 'Sorvete', categoria: 'Congelados', unidadePadrao: 'L' },
  { nome: 'Polpa de Fruta', categoria: 'Congelados', unidadePadrao: 'un' },
  { nome: 'Legumes Congelados', categoria: 'Congelados', unidadePadrao: 'g' },
];

const CATEGORIAS = [
  'Hortifruti',
  'Carnes',
  'Laticínios',
  'Limpeza',
  'Higiene',
  'Mercearia',
  'Bebidas',
  'Padaria',
  'Congelados',
];

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'dz'];
