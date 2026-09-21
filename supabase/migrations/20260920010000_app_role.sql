-- The web server uses a dedicated role with access only to its private schema.
-- Login is enabled and its password is set by backend/scripts/setup-app-role.js.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inventory_app') THEN
    CREATE ROLE inventory_app NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA inventory TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON inventory.users TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON inventory.items TO inventory_app;
GRANT SELECT, INSERT ON inventory.stock_log TO inventory_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory.login_attempts TO inventory_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA inventory TO inventory_app;

CREATE POLICY backend_users ON inventory.users
  FOR ALL TO inventory_app USING (true) WITH CHECK (true);
CREATE POLICY backend_items ON inventory.items
  FOR ALL TO inventory_app USING (true) WITH CHECK (true);
CREATE POLICY backend_stock_log ON inventory.stock_log
  FOR ALL TO inventory_app USING (true) WITH CHECK (true);
CREATE POLICY backend_login_attempts ON inventory.login_attempts
  FOR ALL TO inventory_app USING (true) WITH CHECK (true);
