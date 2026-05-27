#!/usr/bin/env node
/**
 * CRUD Operations Script
 * Usage: node scripts/crud.js <collection> <operation> [options]
 * 
 * Examples:
 *   node scripts/crud.js users list
 *   node scripts/crud.js users find --email=test@test.com
 *   node scripts/crud.js users create --username=john --email=john@test.com --password=123456
 *   node scripts/crud.js users update --id=xxx --coins=9999
 *   node scripts/crud.js users delete --id=xxx
 *   node scripts/crud.js games list --limit=10
 *   node scripts/crud.js levels list
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sudoku_sally';

// Parse arguments
const args = process.argv.slice(2);
const collection = args[0];
const operation = args[1];
const options = {};

args.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    options[key] = value;
  }
});

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const col = db.collection(collection);

    switch (operation) {
      case 'list':
        const limit = parseInt(options.limit) || 20;
        const docs = await col.find({}).limit(limit).toArray();
        console.log(`\n📋 ${collection} (${docs.length} documents):\n`);
        docs.forEach((doc, i) => {
          console.log(`${i + 1}.`, JSON.stringify(doc, null, 2));
        });
        break;

      case 'find':
        delete options.limit;
        const found = await col.findOne(options);
        if (found) {
          console.log('\n✅ Found:\n', JSON.stringify(found, null, 2));
        } else {
          console.log('\n❌ Not found');
        }
        break;

      case 'create':
        if (options.password) {
          const bcrypt = require('bcryptjs');
          options.password = await bcrypt.hash(options.password, 10);
        }
        options.createdAt = new Date();
        const result = await col.insertOne(options);
        console.log('\n✅ Created:', result.insertedId);
        break;

      case 'update':
        const id = options.id;
        delete options.id;
        const updateResult = await col.updateOne(
          { _id: new mongoose.Types.ObjectId(id) },
          { $set: options }
        );
        console.log('\n✅ Updated:', updateResult.modifiedCount, 'document(s)');
        break;

      case 'delete':
        const deleteResult = await col.deleteOne({ 
          _id: new mongoose.Types.ObjectId(options.id) 
        });
        console.log('\n✅ Deleted:', deleteResult.deletedCount, 'document(s)');
        break;

      case 'count':
        const count = await col.countDocuments(options);
        console.log(`\n📊 ${collection}: ${count} documents`);
        break;

      default:
        console.log(`
Usage: node scripts/crud.js <collection> <operation> [options]

Collections: users, games, levels, achievements, shopitems, dailychallenges

Operations:
  list    - List all documents (--limit=N)
  find    - Find one document (--field=value)
  create  - Create document (--field=value ...)
  update  - Update document (--id=xxx --field=value ...)
  delete  - Delete document (--id=xxx)
  count   - Count documents
        `);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
