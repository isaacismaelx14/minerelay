"use client";

import { memo } from "react";
import type { FancyMenuPreviewPayload, FancyMenuPreviewModel } from "./types";

type Props = {
  model: FancyMenuPreviewPayload["model"] | null;
};

export const FancyPreviewCanvas = memo(function FancyPreviewCanvas({
  model,
}: Props) {
  if (!model) {
    return (
      <p className="text-[0.9rem] text-[var(--color-text-muted)] m-0 leading-[1.5]">
        No preview yet.
      </p>
    );
  }

  return (
    <div className="mc-preview">
      <div
        className="mc-preview-bg"
        style={
          model.backgroundUrl
            ? { backgroundImage: `url(${model.backgroundUrl})` }
            : { background: "#222" }
        }
      />
      <div className="mc-preview-overlay" />
      <div className="mc-preview-content">
        <div className="mc-preview-logo-container">
          {model.logoUrl ? (
            <img
              className="mc-preview-logo"
              src={model.logoUrl}
              alt="Server logo"
            />
          ) : (
            <h1 className="mc-preview-title">{model.titleText}</h1>
          )}
          {model.subtitleText && (
            <div className="mc-preview-subtitle">{model.subtitleText}</div>
          )}
        </div>

        <div className="mc-preview-buttons">
          {model.buttons
            .filter(
              (button: FancyMenuPreviewModel["buttons"][number]) =>
                button.visible,
            )
            .map((button: FancyMenuPreviewModel["buttons"][number]) => (
              <button
                key={`${button.key}-${button.label}`}
                className={`mc-btn ${button.primary ? "primary" : ""}`}
                type="button"
              >
                {button.label}
              </button>
            ))}
        </div>
      </div>
      <div className="mc-preview-footer">
        <span>Minecraft 1.21.1 / Fabric (Modded)</span>
        <span>Copyright Mojang AB. Do not distribute!</span>
      </div>
    </div>
  );
});
