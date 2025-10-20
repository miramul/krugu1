// api/auto-response-create.js - Firebase版
const { getDb } = require('../firebaseConfig');

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, trigger, keywords, message } = req.body;

    if (!name || !message) {
      return res.status(400).json({ 
        success: false,
        message: '管理名と返信メッセージは必須です' 
      });
    }

    const db = getDb();
    
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Firebaseが設定されていません'
      });
    }

    const newResponse = {
      name: name,
      trigger: trigger || 'dm',
      keywords: keywords || '',
      message: message,
      active: true,
      lastEdited: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('autoResponses').add(newResponse);

    console.log('✅ Auto-response created in Firebase:', docRef.id);

    return res.status(200).json({
      success: true,
      message: '自動応答を作成しました',
      response: {
        id: docRef.id,
        ...newResponse
      }
    });

  } catch (error) {
    console.error('❌ Error creating auto-response:', error);
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました: ' + error.message
    });
  }
};