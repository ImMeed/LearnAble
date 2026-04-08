import { apiClient } from "./client";
import type { AssistanceRequestItem, TeacherPresenceItem } from "../app/pages/roleDashboardShared";

export async function createCallRoom(): Promise<string> {
  const res = await apiClient.post<{ room_id: string }>("/calls/rooms");
  return res.data.room_id;
}

function cfg(lang: string | undefined) {
  return { headers: { "x-lang": lang === "en" ? "en" : "ar" } };
}

export async function fetchActiveTeachers(lang?: string): Promise<TeacherPresenceItem[]> {
  const res = await apiClient.get<{ items: TeacherPresenceItem[] }>("/teacher/presence/active", cfg(lang));
  return res.data.items ?? [];
}

export async function createAssistanceRequest(
  topic: string,
  message: string,
  lang?: string,
): Promise<AssistanceRequestItem> {
  const res = await apiClient.post<AssistanceRequestItem>(
    "/teacher/assistance/requests",
    { topic, message },
    cfg(lang),
  );
  return res.data;
}

export async function fetchMyAssistanceRequests(lang?: string): Promise<AssistanceRequestItem[]> {
  // Students call the same endpoint; backend filters by their user_id
  const res = await apiClient.get<{ items: AssistanceRequestItem[] }>(
    "/teacher/assistance/requests",
    cfg(lang),
  );
  return res.data.items ?? [];
}

export async function scheduleRequest(
  requestId: string,
  scheduledAt: string,
  meetingUrl: string,
  lang?: string,
): Promise<void> {
  await apiClient.patch(
    `/teacher/assistance/requests/${requestId}/schedule`,
    { scheduled_at: scheduledAt, meeting_url: meetingUrl },
    cfg(lang),
  );
}

export async function completeRequest(requestId: string, lang?: string): Promise<void> {
  await apiClient.patch(`/teacher/assistance/requests/${requestId}/complete`, {}, cfg(lang));
}
