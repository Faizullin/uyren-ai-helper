'use client';

import { useState, useMemo } from 'react';
import { Search, Download, Eye, MoreVertical, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface MarketplaceTemplate {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  system_prompt: string;
  tags: string[];
  download_count: number;
  creator_name: string;
  created_at: string;
  template_id: string;
  is_kortix_team: boolean;
}

interface MarketplaceTabProps {
  marketplaceSearchQuery: string;
  setMarketplaceSearchQuery: (query: string) => void;
  marketplaceFilter: 'all' | 'kortix' | 'community' | 'mine';
  setMarketplaceFilter: (filter: 'all' | 'kortix' | 'community' | 'mine') => void;
  marketplaceLoading: boolean;
  allMarketplaceItems: MarketplaceTemplate[];
  mineItems: MarketplaceTemplate[];
  installingItemId: string | null;
  onInstallClick: (item: MarketplaceTemplate, e?: React.MouseEvent) => void;
  onDeleteTemplate: (item: MarketplaceTemplate, e?: React.MouseEvent) => void;
  getItemStyling: (item: MarketplaceTemplate) => any;
  currentUserId: string;
  onAgentPreview: (agent: MarketplaceTemplate) => void;
  marketplacePage: number;
  setMarketplacePage: (page: number) => void;
  marketplacePageSize: number;
  onMarketplacePageSizeChange: (size: number) => void;
  marketplacePagination?: any;
}

export function MarketplaceTab({
  marketplaceSearchQuery,
  setMarketplaceSearchQuery,
  marketplaceFilter,
  setMarketplaceFilter,
  marketplaceLoading,
  allMarketplaceItems,
  installingItemId,
  onInstallClick,
  onDeleteTemplate,
  getItemStyling,
  currentUserId,
  onAgentPreview,
}: MarketplaceTabProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredItems = useMemo(() => {
    let filtered = allMarketplaceItems;

    // Apply search filter
    if (marketplaceSearchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(marketplaceSearchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(marketplaceSearchQuery.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(marketplaceSearchQuery.toLowerCase()))
      );
    }

    // Apply category filter
    switch (marketplaceFilter) {
      case 'kortix':
        filtered = filtered.filter(item => item.is_kortix_team);
        break;
      case 'community':
        filtered = filtered.filter(item => !item.is_kortix_team);
        break;
      case 'mine':
        filtered = filtered.filter(item => item.creator_id === currentUserId);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    return filtered;
  }, [allMarketplaceItems, marketplaceSearchQuery, marketplaceFilter, currentUserId]);

  const filterOptions = [
    { id: 'all', label: 'All Templates' },
    { id: 'kortix', label: 'Kortix Team' },
    { id: 'community', label: 'Community' },
    { id: 'mine', label: 'My Templates' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search marketplace..."
            value={marketplaceSearchQuery}
            onChange={(e) => setMarketplaceSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Options */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            {filterOptions.map((option) => (
              <Button
                key={option.id}
                variant="ghost"
                size="sm"
                onClick={() => setMarketplaceFilter(option.id)}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-all duration-200",
                  marketplaceFilter === option.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Marketplace Items */}
      {marketplaceLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              {marketplaceSearchQuery ? 'No templates found' : 'No templates available'}
            </h3>
            <p className="text-muted-foreground">
              {marketplaceSearchQuery
                ? 'Try adjusting your search query'
                : 'Check back later for new templates'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="p-6 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {item.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      by {item.creator_name}
                    </p>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onAgentPreview(item)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </DropdownMenuItem>
                    {item.creator_id === currentUserId && (
                      <DropdownMenuItem
                        onClick={(e) => onDeleteTemplate(item, e)}
                        className="text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {item.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-4">
                {item.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {item.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{item.tags.length - 3}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    <span>{item.download_count}</span>
                  </div>
                  {item.is_kortix_team && (
                    <div className="flex items-center gap-1 text-primary">
                      <Star className="h-3 w-3" />
                      <span>Official</span>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={(e) => onInstallClick(item, e)}
                  disabled={installingItemId === item.id}
                  className="flex items-center gap-1"
                >
                  {installingItemId === item.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Install
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
