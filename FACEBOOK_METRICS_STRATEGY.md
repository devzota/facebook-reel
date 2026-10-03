# Chiến Lược Trích Xuất Dữ Liệu Facebook Graph API (v25.0+)

Tài liệu này ghi chú lại chi tiết các kinh nghiệm, kỹ thuật, và các "bẫy" khi lấy dữ liệu bài viết (Insights & Engagements) từ Facebook Graph API (cập nhật từ v20.0 đến v25.0+). Những kiến thức này đã được áp dụng và xác minh độ chính xác 100% so với **Meta Business Suite**.

## 1. Các vấn đề (Bẫy) thường gặp với Graph API mới

1. **Metrics `_unique` bị Deprecated**: Các chỉ số ở cấp độ bài viết như `post_impressions_unique`, `post_impressions`, `post_video_views_unique` hiện tại không còn hoạt động ổn định trên nhiều fanpage. Gọi các metric này có thể dẫn đến lỗi `(#100) The value must be a valid insights metric` hoặc trả về mảng rỗng (0).
2. **Đa chu kỳ (Multiple Periods)**: Khi gọi `/insights`, API thường trả về 1 mảng gồm nhiều chu kỳ cho cùng một metric (ví dụ: `lifetime`, `days_28`, `day`). Nếu dùng vòng lặp lưu đè giá trị mà không kiểm tra, giá trị `lifetime` (trọn đời) sẽ bị ghi đè thành 0 bởi giá trị `day` (chu kỳ ngắn hạn hoặc hết hạn cache của Facebook).
3. **Lỗi Quyền (Permission Error #200)**: Khi token fanpage thiếu quyền `pages_read_engagement`, gọi `reactions.summary(true)` trực tiếp ở node `/published_posts` sẽ bị báo lỗi `(#200) Missing Permissions`.
4. **Insights trễ (Delay)**: Các thông số insights của bài viết mới có thể bị trễ tới 24h, nhưng thông số tương tác (like, comment, share) thì luôn là Real-time (Thời gian thực).

---

## 2. Công Thức Chuẩn Đã Áp Dụng (Đảm bảo khớp số liệu 100%)

### Bước 2.1: Gọi Node `/published_posts` (Lấy Real-time)
Cố gắng lấy các chỉ số tương tác trực tiếp ở thời gian thực từ node bài viết.
```javascript
GET /{page_id}/published_posts?fields=id,message,created_time,full_picture,reactions.summary(true),comments.summary(true),shares
```
*Lưu ý*: Gọi kèm cấu trúc Try/Catch. Nếu lỗi #200 (Missing Permissions), hãy tự động fallback gọi lại API trên nhưng bỏ các trường `reactions`, `comments`, `shares` ra khỏi `fields`.

### Bước 2.2: Gọi Node `/{post_id}/insights` (Lấy Metric mới chuẩn nhất)
Sau khi có Post ID, ta gọi API Insights với các Metric THAY THẾ (active ở v25.0) như sau:
```javascript
GET /{post_id}/insights?metric=post_media_view,post_total_media_view_unique,post_video_views,post_clicks,post_clicks_by_type,post_activity_by_action_type
```

**Chi tiết các metric này:**
- `post_media_view`: Tương đương **Lượt hiển thị / Lượt xem (Impressions/Views)**
- `post_total_media_view_unique`: Tương đương **Người xem (Reach - Unique views)**
- `post_video_views`: Hỗ trợ thêm lượng view cho dạng video/reel.
- `post_activity_by_action_type`: Phân tách hành động (like, share, comment) => **Cực kỳ quan trọng để làm Fallback cứu cánh** khi truy vấn node `/published_posts` bị lỗi phân quyền.

---

## 3. Mã Nguồn Xử Lý Lọc Chu Kỳ (Period) và Fallback (Quan trọng)

Để giải quyết vấn đề nhiều chu kỳ (bị đè số 0) và lỗi quyền tương tác (bị rỗng Like, Cmt, Share), hãy dùng hàm `Math.max` và bóc tách Fallback như sau:

```typescript
let clicks = 0, photoViews = 0, mediaViews = 0, mediaViewsUnique = 0, insightsVideoViews = 0;

for (const item of data) {
  /** 1. Dùng Math.max để luôn lấy chu kỳ lớn nhất (thường là lifetime) */
  if (item.name === 'post_clicks') clicks = Math.max(clicks, item.values?.[0]?.value || 0);
  if (item.name === 'post_media_view') mediaViews = Math.max(mediaViews, item.values?.[0]?.value || 0);
  if (item.name === 'post_total_media_view_unique') mediaViewsUnique = Math.max(mediaViewsUnique, item.values?.[0]?.value || 0);
  if (item.name === 'post_video_views') insightsVideoViews = Math.max(insightsVideoViews, item.values?.[0]?.value || 0);
  
  if (item.name === 'post_clicks_by_type') {
    const types = item.values?.[0]?.value || {};
    photoViews = Math.max(photoViews, types['photo view'] || 0);
  }

  /** 2. Cứu cánh (Fallback) lượng Like/Share/Cmt từ Insight nếu lấy trực tiếp bị lỗi #200 */
  if (item.name === 'post_activity_by_action_type') {
    const types = item.values?.[0]?.value || {};
    if (reactionsCount === 0 && types['like']) reactionsCount = types['like'];
    if (commentsCount === 0 && types['comment']) commentsCount = types['comment'];
    if (sharesCount === 0 && types['share']) sharesCount = types['share'];
  }
}
```

---

## 4. Công Thức Chốt Các Cột Báo Cáo Trên UI (Web App)

1. **Tổng Tương Tác (Engagements)** = `Cảm xúc (Like) + Lượt nhấp (Clicks) + Bình luận + Chia sẻ`.
2. **Lượt xem (Views)** = Ưu tiên `post_media_view` -> Nếu không có, gộp thêm `post_video_views` / `video Node views` -> Tiếp theo lấy lượt nhấp `clicks`. (Không được phép để 0 nếu có tương tác).
3. **Người xem (Reach)** = Ưu tiên tuyệt đối từ `post_total_media_view_unique`. Nếu rỗng, mượn tạm từ `Views`.
4. **Lượt hiển thị (Impressions)** = Bằng `Views` (Vì metric impressions cũ đã chết, media_views là cách thay thế sát nghĩa nhất).

*Lưu ý chót*: Hãy cẩn thận với kiểu dữ liệu trả về từ Graph API, luôn lót điều kiện `|| 0` để tránh văng ứng dụng khi field trả về `undefined`.
