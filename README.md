# ECOSOPIS E-commerce

E-commerce moderno e profissional para cosméticos naturais e veganos.

## 🚀 Stack

- **Backend**: FastAPI + PostgreSQL + JWT Auth
- **Frontend**: Next.js 14 + CSS Modules
- **Deploy**: Railway

## 📦 Estrutura

```
ecosopis-v3/
├── backend/          # API Python (FastAPI)
├── frontend/         # Interface Next.js
└── README.md
```

## 🛠️ Executar Localmente

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔐 Credenciais Padrão

- Email: `admin@ecosopis.com.br`
- Senha: `admin123`

## 📄 Documentação

Veja [walkthrough.md](https://github.com/seu-usuario/ecosopis-v3/blob/main/docs/walkthrough.md) para documentação completa.

## 🎨 Features

✅ Catálogo de produtos  
✅ Multi-canal (Site/ML/Shopee)  
✅ Quiz de tipo de pele  
✅ Box Surpresa  
✅ Chat IA  
✅ Admin Dashboard  

---

© 2026 ECOSOPIS - Cosméticos Naturais e Veganos
