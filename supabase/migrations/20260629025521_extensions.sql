-- Enable foundational extensions used across the schema.
create extension if not exists pgcrypto;   -- gen_random_uuid() for primary keys
create extension if not exists citext;      -- case-insensitive text (emails)
create extension if not exists pgtap;       -- in-database test framework
