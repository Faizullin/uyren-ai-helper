'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { IUseDialogControl } from '@/hooks/use-dialog-control';

interface PublishDialogData {
  templateId: string;
  templateName: string;
}

interface PublishDialogProps {
  control: IUseDialogControl<PublishDialogData>;
  templatesActioningId: string | null;
  onPublish: (usageExamples: any[]) => void;
}

export function PublishDialog({
  control,
  templatesActioningId,
  onPublish,
}: PublishDialogProps) {
  const [usageExamples, setUsageExamples] = useState<{ prompt: string; response: string }[]>([
    { prompt: '', response: '' }
  ]);

  const publishDialog = control.data;

  const handleAddExample = () => {
    setUsageExamples([...usageExamples, { prompt: '', response: '' }]);
  };

  const handleRemoveExample = (index: number) => {
    setUsageExamples(usageExamples.filter((_, i) => i !== index));
  };

  const handleExampleChange = (index: number, field: 'prompt' | 'response', value: string) => {
    const updated = [...usageExamples];
    updated[index][field] = value;
    setUsageExamples(updated);
  };

  const handlePublish = () => {
    const validExamples = usageExamples.filter(ex => ex.prompt.trim() && ex.response.trim());
    onPublish(validExamples);
  };

  const handleClose = () => {
    setUsageExamples([{ prompt: '', response: '' }]);
    control.hide();
  };

  if (!publishDialog) return null;

  return (
    <Dialog open={control.isVisible} onOpenChange={control.toggle}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish to Marketplace</DialogTitle>
          <DialogDescription>
            Publish "{publishDialog.templateName}" to the marketplace with usage examples
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label className="text-sm font-medium mb-3 block">Usage Examples</Label>
            <p className="text-xs text-muted-foreground mb-4">
              Add example prompts and responses to help users understand how to use your agent.
              At least one example is required.
            </p>

            <div className="space-y-4">
              {usageExamples.map((example, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Example {index + 1}</span>
                    {usageExamples.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExample(index)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`prompt-${index}`} className="text-xs">User Prompt</Label>
                    <Textarea
                      id={`prompt-${index}`}
                      value={example.prompt}
                      onChange={(e) => handleExampleChange(index, 'prompt', e.target.value)}
                      placeholder="Example user prompt..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`response-${index}`} className="text-xs">Expected Response</Label>
                    <Textarea
                      id={`response-${index}`}
                      value={example.response}
                      onChange={(e) => handleExampleChange(index, 'response', e.target.value)}
                      placeholder="Expected agent response..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddExample}
              className="mt-3 w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Example
            </Button>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Publishing Guidelines</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Ensure your examples demonstrate the agent's capabilities</li>
              <li>• Use clear, realistic prompts that users might actually ask</li>
              <li>• Provide helpful, accurate responses</li>
              <li>• Avoid examples that could be harmful or inappropriate</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={control.hide}
            className="w-full sm:w-auto"
            disabled={templatesActioningId === publishDialog.templateId}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={
              templatesActioningId === publishDialog.templateId ||
              usageExamples.every(ex => !ex.prompt.trim() || !ex.response.trim())
            }
            className="w-full sm:w-auto"
          >
            {templatesActioningId === publishDialog.templateId ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Publishing...
              </div>
            ) : (
              'Publish to Marketplace'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
