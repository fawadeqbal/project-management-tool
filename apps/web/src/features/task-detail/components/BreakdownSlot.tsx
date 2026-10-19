import { Button } from '@hearth/ui';
import type { TaskDetailDto } from '@hearth/contracts';
import { useToast } from '@/shared/toast';

export interface BreakdownSlotProps {
  task: TaskDetailDto;
  /** Adds a subtask (the AI stream calls this for each accepted suggestion). */
  onAddSubtask: (title: string) => void;
}

/**
 * The "Break down" button next to Subtasks. The AI stream replaces this component's body with
 * suggestion review; until then it explains that the feature is coming.
 */
export function BreakdownSlot(_props: BreakdownSlotProps) {
  const { show } = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      icon="sparkles"
      onClick={() => show({ message: 'Break down with AI is coming soon. Add subtasks by hand for now.', tone: 'info', icon: 'sparkles' })}
    >
      Break down
    </Button>
  );
}
