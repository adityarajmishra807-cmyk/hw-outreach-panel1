import type { HorizonOSMode } from './horizon-os';

export type HorizonCommand = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  mode?: HorizonOSMode;
};

export const HORIZON_COMMANDS: HorizonCommand[] = [
  { id: 'daily', label: 'Open Daily AI', description: 'Review priorities, follow-ups, risks, and opportunities.', shortcut: '1', mode: 'daily' },
  { id: 'command', label: 'Open Command Center', description: 'Ask Horizon to reason, organize, and act.', shortcut: '2', mode: 'command' },
  { id: 'outreach', label: 'Open Outreach', description: 'Work with the existing outreach records and workflow.', shortcut: '3', mode: 'outreach' },
];

export function findHorizonCommand(id: string) {
  return HORIZON_COMMANDS.find((command) => command.id === id);
}
