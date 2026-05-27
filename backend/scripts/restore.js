#!/usr/bin/env node
/**
 * Database Restore Script
 * Run: node scripts/restore.js <backup_file.json>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sudoku_sally';

async function restore() {
  const backupFile = process.argv[2];
  
  if (!backupFile) {
    console.error('❌ Please provide backup file path');
    console.log('Usage: node scripts/restore.js <backup_file.json>');
    process.exit(1);
  }
  
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ File not found: ${backupFile}`);
    process.exit(1);
  }
  
  try {
    console.log('📥 Starting restore...');
    await mongoose.connect(MONGODB_URI);
    
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    for (const [collectionName, documents] of Object.entries(backupData)) {
      if (documents.length === 0) continue;
      
      const collection = mongoose.connection.collection(collectionName);
      await collection.deleteMany({});
      await collection.insertMany(documents);
      console.log(`   ✓ Restored ${documents.length} documents to ${collectionName}`);
    }
    
    console.log('\n✅ Restore completed!');
    
  } catch (error) {
    console.error('❌ Restore error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

restore();
