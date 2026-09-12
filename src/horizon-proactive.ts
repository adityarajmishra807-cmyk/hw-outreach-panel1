import { getOrganizedRecords, type HorizonRecord } from './horizon-organization';
import { getMemories } from './horizon-memory';

type ProspectLike = {
  name: string;
  status: string;
  score: number | null;
  reply: string;
  time: string;
};

export type HorizonInsight = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
};

function prospectPriority(prospect: ProspectLike) {
  if (prospect.status === 'Interested') return 3;
  if (prospect.status === 'Replied') return 2;
  if ((prospect.score ?? 0) >= 80) return 2;
  return 1;
}

export function getProactiveInsights(prospects: ProspectLike[], now = new Date()): HorizonInsight[] {
  const records = getOrganizedRecords();
  const memories = getMemories();
  const insights: HorizonInsight[] = [];

  const hotProspect = [...prospects].sort((a, b) => prospectPriority(b) - prospectPriority(a))[0];
  if (hotProspect && ['Interested', 'Replied'].includes(hotProspect.status)) {
    insights.push({
      id: `prospect-${hotProspect.name}`,
      priority: 'high',
      title: `Follow up with ${hotProspect.name}`,
      detail: `${hotProspect.status} lead with ${hotProspect.score ?? 'unscored'} pipeline score.`,
      action: 'Review the conversation and send the next relevant follow-up.',
    });
  }

  const overdueTasks = records.filter((record) => {
    if (record.type !== 'task' || record.status === 'completed') return false;
    const due = record.data?.due;
    if (typeof due !== 'string' || !due) return false;
    const date = new Date(due);
    return Number.isFinite(date.getTime()) && date.getTime() < now.getTime();
  });
  if (overdueTasks.length) {
    insights.push({
      id: 'overdue-tasks',
      priority: 'high',
      title: `${overdueTasks.length} task${overdueTasks.length === 1 ? '' : 's'} need attention`,
      detail: overdueTasks.slice(0, 2).map((task) => task.title).join(' · '),
      action: 'Clear, reschedule, or delegate the overdue work.',
    });
  }

  const activeProjects = records.filter((record) => record.type === 'project' && record.status === 'active');
  if (activeProjects.length > 0 && memories.length > 0) {
    insights.push({
      id: 'context-check',
      priority: 'medium',
      title: 'Use stored context before planning',
      detail: `${activeProjects.length} active project${activeProjects.length === 1 ? '' : 's'} and ${memories.length} durable memor${memories.length === 1 ? 'y' : 'ies'} are available.`,
      action: 'Ask Horizon to plan the next step using the existing project context.',
    });
  }

  const untouchedReplies = prospects.filter((prospect) => prospect.status === 'Replied' && prospect.reply?.trim()).length;
  if (untouchedReplies > 2) {
    insights.push({
      id: 'reply-queue',
      priority: 'medium',
      title: 'Reply queue is building',
      detail: `${untouchedReplies} replied prospects currently have conversation text available.`,
      action: 'Work the highest-intent replies before starting new outreach.',
    });
  }

  return insights.slice(0, 4);
}
