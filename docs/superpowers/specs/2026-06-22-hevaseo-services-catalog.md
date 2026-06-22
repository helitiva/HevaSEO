# HevaSEO — Service Catalog Spec (7 dịch vụ)

> Spec mô tả 7 dịch vụ HevaSEO cung cấp, theo **khung thống nhất** và gắn với hệ thống đã dựng
> (orders · credit_ledger · deliverables · messages · audit_log + state machine + 3 vai).
> Nguồn: brief của khách + phiên brainstorming 2026-06-22. Bổ sung phần kỹ thuật cho `master-plan.md`.

---

## 0. Quy ước chung (áp cho mọi dịch vụ)

### 0.1 Khung trình bày mỗi dịch vụ
**Packages · Input · Process · Output · Upsell** — mọi dịch vụ theo đúng 5 mục này.

### 0.2 Vòng đời đơn (state machine) + 3 vai
```
New → Confirmed → Assigned → In progress → Internal review → Delivered → (Approved → Completed | Changes requested → In progress)
                                                                          + Canceled (từ New/Confirmed)
```
| Bước | Ai làm | Việc |
|---|---|---|
| **New** | Customer (CLIENT) | Đặt gói + nhập Input (form theo dịch vụ, hoặc chat AI điền) |
| **Confirmed** | Admin/Staff (OPERATOR) | **Intake-confirm**: xác nhận *nature* của dịch vụ, hỏi thêm info nếu thiếu (qua `messages`/email). **Gói Pro hoặc input đã đủ → bỏ qua bước hỏi thêm** |
| **Assigned** | Admin (OPERATOR) | Gán đơn cho staff phù hợp |
| **In progress** | Staff (EXECUTOR) | Thực thi |
| **Internal review** | Admin (OPERATOR) | QA trước khi giao |
| **Delivered** | → Customer | Giao deliverable |
| **Approved → Completed** | Customer | Nghiệm thu (hoặc *Changes requested* → quay lại In progress) |

### 0.3 Hai luồng đặt hàng (theo loại gói)
- **Gói giá cố định** → đặt thẳng: chọn gói → nhập Input → **tạo order + trừ credit** (`create_order`), hiện trong Orders.
- **Gói cần tư vấn** (PR, Custom dev, Ultra/Custom optimization, Enterprise) → **Request → Consult**: gửi yêu cầu, tư vấn viên báo giá qua `messages`/email; chốt giá rồi mới tạo order/trừ credit. **Chưa trừ credit khi gửi yêu cầu.**

### 0.4 Gắn data model đã có
- Mỗi đơn = 1 dòng `orders` với `service` (backlink/content/indexer/audit/optimize/keyword/design...).
- Deliverable → bảng `deliverables` (file/link, version, review_status).
- Tư vấn/intake → `messages` (visibility customer/internal).
- Gói giá cố định → `credit_ledger` (trừ lúc đặt, hoàn khi Cancel — theo D1).
- Mọi thao tác → `audit_log`.

### 0.5 Định dạng report — **tùy dịch vụ** (xem từng mục)
Một số dịch vụ có **graphic mẫu cố định** trên trang giới thiệu; report thật theo định dạng riêng (Excel / trang live / bảng dashboard / website…).

---

## 1. SEO Keyword Research

**Packages:** `Basic` · `Standard` · `Pro` (Pro: input đầy đủ, bỏ bước hỏi thêm; phân tích sâu nhất).

**Input:**
- Website URL.
- Sản phẩm / dịch vụ / thông tin website cung cấp (mô tả ngắn, có thể chat AI để điền).

**Process:**
1. **New** — khách chọn gói + nhập website & mô tả.
2. **Confirmed** — staff confirm nature của dịch vụ/ngách; hỏi thêm nếu thiếu (Basic/Standard). **Pro: đủ info → skip.**
3. **Assigned → In progress** — staff nghiên cứu từ khóa, phân tích đối thủ.
4. **Internal review → Delivered.**

**Output (deliverable):**
- **Cluster từ khóa** + `search volume` + `difficulty`.
- **So sánh hiện trạng SEO website vs đối thủ**: nhiều metric + **spider/radar chart** + **SWOT**.
- **Đề xuất chiến lược SEO** + **upsell** (Website Optimization, Backlink, Content).
- *Định dạng:* bảng cluster **tải về** + **trang report trên dashboard** (charts + SWOT).

**Upsell:** Website Optimization · Content · Backlink.

---

## 2. Backlink

**Packages (4 nhóm dịch vụ):**
- **Backlink Entity** — build branding & social cho website. Gói: **300 / 500 / 1000 links**.
- **Backlink Pyramid** — tăng sức mạnh tổng thể qua nhiều tier; phù hợp website đã "cứng" cần boost power cho 1 **URL / category / service** cụ thể. **4 gói** (theo độ sâu tier/số link).
- **Guest Post** — **3 gói**: gồm **viết bài + outreach** tới site phù hợp & content owner để đặt link. **Gói cao nhất**: sau khi đặt link xong **đi thêm Backlink Pyramid cho chính bài guest post** để tăng sức mạnh.
- **PR** — mua bài **báo quốc tế**: viết bài + đăng bài. **Báo giá theo tư vấn** (site báo & chi phí do tư vấn viên đề xuất, không có bảng giá cố định).

**Input:**
- Project/Website mục tiêu (chọn từ Projects hoặc nhập).
- **Target URL(s)** cần trỏ link (URL/category/service đối với Pyramid).
- **Anchor / keywords** (kèm gợi ý tỉ lệ anchor an toàn).
- Niche / ngôn ngữ.
- (PR) chủ đề/brief mong muốn.

**Process:**
1. **New** — chọn nhóm + gói + nhập Input. *(PR & gói lớn → Request/Consult báo giá trước.)*
2. **Confirmed** — confirm target & anchor; PR: tư vấn site báo + chi phí.
3. **Assigned → In progress** — build link (Entity: profiles/citations; Pyramid: dựng tier; Guest/PR: outreach + đăng bài; gói guest cao nhất chạy thêm pyramid).
4. **Internal review** — QA link sống/đúng anchor.
5. **Delivered.**

**Output (deliverable):**
- **Report link**: bảng *# · Live URL · Target URL · Anchor · Loại · DR/DA · Ngày · Trạng thái (Live/Indexed/Pending)* + summary (tổng sống · DR TB · % indexed) + sparkline.
- *Định dạng:* **Excel tải về** + **trang live report** trên HevaSEO. PR: danh sách **link bài báo** đã đăng.

**Upsell:** **Indexer** (index link mới) · Content (cho guest post) · thêm Pyramid boost.

---

## 3. Content

**Packages (2 dịch vụ, mỗi dịch vụ nhiều gói theo độ dài):**
- **AI-powered content** — chi phí rẻ; **AI ~70% / editor ~30%**. Gói theo độ dài **1000 → 3000 từ**, **kèm ảnh**, tối ưu chuẩn SEO tối đa. *Phù hợp website đã có tuổi.*
- **Human-written + AI-assisted** — **người viết 70–80%**, AI hỗ trợ; **đắt hơn, chất lượng hơn**. Gói **1000 → 3000 từ**, kèm ảnh, chuẩn SEO tối đa. *Phù hợp website mới (DA/PA thấp).*
- Cả hai **tuân thủ guideline Google về content, an toàn cao.**

**Input:**
- Project/Website + Target URL cần content.
- Từ khóa mục tiêu (hoặc link tới đơn **Keyword Research** đã có).
- Chủ đề / outline / brief; tone & ngôn ngữ.

**Process:**
1. **New** — chọn dịch vụ (AI / Human+AI) + gói độ dài + Input.
2. **Confirmed** — confirm brief/outline & keyword; hỏi thêm nếu thiếu.
3. **Assigned → In progress** — viết (AI draft + editor, hoặc writer + AI assist) + tạo ảnh.
4. **Internal review** — QA: chuẩn SEO on-page + **kiểm tra đạo văn / AI-detection** + tuân thủ Google.
5. **Delivered → (revisions nếu Changes requested).**

**Output (deliverable):**
- Bài viết **doc / CMS-ready** + **ảnh** + **SEO score/checklist** (title, meta, density, internal links…).
- *Định dạng:* file tải về + **content report** (danh sách bài · số từ · keyword · trạng thái).

**Upsell:** Backlink (boost bài) · Indexer · Website Optimization.

---

## 4. Audit

**Packages (đề xuất):** `Standard` (technical + on-page + content overview) · `Pro` (thêm phân tích backlink, CWV sâu, competitor benchmark). *(Có thể thêm add-on Technical-only.)*

**Input:**
- Website URL.
- *(Tùy chọn, cho Pro)* quyền truy cập **Google Search Console / Analytics** để audit sâu.

**Process:**
1. **New** — chọn gói + nhập URL (+ cấp quyền GSC/GA nếu Pro).
2. **Confirmed** — confirm phạm vi audit.
3. **Assigned → In progress** — crawl & phân tích: **technical · on-page · content · backlink · Core Web Vitals · index coverage**.
4. **Internal review → Delivered** kèm danh sách lỗi xếp theo mức độ.

**Output (deliverable):**
- **Báo cáo audit**: điểm tổng + **lỗi theo severity** (critical/warning/info) + **khuyến nghị khắc phục** ưu tiên.
- *Định dạng:* **trang report trên dashboard** + bản **tải về**.

**Upsell:** **Website Optimization** (fix lỗi) · Content · Backlink · Keyword Research.

---

## 5. Website Optimization

**Packages:** `Basic` · `Standard` · `Ultra` · `Custom` (web bự) — gói càng cao càng nhiều task & mức tối ưu. Optimize gồm **speed, SEO, …**. *(Ultra/Custom → Request/Consult báo giá.)*

**Input:**
- Website URL.
- Sau khi chốt: **quyền truy cập source code** của web.

**Process:**
1. **New** — chọn gói + nhập URL.
2. **Confirmed** — **đánh giá website**; **đưa giải pháp + dự đoán khả năng improve**; xin **quyền truy cập source code**.
3. **Assigned → In progress** — **backup source** → **optimize** (speed/SEO/technical theo gói).
4. **Internal review → Delivered.**

**Output (deliverable):**
- **Website đã tối ưu** + **kết quả audit before/after** (scores) → **deploy web mới cho khách**.
- *Định dạng:* web đã deploy + báo cáo before/after.

**Upsell:** Audit (trước) · Content · Backlink · **vận hành** (hosting/maintenance thu phí).

---

## 6. Website Development

**Packages:** `Landing page` · `Statistic web` · `Blog` · `E-commerce` · `Webapp`.

**Input (form yêu cầu — text/ảnh/cả hai, hoặc chat AI điền):**
- Mô tả **business** + ảnh tham khảo.
- Link **Google Maps** (đã điền đủ thông tin & có ảnh).
- Web **người cùng ngành / đối thủ**.
- Web **muốn tham khảo**.
- Yêu cầu **màu sắc / phông chữ** (nếu có).
- **Logo** (nếu có).

**Process:**
1. **New** — chọn gói + điền form (hoặc chat AI).
2. **Confirmed** —
   - **Đủ info →** sau **~2 ngày** gửi **trang web draft** theo ý khách + **báo giá full site** (kèm **số lần chỉnh sửa theo gói**).
   - **Thiếu info →** tư vấn viên liên hệ (email **hoặc ngay trên dashboard**) take-care & hỏi thêm.
3. **Assigned → In progress** — build full site; **chỉnh sửa theo ý khách**; **vượt số lần chỉnh sửa của gói → tính phí thêm**.
4. **Internal review → Delivered** (trả bài).

**Output (deliverable):**
- **Website hoàn thiện** + **chỉ số audit**.
- **Hướng dẫn nối domain.**
- **Upsell:** Keyword Research · SEO/Optimization · Content.
- *Nếu Heva vận hành (server/hosting/maintenance) → thu thêm phí.*

**Upsell:** Keyword · Content · SEO/Optimization · hosting/maintenance.

---

## 7. Indexer

**Packages (usage-based):** trả theo số link index — **mặc định $0.02/link**; **index càng nhiều trong tháng → giảm fee** (volume tiers).

**Input:** danh sách **backlinks** (URLs) cần index.

**Process:**
1. **New** — nhập/đính kèm danh sách link.
2. **In progress** — **submit để index** + **thông báo tiến trình** tới user. Trạng thái: **pending · submitting · completed** (gần như tự động; staff giám sát).
3. **Delivered** — báo cáo trạng thái.

**Output (deliverable):**
- **Trạng thái index từng link** (pending/submitting/completed).
- User dùng **HevaSEO plugin** để kiểm tra trạng thái index của các link.

**Upsell:** Backlink · Content (tạo thêm link/bài để index).

---

## 8. Ma trận upsell

| Từ dịch vụ | Gợi ý upsell |
|---|---|
| Keyword Research | Website Optimization · Content · Backlink |
| Audit | Website Optimization · Content · Backlink · Keyword |
| Content | Backlink · Indexer |
| Backlink (Entity/Pyramid/Guest/PR) | **Indexer** · Content · thêm Pyramid boost |
| Website Optimization | Content · Backlink · hosting/maintenance |
| Website Development | Keyword · Content · SEO/Optimization · hosting/maintenance |
| Indexer | Backlink · Content |

---

## 9. Tổng hợp pricing & report theo dịch vụ

| Dịch vụ | Pricing | Report/deliverable |
|---|---|---|
| Keyword Research | Cố định (Basic/Standard/Pro) | Bảng cluster tải về + trang report (spider chart + SWOT) |
| Backlink Entity/Pyramid/Guest | Cố định theo gói | Excel + trang live report (link · DR/DA · status) |
| Backlink PR | **Consult/báo giá** | Danh sách link bài báo |
| Content (AI / Human+AI) | Cố định theo độ dài | File bài + ảnh + SEO score + content report |
| Audit | Cố định (Standard/Pro) | Trang report + tải về (điểm + lỗi theo severity) |
| Website Optimization | Cố định; **Ultra/Custom = consult** | Web tối ưu + before/after + deploy |
| Website Development | Theo gói; full-site **báo giá sau draft** | Website + audit + hướng dẫn domain |
| Indexer | **Usage** $0.02/link, giảm theo volume | Trạng thái index từng link + plugin |

---

## 10. Ghi chú triển khai (cho phase sau)
- Mỗi trang dịch vụ dùng **chung layout** (Hero → Packages → Order/Request → "Bạn nhận gì/report" → Cách hoạt động → CTA) — nội dung gói/Input/report thay theo dịch vụ (tinh thần forkable).
- Cần bơm data: `SERVICE_PACKAGES` (giá/đặc tả mỗi gói) + mẫu report mỗi loại.
- Form đặt: gói cố định → `create_order` + trừ credit; gói consult → tạo thread `messages` (chưa trừ credit) cho admin báo giá.
- Trang **live report** (Backlink/Indexer/Keyword/Audit): route con hoặc mở từ deliverable trong panel order.
