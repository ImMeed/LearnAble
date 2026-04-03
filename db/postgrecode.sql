CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    name TEXT,
    deleted_at TIMESTAMP
);

CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    name TEXT,
    deleted_at TIMESTAMP
);

CREATE TABLE psychologists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    name TEXT,
    deleted_at TIMESTAMP
);

CREATE TABLE parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    name TEXT,
    deleted_at TIMESTAMP
);

CREATE TABLE parent_student (
    parent_id UUID REFERENCES parents(id),
    student_id UUID REFERENCES students(id),
    PRIMARY KEY (parent_id, student_id)
);
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id),
    title TEXT,
    language TEXT,
    level TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE enrollment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    lesson_id UUID REFERENCES lessons(id),
    status TEXT,
    enrolled_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE TABLE lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    lesson_id UUID REFERENCES lessons(id),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE student_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    lesson_id UUID REFERENCES lessons(id),
    feedback TEXT,
    struggled BOOLEAN,
    difficulty_rating INT,
    submitted_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE quiz (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id),
    title TEXT,
    difficulty TEXT,
    reward_xp INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE quiz_question (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quiz(id),
    prompt_ar TEXT,
    prompt_en TEXT,
    correct_option_id UUID,
    explanation TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quiz_option (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES quiz_question(id),
    label TEXT,
    text TEXT
);

CREATE TABLE quiz_attempt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    quiz_id UUID REFERENCES quiz(id),
    score FLOAT,
    earned_xp INT,
    answers JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
CREATE TABLE assistance_request (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    teacher_id UUID REFERENCES teachers(id),
    status TEXT,
    message TEXT,
    trigger_source TEXT,
    lesson_id UUID REFERENCES lessons(id),
    requested_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE session_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id),
    student_id UUID REFERENCES students(id),
    scheduled_at TIMESTAMP,
    meeting_url TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE TABLE video_session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES session_schedule(id),
    teacher_id UUID REFERENCES teachers(id),
    student_id UUID REFERENCES students(id),
    meeting_url TEXT,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE emotion_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES video_session(id),
    emotion_label TEXT,
    confidence_score FLOAT,
    attention_score FLOAT,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE session_insight (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID UNIQUE REFERENCES video_session(id),
    avg_attention FLOAT,
    dominant_emotion TEXT,
    summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE game (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    type TEXT,
    reward_points INT,
    reward_xp INT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE game_attempt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    game_id UUID REFERENCES game(id),
    score FLOAT,
    earned_points INT,
    earned_xp INT,
    played_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE points_wallet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    balance_points INT DEFAULT 0,
    balance_xp INT DEFAULT 0,
    updated_at TIMESTAMP
);

CREATE TABLE currency_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    currency_type TEXT,
    source_type TEXT,
    source_id UUID,
    delta INT,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE notification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    sender_id UUID REFERENCES users(id),
    type TEXT,
    body TEXT,
    metadata JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP
);

CREATE TABLE ai_session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE TABLE ai_message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    session_id UUID REFERENCES ai_session(id),
    sender TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE forum_space (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE forum_post (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id),
    space_id UUID REFERENCES forum_space(id),
    title TEXT,
    content TEXT,
    score INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE TABLE forum_comment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES forum_post(id),
    author_id UUID REFERENCES users(id),
    parent_id UUID REFERENCES forum_comment(id),
    content TEXT,
    score INT DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE forum_vote (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    target_type TEXT,
    target_id UUID,
    value INT CHECK (value IN (-1, 1)),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE forum_report (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id),
    target_type TEXT,
    target_id UUID,
    reason TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
