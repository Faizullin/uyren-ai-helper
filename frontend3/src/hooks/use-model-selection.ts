'use client';

import { useModelStore, formatModelName } from '@/lib/stores/model-store';
import { useQuery } from '@tanstack/react-query';
import { BillingService, type ModelInfo } from '@/client';
import { useEffect, useMemo } from 'react';

export interface ModelOption {
  id: string;
  label: string;
  requiresSubscription: boolean;
  description?: string;
  priority?: number;
  recommended?: boolean;
  capabilities?: string[];
  contextWindow?: number;
}

// Helper function to get default model from API data
const getDefaultModel = (models: ModelOption[], hasActiveSubscription: boolean): string => {
  if (hasActiveSubscription) {
    // For premium users, find the first recommended model
    const recommendedModel = models.find(m => m.recommended);
    if (recommendedModel) return recommendedModel.id;
  }
  
  // For free users, find the first non-subscription model with highest priority
  const freeModels = models.filter(m => !m.requiresSubscription);
  if (freeModels.length > 0) {
    const sortedFreeModels = freeModels.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return sortedFreeModels[0].id;
  }
  
  // Fallback to first available model
  return models.length > 0 ? models[0].id : 'gpt-4o-mini';
};

export function useModelSelection() {
  // Fetch models using OpenAPI client
  const { data: modelsData, isLoading } = useQuery({
    queryKey: ['models', 'available'],
    queryFn: async () => {
      const response = await BillingService.get_available_models();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const { selectedModel, setSelectedModel } = useModelStore();

  // Transform API data to ModelOption format
  const availableModels = useMemo<ModelOption[]>(() => {
    if (!modelsData?.models) return [];
    
    return modelsData.models.map((model: ModelInfo) => ({
      id: model.id,
      label: model.name,
      requiresSubscription: false, // Assume all models are available for now
      priority: 0,
      recommended: model.name.toLowerCase().includes('gpt-4') || model.name.toLowerCase().includes('claude'),
      capabilities: [],
      contextWindow: model.context_window || 128000,
    })).sort((a, b) => {
      // Sort by recommended first, then priority, then name
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.label.localeCompare(b.label);
    });
  }, [modelsData]);

  // Initialize selected model when data loads
  useEffect(() => {
    if (isLoading || !availableModels.length) return;

    // If no model selected or selected model is not available, pick default
    if (!selectedModel || !availableModels.some(m => m.id === selectedModel)) {
      const defaultModelId = getDefaultModel(availableModels, true); // Assume active subscription for now
      
      if (defaultModelId) {
        console.log('🔧 useModelSelection: Setting API-determined default model:', defaultModelId);
        setSelectedModel(defaultModelId);
      }
    }
  }, [selectedModel, availableModels, isLoading, setSelectedModel]);

  const handleModelChange = (modelId: string) => {
    const model = availableModels.find(m => m.id === modelId);
    if (model) {
      console.log('🔧 useModelSelection: Changing model to:', modelId);
      setSelectedModel(modelId);
    }
  };

  return {
    selectedModel: selectedModel || 'gpt-4o-mini',
    setSelectedModel: handleModelChange,
    availableModels,
    allModels: availableModels, // For compatibility
    isLoading,
    modelsData, // Expose raw API data for components that need it
    subscriptionStatus: 'active' as const, // Assume active for now
    canAccessModel: (modelId: string) => {
      return availableModels.some(m => m.id === modelId);
    },
    isSubscriptionRequired: (modelId: string) => {
      const model = availableModels.find(m => m.id === modelId);
      return model?.requiresSubscription || false;
    },
    
    // Compatibility stubs
    handleModelChange,
    customModels: [] as any[],
    addCustomModel: (_model: any) => {},
    updateCustomModel: (_id: string, _model: any) => {},
    removeCustomModel: (_id: string) => {},
    
    // Get the actual model ID to send to the backend (no transformation needed)
    getActualModelId: (modelId: string) => modelId,
    
    // Refresh function for compatibility
    refreshCustomModels: () => {},
    formatModelName,
  };
}
