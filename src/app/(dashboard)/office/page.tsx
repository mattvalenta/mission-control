import { Metadata } from 'next';
import OfficeView from '@/components/office/OfficeView';

export const metadata: Metadata = {
  title: 'Office View | Mission Control',
  description: 'Visual representation of agents working',
};

export default function OfficePage() {
  return (
    <div className="h-full">
      <OfficeView />
    </div>
  );
}
