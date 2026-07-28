-- inc-analytics(geo): tag customers with a country (numeric ISO, e.g. '840' US) so the GeoPanel can
-- aggregate real customers-by-country. Display meta (flag/name/map coords) is a static lookup client-side;
-- only the counts are real. Nullable + additive; RLS unchanged.
alter table customers add column if not exists country_iso text;
