// api/webhook.js - Firebase統合版
const axios = require('axios');
const { getDb } = require('../firebaseConfig');

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = "my_verify_token";

// メモリストレージ（Firebaseがない場合のフォールバック）
const messageHistory = new Map();
let tokenValidated = false;
let tokenValidationError = null;

// トークン検証
async function validateToken() {
  if (!PAGE_ACCESS_TOKEN) {
    tokenValidationError = 'Token not configured';
    return false;
  }
  
  try {
    const response = await axios.get('https://graph.instagram.com/v21.0/me', {
      params: { 
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'id,username'
      }
    });
    
    console.log('✅ Token validated:', response.data);
    tokenValidated = true;
    tokenValidationError = null;
    return true;
  } catch (error) {
    console.log('❌ Token validation failed:', error.response?.data || error.message);
    tokenValidated = false;
    tokenValidationError = error.response?.data?.error?.message || error.message;
    return false;
  }
}

// 重複チェック
function isDuplicateMessage(senderId, text) {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  
  if (!messageHistory.has(senderId)) {
    messageHistory.set(senderId, []);
  }
  
  const userMessages = messageHistory.get(senderId);
  const filteredMessages = userMessages.filter(msg => msg.timestamp > oneMinuteAgo);
  messageHistory.set(senderId, filteredMessages);
  
  const duplicate = filteredMessages.some(msg => 
    msg.text === text && msg.timestamp > oneMinuteAgo
  );
  
  if (!duplicate) {
    filteredMessages.push({ text, timestamp: now });
  }
  
  return duplicate;
}

// DM送信
async function sendDM(recipientId, message) {
  if (!PAGE_ACCESS_TOKEN) {
    console.log('❌ PAGE_ACCESS_TOKEN not set');
    return null;
  }
  
  if (!tokenValidated) {
    await validateToken();
  }
  
  try {
    const response = await axios.post('https://graph.instagram.com/v21.0/me/messages', {
      recipient: { id: recipientId },
      message: { text: message }
    }, {
      params: { access_token: PAGE_ACCESS_TOKEN },
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ DM sent successfully');
    return response.data;
  } catch (error) {
    console.log('❌ Failed to send DM:', error.response?.data || error.message);
    return null;
  }
}

// Firebaseから自動応答設定を取得
async function getAutoResponses() {
  const db = getDb();
  
  if (!db) {
    // Firebaseが利用できない場合はデフォルト設定
    return [
      { condition: 'hello', message: 'Hello! How can I help you?', active: true },
      { condition: 'こんにちは', message: 'こんにちは！何かお手伝いできることはありますか？', active: true },
      { condition: 'ヘルプ', message: 'ご質問やお困りのことがあれば、お気軽にお聞かせください！', active: true },
      { condition: 'ありがとう', message: 'どういたしまして！他に何かお手伝いできることはありますか？', active: true }
    ];
  }

  try {
    const snapshot = await db.collection('autoResponses')
      .where('active', '==', true)
      .get();

    if (snapshot.empty) {
      console.log('No active auto-responses found');
      return [];
    }

    const responses = [];
    snapshot.forEach(doc => {
      responses.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📋 Loaded ${responses.length} active auto-responses from Firebase`);
    return responses;
  } catch (error) {
    console.error('❌ Error fetching auto-responses from Firebase:', error);
    return [];
  }
}

// 返信メッセージ決定
async function getReplyMessage(text) {
  const responses = await getAutoResponses();
  
  for (const response of responses) {
    if (response.keywords) {
      const keywords = response.keywords.split(',').map(k => k.trim());
      for (const keyword of keywords) {
        if (text && text.toLowerCase().includes(keyword.toLowerCase())) {
          console.log(`🎯 Matched keyword: ${keyword}`);
          return response.message;
        }
      }
    }
  }

  return null;
}

// メッセージ処理
async function processMessage(senderId, text) {
  console.log(`📩 Processing message from ${senderId}: "${text}"`);
  
  if (isDuplicateMessage(senderId, text)) {
    console.log('🚫 Duplicate detected - skipping');
    return;
  }
  
  const reply = await getReplyMessage(text);
  
  if (reply) {
    console.log(`💭 Sending reply: "${reply}"`);
    await sendDM(senderId, reply);
    
    // Firebaseにメッセージ履歴を保存
    const db = getDb();
    if (db) {
      try {
        await db.collection('messageHistory').add({
          senderId,
          receivedMessage: text,
          sentReply: reply,
          timestamp: new Date().toISOString()
        });
        console.log('📝 Message logged to Firebase');
      } catch (error) {
        console.error('❌ Error logging message to Firebase:', error);
      }
    }
  } else {
    console.log('🚫 No reply (no matching response)');
  }
}

// Webhookイベント処理
async function handleWebhookEvent(body) {
  try {
    if (!body || body.object !== 'instagram') {
      console.log('❌ Not an Instagram event');
      return;
    }

    console.log('✅ Instagram event detected');

    if (!body.entry || !Array.isArray(body.entry)) {
      console.log('❌ No entries found');
      return;
    }

    for (const entry of body.entry) {
      if (!entry.messaging || !Array.isArray(entry.messaging)) {
        continue;
      }

      for (const event of entry.messaging) {
        if (event.message && event.sender && event.sender.id) {
          const senderId = event.sender.id;
          const text = event.message.text || '';
          
          await processMessage(senderId, text);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing event:', error);
  }
}

// メインハンドラー
module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('\n🌐 Webhook request:', req.method);
    
    // GET: Webhook検証
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log('🔍 Verification:', { mode, token, challenge });

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Verification SUCCESS');
        return res.status(200).send(challenge);
      } else {
        console.log('❌ Verification FAILED');
        return res.status(403).json({ error: 'Verification failed' });
      }
    }
    
    // POST: Webhookイベント
    else if (req.method === 'POST') {
      console.log('📨 Webhook event received');
      
      // 先に200を返す（Meta要件）
      res.status(200).json({ received: true });
      
      // メッセージ処理（非同期）
      handleWebhookEvent(req.body);
      
      return;
    }
    
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 初回トークン検証
validateToken();