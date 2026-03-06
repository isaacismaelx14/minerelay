"use client";

import { memo } from "react";

export const MainLoadingState = memo(function MainLoadingState() {
  return (
    <div className="main-loading" role="status" aria-live="polite">
      <div className="main-loading-head" />
      <div className="main-loading-grid">
        <div className="main-loading-card" />
        <div className="main-loading-card" />
        <div className="main-loading-card" />
        <div className="main-loading-card" />
      </div>
    </div>
  );
});
