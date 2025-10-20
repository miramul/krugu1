const { getFirestore, admin } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { postType, caption, hashtags, mediaUrls, scheduledTime } = req.body;
    console.log('📝 Creating scheduled post:', { postType, caption, scheduledTime });

    if (!mediaUrls || mediaUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'メディアURLが必要です'
      });
    }

    if (!scheduledTime) {
      return res.status(400).json({
        success: false,
        message: '投稿日時が必要です'
      });
    }

    // フロントエンドからはUTCのISO文字列で送信されてくる
    const scheduledDate = new Date(scheduledTime);
    
    console.log('📅 Received scheduledTime (UTC):', scheduledTime);
    console.log('📅 Parsed as Date:', scheduledDate.toISOString());
    
    // 日本時間での表示用（デバッグ）
    const jstDate = new Date(scheduledDate.getTime() + 9 * 60 * 60 * 1000);
    console.log('📅 JST equivalent:', jstDate.toISOString().replace('Z', '+09:00'));

    const now = new Date();
    
    if (scheduledDate <= now) {
      return res.status(400).json({
        success: false,
        message: '未来の日時を指定してください'
      });
    }

    const db = getFirestore();
    const newPost = {
      postType: postType || 'feed',
      caption: caption || '',
      hashtags: hashtags || [],
      mediaUrls: mediaUrls,
      scheduledTime: scheduledDate.toISOString(), // UTCで保存
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
      error: null
    };

    console.log('💾 Saving to Firestore:', newPost);
    const docRef = await db.collection('scheduledPosts').add(newPost);
    console.log('✅ Document created with ID:', docRef.id);

    res.json({
      success: true,
      message: '予約投稿を作成しました',
      postId: docRef.id
    });

  } catch (error) {
    console.error('❌ Error creating scheduled post:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました',
      error: error.message
    });
  }
};