export type KbArticleStatus = 'draft' | 'published';

export interface KbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface KbRelatedLink {
  label: string;
  href: string;
}

export interface KbArticle {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  status: KbArticleStatus;
  tags: string[];
  related_links: KbRelatedLink[];
  created_by: string | null;
  updated_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // joined
  category?: Pick<KbCategory, 'id' | 'name' | 'slug'> | null;
  author?: { id: string; name: string | null; email: string | null } | null;
  editor?: { id: string; name: string | null; email: string | null } | null;
  checklist_count?: number;
}

export interface KbArticleVersion {
  id: string;
  article_id: string;
  title: string;
  body: string;
  summary: string | null;
  edited_by: string | null;
  created_at: string;
  editor?: { id: string; name: string | null; email: string | null } | null;
}

export interface KbChecklistItem {
  id: string;
  article_id: string;
  position: number;
  text: string;
  guidance: string | null;
}

export interface KbChecklistRunItem {
  id: string;
  run_id: string;
  item_id: string | null;
  position: number;
  text: string;
  done: boolean;
  note: string | null;
  completed_by: string | null;
  completed_at: string | null;
}

export interface KbChecklistRun {
  id: string;
  article_id: string;
  user_id: string;
  label: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  items?: KbChecklistRunItem[];
  owner?: { id: string; name: string | null; email: string | null } | null;
}
