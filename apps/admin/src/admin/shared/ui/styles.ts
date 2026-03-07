export const ui = {
  buttonPrimary:
    "border border-white/10 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:not-disabled:shadow-[0_8px_20px_rgba(99,102,241,0.4),0_0_12px_rgba(99,102,241,0.2)] hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]",
  buttonGhost:
    "border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]",
  buttonDanger:
    "border border-[#e11d48]/50 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-[#e11d48]/10 text-[#f43f5e] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-[#e11d48]/20 hover:not-disabled:text-white hover:not-disabled:border-[#e11d48]/70 hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]",
  panel:
    "bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150",
  panelHover:
    "bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]",
  hint: "m-0 text-[0.9rem] text-[var(--color-text-muted)] leading-[1.5]",
  row: "flex items-center gap-[16px]",
  gridTwo: "grid grid-cols-1 md:grid-cols-2 gap-[20px]",
  modalBrand: "grid gap-[4px]",
  modalMeta:
    "m-0 text-[0.78rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)] font-medium",
  dataItem: "grid gap-[8px]",
  dataLabel:
    "font-mono text-[0.75rem] text-[var(--color-text-muted)] uppercase tracking-[0.12em] font-semibold",
  selectField:
    "border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-[var(--color-text-primary)] w-full transition-all duration-150 ease-out outline-none focus:border-[var(--color-brand-primary)] focus:bg-black/40 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]",
  check:
    "flex items-center gap-[12px] cursor-pointer text-[0.9rem] text-[var(--color-text-primary)] transition-colors hover:text-white [&>input]:w-[18px] [&>input]:h-[18px] [&>input]:accent-[var(--color-brand-primary)] [&>input]:cursor-pointer",
  checkDanger: "text-[#fca5a5] hover:text-[#fecaca]",
  statusBase:
    "p-[14px_16px] rounded-[var(--radius-md)] text-[0.9rem] leading-[1.5] border flex flex-col gap-[4px]",
  statusIdle:
    "bg-white/5 border-[var(--color-line)] text-[var(--color-text-secondary)]",
  statusOk: "bg-[#10b981]/10 border-[#10b981]/20 text-[#86efac]",
  statusError: "bg-[#ef4444]/10 border-[#ef4444]/20 text-[#fca5a5]",
  statusChip:
    "inline-flex items-center rounded-full px-[10px] py-[4px] text-[0.75rem] font-semibold border",
  statusChipOnline: "text-[#34d399] bg-[#10b981]/10 border-[#10b981]/20",
  statusChipBusy: "text-[#fbbf24] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  statusChipOffline:
    "text-[var(--color-text-muted)] bg-white/5 border-[var(--color-line)]",
  statusChipCrashed: "text-[#fb7185] bg-[#e11d48]/10 border-[#e11d48]/20",
} as const;
