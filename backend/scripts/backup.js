#!/usr/bin/env node
/**
 * Database Backup Script
 * Run: node scripts/backup.js
 * 
 * Creates a JSON backup of all collections
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sudoku_sally';

async function backup() {
  try {
    console.log('💾 Starting backup...');
    await mongoose.connect(MONGODB_URI);
    
    const collections = ['users', 'games', 'levels', 'achievements', 'dailychallenges', 'shopitems', 'leaderboardentries'];
    const backupDir = path.join(__dirname, '../backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {};
    
    for (const collectionName of collections) {
      const collection = mongoose.connection.collection(collectionName);
      const data = await collection.find({}).toArray();
      backupData[collectionName] = data;
      console.log(`   ✓ Backed up ${data.length} documents from ${collectionName}`);
    }
    
    const backupFile = path.join(backupDir, `backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    console.log(`\n✅ Backup saved to: ${backupFile}`);
    
  } catch (error) {
    console.error('❌ Backup error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

backup();
