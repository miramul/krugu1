const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');

// 環境変数の定義
const INSTAGRAM_ACCESS_TOKEN = defineString('INSTAGRAM_ACCESS_TOKEN');
const INSTAGRAM_ACCOUNT_ID = defineString('INSTAGRAM_ACCOUNT_ID');

if (!admin.apps.length) {
  admin.initializeApp();
}

// Instagram Graph APIで投稿を作成
async function createInstagramPost(accessToken, accountId, mediaUrls, caption, postType) {
  try {
    console.log('📸 Creating Instagram post:', { postType, mediaCount: mediaUrls.length });

    if (postType === 'reel') {
      // リール投稿
      console.log('🎬 Creating Reel...');
      const containerResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${accountId}/media`,
        {
          media_type: 'REELS',
          video_url: mediaUrls[0],
          caption: caption
        },
        { params: { access_token: accessToken } }
      );

      console.log('⏳ Container created, waiting for processing...');
      const containerId = containerResponse.data.id;
      await waitForContainerReady(accessToken, containerId);

      console.log('📤 Publishing Reel...');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${accountId}/media_publish`,
        { creation_id: containerId },
        { params: { access_token: accessToken } }
      );

      return { success: true, postId: publishResponse.data.id };

    } else if (mediaUrls.length > 1) {
      // カルーセル投稿（複数画像/動画）
      console.log('🎠 Creating Carousel post...');
      const containerIds = [];
      
      for (const mediaUrl of mediaUrls) {
        const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.mov');
        console.log(`📎 Adding ${isVideo ? 'video' : 'image'}: ${mediaUrl}`);
        
        const containerResponse = await axios.post(
          `https://graph.facebook.com/v21.0/${accountId}/media`,
          {
            [isVideo ? 'video_url' : 'image_url']: mediaUrl,
            is_carousel_item: true
          },
          { params: { access_token: accessToken } }
        );
        containerIds.push(containerResponse.data.id);
      }

      console.log('⏳ Waiting for all media to be ready...');
      await Promise.all(containerIds.map(id => waitForContainerReady(accessToken, id)));

      console.log('🎨 Creating carousel container...');
      const carouselResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${accountId}/media`,
        {
          media_type: 'CAROUSEL',
          children: containerIds,
          caption: caption
        },
        { params: { access_token: accessToken } }
      );

      console.log('📤 Publishing carousel...');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${accountId}/media_publish`,
        { creation_id: carouselResponse.data.id },
        { params: { access_token: accessToken } }
      );

      return { success: true, postId: publishResponse.data.id };

    } else {
      // 単一画像/動画投稿
      console.log('🖼️ Creating single media post...');
      const mediaUrl = mediaUrls[0];
      const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.mov');
      
      console.log(`📎 Media type: ${isVideo ? 'video' : 'image'}`);
      const containerResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${accountId}/media`,
        {
          [isVideo ? 'video_url' : 'image_url']: mediaUrl,
          caption: caption
        },
        { params: { access_token: accessToken } }
      );

      console.log('⏳ Waiting for media to be ready...');
      const containerId = containerResponse.data.id;
      await waitForContainerReady(accessToken, containerId);

      console.log('📤 Publishing post...');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${accountId}/media_publish`,
        { creation_id: containerId },
        { params: { access_token: accessToken } }
      );

      return { success: true, postId: publishResponse.data.id };
    }
  } catch (error) {
    console.error('❌ Instagram API Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url
    });
    throw error;
  }
}

// コンテナの準備完了を待機
async function waitForContainerReady(accessToken, containerId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v21.0/${containerId}`,
        {
          params: {
            fields: 'status_code',
            access_token: accessToken
          }
        }
      );

      const statusCode = response.data.status_code;
      console.log(`📊 Container ${containerId} status: ${statusCode}`);

      if (statusCode === 'FINISHED') {
        return true;
      } else if (statusCode === 'ERROR') {
        throw new Error(`Container processing failed: ${containerId}`);
      }

      // EXPIRED, IN_PROGRESS の場合は待機
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
    } catch (error) {
      console.error(`⚠️ Error checking container status:`, error.message);
      if (i === maxAttempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`Container did not become ready in time: ${containerId}`);
}

// 1分ごとに実行（v2スケジューラー）
exports.processScheduledPosts = onSchedule({
  schedule: 'every 1 minutes',
  timeZone: 'Asia/Tokyo',
  memory: '512MiB',
  timeoutSeconds: 540
}, async (event) => {
  console.log('⏰ Checking for scheduled posts...');
  
  const now = new Date();
  const db = admin.firestore();
  
  try {
    const snapshot = await db.collection('scheduledPosts')
      .where('status', '==', 'pending')
      .where('scheduledTime', '<=', now.toISOString())
      .limit(10)
      .get();
    
    if (snapshot.empty) {
      console.log('🔭 No posts to process');
      return null;
    }
    
    console.log(`📬 Found ${snapshot.size} posts to process`);
    
    const accessToken = INSTAGRAM_ACCESS_TOKEN.value();
    const accountId = INSTAGRAM_ACCOUNT_ID.value();
    
    if (!accessToken || !accountId) {
      console.error('❌ Missing Instagram credentials in environment variables');
      return null;
    }
    
    console.log('🔑 Using Account ID:', accountId);
    
    const promises = snapshot.docs.map(async (doc) => {
      const post = doc.data();
      const postId = doc.id;
      
      try {
        console.log(`\n📝 Processing post ${postId}:`, {
          type: post.postType,
          mediaCount: post.mediaUrls?.length,
          scheduledTime: post.scheduledTime
        });

        await doc.ref.update({ 
          status: 'processing',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const caption = post.caption + ' ' + (post.hashtags || []).join(' ');
        
        const result = await createInstagramPost(
          accessToken,
          accountId,
          post.mediaUrls,
          caption,
          post.postType
        );
        
        await doc.ref.update({
          status: 'published',
          publishedAt: admin.firestore.FieldValue.serverTimestamp(),
          instagramPostId: result.postId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Successfully published post ${postId}`);
      } catch (error) {
        console.error(`❌ Failed to publish post ${postId}:`, error.message);
        
        await doc.ref.update({
          status: 'failed',
          error: error.message,
          errorDetails: error.response?.data ? JSON.stringify(error.response.data) : null,
          attempts: (post.attempts || 0) + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
    await Promise.all(promises);
    console.log('✨ Batch processing completed');
  } catch (error) {
    console.error('💥 Critical error:', error);
  }
  
  return null;
});