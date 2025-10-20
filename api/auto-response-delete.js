// api/auto-response-delete.js - Firebase版
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

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: 'IDが指定されていません' 
      });
    }

    const db = getDb();
    
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Firebaseが設定されていません'
      });
    }

    await db.collection('autoResponses').doc(id).delete();

    console.log('🗑️ Auto-response deleted from Firebase:', id);

    return res.status(200).json({
      success: true,
      message: '自動応答を削除しました'
    });

  } catch (error) {
    console.error('❌ Error deleting auto-response:', error);
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました: ' + error.message
    });
  }
};