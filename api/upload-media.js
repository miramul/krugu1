const multiparty = require('multiparty');
const { initializeFirebase } = require('../lib/firebase');
const { uploadMultipleMedia } = require('../lib/uploadMedia');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    initializeFirebase();

    const form = new multiparty.Form();

    const files = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve(files.media || []);
      });
    });

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ファイルがアップロードされていません'
      });
    }

    const fs = require('fs').promises;
    const fileData = await Promise.all(
      files.map(async (file) => ({
        buffer: await fs.readFile(file.path),
        mimetype: file.headers['content-type'],
        originalname: file.originalFilename
      }))
    );

    const mediaUrls = await uploadMultipleMedia(fileData);

    return res.status(200).json({
      success: true,
      message: 'メディアをアップロードしました',
      mediaUrls
    });

  } catch (error) {
    console.error('Error uploading media:', error);
    return res.status(500).json({
      success: false,
      message: 'メディアのアップロードに失敗しました',
      error: error.message
    });
  }
};