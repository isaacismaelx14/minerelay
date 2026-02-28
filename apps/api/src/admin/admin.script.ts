export function renderAdminScript(): string {
  return `(function () {
  var state = {
    searchResults: [],
    mods: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  var statusEl = byId('status');
  var resultsEl = byId('results');
  var modsEl = byId('mods');
  var outputEl = byId('output');
  var importFileInput = byId('importFileInput');

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll(\"'\", '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll('"', '&quot;');
  }

  function slugify(input) {
    var value = String(input || '').toLowerCase();
    value = value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return value || 'server-profile';
  }

  function runtimeInput() {
    return {
      minecraftVersion: byId('minecraftVersion').value.trim(),
      loaderVersion: byId('loaderVersion').value.trim()
    };
  }

  function readErrorText(response, fallback) {
    return response.text()
      .then(function (text) {
        if (text) {
          return text;
        }

        return fallback;
      })
      .catch(function () {
        return fallback;
      });
  }

  function renderResults() {
    if (!state.searchResults.length) {
      resultsEl.innerHTML = '<p class="muted">No results yet.</p>';
      return;
    }

    var html = state.searchResults.map(function (mod) {
      var title = escapeHtml(mod.title || mod.projectId);
      var description = escapeHtml(mod.description || 'No description');
      var projectId = escapeHtml(mod.projectId);
      var projectIdAttr = escapeAttr(mod.projectId);

      return '<div class="result-item">'
        + '<div class="result-title">'
        + '<span>' + title + '</span>'
        + '<button class="btn-ghost" data-project-id="' + projectIdAttr + '">Add</button>'
        + '</div>'
        + '<div class="muted">' + description + '</div>'
        + '<div class="muted">Project ID: ' + projectId + '</div>'
        + '</div>';
    }).join('');

    resultsEl.innerHTML = html;

    Array.prototype.forEach.call(resultsEl.querySelectorAll('button[data-project-id]'), function (button) {
      button.addEventListener('click', function () {
        var projectId = button.getAttribute('data-project-id');
        if (projectId) {
          addMod(projectId);
        }
      });
    });
  }

  function renderMods() {
    if (!state.mods.length) {
      modsEl.innerHTML = '<p class="muted">No mods selected yet.</p>';
      return;
    }

    var html = state.mods.map(function (mod) {
      return '<div class="mod-item">'
        + '<div class="result-title">'
        + '<span>' + escapeHtml(mod.name) + '</span>'
        + '<button class="btn-danger" data-remove-project-id="' + escapeAttr(mod.projectId) + '">Remove</button>'
        + '</div>'
        + '<div class="muted">Version ID: ' + escapeHtml(mod.versionId) + '</div>'
        + '<div class="muted">URL: ' + escapeHtml(mod.url) + '</div>'
        + '</div>';
    }).join('');

    modsEl.innerHTML = html;

    Array.prototype.forEach.call(modsEl.querySelectorAll('button[data-remove-project-id]'), function (button) {
      button.addEventListener('click', function () {
        var projectId = button.getAttribute('data-remove-project-id');
        if (!projectId) {
          return;
        }

        state.mods = state.mods.filter(function (entry) {
          return entry.projectId !== projectId;
        });

        renderMods();
        setStatus('Removed mod.');
      });
    });
  }

  function searchMods() {
    var query = byId('searchQuery').value.trim();
    var minecraftVersion = runtimeInput().minecraftVersion;

    if (!query) {
      setStatus('Type a mod name first.');
      return;
    }

    if (!minecraftVersion) {
      setStatus('Set Minecraft version first.');
      return;
    }

    setStatus('Searching Modrinth...');

    var url = '/v1/admin/mods/search?query='
      + encodeURIComponent(query)
      + '&minecraftVersion='
      + encodeURIComponent(minecraftVersion);

    fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Search failed (' + response.status + ')');
        }

        return response.json();
      })
      .then(function (payload) {
        state.searchResults = Array.isArray(payload) ? payload : [];
        renderResults();
        setStatus('Found ' + state.searchResults.length + ' result(s).');
      })
      .catch(function (error) {
        setStatus(error.message || 'Search failed.');
      });
  }

  function addMod(projectId) {
    var minecraftVersion = runtimeInput().minecraftVersion;

    if (!minecraftVersion) {
      setStatus('Set Minecraft version first.');
      return;
    }

    setStatus('Resolving compatible file + SHA-256...');

    var url = '/v1/admin/mods/resolve?projectId='
      + encodeURIComponent(projectId)
      + '&minecraftVersion='
      + encodeURIComponent(minecraftVersion);

    fetch(url)
      .then(function (response) {
        if (response.ok) {
          return response.json();
        }

        return readErrorText(response, 'Resolve failed').then(function (text) {
          throw new Error(text);
        });
      })
      .then(function (mod) {
        var idx = state.mods.findIndex(function (entry) {
          return entry.projectId === mod.projectId;
        });

        if (idx >= 0) {
          state.mods[idx] = mod;
        } else {
          state.mods.push(mod);
        }

        renderMods();
        setStatus('Added ' + mod.name + '.');
      })
      .catch(function (error) {
        setStatus(error.message || 'Resolve failed.');
      });
  }

  function generateLockfile() {
    var profileIdRaw = byId('profileId').value.trim();
    var serverName = byId('serverName').value.trim();
    var serverAddress = byId('serverAddress').value.trim();
    var minecraftVersion = byId('minecraftVersion').value.trim();
    var loaderVersion = byId('loaderVersion').value.trim();
    var version = Number(byId('profileVersion').value);

    if (!serverName || !serverAddress || !minecraftVersion || !loaderVersion) {
      setStatus('Fill server name/address and versions first.');
      return;
    }

    if (!state.mods.length) {
      setStatus('Add at least one mod first.');
      return;
    }

    var payload = {
      profileId: profileIdRaw || slugify(serverName),
      version: Number.isFinite(version) && version > 0 ? Math.floor(version) : 1,
      serverName: serverName,
      serverAddress: serverAddress,
      minecraftVersion: minecraftVersion,
      loaderVersion: loaderVersion,
      mods: state.mods,
      includeFancyMenu: byId('includeFancyMenu').checked,
      playButtonLabel: byId('playButtonLabel').value.trim() || 'Play',
      titleText: byId('titleText').value.trim() || undefined,
      subtitleText: byId('subtitleText').value.trim() || undefined,
      logoUrl: byId('logoUrl').value.trim() || undefined,
      hideSingleplayer: byId('hideSingleplayer').checked,
      hideMultiplayer: byId('hideMultiplayer').checked,
      hideRealms: byId('hideRealms').checked,
      fancyMenuConfigUrl: byId('fancyMenuConfigUrl').value.trim() || undefined,
      fancyMenuConfigSha256: byId('fancyMenuConfigSha256').value.trim() || undefined,
      fancyMenuAssetsUrl: byId('fancyMenuAssetsUrl').value.trim() || undefined,
      fancyMenuAssetsSha256: byId('fancyMenuAssetsSha256').value.trim() || undefined
    };

    setStatus('Generating lockfile JSON...');

    fetch('/v1/admin/lockfile/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        if (response.ok) {
          return response.json();
        }

        return readErrorText(response, 'Generate failed').then(function (text) {
          throw new Error(text);
        });
      })
      .then(function (json) {
        outputEl.value = JSON.stringify(json, null, 2);
        setStatus('Lockfile generated.');
      })
      .catch(function (error) {
        setStatus(error.message || 'Generate failed.');
      });
  }

  function downloadLockfile() {
    var value = outputEl.value.trim();

    if (!value) {
      setStatus('Generate JSON first.');
      return;
    }

    var blob = new Blob([value], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'profile.lock.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Downloaded profile.lock.json');
  }

  function copyOutput() {
    var value = outputEl.value.trim();

    if (!value) {
      setStatus('Generate JSON first.');
      return;
    }

    navigator.clipboard.writeText(value)
      .then(function () {
        setStatus('Copied JSON to clipboard.');
      })
      .catch(function () {
        setStatus('Clipboard copy failed.');
      });
  }

  function applyImportedLock(lock) {
    byId('profileId').value = lock.profileId || byId('profileId').value;
    byId('profileVersion').value = String(lock.version || byId('profileVersion').value || 1);
    byId('serverName').value = (lock.defaultServer && lock.defaultServer.name) || byId('serverName').value;
    byId('serverAddress').value = (lock.defaultServer && lock.defaultServer.address) || byId('serverAddress').value;
    byId('minecraftVersion').value = lock.minecraftVersion || byId('minecraftVersion').value;
    byId('loaderVersion').value = lock.loaderVersion || byId('loaderVersion').value;

    var fm = lock.fancyMenu || {};
    byId('includeFancyMenu').checked = !!fm.enabled;
    byId('playButtonLabel').value = fm.playButtonLabel || 'Play';
    byId('titleText').value = fm.titleText || '';
    byId('subtitleText').value = fm.subtitleText || '';
    byId('logoUrl').value = fm.logoUrl || '';
    byId('hideSingleplayer').checked = fm.hideSingleplayer !== false;
    byId('hideMultiplayer').checked = fm.hideMultiplayer !== false;
    byId('hideRealms').checked = fm.hideRealms !== false;
    byId('fancyMenuConfigUrl').value = fm.configUrl || '';
    byId('fancyMenuConfigSha256').value = fm.configSha256 || '';
    byId('fancyMenuAssetsUrl').value = fm.assetsUrl || '';
    byId('fancyMenuAssetsSha256').value = fm.assetsSha256 || '';

    var sourceMods = [];
    if (Array.isArray(lock.items)) {
      sourceMods = lock.items;
    } else if (Array.isArray(lock.mods)) {
      sourceMods = lock.mods;
    }

    state.mods = sourceMods
      .filter(function (entry) {
        if (!entry || typeof entry !== 'object') {
          return false;
        }

        if (!entry.kind) {
          return true;
        }

        return entry.kind === 'mod';
      })
      .map(function (entry) {
        var name = String(entry.name || entry.title || entry.projectId || 'Unnamed Mod');
        return {
          kind: 'mod',
          name: name,
          provider: entry.provider || (entry.projectId ? 'modrinth' : 'direct'),
          side: entry.side || 'client',
          projectId: entry.projectId || slugify(name),
          versionId: entry.versionId || 'imported',
          url: entry.url || '',
          sha256: entry.sha256 || ''
        };
      })
      .filter(function (entry) {
        return !!entry.url && !!entry.sha256;
      });

    renderMods();
    setStatus('Loaded settings from JSON (' + state.mods.length + ' mod(s)).');
  }

  function importFromPastedJson() {
    var value = outputEl.value.trim();
    if (!value) {
      setStatus('Paste lock JSON into the output box first.');
      return;
    }

    try {
      var parsed = JSON.parse(value);
      applyImportedLock(parsed);
    } catch (error) {
      setStatus('Invalid JSON in output box.');
    }
  }

  function importFromFile(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    file.text()
      .then(function (text) {
        var parsed = JSON.parse(text);
        outputEl.value = JSON.stringify(parsed, null, 2);
        applyImportedLock(parsed);
      })
      .catch(function () {
        setStatus('Failed to load JSON file.');
      })
      .finally(function () {
        importFileInput.value = '';
      });
  }

  byId('searchBtn').addEventListener('click', searchMods);
  byId('generateBtn').addEventListener('click', generateLockfile);
  byId('downloadBtn').addEventListener('click', downloadLockfile);
  byId('copyBtn').addEventListener('click', copyOutput);
  byId('importPasteBtn').addEventListener('click', importFromPastedJson);
  byId('importFileBtn').addEventListener('click', function () {
    importFileInput.click();
  });
  importFileInput.addEventListener('change', importFromFile);

  byId('searchQuery').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchMods();
    }
  });

  renderResults();
  renderMods();
})();`;
}
