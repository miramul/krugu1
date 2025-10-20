
const scheduledPostProcessor = require('./scheduledPostProcessor');
const authFunctions = require('./authFunctions');

// 予約投稿処理
exports.processScheduledPosts = scheduledPostProcessor.processScheduledPosts;

// 認証関連の関数をエクスポート
exports.exchangeToken = authFunctions.exchangeToken;
exports.getInstagramAccount = authFunctions.getInstagramAccount;
exports.saveAuthConfig = authFunctions.saveAuthConfig;
exports.verifyToken = authFunctions.verifyToken;
exports.refreshToken = authFunctions.refreshToken;
exports.getAuthStatus = authFunctions.getAuthStatus;