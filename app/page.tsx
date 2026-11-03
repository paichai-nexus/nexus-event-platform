import { AwardsSection } from "@/features/landing/components/AwardsSection";
import { AudienceVoteSection } from "@/features/landing/components/AudienceVoteSection";
import { Countdown } from "@/features/landing/components/Countdown";
import { DeanGreetingSection } from "@/features/landing/components/DeanGreetingSection";
import { FinalistSection } from "@/features/landing/components/FinalistSection";
import { Footer } from "@/features/landing/components/Footer";
import { Header } from "@/features/landing/components/Header";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { ProgramSection } from "@/features/landing/components/ProgramSection";
import { QuickActions } from "@/features/landing/components/QuickActions";
import { ScrollToTop } from "@/features/landing/components/ScrollToTop";
import { PromoVideoSection } from "@/features/landing/components/PromoVideoSection";
import { PartOneAttendanceSection } from "@/features/landing/components/PartOneAttendanceSection";
import { getPromoVideoRepository } from "@/lib/repositories/repositoryFactory";

const DEFAULT_PROMO_VIDEO = {
  id: "academic-festival-promo-2026",
  videoUrl: "/media/academic-festival-promo.mp4",
  thumbnailUrl: "/media/academic-festival-promo-poster.jpg",
  title: "제24회 경영대학 학술제 홍보 영상",
  active: true,
} as const;

export default async function Home() {
  const savedPromoVideo = await getPromoVideoRepository().get().catch(() => null);
  const promoVideo = savedPromoVideo?.active ? savedPromoVideo : DEFAULT_PROMO_VIDEO;
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <Countdown />
        <QuickActions />
        <PromoVideoSection video={promoVideo} />
        <ProgramSection />
        <FinalistSection />
        <AudienceVoteSection />
        <AwardsSection />
        <PartOneAttendanceSection />
        <DeanGreetingSection />
      </main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
