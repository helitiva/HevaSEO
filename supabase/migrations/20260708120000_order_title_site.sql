-- Per-order campaign title + the exact site URL the customer submitted. Non-money, additive.
--   title — an optional campaign / order title ("Q3 link push"); when blank the app fills a default like
--           "1st Backlink order for dantri.com". Shown as the card headline.
--   site  — the website URL the customer actually entered in the brief; shown on the card (replaces the
--           company-name placeholder) and used as the project domain source.
alter table order_details
  add column if not exists title text,
  add column if not exists site  text;
