import { SectionHeading } from "@/features/landing/components/SectionHeading";
import type { PromoVideo } from "@/types/promo";

export function PromoVideoSection({ video }: { video: PromoVideo | null }) {
  if (!video?.active) return null;
  return <section className="section promo-video-section" id="promo-video"><div className="shell"><SectionHeading label="PROMO VIDEO" title="행사 시작 전 홍보 영상" light /><div className="promo-video-frame"><video autoPlay muted loop controls playsInline preload="metadata" poster={video.thumbnailUrl ?? undefined} aria-label={video.title}><source src={video.videoUrl} type="video/mp4" />영상 재생을 지원하지 않는 브라우저입니다.</video><div><small>ACADEMIC FESTIVAL 2026</small><strong>{video.title}</strong><p>자동재생은 음소거 상태입니다. 현장 스크린에서는 재생 컨트롤에서 소리를 켜주세요.</p></div></div></div></section>;
}
