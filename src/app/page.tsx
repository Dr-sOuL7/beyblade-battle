import React from 'react';

import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data, error } = await supabase
    .from("users")
    .select("*");

  console.log(data);

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-5xl font-bold">
        Beyblade Battle Arena
      </h1>

      <p className="mt-6 text-xl">
        Supabase connection successful.
      </p>

      <pre className="mt-10 bg-zinc-900 p-4 rounded-xl overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
