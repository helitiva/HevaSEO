-- Wire orders to REAL projects/folders. Until now order_details stored project/folder as free text, so a
-- typed "Cobalt Media" never became a projects row and the project detail page (which matched orders by
-- domain against the mock) never showed its orders. Add FKs so the order links to the actual rows; the text
-- columns stay for display/back-compat.
alter table order_details
  add column if not exists project_id uuid references projects(id) on delete set null,
  add column if not exists folder_id  uuid references folders(id)  on delete set null;

create index if not exists order_details_project_id_idx on order_details(project_id);
