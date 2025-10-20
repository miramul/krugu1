const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

// autoResponseモジュールをインポート
const autoResponse = require('./api/autoResponse');

app.use(bodyParser.json());
app.use(express.static('public'));

// 起動時のデバッグ情報
console.log('='.repeat(50));
console.log('🚀 Instagram DM Bot Starting...');
console.log('📅 Start Time:', new Date().toISOString());
console.log('🔧 Node Version:', process.version);
console.log('📍 Working Directory:', process.cwd());
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('⚡ Platform:', process.env.VERCEL ? 'Vercel' : 'Local');
console.log('🔄 Message Duplication: ALWAYS ENABLED');
console.log('🚫 Duplicate Prevention: ALWAYS ENABLED (1 minute window)');
console.log('='.repeat(50));

// Webhook検証エンドポイント（GET）- Meta要件に完全準拠
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "my_verify_token";
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('\n🔍 ==> Webhook GET Request Received <==');
  console.log('📋 Query Parameters:', JSON.stringify(req.query, null, 2));
  console.log('🔍 Verification Details:', { mode, token, challenge });
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('🔐 Expected Token:', VERIFY_TOKEN);
  console.log('🔐 Received Token:', token);

  // Metaの要件: mode='subscribe' AND token matches
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("✅ Webhook Verified Successfully!");
    console.log("📤 Sending challenge:", challenge);
    
    // 重要: challengeをそのまま返す（数値として）
    res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed");
    if (mode !== 'subscribe') {
      console.log("❌ Invalid mode:", mode);
    }
    if (token !== VERIFY_TOKEN) {
      console.log("❌ Token mismatch");
    }
    res.sendStatus(403);
  }
  console.log('='.repeat(40));
});

// Webhookメッセージ受信エンドポイント（POST）
app.post('/webhook', (req, res) => {
  console.log('\n📨 ==> Webhook POST Request Received <==');
  console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  
  // 先にレスポンスを返す（Metaの要件: 2秒以内に200を返す）
  res.sendStatus(200);
  
  // その後メッセージを処理
  try {
    autoResponse.handleWebhookMessage(req.body);
  } catch (error) {
    console.log('❌ Error processing webhook:', error);
  }
});

// 設定画面を配信
app.get('/config', (req, res) => {
  console.log('⚙️ Config page requested');
  res.sendFile(path.join(__dirname, 'config.html'));
});

// 現在の設定を取得
app.get('/api/config', (req, res) => {
  console.log('📋 Config data requested');
  res.json(autoResponse.getConfig());
});

// 設定を更新
app.post('/api/config', (req, res) => {
  console.log('💾 Config update requested');
  console.log('📋 New config:', JSON.stringify(req.body, null, 2));
  
  try {
    const updatedConfig = autoResponse.updateConfig(req.body);
    
    res.json({ 
      success: true, 
      message: 'Configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    console.log('❌ Failed to update configuration:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update configuration',
      error: error.message
    });
  }
});

// メッセージ履歴をクリア
app.post('/api/clear-history', (req, res) => {
  console.log('🧹 Message history clear requested');
  autoResponse.clearMessageHistory();
  
  res.json({
    success: true,
    message: 'Message history cleared',
    timestamp: new Date().toISOString()
  });
});

// トークン検証エンドポイント
app.get('/api/validate-token', async (req, res) => {
  console.log('🔐 Token validation requested via API');
  const isValid = await autoResponse.validateToken();
  const status = autoResponse.getStatus();
  
  res.json({
    valid: isValid,
    error: status.tokenValidationError,
    timestamp: new Date().toISOString()
  });
});

// 健康チェック
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  const status = autoResponse.getStatus();
  
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Instagram DM Bot is running',
    uptime: Math.floor(process.uptime()),
    node_version: process.version,
    platform: process.env.VERCEL ? 'Vercel' : 'Local',
    environment: process.env.NODE_ENV || 'development',
    dm_enabled: true,
    config_status: 'loaded',
    total_responses: status.config.responses.length,
    token_status: status.tokenConfigured ? 'configured' : 'missing',
    token_validated: status.tokenValidated,
    token_validation_error: status.tokenValidationError,
    message_duplication: true,
    duplicate_prevention: true,
    message_history_size: status.messageHistorySize
  };
  
  res.json(health);
});

// テスト用エンドポイント
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint accessed');
  const status = autoResponse.getStatus();
  
  res.json({ 
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
    success: true,
    dm_enabled: true,
    platform: process.env.VERCEL ? 'Vercel' : 'Local',
    token_configured: status.tokenConfigured,
    token_validated: status.tokenValidated,
    token_validation_error: status.tokenValidationError,
    message_duplication_enabled: true,
    duplicate_prevention_enabled: true,
    message_history_size: status.messageHistorySize,
    current_config: status.config
  });
});

// ルートエンドポイント
app.get('/', (req, res) => {
  console.log('🏠 Root endpoint accessed');
  const status = autoResponse.getStatus();
  
  res.json({
    message: 'Instagram Webhook Server with Message Duplication',
    status: 'running',
    platform: process.env.VERCEL ? 'Vercel Serverless' : 'Local Server',
    dm_enabled: true,
    token_status: status.tokenConfigured ? 'configured' : 'missing',
    token_validated: status.tokenValidated,
    token_validation_error: status.tokenValidationError,
    features: {
      message_duplication: true,
      duplicate_prevention: true,
      prevention_window: '1 minute',
      processing_delay: '1 second'
    },
    endpoints: {
      health: '/health',
      test: '/test',
      webhook: '/webhook',
      config: '/config',
      api_config: '/api/config',
      validate_token: '/api/validate-token',
      clear_history: '/api/clear-history'
    }
  });
});

// 404ハンドラー
app.use((req, res) => {
  console.log(`❓ 404 - Unknown endpoint: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// Vercel用のエクスポート
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Webhook server is running on port ${PORT}`);
    console.log(`🌍 Access URLs:`);
    console.log(`   - Root: http://localhost:${PORT}/`);
    console.log(`   - Health: http://localhost:${PORT}/health`);
    console.log(`   - Test: http://localhost:${PORT}/test`);
    console.log(`   - Webhook: http://localhost:${PORT}/webhook`);
    console.log(`   - Config: http://localhost:${PORT}/config`);
    console.log(`   - Validate Token: http://localhost:${PORT}/api/validate-token`);
    console.log(`   - Clear History: http://localhost:${PORT}/api/clear-history`);
    console.log('\n✅ DM sending is now ENABLED!');
    console.log('📤 Bot will automatically reply to Instagram DMs');
    console.log('🔄 Message Duplication: ALWAYS ENABLED (1 second delay)');
    console.log('🚫 Duplicate Prevention: ENABLED (1 minute window)');
  });
}

// プロセス終了時の処理
process.on('SIGTERM', () => {
  console.log('\n👋 Server shutting down gracefully...');
  autoResponse.clearMessageHistory();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Server shutting down gracefully...');
  autoResponse.clearMessageHistory();
  process.exit(0);
});