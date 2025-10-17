'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAgents } from '@/hooks/use-agents';
import { useDialogControl } from '@/hooks/use-dialog-control';

// Components
import { AgentsPageHeader } from './_components/agents-page-header';
import { TabsNavigation } from './_components/tabs-navigation';
import { MyAgentsTab } from './_components/my-agents-tab';
import { MarketplaceTab } from './_components/marketplace-tab';
import { LoadingSkeleton } from './_components/loading-skeleton';
import { NewAgentDialog } from './_components/new-agent-dialog';
import { MarketplaceAgentPreviewDialog } from './_components/marketplace-agent-preview-dialog';
import { AgentCountLimitDialog } from './_components/agent-count-limit-dialog';
import { PublishDialog } from './_components/publish-dialog';
import { StreamlinedInstallDialog } from './_components/streamlined-install-dialog';

type ViewMode = 'grid' | 'list';
type AgentSortOption = 'name' | 'created_at' | 'updated_at' | 'tools_count';
type MarketplaceSortOption = 'newest' | 'popular' | 'most_downloaded' | 'name';
type SortOrder = 'asc' | 'desc';

interface FilterOptions {
  hasDefaultAgent: boolean;
  hasMcpTools: boolean;
  hasAgentpressTools: boolean;
  selectedTools: string[];
}

interface PublishDialogData {
  templateId: string;
  templateName: string;
}

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
  marketplace_published_at?: string;
  icon_name?: string;
  icon_color?: string;
  icon_background?: string;
  template_id: string;
  is_kortix_team: boolean;
  mcp_requirements?: any[];
  metadata?: any;
  usage_examples?: any[];
  config?: any;
}

export default function AgentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Dialog controls using the new hook
  const createAgentDialog = useDialogControl();
  const editAgentDialog = useDialogControl<string>();
  const publishDialog = useDialogControl<PublishDialogData>();
  const installDialog = useDialogControl<MarketplaceTemplate>();
  const previewDialog = useDialogControl<MarketplaceTemplate>();
  const agentLimitDialog = useDialogControl<any>();

  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [agentsPage, setAgentsPage] = useState(1);
  const [agentsPageSize, setAgentsPageSize] = useState(20);
  const [agentsSearchQuery, setAgentsSearchQuery] = useState('');
  const [agentsSortBy, setAgentsSortBy] = useState<AgentSortOption>('created_at');
  const [agentsSortOrder, setAgentsSortOrder] = useState<SortOrder>('desc');
  const [agentsFilters, setAgentsFilters] = useState<FilterOptions>({
    hasDefaultAgent: false,
    hasMcpTools: false,
    hasAgentpressTools: false,
    selectedTools: []
  });

  const [marketplacePage, setMarketplacePage] = useState(1);
  const [marketplacePageSize, setMarketplacePageSize] = useState(20);
  const [marketplaceSearchQuery, setMarketplaceSearchQuery] = useState('');
  const [marketplaceSelectedTags, setMarketplaceSelectedTags] = useState<string[]>([]);
  const [marketplaceSortBy, setMarketplaceSortBy] = useState<MarketplaceSortOption>('newest');
  const [installingItemId, setInstallingItemId] = useState<string | null>(null);
  const [marketplaceFilter, setMarketplaceFilter] = useState<'all' | 'kortix' | 'community' | 'mine'>('all');

  const [templatesPage, setTemplatesPage] = useState(1);
  const [templatesPageSize, setTemplatesPageSize] = useState(20);
  const [templatesSearchQuery, setTemplatesSearchQuery] = useState('');
  const [templatesSortBy, setTemplatesSortBy] = useState<'created_at' | 'name' | 'download_count'>('created_at');
  const [templatesSortOrder, setTemplatesSortOrder] = useState<'asc' | 'desc'>('desc');
  const [templatesActioningId, setTemplatesActioningId] = useState<string | null>(null);
  const [publishingAgentId, setPublishingAgentId] = useState<string | null>(null);

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab');
    return tab || 'my-agents';
  }, [searchParams]);

  // Mock data for marketplace (in real app, this would come from API)
  const mockMarketplaceItems: MarketplaceTemplate[] = [
    {
      id: '1',
      creator_id: 'kortix',
      name: 'Email Assistant',
      description: 'Helps you manage and respond to emails efficiently',
      system_prompt: 'You are an email assistant that helps users manage their inbox.',
      tags: ['email', 'productivity'],
      download_count: 1234,
      creator_name: 'Kortix Team',
      created_at: '2024-01-01',
      template_id: 'email-assistant',
      is_kortix_team: true,
    },
    {
      id: '2',
      creator_id: 'community',
      name: 'Code Reviewer',
      description: 'Reviews and suggests improvements for code',
      system_prompt: 'You are a code reviewer that provides constructive feedback.',
      tags: ['coding', 'development'],
      download_count: 856,
      creator_name: 'Community',
      created_at: '2024-01-15',
      template_id: 'code-reviewer',
      is_kortix_team: false,
    },
  ];

  const { data: agents, isLoading: agentsLoading, error: agentsError, refetch: loadAgents } = useAgents();

  const clearAgentsFilters = () => {
    setAgentsSearchQuery('');
    setAgentsFilters({
      hasDefaultAgent: false,
      hasMcpTools: false,
      hasAgentpressTools: false,
      selectedTools: []
    });
    setAgentsPage(1);
  };

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleCreateNewAgent = useCallback(() => {
    createAgentDialog.show();
  }, [createAgentDialog]);

  const handleEditAgent = (agentId: string) => {
    editAgentDialog.show(agentId);
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      // In real app, this would call the delete API
      toast.success('Agent deleted successfully');
      loadAgents();
    } catch (error) {
      toast.error('Failed to delete agent');
    }
  };

  const handleToggleDefault = async (agentId: string, currentDefault: boolean) => {
    try {
      // In real app, this would call the update API
      toast.success(`Agent ${currentDefault ? 'removed from' : 'set as'} default`);
      loadAgents();
    } catch (error) {
      toast.error('Failed to update agent');
    }
  };

  const handleInstallClick = (item: MarketplaceTemplate, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    installDialog.show(item);
  };

  const handlePreviewInstall = (agent: MarketplaceTemplate) => {
    previewDialog.hide();
    installDialog.show(agent);
  };

  const handleAgentPreview = (agent: MarketplaceTemplate) => {
    previewDialog.show(agent);
    
    // Update URL with agent parameter for sharing
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('agent', agent.id);
    currentUrl.searchParams.set('tab', 'my-agents');
    router.replace(currentUrl.toString(), { scroll: false });
  };

  const handleInstall = async (
    item: MarketplaceTemplate, 
    instanceName?: string, 
    profileMappings?: Record<string, string>, 
    customMcpConfigs?: Record<string, Record<string, any>>,
    triggerConfigs?: Record<string, Record<string, any>>,
    triggerVariables?: Record<string, Record<string, string>>
  ) => {
    setInstallingItemId(item.id);
    
    try {
      if (!instanceName || instanceName.trim() === '') {
        toast.error('Please provide a name for the agent');
        return;
      }

      // In real app, this would call the install API
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      toast.success(`Agent "${instanceName}" installed successfully!`);
      installDialog.hide();
      handleTabChange('my-agents');
    } catch (error: any) {
      toast.error(error.message || 'Failed to install agent. Please try again.');
    } finally {
      setInstallingItemId(null);
    }
  };

  const handleAgentsPageSizeChange = (newPageSize: number) => {
    setAgentsPageSize(newPageSize);
    setAgentsPage(1);
  };

  const handleMarketplacePageSizeChange = (newPageSize: number) => {
    setMarketplacePageSize(newPageSize);
    setMarketplacePage(1);
  };

  const handleTemplatesPageSizeChange = (newPageSize: number) => {
    setTemplatesPageSize(newPageSize);
    setTemplatesPage(1);
  };

  const handleUnpublish = async (templateId: string, templateName: string) => {
    try {
      setTemplatesActioningId(templateId);
      // In real app, this would call the unpublish API
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`${templateName} has been unpublished from the marketplace`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to unpublish template');
    } finally {
      setTemplatesActioningId(null);
    }
  };

  const handleDeleteTemplate = async (item: MarketplaceTemplate, e?: React.MouseEvent) => {
    try {
      setTemplatesActioningId(item.template_id);
      // In real app, this would call the delete template API
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`"${item.name}" has been permanently deleted from the marketplace`, {
        description: 'The template is no longer available for installation.'
      });
    } catch (error: any) {
      toast.error('Failed to delete template', {
        description: error.message || 'Please try again later.'
      });
    } finally {
      setTemplatesActioningId(null);
    }
  };

  const openPublishDialog = (template: any) => {
    publishDialog.show({
      templateId: template.template_id,
      templateName: template.name
    });
  };

  const handleAgentPublish = (agent: any) => {
    publishDialog.show({
      templateId: agent.agent_id,
      templateName: agent.name
    });
  };

  const handlePublish = async (usageExamples: any[]) => {
    if (!publishDialog.data) return;

    try {
      const isAgent = publishDialog.data.templateId.length > 20;
      
      if (isAgent) {
        setPublishingAgentId(publishDialog.data.templateId);
      } else {
        setTemplatesActioningId(publishDialog.data.templateId);
      }
      
      // In real app, this would call the publish API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(`${publishDialog.data.templateName} has been published to the marketplace`);
      publishDialog.hide();
    } catch (error: any) {
      toast.error(error.message || 'Failed to publish template');
    } finally {
      setTemplatesActioningId(null);
      setPublishingAgentId(null);
    }
  };

  const getItemStyling = (item: MarketplaceTemplate) => {
    return {
      color: '#6366f1',
    };
  };

  const getTemplateStyling = (template: any) => {
    return {
      color: '#6366f1',
    };
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <AgentsPageHeader />
      </div>
      <div className="sticky top-0 z-50">
        <div className="absolute inset-0 backdrop-blur-md" style={{
          maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
        }}></div>
        <div className="relative bg-gradient-to-b from-background/95 via-background/70 to-transparent">
          <div className="container mx-auto max-w-7xl px-4 py-4">
            <TabsNavigation 
              activeTab={activeTab} 
              onTabChange={handleTabChange} 
              onCreateAgent={handleCreateNewAgent} 
            />
          </div>
        </div>
      </div>
      <div className="container mx-auto max-w-7xl px-4 py-2">
        <div className="w-full min-h-[calc(100vh-300px)]">
          {activeTab === "my-agents" && (
            <MyAgentsTab
              agentsSearchQuery={agentsSearchQuery}
              setAgentsSearchQuery={setAgentsSearchQuery}
              agentsLoading={agentsLoading}
              agents={agents || []}
              agentsPagination={undefined}
              viewMode={viewMode}
              onCreateAgent={handleCreateNewAgent}
              onEditAgent={handleEditAgent}
              onDeleteAgent={handleDeleteAgent}
              onToggleDefault={handleToggleDefault}
              onClearFilters={clearAgentsFilters}
              isDeletingAgent={false}
              setAgentsPage={setAgentsPage}
              agentsPageSize={agentsPageSize}
              onAgentsPageSizeChange={handleAgentsPageSizeChange}
              myTemplates={[]}
              templatesLoading={false}
              templatesError={null}
              templatesActioningId={templatesActioningId}
              templatesPagination={undefined}
              templatesPage={templatesPage}
              setTemplatesPage={setTemplatesPage}
              templatesPageSize={templatesPageSize}
              onTemplatesPageSizeChange={handleTemplatesPageSizeChange}
              templatesSearchQuery={templatesSearchQuery}
              setTemplatesSearchQuery={setTemplatesSearchQuery}
              onPublish={openPublishDialog}
              onUnpublish={handleUnpublish}
              getTemplateStyling={getTemplateStyling}
              onPublishAgent={handleAgentPublish}
              publishingAgentId={publishingAgentId}
            />
          )}

          {activeTab === "marketplace" && (
            <MarketplaceTab
              marketplaceSearchQuery={marketplaceSearchQuery}
              setMarketplaceSearchQuery={setMarketplaceSearchQuery}
              marketplaceFilter={marketplaceFilter}
              setMarketplaceFilter={setMarketplaceFilter}
              marketplaceLoading={false}
              allMarketplaceItems={mockMarketplaceItems}
              mineItems={[]}
              installingItemId={installingItemId}
              onInstallClick={handleInstallClick}
              onDeleteTemplate={handleDeleteTemplate}
              getItemStyling={getItemStyling}
              currentUserId="current-user"
              onAgentPreview={handleAgentPreview}
              marketplacePage={marketplacePage}
              setMarketplacePage={setMarketplacePage}
              marketplacePageSize={marketplacePageSize}
              onMarketplacePageSizeChange={handleMarketplacePageSizeChange}
              marketplacePagination={undefined}
            />
          )}
        </div>

        {/* Dialogs using the new dialog control hook */}
        <PublishDialog
          control={publishDialog}
          templatesActioningId={templatesActioningId}
          onPublish={handlePublish}
        />

        <StreamlinedInstallDialog
          control={installDialog}
          onInstall={handleInstall}
          isInstalling={installingItemId === installDialog.data?.id}
        />

        <NewAgentDialog 
          control={createAgentDialog}
        />

        <MarketplaceAgentPreviewDialog
          control={previewDialog}
          onInstall={handlePreviewInstall}
          isInstalling={installingItemId === previewDialog.data?.id}
        />

        {agentLimitDialog.data && (
          <AgentCountLimitDialog
            control={agentLimitDialog}
          />
            )}
          </div>
    </div>
  );
}

