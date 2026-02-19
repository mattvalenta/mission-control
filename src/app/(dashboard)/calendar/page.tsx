import { Metadata } from 'next';
import CalendarView from '@/components/calendar/CalendarView';

export const metadata: Metadata = {
  title: 'Calendar | Mission Control',
  description: 'Agent schedules and cron job visualization',
};

export default function CalendarPage() {
  return (
    <div className="h-full">
      <CalendarView />
    </div>
  );
}
