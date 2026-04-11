export type ReadingSupportProgressByGame = {
  game_key: string;
  title: string;
  play_count: number;
  average_accuracy: number;
  best_accuracy: number;
};

export type ReadingSupportReward = {
  code: string;
  title: string;
  unlocked_at: string | null;
};

export type ReadingSupportTrendPoint = {
  session_id: string;
  game_key: string;
  title: string;
  accuracy: number;
  points_awarded: number;
  xp_awarded: number;
  duration_seconds: number;
  completed_at: string;
};

export type ReadingSupportProgress = {
  completed_sessions: number;
  average_accuracy: number;
  best_accuracy: number;
  total_points_earned: number;
  total_xp_earned: number;
  current_level: number;
  next_level_xp: number;
  average_session_seconds: number;
  total_play_time_seconds: number;
  unlocked_rewards: ReadingSupportReward[];
  last_played_at: string | null;
  performance_trend: ReadingSupportTrendPoint[];
  by_game: ReadingSupportProgressByGame[];
};

export type ReadingSupportProfile = {
  id: string;
  student_user_id: string;
  student_label?: string | null;
  declared_by_user_id: string;
  declared_by_role: string;
  notes: string;
  focus_letters: string[];
  focus_words: string[];
  focus_numbers: string[];
  is_active: boolean;
  activated_at: string;
  updated_at: string;
};

export type ReadingSupportMe = {
  student_user_id: string;
  student_label: string;
  is_support_active: boolean;
  support_profile: ReadingSupportProfile | null;
  progress: ReadingSupportProgress;
};

export type ReadingSupportStudentOverview = {
  student_user_id: string;
  student_label: string;
  support_profile: ReadingSupportProfile | null;
  progress: ReadingSupportProgress;
};

export type ReadingSupportStudentCreateResult = {
  student_user_id: string;
  student_label: string;
  email: string;
  linked_parent_user_id: string;
};

export type ReadingLabGame = {
  key: string;
  title: string;
  description: string;
  supports_audio: boolean;
  interaction: string;
  reward_points: number;
  reward_xp: number;
};

export type ReadingLabRound = {
  index: number;
  prompt: string;
  display_text?: string | null;
  instruction?: string | null;
  items: string[];
  interaction: "single_choice" | "ordered_tiles";
  audio_text?: string | null;
};

export type ReadingLabSessionStart = {
  session_id: string;
  game: ReadingLabGame;
  content_source: "ai" | "fallback";
  focus_letters: string[];
  focus_words: string[];
  focus_numbers: string[];
  rounds: ReadingLabRound[];
};

export type ReadingLabAnswerResult = {
  round_index: number;
  is_correct: boolean;
  correct_answer: string | string[];
  feedback: string;
  answered_rounds: number;
  total_rounds: number;
};

export type ReadingLabCompleteResult = {
  session_id: string;
  game_key: string;
  accuracy: number;
  correct_rounds: number;
  total_rounds: number;
  points_awarded: number;
  xp_awarded: number;
  progression: {
    total_xp: number;
    current_level: number;
    next_level_xp: number;
    leveled_up: boolean;
    new_badges: string[];
  };
};
