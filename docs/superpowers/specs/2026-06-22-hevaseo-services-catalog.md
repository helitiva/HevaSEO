# HevaSEO — Service Catalog Spec (7 dịch vụ) · landing-page-ready

> Spec chi tiết 7 dịch vụ để **dựng landing page cho từng trang** + gắn hệ thống đã có
> (orders · credit_ledger · deliverables · messages · audit_log + state machine + 3 vai).
> Nguồn: brief của khách + brainstorming 2026-06-22. Giá/SLA gắn nhãn **(đề xuất)** — chỉnh được.
>
> **💰 Giá đang giảm còn 40% (−60% launch).** Mọi giá cố định dưới đây là **giá đã giảm**.

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
- **Gói consult** (PR · Optimization Ultra/Custom · Web Dev full-site · Webapp · Enterprise) → **Request → Consult**: gửi yêu cầu → tư vấn viên báo giá → chốt → tạo order. **Chưa trừ credit khi gửi.**

### 0.4 Template layout landing page (mọi trang dịch vụ dùng chung)
1. **Hero** — tên · value prop · subtext · CTA chính ("Đặt gói") + phụ ("Xem đơn của tôi").
2. **Trust strip** — 3–4 số liệu/badge.
3. **Packages** — grid card gói (tên · cho ai · gồm gì · giá/“consult” · SLA · CTA), nhãn "Phổ biến".
4. **Bảng so sánh** gói.
5. **Cách hoạt động** — 4–5 bước (timeline, map state machine).
6. **Bạn nhận gì / Report** — **graphic mẫu cố định** + mô tả định dạng report.
7. **Order / Request** — form đặt (cố định) hoặc form yêu cầu (consult).
8. **FAQ.**
9. **CTA cuối** + cam kết.

### 0.5 Cam kết chung
100% **white-hat** · tuân thủ guideline Google · **no black box** (report đầy đủ, tiến trình realtime) · **đảm bảo** (link hỏng được thay · revision theo gói · audit trước–sau).

### 0.6 Data model touchpoints
`orders.service` · `deliverables` · `messages` (intake/consult) · `credit_ledger` (gói cố định) · `audit_log`. Gói consult tạo `messages` trước, order sau khi chốt giá.

---

## 1. SEO Keyword Research

**Value prop:** *Biết chính xác nên nhắm từ khóa nào — và đứng ở đâu so với đối thủ — trước khi tiêu một đồng cho SEO.*

**Packages (giá đã giảm 40%, trừ credit):**
| Gói | Cho ai | Gồm gì | Giá | SLA |
|---|---|---|---|---|
| **Basic** | Site nhỏ/mới | 1 cluster chính · ~50 từ khóa · volume + difficulty | **$19** | 5 ngày |
| **Standard** ⭐ | Đa số | 3–5 cluster · ~150 từ khóa · **so sánh 3 đối thủ** (metrics + spider chart) · gợi ý chiến lược | **$39** | 4 ngày |
| **Pro** | Site lớn/sâu | Không giới hạn cluster · ~300+ từ khóa · **SWOT** + benchmark 5 đối thủ · lộ trình 3–6 tháng · **skip hỏi thêm** | **$79** | 3 ngày |

**Input (form):** Website URL · Sản phẩm/dịch vụ/thông tin website (textarea hoặc **chat AI**) · *(tùy chọn)* thị trường/ngôn ngữ, đối thủ đã biết.

**Process:** New → **Confirmed** (staff ~24h, confirm ngách; Basic/Standard hỏi thêm, **Pro skip**) → In progress (research + phân tích đối thủ) → Internal review → Delivered.

**Output/report:** Cluster (volume·difficulty·intent) **tải về (CSV/Sheet)** · so sánh đối thủ (DA/PA, #kw top, traffic est., backlinks…) + **spider chart** + **SWOT** · đề xuất chiến lược. *Định dạng:* **trang report dashboard** + bảng tải về.

**Upsell:** Content · Optimization · Backlink.

**FAQ:** Mất bao lâu? · Cập nhật theo mùa? · Mấy domain? · Có gợi ý nội dung/anchor?

---

## 2. Backlink

**Value prop:** *Xây authority bền vững bằng link an toàn — kèm Indexer, report từng link sống & % index, không black box.*

> **Mọi gói Backlink đều KÈM Indexer miễn phí.** Tỉ lệ index trong **2 tuần đầu**:
> Entity **80–95%** · Pyramid **~70%** · Guest Post **~100%** · PR **~100%**.

### 2.1 Backlink Entity — branding & social · *index 80–95% · kèm Indexer*
| Gói | Links | Gồm | Giá | SLA |
|---|---|---|---|---|
| Entity 300 | 300 | business profiles · NAP · social citations | **$52** | 7–10 ngày |
| Entity 500 ⭐ | 500 | + directory uy tín | **$79** | 10–14 ngày |
| Entity 1000 | 1000 | + bộ entity mở rộng | **$139** | 14–21 ngày |

### 2.2 Backlink Pyramid — boost power qua nhiều tier · *index ~70% · kèm Indexer*
*Cho website đã “cứng”, dồn power cho **1 URL / category / service**.* **4 gói:**
| Gói | Cấu trúc | Giá | SLA |
|---|---|---|---|
| Pyramid Starter | Tier-1 contextual + Tier-2 hỗ trợ | **$36** | 10 ngày |
| Pyramid Growth ⭐ | 2 tier dày hơn | **$64** | 14 ngày |
| Pyramid Power | 3 tier | **$104** | 18 ngày |
| Pyramid Max | 3 tier + indexer nâng cao | **$159** | 21 ngày |

### 2.3 Guest Post — viết bài + outreach + đặt link · *index ~100% · kèm Indexer*
| Gói | Gồm | Giá | SLA |
|---|---|---|---|
| Guest 3 (DR30+) | 3 bài · viết + outreach + đặt link | **$104** | 2–3 tuần |
| Guest 5 (DR40+) ⭐ | 5 bài DR cao hơn | **$180** | 3 tuần |
| Guest 5 Pro (DR50+) | 5 bài DR50+ · **đi thêm Pyramid cho mỗi bài** | **$280** | 3–4 tuần |

### 2.4 PR — báo quốc tế · *index ~100%* · **consult**
Viết + đăng bài trên **báo quốc tế**; **site báo & chi phí do tư vấn viên đề xuất** theo ngân sách/ngành. Từ ~**$120/bài**.

**Input (form):** Project/Website · **Target URL(s)** (bắt buộc cho Pyramid) · **Anchor/keywords** (gợi ý tỉ lệ an toàn) · niche · ngôn ngữ · *(PR)* chủ đề/brief · ngân sách.

**Process:** New *(PR & gói lớn → Request/Consult)* → Confirmed (~24–48h, confirm target & anchor; PR tư vấn site báo) → In progress (build + outreach; Guest Pro chạy thêm pyramid; **Indexer chạy kèm**) → Internal review (QA link sống/anchor) → Delivered.

**Output/report:** Bảng *# · Live URL · Target URL · Anchor · Loại · DR/DA · Ngày · Status (Live/Indexed/Pending)* + summary (tổng sống · DR TB · **% indexed**) + sparkline. *Định dạng:* **Excel** + **trang live report**. PR: **link bài báo**. **Đảm bảo:** link hỏng được thay miễn phí.

**Upsell:** Content (cho guest post) · thêm Pyramid boost. *(Indexer đã kèm sẵn.)*

**FAQ:** Link an toàn không? · DR/DA bao nhiêu? · **Tỉ lệ index?** · Bao lâu thấy hiệu quả? · Link hỏng có thay?

---

## 3. Content

**Value prop:** *Nội dung chuẩn SEO, an toàn Google — kèm điểm số bài viết & báo cáo cách research/viết minh bạch.*

### 3.1 AI-powered content *(AI ~70% / editor ~30%, rẻ — cho site đã có tuổi)*
| Gói | Độ dài | Gồm | Giá | SLA |
|---|---|---|---|---|
| **A1000** | ~1000 từ | bài + ảnh + on-page SEO + **content score & methodology** | **$12** | 2–3 ngày |
| **A2000** ⭐ | ~2000 từ | // | **$19** | 3 ngày |
| **A3000** | ~3000 từ | // | **$28** | 3–4 ngày |

### 3.2 Human-written + AI-assisted *(người viết 70–80% — chất lượng cao, cho site mới DA/PA thấp)*
| Gói | Độ dài | Gồm | Giá | SLA |
|---|---|---|---|---|
| **H1000** | ~1000 từ | bài + ảnh + on-page SEO + E-E-A-T + score & methodology | **$24** | 3–4 ngày |
| **H2000** ⭐ | ~2000 từ | // | **$39** | 4 ngày |
| **H3000** | ~3000 từ | // | **$56** | 5 ngày |

*Cả hai tuân thủ guideline Google, an toàn cao. Gói nhiều bài giảm thêm (đề xuất ≥10 bài −10%).*

**So sánh A vs H:** chi phí · % người viết · phù hợp DA/PA · chiều sâu E-E-A-T · tốc độ.

**Input (form):** Project/Website + **Target URL** · từ khóa *(hoặc link đơn Keyword Research)* · chủ đề/outline/brief · tone · ngôn ngữ · *(tùy chọn)* tài liệu tham khảo, internal links.

**Process:** New → Confirmed (~24h, confirm brief/outline & keyword) → In progress (viết + ảnh) → Internal review (**chuẩn SEO on-page + đạo văn/AI-detection + Google-compliant**) → Delivered → revisions.

**Output/deliverable — đầy đủ định dạng:**
- **Bài viết HTML** — review như đang xem trên website (live preview).
- **File DOC** · **File TXT** · **bộ ảnh**.
- **⭐ Content Score + Methodology report** — điểm chất lượng bài + **cách AI/nhân viên research & viết**: **giọng văn/voice · nguồn tin/sources · intent bài viết · từ khóa & density · readability · E-E-A-T · originality** … (nhiều metrics).
- *Định dạng:* **1 URL** hiển thị **score + methodology + preview bài viết** cùng nhau (+ tải DOC/TXT/HTML/ảnh).

**Upsell:** Backlink (boost bài) · Indexer · Optimization.

**FAQ:** AI có bị Google phạt? · Chỉnh sửa mấy lần? · Có nghiên cứu từ khóa kèm? · **Điểm số & nguồn tin xem ở đâu?** · Bàn giao định dạng gì?

---

## 4. Audit

**Value prop:** *Bản đồ đầy đủ vấn đề SEO — xếp theo mức độ ưu tiên, kèm hướng khắc phục.*

**Packages (3 gói, giá đã giảm 40%, trừ credit):**
| Gói | Phạm vi | Giá | SLA |
|---|---|---|---|
| **Basic** | technical · on-page cơ bản · index coverage | **$19** | 2 ngày |
| **Standard** ⭐ | + content · schema · Core Web Vitals | **$39** | 2–3 ngày |
| **Pro** | + backlink profile · CWV sâu · competitor benchmark · ưu tiên fix · *(tùy chọn GSC/GA)* | **$69** | 3–4 ngày |

**Input (form):** Website URL · *(Pro, tùy chọn)* quyền **GSC/GA**.

**Process:** New → Confirmed (confirm phạm vi) → In progress (crawl & phân tích: technical · on-page · content · backlink · CWV · index) → Internal review → Delivered (lỗi theo severity).

**Output/report:** **Điểm tổng** + **lỗi theo severity** (critical/warning/info) + **khuyến nghị** ưu tiên + ước tính impact. *Định dạng:* **trang report dashboard** (score gauge + danh sách lỗi gập/mở) + **PDF tải về**.

**Upsell:** Optimization (sửa lỗi) · Content · Backlink · Keyword.

**FAQ:** Cần cấp quyền gì? · Sửa luôn không (→ Optimization)? · Audit lại sau khi sửa? · Có đối thủ?

---

## 5. Website Optimization

**Value prop:** *Tăng tốc, chuẩn SEO & **AI-ready (GEO)** — đo bằng điểm trước/sau, deploy bản mới tận tay.*

**Packages:**
| Gói | Gồm (tăng dần) | Giá | SLA |
|---|---|---|---|
| **Basic** | tối ưu **speed** · ảnh · cache | **$40** | 3–5 ngày |
| **Standard** ⭐ | + on-page SEO · schema · Core Web Vitals · **AI-ready / GEO** (structured/answer-ready, entity, optimize cho AI search & generative engines) | **$79** | 5–7 ngày |
| **Ultra** | + technical SEO sâu · JS/render · internal linking · GEO nâng cao | **consult** | 7–10 ngày |
| **Custom** *(web bự)* | task riêng theo audit | **consult** | thỏa thuận |

**Input (form):** Website URL · *(sau khi chốt)* **quyền truy cập source code**.

**Process (đúng brief):** New → Confirmed (**đánh giá website → giải pháp + dự đoán improve → xin quyền source code**) → In progress (**backup source → optimize** speed/SEO/technical/**GEO** theo gói) → Internal review → Delivered.

**Output/report:** **Website đã tối ưu** + **audit before/after** (PageSpeed · CWV · SEO score · **AI-readiness**) → **deploy web mới**.

**Upsell:** Audit (trước) · Content · Backlink · **hosting/maintenance** (thu phí).

**FAQ:** Có làm hỏng web (→ backup)? · Cần quyền gì? · Cải thiện bao nhiêu %? · **AI-ready/GEO là gì?** · Nền tảng nào (WordPress/custom)?

---

## 6. Website Development

**Value prop:** *Gửi yêu cầu (text/ảnh/chat AI) → 2 ngày có web draft theo ý bạn → chốt full site.*

**Packages (giá khởi điểm đã giảm 40%):**
| Gói | Cho ai | Từ | SLA |
|---|---|---|---|
| Landing page | chiến dịch/1 trang | **from $79** | draft 2 ngày · full ~1 tuần |
| Statistic web | giới thiệu/brochure | **from $119** | ~1–2 tuần |
| Blog | content site | **from $159** | ~2 tuần |
| E-commerce | bán hàng | **from $279** | ~3–4 tuần |
| Webapp | app/logic | **consult** | thỏa thuận |

*Mô hình: chọn gói → **draft sau 2 ngày + báo giá full site** (kèm số lần chỉnh sửa theo gói).*

**Input (form yêu cầu — text/ảnh/cả hai, hoặc **chat AI** điền):** Mô tả **business** + ảnh tham khảo · link **Google Maps** (đủ info + ảnh) · web **cùng ngành/đối thủ** · web **muốn tham khảo** · màu sắc/phông chữ · **Logo**.

**Process (đúng brief):** New → Confirmed (**đủ info → ~2 ngày gửi draft + báo giá full site theo số lần sửa của gói; thiếu info → tư vấn viên liên hệ qua email/dashboard**) → In progress (build; sửa theo gói; **vượt số lần → phí thêm**) → Internal review → Delivered.

**Output/report:** **Website hoàn thiện** + **chỉ số audit** · **hướng dẫn nối domain** · *Heva vận hành (server/hosting/maintenance) → thu thêm phí.*

**Upsell:** Keyword · Content · SEO/Optimization · hosting/maintenance.

**FAQ:** Bao nhiêu lần sửa? · Vượt lần sửa tính phí sao? · Giữ source/domain chứ? · Heva host giúp? · Draft không ưng?

---

## 7. Indexer

**Value prop:** *Đẩy backlink vào index nhanh — trả theo số link, càng nhiều càng rẻ, check bằng plugin.*

**Packages (usage-based, giá đã giảm 40%):**
| Khối lượng/tháng | Giá/link |
|---|---|
| Mặc định | **$0.008** |
| > 5.000 link | $0.006 |
| > 20.000 link | $0.004 |

> *Lưu ý: mua gói **Backlink** đã **kèm Indexer miễn phí** (§2). Bảng giá này cho đơn Indexer **độc lập**.*

**Input (form):** danh sách **backlinks** (paste URLs hoặc upload CSV).

**Process:** New (tính phí = số link × đơn giá) → In progress (**submit index + thông báo tiến trình**; trạng thái **pending · submitting · completed**, gần tự động, staff giám sát) → Delivered.

**Output/report:** **Trạng thái index từng link** + % indexed · user dùng **HevaSEO plugin** kiểm tra.

**Upsell:** Backlink · Content.

**FAQ:** Bao lâu index? · Tỉ lệ index? · Link không index có hoàn? · Plugin cài thế nào?

---

## 8. Ma trận upsell
| Từ | Upsell |
|---|---|
| Keyword Research | Optimization · Content · Backlink |
| Audit | Optimization · Content · Backlink · Keyword |
| Content | Backlink · Indexer |
| Backlink | Content · Pyramid boost *(Indexer đã kèm)* |
| Website Optimization | Content · Backlink · hosting/maintenance |
| Website Development | Keyword · Content · SEO/Optimization · hosting/maintenance |
| Indexer | Backlink · Content |

---

## 9. Bảng tổng hợp pricing & report *(giá đã giảm 40%)*
| Dịch vụ | Pricing | Report/deliverable |
|---|---|---|
| Keyword Research | $19 / $39 / $79 | Cluster tải về + trang report (spider + SWOT) |
| Backlink Entity | $52 / $79 / $139 · **index 80–95% · kèm Indexer** | Excel + trang live report |
| Backlink Pyramid | $36 / $64 / $104 / $159 · **index ~70% · kèm Indexer** | Excel + trang live report |
| Backlink Guest | $104 / $180 / $280 · **index ~100% · kèm Indexer** | Excel + live report |
| Backlink PR | **consult** (từ ~$120/bài) · **index ~100%** | Link bài báo |
| Content A1000–A3000 | $12 / $19 / $28 | HTML + DOC + TXT + ảnh + **score & methodology (1 URL)** |
| Content H1000–H3000 | $24 / $39 / $56 | // |
| Audit | $19 / $39 / $69 | Trang report + PDF (điểm + lỗi severity) |
| Website Optimization | $40 / $79 · Ultra/Custom **consult** · **+AI-ready/GEO** | Web tối ưu + before/after + deploy |
| Website Development | từ $79… · full-site **báo giá sau draft** | Website + audit + hướng dẫn domain |
| Indexer | **Usage** $0.008/link (giảm theo volume) | Trạng thái index từng link + plugin |

---

## 10. Ghi chú dựng landing page (cho writing-plans)
- **Mọi trang dịch vụ dùng chung template §0.4** — chỉ thay nội dung. Component tái dùng: `ServiceHero` · `PackageGrid` · `CompareTable` · `HowItWorks` · `ReportPreview` · `OrderForm`/`RequestForm` · `ServiceFAQ` · `ServiceCTA`.
- **Data layer:** `SERVICE_PACKAGES` (id · service · name · forWho · features[] · price | 'consult' · sla · popular · indexRate?) + `SERVICE_META` (value prop · stats · faq[]) trong `data/services.ts`.
- **Order form:** gói cố định → `create_order` + trừ credit; gói consult → thread `messages` (chưa trừ credit).
- **Content report page:** route hiển thị **score + methodology + HTML preview** của bài viết (deliverable). **Backlink/Indexer live report:** route bảng link + % index.
- **Giá:** tất cả gói cố định đang **−60% (còn 40%)** — config 1 hệ số discount để bật/tắt dễ.
- **Thứ tự build:** Backlink (kỹ nhất) → nhân bản template cho 6 dịch vụ còn lại.
- Route: `/services/<service>` (đổi link sidebar; "Xem đơn" giữ trỏ board).
