import { Metadata } from 'next';
import TeamOrgChart from '@/components/team/TeamOrgChart';

export const metadata: Metadata = {
  title: 'Team | Mission Control',
  description: 'Agent hierarchy and team structure',
};

export default function TeamPage() {
  return (
    <div className="h-full">
      <TeamOrgChart />
    </div>
  );
}
