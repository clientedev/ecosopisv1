// Dados estáticos dos produtos - fonte de verdade para Ativos, Benefícios e Modo de Uso
// Mapeados por slug do produto

export interface StaticProductData {
  ativos: string;
  beneficios: string;
  modo_de_uso: string;
}

export const PRODUCT_STATIC_DATA: Record<string, StaticProductData> = {
  "sabonete-acafrao-dolomita": {
    ativos: "Açafrão, Dolomita, Barbatimão",
    beneficios: "Ajuda a combater a foliculite, auxilia na redução de pelos, cicatrizante e anti-inflamatório",
    modo_de_uso: "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário.",
  },
  "sabonete-clareador-argila-branca": {
    ativos: "Argila Branca, Dolomita, Aloe Vera",
    beneficios: "Auxilia no clareamento da pele, melhora a aparência de manchas e deixa a pele mais uniforme e viçosa",
    modo_de_uso: "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário.",
  },
  "sabonete-argila-verde": {
    ativos: "Argila Verde, Aloe Vera, Óleo de Semente de Uva",
    beneficios: "Controla a oleosidade, ajuda no combate à acne, desintoxica e purifica a pele",
    modo_de_uso: "Aplicar sobre a pele úmida, massagear suavemente e enxaguar. Pode ser usado diariamente, principalmente em peles oleosas.",
  },
  "sabonete-carvao-ativado": {
    ativos: "Carvão Ativado, Calêndula, Aloe Vera",
    beneficios: "Limpeza profunda, desobstrução dos poros, ação calmante e auxílio no controle da acne",
    modo_de_uso: "Aplicar sobre a pele úmida, massagear suavemente, focando nas áreas mais oleosas e enxaguar. Uso diário.",
  },
  "sabonete-rosa-mosqueta-argila-rosa": {
    ativos: "Rosa Mosqueta, Argila Rosa",
    beneficios: "Hidrata, ajuda na regeneração da pele e deixa a pele mais macia",
    modo_de_uso: "Aplicar sobre a pele úmida, massagear suavemente e enxaguar. Indicado para uso diário.",
  },
  "sabonete-intimo-barbatimao": {
    ativos: "Barbatimão, Calêndula",
    beneficios: "Ação calmante, auxilia na proteção da região íntima, ajuda a manter o equilíbrio e o conforto da pele",
    modo_de_uso: "Aplicar na região externa íntima durante o banho, massagear suavemente e enxaguar bem. Uso diário.",
  },
  "sabonete-liquido-barbatimao": {
    ativos: "Barbatimão, Calêndula",
    beneficios: "Limpa profundamente sem ressecar, auxilia no controle da acne e da oleosidade, ao mesmo tempo em que hidrata e mantém o equilíbrio da pele. Possui ação calmante e regeneradora, sendo ideal para todos os tipos de pele. Pode ser usado no rosto, corpo e região íntima, proporcionando uma limpeza suave, segura e eficaz.\n\nNa região íntima, auxilia na manutenção do equilíbrio da pele, promove sensação de frescor, conforto e cuidado diário, sem agredir ou ressecar.",
    modo_de_uso: "Aplicar na região externa íntima durante o banho, massagear suavemente e enxaguar bem. Uso diário.",
  },

  // ÓLEOS VEGETAIS
  "oleo-rosa-mosqueta-puro": {
    ativos: "Óleo vegetal de Rosa Mosqueta Rubiginosa (Rosehip Fruit Oil) 100% puro",
    beneficios: "Auxilia na regeneração da pele, melhora a aparência de cicatrizes, manchas e linhas finas",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
  },
  "oleo-rosa-mosqueta-20ml": {
    ativos: "Óleo vegetal de rosa mosqueta canina (Rosa Canina Fruit Oil) 100% puro",
    beneficios: "Hidrata profundamente, auxilia na regeneração da pele e melhora a elasticidade",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
  },
  "refil-rosa-mosqueta": {
    ativos: "Óleo vegetal de rosa mosqueta canina (Rosa Canina Fruit Oil) 100% puro",
    beneficios: "Hidrata profundamente, auxilia na regeneração da pele e melhora a elasticidade",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
  },
  "oleo-alecrim": {
    ativos: "Óleo vegetal de alecrim (Rosmarinus Officinalis Leaf Oil) 100% puro",
    beneficios: "Estimula a circulação, auxilia no fortalecimento capilar e ajuda no crescimento dos fios",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
  },
  "oleo-abacate": {
    ativos: "Óleo vegetal de abacate (Persea Gratissima Oil) 100% puro",
    beneficios: "Hidratação profunda, nutrição da pele e dos cabelos, ajuda na recuperação de áreas ressecadas",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
  },
  "oleo-semente-uva": {
    ativos: "Óleo vegetal de semente de uva (Grape Seed Oil) 100% puro",
    beneficios: "Hidratação leve, rápida absorção, ajuda na elasticidade da pele e ação antioxidante, auxilia na melhora de dermatites",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
  },
  "oleo-ricino": {
    ativos: "Óleo vegetal de rícino (Ricinus Communis Seed Oil) 100% puro",
    beneficios: "Fortalece os fios, auxilia no crescimento capilar e hidrata profundamente",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
  },
  "oleo-argan": {
    ativos: "Óleo vegetal de Argan (Argania Spinosa Kernel Oil) 100% puro",
    beneficios: "Nutrição intensa, controle do frizz, brilho e maciez para cabelos e pele",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
  },

  // ÓLEOS ESSENCIAIS
  "oe-lavanda": {
    ativos: "Óleo essencial de lavanda francesa (Lavandula Officinalis Oil) 100% puro",
    beneficios: "Ação calmante, auxilia no relaxamento, melhora a qualidade do sono e acalma a pele",
    modo_de_uso: "Sempre utilizar diluído.\n\nNa pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada.\nNos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares.\nNo ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização.\n\nObservação: não aplicar diretamente na pele sem diluição.",
  },
  "oe-melaleuca": {
    ativos: "Óleo essencial de melaleuca (Melaleuca Alternifolia Leaf Oil) 100% puro",
    beneficios: "Ação antibacteriana, auxilia no controle da acne, da oleosidade da pele e micose",
    modo_de_uso: "Sempre utilizar diluído.\n\nNa pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada.\nNos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares.\nNo ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização.\n\nObservação: não aplicar diretamente na pele sem diluição.",
  },
  "oe-menta": {
    ativos: "Óleo essencial de Menta Piperita (Mentha Piperita Oil) 100% puro",
    beneficios: "Sensação refrescante, auxilia no foco mental e respiração",
    modo_de_uso: "Sempre utilizar diluído.\n\nNa pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada.\nNos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares.\nNo ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização.\n\nObservação: não aplicar diretamente na pele sem diluição.",
  },
  "oe-laranja": {
    ativos: "Óleo essencial de laranja doce (Citrus Aurantium Dulcis Peel Oil) 100% puro",
    beneficios: "Ação relaxante, melhora o humor e proporciona sensação de bem-estar",
    modo_de_uso: "Sempre utilizar diluído.\n\nNa pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada.\nNos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares.\nNo ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização.\n\nObservação: não aplicar diretamente na pele sem diluição.",
  },

  // COSMÉTICOS
  "tonico-facial-antioxidante": {
    ativos: "Lavanda, Aloe Vera, Pepino",
    beneficios: "Hidrata, acalma, ajuda no controle da acne e revitaliza a pele",
    modo_de_uso: "Aplicar com algodão ou diretamente no rosto limpo, espalhando suavemente. Não enxaguar.",
  },
  "creme-oleosidade-acne": {
    ativos: "Calêndula, Chá Verde, Óleo de Semente de Uva, Vitamina E",
    beneficios: "Controla a oleosidade, auxilia no combate à acne, acalma e ajuda na regeneração da pele",
    modo_de_uso: "Aplicar uma pequena quantidade no rosto limpo e seco, espalhando até absorção. Uso diário.",
  },
  "creme-pes-de-anjo": {
    ativos: "Barbatimão, Aloe Vera, Copaíba, Ureia",
    beneficios: "Hidratação intensa, auxilia na recuperação de rachaduras, ação cicatrizante e calmante",
    modo_de_uso: "Aplicar nos pés limpos, massageando até completa absorção. Pode ser usado diariamente.",
  },
  "desodorante-clareador-solido": {
    ativos: "Argila Branca, Hidróxido de Magnésio, Manteiga de Karité — LIVRE de álcool e alumínio",
    beneficios: "Neutraliza odores, ajuda no clareamento das axilas e acalma a pele",
    modo_de_uso: "Aplicar uma pequena quantidade nas axilas limpas e secas, espalhando uniformemente. Uso diário.",
  },
  "manteiga-ojon": {
    ativos: "Manteiga de Ojon Hidrolisada",
    beneficios: "Nutrição profunda, restauração dos fios, brilho intenso e redução do ressecamento",
    modo_de_uso: "Aplicar pequena quantidade nos cabelos ou na pele, massageando bem. Para cabelos, pode ser usada como máscara.",
  },
};

/** Retorna os dados estáticos de um produto pelo slug, ou null se não encontrar */
export function getStaticProductData(slug: string): StaticProductData | null {
  return PRODUCT_STATIC_DATA[slug] ?? null;
}
