import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const db: SupabaseClient | null = config.useMemoryStore
  ? null
  : createClient(config.supabaseUrl!, config.supabaseServiceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
