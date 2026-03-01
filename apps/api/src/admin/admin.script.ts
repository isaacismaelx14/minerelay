export function renderLoginScript(): string {
  return `(function () {
  function byId(id) { return document.getElementById(id); }

  var passwordEl = byId('password');
  var loginBtn = byId('loginBtn');
  var statusEl = byId('loginStatus');

  function setStatus(message, cls) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  }

  function login() {
    var password = (passwordEl.value || '').trim();
    if (!password) {
      setStatus('Enter password first.', 'error');
      return;
    }

    setStatus('Signing in...');

    fetch('/v1/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: password })
    })
      .then(function (response) {
        if (response.ok) {
          return response.json();
        }

        return response.text().then(function () {
          throw new Error('Invalid password.');
        });
      })
      .then(function () {
        setStatus('Signed in.', 'ok');
        window.location.href = '/admin';
      })
      .catch(function (error) {
        setStatus(error.message || 'Login failed.', 'error');
      });
  }

  loginBtn.addEventListener('click', login);
  passwordEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      login();
    }
  });
})();`;
}

export function renderAdminScript(): string {
  return `(function () {
  var state = {
    bootstrap: null,
    searchResults: [],
    selectedMods: [],
    dependencyMap: {}
  };

  function byId(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function parseSemver(value) {
    var raw = String(value || '').trim();
    var match = raw.match(/^(\\d+)\\.(\\d+)\\.(\\d+)$/);
    if (!match) return { major: 1, minor: 0, patch: 0 };
    return {
      major: Number(match[1]) || 1,
      minor: Number(match[2]) || 0,
      patch: Number(match[3]) || 0
    };
  }

  function formatSemver(semver) {
    return semver.major + '.' + semver.minor + '.' + semver.patch;
  }

  function bumpSemver(current, bumpType) {
    if (bumpType === 'major') return { major: current.major + 1, minor: 0, patch: 0 };
    if (bumpType === 'minor') return { major: current.major, minor: current.minor + 1, patch: 0 };
    return { major: current.major, minor: current.minor, patch: current.patch + 1 };
  }

  function setStatus(id, message, cls) {
    var el = byId(id);
    if (!el) return;
    el.textContent = message;
    el.className = 'status' + (cls ? ' ' + cls : '');
  }

  function readError(response, fallback) {
    return response.text()
      .then(function (text) { return text || fallback; })
      .catch(function () { return fallback; });
  }

  function authFetch(url, options, retried) {
    var config = Object.assign({}, options || {});
    config.credentials = 'include';

    return fetch(url, config).then(function (response) {
      if (response.status !== 401 || retried) return response;

      return fetch('/v1/admin/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      }).then(function (refreshResponse) {
        if (!refreshResponse.ok) {
          window.location.href = '/admin/login';
          throw new Error('Session expired');
        }
        return authFetch(url, options, true);
      });
    });
  }

  function sameMods(left, right) {
    var a = Array.isArray(left) ? left.slice() : [];
    var b = Array.isArray(right) ? right.slice() : [];
    if (a.length !== b.length) return false;

    var normalize = function (entry) {
      return [
        entry.projectId || '',
        entry.versionId || '',
        entry.sha256 || '',
        entry.url || ''
      ].join('|');
    };

    a.sort(function (x, y) { return normalize(x).localeCompare(normalize(y)); });
    b.sort(function (x, y) { return normalize(x).localeCompare(normalize(y)); });
    return a.every(function (entry, index) { return normalize(entry) === normalize(b[index]); });
  }

  function predictBumpType() {
    if (!state.bootstrap || !state.bootstrap.latestProfile) return 'patch';
    var latest = state.bootstrap.latestProfile;
    var mc = (byId('minecraftVersion').value || '').trim();
    var loader = (byId('loaderVersion').value || '').trim();

    if ((latest.minecraftVersion || '').trim() !== mc || (latest.loaderVersion || '').trim() !== loader) {
      return 'major';
    }

    if (!sameMods(state.selectedMods, latest.mods || [])) {
      return 'minor';
    }

    return 'patch';
  }

  function updateRail() {
    var mc = (byId('minecraftVersion').value || '').trim() || '-';
    var loader = (byId('loaderVersion').value || '').trim() || '-';
    var currentRelease = (byId('currentReleaseVersion').value || '1.0.0').trim();
    var bumpType = predictBumpType();
    var nextRelease = formatSemver(bumpSemver(parseSemver(currentRelease), bumpType));

    byId('railMinecraft').textContent = 'MC: ' + mc;
    byId('railFabric').textContent = 'Fabric: ' + loader;
    byId('railVersion').textContent = 'Next release: ' + nextRelease + ' (' + bumpType + ')';
  }

  function fillLoaderOptions(loaders, latestStable) {
    var select = byId('loaderVersion');
    var current = (select.value || '').trim();
    var options = Array.isArray(loaders) ? loaders : [];

    select.innerHTML = options.map(function (entry) {
      var suffix = entry.stable ? ' (stable)' : '';
      if (latestStable && entry.version === latestStable) suffix = ' (latest stable)';
      return '<option value="' + escapeHtml(entry.version) + '">' + escapeHtml(entry.version + suffix) + '</option>';
    }).join('');

    if (!select.value && current) {
      var option = document.createElement('option');
      option.value = current;
      option.textContent = current + ' (manual)';
      select.appendChild(option);
      select.value = current;
    }

    if (!select.value && latestStable) select.value = latestStable;
    updateRail();
  }

  function loadFabricVersions() {
    var minecraftVersion = (byId('minecraftVersion').value || '').trim();
    if (!minecraftVersion) {
      setStatus('settingsStatus', 'Set Minecraft version first.', 'error');
      return Promise.resolve();
    }

    setStatus('settingsStatus', 'Loading Fabric versions...');
    return authFetch('/v1/admin/fabric/versions?minecraftVersion=' + encodeURIComponent(minecraftVersion))
      .then(function (response) {
        if (response.ok) return response.json();
        return readError(response, 'Failed loading Fabric versions.').then(function (text) { throw new Error(text); });
      })
      .then(function (payload) {
        fillLoaderOptions(payload.loaders || [], payload.latestStable || null);
        setStatus('settingsStatus', 'Fabric versions updated.', 'ok');
      })
      .catch(function (error) {
        setStatus('settingsStatus', error.message || 'Failed loading Fabric versions.', 'error');
      });
  }

  function renderSelectedMods() {
    var el = byId('selectedMods');
    if (!state.selectedMods.length) {
      el.innerHTML = '<p class="meta">No mods selected.</p>';
      updateRail();
      return;
    }

    el.innerHTML = state.selectedMods.map(function (mod) {
      return ''
        + '<div class="item">'
        + '  <div class="item-head">'
        + '    <span class="name">' + escapeHtml(mod.name) + '</span>'
        + '    <button class="btn btn-danger" data-remove="' + escapeHtml(mod.projectId) + '">Remove</button>'
        + '  </div>'
        + '  <div class="meta">Version: ' + escapeHtml(mod.versionId || '-') + '</div>'
        + '  <div class="meta">URL: ' + escapeHtml(mod.url || '-') + '</div>'
        + '</div>';
    }).join('');

    Array.prototype.forEach.call(el.querySelectorAll('button[data-remove]'), function (button) {
      button.addEventListener('click', function () {
        var projectId = button.getAttribute('data-remove');
        state.selectedMods = state.selectedMods.filter(function (entry) { return entry.projectId !== projectId; });
        renderSelectedMods();
        setStatus('modsStatus', 'Mod removed.', 'ok');
      });
    });

    updateRail();
  }

  function installMod(projectId) {
    var minecraftVersion = (byId('minecraftVersion').value || '').trim();
    if (!minecraftVersion) {
      setStatus('modsStatus', 'Set Minecraft version first.', 'error');
      return;
    }

    setStatus('modsStatus', 'Installing mod and required dependencies...');

    authFetch('/v1/admin/mods/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projectId,
        minecraftVersion: minecraftVersion,
        includeDependencies: true
      })
    })
      .then(function (response) {
        if (response.ok) return response.json();
        return readError(response, 'Install failed').then(function (text) { throw new Error(text); });
      })
      .then(function (payload) {
        var mods = Array.isArray(payload.mods) ? payload.mods : [];
        mods.forEach(function (mod) {
          var idx = state.selectedMods.findIndex(function (entry) { return entry.projectId === mod.projectId; });
          if (idx >= 0) state.selectedMods[idx] = mod;
          else state.selectedMods.push(mod);
        });
        renderSelectedMods();
        setStatus('modsStatus', 'Installed ' + mods.length + ' mod(s).', 'ok');
      })
      .catch(function (error) {
        setStatus('modsStatus', error.message || 'Install failed.', 'error');
      });
  }

  function renderSearchResults() {
    var el = byId('searchResults');
    if (!state.searchResults.length) {
      el.innerHTML = '<p class="meta">No results.</p>';
      return;
    }

    el.innerHTML = state.searchResults.map(function (result) {
      var dep = state.dependencyMap[result.projectId];
      var depLabel = dep && dep.requiresDependencies ? '<span class="flag">Requires dependencies</span>' : '';
      return ''
        + '<div class="item">'
        + '  <div class="item-head">'
        + '    <span class="name">' + escapeHtml(result.title || result.projectId) + '</span>'
        + '    <button class="btn btn-ghost" data-install="' + escapeHtml(result.projectId) + '">Install</button>'
        + '  </div>'
        + '  <div class="meta">' + escapeHtml(result.description || 'No description') + '</div>'
        + '  <div class="row"><span class="meta">Project: ' + escapeHtml(result.projectId) + '</span>' + depLabel + '</div>'
        + '</div>';
    }).join('');

    Array.prototype.forEach.call(el.querySelectorAll('button[data-install]'), function (button) {
      button.addEventListener('click', function () {
        var projectId = button.getAttribute('data-install');
        if (projectId) installMod(projectId);
      });
    });
  }

  function analyzeDependencies(results, minecraftVersion) {
    return Promise.all(results.map(function (result) {
      var url = '/v1/admin/mods/analyze?projectId=' + encodeURIComponent(result.projectId) + '&minecraftVersion=' + encodeURIComponent(minecraftVersion);
      return authFetch(url)
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (analysis) { if (analysis) state.dependencyMap[result.projectId] = analysis; })
        .catch(function () { return null; });
    }));
  }

  function searchMods() {
    var query = (byId('searchQuery').value || '').trim();
    var minecraftVersion = (byId('minecraftVersion').value || '').trim();
    if (!query) {
      setStatus('modsStatus', 'Type a mod name first.', 'error');
      return;
    }
    if (!minecraftVersion) {
      setStatus('modsStatus', 'Set Minecraft version first.', 'error');
      return;
    }

    setStatus('modsStatus', 'Searching mods...');
    authFetch('/v1/admin/mods/search?query=' + encodeURIComponent(query) + '&minecraftVersion=' + encodeURIComponent(minecraftVersion))
      .then(function (response) {
        if (response.ok) return response.json();
        return readError(response, 'Search failed').then(function (text) { throw new Error(text); });
      })
      .then(function (payload) {
        state.searchResults = Array.isArray(payload) ? payload : [];
        state.dependencyMap = {};
        renderSearchResults();
        return analyzeDependencies(state.searchResults, minecraftVersion);
      })
      .then(function () {
        renderSearchResults();
        setStatus('modsStatus', 'Search complete.', 'ok');
      })
      .catch(function (error) {
        setStatus('modsStatus', error.message || 'Search failed.', 'error');
      });
  }

  function collectFancyMenuPayload() {
    var mode = byId('fancyMenuMode').value === 'custom' ? 'custom' : 'simple';
    return {
      enabled: byId('fancyMenuEnabled').value === 'true',
      mode: mode,
      playButtonLabel: (byId('playButtonLabel').value || '').trim() || 'Play',
      hideSingleplayer: byId('hideSingleplayer').value === 'true',
      hideMultiplayer: byId('hideMultiplayer').value === 'true',
      hideRealms: byId('hideRealms').value === 'true',
      customLayoutUrl: mode === 'custom'
        ? (byId('fancyMenuCustomLayoutUrl').value || '').trim() || undefined
        : undefined,
      customLayoutSha256: mode === 'custom'
        ? (byId('fancyMenuCustomLayoutSha256').value || '').trim() || undefined
        : undefined
    };
  }

  function collectBrandingPayload() {
    return {
      logoUrl: (byId('brandingLogoUrl').value || '').trim() || undefined,
      backgroundUrl: (byId('brandingBackgroundUrl').value || '').trim() || undefined,
      newsUrl: (byId('brandingNewsUrl').value || '').trim() || undefined
    };
  }

  function saveSettings() {
    var versionsRaw = (byId('supportedMinecraftVersions').value || '').trim();
    var versions = versionsRaw.split(',').map(function (value) { return value.trim(); }).filter(Boolean);

    authFetch('/v1/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supportedMinecraftVersions: versions,
        supportedPlatforms: ['fabric']
      })
    })
      .then(function (response) {
        if (response.ok) return response.json();
        return readError(response, 'Failed to save settings').then(function (text) { throw new Error(text); });
      })
      .then(function (payload) {
        byId('supportedMinecraftVersions').value = (payload.supportedMinecraftVersions || []).join(', ');
        setStatus('settingsStatus', 'Settings saved.', 'ok');
      })
      .catch(function (error) {
        setStatus('settingsStatus', error.message || 'Failed to save settings.', 'error');
      });
  }

  function saveDraft() {
    setStatus('draftStatus', 'Saving draft...');
    var payload = {
      profileId: (byId('profileId').value || '').trim() || undefined,
      serverName: (byId('serverName').value || '').trim(),
      serverAddress: (byId('serverAddress').value || '').trim(),
      fancyMenu: collectFancyMenuPayload(),
      branding: collectBrandingPayload()
    };

    authFetch('/v1/admin/draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        if (response.ok) return response.json();
        return readError(response, 'Failed to save draft').then(function (text) { throw new Error(text); });
      })
      .then(function (saved) {
        if (saved && saved.server) {
          byId('serverName').value = saved.server.name || byId('serverName').value;
          byId('serverAddress').value = saved.server.address || byId('serverAddress').value;
          byId('profileId').value = saved.server.profileId || byId('profileId').value;
        }
        if (saved && saved.releaseVersion) {
          byId('currentReleaseVersion').value = saved.releaseVersion;
        }
        setStatus('draftStatus', 'Draft saved.', 'ok');
        updateRail();
      })
      .catch(function (error) {
        setStatus('draftStatus', error.message || 'Failed to save draft.', 'error');
      });
  }

  function publishProfile() {
    var minecraftVersion = (byId('minecraftVersion').value || '').trim();
    var loaderVersion = (byId('loaderVersion').value || '').trim();

    if (!minecraftVersion || !loaderVersion) {
      setStatus('publishStatus', 'Select Minecraft and Fabric versions first.', 'error');
      return;
    }

    if (!state.selectedMods.length) {
      setStatus('publishStatus', 'Install at least one mod before publishing.', 'error');
      return;
    }

    setStatus('publishStatus', 'Publishing next release...');
    var payload = {
      profileId: (byId('profileId').value || '').trim(),
      serverName: (byId('serverName').value || '').trim(),
      serverAddress: (byId('serverAddress').value || '').trim(),
      minecraftVersion: minecraftVersion,
      loaderVersion: loaderVersion,
      mods: state.selectedMods,
      fancyMenu: collectFancyMenuPayload(),
      branding: collectBrandingPayload()
    };

    authFetch('/v1/admin/profile/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        if (response.ok) return response.json();
        return readError(response, 'Publish failed').then(function (text) { throw new Error(text); });
      })
      .then(function (published) {
        byId('currentVersion').value = String(published.version);
        byId('currentReleaseVersion').value = published.releaseVersion || byId('currentReleaseVersion').value;
        if (state.bootstrap && state.bootstrap.latestProfile) {
          state.bootstrap.latestProfile.mods = state.selectedMods.slice();
          state.bootstrap.latestProfile.minecraftVersion = minecraftVersion;
          state.bootstrap.latestProfile.loaderVersion = loaderVersion;
        }
        updateRail();
        setStatus(
          'publishStatus',
          'Published ' + (published.releaseVersion || ('v' + published.version)) + ' (' + (published.bumpType || 'patch') + ', +' + published.summary.add + ' / ~' + published.summary.update + ' / -' + published.summary.remove + ').',
          'ok'
        );
      })
      .catch(function (error) {
        setStatus('publishStatus', error.message || 'Publish failed.', 'error');
      });
  }

  function uploadImage(file, targetInputId, statusId) {
    if (!file) return Promise.resolve();
    var form = new FormData();
    form.append('file', file);
    setStatus(statusId, 'Uploading image...');

    return authFetch('/v1/admin/media/upload', { method: 'POST', body: form })
      .then(function (response) {
        if (response.ok) return response.json();
        return readError(response, 'Upload failed').then(function (text) { throw new Error(text); });
      })
      .then(function (uploaded) {
        var target = byId(targetInputId);
        if (target) target.value = uploaded.url || '';
        setStatus(statusId, 'Image uploaded.', 'ok');
      })
      .catch(function (error) {
        setStatus(statusId, error.message || 'Upload failed.', 'error');
      });
  }

  function uploadFancyMenuBundle(file, statusId) {
    if (!file) return Promise.resolve();
    var form = new FormData();
    form.append('file', file);
    setStatus(statusId, 'Uploading FancyMenu bundle...');

    return authFetch('/v1/admin/fancymenu/bundle/upload', { method: 'POST', body: form })
      .then(function (response) {
        if (response.ok) return response.json();
        return readError(response, 'Bundle upload failed').then(function (text) { throw new Error(text); });
      })
      .then(function (uploaded) {
        byId('fancyMenuMode').value = 'custom';
        byId('fancyMenuCustomLayoutUrl').value = uploaded.url || '';
        byId('fancyMenuCustomLayoutSha256').value = uploaded.sha256 || '';
        setStatus(
          statusId,
          'FancyMenu bundle uploaded (' + String(uploaded.entryCount || 0) + ' entries).',
          'ok'
        );
      })
      .catch(function (error) {
        setStatus(statusId, error.message || 'Bundle upload failed.', 'error');
      });
  }

  function attachUpload(buttonId, inputId, targetId, statusId) {
    var button = byId(buttonId);
    var input = byId(inputId);
    if (!button || !input) return;

    button.addEventListener('click', function () {
      input.value = '';
      input.click();
    });

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      uploadImage(file, targetId, statusId);
    });
  }

  function applyFancyMenu(fancyMenu) {
    var fm = fancyMenu || {};
    byId('fancyMenuEnabled').value = fm.enabled === false ? 'false' : 'true';
    byId('fancyMenuMode').value = fm.mode === 'custom' ? 'custom' : 'simple';
    byId('playButtonLabel').value = fm.playButtonLabel || 'Play';
    byId('hideSingleplayer').value = fm.hideSingleplayer === false ? 'false' : 'true';
    byId('hideMultiplayer').value = fm.hideMultiplayer === false ? 'false' : 'true';
    byId('hideRealms').value = fm.hideRealms === false ? 'false' : 'true';
    byId('fancyMenuCustomLayoutUrl').value = fm.customLayoutUrl || '';
    byId('fancyMenuCustomLayoutSha256').value = fm.customLayoutSha256 || '';
  }

  function applyBranding(branding) {
    var b = branding || {};
    byId('brandingLogoUrl').value = b.logoUrl || '';
    byId('brandingBackgroundUrl').value = b.backgroundUrl || '';
    byId('brandingNewsUrl').value = b.newsUrl || '';
  }

  function populateBootstrap(payload) {
    state.bootstrap = payload;

    byId('serverName').value = payload.server.name || '';
    byId('serverAddress').value = payload.server.address || '';
    byId('profileId').value = payload.server.profileId || '';
    byId('currentVersion').value = String(payload.latestProfile.version || 1);
    byId('currentReleaseVersion').value =
      payload.latestProfile.releaseVersion ||
      (payload.appSettings && payload.appSettings.releaseVersion) ||
      '1.0.0';
    byId('minecraftVersion').value = payload.latestProfile.minecraftVersion || '';

    var settingsVersions = (payload.appSettings && payload.appSettings.supportedMinecraftVersions) || [];
    byId('supportedMinecraftVersions').value = settingsVersions.join(', ');

    var draft = payload.draft || null;
    var fancyMenu = (draft && draft.fancyMenu) || payload.latestProfile.fancyMenu || {};
    var branding = (draft && draft.branding) || payload.latestProfile.branding || {};

    applyFancyMenu(fancyMenu);
    applyBranding(branding);

    state.selectedMods = Array.isArray(payload.latestProfile.mods) ? payload.latestProfile.mods : [];
    renderSelectedMods();
    updateRail();
  }

  function loadBootstrap() {
    setStatus('bootstrapStatus', 'Loading bootstrap...');

    return authFetch('/v1/admin/bootstrap')
      .then(function (response) {
        if (response.ok) return response.json();
        if (response.status === 401) {
          window.location.href = '/admin/login';
          throw new Error('Unauthorized');
        }
        return readError(response, 'Failed to load bootstrap').then(function (text) { throw new Error(text); });
      })
      .then(function (payload) {
        populateBootstrap(payload);
        setStatus('bootstrapStatus', 'Bootstrap loaded.', 'ok');
        byId('sessionInfo').textContent = 'active';
        return loadFabricVersions();
      })
      .catch(function (error) {
        setStatus('bootstrapStatus', error.message || 'Bootstrap failed.', 'error');
      });
  }

  function logout() {
    authFetch('/v1/admin/auth/logout', { method: 'POST' }).finally(function () {
      window.location.href = '/admin/login';
    });
  }

  byId('logoutBtn').addEventListener('click', logout);
  byId('searchBtn').addEventListener('click', searchMods);
  byId('searchQuery').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchMods();
    }
  });
  byId('saveSettingsBtn').addEventListener('click', saveSettings);
  byId('saveDraftBtn').addEventListener('click', saveDraft);
  byId('refreshLoadersBtn').addEventListener('click', loadFabricVersions);
  byId('publishBtn').addEventListener('click', publishProfile);

  byId('minecraftVersion').addEventListener('change', updateRail);
  byId('loaderVersion').addEventListener('change', updateRail);
  byId('fancyMenuEnabled').addEventListener('change', updateRail);
  byId('fancyMenuMode').addEventListener('change', updateRail);

  attachUpload('uploadBrandLogoBtn', 'brandLogoFile', 'brandingLogoUrl', 'draftStatus');
  attachUpload('uploadBrandBackgroundBtn', 'brandBackgroundFile', 'brandingBackgroundUrl', 'draftStatus');

  var bundleButton = byId('uploadFancyBundleBtn');
  var bundleInput = byId('fancyBundleFile');
  if (bundleButton && bundleInput) {
    bundleButton.addEventListener('click', function () {
      bundleInput.value = '';
      bundleInput.click();
    });

    bundleInput.addEventListener('change', function () {
      var file = bundleInput.files && bundleInput.files[0];
      uploadFancyMenuBundle(file, 'publishStatus');
    });
  }

  loadBootstrap();
})();`;
}
