const express = require('express');
const router = express.Router();
const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all shop items
router.get('/', async (req, res) => {
  try {
    const items = await ShopItem.find({ isActive: true });
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buy item
router.post('/buy', auth, async (req, res) => {
  try {
    const { itemId } = req.body;
    
    const item = await ShopItem.findOne({ itemId });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    const user = await User.findById(req.user.id);
    
    // Check if already owned (for themes)
    if (item.type === 'theme' && user.unlockedThemes.includes(itemId)) {
      return res.status(400).json({ error: 'Already owned' });
    }
    
    // Check balance
    const finalPrice = item.price * (1 - item.discount / 100);
    if (user.coins < finalPrice) {
      return res.status(400).json({ error: 'Not enough coins' });
    }
    
    // Process purchase
    user.coins -= finalPrice;
    
    if (item.type === 'theme') {
      user.unlockedThemes.push(itemId);
    } else if (item.type === 'powerup') {
      const powerupKey = item.powerupData.effect;
      user.ownedPowerups[powerupKey] = (user.ownedPowerups[powerupKey] || 0) + item.powerupData.quantity;
    }
    
    await user.save();
    
    res.json({ success: true, message: 'Purchase successful', balance: user.coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
