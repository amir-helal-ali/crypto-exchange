<script lang="ts">
	import { login, verify2FA, setTokens, setStoredUser, isAuthenticated } from '$lib/api/client';
	import { goto } from '$app/navigation';
	import { addToast } from '$lib/stores/toast';
	import { Shield, Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let twoFACode = $state('');
	let tempToken = $state('');
	let show2FA = $state(false);
	let loading = $state(false);
	let showPassword = $state(false);

	async function handleLogin() {
		if (!email || !password) {
			addToast('warning', 'يرجى إدخال البريد الإلكتروني وكلمة المرور');
			return;
		}
		loading = true;
		try {
			const res = await login(email, password);
			if (res.success && res.data) {
				if (res.data.requires_2fa) {
					tempToken = res.data.token;
					show2FA = true;
					addToast('info', 'يرجى إدخال رمز التحقق الثنائي');
				} else {
					setTokens(res.data.token, res.data.refresh_token);
					setStoredUser(res.data.user);
					addToast('success', 'تم تسجيل الدخول بنجاح');
					goto('/dashboard');
				}
			} else {
				addToast('error', res.data?.token ? 'فشل تسجيل الدخول' : (res as any).error || 'بيانات الدخول غير صحيحة');
			}
		} catch {
			addToast('error', 'خطأ في الاتصال بالخادم');
		} finally {
			loading = false;
		}
	}

	async function handle2FA() {
		if (!twoFACode || twoFACode.length < 6) {
			addToast('warning', 'يرجى إدخال رمز التحقق الثنائي كاملاً');
			return;
		}
		loading = true;
		try {
			const res = await verify2FA(twoFACode, tempToken);
			if (res.success && res.data) {
				setTokens(res.data.token, res.data.refresh_token);
				setStoredUser(res.data.user);
				addToast('success', 'تم التحقق بنجاح');
				goto('/dashboard');
			} else {
				addToast('error', 'رمز التحقق غير صحيح');
			}
		} catch {
			addToast('error', 'خطأ في التحقق');
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (show2FA) handle2FA();
			else handleLogin();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen flex items-center justify-center p-4 relative">
	<!-- Aurora Background Blobs -->
	<div class="fixed inset-0 overflow-hidden pointer-events-none" style="z-index:0">
		<div class="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(245,181,68,0.3), transparent 70%); animation: aurora-drift 15s ease-in-out infinite;"></div>
		<div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15" style="background: radial-gradient(circle, rgba(168,85,247,0.3), transparent 70%); animation: aurora-drift 20s ease-in-out infinite reverse;"></div>
		<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(34,211,164,0.3), transparent 70%); animation: aurora-drift 18s ease-in-out infinite;"></div>
	</div>

	<!-- Login Card -->
	<div class="panel w-full max-w-md p-8 relative" style="z-index:1">
		<!-- Header -->
		<div class="text-center mb-8">
			<div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
				style="background: linear-gradient(135deg, rgba(245,181,68,0.2), rgba(168,85,247,0.2)); border: 1px solid rgba(245,181,68,0.15);">
				<Shield size={28} style="color: var(--gold)" />
			</div>
			<h1 class="text-2xl font-black text-aurora">NEXUS</h1>
			<p class="text-sm text-[var(--ink-muted)] mt-1">لوحة الإدارة</p>
		</div>

		{#if !show2FA}
			<!-- Login Form -->
			<div class="space-y-4">
				<div>
					<label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">البريد الإلكتروني</label>
					<div class="relative">
						<Mail size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
						<input
							type="email"
							class="input-field pr-10"
							placeholder="admin@example.com"
							bind:value={email}
						/>
					</div>
				</div>
				<div>
					<label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">كلمة المرور</label>
					<div class="relative">
						<Lock size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
						<input
							type={showPassword ? 'text' : 'password'}
							class="input-field pr-10 pl-10"
							placeholder="••••••••"
							bind:value={password}
						/>
						<button
							type="button"
							class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
							onclick={() => showPassword = !showPassword}
						>
							{#if showPassword}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
						</button>
					</div>
				</div>
				<button
					class="btn-primary w-full py-3"
					onclick={handleLogin}
					disabled={loading}
				>
					{#if loading}
						<Loader2 size={18} class="animate-spin" />
					{/if}
					تسجيل الدخول
				</button>
			</div>
		{:else}
			<!-- 2FA Form -->
			<div class="space-y-4">
				<div class="text-center mb-2">
					<div class="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3"
						style="background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.2);">
						<Shield size={22} style="color: var(--violet)" />
					</div>
					<p class="text-sm text-[var(--ink-secondary)]">أدخل رمز التحقق الثنائي</p>
				</div>
				<input
					type="text"
					class="input-field text-center text-xl tracking-[0.5em] font-mono"
					placeholder="000000"
					maxlength="6"
					bind:value={twoFACode}
				/>
				<button
					class="btn-primary w-full py-3"
					onclick={handle2FA}
					disabled={loading}
				>
					{#if loading}
						<Loader2 size={18} class="animate-spin" />
					{/if}
					تحقق
				</button>
				<button class="btn-ghost w-full text-sm" onclick={() => show2FA = false}>
					العودة لتسجيل الدخول
				</button>
			</div>
		{/if}

		<div class="mt-6 pt-4 glass-divider text-center">
			<p class="text-xs text-[var(--ink-faint)]">
				بيانات الدخول الافتراضية: admin@example.com / Admin@123456
			</p>
		</div>
	</div>
</div>

<style>
	@keyframes aurora-drift {
		0% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(30px, -20px) scale(1.05); }
		66% { transform: translate(-20px, 15px) scale(0.95); }
		100% { transform: translate(0, 0) scale(1); }
	}
</style>
