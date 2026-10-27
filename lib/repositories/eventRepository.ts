import { INITIAL_EVENT_STATE } from "@/features/event/data/mockEventStore";
import type { EventOpsState } from "@/types/operations";

export interface EventRepository {
  getSnapshot(): Promise<EventOpsState>;
}

export class MockEventRepository implements EventRepository {
  async getSnapshot() {
    return structuredClone(INITIAL_EVENT_STATE);
  }
}

export class SupabaseEventRepository implements EventRepository {
  async getSnapshot(): Promise<EventOpsState> {
    throw new Error("Supabase 연결이 구성되지 않았습니다.");
  }
}
