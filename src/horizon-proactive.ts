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
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
  source?: 'prospect' | 'task' | 'project' | 'memory' | 'system';
};

function prospectPriority(prospect: ProspectLike) {
  if (prospect.status === 'Interested') return 4;
  if (prospect.status === 'Replied') return 3;
  if ((prospect.score ?? 0) >= 80) return 2;
  return 1;
}

function recordText(record: HorizonRecord) {
  return `${record.title} ${JSON.stringify(record.data || {})}`.toLowerCase();
}

function dueDate(record: HorizonRecord) {
  const raw = record.data?.due ?? record.data?.deadline;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysUntil(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

export function getProactiveInsights(prospects: ProspectLike[], now = new Date()): HorizonInsight[] {
  const records = getOrganizedRecords();
  const memories = getMemories();
  const insights: HorizonInsight[] = [];

  const hotProspect = [...prospects].sort((a, b) => prospectPriority(b) - prospectPriority(a))[0];
  if (hotProspect && ['Interested', 'Replied'].includes(hotProspect.status)) {
    insights.push({
      id: `prospect-${hotProspect.name}`,
      priority: hotProspect.status === 'Interested' ? 'critical' : 'high',
      title: `Follow up with ${hotProspect.name}`,
      detail: `${hotProspect.status} lead${hotProspect.score != null ? ` · score ${hotProspect.score}` : ''}.`,
      action: 'Review the conversation and send the next relevant follow-up.',
      source: 'prospect',
    });
  }

  const tasks = records.filter((record) => record.type === 'task' && record.status !== 'completed');
  const overdueTasks = tasks.filter((task) => {
    const due = dueDate(task);
    return due ? due.getTime() < now.getTime() : false;
  });
  if (overdueTasks.length) {
    insights.push({
      id: 'overdue-tasks',
      priority: 'critical',
      title: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`,
      detail: overdueTasks.slice(0, 3).map((task) => task.title).join(' · '),
      action: 'Clear, reschedule, or delegate the overdue work.',
      source: 'task',
    });
  }

  const approachingTasks = tasks
    .map((task) => ({ task, due: dueDate(task) }))
    .filter((item): item is { task: HorizonRecord; due: Date } => !!item.due)
    .map((item) => ({ ...item, days: daysUntil(item.due, now) }))
    .filter((item) => item.days >= 0 && item.days <= 2)
    .sort((a, b) => a.days - b.days);

  if (approachingTasks.length) {
    const first = approachingTasks[0];
    insights.push({
      id: 'approaching-deadlines',
      priority: first.days === 0 ? 'critical' : 'high',
      title: first.days === 0 ? 'Deadline is today' : `${approachingTasks.length} task${approachingTasks.length === 1 ? '' : 's'} due soon`,
      detail: approachingTasks.slice(0, 3).map(({ task, days }) => `${task.title} · ${days === 0 ? 'today' : `in ${days}d`}`).join(' · '),
      action: 'Prioritize this work before starting lower-value tasks.',
      source: 'task',
    });
  }

  const activeProjects = records.filter((record) => record.type === 'project' && record.status === 'active');
  const staleProjects = activeProjects.filter((project) => now.getTime() - new Date(project.updatedAt).getTime() > 3 * 86_400_000);
  if (staleProjects.length) {
    insights.push({
      id: 'stale-projects',
      priority: 'high',
      title: `${staleProjects.length} project${staleProjects.length === 1 ? '' : 's'} going stale`,
      detail: staleProjects.slice(0, 2).map((project) => project.title).join(' · '),
      action: 'Review the project state and define the next concrete step.',
      source: 'project',
    });
  }

  const projectsWithDates = activeProjects
    .map((project) => ({ project, due: dueDate(project) }))
    .filter((item): item is { project: HorizonRecord; due: Date } => !!item.due);
  const conflictingProjects = projectsWithDates.filter((item, index, all) => all.some((other, otherIndex) => otherIndex > index && other.due.getTime() === item.due.getTime() && other.project.title !== item.project.title));
  if (conflictingProjects.length) {
    insights.push({
      id: 'deadline-clusters',
      priority: 'medium',
      title: 'Multiple projects share a deadline',
      detail: conflictingProjects.slice(0, 3).map(({ project }) => project.title).join(' · '),
      action: 'Check whether the shared deadline creates a scheduling conflict.',
      source: 'project',
    });
  }

  const replyQueue = prospects.filter((prospect) => prospect.status === 'Replied' && prospect.reply?.trim());
  if (replyQueue.length > 2) {
    insights.push({
      id: 'reply-queue',
      priority: 'high',
      title: 'Reply queue is building',
      detail: `${replyQueue.length} replied prospects currently have conversation text available.`,
      action: 'Work the highest-intent replies before starting new outreach.',
      source: 'prospect',
    });
  }

  const importantMemoryCount = memories.filter((memory) => memory.importance >= 0.9 && !memory.archived).length;
  if (importantMemoryCount > 0 && activeProjects.length > 0) {
    insights.push({
      id: 'important-context',
      priority: 'medium',
      title: 'Important stored context is available',
      detail: `${importantMemoryCount} high-importance memor${importantMemoryCount === 1 ? 'y' : 'ies'} can influence active project decisions.`,
      action: 'Ask Horizon to plan with the stored decisions and preferences.',
      source: 'memory',
    });
  }

  const duplicateSignals = new Set<string>();
  return insights
    .filter((insight) => {
      if (duplicateSignals.has(insight.id)) return false;
      duplicateSignals.add(insight.id);
      return true;
    })
    .sort((a, b) => {
      const priority = { critical: 4, high: 3, medium: 2, low: 1 } as const;
      return priority[b.priority] - priority[a.priority];
    })
    .slice(0, 6);
}
