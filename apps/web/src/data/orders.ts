/**
 * Quick-order catalog — the single source of truth now lives in the shared @heva/catalog package
 * (`@heva/catalog/orders`), so the marketing site (this app) and the dashboard checkout route handler
 * (apps/app /api/public/checkout) price from the SAME data. This file re-exports it so the existing
 * order components (OrderShell, OrderSummary, PackagePicker, pages/order/[slug]) keep importing
 * `~/data/orders` unchanged.
 */
export * from '@heva/catalog/orders';
