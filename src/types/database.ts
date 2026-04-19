export interface User {
  id: string;
  full_name: string;
  email: string;
  year_of_study: number | null;
  avatar_url: string | null;
  interests: string[];
  invite_token: string | null;
  role: 'student' | 'admin' | 'moderator';
  user_type: 'student' | 'family_member';
  created_at: string;
  // Phase 1: Enhanced profile fields
  marital_status: 'single' | 'in_relationship' | 'married';
  partner_user_id: string | null;
  has_children: boolean;
  children_ages: number[];
  settlement: string | null;
  languages: string[];
  academic_track: string | null;
  bio: string | null;
  phone: string | null;
  graduation_year: number | null;
  origin_city: string | null;
  profile_completeness: number;
  onboarding_completed_at: string | null;
  // Joined relations
  partner?: User;
}

export interface UserChild {
  id: string;
  user_id: string;
  name: string | null;
  gender: 'male' | 'female' | null;
  age: number;
  created_at: string;
}

export interface BridgeTag {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface BridgeImage {
  id: string;
  bridge_id: string;
  image_uri: string;
  display_order: number;
  created_at: string;
}

export interface BridgeFile {
  id: string;
  bridge_id: string;
  file_name: string;
  file_uri: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  uploader?: User;
}

export interface BridgeTip {
  id: string;
  bridge_id: string;
  user_id: string;
  content: string;
  likes_count: number;
  created_at: string;
  user?: User;
  liked_by_me?: boolean;
}

export interface BridgeTipLike {
  user_id: string;
  tip_id: string;
}

export interface BridgeAddition {
  id: string;
  bridge_id: string;
  suggested_by: string;
  content: string;
  link: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  created_at: string;
  suggestor?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'addition_pending' | 'addition_approved' | 'addition_rejected' | 'partner_request' | 'partner_accepted';
  reference_id: string;
  bridge_id: string;
  read: boolean;
  created_at: string;
  bridge?: Bridge;
  addition?: BridgeAddition;
}

export interface Bridge {
  id: string;
  name: string;
  description: string;
  parent_id: string | null;
  created_by: string;
  rating_avg: number;
  status: 'active' | 'archived' | 'pending';
  created_at: string;
  updated_at?: string;
  children?: Bridge[];
  creator?: User;
  tags?: BridgeTag[];
  images?: BridgeImage[];
  parent?: Bridge;
}

export interface Discussion {
  id: string;
  title: string;
  bridge_id: string;
  event_id?: string | null;
  tag: string;
  created_by: string;
  participants_count: number;
  last_message_at: string;
  bridge?: Bridge;
  event?: Event;
  creator?: User;
}

export interface Message {
  id: string;
  discussion_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  bridge_id: string | null;
  date: string;
  location?: string;
  category?: string;
  link?: string;
  image_url?: string | null;
  created_by: string;
  created_at?: string;
  bridge?: Bridge;
  creator?: User;
}

export interface EventRsvp {
  user_id: string;
  event_id: string;
  status: 'going' | 'maybe' | 'not_going';
  created_at: string;
  user?: User;
}

export interface Apartment {
  id: string;
  address: string;
  price: number;
  rooms: number;
  available_from: string;
  landlord_rating: number;
  description: string;
  contact_user_id: string;
  contact_user?: User;
}

export interface Ride {
  id: string;
  from_location: string;
  to_location: string;
  date_time: string;
  seats: number;
  price: number;
  driver_id: string;
  driver?: User;
}

export interface Price {
  id: string;
  item_name: string;
  category: string;
  price: number;
  reported_by: string;
  reported_at: string;
  reliability_score: number;
  reporter?: User;
}

export interface DirectMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  read: boolean;
  created_at: string;
  from_user?: User;
  to_user?: User;
}

export interface UserTag {
  user_id: string;
  discussion_id: string;
  tag: string;
  joined_at: string;
}

export interface BridgeRating {
  user_id: string;
  bridge_id: string;
  rating: number;
}

export interface CommunityQuestion {
  id: string;
  question: string;
  asked_by: string;
  status: 'open' | 'answered' | 'closed';
  created_at: string;
  asker?: User;
}

export interface MeditMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  session_id?: string;
}

export interface SecondhandListing {
  id: string;
  title: string;
  description: string;
  category: 'product' | 'service' | 'other';
  price: number | null;
  images: string[];
  contact_info: string;
  created_by: string;
  status: 'active' | 'sold' | 'closed';
  created_at: string;
  creator?: User;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  relationship_type: 'friend' | 'partner' | 'family' | 'study_buddy';
  created_at: string;
  requester?: User;
  addressee?: User;
}

// ============================================
// Phase 1: User Context Engine types
// ============================================

export interface UserTagSubscription {
  user_id: string;
  tag_id: string;
  subscribed_at: string;
  tag?: BridgeTag;
}

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: 'view' | 'create' | 'react' | 'search' | 'bookmark' | 'share';
  target_type: 'bridge' | 'discussion' | 'event' | 'ride' | 'secondhand' | 'apartment' | 'price' | 'community' | 'chat';
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserSearchHistory {
  id: string;
  user_id: string;
  query: string;
  result_count: number;
  context: 'bridges' | 'discussions' | 'secondhand' | 'chat' | 'events' | 'rides' | 'apartments' | 'prices' | 'global';
  created_at: string;
}

export interface UserCircle {
  id: string;
  name: string;
  circle_type: 'year_group' | 'settlement' | 'interest' | 'custom';
  auto_generated: boolean;
  created_by: string | null;
  created_at: string;
  members?: UserCircleMember[];
  member_count?: number;
}

export interface UserCircleMember {
  circle_id: string;
  user_id: string;
  joined_at: string;
  user?: User;
}

export interface NotificationPreference {
  user_id: string;
  notification_type: 'new_bridge' | 'new_event' | 'discussion_update' | 'form_reminder' | 'chat_suggestion' | 'friend_request' | 'content_reaction' | 'system';
  enabled: boolean;
  channel: 'in_app' | 'push' | 'email';
}

export interface PendingAction {
  id: string;
  user_id: string;
  action_type: 'form' | 'survey' | 'profile_update' | 'rsvp' | 'document';
  title: string;
  description: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
  status: 'pending' | 'completed' | 'dismissed' | 'expired';
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ChatInteraction {
  id: string;
  user_id: string;
  question: string;
  topic_tags: string[];
  response_summary: string | null;
  response_helpful: boolean | null;
  session_id: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  started_at: string;
  last_message_at: string;
}
