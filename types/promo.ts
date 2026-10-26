export type PromoVideo = {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  title: string;
  active: boolean;
};

export type PromoVideoInput = Omit<PromoVideo, "id">;
