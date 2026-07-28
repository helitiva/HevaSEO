# Deploy lên Vultr qua Coolify

Runbook đưa HevaSEO (apps/app, Next.js standalone) lên production. Payment (Stripe) chưa bật — bỏ qua các biến Stripe cho tới khi tích hợp.

## 0. Những thứ CẦN CHUẨN BỊ trước (việc của bạn)

| # | Thứ cần có | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | **Supabase production project** (khuyên dùng supabase.com cloud) | toàn bộ backend | Lấy: Project URL, `anon` key, `service_role` key |
| 2 | **SMTP** (Resend / Brevo / Postmark / SES) | email xác nhận đăng ký + email quên mật khẩu | Điền vào Supabase → Auth → SMTP Settings. Không có SMTP thì đăng ký kẹt ở "check your email" và quên mật khẩu không gửi được link |
| 3 | **Google reCAPTCHA v2** (checkbox) cho domain thật | login / register / forgot | console: https://www.google.com/recaptcha/admin — lấy SITE KEY (public) + SECRET KEY (server) |
| 4 | **Cloudflare Turnstile** cho domain thật | quick-checkout marketing (`/api/public/checkout`) | lấy secret → `TURNSTILE_SECRET` |
| 5 | **Domain**: app (vd `app.hevaseo.com`) + marketing (`hevaseo.com`) | origin/cookie/redirect | trỏ DNS về Vultr, Coolify tự cấp SSL |
| 6 | **CRON_SECRET**: chuỗi ngẫu nhiên dài (vd `openssl rand -hex 32`) | bảo vệ `/api/cron/auto-approve` | endpoint này fail-closed ở production nếu thiếu |

## 1. Supabase production — thiết lập một lần

1. Tạo project → ghi lại URL + keys.
2. **Chạy migrations, KHÔNG chạy seed**:
   ```bash
   supabase link --project-ref <ref>
   supabase db push          # áp dụng supabase/migrations/*
   ```
   `seed.sql` là dữ liệu demo (5 tài khoản password `demo1234`, có cả admin) — **tuyệt đối không đưa lên prod**.
3. **Bật custom access token hook** (bắt buộc — toàn bộ RLS đọc claims từ đây):
   Dashboard → Authentication → Hooks → Customize Access Token → chọn `public.custom_access_token_hook`.
4. **Auth URLs**: Authentication → URL Configuration:
   - Site URL: `https://app.<domain>`
   - Additional Redirect URLs: `https://app.<domain>/reset-password`
5. **SMTP**: Authentication → SMTP Settings → điền provider (mục 0.2). Bật "Confirm email".
6. **Tạo admin đầu tiên** (shadow-profile rồi tự claim bằng đăng ký cùng email):
   ```sql
   insert into public.profiles (tenant_id, user_id, email, name, role, status)
   values ('a9e0c0de-0000-4000-8000-000000000001', null, '<email-cua-ban>', '<Ten>', 'admin', 'invited');
   ```
   Xong vào `https://app.<domain>/register` đăng ký đúng email đó → trigger LINK giữ role admin.
   (Lưu ý: tenant id đang cố định trong `handle_new_user` — hệ đang chạy single-tenant.)

## 2. Coolify — app service

- **Source**: repo GitHub, branch `main`.
- **Build**: Nixpacks/Dockerfile đều được; app là monorepo pnpm:
  - Install: `pnpm install --frozen-lockfile`
  - Build: `pnpm --filter @heva/app build`
  - Start: `node apps/app/.next/standalone/apps/app/server.js` (output standalone) — hoặc `pnpm --filter @heva/app start`
  - Port: 3000 (hoặc set `PORT`)
- **Node ≥ 22** (package.json engines).

### Biến môi trường (Coolify → Environment)

| Biến | Giá trị | Bắt buộc |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase | ✅ (cần lúc BUILD — CSP + client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server-only) | ✅ |
| `NEXT_PUBLIC_APP_ORIGIN` | `https://app.<domain>` | ✅ (redirect email reset) |
| `NEXT_PUBLIC_MARKETING_ORIGIN` | `https://<domain>` | ✅ (link affiliate /r/) |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | site key thật | ✅ |
| `RECAPTCHA_SECRET_KEY` | secret key thật | ✅ (server verify; thiếu = auth form bị chặn) |
| `TURNSTILE_SECRET` | secret Turnstile | ✅ nếu dùng quick-checkout |
| `CRON_SECRET` | chuỗi ngẫu nhiên | ✅ |
| `MARKETING_ORIGIN` | `https://<domain>` | dùng bởi checkout public |
| `PAYMENTS_PROVIDER` / `STRIPE_*` | — | ⏸ để sau khi tích hợp Stripe |

> `NEXT_PUBLIC_*` phải có mặt **lúc build** (Coolify inject build-time env). Đổi giá trị = rebuild.

## 3. Cron (auto-approve đơn quá hạn review)

Coolify → Scheduled Tasks (hoặc cron bất kỳ), chạy hằng ngày:
```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.<domain>/api/cron/auto-approve
```
Không lịch này thì đơn delivered không bao giờ tự approve (và hoa hồng affiliate theo đường auto cũng không chạy).

## 4. Kiểm tra sau deploy (smoke 10 phút)

1. `curl -I https://app.<domain>` → thấy `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`.
2. `/login` **không** hiện khối "Log in as … demo1234" (chỉ dev mới có).
3. Đăng ký tài khoản mới (reCAPTCHA thật) → nhận email confirm → đăng nhập → đặt thử đơn.
4. Quên mật khẩu → nhận email → đặt lại → đăng nhập bằng mật khẩu mới.
5. `/r/<code>` (affiliate) → redirect marketing + cookie `heva_ref`.
6. Đăng nhập admin → tạo staff/manager/affiliate qua invite flow.

## 5. Chưa gộp trong lần deploy này (biết trước)

- Ảnh đại diện (upload) cần Supabase Storage bucket — nút đổi ảnh chưa hoạt động.
- Trang danh bạ admin staff/manager còn hiển thị roster mock trộn overlay (dữ liệu thật vẫn đúng ở các trang tiền/đơn).
- Affiliate self-register (`/affiliate/register`) còn mock + đang bị middleware chặn anonymous — partner tạo qua admin invite.
- CSP đang dùng `'unsafe-inline'` cho script (Next inline bootstrap); nâng cấp nonce là việc sau.
- Stripe: toàn bộ payment thật + webhook — chờ bạn có key.
