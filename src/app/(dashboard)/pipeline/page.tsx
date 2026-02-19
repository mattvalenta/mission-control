import { Metadata } from 'next';
import PipelineBoard from '@/components/pipeline/PipelineBoard';

export const metadata: Metadata = {
  title: 'Content Pipeline | Mission Control',
  description: 'Content creation workflow from idea to publish',
};

export default function PipelinePage() {
  return (
    <div className="h-full">
      <PipelineBoard />
    </div>
  );
}
