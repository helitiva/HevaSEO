# HevaSEO — Tổng quan hệ thống (System Overview)

Trang tổng hợp **toàn diện tính năng · cấu trúc · kỹ thuật** của HevaSEO Platform theo 4 vai trò
(Khách hàng, Staff, Manager, Admin) — dành cho cấp lãnh đạo nắm cả bức tranh lớn lẫn chi tiết.

Trang **độc lập**, không thuộc app chính, không cần build.

## Cách mở

**Double-click `index.html`** — xong. File này **self-contained** (CSS + JS gộp sẵn bên trong), mở ở bất kỳ đâu (kể cả `file://`) đều chạy. Chỉ cần mạng để tải font Inter + icon Phosphor; không có mạng thì vẫn xem được nội dung, chỉ thiếu icon/font đẹp.

> Nếu mở `file://` mà thiếu icon, chạy server tĩnh: `cd system-overview && python3 -m http.server 8080` → `http://localhost:8080`.

## Cập nhật theo code (real-time) + rebuild

```bash
node system-overview/generate.mjs
```

Lệnh này: (1) quét repo tính lại số liệu (màn hình, component, type, dịch vụ, spec), (2) **gộp `styles.css` + `data.js` + `app.js` vào một `index.html` self-contained**. Chạy lại sau mỗi lần sửa nguồn. Footer trang hiển thị thời điểm tính gần nhất.

## Cấu trúc file

| File | Vai trò |
|---|---|
| `index.html` | **Output self-contained — đừng sửa tay** (do generate.mjs tạo) |
| `index.template.html` | Khung HTML + thanh điều hướng — sửa tay khi thêm/bớt section |
| `styles.css` | Giao diện (dark/light, dark-luxury editorial) — sửa tay |
| `data.js` | **Nội dung định tính** (tính năng, vai trò, dịch vụ, roadmap) — sửa tay |
| `app.js` | Logic render + chart SVG + nav — sửa tay |
| `metrics.js` | Số liệu auto-generated (cũng được inline vào index.html) |
| `generate.mjs` | Quét repo → tính metrics + build `index.html` |

> Sửa nội dung/giao diện ở `data.js` / `styles.css` / `app.js` / `index.template.html`, **rồi chạy `generate.mjs`** để build lại `index.html`.

> Quy ước trạng thái: ✓ `done` = UI hoàn chỉnh (mock) · ◦ `partial` = đang mở rộng · ○ `planned` = chờ backend.
> Khi một tính năng đổi trạng thái, cập nhật trong `data.js`.
