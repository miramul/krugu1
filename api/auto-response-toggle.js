// api/auto-response-toggle.js - Firebase版
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

    const { id, active } = req.body;

    if (!id || typeof active !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        message: 'IDまたはactive状態が不正です' 
      });
    }

    const db = getDb();
    
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Firebaseが設定されていません'
      });
    }

    await db.collection('autoResponses').doc(id).update({
      active: active,
      lastEdited: new Date().toISOString()
    });

    console.log(`🔄 Auto-response toggled in Firebase: ${id} -> ${active}`);

    return res.status(200).json({
      success: true,
      message: active ? '自動応答を有効にしました' : '自動応答を無効にしました'
    });

  } catch (error) {
    console.error('❌ Error toggling auto-response:', error);
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました: ' + error.message
    });
  }
};