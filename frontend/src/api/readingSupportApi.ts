import { apiClient } from "./client";
import type {
  ReadingLabAnswerResult,
  ReadingLabCompleteResult,
  ReadingLabGame,
  ReadingLabSessionStart,
  ReadingSupportMe,
  ReadingSupportProfile,
  ReadingSupportStudentCreateResult,
  ReadingSupportStudentOverview,
} from "../features/readingLab/types";

function cfg(lang: string | undefined) {
  return { headers: { "x-lang": lang === "en" ? "en" : "ar" } };
}

export async function fetchMyReadingSupport(lang?: string): Promise<ReadingSupportMe> {
  const response = await apiClient.get<ReadingSupportMe>("/reading-support/me", cfg(lang));
  return response.data;
}

export async function fetchReadingSupportStudents(lang?: string): Promise<ReadingSupportStudentOverview[]> {
  const response = await apiClient.get<{ items: ReadingSupportStudentOverview[] }>("/reading-support/students", cfg(lang));
  return response.data.items ?? [];
}

export async function linkReadingSupportStudent(studentId: string, lang?: string): Promise<void> {
  await apiClient.post("/reading-support/students/link", { student_id: studentId }, cfg(lang));
}

export async function createReadingSupportStudent(
  payload: { display_name: string; email: string; password: string },
  lang?: string,
): Promise<ReadingSupportStudentCreateResult> {
  const response = await apiClient.post<ReadingSupportStudentCreateResult>("/reading-support/students", payload, cfg(lang));
  return response.data;
}

export async function updateStudentReadingSupport(
  studentId: string,
  payload: { is_active: boolean; notes: string; focus_letters: string[]; focus_words: string[]; focus_numbers: string[] },
  lang?: string,
): Promise<ReadingSupportProfile> {
  const response = await apiClient.put<ReadingSupportProfile>(
    `/reading-support/students/${studentId}`,
    payload,
    cfg(lang),
  );
  return response.data;
}

export async function fetchReadingLabGames(lang?: string): Promise<ReadingLabGame[]> {
  const response = await apiClient.get<{ items: ReadingLabGame[] }>("/reading-support/games", cfg(lang));
  return response.data.items ?? [];
}

export async function startReadingLabSession(gameKey: string, lang?: string): Promise<ReadingLabSessionStart> {
  const response = await apiClient.post<ReadingLabSessionStart>(
    "/reading-support/sessions",
    { game_key: gameKey },
    cfg(lang),
  );
  return response.data;
}

export async function submitReadingLabAnswer(
  sessionId: string,
  payload: { round_index: number; answer: string | string[] },
  lang?: string,
): Promise<ReadingLabAnswerResult> {
  const response = await apiClient.post<ReadingLabAnswerResult>(
    `/reading-support/sessions/${sessionId}/answer`,
    payload,
    cfg(lang),
  );
  return response.data;
}

export async function completeReadingLabSession(sessionId: string, lang?: string): Promise<ReadingLabCompleteResult> {
  const response = await apiClient.post<ReadingLabCompleteResult>(
    `/reading-support/sessions/${sessionId}/complete`,
    {},
    cfg(lang),
  );
  return response.data;
}
