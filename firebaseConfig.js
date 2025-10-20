// firebaseConfig.js
const admin = require('firebase-admin');

let db = null;

function initializeFirebase() {
  if (db) {
    return db;
  }

  try {
    // 環境変数からFirebase認証情報を取得
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT || '{}'
    );

    if (!serviceAccount.project_id) {
      console.log('⚠️ Firebase not configured - using memory storage');
      return null;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    console.log('✅ Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    return null;
  }
}

module.exports = {
  getDb: () => {
    if (!db) {
      return initializeFirebase();
    }
    return db;
  }
};