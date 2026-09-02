/* P4/P5 external identity import. Local-only, preview-first and format tolerant. */
(function () {
  'use strict';

  const text = (v) => v == null ? '' : String(v).trim();
  const safe = (v) => text(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const first = (...values) => values.map(text).find(Boolean) || '';
  const array = (v) => Array.isArray(v) ? v : [];

  function sourceName(data) {
    const raw = JSON.stringify(data).toLowerCase();
    if (data?.aef_version || raw.includes('atria exchange format')) return 'Atria Exchange Format';
    if (raw.includes('pluralkit') || raw.includes('proxy_tags') || raw.includes('keep_proxy')) return 'PluralKit';
    if (raw.includes('octocon') || raw.includes('custom_fronting') || raw.includes('identity_type')) return 'Octocon';
    if (raw.includes('simplyplural') || raw.includes('simply plural') || data?.frontHistory || data?.customFields || data?.members?.some(m => m && (m._id || m.avatarUrl))) return 'Simply Plural';
    if (Array.isArray(data?.identities)) return 'Octocon';
    return 'External JSON';
  }

  function recordsFrom(data) {
    if (Array.isArray(data)) return data;
    const candidates = [
      data?.members, data?.identities, data?.alters, data?.profiles,
      data?.system?.members, data?.system?.identities, data?.system?.alters,
      data?.data?.members, data?.data?.identities, data?.data?.alters
    ];
    return candidates.find(Array.isArray) || [];
  }

  function normalizeRecord(raw, index, source) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const name = first(r.name, r.display_name, r.displayName, r.label, r.username) || `Imported profile ${index + 1}`;
    const pronouns = first(r.pronouns, r.pronoun, r.pronouns_text);
    const description = first(r.description, r.desc, r.bio, r.notes);
    const avatarUrl = first(r.avatar_url, r.avatarUrl, r.avatar, r.image, r.icon);
    const bannerUrl = first(r.banner, r.banner_url, r.bannerUrl, r.header);
    const color = first(r.color, r.color_hex, r.colorHex) || '#a08aff';
    const id = first(r.id, r.uuid, r.uid, r.member_id, r.memberId, r.slug) || `${source.toLowerCase().replace(/\s+/g, '-')}-${index + 1}`;
    const ageType = first(r.ageType, r.age_type, r.age, r.apparent_age) || 'adulto';
    const role = first(r.role, r.role_name, r.roleName, r.type, r.identity_type);
    const identityFlags = array(r.flags || r.identityFlags || r.tags || r.labels).map(text).filter(Boolean).slice(0, 20);
    const identityTerms = first(r.terms, r.identityTerms, r.preferred_terms, r.language, r.boundaries);
    return {
      externalId: id,
      importSource: source,
      name, pronouns, description, role,
      roleType: 'otro', ageType, color,
      identityFlags, identityTerms,
      referenceImageUrl: avatarUrl || null,
      referenceBannerUrl: bannerUrl || null,
      importedAt: Date.now(),
      rawImportMeta: {
        proxyTags: array(r.proxy_tags || r.proxyTags || r.tags),
        birthday: first(r.birthday, r.birthdate),
        private: !!(r.private || r.visibility === 'private')
      }
    };
  }

  function parse(data) {
    const source = sourceName(data);
    const records = recordsFrom(data).map((r, i) => normalizeRecord(r, i, source));
    const unique = [];
    const seen = new Set();
    records.forEach(r => {
      const key = `${r.externalId}|${r.name.toLowerCase()}`;
      if (!seen.has(key)) { seen.add(key); unique.push(r); }
    });
    return { source, records: unique };
  }

  function buildModal(parsed) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal" style="width:min(760px,96vw);max-height:90vh;overflow:auto">
      <div class="modal-title">Import external profiles</div>
      <div class="modal-subtitle">${safe(parsed.source)} · ${parsed.records.length} profiles found</div>
      <div style="font-size:12px;color:var(--text-2);margin:12px 0">Choose the profiles to import. Nothing is changed until you confirm.</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn btn-ghost btn-sm" id="ext-select-all">Select all</button>
        <label class="form-label" style="margin:0">If a matching profile exists:</label>
        <select class="form-input" id="ext-conflict" style="width:auto"><option value="skip">Skip</option><option value="duplicate">Create duplicate</option><option value="replace">Replace local profile</option></select>
      </div>
      <div id="ext-record-list" style="display:flex;flex-direction:column;gap:6px;max-height:45vh;overflow:auto">
        ${parsed.records.map((r, i) => `<label style="display:flex;gap:10px;align-items:flex-start;padding:9px 10px;background:var(--bg-2);border-radius:8px;cursor:pointer">
          <input type="checkbox" data-ext-index="${i}" checked style="margin-top:3px">
          <span style="font-size:20px">${safe(r.referenceImageUrl ? '▣' : '◎')}</span>
          <span style="flex:1;min-width:0"><strong>${safe(r.name)}</strong>${r.pronouns ? `<span style="color:var(--text-2)"> · ${safe(r.pronouns)}</span>` : ''}${r.role ? `<div style="font-size:11px;color:var(--text-2)">${safe(r.role)}</div>` : ''}<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${safe(r.externalId)}</div></span>
        </label>`).join('')}
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" id="ext-cancel">Cancel</button><button class="btn btn-primary" id="ext-confirm" ${parsed.records.length ? '' : 'disabled'}>Import selected</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#ext-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#ext-select-all').addEventListener('click', () => {
      const boxes = [...overlay.querySelectorAll('[data-ext-index]')];
      const all = boxes.every(b => b.checked); boxes.forEach(b => b.checked = !all);
    });
    overlay.querySelector('#ext-confirm').addEventListener('click', () => {
      const selected = [...overlay.querySelectorAll('[data-ext-index]:checked')].map(b => parsed.records[Number(b.dataset.extIndex)]);
      if (!selected.length) return;
      const conflict = overlay.querySelector('#ext-conflict').value;
      const local = typeof getAlters === 'function' ? getAlters(true) : [];
      const usedNames = new Set(local.map(a => text(a.name).toLowerCase()));
      let replaced = 0, added = 0, skipped = 0;
      selected.forEach(imported => {
        const same = local.find(a => (imported.externalId && a.externalId === imported.externalId) || text(a.name).toLowerCase() === imported.name.toLowerCase());
        if (same && conflict === 'skip') { skipped++; return; }
        if (same && conflict === 'replace') {
          Object.assign(same, imported, { id: same.id, createdAt: same.createdAt || Date.now(), bg: same.bg || 'rgba(160,138,255,.12)', permissions: same.permissions || {finanzas:true,emociones:true,diario:true,comunicacion:true} });
          replaced++; return;
        }
        let name = imported.name;
        if (usedNames.has(name.toLowerCase())) { let n = 2; while (usedNames.has(`${name} (${n})`.toLowerCase())) n++; name = `${name} (${n})`; }
        usedNames.add(name.toLowerCase());
        local.push({ ...imported, id: typeof uid === 'function' ? uid() : `import-${Date.now()}-${added}`, name, createdAt: Date.now(), bg: 'rgba(160,138,255,.12)', emoji: '◎', permissions: {finanzas:true,emociones:true,diario:true,comunicacion:true} });
        added++;
      });
      if (typeof saveAlters === 'function') saveAlters(local);
      if (typeof ALTERS !== 'undefined') window.ALTERS = local;
      close();
      if (typeof renderLayer0 === 'function') renderLayer0();
      if (typeof showToast === 'function') showToast(`Imported ${added} · replaced ${replaced} · skipped ${skipped} ✓`);
    });
  }

  function openExternalImport() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { try { const parsed = parse(JSON.parse(reader.result)); buildModal(parsed); } catch (e) { if (typeof showToast === 'function') showToast('Could not read external JSON: ' + e.message); } };
      reader.readAsText(file);
    });
    input.click();
  }

  window.atriaExternalImport = { parse, open: openExternalImport, preview: buildModal };
})();
