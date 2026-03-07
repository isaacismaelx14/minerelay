"use client";

import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { statusClass } from "@/admin/shared/ui/status";
import { ui } from "@/admin/shared/ui/styles";

import { useAssetsPageModel } from "../hooks/use-assets-page-model";

function PopularAssetModal({
  type,
  popular,
  loading,
  installingId,
  onClose,
  onInstall,
}: {
  type: "resourcepack" | "shaderpack";
  popular: Array<{
    projectId: string;
    title: string;
    author: string;
    description: string;
    iconUrl?: string;
  }>;
  loading: boolean;
  installingId: string | null;
  onClose: () => void;
  onInstall: (projectId: string) => Promise<void>;
}) {
  const title = type === "resourcepack" ? "Add Resourcepack" : "Add Shaderpack";

  return (
    <ModalShell onClose={onClose} wide>
      <div className="flex items-center justify-between border-b border-[var(--color-line)] p-[16px_20px] shrink-0">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button
          className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer text-[1.2rem] flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-sm)] transition-all duration-200 hover:bg-white/10 hover:text-white"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <p className={`${ui.hint} mt-0`}>Top 10 popular on Modrinth.</p>

        {loading ? (
          <p className={ui.hint}>Loading...</p>
        ) : popular.length === 0 ? (
          <p className={ui.hint}>No popular items found.</p>
        ) : (
          <div className="grid gap-[10px]">
            {popular.map((entry) => (
              <div
                key={entry.projectId}
                className="flex items-center justify-between gap-[12px] border border-[var(--color-line)] bg-black/20 rounded-[var(--radius-md)] p-[10px_12px]"
              >
                <div className="flex items-center gap-[12px] min-w-0">
                  <div className="w-[42px] h-[42px] rounded-[10px] overflow-hidden border border-[var(--color-line)] bg-white/5 shrink-0">
                    {entry.iconUrl ? (
                      <img
                        src={entry.iconUrl}
                        alt={`${entry.title} icon`}
                        width={42}
                        height={42}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <span className="grid place-items-center w-full h-full text-[0.75rem] text-[var(--color-text-muted)]">
                        ?
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{entry.title}</div>
                    <div className={ui.hint}>by {entry.author}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className={ui.buttonPrimary}
                  onClick={() => void onInstall(entry.projectId)}
                  disabled={installingId === entry.projectId}
                >
                  {installingId === entry.projectId ? "Adding..." : "Add"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function AssetIcon({
  src,
  alt,
  fallback,
  size = 24,
}: {
  src?: string;
  alt: string;
  fallback: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-[8px] overflow-hidden border border-[var(--color-line)] bg-white/5 shrink-0 text-[var(--color-text-muted)] grid place-items-center"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.max(12, Math.round(size * 0.5))}px`,
      }}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}

function EmptyAssetState({ text }: { text: string }) {
  return <p className={ui.hint}>{text}</p>;
}

export function AssetsPage() {
  const {
    status,
    selectedMods,
    selectedResources,
    selectedShaders,
    openModsManager,
    modalType,
    popular,
    loadingPopular,
    installingId,
    openPopularModal,
    closePopularModal,
    installFromPopular,
    removeResource,
    removeShader,
  } = useAssetsPageModel();

  const modPreview = selectedMods.slice(0, 6);
  const hiddenMods = Math.max(selectedMods.length - modPreview.length, 0);

  return (
    <section className="grid gap-[24px]">
      <header className="flex items-start justify-between gap-[16px]">
        <div>
          <h2>Assets</h2>
          <p className="text-[0.9rem] text-[var(--color-text-muted)] m-0 leading-[1.5]">
            Manage user-side assets. Mods, resourcepacks, and shaderpacks are
            tracked here.
          </p>
        </div>
      </header>

      <div className={statusClass(status.tone)}>{status.text}</div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
        <section className={`${ui.panel} xl:col-span-2`}>
          <div className="flex items-center justify-between gap-[12px]">
            <div className="grid gap-[4px]">
              <h3>Mods</h3>
              <span className={ui.hint}>Installed: {selectedMods.length}</span>
            </div>
            <button
              type="button"
              className={ui.buttonPrimary}
              onClick={openModsManager}
            >
              Open Mods Manager
            </button>
          </div>

          <div className="grid gap-[10px]">
            {modPreview.length === 0 ? (
              <EmptyAssetState text="No mods installed yet." />
            ) : (
              <div className="grid gap-[10px]">
                {modPreview.map((entry) => (
                  <div
                    key={`${entry.projectId ?? entry.sha256}-${entry.versionId ?? "latest"}`}
                    className="flex items-center justify-between gap-[12px] border border-[var(--color-line)] bg-black/20 rounded-[var(--radius-md)] p-[12px]"
                  >
                    <div className="flex items-center gap-[12px] min-w-0">
                      <AssetIcon
                        src={entry.iconUrl}
                        alt={`${entry.name} icon`}
                        fallback="M"
                      />
                      <div className="grid gap-[2px] min-w-0">
                        <strong className="truncate">{entry.name}</strong>
                        <span className={ui.hint}>
                          {entry.side === "both" ? "user + server" : entry.side}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={ui.buttonGhost}
                      onClick={openModsManager}
                    >
                      Managed in Mods Manager
                    </button>
                  </div>
                ))}
              </div>
            )}
            {hiddenMods > 0 ? (
              <p className={ui.hint}>
                +{hiddenMods} more mod(s) in Mods Manager.
              </p>
            ) : null}
          </div>
        </section>

        <section className={ui.panel}>
          <div className="flex items-center justify-between gap-[12px]">
            <div className="grid gap-[4px]">
              <h3>Resourcepacks</h3>
              <span className={ui.hint}>
                Installed: {selectedResources.length}
              </span>
            </div>
            <button
              type="button"
              className={ui.buttonPrimary}
              onClick={() => void openPopularModal("resourcepack")}
            >
              Add Resourcepack
            </button>
          </div>

          <div className="grid gap-[10px]">
            {selectedResources.length === 0 ? (
              <EmptyAssetState text="No resourcepacks installed." />
            ) : (
              <div className="grid gap-[10px]">
                {selectedResources.map((entry) => (
                  <div
                    key={entry.sha256}
                    className="flex items-center justify-between gap-[12px] border border-[var(--color-line)] bg-black/20 rounded-[var(--radius-md)] p-[12px]"
                  >
                    <div className="flex items-center gap-[12px] min-w-0">
                      <AssetIcon
                        src={entry.iconUrl}
                        alt={`${entry.name} icon`}
                        fallback="R"
                      />
                      <div className="grid gap-[2px] min-w-0">
                        <strong className="truncate">{entry.name}</strong>
                        <span className={ui.hint}>
                          {entry.slug ?? entry.projectId ?? "custom pack"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={ui.buttonDanger}
                      onClick={() =>
                        removeResource(entry.projectId, entry.sha256)
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={ui.panel}>
          <div className="flex items-center justify-between gap-[12px]">
            <div className="grid gap-[4px]">
              <h3>Shaderpacks</h3>
              <span className={ui.hint}>
                Installed: {selectedShaders.length}
              </span>
            </div>
            <button
              type="button"
              className={ui.buttonPrimary}
              onClick={() => void openPopularModal("shaderpack")}
            >
              Add Shaderpack
            </button>
          </div>

          <div className="grid gap-[10px]">
            {selectedShaders.length === 0 ? (
              <EmptyAssetState text="No shaderpacks installed." />
            ) : (
              <div className="grid gap-[10px]">
                {selectedShaders.map((entry) => (
                  <div
                    key={entry.sha256}
                    className="flex items-center justify-between gap-[12px] border border-[var(--color-line)] bg-black/20 rounded-[var(--radius-md)] p-[12px]"
                  >
                    <div className="flex items-center gap-[12px] min-w-0">
                      <AssetIcon
                        src={entry.iconUrl}
                        alt={`${entry.name} icon`}
                        fallback="S"
                      />
                      <div className="grid gap-[2px] min-w-0">
                        <strong className="truncate">{entry.name}</strong>
                        <span className={ui.hint}>
                          {entry.slug ?? entry.projectId ?? "custom shader"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={ui.buttonDanger}
                      onClick={() =>
                        removeShader(entry.projectId, entry.sha256)
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {modalType ? (
        <PopularAssetModal
          type={modalType}
          popular={popular}
          loading={loadingPopular}
          installingId={installingId}
          onClose={closePopularModal}
          onInstall={installFromPopular}
        />
      ) : null}
    </section>
  );
}
