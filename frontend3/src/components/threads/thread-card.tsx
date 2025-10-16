'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Trash2, MoreVertical, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Thread, useDeleteThread } from '@/hooks/use-threads';
import Link from 'next/link';

interface ThreadCardProps {
  thread: Thread;
  onUpdate?: () => void;
}

export function ThreadCard({ thread, onUpdate }: ThreadCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteThread = useDeleteThread();

  const handleDelete = async () => {
    await deleteThread.mutateAsync(thread.thread_id);
    setShowDeleteDialog(false);
    onUpdate?.();
  };

  const threadTitle = thread.metadata?.title || `Thread ${thread.thread_id.slice(0, 8)}`;

  return (
    <>
      <Card className="p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{threadTitle}</h3>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <span>Created {new Date(thread.created_at).toLocaleDateString()}</span>
                {thread.updated_at && (
                  <span>Updated {new Date(thread.updated_at).toLocaleDateString()}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ID: {thread.thread_id}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/threads/${thread.thread_id}`}>
              <Button variant="ghost" size="icon">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Thread</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this thread? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

