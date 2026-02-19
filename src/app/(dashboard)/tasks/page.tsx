import { Metadata } from 'next';
import TasksBoard from '@/components/tasks/TasksBoard';

export const metadata: Metadata = {
  title: 'Tasks Board | Mission Control',
  description: 'Multi-tier task visibility across the agent hierarchy',
};

export default function TasksPage() {
  return (
    <div className="h-full">
      <TasksBoard />
    </div>
  );
}
