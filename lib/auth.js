import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setCorsHeaders } from './cors.js';

// Hash da senha
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Verificar senha
export const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Gerar JWT token
export const generateToken = (userId, email, role) => {
  const payload = {
    id: userId,
    userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h'
  });
};

// Verificar JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido');
  }
};

// Middleware de autenticação para APIs
export const authMiddleware = (handler) => {
  return async (req, res) => {
    // Configurar CORS sempre ANTES de qualquer verificação
    const isPreflight = setCorsHeaders(req, res);
    if (isPreflight) {
      return; // Preflight já foi respondido
    }

    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({ error: 'Token de acesso necessário' });
        return;
      }

      const decoded = verifyToken(token);
      req.user = decoded;
      
      await handler(req, res);
      return;
    } catch (error) {
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }
  };
};

// Middleware para verificar roles específicas
export const requireRole = (allowedRoles) => {
  return (handler) => {
    return authMiddleware(async (req, res) => {
      const userRole = req.user?.role;
      
      // Normalizar para comparação case-insensitive
      const normalizedUserRole = userRole?.toLowerCase()?.trim();
      const normalizedAllowedRoles = allowedRoles.map(role => role?.toLowerCase()?.trim());
      
      if (!normalizedUserRole || !normalizedAllowedRoles.includes(normalizedUserRole)) {
        console.error('Permissão negada:', {
          userRole,
          normalizedUserRole,
          allowedRoles,
          normalizedAllowedRoles,
          userId: req.user?.id,
          email: req.user?.email,
          userObject: req.user
        });
        res.status(403).json({ error: 'Permissão insuficiente' });
        return;
      }
      await handler(req, res);
      return;
    });
  };
};
