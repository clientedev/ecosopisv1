import psycopg2
from psycopg2.extras import execute_values
import random
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone

DB_URL = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway"

LIA_TEMPLATES = [
    # Clareamento & Manchas
    {
        "user": "ola vcs tem sabonete pra mancha na pelem?",
        "bot": "Olá! Para manchas e uniformização da pele, nosso Sabonete Clareador de Argila Branca e Dolomita e o Sabonete de Açafrão são os mais indicados! Eles ajudam a renovar a pele e suavizar marquinhas. 🌿",
        "topic": "Clareamento & Manchas"
    },
    {
        "user": "o desodorante clareia mesmo axila e virilha escura?",
        "bot": "Sim! O Desodorante Clareador Sólido foi desenvolvido com ingredientes naturais que clareiam gradualmente a região das axilas e virilha sem agredir a pele. ✨",
        "topic": "Clareamento & Manchas"
    },
    {
        "user": "qual sabonete vcs indica pra melasma no rosto?",
        "bot": "Para melasma, recomendamos a combinação do Sabonete Clareador de Argila Branca com o Óleo Vegetal de Rosa Mosqueta Rubiginosa à noite! 💆‍♀️",
        "topic": "Clareamento & Manchas"
    },
    {
        "user": "kit clareamento potente funciona pra mancha de sol?",
        "bot": "Com certeza! O Kit Clareamento Potente une nossos melhores ativos clareadores para uniformizar o tom da pele exposta ao sol.",
        "topic": "Clareamento & Manchas"
    },
    {
        "user": "sabonete de açafrão clareia axila tbm?",
        "bot": "Claro! O açafrão possui curcumina, um excelente antioxidante e clareador natural para axilas, virilhas e rosto.",
        "topic": "Clareamento & Manchas"
    },

    # Acne & Oleosidade
    {
        "user": "minha pele eh mto oleosa qual kit vc me indica pra compra?",
        "bot": "Para pele oleosa e com acne, o Kit para Acne e Oleosidade é perfeito! Ele vem com o Sabonete de Argila Verde e Creme Anti-Oleosidade.",
        "topic": "Acne & Oleosidade"
    },
    {
        "user": "sabonete de carvão ativado ajuda com cravos e espinha no nariz?",
        "bot": "Sim! O Sabonete de Carvão Ativado faz uma limpeza profunda, desobstruindo os poros e removendo cravos e excesso de oleosidade.",
        "topic": "Acne & Oleosidade"
    },
    {
        "user": "sabonete de argila verde eh bom pra espinhas nas costas?",
        "bot": "Excelente! A argila verde tem ação adstringente e secativa, ideal para combater espinhas tanto no rosto quanto nas costas.",
        "topic": "Acne & Oleosidade"
    },
    {
        "user": "creme para oleosidade deixa a pele melecada?",
        "bot": "Não mesmo! Ele tem toque seco, rápida absorção e ajuda a controlar o brilho ao longo do dia.",
        "topic": "Acne & Oleosidade"
    },
    {
        "user": "tenho mta espinha interna oq passa?",
        "bot": "Recomendamos o Sabonete de Argila Verde juntamente com algumas gotinhas de Óleo Essencial de Melaleuca (Tea Tree) diluído, que tem ação bactericida rápida!",
        "topic": "Acne & Oleosidade"
    },

    # Sabonetes Artesanais
    {
        "user": "esse sabonete de açafrão serve pra foliculite msm???",
        "bot": "Serve sim! O açafrão é famoso por combater a foliculite e pelos encravados devido às suas propriedades anti-inflamatórias. 🍃",
        "topic": "Sabonetes Artesanais"
    },
    {
        "user": "sabonete intimo de barbatimao pode usa todo dia no banho?",
        "bot": "Com certeza! O Sabonete Íntimo de Barbatimão com Calêndula é 100% natural, hipoalergênico e possui pH equilibrado para uso diário.",
        "topic": "Sabonetes Artesanais"
    },
    {
        "user": "gravida pode usar sabonete de açafrão?",
        "bot": "Sim! Nossos sabonetes corporais e faciais são naturais e artesanais. Em caso de dúvidas específicas, sempre consulte seu médico.",
        "topic": "Sabonetes Artesanais"
    },
    {
        "user": "qual a validade dos sabonetes artesanaiss?",
        "bot": "Nossos sabonetes duram entre 12 a 24 meses se armazenados em local seco e arejado! 🧼",
        "topic": "Sabonetes Artesanais"
    },
    {
        "user": "vcs fazem sabonete sem cheiro pra quem tem alergia?",
        "bot": "Nosso Sabonete de Argila Branca e Dolomita é super suave e ideal para peles extremamente sensíveis e reativas.",
        "topic": "Sabonetes Artesanais"
    },

    # Óleos & Hidratação
    {
        "user": "qual oleo eh bom pra estria e ruga no rosto?",
        "bot": "O Óleo Vegetal de Rosa Mosqueta Rubiginosa 100% Puro é o campeão para atenuação de rugas, linhas de expressão e estrias! 🌹",
        "topic": "Óleos & Hidratação"
    },
    {
        "user": "posso usa o oleo de rosa mosqueta de dia ou tem perigo?",
        "bot": "O ideal é usar à noite antes de dormir! Se usar de dia, não se esqueça de aplicar protetor solar por cima.",
        "topic": "Óleos & Hidratação"
    },
    {
        "user": "qual a diferenca entre rosa mosqueta canina e rubiginosa?",
        "bot": "A Rubiginosa é uma espécie com concentração ainda maior de ácidos graxos essenciais e trans-retinóico, ideal para regeneração celular intensa.",
        "topic": "Óleos & Hidratação"
    },
    {
        "user": "posso misturar oleo de melaleuca no sabonete liquido?",
        "bot": "Pode sim! Adicionar 2 a 3 gotas de óleo essencial de Melaleuca reforça a ação antisséptica e purificante.",
        "topic": "Óleos & Hidratação"
    },
    {
        "user": "qual oleo vegetal eh bom pra hidratar barba?",
        "bot": "O Óleo de Jojoba e o Óleo de Argan são maravilhosos para hidratar a barba sem deixar aspecto gorduroso! 🧔",
        "topic": "Óleos & Hidratação"
    },

    # Cuidados Capilares
    {
        "user": "como q usa a manteiga de ojon no cabelo ressecado?",
        "bot": "Você pode usar a Manteiga de Ojon como umectação noturna (aplicar no cabelo seco e lavar no dia seguinte) ou como pré-shampoo potente!",
        "topic": "Cuidados Capilares"
    },
    {
        "user": "oleo de alecrim ajuda no crescimento do cabelo de vdd?",
        "bot": "Sim! O Óleo Vegetal de Alecrim estimula a microcirculação no couro cabeludo, fortalecendo a raiz e acelerando o crescimento saudável.",
        "topic": "Cuidados Capilares"
    },
    {
        "user": "tonico capilar anti queda passa na raiz ou nas ponta?",
        "bot": "O Tônico Capilar Anti-Queda deve ser aplicado diretamente no couro cabeludo (raiz), massageando suavemente com a ponta dos dedos.",
        "topic": "Cuidados Capilares"
    },
    {
        "user": "manteiga de ojon serve pra cabelo cacheado?",
        "bot": "É perfeita para cacheados e crespos! Devolve a nutrição profunda, reduz o frizz e dá muito brilho.",
        "topic": "Cuidados Capilares"
    },

    # Frete & Entrega
    {
        "user": "quanto tempo demora pra chega em sao paulo vcs entrega rapido?",
        "bot": "Para São Paulo e região metropolitana a entrega costuma ser super rápida, geralmente de 2 a 4 dias úteis! 🚚",
        "topic": "Frete & Entrega"
    },
    {
        "user": "vcs entrega pro nordeste bahia recife?",
        "bot": "Entregamos para todo o Brasil via Correios (Sedex/PAC) e transportadoras parceiras!",
        "topic": "Frete & Entrega"
    },
    {
        "user": "boa tarde vcs tem loja fisica em sp ou eh so pelo site?",
        "bot": "Somos uma loja 100% online, o que nos permite entregar produtos fresquinhos e naturais direto na sua casa com todo carinho!",
        "topic": "Frete & Entrega"
    },
    {
        "user": "tem frete gratis acima de qual valor?",
        "bot": "Temos condições especiais de Frete Grátis dependendo da sua região! Você pode simular colocando os produtos no carrinho. 📦",
        "topic": "Frete & Entrega"
    },
    {
        "user": "boa noite como faço pra rastrear meu pedido q comprei?",
        "bot": "Após o envio, você recebe o código de rastreamento no seu e-mail e no painel 'Meus Pedidos' no site!",
        "topic": "Frete & Entrega"
    },

    # Atacado & Promoções
    {
        "user": "tem desconto pra compra no atacado kit grande?",
        "bot": "Sim! Temos opções especiais de atacado com kits de 60 unidades e condições exclusivas para revenda. Confira na aba Atacado no menu! 💼",
        "topic": "Atacado & Promoções"
    },
    {
        "user": "tem cupom de desconto pra primeira compra hj?",
        "bot": "Temos sim! Você pode jogar nossa Raspadinha de Prêmios ou fazer o Quiz de Pele para liberar cupons exclusivos! 🎁",
        "topic": "Atacado & Promoções"
    },
    {
        "user": "quanto custa o kit de clareamento potente?",
        "bot": "Você pode verificar o preço atualizado e parcelamento sem juros na página do produto no site!",
        "topic": "Atacado & Promoções"
    },

    # Dúvidas Gerais
    {
        "user": "esse tonico facial pode passa em pele sensivel q vermelha facil?",
        "bot": "Pode sim! O Tônico Facial Antioxidante é livre de álcool e formulado com extratos botânicos suaves e acalmantes.",
        "topic": "Dúvidas Gerais"
    },
    {
        "user": "creme pe de anjo serve pra calcanhar rachado e seco?",
        "bot": "Serve perfeitamente! Ele contém Ureia e Manteigas vegetais que restauram calcanhares e zonas muito ressecadas.",
        "topic": "Dúvidas Gerais"
    },
    {
        "user": "o quiç de pele eh de graça?",
        "bot": "Sim! O Quiz de Pele é 100% gratuito e rápido. No final ele te indica a rotina perfeita para o seu tipo de pele! ✨",
        "topic": "Dúvidas Gerais"
    },
    {
        "user": "os produtos de vcs sao 100% vegano e natural msm?",
        "bot": "Com certeza! Somos uma marca brasileira com compromisso 100% natural, artesanal, vegana e crueldade animal zero! 🐰🌱",
        "topic": "Dúvidas Gerais"
    }
]

def generate_lia_records(count=150, days=30, valid_user_ids=None):
    records = []
    now = datetime.now(timezone.utc)
    
    for _ in range(count):
        tpl = random.choice(LIA_TEMPLATES)
        user_msg = tpl["user"]
        bot_resp = tpl["bot"]
        topic = tpl["topic"]
        
        day_offset = random.randint(0, days - 1)
        hour = random.choices(range(24), weights=[1,1,1,1,1,1,2,4,6,8,9,10,10,9,8,8,9,10,10,10,9,7,5,3], k=1)[0]
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        
        click_dt = now - timedelta(days=day_offset, hours=hour, minutes=minute, seconds=second)
        
        # Se existirem IDs válidos de usuário, pode usar ocasionalmente, senão None
        if valid_user_ids and random.random() < 0.3:
            u_id = random.choice(valid_user_ids)
        else:
            u_id = None
            
        records.append((u_id, user_msg, bot_resp, topic, click_dt))
        
    records.sort(key=lambda x: x[4])
    return records

def inject_lia_interactions():
    result = urlparse(DB_URL)
    conn = psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=result.password,
        host=result.hostname,
        port=result.port,
        sslmode='require'
    )
    cur = conn.cursor()
    
    # Buscar IDs válidos de usuários na tabela users
    cur.execute("SELECT id FROM users LIMIT 10;")
    users_rows = cur.fetchall()
    valid_user_ids = [u[0] for u in users_rows] if users_rows else None
    print(f"Usuários encontrados na tabela users: {valid_user_ids}", flush=True)
    
    records = generate_lia_records(count=150, days=30, valid_user_ids=valid_user_ids)
    print(f"Gerados {len(records)} registros de conversas para a Lia.", flush=True)
    
    print("Inserindo conversas na tabela lia_interactions via execute_values...", flush=True)
    query = "INSERT INTO lia_interactions (user_id, user_message, bot_response, topic, created_at) VALUES %s"
    execute_values(cur, query, records)
    conn.commit()
    print("Inserção de conversas concluída!", flush=True)
    
    print("Sincronizando sequence de IDs da tabela lia_interactions...", flush=True)
    cur.execute("SELECT setval(pg_get_serial_sequence('lia_interactions', 'id'), COALESCE(MAX(id), 1)) FROM lia_interactions;")
    conn.commit()
    print("Sequence sincronizada!", flush=True)
    
    cur.execute("SELECT count(*) FROM lia_interactions;")
    total = cur.fetchone()[0]
    print(f"Total de conversas na tabela lia_interactions: {total}", flush=True)
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    inject_lia_interactions()
