# Apply migration 002 (required for native product values + line_details column)

1. Open https://supabase.com/dashboard/project/fezrvbugwvxiyebefcth/sql/new
2. Paste `db/migrations/002_expand_products_and_line_details.sql`
3. Run

Until this runs, the MCP server still accepts the new product lines using a legacy product-column mapping plus JSON `line_details` / `activities` storage.
