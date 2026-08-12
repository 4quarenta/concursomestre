import type { ReactNode } from 'react';
import LandingCommercialFooter from '../landing/components/LandingCommercialFooter';

type BlogLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <>
      {children}
      <div className="bg-white text-[#07103a]">
        <LandingCommercialFooter />
      </div>
    </>
  );
}
