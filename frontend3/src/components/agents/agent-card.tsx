'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Edit, 
  Trash2, 
  MoreVertical, 
  Star, 
  StarOff, 
  Globe, 
  GlobeLock,
  Download,
  Shield,
  GitBranch,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type { AgentPublic } from '@/client/types.gen';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: AgentPublic;
  onUpdate?: () => void;
  onEdit?: (agentId: string) => void;
  onDelete?: (agentId: string) => void;
  onToggleDefault?: (agentId: string, currentDefault: boolean) => void;
  onPublish?: (agent: AgentPublic) => void;
  onUnpublish?: (agentId: string, agentName: string) => void;
  onStartChat?: (agentId: string) => void;
  isPublishing?: boolean;
  isUnpublishing?: boolean;
  isDeleting?: boolean;
}

export function AgentCard({ 
  agent, 
  onUpdate, 
  onEdit, 
  onDelete, 
  onToggleDefault,
  onPublish,
  onUnpublish,
  onStartChat,
  isPublishing,
  isUnpublishing,
  isDeleting,
}: AgentCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = () => {
    if (onDelete) {
      onDelete(agent.id);
    }
    setShowDeleteDialog(false);
    onUpdate?.();
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(agent.id);
    }
  };

  const handleToggleDefault = () => {
    if (onToggleDefault) {
      onToggleDefault(agent.id, agent.is_default);
    }
  };

  const handlePublish = () => {
    if (onPublish) {
      onPublish(agent);
    }
  };

  const handleUnpublish = () => {
    if (onUnpublish) {
      onUnpublish(agent.id, agent.name);
    }
  };

  return (
    <>
      <Card className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20",
        isDeleting && "opacity-60 scale-95"
      )}>
        {/* Deleting Overlay */}
        {isDeleting && (
          <div className="absolute inset-0 bg-destructive/10 backdrop-blur-sm z-20 flex items-center justify-center">
            <div className="bg-background/95 rounded-lg px-4 py-3 flex items-center gap-2 shadow-lg border">
              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
              <span className="text-sm font-medium text-destructive">Deleting...</span>
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Header with Avatar and Actions */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{agent.name}</h3>
                  {agent.is_default && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {agent.version_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <GitBranch className="h-3 w-3 mr-1" />
                      v{agent.version_count}
                    </Badge>
                  )}
                  {agent.is_public && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Published
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {onStartChat && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onStartChat(agent.id)}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Start Chat
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isDeleting}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                
                {onToggleDefault && (
                  <DropdownMenuItem onClick={handleToggleDefault}>
                    {agent.is_default ? (
                      <>
                        <StarOff className="mr-2 h-4 w-4" />
                        Remove Default
                      </>
                    ) : (
                      <>
                        <Star className="mr-2 h-4 w-4" />
                        Set as Default
                      </>
                    )}
                  </DropdownMenuItem>
                )}

                {(onPublish || onUnpublish) && <DropdownMenuSeparator />}

                {onPublish && !agent.is_public && (
                  <DropdownMenuItem onClick={handlePublish} disabled={isPublishing}>
                    {isPublishing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Globe className="mr-2 h-4 w-4" />
                        Publish Template
                      </>
                    )}
                  </DropdownMenuItem>
                )}

                {onUnpublish && agent.is_public && (
                  <DropdownMenuItem onClick={handleUnpublish} disabled={isUnpublishing}>
                    {isUnpublishing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Unpublishing...
                      </>
                    ) : (
                      <>
                        <GlobeLock className="mr-2 h-4 w-4" />
                        Make Private
                      </>
                    )}
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description */}
          {agent.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
              {agent.description}
            </p>
          )}

          {/* Tags */}
          {agent.tags && agent.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-4">
              {agent.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {agent.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{agent.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer with metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created {new Date(agent.created_at).toLocaleDateString()}</span>
            
            {agent.is_public && (agent as any).download_count > 0 && (
              <div className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                <span>{(agent as any).download_count} downloads</span>
              </div>
            )}
          </div>
        </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be
              undone.
              {agent.is_public && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  Note: This agent is currently published and will be removed from the marketplace.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

