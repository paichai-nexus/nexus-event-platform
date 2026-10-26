import Link from "next/link";

export function QuickActions() {
  return (
    <div className="quick-actions shell" aria-label="빠른 메뉴">
      <Link className="button button--primary" href="/check-in"><span aria-hidden="true">↳</span> 현장 입장하기</Link>
      <a className="button button--primary" href="#program"><span aria-hidden="true">▦</span> 행사 일정 보기</a>
      <Link className="button button--outline" href="/vote"><span aria-hidden="true">◎</span> 청중평가 참여하기</Link>
    </div>
  );
}
