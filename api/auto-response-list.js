// api/auto-response-list.js - Firebase版
const { getDb } = require('../firebaseConfig');

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const db = getDb();
    
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Firebaseが設定されていません'
      });
    }

    const snapshot = await db.collection('autoResponses')
      .orderBy('createdAt', 'desc')
      .get();

    const responses = [];
    snapshot.forEach(doc => {
      responses.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`📋 Fetched ${responses.length} auto-responses from Firebase`);

    return res.status(200).json({
      success: true,
      responses: responses,
      total: responses.length
    });

  } catch (error) {
    console.error('❌ Error fetching auto-responses:', error);
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました: ' + error.message
    });
  }
};