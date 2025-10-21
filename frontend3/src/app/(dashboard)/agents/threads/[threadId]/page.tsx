'use client';

import {
  ThreadParams,
} from '@/components/thread/types';
import React from 'react';
import { RedirectPage } from './redirect-page';

export default function ThreadPage({
  params,
}: {
  params: Promise<ThreadParams>;
}) {
  const unwrappedParams = React.use(params);
  return <RedirectPage threadId={unwrappedParams.threadId} />;
}