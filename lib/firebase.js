const admin = require('firebase-admin');

let firebaseApp;

function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // 環境変数からFirebase認証情報を取得
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }

    // JSON文字列をパース
    const serviceAccount = JSON.parse(serviceAccountString);

    // Firebase Admin SDKを初期化
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
    });

    console.log('✅ Firebase initialized successfully');
    console.log('📋 Project ID:', serviceAccount.project_id);
    return firebaseApp;
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    throw error;
  }
}

function getFirestore() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.firestore();
}

function getStorage() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.storage();
}

module.exports = {
  initializeFirebase,
  getFirestore,
  getStorage,
  admin
};
