function showOnboarding(options = {}) {
  const ob = document.createElement('div');
  ob.id = 'onboarding';
  const emojis = EMOJI_DATA.map(d=>d.e);
  const colors = ALTER_COLORS;
  let selEmoji = '🌙', selColor = '#a08aff';
  let step = 0;
  let onboardingOnlineMode = 'local';
  const hasOnlineSession = !!loadOnlineSession();
  const authOnly = !!options.authOnly;
  const stepBlockDisplay = authOnly ? 'none' : 'flex';

  ob.innerHTML = `
    <div class="ob-wrap">
      <div class="ob-progress" style="${authOnly ? 'display:none' : ''}">
        ${[0,1,2,3].map(i=>`<div class="ob-dot ${i===0?'active':''}" data-s="${i}"></div>`).join('')}
      </div>

      <!-- STEP 0: Bienvenida -->
      <div class="ob-step active" id="ob-s0">
        <div>
          <div class="ob-step-label">Welcome</div>
          <div class="ob-step-title">Your space to manage the system</div>
          <div class="ob-step-desc" style="margin-top:10px">Atria lets you keep track of who makes up your internal system — their profiles, preferences and roles — and manage day-to-day life: agenda, journal, finances, notes and more.<br><br>Each part of the system can have its own access and settings.</div>
          <div class="ob-storage-notice">
            <div class="ob-storage-icon">&#x26A0;&#xFE0F;</div>
            <div class="ob-storage-text"><strong>If you use Atria only on this device, your data stays here.</strong> If you enable online features, Atria handles sync and online backup for you. If you want a manual copy outside Atria, you can export it from Settings.</div>
          </div>
          ${authOnly ? `<div class="ob-storage-notice" style="border-color:rgba(255,107,138,.25);background:rgba(255,107,138,.06)">
            <div class="ob-storage-icon">&#x26A0;&#xFE0F;</div>
            <div class="ob-storage-text"><strong>The online session has been closed.</strong> To continue, sign in or create an online account.</div>
          </div>` : ''}
        </div>
        <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:start">
          ${authOnly ? '' : `<button class="btn btn-primary" id="ob-next-0" style="align-self:flex-start">Create profile now &#x2192;</button>`}
          <button class="btn btn-ghost" id="ob-auth-toggle" type="button">I already have an online account</button>
          ${hasOnlineSession ? `<button class="btn btn-danger" id="ob-auth-logout" type="button">Log out</button>` : ''}
        </div>
        ${hasOnlineSession ? `<div style="font-size:11px;color:var(--text-3);margin-top:8px">If you're already signed in, use <strong>Log out</strong> to leave and return to this access screen.</div>` : ''}
        <div id="ob-auth-panel" style="display:none;border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;background:var(--bg-1);margin-top:14px">
          <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:12px">
            <button class="btn btn-primary" id="ob-auth-mode-login" type="button">Sign in</button>
            <button class="btn btn-ghost" id="ob-auth-mode-register" type="button">Create account</button>
          </div>
          <div style="font-size:12px;color:var(--text-2);margin-bottom:12px">You can sign in with your online account first, then create or restore profiles afterwards.</div>
          <div id="ob-auth-login-fields" style="display:flex;flex-direction:column;gap:10px">
            <input type="email" id="ob-auth-login-email" placeholder="email@example.com" autocomplete="email">
            <input type="password" id="ob-auth-login-password" placeholder="Password" autocomplete="current-password">
            <details style="margin-top:2px">
              <summary style="font-size:12px;color:var(--text-2);cursor:pointer">Customize device name</summary>
              <input type="text" id="ob-auth-login-device" value="${esc(getAutoDeviceName())}" maxlength="40" autocomplete="off" style="width:100%;margin-top:6px">
            </details>
            <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--text-2)">
              <input type="checkbox" id="ob-auth-login-remember" checked style="margin-top:2px">
              <span>Keep this browser signed in. If disabled, Atria will automatically sign out after 12 hours.</span>
            </label>
            <details style="margin-top:2px">
              <summary style="font-size:12px;color:var(--text-2);cursor:pointer">Forgot password?</summary>
              <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                <button class="btn btn-ghost" id="ob-auth-reset-request" type="button">Send reset email</button>
                <input type="text" id="ob-auth-reset-token" placeholder="Recovery code" value="${esc(new URLSearchParams(location.search).get('resetToken') || '')}" autocomplete="one-time-code">
                <input type="password" id="ob-auth-reset-old-password" placeholder="Previous password (optional)" autocomplete="current-password">
                <input type="password" id="ob-auth-reset-password" placeholder="New password (min. 8)" autocomplete="new-password">
                <div style="font-size:11px;color:var(--text-2);line-height:1.4">If you remember the previous password, Atria can keep the old online backup key. Without it, use a device that still has your Atria data or import a manual backup.</div>
                <button class="btn btn-primary" id="ob-auth-reset-confirm" type="button">Set new password</button>
              </div>
            </details>
          </div>
          <div id="ob-auth-register-fields" style="display:none;flex-direction:column;gap:10px">
            <input type="email" id="ob-auth-register-email" placeholder="email@example.com" autocomplete="email">
            <input type="password" id="ob-auth-register-password" placeholder="Password (min. 8)" autocomplete="new-password">
            <input type="text" id="ob-auth-register-display" placeholder="Your system's name" value="${esc(loadConfig().systemName || '')}" maxlength="40" autocomplete="off">
            <details style="margin-top:2px">
              <summary style="font-size:12px;color:var(--text-2);cursor:pointer">Customize device name</summary>
              <input type="text" id="ob-auth-register-device" value="${esc(getAutoDeviceName())}" maxlength="40" autocomplete="off" style="width:100%;margin-top:6px">
            </details>
            <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--text-2)">
              <input type="checkbox" id="ob-auth-register-remember" checked style="margin-top:2px">
              <span>Keep this browser signed in. If disabled, Atria will automatically sign out after 12 hours.</span>
            </label>
          </div>
          <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12px;color:var(--text-2)">
            <input type="checkbox" id="ob-auth-consent" style="margin-top:2px">
            <span>I understand Atria will use online features for account, friends, chat, sync, and app-managed encrypted backup.</span>
          </label>
          <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:12px">
            <button class="btn btn-primary" id="ob-auth-submit" type="button">Sign in</button>
            <button class="btn btn-ghost" id="ob-auth-cancel" type="button">Cancel</button>
          </div>
        </div>
      </div>

      <!-- STEP 1: Nombre + rol -->
      <div class="ob-step" id="ob-s1" style="${authOnly ? 'display:none' : ''}">
        <div>
          <div class="ob-step-label">Step 1 of 3 &middot; Identity</div>
          <div class="ob-step-title">What's your name?</div>
          <div class="ob-step-desc" style="margin-top:6px">Start with the part of the system that is setting up the app right now.</div>
        </div>
        <div class="form-grid">
          <div class="form-row">
            <div class="form-label">Name <span style="color:var(--accent);font-weight:700" title="Required">*</span></div>
            <input type="text" id="ob-name" placeholder="Name..." autocomplete="off">
            <div id="ob-name-err" style="display:none;color:#e57373;font-size:12px;margin-top:4px"></div>
          </div>
          <div class="form-row two-col">
            <div class="form-row">
              <div class="form-label">Pronouns</div>
              <input type="text" id="ob-pronouns" placeholder="she/her · he/him · they/them…" value="" autocomplete="off">
            </div>
            <div class="form-row">
              <div class="form-label">Type <span style="font-weight:400;color:var(--text-2)">(optional)</span></div>
              <select id="ob-roletype">
                <option value="otro">&#x25CE; Not sure yet</option>
                ${ROLE_TYPES.filter(r=>r.id!=='otro').map(r=>`<option value="${r.id}">${r.emoji} ${r.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-label">Role in the system <span style="font-weight:400;color:var(--text-2)">(optional)</span></div>
            <input type="text" id="ob-role" placeholder="E.g. The one who handles day-to-day, Co-host..." autocomplete="off">
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" id="ob-back-1">&#x2190; Back</button>
          <button class="btn btn-primary" id="ob-next-1">Next &#x2192;</button>
        </div>
      </div>

      <!-- STEP 2: Apariencia -->
      <div class="ob-step" id="ob-s2" style="${authOnly ? 'display:none' : ''}">
        <div>
          <div class="ob-step-label">Step 2 of 3 &middot; Appearance</div>
          <div class="ob-step-title">How do you represent yourself?</div>
          <div class="ob-step-desc" style="margin-top:6px">Choose an emoji and a color. You can change it anytime from your profile.</div>
        </div>
        <div class="ob-preview" id="ob-preview-row">
          <div class="ob-avatar-big" id="ob-av-big" style="background:rgba(160,138,255,0.12);border-color:#a08aff">&#x1F319;</div>
          <div>
            <div id="ob-prev-name" style="font-size:18px;font-weight:800">Name</div>
            <div id="ob-prev-role" style="font-family:'DM Mono',monospace;font-size:11px;color:#a08aff;margin-top:3px">Role</div>
            <div id="ob-prev-pronouns" style="font-size:12px;color:var(--text-2);margin-top:2px"></div>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-row">
            <div class="form-label">Emoji</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px" id="ob-emoji-grid">
              ${emojis.map(e=>`<div class="emoji-opt-btn ${e==='\uD83C\uDF19'?'selected':''}" data-e="${e}">${e}</div>`).join('')}
            </div>
          </div>
          <div class="form-row">
            <div class="form-label">Color</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px" id="ob-color-grid">
              ${colors.map((c,i)=>`<div class="color-swatch ${i===0?'selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" id="ob-back-2">&#x2190; Back</button>
          <button class="btn btn-primary" id="ob-done">Create profile &#x2192;</button>
        </div>
      </div>

      <!-- STEP 3: Orientación -->
      <div class="ob-step" id="ob-s3" style="${authOnly ? 'display:none' : ''}">
        <div>
          <div class="ob-step-label">Step 3 of 3 &middot; Almost there</div>
          <div class="ob-step-title" id="ob-welcome-name">All set!</div>
          <div class="ob-step-desc" style="margin-top:6px">Your profile is created. Now choose whether you want to use Atria only on this device or activate online features from the start.</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="ob-tip">
            <div class="ob-tip-icon">&#x1F4D3;</div>
            <div><div class="ob-tip-title">Journal</div><div class="ob-tip-desc">Record how the day went, who was present and how you felt.</div></div>
          </div>
          <div class="ob-tip">
            <div class="ob-tip-icon">&#x1F465;</div>
            <div><div class="ob-tip-title">System profiles</div><div class="ob-tip-desc">Add the rest of the system members with their roles, permissions and characteristics.</div></div>
          </div>
          <div class="ob-tip">
            <div class="ob-tip-icon">&#x2699;&#xFE0F;</div>
            <div><div class="ob-tip-title">Settings</div><div class="ob-tip-desc">If you want a copy outside Atria, you can export it anytime.</div></div>
          </div>
        </div>
        <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:start">
          <button class="btn btn-primary" id="ob-mode-local" type="button">Use only on this device</button>
          <button class="btn btn-ghost" id="ob-mode-online" type="button">Activate online features</button>
        </div>
        <div id="ob-online-panel" style="display:none;border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;background:var(--bg-1)">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px">Online account</div>
          <div style="font-size:12px;color:var(--text-2);margin-bottom:12px">The online account lets Atria load your data, sync across devices, and keep encrypted backup automatically.</div>
          <div class="form-grid">
            <div class="form-row">
              <div class="form-label">Email</div>
              <input type="email" id="ob-online-email" placeholder="email@example.com" autocomplete="email">
            </div>
            <div class="form-row">
              <div class="form-label">Password</div>
              <input type="password" id="ob-online-password" placeholder="Minimum 8 characters" autocomplete="new-password">
            </div>
            <div class="form-row">
              <div class="form-label">System name</div>
              <input type="text" id="ob-online-display" placeholder="Your system's name" value="${esc(loadConfig().systemName || '')}" maxlength="40" autocomplete="off">
            </div>
          </div>
          <details style="margin-top:6px">
            <summary style="font-size:12px;color:var(--text-2);cursor:pointer">&#9658; Customize device name</summary>
            <input type="text" id="ob-online-device" value="${esc(getAutoDeviceName())}" maxlength="40" autocomplete="off" style="width:100%;margin-top:6px">
          </details>
          <div style="font-size:12px;color:var(--text-2);margin-top:10px">Your email is for sign-in only. Your ATRIA friend code is generated automatically &mdash; you'll find it in Settings &gt; Online features.</div>
          <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12px;color:var(--text-2)">
            <input type="checkbox" id="ob-online-consent" style="margin-top:2px">
            <span>I want to activate online features and understand that Atria will use these features for account, friends, chat, sync and automatic encrypted backup.</span>
          </label>
        </div>
        <button class="btn btn-primary" id="ob-enter" style="align-self:flex-start">Enter the system &#x2192;</button>
      </div>

    </div>`;

  document.body.appendChild(ob);

  function setStep(n) {
    step = n;
    document.querySelectorAll('.ob-step').forEach((s,i)=>s.classList.toggle('active',i===n));
    document.querySelectorAll('.ob-dot').forEach((d,i)=>{
      d.classList.toggle('active',i===n);
      d.classList.toggle('done',i<n);
    });
  }

  function buildAndSaveAlter() {
    const name     = ob.querySelector('#ob-name').value.trim();
    const pronouns = ob.querySelector('#ob-pronouns').value;
    const roleType = ob.querySelector('#ob-roletype').value;
    const roleCustom = ob.querySelector('#ob-role').value.trim();
    const rt = getAllRoleTypes().find(r=>r.id===roleType);
    const role = roleCustom || rt?.label || roleType;
    const hex = selColor.replace('#','');
    const r2=parseInt(hex.substring(0,2),16),g2=parseInt(hex.substring(2,4),16),b2=parseInt(hex.substring(4,6),16);
    const bg=`rgba(${r2},${g2},${b2},0.12)`;
    const adminAlter = {
      id: uid(), name, pronouns, ageType:'adulto', roleType,
      role, description:'', emoji:selEmoji,
      color:selColor, bg, isAdmin:true,
      permissions:buildFullPermissions()
    };
    const normalizedAdminAlter = normalizeAlterPermissions(adminAlter);
    saveAlters([normalizedAdminAlter]);
    ALTERS = [normalizedAdminAlter];
    return name;
  }

  function updatePreview() {
    const name     = ob.querySelector('#ob-name')?.value || 'Name';
    const roleType = ob.querySelector('#ob-roletype')?.value || 'anfitrion';
    const roleCustom = ob.querySelector('#ob-role')?.value;
    const pronouns = ob.querySelector('#ob-pronouns')?.value || '';
    const rt = getAllRoleTypes().find(r=>r.id===roleType);
    const displayRole = roleCustom || rt?.label || roleType;
    const hex = selColor.replace('#','');
    const r=parseInt(hex.substring(0,2),16),g=parseInt(hex.substring(2,4),16),b=parseInt(hex.substring(4,6),16);
    const bg=`rgba(${r},${g},${b},0.12)`;
    ob.querySelector('#ob-av-big').textContent = selEmoji;
    ob.querySelector('#ob-av-big').style.cssText=`width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;border:2px solid ${selColor};background:${bg}`;
    ob.querySelector('#ob-prev-name').textContent = name;
    ob.querySelector('#ob-prev-role').textContent = displayRole;
    ob.querySelector('#ob-prev-role').style.color = selColor;
    ob.querySelector('#ob-prev-pronouns').textContent = pronouns;
  }

  // Nav
  ob.querySelector('#ob-next-0')?.addEventListener('click',()=>setStep(1));
  ob.querySelector('#ob-back-1').addEventListener('click',()=>setStep(0));
  ob.querySelector('#ob-next-1').addEventListener('click',()=>{
    const nameInput = ob.querySelector('#ob-name');
    const nameErr   = ob.querySelector('#ob-name-err');
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.style.borderColor = '#e57373';
      nameErr.textContent = 'Name is required.';
      nameErr.style.display = 'block';
      nameInput.focus();
      return;
    }
    nameInput.style.borderColor = '';
    nameErr.style.display = 'none';
    updatePreview();
    setStep(2);
  });
  // Clear inline error as user types
  ob.querySelector('#ob-name').addEventListener('input', () => {
    const nameInput = ob.querySelector('#ob-name');
    const nameErr   = ob.querySelector('#ob-name-err');
    if (nameInput.value.trim()) {
      nameInput.style.borderColor = '';
      nameErr.style.display = 'none';
    }
  });
  ob.querySelector('#ob-back-2').addEventListener('click',()=>setStep(1));
  const setOnboardingOnlineMode = mode => {
    onboardingOnlineMode = mode === 'online' ? 'online' : 'local';
    const onlineBtn = ob.querySelector('#ob-mode-online');
    const localBtn = ob.querySelector('#ob-mode-local');
    const panel = ob.querySelector('#ob-online-panel');
    if (panel) panel.style.display = onboardingOnlineMode === 'online' ? '' : 'none';
    if (onlineBtn) onlineBtn.className = onboardingOnlineMode === 'online' ? 'btn btn-primary' : 'btn btn-ghost';
    if (localBtn) localBtn.className = onboardingOnlineMode === 'local' ? 'btn btn-primary' : 'btn btn-ghost';
  };
  ob.querySelector('#ob-mode-local')?.addEventListener('click',()=>setOnboardingOnlineMode('local'));
  ob.querySelector('#ob-mode-online')?.addEventListener('click',()=>setOnboardingOnlineMode('online'));
  setOnboardingOnlineMode('local');
  let onboardingAuthMode = 'login';
  const setOnboardingAuthMode = mode => {
    onboardingAuthMode = mode === 'register' ? 'register' : 'login';
    const panel = ob.querySelector('#ob-auth-panel');
    const loginFields = ob.querySelector('#ob-auth-login-fields');
    const registerFields = ob.querySelector('#ob-auth-register-fields');
    const loginBtn = ob.querySelector('#ob-auth-mode-login');
    const registerBtn = ob.querySelector('#ob-auth-mode-register');
    const submitBtn = ob.querySelector('#ob-auth-submit');
    if (panel) panel.style.display = '';
    if (loginFields) loginFields.style.display = onboardingAuthMode === 'login' ? 'flex' : 'none';
    if (registerFields) registerFields.style.display = onboardingAuthMode === 'register' ? 'flex' : 'none';
    if (loginBtn) loginBtn.className = onboardingAuthMode === 'login' ? 'btn btn-primary' : 'btn btn-ghost';
    if (registerBtn) registerBtn.className = onboardingAuthMode === 'register' ? 'btn btn-primary' : 'btn btn-ghost';
    if (submitBtn) submitBtn.textContent = onboardingAuthMode === 'login' ? 'Sign in' : 'Create account';
  };
  ob.querySelector('#ob-auth-toggle')?.addEventListener('click', () => setOnboardingAuthMode('login'));
  ob.querySelector('#ob-auth-mode-login')?.addEventListener('click', () => setOnboardingAuthMode('login'));
  ob.querySelector('#ob-auth-mode-register')?.addEventListener('click', () => setOnboardingAuthMode('register'));
  ob.querySelector('#ob-auth-logout')?.addEventListener('click', () => {
    if (!confirm('Log out of this browser session?')) return;
    disableOnlineAccountSession();
    if (typeof lockOnlineAccess === 'function') lockOnlineAccess();
    showToast('Logged out');
    ob.remove();
    window.AtriaOnboardingView.show({ authOnly: true });
  });
  ob.querySelector('#ob-auth-cancel')?.addEventListener('click', () => {
    const panel = ob.querySelector('#ob-auth-panel');
    if (panel) panel.style.display = 'none';
  });
  ob.querySelector('#ob-auth-reset-request')?.addEventListener('click', async () => {
    const email = (ob.querySelector('#ob-auth-login-email')?.value || '').trim().toLowerCase();
    if (!isValidEmail(email)) return showToast('Enter your account email first');
    const btn = ob.querySelector('#ob-auth-reset-request');
    if (btn) btn.disabled = true;
    try {
      await requestOnlinePasswordReset({ email });
      showToast('If that email exists, Atria sent a recovery code');
    } catch (e) {
      showToast(e?.message || 'Could not send recovery email');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  ob.querySelector('#ob-auth-reset-confirm')?.addEventListener('click', async () => {
    const token = (ob.querySelector('#ob-auth-reset-token')?.value || '').trim();
    const password = (ob.querySelector('#ob-auth-reset-password')?.value || '').trim();
    const oldPassword = (ob.querySelector('#ob-auth-reset-old-password')?.value || '').trim();
    if (!token) return showToast('Enter the recovery code');
    if (password.length < 8) return showToast('Password must be at least 8 characters');
    const btn = ob.querySelector('#ob-auth-reset-confirm');
    if (btn) btn.disabled = true;
    try {
      const result = await confirmOnlinePasswordReset({ token, password, oldPassword });
      ob.querySelector('#ob-auth-login-password').value = password;
      showToast(result?.preservedOldBackupKey ? 'Password updated. Old backup key kept.' : 'Password updated. Sign in, then restore from a device with data if needed.');
    } catch (e) {
      showToast(e?.message || 'Could not update password');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  ob.querySelector('#ob-auth-submit')?.addEventListener('click', async () => {
    const consent = !!ob.querySelector('#ob-auth-consent')?.checked;
    if (!consent) return showToast('You must accept online features first');
    const submitBtn = ob.querySelector('#ob-auth-submit');
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (onboardingAuthMode === 'register') {
        const email = (ob.querySelector('#ob-auth-register-email')?.value || '').trim().toLowerCase();
        const password = (ob.querySelector('#ob-auth-register-password')?.value || '').trim();
        const deviceName = (ob.querySelector('#ob-auth-register-device')?.value || '').trim() || getAutoDeviceName();
        const displayName = (ob.querySelector('#ob-auth-register-display')?.value || '').trim() || loadConfig().systemName || '';
        const rememberSession = ob.querySelector('#ob-auth-register-remember')?.checked !== false;
        if (!isValidEmail(email)) return showToast('Enter a valid email');
        if (password.length < 8) return showToast('Password must be at least 8 characters');
        if (!displayName) return showToast('Enter your system name');
        await registerOnlineAccountRemote({
          email,
          password,
          deviceName,
          consentAt: new Date().toISOString(),
          displayName,
          rememberSession,
        });
        showToast('Online account created');
        if (typeof unlockOnlineAccess === 'function') unlockOnlineAccess();
      } else {
        const email = (ob.querySelector('#ob-auth-login-email')?.value || '').trim().toLowerCase();
        const password = (ob.querySelector('#ob-auth-login-password')?.value || '').trim();
        const deviceName = (ob.querySelector('#ob-auth-login-device')?.value || '').trim() || getAutoDeviceName();
        const rememberSession = ob.querySelector('#ob-auth-login-remember')?.checked !== false;
        if (!isValidEmail(email)) return showToast('Enter a valid email');
        if (password.length < 8) return showToast('Enter your password');
        const result = await loginOnlineAccountRemote({
          email,
          password,
          deviceName,
          consentAt: loadConfig().onlineConsentAt || new Date().toISOString(),
          rememberSession,
        });
      handleOnlineLoginHydrationResult(result);
      showToast(result?.restoreError ? `Signed in, but profiles were not restored: ${result.restoreError}` : 'Online session started');
        if (typeof unlockOnlineAccess === 'function') unlockOnlineAccess();
      }
      ob.style.opacity='0';
      ob.style.transform='scale(0.97)';
      ob.style.transition='all 450ms ease';
      setTimeout(()=>{ ob.remove(); renderLayer0(); }, 450);
    } catch (e) {
      showToast((e?.message || 'Could not sign in'));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Emoji
  ob.querySelectorAll('.emoji-opt-btn').forEach(btn=>btn.addEventListener('click',()=>{
    ob.querySelectorAll('.emoji-opt-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    selEmoji = btn.dataset.e;
    updatePreview();
  }));
  // Color
  ob.querySelectorAll('.color-swatch').forEach(sw=>sw.addEventListener('click',()=>{
    ob.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
    sw.classList.add('selected');
    selColor = sw.dataset.color;
    updatePreview();
  }));
  // Live name/role update
  ob.querySelector('#ob-name')?.addEventListener('input',updatePreview);
  ob.querySelector('#ob-pronouns')?.addEventListener('input',updatePreview);
  ob.querySelector('#ob-role')?.addEventListener('input',updatePreview);
  ob.querySelector('#ob-roletype')?.addEventListener('change',updatePreview);

  // STEP 2 -> STEP 3: guardar alter y mostrar orientación
  ob.querySelector('#ob-done').addEventListener('click',()=>{
    const name = buildAndSaveAlter();
    const welcomeEl = ob.querySelector('#ob-welcome-name');
    if (welcomeEl) welcomeEl.textContent = 'Hello, ' + name + '!';
    setStep(3);
  });

  // STEP 3 -> Entrar al sistema
  ob.querySelector('#ob-enter').addEventListener('click', async ()=>{
    const name = ALTERS[0]?.name || '';
    if (onboardingOnlineMode === 'online') {
      const email = (ob.querySelector('#ob-online-email')?.value || '').trim().toLowerCase();
      const password = (ob.querySelector('#ob-online-password')?.value || '').trim();
      const deviceName = (ob.querySelector('#ob-online-device')?.value || '').trim() || getAutoDeviceName();
      const displayName = (ob.querySelector('#ob-online-display')?.value || '').trim() || loadConfig().systemName || '';
      const consent = !!ob.querySelector('#ob-online-consent')?.checked;
      if (!consent) return showToast('⚠ You must accept online features first');
      if (!isValidEmail(email)) return showToast('⚠ Enter a valid email');
      if (password.length < 8) return showToast('⚠ Password must be at least 8 characters');
      if (!displayName) return showToast('⚠ Enter your system name');
      const enterBtn = ob.querySelector('#ob-enter');
      if (enterBtn) enterBtn.disabled = true;
      try {
        await registerOnlineAccountRemote({
          email,
          password,
          deviceName,
          consentAt: new Date().toISOString(),
          displayName,
        });
      } catch (e) {
        if (enterBtn) enterBtn.disabled = false;
        return showToast('⚠ ' + (e?.message || 'Could not create the online account'));
      }
      if (enterBtn) enterBtn.disabled = false;
    }
    ob.style.opacity='0';
    ob.style.transform='scale(0.97)';
    ob.style.transition='all 450ms ease';
    setTimeout(()=>{ ob.remove(); renderLayer0(); }, 450);
    showToast('Welcome, ' + name + '! 🎉');
  });
}

// ═══════════════════════════════════════════════
