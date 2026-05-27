#!/usr/bin/env node
/**
 * Database Cleanup Script
 * Run: node scripts/clean.js [--all | --games | --guests]
 * 
 * Options:
 *   --all     : Delete all data (dangerous!)
 *   --games   : Delete old game sessions
 *   --guests  : Delete guest accounts older than 7 days
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sudoku_sally';

async function clean() {
  const option = process.argv[2];
  
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    
    switch (option) {
      case '--all':
        console.log('⚠️  Deleting ALL data...');
        const collections = await db.listCollections().toArray();
        for (const col of collections) {
          await db.collection(col.name).deleteMany({});
          console.log(`   ✓ Cleared ${col.name}`);
        }
        break;
        
      case '--games':
        console.log('🗑️  Cleaning old game sessions...');
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await db.collection('games').deleteMany({
          status: { $in: ['abandoned', 'lost'] },
          startedAt: { $lt: thirtyDaysAgo }
        });
        console.log(`   ✓ Deleted ${result.deletedCount} old games`);
        break;
        
      case '--guests':
        console.log('🗑️  Cleaning old guest accounts...');
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const guestResult = await db.collection('users').deleteMany({
          email: { $regex: /@guest\.local$/ },
          createdAt: { $lt: sevenDaysAgo }
        });
        console.log(`   ✓ Deleted ${guestResult.deletedCount} guest accounts`);
        break;
        
      default:
        console.log('Usage: node scripts/clean.js [--all | --games | --guests]');
    }
    
    console.log('\n✅ Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

clean();
