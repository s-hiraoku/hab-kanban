-- Cards drop the Grok Bot fields (voice kind, moderation screening) and can point at a HAB Task or Relay
-- message by id. The board only shows those ids; it never reads or writes HAB's own database.
ALTER TABLE cards DROP COLUMN kind;
ALTER TABLE cards DROP COLUMN screening;
ALTER TABLE cards ADD COLUMN hab_task text;
ALTER TABLE cards ADD COLUMN hab_message text;
