import { createClient } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl">Hello, {user?.email}</h1>
      <form action={signOut}>
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </div>
  );
}