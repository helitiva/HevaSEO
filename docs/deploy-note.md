# Deploy notes — `@heva/app`

Ghi chú vận hành/deploy cho app Next.js. Bổ sung dần khi gặp.

---

## `output: 'standalone'` không tương thích với `next start`

**Phát hiện:** 2026-06-27 (lúc đo production build).

[`next.config.mjs`](../apps/app/next.config.mjs) đặt `output: 'standalone'` (để self-host kiểu
Docker — Next gói sẵn một node server bundle). Với cấu hình này, **`next start` KHÔNG chạy đúng**.
Build log cảnh báo:

```
⚠ "next start" does not work with "output: standalone" configuration.
  Use "node .next/standalone/server.js" instead.
```

**Hệ quả:** script `"start": "next start --port 4400"` trong
[`apps/app/package.json`](../apps/app/package.json) là **sai cho production thật**. Nó vẫn lên
được nhưng không dùng standalone bundle như chủ ý.

### Cách chạy production đúng

Sau `next build`, standalone bundle nằm ở `.next/standalone/`. Lưu ý nó **không tự copy**
`.next/static` và `public/` — phải copy thủ công (hoặc trong Dockerfile):

```bash
# từ apps/app
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public   # nếu có thư mục public

# chạy server
PORT=4400 node .next/standalone/server.js
```

`server.js` đọc port qua biến môi trường `PORT` (không phải cờ `--port`).

### Hai hướng xử lý (chọn 1 khi deploy)

1. **Giữ standalone** (deploy Docker / self-host theo §8 architecture plan):
   - Sửa script `start` thành `node .next/standalone/server.js` (kèm bước copy static/public),
     hoặc đặt các lệnh đó trong Dockerfile.
2. **Không cần standalone** (deploy nền tảng tự lo server, vd Vercel/Node thường):
   - Bỏ `output: 'standalone'` khỏi `next.config.mjs` → `next start` chạy bình thường.

Hiện chưa chốt hạ tầng deploy nên **chưa sửa** — để đây làm mốc khi tới bước deploy thật.
