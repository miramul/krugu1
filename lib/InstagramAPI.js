const axios = require('axios');

/**
 * Instagram Graph API を使用して投稿を作成
 * 注意: Instagram Graph APIはビジネスアカウント/クリエイターアカウントのみ利用可能
 */

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v18.0';

/**
 * フィード投稿（画像・動画）を作成
 * @param {string} accessToken - Instagramアクセストークン
 * @param {string} instagramAccountId - InstagramビジネスアカウントID
 * @param {Array<string>} mediaUrls - メディアファイルのURL配列
 * @param {string} caption - キャプション
 * @returns {Promise<Object>} - 投稿結果
 */
async function createFeedPost(accessToken, instagramAccountId, mediaUrls, caption) {
  try {
    let containerId;

    if (mediaUrls.length === 1) {
      // 単一メディア投稿
      const mediaType = isVideoUrl(mediaUrls[0]) ? 'VIDEO' : 'IMAGE';
      
      // コンテナを作成
      const containerResponse = await axios.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
        {
          [mediaType === 'VIDEO' ? 'video_url' : 'image_url']: mediaUrls[0],
          caption: caption,
          access_token: accessToken
        }
      );

      containerId = containerResponse.data.id;

    } else {
      // カルーセル投稿（複数メディア）
      const childContainers = [];

      // 各メディアのコンテナを作成
      for (const mediaUrl of mediaUrls) {
        const mediaType = isVideoUrl(mediaUrl) ? 'VIDEO' : 'IMAGE';
        
        const childResponse = await axios.post(
          `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
          {
            [mediaType === 'VIDEO' ? 'video_url' : 'image_url']: mediaUrl,
            is_carousel_item: true,
            access_token: accessToken
          }
        );

        childContainers.push(childResponse.data.id);
      }

      // カルーセルコンテナを作成
      const carouselResponse = await axios.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
        {
          media_type: 'CAROUSEL',
          children: childContainers.join(','),
          caption: caption,
          access_token: accessToken
        }
      );

      containerId = carouselResponse.data.id;
    }

    // コンテナのステータスを確認（処理完了待ち）
    await waitForContainerReady(accessToken, containerId);

    // 投稿を公開
    const publishResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${instagramAccountId}/media_publish`,
      {
        creation_id: containerId,
        access_token: accessToken
      }
    );

    return {
      success: true,
      postId: publishResponse.data.id,
      message: 'フィード投稿を公開しました'
    };

  } catch (error) {
    console.error('Error creating feed post:', error.response?.data || error);
    throw new Error(`フィード投稿の作成に失敗: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * リール投稿を作成
 * @param {string} accessToken - Instagramアクセストークン
 * @param {string} instagramAccountId - InstagramビジネスアカウントID
 * @param {string} videoUrl - 動画ファイルのURL
 * @param {string} caption - キャプション
 * @returns {Promise<Object>} - 投稿結果
 */
async function createReelPost(accessToken, instagramAccountId, videoUrl, caption) {
  try {
    // リールコンテナを作成
    const containerResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
      {
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption,
        share_to_feed: true, // フィードにも共有
        access_token: accessToken
      }
    );

    const containerId = containerResponse.data.id;

    // コンテナのステータスを確認（処理完了待ち）
    await waitForContainerReady(accessToken, containerId, 60000); // リールは処理に時間がかかる

    // リールを公開
    const publishResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${instagramAccountId}/media_publish`,
      {
        creation_id: containerId,
        access_token: accessToken
      }
    );

    return {
      success: true,
      postId: publishResponse.data.id,
      message: 'リール投稿を公開しました'
    };

  } catch (error) {
    console.error('Error creating reel post:', error.response?.data || error);
    throw new Error(`リール投稿の作成に失敗: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * コンテナの準備完了を待つ
 * @param {string} accessToken - アクセストークン
 * @param {string} containerId - コンテナID
 * @param {number} maxWaitTime - 最大待機時間（ミリ秒）
 */
async function waitForContainerReady(accessToken, containerId, maxWaitTime = 30000) {
  const startTime = Date.now();
  const checkInterval = 2000; // 2秒ごとにチェック

  while (Date.now() - startTime < maxWaitTime) {
    const statusResponse = await axios.get(
      `${INSTAGRAM_API_BASE}/${containerId}`,
      {
        params: {
          fields: 'status_code',
          access_token: accessToken
        }
      }
    );

    const statusCode = statusResponse.data.status_code;

    if (statusCode === 'FINISHED') {
      return; // 準備完了
    } else if (statusCode === 'ERROR') {
      throw new Error('メディアの処理中にエラーが発生しました');
    }

    // まだ処理中の場合は待機
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error('メディアの処理がタイムアウトしました');
}

/**
 * URLが動画かどうかを判定
 * @param {string} url - 判定するURL
 * @returns {boolean} - 動画の場合true
 */
function isVideoUrl(url) {
  const videoExtensions = ['.mp4', '.mov', '.avi'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
}

/**
 * アクセストークンの有効性を確認
 * @param {string} accessToken - アクセストークン
 * @param {string} instagramAccountId - InstagramアカウントID
 * @returns {Promise<boolean>} - 有効な場合true
 */
async function validateAccessToken(accessToken, instagramAccountId) {
  try {
    const response = await axios.get(
      `${INSTAGRAM_API_BASE}/${instagramAccountId}`,
      {
        params: {
          fields: 'id,username',
          access_token: accessToken
        }
      }
    );

    return response.data && response.data.id === instagramAccountId;
  } catch (error) {
    console.error('Access token validation failed:', error.response?.data || error);
    return false;
  }
}

/**
 * 投稿を削除
 * @param {string} accessToken - アクセストークン
 * @param {string} mediaId - 削除するメディアID
 * @returns {Promise<Object>} - 削除結果
 */
async function deletePost(accessToken, mediaId) {
  try {
    await axios.delete(
      `${INSTAGRAM_API_BASE}/${mediaId}`,
      {
        params: {
          access_token: accessToken
        }
      }
    );

    return {
      success: true,
      message: '投稿を削除しました'
    };
  } catch (error) {
    console.error('Error deleting post:', error.response?.data || error);
    throw new Error(`投稿の削除に失敗: ${error.response?.data?.error?.message || error.message}`);
  }
}

module.exports = {
  createFeedPost,
  createReelPost,
  validateAccessToken,
  deletePost
};