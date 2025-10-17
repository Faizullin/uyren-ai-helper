'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Image as ImageIcon,
  Presentation,
  BarChart3,
  ArrowUpRight,
  FileText,
  Search,
  Users,
  RefreshCw,
  Check,
  Table,
  LayoutDashboard,
  FileBarChart,
  Code2,
  Sparkles,
} from 'lucide-react';

interface SunaModesPanelProps {
  selectedMode: string | null;
  onModeSelect: (mode: string | null) => void;
  onSelectPrompt: (prompt: string) => void;
  isMobile?: boolean;
  selectedCharts?: string[];
  onChartsChange?: (charts: string[]) => void;
  selectedOutputFormat?: string | null;
  onOutputFormatChange?: (format: string | null) => void;
}

type ModeType = 'image' | 'slides' | 'data' | 'docs' | 'people' | 'research';

interface Mode {
  id: ModeType;
  label: string;
  icon: React.ReactNode;
  samplePrompts: string[];
  options?: {
    title: string;
    items: Array<{
      id: string;
      name: string;
      image?: string;
      description?: string;
    }>;
  };
  chartTypes?: {
    title: string;
    items: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
  };
}

const modes: Mode[] = [
  {
    id: 'image',
    label: 'Image',
    icon: <ImageIcon className="w-4 h-4" />,
    samplePrompts: [
      'A majestic golden eagle soaring through misty mountain peaks at sunrise with dramatic lighting',
      'Close-up portrait of a fashion model with avant-garde makeup, studio lighting, high contrast shadows',
      'Cozy Scandinavian living room with natural wood furniture, indoor plants, and soft morning sunlight',
      'Futuristic cyberpunk street market at night with neon signs, rain-slicked pavement, and holographic displays',
      'Elegant product photography of luxury perfume bottle on marble surface with soft reflections',
    ],
    options: {
      title: 'Choose a style',
      items: [
        { id: 'photorealistic', name: 'Photorealistic' },
        { id: 'watercolor', name: 'Watercolor' },
        { id: 'digital-art', name: 'Digital Art' },
        { id: 'oil-painting', name: 'Oil Painting' },
        { id: 'minimalist', name: 'Minimalist' },
        { id: 'vintage', name: 'Vintage' },
      ],
    },
  },
  {
    id: 'slides',
    label: 'Slides',
    icon: <Presentation className="w-4 h-4" />,
    samplePrompts: [
      'Create a 10-slide presentation about the future of artificial intelligence',
      'Design a pitch deck for a sustainable energy startup',
      'Make a training presentation for new employees about company culture',
      'Create slides explaining machine learning concepts to beginners',
      'Design a quarterly business review presentation with charts and graphs',
    ],
  },
  {
    id: 'data',
    label: 'Data',
    icon: <BarChart3 className="w-4 h-4" />,
    samplePrompts: [
      'Analyze sales data and create insights for Q3 performance',
      'Generate a comprehensive report from customer survey responses',
      'Create data visualizations for quarterly financial results',
      'Analyze website traffic patterns and user behavior',
      'Process and visualize social media engagement metrics',
    ],
    chartTypes: {
      title: 'Chart Types',
      items: [
        { id: 'bar', name: 'Bar Chart', description: 'Compare categories' },
        { id: 'line', name: 'Line Chart', description: 'Show trends over time' },
        { id: 'pie', name: 'Pie Chart', description: 'Show proportions' },
        { id: 'scatter', name: 'Scatter Plot', description: 'Show correlations' },
        { id: 'heatmap', name: 'Heatmap', description: 'Show patterns' },
        { id: 'dashboard', name: 'Dashboard', description: 'Multiple visualizations' },
      ],
    },
  },
  {
    id: 'docs',
    label: 'Documents',
    icon: <FileText className="w-4 h-4" />,
    samplePrompts: [
      'Write a comprehensive business proposal for a new product launch',
      'Create a technical specification document for a mobile app',
      'Draft a marketing email campaign for customer retention',
      'Write a project status report for stakeholders',
      'Create a user manual for a software application',
    ],
  },
  {
    id: 'research',
    label: 'Research',
    icon: <Search className="w-4 h-4" />,
    samplePrompts: [
      'Research the latest developments in quantum computing',
      'Find information about sustainable energy trends in 2024',
      'Analyze competitor strategies in the fintech industry',
      'Research best practices for remote team management',
      'Investigate emerging technologies in healthcare',
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: <Users className="w-4 h-4" />,
    samplePrompts: [
      'Help me prepare for a job interview at a tech company',
      'Create a team building activity for remote employees',
      'Analyze customer feedback to identify improvement areas',
      'Design an employee onboarding program',
      'Create a performance review template for managers',
    ],
  },
];

const getRandomPrompts = (prompts: string[], count: number): string[] => {
  const shuffled = [...prompts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export function SunaModesPanel({ 
  selectedMode, 
  onModeSelect, 
  onSelectPrompt, 
  isMobile = false,
  selectedCharts: controlledSelectedCharts,
  onChartsChange,
  selectedOutputFormat: controlledSelectedOutputFormat,
  onOutputFormatChange
}: SunaModesPanelProps) {
  const currentMode = selectedMode ? modes.find((m) => m.id === selectedMode) : null;
  const promptCount = isMobile ? 2 : 4;
  
  // State to track current random selection of prompts
  const [randomizedPrompts, setRandomizedPrompts] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State for multi-select charts (use controlled state if provided)
  const [uncontrolledSelectedCharts, setUncontrolledSelectedCharts] = useState<string[]>([]);
  const selectedCharts = controlledSelectedCharts ?? uncontrolledSelectedCharts;
  const setSelectedCharts = onChartsChange ?? setUncontrolledSelectedCharts;
  
  // State for selected output format (use controlled state if provided)
  const [uncontrolledSelectedOutputFormat, setUncontrolledSelectedOutputFormat] = useState<string | null>(null);
  const selectedOutputFormat = controlledSelectedOutputFormat ?? uncontrolledSelectedOutputFormat;
  const setSelectedOutputFormat = onOutputFormatChange ?? setUncontrolledSelectedOutputFormat;

  // Randomize prompts when mode changes or on mount
  useEffect(() => {
    if (currentMode) {
      setRandomizedPrompts(getRandomPrompts(currentMode.samplePrompts, promptCount));
    }
  }, [selectedMode, currentMode, promptCount]);
  
  // Reset selections when mode changes
  useEffect(() => {
    setSelectedCharts([]);
    setSelectedOutputFormat(null);
  }, [selectedMode, setSelectedCharts, setSelectedOutputFormat]);

  // Handler for refresh button
  const handleRefreshPrompts = () => {
    if (currentMode) {
      setIsRefreshing(true);
      setRandomizedPrompts(getRandomPrompts(currentMode.samplePrompts, promptCount));
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };
  
  // Handler for chart selection toggle
  const handleChartToggle = (chartId: string) => {
    const newCharts = selectedCharts.includes(chartId) 
      ? selectedCharts.filter(id => id !== chartId)
      : [...selectedCharts, chartId];
    setSelectedCharts(newCharts);
  };
  
  // Handler for output format selection
  const handleOutputFormatSelect = (formatId: string) => {
    const newFormat = selectedOutputFormat === formatId ? null : formatId;
    setSelectedOutputFormat(newFormat);
  };
  
  // Handler for prompt selection - just pass through without modification
  const handlePromptSelect = (prompt: string) => {
    onSelectPrompt(prompt);
  };

  const displayedPrompts = randomizedPrompts;

  return (
    <div className="w-full space-y-4">
      {/* Mode Tabs - Only show when no mode is selected */}
      {!selectedMode && (
        <div className="flex items-center justify-center animate-in fade-in-0 zoom-in-95 duration-300">
          <div className="inline-flex gap-2">
            {modes.map((mode) => (
              <Button
                key={mode.id}
                variant="outline"
                size="sm"
                onClick={() => onModeSelect(mode.id)}
                className="flex items-center gap-2 shrink-0 transition-all duration-200 bg-background hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground border-border cursor-pointer"
              >
                {mode.icon}
                <span>{mode.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Sample Prompts - Google List Style */}
      {selectedMode && displayedPrompts && (
        <div className="w-full max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-foreground">
              {currentMode?.label} Examples
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshPrompts}
              disabled={isRefreshing}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
          
          <div className="space-y-2">
            {displayedPrompts.map((prompt, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full h-auto p-3 text-left justify-start text-sm hover:bg-accent/50 border border-transparent hover:border-border/50 rounded-lg transition-all duration-200"
                onClick={() => handlePromptSelect(prompt)}
              >
                <div className="flex items-start gap-3 w-full">
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-left leading-relaxed">{prompt}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Mode-specific Options */}
      {selectedMode === 'image' && currentMode?.options && (
        <Card className="p-6">
          <h4 className="text-sm font-medium mb-3">{currentMode.options.title}</h4>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {currentMode.options.items.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                size="sm"
                className="h-auto p-3 flex flex-col items-center gap-2 text-xs"
                onClick={() => onSelectPrompt(`Create an image in ${option.name.toLowerCase()} style`)}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
                  {option.name.charAt(0)}
                </div>
                <span>{option.name}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Chart Types for Data Mode */}
      {selectedMode === 'data' && currentMode?.chartTypes && (
        <Card className="p-6">
          <h4 className="text-sm font-medium mb-3">{currentMode.chartTypes.title}</h4>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {currentMode.chartTypes.items.map((chart) => (
              <Button
                key={chart.id}
                variant={selectedCharts.includes(chart.id) ? "default" : "outline"}
                size="sm"
                className="h-auto p-3 flex flex-col items-center gap-2 text-xs"
                onClick={() => handleChartToggle(chart.id)}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
                  {selectedCharts.includes(chart.id) ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    chart.name.charAt(0)
                  )}
                </div>
                <span>{chart.name}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
