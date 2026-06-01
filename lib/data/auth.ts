import { type SupabaseClient, type User } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function getCurrentUser(supabase: Client): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(supabase: Client): Promise<User> {
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("unauthenticated");
  return user;
}

export async function getCurrentEstudioId(supabase: Client): Promise<string> {
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("estudio_members")
    .select("estudio_id")
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
  return data.estudio_id;
}
