/**
 * Database Cleanup Script
 * Clears test data from SearchHistory and PopularKeyword collections
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function clearTestData() {
  try {
    // Connect to database
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI || MONGODB_URI.includes('dummy')) {
      console.log('❌ No valid MongoDB URI found. Set MONGODB_URI in .env.local');
      return;
    }

    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    
    // Get database instance
    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📋 Found collections:', collections.map(c => c.name));
    
    // Clear SearchHistory and PopularKeyword collections
    const collectionsToClean = ['searchhistories', 'popularkeywords'];
    
    for (const collectionName of collectionsToClean) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      
      if (count > 0) {
        await collection.deleteMany({});
        console.log(`🗑️  Cleared ${count} documents from ${collectionName}`);
      } else {
        console.log(`✅ ${collectionName} was already empty`);
      }
    }
    
    console.log('🎉 Test data cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error clearing test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the cleanup
clearTestData().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
