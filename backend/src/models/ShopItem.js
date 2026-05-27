const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['theme', 'powerup', 'avatar', 'bundle'], required: true },
  name: {
    en: String,
    fr: String,
    ar: String
  },
  description: {
    en: String,
    fr: String,
    ar: String
  },
  icon: String,
  
  // Pricing
  price: { type: Number, required: true },
  currency: { type: String, enum: ['coins', 'real'], default: 'coins' },
  discount: { type: Number, default: 0 }, // percentage
  
  // For themes
  themeData: {
    primary: String,
    secondary: String,
    background: [String],
    accent: String
  },
  
  // For powerups
  powerupData: {
    effect: String,
    quantity: { type: Number, default: 1 }
  },
  
  // Availability
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  availableFrom: Date,
  availableUntil: Date,
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ShopItem', shopItemSchema);
