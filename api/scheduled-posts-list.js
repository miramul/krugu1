const { getFirestore } = require('../lib/firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { limit = 50, status } = req.query;
    const db = getFirestore();
    
    let query = db.collection('scheduledPosts')
      .orderBy('scheduledTime', 'desc')
      .limit(parseInt(limit));

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const posts = [];

    snapshot.forEach(doc => {
      posts.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return res.status(200).json({
      success: true,
      posts,
      total: posts.length
    });

  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return res.status(500).json({
      success: false,
      message: 'エラーが発生しました',
      error: error.message
    });
  }
};