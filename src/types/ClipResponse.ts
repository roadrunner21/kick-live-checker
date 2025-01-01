export interface ClipCategory {
  id: number;
  name: string;
  slug: string;
  parent_category: string;
}

export interface ClipCreator {
  id: number;
  username: string;
  slug: string;
}

export interface ClipChannel {
  id: number;
  username: string;
  slug: string;
  profile_picture: string;
}

export interface Clip {
  id: string;
  livestream_id: string;
  category_id: string;
  channel_id: number;
  user_id: number;
  title: string;
  clip_url: string;
  thumbnail_url: string;
  privacy: string;
  likes: number;
  liked: boolean;
  views: number;
  duration: number;
  started_at: string;
  created_at: string;
  is_mature: boolean;
  video_url: string;
  view_count: number;
  likes_count: number;
  category: ClipCategory;
  creator: ClipCreator;
  channel: ClipChannel;
}

export interface GetClipsResponse {
  clips: Clip[];
  nextCursor: string | null;
}
