import type { TaskDetailDto } from '@hearth/contracts';

export interface AiSummarySlotProps {
  task: TaskDetailDto;
}

/**
 * Placeholder for the AI summary card (TaskPanel.dc.html "AI summary"). The AI stream replaces
 * this component's body; the task detail view already renders it below the properties.
 */
export function AiSummarySlot(_props: AiSummarySlotProps) {
  return null;
}
