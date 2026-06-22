# HevaSEO — Service Catalog Spec (7 dịch vụ) · landing-page-ready

> Spec chi tiết 7 dịch vụ để **dựng landing page cho từng trang** + gắn hệ thống đã có
> (orders · credit_ledger · deliverables · messages · audit_log + state machine + 3 vai).
> Nguồn: brief của khách + brainstorming 2026-06-22. Giá/SLA gắn nhãn **(đề xuất)** — chỉnh được.

---

## 0. Quy ước chung

### 0.1 Khung mỗi dịch vụ
**Value prop · Packages (+ so sánh) · Input (form) · Process (timeline + vai) · Output/report · Upsell · FAQ.**

### 0.2 State machine + 3 vai
```
New → Confirmed → Assigned → In progress → Internal review → Delivered → (Approved→Completed | Changes requested→In progress) | Canceled
```
| Bước | Vai | Việc |
|---|---|---|
| New | CLIENT | Đặt gói + nhập Input |
| **Confirmed** | OPERATOR | **Intake-confirm** nature, hỏi thêm nếu thiếu. **Pro/đủ info → skip** |
| Assigned | OPERATOR | Gán staff |
| In progress | EXECUTOR | Thực thi |
| Internal review | OPERATOR | QA |
| Delivered → Completed | CLIENT | Nghiệm thu / Changes requested |

### 0.3 Hai luồng đặt hàng
- **Gói giá cố định** → đặt thẳng: chọn gói → form Input → `create_order` + **trừ credit**.
- **Gói consult** (PR · Website Optimization Ultra/Custom · Web Dev full-site · Webapp · Enterprise) → **Request → Consult**: gửi yêu cầu → tư vấn viên báo giá qua `messages`/email → chốt → tạo order. **Chưa trừ credit khi gửi.**

### 0.4 Template layout landing page (mọi trang dịch vụ dùng chung)
1. **Hero** — tên dịch vụ · value prop 1 câu · subtext · CTA chính ("Đặt gói") + phụ ("Xem đơn của tôi").
2. **Trust strip** — 3–4 số liệu/badge (vd links built, DR TB, % index, đơn hoàn thành).
3. **Packages** — grid card gói (tên · cho ai · gồm gì · giá/“consult” · SLA · CTA), gắn nhãn "Phổ biến".
4. **Bảng so sánh** gói (feature × gói).
5. **Cách hoạt động** — 4–5 bước (timeline, map state machine).
6. **Bạn nhận gì / Report** — **graphic mẫu cố định** + mô tả định dạng report (Excel/live/dashboard…).
7. **Order / Request** — form đặt (gói cố định) hoặc form yêu cầu (gói consult).
8. **FAQ** — câu hỏi thường gặp (shared + riêng dịch vụ).
9. **CTA cuối** + cam kết (đảm bảo, white-hat, hoàn/đổi).

### 0.5 Cam kết chung (shared, hiện cuối mỗi trang)
- 100% **white-hat**, tuân thủ guideline Google.
- **Minh bạch — no black box**: report đầy đủ, theo dõi tiến trình realtime.
- **Đảm bảo**: link hỏng được thay (backlink), revision theo gói (content/web), audit trước–sau (optimize).

### 0.6 Data model touchpoints
`orders.service` mỗi đơn · `deliverables` (file/link/version/review_status) · `messages` (intake/consult, visibility) · `credit_ledger` (gói cố định) · `audit_log`. Gói consult tạo thread `messages` trước, order tạo sau khi chốt giá.

---

## 1. SEO Keyword Research

**Value prop:** *Biết chính xác nên nhắm từ khóa nào — và đứng ở đâu so với đối thủ — trước khi tiêu một đồng cho SEO.*

**Packages (giá đề xuất, trừ credit):**
| Gói | Cho ai | Gồm gì | Giá | SLA |
|---|---|---|---|---|
| **Basic** | Site nhỏ/mới | 1 cluster chính · ~50 từ khóa · volume + difficulty | **$49** | 5 ngày |
| **Standard** ⭐ | Đa số | 3–5 cluster · ~150 từ khóa · **so sánh 3 đối thủ** (metrics + spider chart) · gợi ý chiến lược | **$99** | 4 ngày |
| **Pro** | Site lớn / cần sâu | Không giới hạn cluster · ~300+ từ khóa · **SWOT** + benchmark 5 đối thủ · lộ trình SEO 3–6 tháng · **bỏ bước hỏi thêm** | **$199** | 3 ngày |

**So sánh:** số cluster · số từ khóa · #đối thủ · spider chart · SWOT · lộ trình · ưu tiên xử lý.

**Input (form):**
- Website URL *(bắt buộc)*.
- Sản phẩm/dịch vụ/thông tin website cung cấp *(textarea, hoặc **chat AI** điền)*.
- *(tùy chọn)* thị trường/ngôn ngữ mục tiêu, đối thủ đã biết.

**Process (timeline):**
1. **New** — chọn gói + nhập website & mô tả.
2. **Confirmed** *(staff, ~24h)* — confirm ngách/nature; hỏi thêm (Basic/Standard). **Pro skip.**
3. **In progress** *(staff)* — research từ khóa + phân tích đối thủ.
4. **Internal review → Delivered.**

**Output/report:**
- **Cluster từ khóa** (volume · difficulty · intent) — **bảng tải về (CSV/Sheet)**.
- **So sánh đối thủ**: nhiều metric (DA/PA, #keywords top, traffic est., backlinks…) + **spider/radar chart** + **SWOT**.
- **Đề xuất chiến lược SEO** + upsell. *Định dạng:* **trang report trên dashboard** (charts + SWOT) + bảng tải về.

**Upsell (copy):** "Có bản đồ từ khóa rồi → triển khai: **Content** viết theo cluster · **Optimization** sửa nền tảng · **Backlink** tăng authority."

**FAQ:** Mất bao lâu? · Có cập nhật theo mùa? · Dùng cho mấy domain? · Có gợi ý anchor/nội dung không?

---

## 2. Backlink

**Value prop:** *Xây authority bền vững bằng link an toàn, có report từng link sống & index — không black box.*

### 2.1 Backlink Entity — branding & social
| Gói | Links | Gồm | Giá | SLA |
|---|---|---|---|---|
| Entity 300 | 300 | business profiles · NAP · social citations | **$129** | 7–10 ngày |
| Entity 500 ⭐ | 500 | + thêm directory uy tín | **$199** | 10–14 ngày |
| Entity 1000 | 1000 | + bộ entity mở rộng | **$349** | 14–21 ngày |

### 2.2 Backlink Pyramid — boost power qua nhiều tier
*Cho website đã “cứng”, cần dồn power cho **1 URL / category / service**.* **4 gói** (đề xuất):
| Gói | Cấu trúc | Giá | SLA |
|---|---|---|---|
| Pyramid Starter | Tier-1 contextual + Tier-2 hỗ trợ | **$89** | 10 ngày |
| Pyramid Growth ⭐ | 2 tier dày hơn | **$159** | 14 ngày |
| Pyramid Power | 3 tier | **$259** | 18 ngày |
| Pyramid Max | 3 tier + indexer kèm | **$399** | 21 ngày |

### 2.3 Guest Post — viết bài + outreach + đặt link
| Gói | Gồm | Giá | SLA |
|---|---|---|---|
| Guest 3 (DR30+) | 3 bài · viết + outreach + đặt link | **$260** | 2–3 tuần |
| Guest 5 (DR40+) ⭐ | 5 bài DR cao hơn | **$450** | 3 tuần |
| Guest 5 Pro (DR50+) | 5 bài DR50+ · **đi thêm Backlink Pyramid cho mỗi bài** để tăng power | **$700** | 3–4 tuần |

### 2.4 PR — báo quốc tế *(consult, không bảng giá cố định)*
Viết bài + đăng bài trên **báo quốc tế**; **site báo & chi phí do tư vấn viên đề xuất** theo ngân sách/ngành. Từ ~**$300/bài**.

**Input (form):**
- Project/Website mục tiêu *(chọn từ Projects hoặc nhập)*.
- **Target URL(s)** *(URL/category/service — bắt buộc cho Pyramid)*.
- **Anchor/keywords** *(kèm gợi ý tỉ lệ anchor an toàn)*.
- Niche · ngôn ngữ.
- *(PR)* chủ đề/brief · ngân sách.

**Process (timeline):**
1. **New** — chọn nhóm + gói + Input. *(PR & gói lớn → Request/Consult.)*
2. **Confirmed** *(~24–48h)* — confirm target & anchor; **PR**: tư vấn site báo + chi phí.
3. **In progress** *(staff)* — build (Entity: profiles/citations · Pyramid: dựng tier · Guest/PR: outreach + đăng · Guest Pro: chạy thêm pyramid).
4. **Internal review** — QA link sống/đúng anchor → **Delivered.**

**Output/report:**
- **Report link**: *# · Live URL · Target URL · Anchor · Loại · DR/DA · Ngày · Status (Live/Indexed/Pending)* + summary (tổng sống · DR TB · % indexed) + sparkline tăng trưởng.
- *Định dạng:* **Excel tải về** + **trang live report** trên HevaSEO. PR: danh sách **link bài báo**.
- **Đảm bảo:** link hỏng trong N ngày được **thay miễn phí**.

**Upsell:** **Indexer** (index link mới) · Content (cho guest post) · thêm Pyramid boost.

**FAQ:** Link có an toàn không? · DR/DA bao nhiêu? · Bao lâu thấy hiệu quả? · Link hỏng có thay? · Chọn anchor thế nào?

---

## 3. Content

**Value prop:** *Nội dung chuẩn SEO, an toàn với Google — chọn AI tiết kiệm hoặc người viết chất lượng tùy độ trưởng thành của site.*

### 3.1 AI-powered content *(AI ~70% / editor ~30%, rẻ — cho site đã có tuổi)*
| Gói | Độ dài | Gồm | Giá | SLA |
|---|---|---|---|---|
| AI 1000 | ~1000 từ | bài + ảnh + on-page SEO | **$29** | 2–3 ngày |
| AI 2000 ⭐ | ~2000 từ | // | **$49** | 3 ngày |
| AI 3000 | ~3000 từ | // | **$69** | 3–4 ngày |

### 3.2 Human-written + AI-assisted *(người viết 70–80%, chất lượng cao — cho site mới, DA/PA thấp)*
| Gói | Độ dài | Gồm | Giá | SLA |
|---|---|---|---|---|
| Human 1000 | ~1000 từ | bài + ảnh + on-page SEO + E-E-A-T | **$59** | 3–4 ngày |
| Human 2000 ⭐ | ~2000 từ | // | **$99** | 4 ngày |
| Human 3000 | ~3000 từ | // | **$139** | 5 ngày |

*Cả hai tuân thủ guideline Google, an toàn cao. Đặt theo bài hoặc gói nhiều bài (giảm giá theo số lượng — đề xuất ≥10 bài giảm 10%).*

**So sánh AI vs Human+AI:** chi phí · % người viết · phù hợp DA/PA · chiều sâu E-E-A-T · tốc độ.

**Input (form):**
- Project/Website + **Target URL** cần content.
- Từ khóa mục tiêu *(hoặc **link tới đơn Keyword Research**)*.
- Chủ đề/outline/brief · tone · ngôn ngữ.
- *(tùy chọn)* tài liệu tham khảo, internal links mong muốn.

**Process:**
1. **New** — chọn AI/Human + gói độ dài + Input.
2. **Confirmed** *(~24h)* — confirm brief/outline & keyword.
3. **In progress** — viết (AI draft + editor / writer + AI assist) + ảnh.
4. **Internal review** — **chuẩn SEO on-page + kiểm tra đạo văn/AI-detection + Google-compliant** → **Delivered → revisions.**

**Output/report:**
- Bài **doc/CMS-ready** + **ảnh** + **SEO score/checklist** (title · meta · density · headings · internal links).
- *Định dạng:* file tải về + **content report** (bài · số từ · keyword · trạng thái duyệt).

**Upsell:** Backlink (boost bài) · Indexer · Website Optimization.

**FAQ:** AI có bị Google phạt? · Chỉnh sửa được mấy lần? · Có nghiên cứu từ khóa kèm? · Bàn giao định dạng gì?

---

## 4. Audit

**Value prop:** *Bản đồ đầy đủ vấn đề SEO của website — xếp theo mức độ ưu tiên, kèm hướng khắc phục.*

**Packages (đề xuất, trừ credit):**
| Gói | Phạm vi | Giá | SLA |
|---|---|---|---|
| **Standard** ⭐ | technical · on-page · content overview · index coverage | **$59** | 2–3 ngày |
| **Pro** | + backlink profile · Core Web Vitals sâu · competitor benchmark · ưu tiên fix | **$129** | 3–4 ngày |

**Input (form):**
- Website URL *(bắt buộc)*.
- *(Pro, tùy chọn)* quyền **Google Search Console / Analytics** để audit sâu.

**Process:**
1. **New** — chọn gói + URL (+ cấp quyền GSC/GA nếu Pro).
2. **Confirmed** — confirm phạm vi.
3. **In progress** — crawl & phân tích: **technical · on-page · content · backlink · CWV · index coverage**.
4. **Internal review → Delivered** kèm danh sách lỗi theo severity.

**Output/report:**
- **Điểm tổng** + **lỗi theo severity** (critical/warning/info) + **khuyến nghị** ưu tiên + ước tính impact.
- *Định dạng:* **trang report dashboard** (score gauge + danh sách lỗi gập/mở) + bản **tải về (PDF)**.

**Upsell (copy):** "Đã thấy lỗi → **Website Optimization** sửa cho bạn; thiếu nội dung → **Content**; yếu authority → **Backlink**."

**FAQ:** Cần cấp quyền gì? · Có sửa luôn không (→ Optimization)? · Audit lại sau khi sửa? · Bao gồm đối thủ?

---

## 5. Website Optimization

**Value prop:** *Tăng tốc & chuẩn SEO website của bạn — đo bằng điểm trước/sau, deploy bản mới tận tay.*

**Packages:**
| Gói | Gồm (tăng dần) | Giá | SLA |
|---|---|---|---|
| **Basic** | tối ưu **speed** cơ bản · ảnh · cache | **$99** | 3–5 ngày |
| **Standard** ⭐ | + on-page SEO · schema · Core Web Vitals | **$199** | 5–7 ngày |
| **Ultra** | + technical SEO sâu · JS/render · internal linking | **consult** | 7–10 ngày |
| **Custom** *(web bự)* | task riêng theo audit | **consult** | theo thỏa thuận |

**Input (form):**
- Website URL.
- *(sau khi chốt)* **quyền truy cập source code**.

**Process (đúng brief):**
1. **New** — chọn gói + URL.
2. **Confirmed** — **đánh giá website** → **đưa giải pháp + dự đoán khả năng improve** → xin **quyền truy cập source code**.
3. **In progress** — **backup source** → **optimize** (speed/SEO/technical theo gói).
4. **Internal review → Delivered.**

**Output/report:**
- **Website đã tối ưu** + **kết quả audit before/after** (PageSpeed, CWV, SEO score) → **deploy web mới cho khách**.
- *Định dạng:* web đã deploy + báo cáo before/after.

**Upsell:** Audit (trước) · Content · Backlink · **vận hành** (hosting/maintenance thu phí).

**FAQ:** Có làm hỏng web không (→ backup)? · Cần quyền gì? · Cải thiện bao nhiêu %? · Hỗ trợ nền tảng nào (WordPress/custom)?

---

## 6. Website Development

**Value prop:** *Gửi yêu cầu (text/ảnh/chat AI) → 2 ngày có web draft theo ý bạn → chốt full site.*

**Packages:**
| Gói | Cho ai | Giá khởi điểm | SLA |
|---|---|---|---|
| Landing page | chiến dịch/1 trang | **from $199** | draft 2 ngày · full ~1 tuần |
| Statistic web | giới thiệu/brochure | **from $299** | ~1–2 tuần |
| Blog | content site | **from $399** | ~2 tuần |
| E-commerce | bán hàng | **from $699** | ~3–4 tuần |
| Webapp | app/logic | **consult** | theo thỏa thuận |

*Mô hình: chọn gói → **draft sau 2 ngày + báo giá full site** (kèm số lần chỉnh sửa theo gói).*

**Input (form yêu cầu — text/ảnh/cả hai, hoặc **chat AI** điền):**
- Mô tả **business** + ảnh tham khảo.
- Link **Google Maps** (đủ thông tin + ảnh).
- Web **cùng ngành/đối thủ**.
- Web **muốn tham khảo**.
- Màu sắc/phông chữ (nếu có) · **Logo** (nếu có).

**Process (đúng brief):**
1. **New** — chọn gói + điền form/chat AI.
2. **Confirmed** —
   - **Đủ info →** ~**2 ngày**: gửi **web draft** + **báo giá full site** (số lần chỉnh sửa theo gói).
   - **Thiếu info →** tư vấn viên liên hệ (email **hoặc trên dashboard**) hỏi thêm.
3. **In progress** — build full site; **chỉnh sửa theo gói**; **vượt số lần → tính phí thêm**.
4. **Internal review → Delivered** (trả bài).

**Output/report:**
- **Website hoàn thiện** + **chỉ số audit**.
- **Hướng dẫn nối domain.**
- *Nếu Heva vận hành (server/hosting/maintenance) → thu thêm phí.*

**Upsell:** Keyword Research · Content · SEO/Optimization · hosting/maintenance.

**FAQ:** Bao nhiêu lần sửa? · Vượt lần sửa tính phí sao? · Mình giữ source/domain chứ? · Heva có host giúp? · Draft không ưng thì sao?

---

## 7. Indexer

**Value prop:** *Đẩy backlink vào index nhanh — trả theo số link, càng nhiều càng rẻ, check trạng thái bằng plugin.*

**Packages (usage-based, đề xuất):**
| Khối lượng/tháng | Giá/link |
|---|---|
| Mặc định | **$0.02** |
| > 5.000 link | $0.015 |
| > 20.000 link | $0.01 |

**Input (form):** danh sách **backlinks** (paste URLs hoặc upload CSV).

**Process:**
1. **New** — nhập/đính kèm danh sách link → tính phí theo số link × đơn giá.
2. **In progress** — **submit để index** + **thông báo tiến trình**. Trạng thái: **pending · submitting · completed** (gần tự động; staff giám sát).
3. **Delivered** — báo cáo trạng thái.

**Output/report:**
- **Trạng thái index từng link** (pending/submitting/completed) + % indexed.
- User dùng **HevaSEO plugin** kiểm tra trạng thái index của link.

**Upsell:** Backlink · Content (tạo thêm link/bài để index).

**FAQ:** Bao lâu index? · Tỉ lệ index bao nhiêu? · Link không index có hoàn? · Plugin cài thế nào?

---

## 8. Ma trận upsell
| Từ | Upsell |
|---|---|
| Keyword Research | Optimization · Content · Backlink |
| Audit | Optimization · Content · Backlink · Keyword |
| Content | Backlink · Indexer |
| Backlink (Entity/Pyramid/Guest/PR) | **Indexer** · Content · Pyramid boost |
| Website Optimization | Content · Backlink · hosting/maintenance |
| Website Development | Keyword · Content · SEO/Optimization · hosting/maintenance |
| Indexer | Backlink · Content |

---

## 9. Bảng tổng hợp pricing & report
| Dịch vụ | Pricing | Report/deliverable |
|---|---|---|
| Keyword Research | Cố định ($49/99/199) | Bảng cluster tải về + trang report (spider + SWOT) |
| Backlink Entity/Pyramid/Guest | Cố định theo gói | Excel + trang live report (link · DR/DA · status) |
| Backlink PR | **Consult** (từ ~$300/bài) | Link bài báo |
| Content AI/Human+AI | Cố định theo độ dài | File bài + ảnh + SEO score + content report |
| Audit | Cố định ($59/129) | Trang report + PDF (điểm + lỗi severity) |
| Website Optimization | Cố định ($99/199); Ultra/Custom **consult** | Web tối ưu + before/after + deploy |
| Website Development | Từ $199…; full-site **báo giá sau draft** | Website + audit + hướng dẫn domain |
| Indexer | **Usage** $0.02/link (giảm theo volume) | Trạng thái index từng link + plugin |

---

## 10. Ghi chú dựng landing page (cho writing-plans)
- **Mọi trang dịch vụ dùng chung template §0.4** — chỉ thay nội dung (gói/Input/report). Tách thành component tái dùng: `ServiceHero`, `PackageGrid`, `CompareTable`, `HowItWorks`, `ReportPreview`, `OrderForm`/`RequestForm`, `ServiceFAQ`, `ServiceCTA`.
- **Data layer:** thêm `SERVICE_PACKAGES` (id · service · name · forWho · features[] · price | 'consult' · sla · popular) + `SERVICE_META` (value prop · stats · faq[]) trong `mock.ts`/`data/services.ts`.
- **Order form:** gói cố định → `create_order` + trừ credit; gói consult → tạo thread `messages` (chưa trừ credit).
- **Report preview:** dùng **graphic mẫu cố định** (ảnh/SVG); report thật theo định dạng từng dịch vụ (§9).
- **Thứ tự build đề xuất:** Backlink (mô tả kỹ nhất) → nhân bản template cho 6 dịch vụ còn lại.
- Route đề xuất: `/services/<service>` (đổi link sidebar từ `/orders?svc=` sang trang dịch vụ; giữ "Xem đơn" trỏ board).
