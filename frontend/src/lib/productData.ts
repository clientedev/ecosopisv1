// Dados estáticos dos produtos - fonte de verdade para Ativos, Benefícios e Modo de Uso
// Mapeados por slug do produto
export interface StaticProductData {
  ativos: string;
  beneficios: string;
  modo_de_uso: string;
  curiosidades?: string;
}

export const PRODUCT_STATIC_DATA: Record<string, StaticProductData> = {
  "sabonete-acafrao-dolomita": {
    ativos: "Açafrão, Dolomita, Barbatimão",
    beneficios: "Ajuda a combater a foliculite, auxilia na redução de pelos, cicatrizante e anti-inflamatório",
    modo_de_uso: "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário.",
    curiosidades: "O açafrão, também conhecido como cúrcuma, é utilizado há séculos na medicina ayurvédica por suas propriedades antissépticas e clareadoras naturais.",
  },
  "sabonete-clareador-argila-branca": {
    ativos: "Argila Branca, Dolomita, Aloe Vera",
    beneficios: "Auxilia no clareamento da pele, melhora a aparência de manchas e deixa a pele mais uniforme e viçosa",
    modo_de_uso: "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário.",
    curiosidades: "A argila branca é a mais suave de todas as argilas, com um pH muito próximo ao da pele, sendo ideal para clarear sem causar irritações.",
  },
  "sabonete-argila-verde": {
    ativos: "Argila Verde, Aloe Vera, Óleo de Semente de Uva",
    beneficios: "Controla a oleosidade, ajuda no combate à acne, desintoxica e purifica a pele",
    modo_de_uso: "Aplicar sobre a pele úmida, massagear suavemente e enxaguar. Pode ser usado diariamente, principalmente em peles oleosas.",
    curiosidades: "A argila verde possui uma alta concentração de minerais e tem uma poderosa ação absorvente, perfeita para equilibrar peles com tendência à acne.",
  },
  "sabonete-carvao-ativado": {
    ativos: "Carvão Ativado, Calêndula, Aloe Vera",
    beneficios: "Limpeza profunda, desobstrução dos poros, ação calmante e auxílio no controle da acne",
    modo_de_uso: "Aplicar sobre a pele úmida, massagear suavemente, focando nas áreas mais oleosas e enxaguar. Uso diário.",
    curiosidades: "O carvão ativado vegetal funciona como um ímã, atraindo e retendo as toxinas e impurezas que obstruem os poros ao longo do dia.",
  },
  "sabonete-rosa-mosqueta-argila-rosa": {
    ativos: "Rosa Mosqueta, Argila Rosa",
    beneficios: "Hidrata, ajuda na regeneração da pele e deixa a pele mais macia",
    modo_de_uso: "Aplicar sobre a pele úmida, massagear suavemente e enxaguar. Indicado para uso diário.",
    curiosidades: "A união da rosa mosqueta com a argila rosa cria um tratamento focado na elasticidade, ideal para peles que precisam de nutrição e cuidado suave.",
  },
  "sabonete-intimo-barbatimao": {
    ativos: "Barbatimão, Calêndula",
    beneficios: "Ação calmante, auxilia na proteção da região íntima, ajuda a manter o equilíbrio e o conforto da pele",
    modo_de_uso: "Aplicar na região externa íntima durante o banho, massagear suavemente e enxaguar bem. Uso diário.",
    curiosidades: "O barbatimão é conhecido na sabedoria popular como 'casca da virgindade' por sua forte ação adstringente e protetora.",
  },
  "sabonete-liquido-barbatimao": {
    ativos: "Barbatimão, Calêndula, Óleos Essenciais de Lavanda Francesa e Melaleuca",
    beneficios: "Limpa profundamente sem ressecar, auxilia no controle da acne e da oleosidade, ao mesmo tempo em que hidrata e mantém o equilíbrio da pele. Possui ação calmante e regeneradora, sendo ideal para todos os tipos de pele. Pode ser usado no rosto, corpo e região íntima, proporcionando uma limpeza suave, segura e eficaz.\n\nNa região íntima, auxilia na manutenção do equilíbrio da pele, promove sensação de frescor, conforto e cuidado diário, sem agredir ou ressecar.",
    modo_de_uso: "Pode ser utilizado no rosto, corpo e região íntima. Aplicar uma pequena quantidade sobre a pele úmida, massagear suavemente até formar espuma e enxaguar bem.\n\nSugestão de uso: utilizar diariamente, pela manhã e à noite. Na região íntima, aplicar apenas na parte externa.",
    curiosidades: "Esta fórmula 3 em 1 foi desenvolvida para simplificar o seu ritual, oferecendo o poder do barbatimão em uma textura líquida suave e pH balanceado.",
  },

  // ÓLEOS VEGETAIS
  "oleo-rosa-mosqueta-puro": {
    ativos: "Óleo vegetal de Rosa Mosqueta Rubiginosa (Rosehip Fruit Oil) 100% puro",
    beneficios: "Auxilia na regeneração da pele, melhora a aparência de cicatrizes, manchas e linhas finas",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
    curiosidades: "A variedade Rubiginosa é riquíssima em ácidos graxos essenciais, sendo um dos óleos mais potentes do mundo para regeneração celular.",
  },
  "oleo-rosa-mosqueta-20ml": {
    ativos: "Óleo Vegetal de Rosa Mosqueta Rubiginosa (Rosehip Fruit Oil) 100% puro",
    beneficios: "Auxilia na regeneração da pele, melhora a aparência de cicatrizes, manchas e linhas finas",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
    curiosidades: "O fruto da rosa mosqueta é uma das maiores fontes naturais de vitamina C, auxiliando na luminosidade natural da pele.",
  },
  "refil-rosa-mosqueta": {
    ativos: "Óleo Vegetal de Rosa Mosqueta Rubiginosa (Rosehip Fruit Oil) 100% puro",
    beneficios: "Auxilia na regeneração da pele, melhora a aparência de cicatrizes, manchas e linhas finas",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
    curiosidades: "Nosso refil garante que você continue seu tratamento sem gerar desperdício, mantendo o compromisso da Ecosopis com o planeta.",
  },
  "oleo-alecrim": {
    ativos: "Óleo vegetal de alecrim (Rosmarinus Officinalis Leaf Oil) 100% puro",
    beneficios: "Estimula a circulação, auxilia no fortalecimento capilar e ajuda no crescimento dos fios",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
    curiosidades: "O alecrim é conhecido como a erva da alegria, seu aroma ajuda a despertar a mente enquanto cuida dos fios.",
  },
  "oleo-abacate": {
    ativos: "Óleo vegetal de abacate (Persea Gratissima Oil) 100% puro",
    beneficios: "Hidratação profunda, nutrição da pele e dos cabelos, ajuda na recuperação de áreas ressecadas",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
    curiosidades: "O óleo de abacate consegue penetrar nas camadas mais profundas da derme, sendo um dos melhores óleos para combater o ressecamento extremo.",
  },
  "oleo-semente-uva": {
    ativos: "Óleo vegetal de semente de uva (Grape Seed Oil) 100% puro",
    beneficios: "Hidratação leve, rápida absorção, ajuda na elasticidade da pele e ação antioxidante, auxilia na melhora de dermatites",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
    curiosidades: "Rico em resveratrol e vitamina E, este óleo é um escudo natural contra os radicais livres e o envelhecimento precoce.",
  },
  "oleo-ricino": {
    ativos: "Óleo vegetal de rícino (Ricinus Communis Seed Oil) 100% puro",
    beneficios: "Fortalece os fios, auxilia no crescimento capilar e hidrata profundamente",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
    curiosidades: "O rícino possui o raro ácido ricinoleico, que atua nas raízes capilares selando a cutícula e estimulando o crescimento saudável.",
  },
  "oleo-argan": {
    ativos: "Óleo vegetal de Argan (Argania Spinosa Kernel Oil) 100% puro",
    beneficios: "Nutrição intensa, controle do frizz, brilho e maciez para cabelos e pele",
    modo_de_uso: "Podem ser utilizados na pele e nos cabelos.\n\nNa pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar.\n\nNos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem.\n\nTambém podem ser usados como potencializadores em cremes e máscaras capilares.",
    curiosidades: "Conhecido como 'Ouro do Marrocos', o óleo de Argan é extraído manualmente através de um processo artesanal milenar.",
  },

  // ÓLEOS ESSENCIAIS
  "oe-lavanda": {
    ativos: "Óleo essencial de lavanda francesa (Lavandula Officinalis Oil) 100% puro",
    beneficios: "Ação calmante, auxilia no relaxamento, melhora a qualidade do sono e acalma a pele",
    modo_de_uso: "Sempre utilizar diluído.\n\nNa pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada.\nNos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares.\nNo ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização.\n\nObservação: não aplicar diretamente na pele sem diluição.",
    curiosidades: "A lavanda é o óleo essencial mais versátil da aromaterapia, sendo reverenciada por equilibrar as emoções e o corpo físico.",
  },
  "oe-melaleuca": {
    ativos: "Óleo essencial de melaleuca (Melaleuca Alternifolia Leaf Oil) 100% puro",
    beneficios: "Ação antibacteriana, auxilia no controle da acne, da oleosidade da pele e micose",
    modo_de_uso: "Sempre utilizar diluído.\n\nNa pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada.\nNos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares.\nNo ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização.\n\nObservação: não aplicar diretamente na pele sem diluição.",
    curiosidades: "A Melaleuca (Tea Tree) era usada por soldados na 2ª Guerra Mundial como antisséptico natural potente para tratar ferimentos.",
  },
  "oe-menta": {
    ativos: "Óleo essencial de Menta Piperita (Mentha Piperita Oil) 100% puro",
    beneficios: "Sensação refrescante, auxilia no foco mental e respiração",
    modo_de_uso: "Sempre utilizar diluído.\n\nNa pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada.\nNos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares.\nNo ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização.\n\nObservação: não aplicar diretamente na pele sem diluição.",
    curiosidades: "Basta uma gota de menta piperita para sentir um frescor instantâneo. É excelente para aliviar tensões e despertar a mente.",
  },
  "oe-laranja": {
    ativos: "Óleo essencial de laranja doce (Citrus Aurantium Dulcis Peel Oil) 100% puro",
    beneficios: "Ação relaxante, melhora o humor e proporciona sensação de bem-estar",
    modo_de_uso: "Sempre utilizar diluído.\n\nNa pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada.\nNos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares.\nNo ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização.\n\nObservação: não aplicar diretamente na pele sem diluição.",
    curiosidades: "O aroma cítrico da laranja doce libera serotonina no cérebro, ajudando a trazer uma sensação imediata de felicidade e leveza.",
  },

  // COSMÉTICOS
  "tonico-facial-antioxidante": {
    ativos: "Lavanda, Aloe Vera, Pepino",
    beneficios: "Hidrata, acalma, ajuda no controle da acne e revitaliza a pele",
    modo_de_uso: "Aplicar com algodão ou diretamente no rosto limpo, espalhando suavemente. Não enxaguar.",
    curiosidades: "O pepino e a aloe vera são uma dupla clássica de refrescância que ajuda a fechar os poros de forma natural.",
  },
  "creme-oleosidade-acne": {
    ativos: "Calêndula, Chá Verde, Óleo de Semente de Uva, Vitamina E",
    beneficios: "Controla a oleosidade, auxilia no combate à acne, acalma e ajuda na regeneração da pele",
    modo_de_uso: "Aplicar uma pequena quantidade no rosto limpo e seco, espalhando até absorção. Uso diário.",
    curiosidades: "A calêndula é um potente regenerador celular, garantindo que sua pele se recupere das marcas de acne sem ficar ressecada.",
  },
  "creme-pes-de-anjo": {
    ativos: "Barbatimão, Aloe Vera, Copaíba, Ureia",
    beneficios: "Hidratação intensa, auxilia na recuperação de rachaduras, ação cicatrizante e calmante",
    modo_de_uso: "Aplicar nos pés limpos, massageando até completa absorção. Pode ser usado diariamente.",
    curiosidades: "A Copaíba é conhecida como o 'antibiótico da mata', oferecendo uma proteção profunda e reparadora para a pele dos pés.",
  },
  "desodorante-clareador-solido": {
    ativos: "Argila Branca, Hidróxido de Magnésio, Manteiga de Karité — LIVRE de álcool e alumínio",
    beneficios: "Neutraliza odores, ajuda no clareamento das axilas e acalma a pele",
    modo_de_uso: "Aplicar uma pequena quantidade nas axilas limpas e secas, espalhando uniformemente. Uso diário.",
    curiosidades: "Diferente dos antitranspirantes comuns, este desodorante permite que sua pele respire livremente enquanto neutraliza o odor naturalmente.",
  },
  "manteiga-ojon": {
    ativos: "Manteiga de Ojon Hidrolisada",
    beneficios: "Nutrição profunda, restauração dos fios, brilho intenso e redução do ressecamento",
    modo_de_uso: "Aplicar pequena quantidade nos cabelos ou na pele, massageando bem. Para cabelos, pode ser usada como máscara.",
    curiosidades: "O Ojon é extraído da palmeira Elaeis Oleifera, sendo o único óleo natural capaz de penetrar no núcleo das fibras capilares mais danificadas.",
  },
  "kit-acne": {
    ativos: "Argila Verde, Carvão Ativado, Calêndula, Chá Verde, Vitamina E",
    beneficios: "Tratamento completo para controle de acne, redução da oleosidade e purificação dos poros",
    modo_de_uso: "1. Sabonete de Argila Verde: utilizar diariamente para limpeza da pele, aplicando sobre a pele úmida, massageando suavemente e enxaguando.\n\n2. Sabonete de Carvão Ativado & Calêndula: pode ser usado diariamente, alternando com o sabonete de argila verde, ou conforme necessidade para uma limpeza mais profunda.\n\n3. Creme Facial Anti Oleosidade: após a limpeza, aplicar uma pequena quantidade no rosto limpo e seco, espalhando até completa absorção. Usar diariamente.\n\nSugestão de uso: utilizar os sabonetes pela manhã e à noite, finalizando com o creme facial para melhores resultados no controle da acne e da oleosidade.",
    curiosidades: "Este kit combina a força adstringente da argila verde com o poder purificante do carvão ativado, criando um cronograma de limpeza equilibrado.",
  },

  // KITS
  "kit-clareamento": {
    ativos: "Argila Branca, Rosa Mosqueta Rubiginosa",
    beneficios: "Auxilia no clareamento da pele, ajuda a reduzir manchas e uniformizar o tom, promovendo uma aparência mais iluminada, saudável e revitalizada. Combina limpeza e tratamento, potencializando os resultados no uso contínuo.",
    modo_de_uso: "1. Sabonete Super Clareador: aplicar sobre a pele úmida, massagear suavemente, deixar agir por alguns segundos e enxaguar. Utilizar diariamente.\n\n2. Óleo de Rosa Mosqueta Rubiginosa: após a limpeza, aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso preferencial noturno.\n\nSugestão de uso: utilizar o sabonete diariamente (manhã e noite) e o óleo principalmente à noite para potencializar os resultados no clareamento e na regeneração da pele.",
    curiosidades: "A Rosa Mosqueta Rubiginosa é um dos óleos mais poderosos para regeneração celular, tornando este kit uma dupla imbatível para peles com manchas e necessidade de renovação.",
  },

  "kit-acafrao-argila": {
    ativos: "Açafrão (Cúrcuma), Dolomita, Argila Branca",
    beneficios: "Auxilia no clareamento da pele, ajuda a reduzir manchas e uniformizar o tom, deixando a pele mais iluminada, suave e com aparência saudável. Também contribui para acalmar a pele, melhorar a textura e auxiliar na redução de sinais de foliculite e irritações causadas por depilação.",
    modo_de_uso: "1. Sabonete de Açafrão & Dolomita: aplicar sobre a pele úmida, massagear suavemente, deixar agir por alguns segundos e enxaguar. Indicado especialmente para áreas com tendência à foliculite.\n\n2. Sabonete Super Clareador (Argila Branca): aplicar sobre a pele úmida, massagear suavemente e enxaguar.\n\nSugestão de uso: utilizar diariamente, podendo alternar entre os sabonetes ou usar conforme a necessidade da pele, pela manhã e à noite para potencializar os resultados no clareamento, uniformização e cuidado da pele.",
    curiosidades: "O açafrão é utilizado há milênios na medicina ayurvédica. Combinado à argila branca, cria um ritual de clareamento e cuidado completo, atuando de forma sinérgica para resultados superiores.",
  },
};

/** Retorna os dados estáticos de um produto pelo slug, ou null se não encontrar */
export function getStaticProductData(slug: string): StaticProductData | null {
  return PRODUCT_STATIC_DATA[slug] ?? null;
}
