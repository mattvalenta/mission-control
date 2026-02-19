import { Metadata } from 'next';
import MemoryBrowser from '@/components/memory/MemoryBrowser';

export const metadata: Metadata = {
  title: 'Memory Browser | Mission Control',
  description: 'Navigate and search agent memory files',
};

export default function MemoryPage() {
  return (
    <div className="h-full">
      <MemoryBrowser />
    </div>
  );
}
