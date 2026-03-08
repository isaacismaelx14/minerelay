/**
 * Pre-composed Tailwind class string tokens for common patterns.
 * Use these for quick inline styling when a full component is not needed.
 */
export const ui = {
  /* Buttons */
  buttonPrimary:
    "border border-line-hover rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-gradient-to-br from-brand-primary to-brand-accent text-white shadow-[0_4px_12px_var(--color-brand-primary-shadow)] hover:not-disabled:shadow-[0_8px_20px_var(--color-brand-primary-shadow-hover),0_0_12px_var(--color-brand-primary-shadow-soft)] hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]",
  buttonGhost:
    "border border-line-soft rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-surface-subtle text-text-secondary shadow-none backdrop-blur-[4px] hover:not-disabled:bg-surface-subtle-hover hover:not-disabled:border-line-emphasis hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]",
  buttonDanger:
    "border border-danger-border-emphasis rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-danger-bg text-danger-text shadow-none backdrop-blur-[4px] hover:not-disabled:bg-danger-bg-strong hover:not-disabled:text-white hover:not-disabled:border-danger-border-heavy hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]",

  /* Panels */
  panel:
    "bg-bg-card border border-line rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150",
  panelHover:
    "bg-bg-card border border-line rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-bg-card-hover hover:border-line-strong hover:-translate-y-[2px]",

  /* Text */
  hint: "m-0 text-[0.9rem] text-text-muted leading-[1.5]",

  /* Layout */
  row: "flex items-center gap-[16px]",
  gridTwo: "grid grid-cols-1 md:grid-cols-2 gap-[20px]",

  /* Modal helpers */
  modalBrand: "grid gap-[4px]",
  modalMeta:
    "m-0 text-[0.78rem] uppercase tracking-[0.08em] text-text-muted font-medium",

  /* Data display */
  dataItem: "grid gap-[8px]",
  dataLabel:
    "font-mono text-[0.75rem] text-text-muted uppercase tracking-[0.12em] font-semibold",

  /* Select field */
  selectField:
    "border border-line rounded-[var(--radius-md)] bg-surface-deep-30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-text-primary w-full transition-all duration-150 ease-out outline-none focus:border-brand-primary focus:bg-surface-deep-40 focus:shadow-[0_0_0_4px_var(--color-brand-primary-ring)]",

  /* Checkboxes */
  check:
    "flex items-center gap-[12px] cursor-pointer text-[0.9rem] text-text-primary transition-colors hover:text-white [&>input]:w-[18px] [&>input]:h-[18px] [&>input]:accent-brand-primary [&>input]:cursor-pointer",
  checkDanger: "text-danger-soft-text hover:text-danger-soft-text-hover",

  /* Status blocks */
  statusBase:
    "p-[14px_16px] rounded-[var(--radius-md)] text-[0.9rem] leading-[1.5] border flex flex-col gap-[4px]",
  statusIdle: "bg-surface-subtle border-line text-text-secondary",
  statusOk: "bg-success-bg border-success-border text-success-soft-text",
  statusError: "bg-danger-bg border-danger-border text-danger-soft-text",

  /* Status chips */
  statusChip:
    "inline-flex items-center rounded-full px-[10px] py-[4px] text-[0.75rem] font-semibold border",
  statusChipOnline: "text-success-bright bg-success-bg border-success-border",
  statusChipBusy: "text-warning-bright bg-warning-bg border-warning-border",
  statusChipOffline: "text-text-muted bg-surface-subtle border-line",
  statusChipCrashed: "text-danger-bright bg-danger-bg border-danger-border",
} as const;
