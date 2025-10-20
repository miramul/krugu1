const { getFirestore } = require('../lib/firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: '投稿IDを指定してください'
      });
    }

    const db = getFirestore();
    const docRef = db.collection('scheduledPosts').doc(id);
    
    // ドキュメントの存在確認
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: '指定された投稿が見つかりません'
      });
    }

    // ステータスが送信済みの場合は削除不可
    const postData = doc.data();
    if (postData.status === 'sent' || postData.status === 'published') {
      return res.status(400).json({
        success: false,
        message: '送信済みの投稿は削除できません'
      });
    }

    await docRef.delete();

    return res.status(200).json({
      success: true,
      message: '予約投稿を削除しました',
      id
    });

  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return res.status(500).json({
      success: false,
      message: 'エラーが発生しました',
      error: error.message
    });
  }
};