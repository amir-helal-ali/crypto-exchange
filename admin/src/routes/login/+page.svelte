<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { login, verify2FA, setTokens, setStoredUser } from '$lib/api/client';
	import { toast } from '$lib/stores/toast';
	import { ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let error = $state('');
	let requires2FA = $state(false);
	let tempToken = $state('');
	let twoFACode = $state('');

	async function handleLogin() {
		error = '';
		loading = true;

		try {
			const res = await login(email, password);

			if (res.success && res.data) {
				if (res.data.requires_2fa) {
					requires2FA = true;
					tempToken = res.data.token;
				} else if (res.data.user?.role === 'ADMIN') {
					setTokens(res.data.token, res.data.refresh_token);
					setStoredUser(res.data.user);
					toast.success('تم تسجيل الدخول بنجاح');
					goto('/dashboard');
				} else {
					error = 'ليس لديك صلاحية الوصول';
				}
			} else {
				error = res.data?.message || 'بيانات الدخول غير صحيحة';
			}
		} catch {
			error = 'حدث خطأ في الاتصال';
		} finally {
			loading = false;
		}
	}

	async function handle2FA() {
		error = '';
		loading = true;

		try {
			const res = await verify2FA(twoFACode, tempToken);
			if (res.success && res.data?.user?.role === 'ADMIN') {
				setTokens(res.data.token, res.data.refresh_token);
				setStoredUser(res.data.user);
				toast.success('تم التحقق بنجاح');
				goto('/dashboard');
			} else {
				error = 'رمز التحقق غير صحيح';
			}
		} catch {
			error = 'حدث خطأ في الاتصال';
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !loading) {
			if (requires2FA) handle2FA();
			else handleLogin();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen flex items-center justify-center relative overflow-hidden">
	<!-- Aurora Background Blobs -->
	<div class="absolute inset-0 pointer-events-none overflow-hidden">
		<div class="absolute w-[500px] h-[400px] rounded-full blur-[120px] bg-accent-gold/[0.07] top-[10%] right-[10%] animate-aurora-1"></div>
		<div class="absolute w-[400px] h-[400px] rounded-full blur-[100px] bg-accent-violet/[0.06] bottom-[10%] left-[15%] animate-aurora-2"></div>
		<div class="absolute w-[300px] h-[300px] rounded-full blur-[80px] bg-accent-mint/[0.04] top-[50%] left-[50%] animate-aurora-3"></div>
		<div class="absolute w-[250px] h-[250px] rounded-full blur-[80px] bg-accent-azure/[0.05] top-[5%] left-[60%] animate-aurora-4"></div>
	</div>

	<!-- Login Card -->
	<div class="relative z-10 w-full max-w-md mx-4">
		<div class="panel p-8 panel-glow">
			<!-- Logo -->
			<div class="flex flex-col items-center mb-8">
				<div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold/30 to-accent-violet/20 border border-accent-gold/20 flex items-center justify-center mb-4 shadow-lg">
					<ShieldCheck size={28} class="text-accent-gold" />
				</div>
				<h1 class="text-2xl font-extrabold text-aurora">NEXUS</h1>
				<p class="text-sm text-ink-muted mt-1">لوحة الإدارة</p>
			</div>

			{#if error}
				<div class="panel panel-rose px-4 py-3 mb-5 text-sm text-accent-rose text-center">
					{error}
				</div>
			{/if}

			{#if !requires2FA}
				<!-- Login Form -->
				<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="flex flex-col gap-5">
					<div>
						<label for="loginEmail" class="block text-sm font-medium text-ink-secondary mb-2">البريد الإلكتروني</label>
						<input
								id="loginEmail"
							type="email"
							bind:value={email}
							placeholder="admin@example.com"
							class="input-field"
							required
							dir="ltr"
						/>
					</div>
					<div>
						<label for="loginPassword" class="block text-sm font-medium text-ink-secondary mb-2">كلمة المرور</label>
						<div class="relative">
							<input
								type={showPassword ? 'text' : 'password'}
								id="loginPassword"
								bind:value={password}
								placeholder="••••••••"
								class="input-field pl-10"
								required
								dir="ltr"
							/>
							<button
								type="button"
								class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary transition-colors"
								onclick={() => (showPassword = !showPassword)}
							>
								{#if showPassword}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
							</button>
						</div>
					</div>
					<button type="submit" class="btn-primary w-full py-3" disabled={loading}>
						{#if loading}
							<Loader2 size={18} class="animate-spin" />
						{/if}
						تسجيل الدخول
					</button>
				</form>
			{:else}
				<!-- 2FA Form -->
				<form onsubmit={(e) => { e.preventDefault(); handle2FA(); }} class="flex flex-col gap-5">
					<div class="text-center mb-2">
						<p class="text-sm text-ink-secondary">أدخل رمز التحقق الثنائي</p>
					</div>
					<div>
						<input
							type="text"
							bind:value={twoFACode}
							placeholder="000000"
							class="input-field text-center text-2xl tracking-[0.5em] font-mono"
							maxlength="6"
							dir="ltr"
							
						/>
					</div>
					<button type="submit" class="btn-primary w-full py-3" disabled={loading || twoFACode.length < 6}>
						{#if loading}
							<Loader2 size={18} class="animate-spin" />
						{/if}
						تحقق
					</button>
					<button type="button" class="btn-ghost w-full" onclick={() => { requires2FA = false; tempToken = ''; }}>
						رجوع
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
