// db.js

// Nạp thư viện Dexie từ thư mục lib
importScripts('lib/dexie.min.js');

// Khởi tạo Database tên là 'TabScreenshotDB'
const db = new Dexie('TabScreenshotDB');

// Định nghĩa cấu trúc các bảng (schema)
// version(2): Đảm bảo đầy đủ bảng cho cả chức năng hình nền và chụp ảnh (nếu sau này bạn muốn dùng)
db.version(2).stores({
    screenshots: 'tabId,imageData', // Bảng lưu ảnh chụp màn hình tab
    wallpaper: 'id'                 // Bảng lưu hình nền máy tính (quan trọng cho yêu cầu này)
});

// Mở kết nối
db.open().catch(function (e) {
    console.error("Mở Database thất bại: " + e);
});