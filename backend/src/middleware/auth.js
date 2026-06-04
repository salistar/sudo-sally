/**
 * ============================================================================
 * SALLYSUDO V3 - AUTH MIDDLEWARE
 * ============================================================================
 * Middleware d'authentification JWT
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware d'authentification obligatoire
 * Vérifie le token JWT et attache l'utilisateur à la requête
 */
module.exports = async (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'No token, authorization denied' 
      });
    }
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Token is not valid' 
      });
    }
    
    // Attacher l'utilisateur à la requête
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    console.error('[AUTH] Error:', error.message);
    res.status(401).json({ 
      success: false,
      error: 'Token is not valid' 
    });
  }
};