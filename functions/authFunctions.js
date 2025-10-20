const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * STEP 2: 認証コードをアクセストークンに交換
 */
exports.exchangeToken = onRequest({
  cors: true,
  timeoutSeconds: 60
}, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        success: false,
        message: '認証コードが提供されていません' 
      });
    }

    // ⚠️ 一時的な設定（本番環境では必ず環境変数を使用）
    const FACEBOOK_APP_ID = '1894715221336033';
    const FACEBOOK_APP_SECRET = 'dc3a2dd78af2b773834b4d0608b548f7'; // ⬅️ ここを実際のApp Secretに置き換えてください
    const REDIRECT_URI = 'https://krugu1-git-main-miramuls-projects.vercel.app/auth-callback.html';

    console.log('🔑 Exchanging code for access token...');
    console.log('📋 App ID:', FACEBOOK_APP_ID);
    console.log('📋 Redirect URI:', REDIRECT_URI);

    // 短期アクセストークンを取得
    const tokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI
      }
    });

    const shortLivedToken = tokenResponse.data.access_token;
    console.log('✅ Short-lived token obtained');

    // 長期アクセストークンに交換
    console.log('🔄 Converting to long-lived token...');
    const longLivedResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: shortLivedToken
      }
    });

    const longLivedToken = longLivedResponse.data.access_token;
    console.log('✅ Long-lived token obtained');

    // ユーザーIDを取得
    const userResponse = await axios.get('https://graph.facebook.com/v21.0/me', {
      params: {
        access_token: longLivedToken
      }
    });

    return res.json({
      success: true,
      accessToken: longLivedToken,
      userId: userResponse.data.id,
      expiresIn: longLivedResponse.data.expires_in
    });

  } catch (error) {
    console.error('❌ Token exchange error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'アクセストークンの取得に失敗しました',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * STEP 3: Instagramビジネスアカウント情報を取得
 */
exports.getInstagramAccount = onRequest({
  cors: true,
  timeoutSeconds: 60
}, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken, userId } = req.body;

    if (!accessToken || !userId) {
      return res.status(400).json({
        success: false,
        message: 'アクセストークンまたはユーザーIDが提供されていません'
      });
    }

    console.log('📄 Fetching Facebook Pages...');

    // Facebookページ一覧を取得
    const pagesResponse = await axios.get(`https://graph.facebook.com/v21.0/${userId}/accounts`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,access_token'
      }
    });

    if (!pagesResponse.data.data || pagesResponse.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facebookページが見つかりません。先にFacebookページを作成してください。'
      });
    }

    // 最初のページを使用（複数ページがある場合は選択UIが必要）
    const page = pagesResponse.data.data[0];
    const pageAccessToken = page.access_token;
    
    console.log(`📄 Using page: ${page.name} (${page.id})`);
    console.log('📸 Fetching Instagram Business Account...');

    // ページに紐づくInstagramビジネスアカウントを取得
    const igAccountResponse = await axios.get(`https://graph.facebook.com/v21.0/${page.id}`, {
      params: {
        fields: 'instagram_business_account',
        access_token: pageAccessToken
      }
    });

    if (!igAccountResponse.data.instagram_business_account) {
      return res.status(404).json({
        success: false,
        message: 'このFacebookページにInstagramビジネスアカウントが接続されていません。Instagram設定でビジネスアカウントを接続してください。'
      });
    }

    const igAccountId = igAccountResponse.data.instagram_business_account.id;

    // Instagramアカウント情報を取得
    const igInfoResponse = await axios.get(`https://graph.facebook.com/v21.0/${igAccountId}`, {
      params: {
        fields: 'id,username,name,profile_picture_url,followers_count',
        access_token: pageAccessToken
      }
    });

    console.log('✅ Instagram account found:', igInfoResponse.data.username);

    return res.json({
      success: true,
      instagramAccountId: igAccountId,
      username: igInfoResponse.data.username,
      name: igInfoResponse.data.name,
      profilePicture: igInfoResponse.data.profile_picture_url,
      followersCount: igInfoResponse.data.followers_count,
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: pageAccessToken
    });

  } catch (error) {
    console.error('❌ Instagram account fetch error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Instagramアカウント情報の取得に失敗しました',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * STEP 4: 認証情報をFirestoreに保存
 */
exports.saveAuthConfig = onRequest({
  cors: true,
  timeoutSeconds: 60
}, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      accessToken, 
      instagramAccountId, 
      username,
      pageId,
      pageName,
      pageAccessToken,
      profilePicture,
      followersCount
    } = req.body;

    if (!accessToken || !instagramAccountId) {
      return res.status(400).json({
        success: false,
        message: '必要な情報が不足しています'
      });
    }

    console.log('💾 Saving authentication config...');

    const db = admin.firestore();
    
    // 認証情報を保存（実際の運用では暗号化推奨）
    await db.collection('config').doc('instagram').set({
      accessToken: accessToken,
      pageAccessToken: pageAccessToken,
      instagramAccountId: instagramAccountId,
      pageId: pageId,
      pageName: pageName,
      username: username,
      profilePicture: profilePicture || null,
      followersCount: followersCount || 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true
    }, { merge: true });

    console.log('✅ Configuration saved successfully');

    // アクティビティログを記録
    await db.collection('activityLogs').add({
      type: 'auth_success',
      username: username,
      instagramAccountId: instagramAccountId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      message: '認証情報を保存しました',
      username: username
    });

  } catch (error) {
    console.error('❌ Save config error:', error);
    return res.status(500).json({
      success: false,
      message: '設定の保存に失敗しました',
      error: error.message
    });
  }
});

/**
 * トークンの有効性を検証
 */
exports.verifyToken = onRequest({
  cors: true,
  timeoutSeconds: 30
}, async (req, res) => {
  try {
    const db = admin.firestore();
    const configDoc = await db.collection('config').doc('instagram').get();

    if (!configDoc.exists) {
      return res.status(404).json({
        success: false,
        isValid: false,
        message: '認証情報が見つかりません'
      });
    }

    const config = configDoc.data();
    const pageAccessToken = config.pageAccessToken;

    // トークンの有効性をチェック
    const debugResponse = await axios.get('https://graph.facebook.com/v21.0/debug_token', {
      params: {
        input_token: pageAccessToken,
        access_token: config.accessToken
      }
    });

    const tokenData = debugResponse.data.data;
    const isValid = tokenData.is_valid;
    const expiresAt = tokenData.expires_at;

    // 有効期限が30日以内の場合は警告
    const now = Math.floor(Date.now() / 1000);
    const daysUntilExpiry = expiresAt ? Math.floor((expiresAt - now) / 86400) : null;
    const needsRefresh = daysUntilExpiry !== null && daysUntilExpiry < 30;

    return res.json({
      success: true,
      isValid: isValid,
      expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
      daysUntilExpiry: daysUntilExpiry,
      needsRefresh: needsRefresh,
      username: config.username
    });

  } catch (error) {
    console.error('❌ Token verification error:', error);
    return res.status(500).json({
      success: false,
      isValid: false,
      message: 'トークンの検証に失敗しました',
      error: error.message
    });
  }
});

/**
 * トークンを更新（リフレッシュ）
 */
exports.refreshToken = onRequest({
  cors: true,
  timeoutSeconds: 60,
  secrets: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']
}, async (req, res) => {
  try {
    const db = admin.firestore();
    const configDoc = await db.collection('config').doc('instagram').get();

    if (!configDoc.exists) {
      return res.status(404).json({
        success: false,
        message: '認証情報が見つかりません'
      });
    }

    const config = configDoc.data();
    const currentToken = config.accessToken;

    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

    console.log('🔄 Refreshing access token...');

    // トークンを更新
    const refreshResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: currentToken
      }
    });

    const newToken = refreshResponse.data.access_token;
    const expiresIn = refreshResponse.data.expires_in;

    // 新しいトークンを保存
    await db.collection('config').doc('instagram').update({
      accessToken: newToken,
      lastRefreshed: admin.firestore.FieldValue.serverTimestamp(),
      tokenExpiresIn: expiresIn
    });

    console.log('✅ Token refreshed successfully');

    return res.json({
      success: true,
      message: 'トークンを更新しました',
      expiresIn: expiresIn
    });

  } catch (error) {
    console.error('❌ Token refresh error:', error);
    return res.status(500).json({
      success: false,
      message: 'トークンの更新に失敗しました',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * 認証状態を取得
 */
exports.getAuthStatus = onRequest({
  cors: true,
  timeoutSeconds: 30
}, async (req, res) => {
  try {
    const db = admin.firestore();
    const configDoc = await db.collection('config').doc('instagram').get();

    if (!configDoc.exists) {
      return res.json({
        success: true,
        isAuthenticated: false,
        message: 'Instagram連携が必要です'
      });
    }

    const config = configDoc.data();

    return res.json({
      success: true,
      isAuthenticated: true,
      username: config.username,
      instagramAccountId: config.instagramAccountId,
      profilePicture: config.profilePicture,
      followersCount: config.followersCount,
      lastUpdated: config.lastUpdated?.toDate()?.toISOString() || null
    });

  } catch (error) {
    console.error('❌ Get auth status error:', error);
    return res.status(500).json({
      success: false,
      message: '認証状態の取得に失敗しました',
      error: error.message
    });
  }

});
