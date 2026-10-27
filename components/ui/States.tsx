export function EmptyState({ message = "표시할 데이터가 없습니다." }: { message?: string }) {
  return <div className="state-card"><span>◇</span><strong>EMPTY</strong><p>{message}</p></div>;
}

export function ErrorState({ message = "데이터를 불러오지 못했습니다." }: { message?: string }) {
  return <div className="state-card state-card--error"><span>×</span><strong>ERROR</strong><p>{message}</p></div>;
}

export function LoadingState() {
  return <div className="state-card"><span className="state-spinner" /><strong>LOADING</strong><p>Mock 데이터를 불러오는 중입니다.</p></div>;
}

export function OfflineState() {
  return <div className="state-card state-card--error"><span>⌁</span><strong>OFFLINE</strong><p>서버 반영이 보장되지 않습니다.</p></div>;
}
