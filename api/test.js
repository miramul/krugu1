// 超シンプルなテスト用エンドポイント
// api/test.js として保存

module.exports = (req, res) => {
  res.status(200).json({ 
    message: 'Test endpoint is working!',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
};