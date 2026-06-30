<script lang="ts">
  import { goto } from '$app/navigation';
  import { API, setTokens } from '$lib/api/client';
  import { Shield, Eye, EyeOff, Mail, Lock, Loader2, LogIn, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-svelte';

  // ─── State ───
  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let error = $state('');
  let step: 'login' | '2fa' = $state('login');
  let tempToken = $state('');
  let code = $state('');
  let loading2fa = $state(false);
  let toast = $state<{ message: string; type: 'error' | 'success' } | null>(null);

  let toastTimer: ReturnType<typeof setTimeout>;

  // ─── Toast helper ───
  function showToast(message: string, type: 'error' | 'success' = 'error') {
    clearTimeout(toastTimer);
    toast = { message, type };
    toastTimer = setTimeout(() => {
      toast = null;
    }, 4000);
  }

  // ─── Cleanup on unmount ───
  $effect(() => {
    return () => clearTimeout(toastTimer);
  });

  // ─── Login handler ───
  async function handleLogin(e: Event) {
    e.preventDefault();
    error = '';

    if (!email.trim() || !password.trim()) {
      error = 'يرجى ملء جميع الحقول';
      showToast('يرجى ملء جميع الحقول', 'error');
      return;
    }

    loading = true;

    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.message || data.error || 'فشل تسجيل الدخول';
        error = msg;
        showToast(msg, 'error');
        return;
      }

      // Check if 2FA is required
      if (data.requires_2fa) {
        tempToken = data.temp_token;
        step = '2fa';
        showToast('يرجى إدخال رمز التحقق الثنائي', 'success');
        return;
      }

      // Check admin role
      if (data.user?.role !== 'ADMIN') {
        const msg = 'ليس لديك صلاحية الوصول إلى لوحة الإدارة';
        error = msg;
        showToast(msg, 'error');
        clearTokens();
        return;
      }

      // Store tokens and redirect
      setTokens(data.token, data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      showToast('تم تسجيل الدخول بنجاح', 'success');

      setTimeout(() => {
        goto('/dashboard');
      }, 500);
    } catch (err: any) {
      const msg = 'حدث خطأ في الاتصال بالخادم';
      error = msg;
      showToast(msg, 'error');
    } finally {
      loading = false;
    }
  }

  // ─── 2FA verification handler ───
  async function handleVerify2FA(e: Event) {
    e.preventDefault();
    error = '';

    if (!code.trim()) {
      error = 'يرجى إدخال رمز التحقق';
      showToast('يرجى إدخال رمز التحقق', 'error');
      return;
    }

    loading2fa = true;

    try {
      const res = await fetch(`${API}/api/v1/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_token: tempToken, code: code.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.message || data.error || 'رمز التحقق غير صحيح';
        error = msg;
        showToast(msg, 'error');
        return;
      }

      // Check admin role
      if (data.user?.role !== 'ADMIN') {
        const msg = 'ليس لديك صلاحية الوصول إلى لوحة الإدارة';
        error = msg;
        showToast(msg, 'error');
        clearTokens();
        return;
      }

      // Store tokens and redirect
      setTokens(data.token, data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      showToast('تم التحقق بنجاح', 'success');

      setTimeout(() => {
        goto('/dashboard');
      }, 500);
    } catch (err: any) {
      const msg = 'حدث خطأ في الاتصال بالخادم';
      error = msg;
      showToast(msg, 'error');
    } finally {
      loading2fa = false;
    }
  }

  function clearTokens() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  function backToLogin() {
    step = 'login';
    code = '';
    tempToken = '';
    error = '';
  }
</script>

<svelte:head>
  <title>تسجيل الدخول - لوحة الإدارة</title>
</svelte:head>

<div class="login-page">
  <!-- ─── Aurora Background Blobs ─── -->
  <div class="aurora-bg">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
    <div class="blob blob-4"></div>
  </div>

  <!-- ─── Toast ─── -->
  {#if toast}
    <div class="toast toast-{toast.type}">
      {#if toast.type === 'error'}
        <AlertCircle size={18} />
      {:else}
        <CheckCircle2 size={18} />
      {/if}
      <span>{toast.message}</span>
    </div>
  {/if}

  <!-- ─── Login Card ─── -->
  <div class="login-card panel-glow">
    <!-- Header -->
    <div class="card-header">
      <div class="icon-circle">
        {#if step === 'login'}
          <Shield size={28} class="icon-main" />
        {:else}
          <KeyRound size={28} class="icon-main" />
        {/if}
      </div>
      <h1 class="card-title">
        {#if step === 'login'}
          تسجيل الدخول
        {:else}
          التحقق الثنائي
        {/if}
      </h1>
      <p class="card-subtitle">
        {#if step === 'login'}
          لوحة تحكم المسؤول
        {:else}
          أدخل رمز التحقق من تطبيق المصادقة
        {/if}
      </p>
      {#if step === 'login'}
        <span class="pill-gold mt-3">
          <Shield size={12} />
          مسؤول النظام
        </span>
      {/if}
    </div>

    <div class="glass-divider"></div>

    <!-- Error Message -->
    {#if error}
      <div class="error-box">
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    {/if}

    <!-- Login Form -->
    {#if step === 'login'}
      <form onsubmit={handleLogin} class="form-body">
        <!-- Email -->
        <div class="field-group">
          <label for="email" class="field-label">
            <Mail size={14} />
            البريد الإلكتروني
          </label>
          <div class="input-wrapper">
            <Mail size={16} class="input-icon" />
            <input
              id="email"
              type="email"
              class="input-field input-has-icon"
              placeholder="admin@example.com"
              bind:value={email}
              autocomplete="email"
              dir="ltr"
              disabled={loading}
            />
          </div>
        </div>

        <!-- Password -->
        <div class="field-group">
          <label for="password" class="field-label">
            <Lock size={14} />
            كلمة المرور
          </label>
          <div class="input-wrapper">
            <Lock size={16} class="input-icon" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              class="input-field input-has-icon input-has-action"
              placeholder="أدخل كلمة المرور"
              bind:value={password}
              autocomplete="current-password"
              dir="ltr"
              disabled={loading}
            />
            <button
              type="button"
              class="toggle-password"
              onclick={() => showPassword = !showPassword}
              tabindex={-1}
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {#if showPassword}
                <EyeOff size={16} />
              {:else}
                <Eye size={16} />
              {/if}
            </button>
          </div>
        </div>

        <!-- Submit -->
        <button type="submit" class="btn-primary btn-full" disabled={loading}>
          {#if loading}
            <Loader2 size={18} class="animate-spin" />
            <span>جاري تسجيل الدخول...</span>
          {:else}
            <LogIn size={18} />
            <span>تسجيل الدخول</span>
          {/if}
        </button>
      </form>

    <!-- 2FA Form -->
    {:else}
      <form onsubmit={handleVerify2FA} class="form-body">
        <div class="twofa-info">
          <KeyRound size={20} class="text-accent-gold" />
          <span>تم إرسال رمز التحقق إلى تطبيق المصادقة الخاص بك</span>
        </div>

        <!-- Code Input -->
        <div class="field-group">
          <label for="code" class="field-label">
            <KeyRound size={14} />
            رمز التحقق
          </label>
          <div class="input-wrapper">
            <KeyRound size={16} class="input-icon" />
            <input
              id="code"
              type="text"
              class="input-field input-has-icon"
              placeholder="000000"
              bind:value={code}
              autocomplete="one-time-code"
              dir="ltr"
              maxlength={6}
              disabled={loading2fa}
            />
          </div>
        </div>

        <!-- Verify Button -->
        <button type="submit" class="btn-primary btn-full" disabled={loading2fa}>
          {#if loading2fa}
            <Loader2 size={18} class="animate-spin" />
            <span>جاري التحقق...</span>
          {:else}
            <Shield size={18} />
            <span>تحقق</span>
          {/if}
        </button>

        <!-- Back -->
        <button type="button" class="btn-back" onclick={backToLogin} disabled={loading2fa}>
          <span>العودة إلى تسجيل الدخول</span>
        </button>
      </form>
    {/if}

    <!-- Footer -->
    <div class="glass-divider"></div>
    <div class="card-footer">
      <span class="text-aurora font-bold text-xs tracking-wider">CRYPTO EXCHANGE</span>
      <span class="footer-dot"></span>
      <span class="text-xs" style="color: var(--text-quaternary);">لوحة الإدارة v1.0</span>
    </div>
  </div>
</div>

<style>
  /* ─── Page Container ─── */
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 2rem 1rem;
  }

  /* ─── Aurora Background ─── */
  .aurora-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.35;
  }

  .blob-1 {
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.5), transparent 70%);
    top: -15%;
    right: -10%;
    animation: blob-drift-1 18s ease-in-out infinite;
  }

  .blob-2 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(245, 181, 68, 0.4), transparent 70%);
    bottom: -10%;
    left: -5%;
    animation: blob-drift-2 22s ease-in-out infinite;
  }

  .blob-3 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(34, 211, 164, 0.35), transparent 70%);
    top: 40%;
    left: 30%;
    animation: blob-drift-3 20s ease-in-out infinite;
  }

  .blob-4 {
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.3), transparent 70%);
    bottom: 20%;
    right: 20%;
    animation: blob-drift-4 24s ease-in-out infinite;
  }

  @keyframes blob-drift-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-60px, 40px) scale(1.1); }
    66% { transform: translate(30px, -30px) scale(0.95); }
  }

  @keyframes blob-drift-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(50px, -50px) scale(1.05); }
    66% { transform: translate(-40px, 30px) scale(0.9); }
  }

  @keyframes blob-drift-3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-40px, -30px) scale(1.08); }
    66% { transform: translate(60px, 50px) scale(0.92); }
  }

  @keyframes blob-drift-4 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, 50px) scale(1.12); }
    66% { transform: translate(-50px, -40px) scale(0.88); }
  }

  /* ─── Toast ─── */
  .toast {
    position: fixed;
    top: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: 0.75rem;
    backdrop-filter: blur(16px);
    font-size: 0.875rem;
    font-weight: 500;
    animation: toast-in 0.3s ease-out;
    max-width: 90vw;
  }

  .toast-error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    box-shadow: 0 0 24px rgba(239, 68, 68, 0.15);
  }

  .toast-success {
    background: rgba(34, 211, 164, 0.15);
    border: 1px solid rgba(34, 211, 164, 0.3);
    color: #6ee7b7;
    box-shadow: 0 0 24px rgba(34, 211, 164, 0.15);
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ─── Login Card ─── */
  .login-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
    padding: 2.5rem 2rem 1.5rem;
    animation: card-appear 0.6s ease-out;
  }

  @keyframes card-appear {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ─── Header ─── */
  .card-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-bottom: 1.5rem;
  }

  .icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 181, 68, 0.1);
    border: 1px solid rgba(245, 181, 68, 0.2);
    box-shadow: 0 0 32px rgba(245, 181, 68, 0.1);
    margin-bottom: 1rem;
    animation: icon-pulse 3s ease-in-out infinite;
  }

  @keyframes icon-pulse {
    0%, 100% { box-shadow: 0 0 24px rgba(245, 181, 68, 0.1); }
    50% { box-shadow: 0 0 40px rgba(245, 181, 68, 0.2); }
  }

  .icon-main {
    color: #f5b544;
  }

  .card-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.375rem;
  }

  .card-subtitle {
    font-size: 0.875rem;
    color: var(--text-tertiary);
    margin: 0;
  }

  /* ─── Error Box ─── */
  .error-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    margin: 1rem 0 0;
    border-radius: 0.75rem;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    font-size: 0.8125rem;
    animation: shake 0.4s ease-in-out;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }

  /* ─── Form ─── */
  .form-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-top: 1.25rem;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-icon {
    position: absolute;
    right: 0.875rem;
    color: var(--text-quaternary);
    pointer-events: none;
    transition: color 0.2s;
    z-index: 1;
  }

  .input-wrapper:focus-within .input-icon {
    color: #f5b544;
  }

  .input-has-icon {
    padding-right: 2.5rem !important;
  }

  .input-has-action {
    padding-left: 2.5rem !important;
  }

  .toggle-password {
    position: absolute;
    left: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-quaternary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.375rem;
    transition: color 0.2s, background 0.2s;
    z-index: 1;
  }

  .toggle-password:hover {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.05);
  }

  /* ─── Buttons ─── */
  .btn-full {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    font-size: 0.9375rem;
    margin-top: 0.25rem;
  }

  .btn-full:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }

  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.625rem;
    background: none;
    border: none;
    color: var(--text-tertiary);
    font-size: 0.8125rem;
    cursor: pointer;
    border-radius: 0.75rem;
    transition: color 0.2s, background 0.2s;
    font-family: inherit;
  }

  .btn-back:hover {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.03);
  }

  .btn-back:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ─── 2FA Info ─── */
  .twofa-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: rgba(245, 181, 68, 0.06);
    border: 1px solid rgba(245, 181, 68, 0.12);
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }

  /* ─── Footer ─── */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding-top: 1rem;
  }

  .footer-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--text-quaternary);
  }

  /* ─── Spinner ─── */
  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ─── Responsive ─── */
  @media (max-width: 480px) {
    .login-card {
      padding: 2rem 1.25rem 1.25rem;
    }

    .card-title {
      font-size: 1.25rem;
    }

    .blob {
      filter: blur(80px);
      opacity: 0.25;
    }
  }
</style>
