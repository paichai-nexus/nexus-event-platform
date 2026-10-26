import { SectionHeading } from "@/features/landing/components/SectionHeading";
import type { PromoVideo } from "@/types/promo";

export function PromoVideoSection({ video }: { video: PromoVideo | null }) {
  if (!video?.active) return null;
  return <section className="section promo-video-section" id="promo-video"><div className="shell"><SectionHeading label="REELS" title="학술제 미리보기" light /><div className="promo-video-frame"><video controls playsInline preload="metadata" poster={video.thumbnailUrl ?? undefined} aria-label={video.title}><source src={video.videoUrl} />영상 재생을 지원하지 않는 브라우저입니다.</video><div><small>SHORT FORM CONTENT</small><strong>{video.title}</strong><p>세로형 모바일 홍보 영상</p></div></div></div></section>;
}
