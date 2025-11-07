# 🚀 SIRU Backend - API com Next.js e PostgreSQL

Backend completo para o Sistema de Reservas Universitário (SIRU) usando Next.js, PostgreSQL (Neon) e autenticação JWT.

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Neon PostgreSQL (já configurada)

## 🛠️ Instalação

### 1. Instalar dependências
```bash
cd backend
npm install
```

### 2. Configurar variáveis de ambiente
Crie o arquivo `.env.local` (já criado):
```env
DATABASE_URL="postgresql://neondb_owner:npg_wI4NJHKXF2lZ@ep-dark-bird-ad71s1dg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
JWT_SECRET="seu-jwt-secret-super-seguro-aqui-mude-em-producao"
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Inicializar o banco de dados
```bash
npm run dev
```

Depois, faça uma requisição POST para:
```
http://localhost:3001/api/init
```

Ou use o comando curl:
```bash
curl -X POST http://localhost:3001/api/init
```

### 4. Executar o servidor
```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3001`

## 📡 Endpoints da API

### 🔐 Autenticação

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@siru.com",
  "password": "admin123"
}
```

#### Registro
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Nome do Usuário",
  "email": "usuario@exemplo.com",
  "siape": "123456",
  "password": "senha123",
  "role": "professor"
}
```

#### Verificar Token
```http
GET /api/auth/verify
Authorization: Bearer {token}
```

### 👥 Usuários

#### Listar Usuários
```http
GET /api/users
Authorization: Bearer {token}
```
*Requer role: admin ou coordenador*

### 🔧 Sistema

#### Inicializar Banco
```http
POST /api/init
```

## 👤 Usuários Padrão

O sistema cria automaticamente 6 usuários para teste:

| Tipo | Email | Senha | Role |
|------|-------|-------|------|
| **Admin** | admin@siru.com | admin123 | admin |
| **Professor** | joao.silva@universidade.edu | professor123 | professor |
| **Coordenador** | maria.santos@universidade.edu | coordenador123 | coordenador |
| **Aluno** | pedro.costa@aluno.universidade.edu | aluno123 | aluno |
| **Portaria** | ana.oliveira@universidade.edu | portaria123 | portaria |

## 🗄️ Estrutura do Banco

### Tabela: users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  siape VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'professor',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: rooms
```sql
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  capacity INTEGER NOT NULL,
  equipment TEXT[],
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: reservations
```sql
CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  room_id INTEGER REFERENCES rooms(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 Segurança

- **Senhas**: Criptografadas com bcrypt (12 rounds)
- **JWT**: Tokens com expiração de 24h
- **CORS**: Configurado para desenvolvimento
- **Validação**: Entrada de dados validada
- **SSL**: Conexão segura com Neon PostgreSQL

## 🚦 Status da API

### ✅ Implementado
- ✅ Autenticação JWT
- ✅ Login/Registro
- ✅ Verificação de token
- ✅ Gerenciamento de usuários
- ✅ Conexão com PostgreSQL
- ✅ Middleware de autenticação
- ✅ Controle de roles/permissões
- ✅ Seed do banco de dados
- ✅ CORS configurado

### 🔄 Próximos Passos
- 🔄 APIs de salas
- 🔄 APIs de reservas
- 🔄 Sistema de notificações
- 🔄 Upload de arquivos
- 🔄 Relatórios

## 🐛 Troubleshooting

### Erro de conexão com banco
```bash
# Verificar se as variáveis de ambiente estão corretas
cat .env.local

# Testar conexão
curl -X POST http://localhost:3001/api/init
```

### Erro de CORS
```bash
# Verificar se o frontend está rodando na porta correta
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

### Token inválido
```bash
# Verificar se o JWT_SECRET está configurado
# Fazer login novamente para obter novo token
```

## 📝 Scripts

```bash
npm run dev      # Executar em desenvolvimento
npm run build    # Build para produção
npm start        # Executar em produção (usa server.js para Render)
npm run lint     # Verificar código
```

## 🚀 Deploy no Render

Este backend está configurado para deploy no Render. Veja o arquivo `../DEPLOY_RENDER.md` na raiz do projeto para instruções completas.

### Configuração Rápida

1. Crie um novo Web Service no Render
2. Configure:
   - **Root Directory**: `backend` (ou deixe vazio se o repositório for só do backend)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Adicione as variáveis de ambiente:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ALLOWED_ORIGIN` (URL do frontend)
   - `NODE_ENV=production`

## 🔧 Desenvolvimento

### Estrutura de arquivos
```
backend/
├── lib/
│   ├── database.js      # Conexão PostgreSQL
│   ├── auth.js          # Funções de autenticação
│   └── seedDatabase.js  # Dados iniciais
├── pages/
│   └── api/
│       ├── auth/        # Endpoints de autenticação
│       ├── users/       # Endpoints de usuários
│       └── init.js      # Inicialização do banco
├── package.json
├── next.config.js
└── .env.local
```

---

**Desenvolvido para o Sistema de Reservas Universitário (SIRU)**  
*Backend completo com Next.js, PostgreSQL e JWT*
