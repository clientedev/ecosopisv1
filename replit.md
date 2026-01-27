# ECOSOPIS E-commerce

## Overview

ECOSOPIS is a modern e-commerce platform for natural and vegan cosmetics. The application uses a decoupled architecture with a Python FastAPI backend and a Next.js 14 frontend. The platform features product catalog management, user authentication with JWT, a skin quiz for personalized recommendations, a subscription box service, and an AI chat consultant interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 14 with App Router
- **Styling**: CSS Modules with CSS custom properties for theming
- **Typography**: Google Fonts (Raleway for headers, Karla for body)
- **Icons**: Lucide React
- **State Management**: React useState/useEffect hooks (no external state library)
- **API Communication**: Native fetch API with dynamic URL resolution based on environment

The frontend follows Next.js App Router conventions with pages organized under `src/app/`. Components are modular and stored in `src/components/` with co-located CSS modules.

### Backend Architecture
- **Framework**: FastAPI (Python)
- **ORM**: SQLAlchemy with declarative base
- **Authentication**: JWT tokens using python-jose, password hashing with passlib/bcrypt
- **API Structure**: RESTful endpoints organized under `app/api/endpoints/`
- **Database Migrations**: Alembic (configured but migrations not shown)

The backend follows a layered architecture:
- `app/core/` - Database connection, security utilities
- `app/models/` - SQLAlchemy ORM models
- `app/schemas/` - Pydantic validation schemas
- `app/api/endpoints/` - Route handlers

### Data Models
- **User**: Authentication with email/password, roles (admin/client)
- **Product**: Full product catalog with tags, multiple sales channels (site, MercadoLivre, Shopee)
- **Order**: Order tracking with status, items, and shipping address (JSON fields)
- **StoredImage**: Images stored as binary data in PostgreSQL (persists across redeploys)

### Image Storage
Images are stored directly in PostgreSQL using the `stored_images` table. This ensures images persist across Railway redeploys. The image endpoints are:
- `POST /images/upload` - Upload image (returns `/images/{id}` URL)
- `GET /images/{id}` - Retrieve image by ID

### Authentication Flow
1. User submits credentials via OAuth2PasswordRequestForm
2. Backend validates and returns JWT access token with role
3. Frontend stores token in localStorage
4. Protected routes check for token presence
5. Admin routes require admin role validation

### Key Pages
- `/` - Homepage with hero, product carousel
- `/produtos` - Product catalog with filtering
- `/produtos/[slug]` - Product detail page
- `/quizz` - Skin type quiz for recommendations
- `/box` - Subscription box service
- `/conta` - User login/registration
- `/admin` - Admin login
- `/admin/dashboard` - Product management

## External Dependencies

### Backend Dependencies
- **FastAPI**: Web framework
- **SQLAlchemy + psycopg2-binary**: PostgreSQL ORM and driver
- **python-jose[cryptography]**: JWT token handling
- **passlib[bcrypt]**: Password hashing
- **python-dotenv**: Environment variable management
- **OpenAI**: AI integration (configured but implementation pending)
- **httpx**: HTTP client for external API calls

### Frontend Dependencies
- **Next.js 14**: React framework
- **React 18**: UI library
- **lucide-react**: Icon library

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT signing key
- `ALGORITHM`: JWT algorithm (e.g., HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time
- `NEXT_PUBLIC_API_URL`: Backend API URL for frontend

### External Integrations
- **MercadoLivre**: Product listings (URL-based integration)
- **Shopee**: Product listings (URL-based integration)
- **OpenAI**: AI chat consultant (dependency present, implementation pending)

### Database
- **PostgreSQL**: Primary database
- Tables auto-created via SQLAlchemy `Base.metadata.create_all()`
- Seed script available at `backend/seed.py` for initial data

### Deployment
- Configured for Railway deployment
- Frontend runs on port 5000
- Backend runs via uvicorn with PORT environment variable