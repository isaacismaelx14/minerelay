import { memo } from 'react';
import type { FancyMenuPreviewPayload } from './types';

type Props = {
  model: FancyMenuPreviewPayload['model'] | null;
};

export const FancyPreviewCanvas = memo(function FancyPreviewCanvas({
  model,
}: Props) {
  if (!model) {
    return <p className="hint">No preview yet.</p>;
  }

  return (
    <div className="mc-preview">
      <div
        className="mc-preview-bg"
        style={
          model.backgroundUrl
            ? { backgroundImage: `url(${model.backgroundUrl})` }
            : undefined
        }
      />
      <div className="mc-preview-overlay" />
      <div className="mc-preview-content">
        {model.logoUrl ? (
          <img
            className="mc-preview-logo"
            src={model.logoUrl}
            alt="Server logo"
          />
        ) : (
          <h2 className="mc-preview-title">{model.titleText}</h2>
        )}
        <p className="mc-preview-subtitle">{model.subtitleText}</p>

        <div className="mc-preview-buttons">
          {model.buttons
            .filter((button) => button.visible)
            .map((button) => (
              <button
                key={`${button.key}-${button.label}`}
                className={`mc-btn ${button.primary ? 'primary' : ''}`}
                type="button"
              >
                {button.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
});
