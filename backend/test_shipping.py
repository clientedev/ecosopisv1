import sys
import os

# Adiciona o diretório atual ao sys.path para importar o serviço
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.core.melhorenvio_service import MelhorEnvioService

def test_shipping_logic():
    print("Iniciando teste de cálculo de frete...")
    
    # CEPs do teste solicitado
    cep_origem = "07430350"
    cep_destino = "08230010"
    
    # Mock de itens no carrinho
    items = [
        {
            "id": "produto_teste",
            "price": 50.00,
            "quantity": 1 # Deve disparar o mínimo seguro (16x12x20)
        }
    ]
    
    print(f"Origem: {cep_origem}")
    print(f"Destino: {cep_destino}")
    print(f"Itens: {items}")
    
    # O serviço já sobrescreve o STORE_CEP internamente se configurado ou usa o default
    # Mas para o teste, vamos garantir que ele use o CEP de origem solicitado se possível
    # Nota: STORE_CEP é pego de env, vamos assumir que o serviço configurou como 07430350 no arquivo anterior.
    
    options = MelhorEnvioService.calculate_shipping(cep_destino, items)
    
    if options:
        print("\n--- Opções de Frete Encontradas ---")
        for opt in options:
            print(f"{opt['company']} - {opt['name']}: R$ {opt['price']:.2f} ({opt['delivery_time']} dias)")
    else:
        print("\nFalha ao calcular frete ou nenhuma transportadora disponível.")

if __name__ == "__main__":
    test_shipping_logic()
