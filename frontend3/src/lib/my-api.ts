'use client';

import { type CreateClientConfig } from '@/client/client.gen';
import { config } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';

export const createClientConfig: CreateClientConfig = (clientConfig) => ({
  ...clientConfig,
  auth: async () => {
    if (typeof window !== 'undefined') {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || '';
    }
    return '';
  },
  baseURL: config.BACKEND_URL,
});