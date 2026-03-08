"use client";

import { type ReactNode } from "react";
import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip";

type Placement = "top" | "bottom";

export interface TooltipProps {
  content: ReactNode;
  placement?: Placement;
  children: ReactNode;
}

export function Tooltip({
  content,
  placement = "top",
  children,
}: TooltipProps) {
  return (
    <BaseTooltip.Provider delay={0} closeDelay={0}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger
          delay={0}
          closeDelay={0}
          render={<span className="inline-flex cursor-default" />}
        >
          {children}
        </BaseTooltip.Trigger>
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner
            side={placement}
            sideOffset={8}
            style={{ zIndex: 9999 }}
          >
            <BaseTooltip.Popup
              style={{
                maxWidth: 240,
                padding: "8px 12px",
                borderRadius: 8,
                backgroundColor: "var(--color-surface-elevated)",
                border: "1px solid var(--color-line-hover)",
                fontSize: 11,
                lineHeight: 1.5,
                color: "var(--color-text-secondary)",
                boxShadow: "0 8px 24px var(--color-shadow-lg)",
              }}
            >
              {content}
              <BaseTooltip.Arrow style={{ width: 10, height: 5 }}>
                <svg
                  width="10"
                  height="5"
                  viewBox="0 0 10 5"
                  style={{ display: "block" }}
                >
                  <path
                    d="M0 0L5 5L10 0"
                    fill="var(--color-surface-elevated)"
                  />
                </svg>
              </BaseTooltip.Arrow>
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}
