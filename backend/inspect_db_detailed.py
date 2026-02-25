from app.core.database import SessionLocal
from app.models import models
import json

def inspect():
    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        print(f"--- USERS ({len(users)}) ---")
        for u in users:
            print(f"ID: {u.id} | Email: {u.email} | Role: {u.role} | Spins: {u.pode_girar_roleta}")
            
        prizes = db.query(models.RoulettePrize).all()
        print(f"\n--- PRIZES ({len(prizes)}) ---")
        for p in prizes:
            print(f"ID: {p.id} | Name: {p.nome} | Active: {p.ativo} | Selected: {p.selecionado_para_sair}")
            
        config = db.query(models.RouletteConfig).first()
        if config:
            print(f"\n--- CONFIG ---")
            print(f"Active: {config.ativa} | Popup: {config.popup_ativo} | NewUserRule: {config.regra_novo_usuario}")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect()
