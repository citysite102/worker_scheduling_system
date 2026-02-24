/**
 * 圖片處理工具函式
 * 提供圖片裁切、壓縮、轉換等功能
 */

/**
 * 將圖片檔案裁切為正方形並壓縮至指定尺寸
 * @param file 原始圖片檔案
 * @param targetSize 目標尺寸（寬高相同），預設 200
 * @param quality JPEG 壓縮品質 (0-1)，預設 0.8
 * @returns Promise<string> Base64 編碼的圖片資料
 */
export async function cropAndCompressImage(
  file: File,
  targetSize: number = 200,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // 建立 Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('無法取得 Canvas context'));
          return;
        }
        
        // 設定 Canvas 尺寸為目標尺寸
        canvas.width = targetSize;
        canvas.height = targetSize;
        
        // 填充白色背景
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetSize, targetSize);
        
        // 計算繪製區域（保持比例，置中顯示）
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = (targetSize - scaledWidth) / 2;
        const offsetY = (targetSize - scaledHeight) / 2;
        
        // 繪製圖片至中心位置
        ctx.drawImage(
          img,
          0, 0, img.width, img.height, // 來源區域（完整圖片）
          offsetX, offsetY, scaledWidth, scaledHeight // 目標區域（置中）
        );
        
        // 轉換為 Base64（JPEG 格式）
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      
      img.onerror = () => {
        reject(new Error('圖片載入失敗'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('檔案讀取失敗'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * 驗證圖片檔案類型
 * @param file 檔案
 * @returns boolean 是否為有效的圖片檔案
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(file.type);
}

/**
 * 驗證圖片檔案大小
 * @param file 檔案
 * @param maxSizeMB 最大檔案大小（MB），預設 5MB
 * @returns boolean 是否符合大小限制
 */
export function isValidImageSize(file: File, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}
