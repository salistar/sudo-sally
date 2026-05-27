#!/usr/bin/env node
/**
 * Database Monitor Script
 * Run: node scripts/monitor.js
 * 
 * Shows real-time statistics
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sudoku_sally';

async function monitor() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📊 Database Monitor\n');
    
    const db = mongoose.connection.db;
    
    // Collection stats
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections:');
    
    for (const col of collections) {
      const stats = await db.collection(col.name).countDocuments();
      console.log(`   ${col.name}: ${stats} documents`);
    }
    
    // User stats
    const users = db.collection('users');
    const totalUsers = await users.countDocuments();
    const activeToday = await users.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    console.log('\n👥 Users:');
    console.log(`   Total: ${totalUsers}`);
    console.log(`   Active today: ${activeToday}`);
    
    // Game stats
    const games = db.collection('games');
    const totalGames = await games.countDocuments();
    const gamesWon = await games.countDocuments({ status: 'won' });
    const gamesToday = await games.countDocuments({
      startedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    console.log('\n🎮 Games:');
    console.log(`   Total: ${totalGames}`);
    console.log(`   Won: ${gamesWon} (${totalGames > 0 ? Math.round(gamesWon/totalGames*100) : 0}%)`);
    console.log(`   Today: ${gamesToday}`);
    
    // Top players
    const topPlayers = await users.find()
      .sort({ stars: -1 })
      .limit(5)
      .project({ username: 1, stars: 1 })
      .toArray();
    
    console.log('\n🏆 Top Players:');
    topPlayers.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.username}: ${p.stars} ⭐`);
    });
    
  } catch (error) {
    console.error('❌ Monitor error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

monitor();
