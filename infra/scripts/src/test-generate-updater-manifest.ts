import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateManifest, type ParsedArgs } from "./generate-updater-manifest";

function buildArgs(
  root: string,
  required: Set<"windows" | "macos">,
  tag = "@minerelay/launcher/v0.1.0-beta.999",
): ParsedArgs {
  return {
    owner: "isaacismaelx14",
    repo: "minerelay",
    tag,
    artifactsDir: root,
    output: join(root, "latest.json"),
    notes: "fixture test",
    required,
  };
}

function runFixtures(): void {
  const tempRoot = mkdtempSync(join(tmpdir(), "mcc-updater-fixtures-"));
  try {
    const windowsDir = join(tempRoot, "windows");
    mkdirSync(windowsDir, { recursive: true });
    writeFileSync(
      join(windowsDir, "MineRelay+.Client_0.1.0-beta.999_x64-setup.exe"),
      "bin",
    );
    writeFileSync(
      join(windowsDir, "MineRelay+.Client_0.1.0-999_x64-setup.exe.sig"),
      "sig-win",
    );
    const windowsOnly = generateManifest(
      buildArgs(windowsDir, new Set(["windows"])),
    );
    assert.equal(windowsOnly.version, "0.1.0-beta.999");
    assert.ok(windowsOnly.platforms["windows-x86_64"]);
    assert.equal(windowsOnly.platforms["windows-x86_64"]?.signature, "sig-win");

    const macDir = join(tempRoot, "mac");
    mkdirSync(macDir, { recursive: true });
    writeFileSync(
      join(macDir, "MineRelay+.Client_0.1.0-beta.999_aarch64.app.tar.gz"),
      "bin",
    );
    writeFileSync(
      join(macDir, "MineRelay+.Client_0.1.0-beta.999_aarch64.app.tar.gz.sig"),
      "sig-mac",
    );
    const macOnly = generateManifest(buildArgs(macDir, new Set(["macos"])));
    assert.ok(macOnly.platforms["darwin-aarch64"]);
    assert.equal(macOnly.platforms["darwin-aarch64"]?.signature, "sig-mac");

    const dualDir = join(tempRoot, "dual");
    mkdirSync(dualDir, { recursive: true });
    writeFileSync(
      join(dualDir, "MineRelay+.Client_0.1.0-beta.999_x64-setup.exe"),
      "bin",
    );
    writeFileSync(
      join(dualDir, "MineRelay+.Client_0.1.0-999_x64-setup.exe.sig"),
      "sig-win-dual",
    );
    writeFileSync(
      join(dualDir, "MineRelay+.Client_0.1.0-beta.999_universal.app.tar.gz"),
      "bin",
    );
    writeFileSync(
      join(
        dualDir,
        "MineRelay+.Client_0.1.0-beta.999_universal.app.tar.gz.sig",
      ),
      "sig-mac-dual",
    );
    const dual = generateManifest(
      buildArgs(dualDir, new Set(["windows", "macos"])),
    );
    assert.ok(dual.platforms["windows-x86_64"]);
    assert.ok(dual.platforms["darwin-aarch64"]);
    assert.ok(dual.platforms["darwin-x86_64"]);

    const genericMacDir = join(tempRoot, "generic-mac");
    mkdirSync(genericMacDir, { recursive: true });
    writeFileSync(join(genericMacDir, "MineRelay.app.tar.gz"), "bin");
    writeFileSync(
      join(genericMacDir, "MineRelay.app.tar.gz.sig"),
      "sig-generic",
    );
    writeFileSync(
      join(genericMacDir, "MineRelay+.Client_0.1.0-beta.999_aarch64.dmg"),
      "dmg",
    );
    const genericMac = generateManifest(
      buildArgs(genericMacDir, new Set(["macos"])),
    );
    assert.ok(genericMac.platforms["darwin-aarch64"]);

    const incompleteDir = join(tempRoot, "incomplete");
    mkdirSync(incompleteDir, { recursive: true });
    writeFileSync(
      join(incompleteDir, "MineRelay+.Client_0.1.0-beta.999_x64-setup.exe"),
      "bin",
    );
    assert.throws(
      () => generateManifest(buildArgs(incompleteDir, new Set(["windows"]))),
      /No signature found/u,
    );

    const preferUploadDirRoot = join(tempRoot, "prefer-upload-dir");
    const nsisDir = join(preferUploadDirRoot, "launcher-windows-nsis");
    const updaterDir = join(preferUploadDirRoot, "launcher-updater-Windows");
    mkdirSync(nsisDir, { recursive: true });
    mkdirSync(updaterDir, { recursive: true });
    writeFileSync(join(nsisDir, "MSS+.Client_0.1.0_x64-setup.exe"), "bin");
    writeFileSync(
      join(nsisDir, "MSS+.Client_0.1.0_x64-setup.exe.sig"),
      "sig-upload",
    );
    writeFileSync(join(updaterDir, "MSS+ Client_0.1.0_x64-setup.exe"), "bin");
    writeFileSync(
      join(updaterDir, "MSS+ Client_0.1.0_x64-setup.exe.sig"),
      "sig-updater",
    );
    const preferUploadDir = generateManifest(
      buildArgs(preferUploadDirRoot, new Set(["windows"])),
    );
    assert.match(
      preferUploadDir.platforms["windows-x86_64"]?.url ?? "",
      /MSS%2B\.Client_0\.1\.0_x64-setup\.exe$/u,
    );
    assert.equal(
      preferUploadDir.platforms["windows-x86_64"]?.signature,
      "sig-upload",
    );

    assert.throws(
      () =>
        generateManifest(
          buildArgs(
            windowsDir,
            new Set(["windows"]),
            "@mss/launcher/v0.1.0-beta.999",
          ),
        ),
      /Unsupported release tag/u,
    );

    assert.throws(
      () =>
        generateManifest(
          buildArgs(
            windowsDir,
            new Set(["windows"]),
            "@minerelay/launcher/vbad-version",
          ),
        ),
      /does not contain a valid semver/u,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

runFixtures();
console.log("Updater manifest fixture tests passed.");
