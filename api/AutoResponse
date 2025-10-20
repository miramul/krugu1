const axios = require('axios');

// 環境変数からアクセストークンを取得
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "IGAAX69AxSy9JBZAFFyemdlV1pPWDNMN0tPaTJFSmNzTWEtWk5xcHV3ZAGhRd1g1X3o4eFBPWEJ3ZAHVZAWHBfSmxOTXFGUExlZAGRvdTExM2hhMkJqMlFjOGl6d1RTbmkzZAnFoWHpidXYtTnZAzcGlVUG9mSGV2SDVOdUFXcEQ2ekxuRQZDZD";

// トークン検証用の変数
let tokenValidated = false;
let tokenValidationError = null;

// メッセージ重複防止用のメモリストレージ
const messageHistory = new Map();

// 設定データ（本来はデータベースを使用）
let botConfig = {
  triggerType: "all",
  triggerKeywords: "",
  excludeWords: false,
  excludeKeywords: "",
  firstTimeOnly: false,
  businessHoursOnly: false,
  actionTiming: "immediate",
  duplicateMessages: true,
  preventDuplicates: true,
  responses: [
    { condition: 'hello', message: 'Hello! How can I help you?', trigger: '挨拶' },
    { condition: 'こんにちは', message: 'こんにちは!何かお手伝いできることはありますか?', trigger: '挨拶' },
    { condition: 'ヘルプ', message: 'ご質問やお困りのことがあれば、お気軽にお聞かせください!', trigger: 'ヘルプ' },
    { condition: 'ありがとう', message: 'どういたしまして!他に何かお手伝いできることはありますか?', trigger: 'お礼' }
  ]
};

/**
 * 重複チェック関数（1分以内の同じメッセージをチェック）
 */
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
    messageHistory.set(senderId, filteredMessages);
  }
  
  return duplicate;
}

/**
 * トークンの有効性を検証する関数
 */
async function validateToken() {
  if (!PAGE_ACCESS_TOKEN) {
    console.log('❌ PAGE_ACCESS_TOKEN is not set!');
    tokenValidationError = 'Token not configured';
    return false;
  }
  
  try {
    console.log('🔐 Validating access token...');
    const response = await axios.get('https://graph.instagram.com/v21.0/me', {
      params: { 
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'id,username'
      }
    });
    
    console.log('✅ Token validated successfully!');
    console.log('📱 Instagram Account:', response.data);
    tokenValidated = true;
    tokenValidationError = null;
    return true;
  } catch (error) {
    console.log('❌ Token validation failed!');
    console.log('🔍 Error details:', {
      status: error.response?.status,
      message: error.response?.data?.error?.message || error.message,
      code: error.response?.data?.error?.code,
      type: error.response?.data?.error?.type
    });
    
    tokenValidated = false;
    tokenValidationError = error.response?.data?.error?.message || error.message;
    
    if (error.response?.status === 400) {
      console.log('⚠️ Token appears to be invalid or malformed');
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('⚠️ Token expired or insufficient permissions');
      console.log('💡 Please generate a new token at: https://developers.facebook.com/');
    } else if (error.response?.status === 190) {
      console.log('⚠️ Token has expired - please renew it');
    }
    
    return false;
  }
}

/**
 * DM送信関数
 */
async function sendDM(recipientId, message, messageNumber = '') {
  console.log(`📤 Attempting to send DM${messageNumber} to ${recipientId}: "${message}"`);
  
  if (!PAGE_ACCESS_TOKEN) {
    console.log('❌ PAGE_ACCESS_TOKEN is not set!');
    return null;
  }
  
  if (!tokenValidated) {
    console.log('⚠️ Token not validated, attempting validation...');
    const isValid = await validateToken();
    if (!isValid) {
      console.log('❌ Cannot send DM: Token validation failed');
      console.log('❌ Error:', tokenValidationError);
      return null;
    }
  }
  
  try {
    const response = await axios.post(`https://graph.instagram.com/v21.0/me/messages`, {
      recipient: { id: recipientId },
      message: { text: message }
    }, {
      params: { access_token: PAGE_ACCESS_TOKEN },
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`✅ DM${messageNumber} sent successfully:`, response.data);
    return response.data;
  } catch (error) {
    console.log(`❌ Failed to send DM${messageNumber}:`, error.response?.data || error.message);
    console.log(`🔍 Error details:`, {
      status: error.response?.status,
      data: error.response?.data,
      token: PAGE_ACCESS_TOKEN ? PAGE_ACCESS_TOKEN.substring(0, 20) + '...' : 'Not set'
    });
    
    if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 190) {
      console.log('🔄 Token may be expired, marking for revalidation...');
      tokenValidated = false;
      await validateToken();
    }
    
    return null;
  }
}

/**
 * 動的な返信メッセージ決定関数
 */
function getReplyMessage(text) {
  let reply = `Echo: ${text}`;

  for (const response of botConfig.responses) {
    if (response.condition === 'default') {
      reply = response.message;
      continue;
    }

    if (text && text.toLowerCase().includes(response.condition.toLowerCase())) {
      reply = response.message;
      console.log(`🎯 Matched condition: ${response.condition}`);
      break;
    }
  }

  // 除外ワード機能
  if (botConfig.excludeWords && botConfig.excludeKeywords) {
    const excludeList = botConfig.excludeKeywords.split(',').map(word => word.trim());
    for (const excludeWord of excludeList) {
      if (text && text.toLowerCase().includes(excludeWord.toLowerCase())) {
        console.log(`🚫 Excluded by word: ${excludeWord}`);
        return null;
      }
    }
  }

  // トリガータイプチェック
  if (botConfig.triggerType === 'keyword' && botConfig.triggerKeywords) {
    const triggerList = botConfig.triggerKeywords.split(',').map(word => word.trim());
    let shouldReply = false;
    
    for (const trigger of triggerList) {
      if (text && text.toLowerCase().includes(trigger.toLowerCase())) {
        shouldReply = true;
        break;
      }
    }
    
    if (!shouldReply) {
      console.log(`🚫 No trigger keyword matched`);
      return null;
    }
  }

  return reply;
}

/**
 * メッセージ処理関数（複製と重複防止機能付き）
 */
function processMessage(senderId, text, messageIndex = 1, totalMessages = 1) {
  console.log(`\n📩 Processing Message ${messageIndex}/${totalMessages} (1 second delayed)`);
  console.log(`✉️ Message from ${senderId}: "${text}"`);
  
  if (isDuplicateMessage(senderId, text)) {
    console.log(`🚫 Duplicate message detected within 1 minute - skipping message ${messageIndex}`);
    return;
  }
  
  console.log(`🔧 Using config: ${JSON.stringify(botConfig, null, 2)}`);
  console.log(`🔐 Token validated: ${tokenValidated}`);
  
  const reply = getReplyMessage(text);
  
  if (reply) {
    console.log(`💭 Reply ${messageIndex}: "${reply}"`);
    
    const delay = botConfig.actionTiming === 'immediate' ? 0 : 
                botConfig.actionTiming === 'delay-5' ? 5 * 60 * 1000 :
                botConfig.actionTiming === 'delay-10' ? 10 * 60 * 1000 :
                botConfig.actionTiming === 'delay-30' ? 30 * 60 * 1000 :
                botConfig.actionTiming === 'delay-60' ? 60 * 60 * 1000 : 0;
    
    if (delay > 0) {
      console.log(`⏰ Scheduling reply ${messageIndex} in ${delay / 1000} seconds`);
      setTimeout(() => {
        sendDM(senderId, reply, ` #${messageIndex}`);
      }, delay);
    } else {
      sendDM(senderId, reply, ` #${messageIndex}`);
    }
  } else {
    console.log(`🚫 No reply sent for message ${messageIndex} (filtered by configuration)`);
  }
}

/**
 * Webhookメッセージ処理（メインハンドラー）
 */
function handleWebhookMessage(body) {
  console.log('\n🎯 ==> AutoResponse Handler Started <==');
  console.log('📦 Request received');
  console.log('📋 Body:', JSON.stringify(body, null, 2));

  if (body && body.object === 'instagram') {
    console.log('✅ Instagram object detected');
    
    if (body.entry && Array.isArray(body.entry)) {
      console.log(`📦 Processing ${body.entry.length} entries`);
      
      body.entry.forEach((entry, entryIndex) => {
        console.log(`\n📦 Entry ${entryIndex + 1}:`);
        
        if (entry.messaging && Array.isArray(entry.messaging)) {
          console.log(`💬 Found ${entry.messaging.length} messaging events`);
          
          entry.messaging.forEach((event, eventIndex) => {
            console.log(`\n📩 Event ${eventIndex + 1}:`);
            
            if (event.message && event.sender && event.sender.id) {
              const senderId = event.sender.id;
              const text = event.message.text;
              
              console.log(`📨 Original message from ${senderId}: "${text}"`);
              console.log('🔄 Message duplication ALWAYS ENABLED - processing after 1 second delay...');
              
              // 1秒後に1つ目のメッセージ処理
              setTimeout(() => {
                processMessage(senderId, text, 1, 2);
              }, 1000);
              
              // 1.1秒後に2つ目のメッセージ処理
              setTimeout(() => {
                processMessage(senderId, text, 2, 2);
              }, 1100);
            }
          });
        }
      });
    }
  } else {
    console.log('❌ Not an Instagram object or invalid body');
  }
  
  console.log('🎯 ==> AutoResponse Handler Completed <==\n');
}

/**
 * 設定を取得
 */
function getConfig() {
  return botConfig;
}

/**
 * 設定を更新
 */
function updateConfig(newConfig) {
  const updatedConfig = { ...botConfig, ...newConfig };
  updatedConfig.duplicateMessages = true;
  updatedConfig.preventDuplicates = true;
  botConfig = updatedConfig;
  
  console.log('✅ Configuration updated successfully');
  console.log('🔧 New config applied:', JSON.stringify(botConfig, null, 2));
  
  return botConfig;
}

/**
 * メッセージ履歴をクリア
 */
function clearMessageHistory() {
  messageHistory.clear();
  console.log('🧹 Message history cleared');
}

/**
 * ステータス情報を取得
 */
function getStatus() {
  return {
    tokenValidated,
    tokenValidationError,
    messageHistorySize: messageHistory.size,
    config: botConfig,
    tokenConfigured: !!PAGE_ACCESS_TOKEN
  };
}

// 起動時にトークンを検証
validateToken().then(isValid => {
  if (isValid) {
    console.log('🎉 AutoResponse module ready!');
  } else {
    console.log('⚠️ WARNING: AutoResponse started but token validation failed');
  }
});

// モジュールのエクスポート
module.exports = {
  handleWebhookMessage,
  validateToken,
  getConfig,
  updateConfig,
  clearMessageHistory,
  getStatus,
  sendDM,
  processMessage,
  isDuplicateMessage,
  getReplyMessage
};
