const { getStorage } = require('firebase-admin/storage');
const crypto = require('crypto');

/**
 * メディアファイルをFirebase Storageにアップロード
 * @param {Buffer} fileBuffer - ファイルのバッファ
 * @param {string} mimeType - ファイルのMIMEタイプ
 * @param {string} originalName - 元のファイル名
 * @returns {Promise<string>} - アップロードされたファイルの公開URL
 */
async function uploadMediaToStorage(fileBuffer, mimeType, originalName) {
  try {
    const bucket = getStorage().bucket();
    
    // ユニークなファイル名を生成
    const fileExtension = originalName.split('.').pop();
    const randomString = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const fileName = `media/${timestamp}_${randomString}.${fileExtension}`;
    
    const file = bucket.file(fileName);
    
    // ファイルをアップロード
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          originalName: originalName,
          uploadedAt: new Date().toISOString()
        }
      },
      public: true, // 公開アクセスを許可
      validation: 'md5'
    });
    
    // 公開URLを生成
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    throw new Error('メディアのアップロードに失敗しました: ' + error.message);
  }
}

/**
 * 複数のメディアファイルをアップロード
 * @param {Array} files - アップロードするファイルの配列
 * @returns {Promise<Array<string>>} - アップロードされたファイルのURL配列
 */
async function uploadMultipleMedia(files) {
  try {
    const uploadPromises = files.map(file => 
      uploadMediaToStorage(file.buffer, file.mimetype, file.originalname)
    );
    
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('Error uploading multiple media:', error);
    throw new Error('メディアの一括アップロードに失敗しました: ' + error.message);
  }
}

/**
 * ストレージからファイルを削除
 * @param {string} fileUrl - 削除するファイルのURL
 */
async function deleteMediaFromStorage(fileUrl) {
  try {
    const bucket = getStorage().bucket();
    
    // URLからファイル名を抽出
    const fileName = fileUrl.split(`${bucket.name}/`)[1];
    
    if (!fileName) {
      throw new Error('無効なファイルURLです');
    }
    
    const file = bucket.file(fileName);
    await file.delete();
    
    console.log(`ファイルを削除しました: ${fileName}`);
  } catch (error) {
    console.error('Error deleting media from storage:', error);
    throw new Error('メディアの削除に失敗しました: ' + error.message);
  }
}

module.exports = {
  uploadMediaToStorage,
  uploadMultipleMedia,
  deleteMediaFromStorage
};