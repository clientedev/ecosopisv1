import requests
import sys

# Change this if your backend is running on a different port
BACKEND_URL = "http://localhost:8000/orders/webhook"

def simulate_payment(payment_id, order_id):
    payload = {
        "action": "payment.created",
        "api_version": "v1",
        "data": {
            "id": payment_id
        },
        "date_created": "2026-03-06T10:00:00Z",
        "id": "1234567890",
        "live_mode": False,
        "type": "payment",
        "user_id": "3244971539"
    }
    
    print(f"Enviando simulação de webhook para o Pagamento {payment_id}...")
    try:
        response = requests.post(BACKEND_URL, json=payload)
        print(f"Status do Backend: {response.status_code}")
        print(f"Resposta: {response.json()}")
        print("\nNota: Para que o pedido mude para 'Pago', o Mercado Pago precisa retornar 'approved' para esse ID.")
    except Exception as e:
        print(f"Erro ao conectar com o backend: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python simulate_webhook.py <payment_id>")
        print("Exemplo: python simulate_webhook.py 123456789")
    else:
        simulate_payment(sys.argv[1], None)
