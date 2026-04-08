# LearnAble Database ER Diagram

```mermaid
erDiagram
  users {
    uuid id PK
    string email UK
    string password_hash
    enum user_role role
    timestamptz created_at
    timestamptz updated_at
  }

  student_parent_links {
    uuid student_user_id PK, FK
    uuid parent_user_id PK, FK
    timestamptz created_at
  }

  student_psychologist_links {
    uuid student_user_id PK, FK
    uuid psychologist_user_id PK, FK
    timestamptz created_at
  }

  points_wallets {
    uuid user_id PK, FK
    int balance_points
    timestamptz updated_at
  }

  point_transactions {
    uuid id PK
    uuid user_id FK
    enum point_transaction_type type
    int points_delta
    string reason
    jsonb metadata
    timestamptz created_at
  }

  xp_ledgers {
    uuid id PK
    uuid user_id FK
    int xp_delta
    string reason
    jsonb metadata
    timestamptz created_at
  }

  notifications {
    uuid id PK
    uuid user_id FK
    string type
    string title
    string body
    jsonb metadata
    bool is_read
    timestamptz created_at
  }

  quizzes {
    uuid id PK
    string title_ar
    string title_en
    string difficulty
    int reward_points
    int reward_xp
    bool is_active
    timestamptz created_at
  }

  quiz_questions {
    uuid id PK
    uuid quiz_id FK
    string prompt_ar
    string prompt_en
    jsonb options
    string correct_option
    string explanation_ar
    string explanation_en
    timestamptz created_at
  }

  quiz_attempts {
    uuid id PK
    uuid user_id FK
    uuid quiz_id FK
    int score
    int total_questions
    int earned_points
    int earned_xp
    jsonb answers
    timestamptz started_at
    timestamptz completed_at
  }

  books {
    uuid id PK
    string title_ar
    string title_en
    string author_ar
    string author_en
    string summary_ar
    string summary_en
    string cover_image_url
    string reader_url
    int points_cost
    bool is_active
    timestamptz created_at
  }

  digital_purchases {
    uuid id PK
    uuid user_id FK
    uuid book_id FK
    int points_spent
    timestamptz created_at
  }

  student_screenings {
    uuid id PK
    uuid user_id FK
    int focus_score
    int reading_score
    int memory_score
    string support_level
    jsonb indicators
    timestamptz created_at
  }

  lessons {
    uuid id PK
    string title_ar
    string title_en
    string body_ar
    string body_en
    string difficulty
    bool is_active
    timestamptz created_at
  }

  lesson_flashcards {
    uuid id PK
    uuid lesson_id FK
    string front_ar
    string front_en
    string back_ar
    string back_en
    timestamptz created_at
  }

  lesson_reading_games {
    uuid id PK
    uuid lesson_id FK
    string name_ar
    string name_en
    string objective_ar
    string objective_en
    jsonb words
    timestamptz created_at
  }

  teacher_presence {
    uuid user_id PK, FK
    bool is_online
    timestamptz updated_at
  }

  teacher_assistance_requests {
    uuid id PK
    uuid student_user_id FK
    uuid tutor_user_id FK
    uuid lesson_id FK
    string topic
    string message
    timestamptz preferred_at
    enum assistance_request_status status
    timestamptz scheduled_at
    string meeting_url
    timestamptz created_at
    timestamptz updated_at
  }

  student_feedback_prompts {
    uuid id PK
    uuid student_user_id FK
    enum feedback_source_type source_type
    uuid source_id
    string prompt_ar
    string prompt_en
    string response_text
    bool is_answered
    timestamptz created_at
  }

  teacher_questionnaires {
    uuid id PK
    uuid student_user_id FK
    uuid tutor_user_id FK
    int attention_score
    int engagement_score
    string notes
    int cadence_days
    timestamptz submitted_at
  }

  psychologist_support_confirmations {
    uuid id PK
    uuid student_user_id FK, UK
    uuid psychologist_user_id FK
    string support_level
    string notes
    timestamptz confirmed_at
  }

  forum_spaces {
    uuid id PK
    string slug UK
    string name_ar
    string name_en
    string description_ar
    string description_en
    bool is_active
    timestamptz created_at
  }

  forum_posts {
    uuid id PK
    uuid space_id FK
    uuid author_user_id FK
    string title
    string content
    enum forum_post_status status
    bool is_locked
    int upvotes
    int downvotes
    timestamptz created_at
    timestamptz updated_at
  }

  forum_comments {
    uuid id PK
    uuid post_id FK
    uuid author_user_id FK
    string content
    enum forum_comment_status status
    int upvotes
    int downvotes
    timestamptz created_at
    timestamptz updated_at
  }

  forum_votes {
    uuid id PK
    uuid user_id FK
    enum forum_target_type target_type
    uuid target_id
    int value
    timestamptz created_at
    timestamptz updated_at
  }

  forum_reports {
    uuid id PK
    enum forum_report_target_type target_type
    uuid target_id
    uuid reporter_user_id FK
    string reason
    enum forum_report_status status
    uuid reviewed_by_user_id FK
    string review_notes
    timestamptz reviewed_at
    timestamptz created_at
  }

  users ||--o{ student_parent_links : student
  users ||--o{ student_parent_links : parent
  users ||--o{ student_psychologist_links : student
  users ||--o{ student_psychologist_links : psychologist

  users ||--|| points_wallets : wallet
  users ||--o{ point_transactions : points_ledger
  users ||--o{ xp_ledgers : xp_ledger
  users ||--o{ notifications : notifications

  quizzes ||--o{ quiz_questions : questions
  users ||--o{ quiz_attempts : attempts
  quizzes ||--o{ quiz_attempts : attempts

  users ||--o{ digital_purchases : purchases
  books ||--o{ digital_purchases : purchased

  users ||--o| student_screenings : screening
  lessons ||--o{ lesson_flashcards : flashcards
  lessons ||--o{ lesson_reading_games : reading_games

  users ||--|| teacher_presence : presence
  users ||--o{ teacher_assistance_requests : student_requests
  users ||--o{ teacher_assistance_requests : tutor_assignments
  lessons ||--o{ teacher_assistance_requests : lesson_context
  users ||--o{ student_feedback_prompts : feedback_prompts

  users ||--o{ teacher_questionnaires : student_subject
  users ||--o{ teacher_questionnaires : tutor_author
  users ||--o| psychologist_support_confirmations : student_confirmation
  users ||--o{ psychologist_support_confirmations : psychologist_author

  forum_spaces ||--o{ forum_posts : posts
  users ||--o{ forum_posts : author
  forum_posts ||--o{ forum_comments : comments
  users ||--o{ forum_comments : author
  users ||--o{ forum_votes : voter
  users ||--o{ forum_reports : reporter
  users ||--o{ forum_reports : reviewer
```

Notes:
- `student_feedback_prompts.source_id` is polymorphic (not an FK), keyed by `source_type`.
- `forum_votes.target_id` and `forum_reports.target_id` are polymorphic (POST/COMMENT), not direct FKs.
- Enum names align with Alembic migrations in backend/alembic/versions.
