import { apiClient } from './client';

export interface QuizSummary {
  id: string;
  title: string;
  difficulty: string;
  reward_points: number;
  reward_xp: number;
}

export interface QuizOption {
  key: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

export interface StartQuizResponse {
  attempt_id: string;
  quiz: QuizSummary;
  questions: QuizQuestion[];
}

export interface SubmitQuizResponse {
  score: number;
  total_questions: number;
  correct_answers: number;
  earned_points: number;
  earned_xp: number;
  wallet_balance: number;
}

export interface HintResponse {
  hint: string;
  points_cost: number;
  wallet_balance: number;
}

export async function listQuizzes(): Promise<QuizSummary[]> {
  const res = await apiClient.get<{ items: QuizSummary[] }>('/quizzes');
  return res.data.items;
}

export async function startQuiz(quizId: string): Promise<StartQuizResponse> {
  const res = await apiClient.post<StartQuizResponse>(`/quizzes/${quizId}/start`);
  return res.data;
}

export async function submitQuiz(
  quizId: string,
  attemptId: string,
  answers: { question_id: string; option_key: string }[],
): Promise<SubmitQuizResponse> {
  const res = await apiClient.post<SubmitQuizResponse>(`/quizzes/${quizId}/submit`, {
    attempt_id: attemptId,
    answers,
  });
  return res.data;
}

export async function getHint(quizId: string, questionId: string): Promise<HintResponse> {
  const res = await apiClient.post<HintResponse>(`/quizzes/${quizId}/hint`, { question_id: questionId });
  return res.data;
}
