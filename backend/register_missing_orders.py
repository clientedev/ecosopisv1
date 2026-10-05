import sqlite3
import json
from datetime import datetime

def insert_orders(db_path):
    print(f"Connecting to {db_path}...")
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Check if user exists
        cur.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1;")
        admin_row = cur.fetchone()
        admin_id = admin_row[0] if admin_row else 1
        
        # Check if columns exist
        cur.execute("PRAGMA table_info(orders);")
        cols = [c[1] for c in cur.fetchall()]
        print(f"Orders columns count: {len(cols)}")
        
        # Check if order 1 exists
        cur.execute("SELECT id FROM orders WHERE mercadopago_payment_id = '181368521047' OR (total = 19.89 AND payment_method = 'mercadolivre');")
        if cur.fetchone():
            print("Order 1 (181368521047) already exists.")
        else:
            items_1 = json.dumps([
                {
                    "product_id": 13,
                    "product_name": "Óleo Vegetal De Rosa Mosqueta Rubiginosa 100% Puro",
                    "quantity": 1,
                    "price": 19.89
                }
            ])
            address_1 = json.dumps({
                "street": "Envio via Mercado Envios",
                "number": "ML",
                "neighborhood": "Mercado Livre",
                "city": "Consulte etiqueta no painel ML",
                "state": "BR",
                "postal_code": "00000-000",
                "observacao": "Etiqueta e envio gerenciados diretamente pelo Mercado Envios"
            })
            cur.execute("""
                INSERT INTO orders (
                    user_id, status, total, shipping_price, shipping_method, payment_method,
                    mercadopago_payment_id, customer_name, customer_email, buyer_name, buyer_email,
                    items, address, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                admin_id, "paid", 19.89, 0.0, "Mercado Envios", "mercadolivre",
                "181368521047", "Comprador Mercado Livre", "vendas.mercadolivre@ecosopis.com.br",
                "Comprador Mercado Livre", "vendas.mercadolivre@ecosopis.com.br",
                items_1, address_1, "2026-10-04 15:57:00"
            ))
            order_1_id = cur.lastrowid
            
            # Also insert into order_items if table exists
            try:
                cur.execute("""
                    INSERT INTO order_items (order_id, product_id, quantity, price)
                    VALUES (?, ?, ?, ?);
                """, (order_1_id, 13, 1, 19.89))
            except Exception as oi_err:
                print(f"order_items insert note: {oi_err}")
                
            print(f"[OK] Order 1 inserted with ID {order_1_id}!")

        # Check if order 2 exists
        cur.execute("SELECT id FROM orders WHERE mercadopago_payment_id = '200001531507' OR (total = 49.79 AND payment_method = 'mercadolivre');")
        if cur.fetchone():
            print("Order 2 (200001531507) already exists.")
        else:
            items_2 = json.dumps([
                {
                    "product_id": 1,
                    "product_name": "Pedido de 3 produtos (Mercado Livre)",
                    "quantity": 3,
                    "price": 16.59
                }
            ])
            address_2 = json.dumps({
                "street": "Envio via Mercado Envios",
                "number": "ML",
                "neighborhood": "Mercado Livre",
                "city": "Consulte etiqueta no painel ML",
                "state": "BR",
                "postal_code": "00000-000",
                "observacao": "Etiqueta e envio gerenciados diretamente pelo Mercado Envios"
            })
            cur.execute("""
                INSERT INTO orders (
                    user_id, status, total, shipping_price, shipping_method, payment_method,
                    mercadopago_payment_id, customer_name, customer_email, buyer_name, buyer_email,
                    items, address, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                admin_id, "paid", 49.79, 0.0, "Mercado Envios", "mercadolivre",
                "200001531507", "Comprador Mercado Livre", "vendas.mercadolivre@ecosopis.com.br",
                "Comprador Mercado Livre", "vendas.mercadolivre@ecosopis.com.br",
                items_2, address_2, "2026-10-02 11:41:00"
            ))
            order_2_id = cur.lastrowid
            
            try:
                cur.execute("""
                    INSERT INTO order_items (order_id, product_id, quantity, price)
                    VALUES (?, ?, ?, ?);
                """, (order_2_id, 1, 3, 16.59))
            except Exception as oi_err:
                print(f"order_items insert note: {oi_err}")

            print(f"[OK] Order 2 inserted with ID {order_2_id}!")

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error on {db_path}: {e}")

if __name__ == "__main__":
    insert_orders("backend/sql_app.db")
    insert_orders("sql_app.db")
