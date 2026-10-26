import { AwardsSection } from "@/features/landing/components/AwardsSection";
import { AudienceVoteSection } from "@/features/landing/components/AudienceVoteSection";
import { Countdown } from "@/features/landing/components/Countdown";
import { EventInfo } from "@/features/landing/components/EventInfo";
import { FinalistSection } from "@/features/landing/components/FinalistSection";
import { Footer } from "@/features/landing/components/Footer";
import { Header } from "@/features/landing/components/Header";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { PartnersSection } from "@/features/landing/components/PartnersSection";
import { ProgramSection } from "@/features/landing/components/ProgramSection";
import { ProjectTeamSection } from "@/features/landing/components/ProjectTeamSection";
import { QuickActions } from "@/features/landing/components/QuickActions";
import { ScrollToTop } from "@/features/landing/components/ScrollToTop";
import { ShareSection } from "@/features/landing/components/ShareSection";
import { PromoVideoSection } from "@/features/landing/components/PromoVideoSection";
import { getPromoVideoRepository } from "@/lib/repositories/repositoryFactory";

export default async function Home() {
  const promoVideo = await getPromoVideoRepository().get().catch(() => null);
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <Countdown />
        <QuickActions />
        <EventInfo />
        <ProgramSection />
        <FinalistSection />
        <AudienceVoteSection />
        <PromoVideoSection video={promoVideo} />
        <AwardsSection />
        <PartnersSection />
        <ProjectTeamSection />
        <ShareSection />
      </main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
