import { client } from '@/client/client.gen';
import { createClient } from '@/lib/supabase/client';

// Configure client with custom auth and base URL
client.setConfig({
    auth: async () => {
        if (typeof window !== 'undefined') {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            return session?.access_token || '';
        }
        return '';
    },
    baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000',
});
