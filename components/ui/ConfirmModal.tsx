"use client";

export function ConfirmModal({ open, title, description, confirmLabel, danger = false, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <span className="confirm-modal__label">CONFIRM ACTION</span>
        <h2 id="confirm-title">{title}</h2>
        <p>{description}</p>
        <div><button className="admin-button admin-button--ghost" type="button" onClick={onCancel}>취소</button><button className={`admin-button ${danger ? "admin-button--danger" : "admin-button--primary"}`} type="button" onClick={onConfirm}>{confirmLabel}</button></div>
      </section>
    </div>
  );
}
