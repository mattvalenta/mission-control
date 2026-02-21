import { Metadata } from 'next';
import SocialMediaPage from '@/components/social/SocialMediaPage';

export const metadata: Metadata = {
  title: 'Social Media | Mission Control',
  description: 'Manage and approve social media content',
};

export default function SocialPage() {
  return (
    <div className="h-full">
      <SocialMediaPage />
    </div>
  );
}
