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
          <div class="ob-step-label">Bienvenida</div>
          <div class="ob-step-title">Tu espacio para gestionar el sistema</div>
          <div class="ob-step-desc" style="margin-top:10px">Atria te permite llevar un registro de quiénes forman tu sistema interno — sus perfiles, preferencias y roles — y gestionar el día a día: agenda, diario, finanzas, notas y mucho más.<br><br>Cada parte del sistema puede tener su propio acceso y configuración.</div>
          <div class="ob-storage-notice">
            <div class="ob-storage-icon">&#x26A0;&#xFE0F;</div>
            <div class="ob-storage-text"><strong>Si usas Atria solo en este dispositivo, tus datos se guardan aqu&#xED;.</strong> Si activas funciones online, Atria se encarga del sync y del backup online. Si quieres una copia externa manual, puedes exportarla desde Configuraci&#xF3;n.</div>
          </div>
          ${authOnly ? `<div class="ob-storage-notice" style="border-color:rgba(255,107,138,.25);background:rgba(255,107,138,.06)">
            <div class="ob-storage-icon">&#x26A0;&#xFE0F;</div>
            <div class="ob-storage-text"><strong>La sesi&#xF3;n online se ha cerrado.</strong> Para seguir, inicia sesi&#xF3;n o crea una cuenta online.</div>
          </div>` : ''}
        </div>
        <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:start">
          ${authOnly ? '' : `<button class="btn btn-primary" id="ob-next-0" style="align-self:flex-start">Crear perfil ahora &#x2192;</button>`}
          <button class="btn btn-ghost" id="ob-auth-toggle" type="button">Ya tengo cuenta online</button>
          ${hasOnlineSession ? `<button class="btn btn-danger" id="ob-auth-logout" type="button">Cerrar sesión</button>` : ''}
        </div>
        ${hasOnlineSession ? `<div style="font-size:11px;color:var(--text-3);margin-top:8px">Si ya has iniciado sesión, usa <strong>Cerrar sesión</strong> para salir y volver a esta pantalla de acceso.</div>` : ''}
        <div id="ob-auth-panel" style="display:none;border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;background:var(--bg-1);margin-top:14px">
          <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:12px">
            <button class="btn btn-primary" id="ob-auth-mode-login" type="button">Iniciar sesi&oacute;n</button>
            <button class="btn btn-ghost" id="ob-auth-mode-register" type="button">Crear cuenta</button>
          </div>
          <div style="font-size:12px;color:var(--text-2);margin-bottom:12px">Puedes entrar primero con tu cuenta online y crear o restaurar perfiles despu&eacute;s.</div>
          <div id="ob-auth-login-fields" style="display:flex;flex-direction:column;gap:10px">
            <input type="email" id="ob-auth-login-email" placeholder="correo@ejemplo.com" autocomplete="email">
            <input type="password" id="ob-auth-login-password" placeholder="Contrase&ntilde;a" autocomplete="current-password">
            <details style="margin-top:2px">
              <summary style="font-size:12px;color:var(--text-2);cursor:pointer">▸ Personalizar nombre del dispositivo</summary>
              <input type="text" id="ob-auth-login-device" value="${esc(getAutoDeviceName())}" maxlength="40" autocomplete="off" style="width:100%;margin-top:6px">
            </details>
            <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--text-2)">
              <input type="checkbox" id="ob-auth-login-remember" checked style="margin-top:2px">
              <span>Mantener sesi&oacute;n en este navegador. Si lo desactivas, Atria la cerrar&aacute; autom&aacute;ticamente al pasar 12 horas.</span>
            </label>
            <details style="margin-top:2px">
              <summary style="font-size:12px;color:var(--text-2);cursor:pointer">Olvid&eacute; mi contrase&ntilde;a</summary>
              <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                <button class="btn btn-ghost" id="ob-auth-reset-request" type="button">Enviar correo de recuperaci&oacute;n</button>
                <input type="text" id="ob-auth-reset-token" placeholder="C&oacute;digo de recuperaci&oacute;n" value="${esc(new URLSearchParams(location.search).get('resetToken') || '')}" autocomplete="one-time-code">
                <input type="password" id="ob-auth-reset-old-password" placeholder="Contrase&ntilde;a anterior (opcional)" autocomplete="current-password">
                <input type="password" id="ob-auth-reset-password" placeholder="Nueva contrase&ntilde;a (min. 8)" autocomplete="new-password">
                <div style="font-size:11px;color:var(--text-2);line-height:1.4">Si recuerdas la contrase&ntilde;a anterior, Atria puede conservar la clave del backup online antiguo. Sin ella, usa un dispositivo que todav&iacute;a tenga tus datos o importa un backup manual.</div>
                <button class="btn btn-primary" id="ob-auth-reset-confirm" type="button">Guardar nueva contrase&ntilde;a</button>
              </div>
            </details>
          </div>
          <div id="ob-auth-register-fields" style="display:none;flex-direction:column;gap:10px">
            <input type="email" id="ob-auth-register-email" placeholder="correo@ejemplo.com" autocomplete="email">
            <input type="password" id="ob-auth-register-password" placeholder="Contrase&ntilde;a (m&iacute;n. 8)" autocomplete="new-password">
            <input type="text" id="ob-auth-register-display" placeholder="Nombre de tu sistema" value="${esc(loadConfig().systemName || '')}" maxlength="40" autocomplete="off">
            <details style="margin-top:2px">
              <summary style="font-size:12px;color:var(--text-2);cursor:pointer">▸ Personalizar nombre del dispositivo</summary>
              <input type="text" id="ob-auth-register-device" value="${esc(getAutoDeviceName())}" maxlength="40" autocomplete="off" style="width:100%;margin-top:6px">
            </details>
            <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--text-2)">
              <input type="checkbox" id="ob-auth-register-remember" checked style="margin-top:2px">
              <span>Mantener sesi&oacute;n en este navegador. Si lo desactivas, Atria la cerrar&aacute; autom&aacute;ticamente al pasar 12 horas.</span>
            </label>
          </div>
          <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12px;color:var(--text-2)">
            <input type="checkbox" id="ob-auth-consent" style="margin-top:2px">
            <span>Entiendo que Atria usar&aacute; las funciones online para cuenta, amistades, chat, sync y backup cifrado gestionado por la app.</span>
          </label>
          <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:12px">
            <button class="btn btn-primary" id="ob-auth-submit" type="button">Iniciar sesi&oacute;n</button>
            <button class="btn btn-ghost" id="ob-auth-cancel" type="button">Cancelar</button>
          </div>
        </div>
      </div>

      <!-- STEP 1: Nombre + rol -->
      <div class="ob-step" id="ob-s1" style="${authOnly ? 'display:none' : ''}">
        <div>
          <div class="ob-step-label">Paso 1 de 3 &middot; Identidad</div>
          <div class="ob-step-title">&#xBF;C&#xF3;mo te llamas?</div>
          <div class="ob-step-desc" style="margin-top:6px">Empieza por la parte del sistema que est&#xE1; configurando la app ahora mismo.</div>
        </div>
        <div class="form-grid">
          <div class="form-row">
            <div class="form-label">Nombre <span style="color:var(--accent);font-weight:700" title="Requerido">*</span></div>
            <input type="text" id="ob-name" placeholder="Nombre..." autocomplete="off">
            <div id="ob-name-err" style="display:none;color:#e57373;font-size:12px;margin-top:4px"></div>
          </div>
          <div class="form-row two-col">
            <div class="form-row">
              <div class="form-label">Pronombres</div>
              <input type="text" id="ob-pronouns" placeholder="ella / él / elle…" value="" autocomplete="off">
            </div>
            <div class="form-row">
              <div class="form-label">Tipo <span style="font-weight:400;color:var(--text-2)">(opcional)</span></div>
              <select id="ob-roletype">
                <option value="otro">&#x25CE; No estoy segurx</option>
                ${getAllRoleTypes().filter(r=>r.id!=='otro').map(r=>`<option value="${r.id}">${r.emoji} ${r.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-label">Rol en el sistema <span style="font-weight:400;color:var(--text-2)">(opcional)</span></div>
            <input type="text" id="ob-role" placeholder="Ej: La que lleva el d&#xED;a a d&#xED;a, Co-anfitri&#xF3;n..." autocomplete="off">
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" id="ob-back-1">&#x2190; Atr&#xE1;s</button>
          <button class="btn btn-primary" id="ob-next-1">Siguiente &#x2192;</button>
        </div>
      </div>

      <!-- STEP 2: Apariencia -->
      <div class="ob-step" id="ob-s2" style="${authOnly ? 'display:none' : ''}">
        <div>
          <div class="ob-step-label">Paso 2 de 3 &middot; Apariencia</div>
          <div class="ob-step-title">&#xBF;C&#xF3;mo te representas?</div>
          <div class="ob-step-desc" style="margin-top:6px">Elige un emoji y un color. Puedes cambiarlo cuando quieras desde tu perfil.</div>
        </div>
        <div class="ob-preview" id="ob-preview-row">
          <div class="ob-avatar-big" id="ob-av-big" style="background:rgba(160,138,255,0.12);border-color:#a08aff">&#x1F319;</div>
          <div>
            <div id="ob-prev-name" style="font-size:18px;font-weight:800">Nombre</div>
            <div id="ob-prev-role" style="font-family:'DM Mono',monospace;font-size:11px;color:#a08aff;margin-top:3px">Rol</div>
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
          <button class="btn btn-ghost" id="ob-back-2">&#x2190; Atr&#xE1;s</button>
          <button class="btn btn-primary" id="ob-done">Crear perfil &#x2192;</button>
        </div>
      </div>

      <!-- STEP 3: Orientación -->
      <div class="ob-step" id="ob-s3" style="${authOnly ? 'display:none' : ''}">
        <div>
          <div class="ob-step-label">Paso 3 de 3 &middot; Ya casi</div>
          <div class="ob-step-title" id="ob-welcome-name">&#xA1;Listo!</div>
          <div class="ob-step-desc" style="margin-top:6px">Tu perfil est&#xE1; creado. Ahora elige si quieres usar Atria solo en este dispositivo o activar las funciones online desde el principio.</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="ob-tip">
            <div class="ob-tip-icon">&#x1F4D3;</div>
            <div><div class="ob-tip-title">Diario</div><div class="ob-tip-desc">Registra c&#xF3;mo fue el d&#xED;a, qui&#xE9;n estuvo presente y c&#xF3;mo te sentiste.</div></div>
          </div>
          <div class="ob-tip">
            <div class="ob-tip-icon">&#x1F465;</div>
            <div><div class="ob-tip-title">Perfiles del sistema</div><div class="ob-tip-desc">A&#xF1;ade el resto de partes del sistema con sus roles, permisos y caracter&#xED;sticas.</div></div>
          </div>
          <div class="ob-tip">
            <div class="ob-tip-icon">&#x2699;&#xFE0F;</div>
            <div><div class="ob-tip-title">Configuraci&#xF3;n</div><div class="ob-tip-desc">Si quieres una copia fuera de Atria, podr&#xE1;s exportarla cuando quieras.</div></div>
          </div>
        </div>
        <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:start">
          <button class="btn btn-primary" id="ob-mode-local" type="button">Usar solo en este dispositivo</button>
          <button class="btn btn-ghost" id="ob-mode-online" type="button">Activar funciones online</button>
        </div>
        <div id="ob-online-panel" style="display:none;border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;background:var(--bg-1)">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px">Cuenta online</div>
          <div style="font-size:12px;color:var(--text-2);margin-bottom:12px">La cuenta online hace que Atria cargue tus datos, sincronice entre dispositivos y mantenga backup cifrado autom&aacute;ticamente.</div>
          <div class="form-grid">
            <div class="form-row">
              <div class="form-label">Correo</div>
              <input type="email" id="ob-online-email" placeholder="correo@ejemplo.com" autocomplete="email">
            </div>
            <div class="form-row">
              <div class="form-label">Contrase&ntilde;a</div>
              <input type="password" id="ob-online-password" placeholder="M&iacute;nimo 8 caracteres" autocomplete="new-password">
            </div>
            <div class="form-row">
              <div class="form-label">Nombre de tu sistema</div>
              <input type="text" id="ob-online-display" placeholder="Nombre de tu sistema" value="${esc(loadConfig().systemName || '')}" maxlength="40" autocomplete="off">
            </div>
          </div>
          <details style="margin-top:6px">
            <summary style="font-size:12px;color:var(--text-2);cursor:pointer">&#9658; Personalizar nombre del dispositivo</summary>
            <input type="text" id="ob-online-device" value="${esc(getAutoDeviceName())}" maxlength="40" autocomplete="off" style="width:100%;margin-top:6px">
          </details>
          <div style="font-size:12px;color:var(--text-2);margin-top:10px">Tu correo solo se usa para iniciar sesi&oacute;n. Tu c&oacute;digo ATRIA se genera autom&aacute;ticamente &mdash; lo encontrar&aacute;s en Configuraci&oacute;n &gt; Funciones online.</div>
          <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12px;color:var(--text-2)">
            <input type="checkbox" id="ob-online-remember" checked style="margin-top:2px">
            <span>Mantener sesión en este navegador. Si lo desactivas, Atria cerrará la sesión automáticamente al pasar 12 horas.</span>
          </label>
          <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12px;color:var(--text-2)">
            <input type="checkbox" id="ob-online-consent" style="margin-top:2px">
            <span>Quiero activar funciones online y entiendo que Atria usar&aacute; estas funciones para cuenta, amistades, chat, sync y backup cifrado autom&aacute;tico.</span>
          </label>
        </div>
        <button class="btn btn-primary" id="ob-enter" style="align-self:flex-start">Entrar al sistema &#x2192;</button>
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
    const name     = ob.querySelector('#ob-name')?.value || 'Nombre';
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
      nameErr.textContent = 'El nombre es obligatorio.';
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
    if (submitBtn) submitBtn.textContent = onboardingAuthMode === 'login' ? 'Iniciar sesi\u00f3n' : 'Crear cuenta';
  };
  ob.querySelector('#ob-auth-toggle')?.addEventListener('click', () => setOnboardingAuthMode('login'));
  ob.querySelector('#ob-auth-mode-login')?.addEventListener('click', () => setOnboardingAuthMode('login'));
  ob.querySelector('#ob-auth-mode-register')?.addEventListener('click', () => setOnboardingAuthMode('register'));
  ob.querySelector('#ob-auth-logout')?.addEventListener('click', () => {
    if (!confirm('¿Cerrar la sesión online de este navegador?')) return;
    disableOnlineAccountSession();
    if (typeof lockOnlineAccess === 'function') lockOnlineAccess();
    showToast('Sesión cerrada');
    ob.remove();
    window.AtriaOnboardingView.show({ authOnly: true });
  });
  ob.querySelector('#ob-auth-cancel')?.addEventListener('click', () => {
    const panel = ob.querySelector('#ob-auth-panel');
    if (panel) panel.style.display = 'none';
  });
  ob.querySelector('#ob-auth-reset-request')?.addEventListener('click', async () => {
    const email = (ob.querySelector('#ob-auth-login-email')?.value || '').trim().toLowerCase();
    if (!isValidEmail(email)) return showToast('Escribe primero el correo de tu cuenta');
    const btn = ob.querySelector('#ob-auth-reset-request');
    if (btn) btn.disabled = true;
    try {
      await requestOnlinePasswordReset({ email });
      showToast('Si ese correo existe, Atria envi\u00f3 un c\u00f3digo de recuperaci\u00f3n');
    } catch (e) {
      showToast(e?.message || 'No se pudo enviar el correo de recuperaci\u00f3n');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  ob.querySelector('#ob-auth-reset-confirm')?.addEventListener('click', async () => {
    const token = (ob.querySelector('#ob-auth-reset-token')?.value || '').trim();
    const password = (ob.querySelector('#ob-auth-reset-password')?.value || '').trim();
    const oldPassword = (ob.querySelector('#ob-auth-reset-old-password')?.value || '').trim();
    if (!token) return showToast('Escribe el c\u00f3digo de recuperaci\u00f3n');
    if (password.length < 8) return showToast('La contrase\u00f1a debe tener al menos 8 caracteres');
    const btn = ob.querySelector('#ob-auth-reset-confirm');
    if (btn) btn.disabled = true;
    try {
      const result = await confirmOnlinePasswordReset({ token, password, oldPassword });
      ob.querySelector('#ob-auth-login-password').value = password;
      showToast(result?.preservedOldBackupKey ? 'Contrase\u00f1a actualizada. Clave del backup antiguo conservada.' : 'Contrase\u00f1a actualizada. Inicia sesi\u00f3n y restaura desde un dispositivo con datos si hace falta.');
    } catch (e) {
      showToast(e?.message || 'No se pudo actualizar la contrase\u00f1a');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  ob.querySelector('#ob-auth-submit')?.addEventListener('click', async () => {
    const consent = !!ob.querySelector('#ob-auth-consent')?.checked;
    if (!consent) return showToast('⚠ Debes aceptar el uso de funciones online');
    const submitBtn = ob.querySelector('#ob-auth-submit');
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (onboardingAuthMode === 'register') {
        const email = (ob.querySelector('#ob-auth-register-email')?.value || '').trim().toLowerCase();
        const password = (ob.querySelector('#ob-auth-register-password')?.value || '').trim();
        const deviceName = (ob.querySelector('#ob-auth-register-device')?.value || '').trim() || getAutoDeviceName();
        const displayName = (ob.querySelector('#ob-auth-register-display')?.value || '').trim() || loadConfig().systemName || '';
        const rememberSession = ob.querySelector('#ob-auth-register-remember')?.checked !== false;
        if (!isValidEmail(email)) return showToast('⚠ Escribe un correo v\u00e1lido');
        if (password.length < 8) return showToast('⚠ La contrase\u00f1a debe tener al menos 8 caracteres');
        if (!displayName) return showToast('⚠ Escribe el nombre de tu sistema');
        await registerOnlineAccountRemote({
          email,
          password,
          deviceName,
          consentAt: new Date().toISOString(),
          displayName,
          rememberSession,
        });
        showToast('Cuenta online creada ✓');
      } else {
        const email = (ob.querySelector('#ob-auth-login-email')?.value || '').trim().toLowerCase();
        const password = (ob.querySelector('#ob-auth-login-password')?.value || '').trim();
        const deviceName = (ob.querySelector('#ob-auth-login-device')?.value || '').trim() || getAutoDeviceName();
        const rememberSession = ob.querySelector('#ob-auth-login-remember')?.checked !== false;
        if (!isValidEmail(email)) return showToast('⚠ Escribe un correo v\u00e1lido');
        if (password.length < 8) return showToast('⚠ Escribe tu contrase\u00f1a');
        const result = await loginOnlineAccountRemote({
          email,
          password,
          deviceName,
          consentAt: loadConfig().onlineConsentAt || new Date().toISOString(),
          rememberSession,
        });
        handleOnlineLoginHydrationResult(result);
        showToast(result?.restoreError ? `Sesión iniciada, pero no se restauraron los perfiles: ${result.restoreError}` : 'Sesi\u00f3n online iniciada ✓');
      }
      if (typeof unlockOnlineAccess === 'function') unlockOnlineAccess();
      ob.remove();
      renderLayer0();
    } catch (e) {
      showToast('⚠ ' + (e?.message || (onboardingAuthMode === 'register' ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesi\u00f3n')));
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
    if (welcomeEl) welcomeEl.textContent = '¡Hola, ' + name + '!';
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
      const rememberSession = ob.querySelector('#ob-online-remember')?.checked !== false;
      const consent = !!ob.querySelector('#ob-online-consent')?.checked;
      if (!consent) return showToast('⚠ Debes aceptar el uso de funciones online');
      if (!isValidEmail(email)) return showToast('⚠ Escribe un correo válido');
      if (password.length < 8) return showToast('⚠ La contraseña debe tener al menos 8 caracteres');
      if (!displayName) return showToast('⚠ Escribe el nombre de tu sistema');
      const enterBtn = ob.querySelector('#ob-enter');
      if (enterBtn) enterBtn.disabled = true;
      try {
        await registerOnlineAccountRemote({
          email,
          password,
          deviceName,
          consentAt: new Date().toISOString(),
          displayName,
          rememberSession,
        });
      } catch (e) {
        if (enterBtn) enterBtn.disabled = false;
        return showToast('⚠ ' + (e?.message || 'No se pudo crear la cuenta online'));
      }
      if (enterBtn) enterBtn.disabled = false;
    }
    ob.style.opacity='0';
    ob.style.transform='scale(0.97)';
    ob.style.transition='all 450ms ease';
    setTimeout(()=>{ ob.remove(); renderLayer0(); }, 450);
    showToast('¡Bienvenidx, ' + name + '! 🎉');
  });
}

// ═══════════════════════════════════════════════
