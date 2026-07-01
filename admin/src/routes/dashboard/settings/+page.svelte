<script lang="ts">
        import { onMount } from 'svelte';
        import { authGet, authPut, authPost } from '$lib/api/client';
        import { addToast } from '$lib/stores/toast';
        import PageHeader from '$lib/components/PageHeader.svelte';
        import ErrorAlert from '$lib/components/ErrorAlert.svelte';
        import {
                Settings, Globe, Shield, Lock, ToggleLeft, MessageSquare,
                Save, RotateCw, Rocket, AlertTriangle, CheckCircle, Server, ExternalLink,
                Network, Cpu, Wifi
        } from 'lucide-svelte';
        import type { SystemSettings, PublicConfig } from '$lib/api/types';

        let settings = $state<SystemSettings | null>(null);
        let loading = $state(true);
        let saving = $state(false);
        let reloading = $state(false);
        let error = $state('');
        let activeTab = $state('domains');
        let applyResult = $state<any>(null);

        // Domain form fields
        let frontendDomain = $state('');
        let backendDomain = $state('');
        let adminDomain = $state('');
        let mainDomain = $state('');

        // Port form fields
        let nginxHttpPort = $state('80');
        let nginxHttpsPort = $state('443');
        let backendInternalPort = $state('3000');
        let frontendInternalPort = $state('3000');
        let adminInternalPort = $state('3000');
        let backendHostPort = $state('3000');
        let frontendHostPort = $state('3001');
        let adminHostPort = $state('3002');

        // SSL fields
        let sslEnabled = $state(false);
        let sslCertPath = $state('');
        let sslKeyPath = $state('');

        // Security fields
        let corsOrigins = $state('');

        // Feature fields
        let registrationOpen = $state(true);
        let maintenanceMode = $state(false);
        let maintenanceMessage = $state('');

        const tabs = [
                { id: 'domains', label: 'النطاقات', icon: Globe },
                { id: 'ports', label: 'المنافذ', icon: Network },
                { id: 'ssl', label: 'SSL', icon: Lock },
                { id: 'security', label: 'الأمان', icon: Shield },
                { id: 'features', label: 'الميزات', icon: ToggleLeft },
                { id: 'production', label: 'الإنتاج', icon: Rocket }
        ];

        onMount(() => loadSettings());

        async function loadSettings() {
                loading = true; error = '';
                const res = await authGet<SystemSettings>('/api/v1/admin/settings');
                if (res.success && res.data) {
                        settings = res.data;
                        // Populate form fields
                        frontendDomain = res.data.domains?.frontend_domain || '';
                        backendDomain = res.data.domains?.backend_domain || '';
                        adminDomain = res.data.domains?.admin_domain || '';
                        mainDomain = res.data.domains?.main_domain || '';
                        // Ports
                        nginxHttpPort = res.data.ports?.nginx_http_port || '80';
                        nginxHttpsPort = res.data.ports?.nginx_https_port || '443';
                        backendInternalPort = res.data.ports?.backend_internal_port || '3000';
                        frontendInternalPort = res.data.ports?.frontend_internal_port || '3000';
                        adminInternalPort = res.data.ports?.admin_internal_port || '3000';
                        backendHostPort = res.data.ports?.backend_host_port || '3000';
                        frontendHostPort = res.data.ports?.frontend_host_port || '3001';
                        adminHostPort = res.data.ports?.admin_host_port || '3002';
                        // SSL
                        sslEnabled = res.data.ssl?.ssl_enabled === 'true';
                        sslCertPath = res.data.ssl?.ssl_cert_path || '';
                        sslKeyPath = res.data.ssl?.ssl_key_path || '';
                        // Security
                        corsOrigins = res.data.security?.cors_extra_origins || '';
                        // Features
                        registrationOpen = res.data.features?.registration_open === 'true';
                        maintenanceMode = res.data.features?.maintenance_mode === 'true';
                        maintenanceMessage = res.data.features?.maintenance_message || '';
                } else { error = res.error || 'فشل تحميل الإعدادات'; }
                loading = false;
        }

        function isValidPort(value: string): boolean {
                const num = parseInt(value, 10);
                return !isNaN(num) && num > 0 && num <= 65535;
        }

        async function saveSettings() {
                // Validate ports before saving
                const portFields = [
                        { key: 'nginx_http_port', value: nginxHttpPort, label: 'منفذ HTTP' },
                        { key: 'nginx_https_port', value: nginxHttpsPort, label: 'منفذ HTTPS' },
                        { key: 'backend_internal_port', value: backendInternalPort, label: 'منفذ Backend الداخلي' },
                        { key: 'frontend_internal_port', value: frontendInternalPort, label: 'منفذ Frontend الداخلي' },
                        { key: 'admin_internal_port', value: adminInternalPort, label: 'منفذ Admin الداخلي' },
                        { key: 'backend_host_port', value: backendHostPort, label: 'منفذ الوصول Backend' },
                        { key: 'frontend_host_port', value: frontendHostPort, label: 'منفذ الوصول Frontend' },
                        { key: 'admin_host_port', value: adminHostPort, label: 'منفذ الوصول Admin' },
                ];
                for (const pf of portFields) {
                        if (!isValidPort(pf.value)) {
                                addToast('error', `${pf.label}: قيمة غير صالحة (${pf.value}). يجب أن تكون بين 1 و 65535`);
                                return;
                        }
                }

                saving = true;
                const body = {
                        settings: {
                                frontend_domain: frontendDomain,
                                backend_domain: backendDomain,
                                admin_domain: adminDomain,
                                main_domain: mainDomain,
                                nginx_http_port: nginxHttpPort,
                                nginx_https_port: nginxHttpsPort,
                                backend_internal_port: backendInternalPort,
                                frontend_internal_port: frontendInternalPort,
                                admin_internal_port: adminInternalPort,
                                backend_host_port: backendHostPort,
                                frontend_host_port: frontendHostPort,
                                admin_host_port: adminHostPort,
                                ssl_enabled: String(sslEnabled),
                                ssl_cert_path: sslCertPath,
                                ssl_key_path: sslKeyPath,
                                cors_extra_origins: corsOrigins,
                                registration_open: String(registrationOpen),
                                maintenance_mode: String(maintenanceMode),
                                maintenance_message: maintenanceMessage
                        }
                };
                const res = await authPut('/api/v1/admin/settings', body);
                if (res.success) {
                        addToast('success', 'تم حفظ الإعدادات بنجاح');
                } else {
                        addToast('error', res.error || 'فشل حفظ الإعدادات');
                }
                saving = false;
        }

        async function applyToProduction() {
                if (!confirm('هل تريد تطبيق التغييرات على بيئة التشغيل؟ سيتم إعادة تحميل إعدادات nginx والشهادات والمنافذ.')) return;
                reloading = true; applyResult = null;
                const res = await authPost('/api/v1/admin/nginx/reload', {});
                if (res.success) {
                        addToast('success', 'تم تطبيق التغييرات على بيئة التشغيل بنجاح');
                        applyResult = { success: true, message: 'تم إعادة تحميل nginx وتحديث الإعدادات. النطاقات والمنافذ والشهادات الجديدة تعمل الآن.' };
                        await loadSettings();
                } else {
                        addToast('error', res.error || 'فشل تطبيق التغييرات');
                        applyResult = { success: false, message: res.error || 'فشل إعادة تحميل nginx' };
                }
                reloading = false;
        }

        function getDomainUrl(domain: string): string {
                if (!domain) return '';
                if (domain.startsWith('http')) return domain;
                return `${sslEnabled ? 'https' : 'http'}://${domain}`;
        }

        // Port status helpers
        let hasPortChanges = $derived.by(() => {
                if (!settings) return false;
                return (
                        nginxHttpPort !== (settings.ports?.nginx_http_port || '80') ||
                        nginxHttpsPort !== (settings.ports?.nginx_https_port || '443') ||
                        backendInternalPort !== (settings.ports?.backend_internal_port || '3000') ||
                        frontendInternalPort !== (settings.ports?.frontend_internal_port || '3000') ||
                        adminInternalPort !== (settings.ports?.admin_internal_port || '3000') ||
                        backendHostPort !== (settings.ports?.backend_host_port || '3000') ||
                        frontendHostPort !== (settings.ports?.frontend_host_port || '3001') ||
                        adminHostPort !== (settings.ports?.admin_host_port || '3002')
                );
        });
</script>

<PageHeader title="إعدادات النظام" subtitle="التحكم الكامل في النطاقات والمنافذ والشهادات وميزات المنصة" />

{#if loading}
        <div class="panel p-4"><div class="skeleton h-96"></div></div>
{:else if error}
        <ErrorAlert message={error} onretry={loadSettings} />
{:else}
        <!-- Tabs -->
        <div class="flex gap-2 mb-6 overflow-x-auto scrollbar-none pb-2">
                {#each tabs as tab}
                        <button
                                class="tab-btn flex items-center gap-2 whitespace-nowrap {activeTab === tab.id ? 'tab-btn-active' : ''}"
                                onclick={() => activeTab = tab.id}
                        >
                                <tab.icon size={16} />
                                {tab.label}
                        </button>
                {/each}
        </div>

        <!-- Tab Content -->
        <div class="space-y-6">
                {#if activeTab === 'domains'}
                        <!-- Domains Section -->
                        <div class="panel p-6">
                                <div class="flex items-center gap-3 mb-6">
                                        <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(245,181,68,0.1);">
                                                <Globe size={20} style="color: var(--gold)" />
                                        </div>
                                        <div>
                                                <h3 class="text-sm font-bold">إدارة النطاقات</h3>
                                                <p class="text-xs text-[var(--ink-muted)]">تحكم في روابط الوصول للمنصة — التغييرات تُطبق بعد الحفظ ثم التفعيل</p>
                                        </div>
                                </div>

                                <div class="space-y-5">
                                        <div>
                                                <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                        النطاق الرئيسي
                                                        <span class="text-[var(--ink-faint)]">— يستخدم كمعرف أساسي للمنصة</span>
                                                </label>
                                                <div class="relative">
                                                        <input class="input-field pl-24" placeholder="example.com" bind:value={mainDomain} />
                                                        {#if mainDomain}
                                                                <a href={getDomainUrl(mainDomain)} target="_blank" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mint)] hover:text-[var(--gold)] transition-colors">
                                                                        <ExternalLink size={14} />
                                                                </a>
                                                        {/if}
                                                </div>
                                        </div>

                                        <div>
                                                <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                        نطاق الواجهة
                                                        <span class="text-[var(--ink-faint)]">— رابط وصول المستخدمين</span>
                                                </label>
                                                <div class="relative">
                                                        <input class="input-field pl-24" placeholder="app.example.com" bind:value={frontendDomain} />
                                                        {#if frontendDomain}
                                                                <a href={getDomainUrl(frontendDomain)} target="_blank" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mint)] hover:text-[var(--gold)] transition-colors">
                                                                        <ExternalLink size={14} />
                                                                </a>
                                                        {/if}
                                                </div>
                                        </div>

                                        <div>
                                                <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                        نطاق API
                                                        <span class="text-[var(--ink-faint)]">— رابط واجهة البرمجة</span>
                                                </label>
                                                <div class="relative">
                                                        <input class="input-field pl-24" placeholder="api.example.com" bind:value={backendDomain} />
                                                        {#if backendDomain}
                                                                <a href={getDomainUrl(backendDomain)} target="_blank" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mint)] hover:text-[var(--gold)] transition-colors">
                                                                        <ExternalLink size={14} />
                                                                </a>
                                                        {/if}
                                                </div>
                                        </div>

                                        <div>
                                                <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                        نطاق لوحة الإدارة
                                                        <span class="text-[var(--ink-faint)]">— رابط وصول المديرين</span>
                                                </label>
                                                <div class="relative">
                                                        <input class="input-field pl-24" placeholder="admin.example.com" bind:value={adminDomain} />
                                                        {#if adminDomain}
                                                                <a href={getDomainUrl(adminDomain)} target="_blank" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mint)] hover:text-[var(--gold)] transition-colors">
                                                                        <ExternalLink size={14} />
                                                                </a>
                                                        {/if}
                                                </div>
                                        </div>
                                </div>

                                <!-- Domain Info -->
                                <div class="mt-6 p-4 rounded-lg" style="background: rgba(245,181,68,0.05); border: 1px solid rgba(245,181,68,0.1);">
                                        <div class="flex items-start gap-3">
                                                <AlertTriangle size={16} class="text-[var(--gold)] flex-shrink-0 mt-0.5" />
                                                <div>
                                                        <p class="text-xs font-medium text-[var(--gold)] mb-1">ملاحظة مهمة</p>
                                                        <p class="text-xs text-[var(--ink-secondary)]">بعد تغيير النطاقات، يجب حفظ الإعدادات ثم الضغط على "تطبيق على الإنتاج" ليتم تحديث إعدادات nginx وشهادات SSL. تأكد من أن DNS يشير إلى الخادم قبل التطبيق.</p>
                                                </div>
                                        </div>
                                </div>
                        </div>

                {:else if activeTab === 'ports'}
                        <!-- Ports Section -->
                        <div class="space-y-5">
                                <!-- Nginx Ports -->
                                <div class="panel p-6">
                                        <div class="flex items-center gap-3 mb-6">
                                                <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(59,130,246,0.1);">
                                                        <Wifi size={20} style="color: var(--azure)" />
                                                </div>
                                                <div>
                                                        <h3 class="text-sm font-bold">منافذ Nginx</h3>
                                                        <p class="text-xs text-[var(--ink-muted)]">المنافذ التي يستمع عليها خادم Nginx — تُطبق فوراً عند التفعيل</p>
                                                </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-5">
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                                منفذ HTTP
                                                                <span class="text-[var(--ink-faint)]">— الاتصال العادي (الافتراضي: 80)</span>
                                                        </label>
                                                        <input
                                                                class="input-field"
                                                                type="number"
                                                                min="1"
                                                                max="65535"
                                                                placeholder="80"
                                                                bind:value={nginxHttpPort}
                                                        />
                                                </div>
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                                منفذ HTTPS
                                                                <span class="text-[var(--ink-faint)]">— الاتصال الآمن (الافتراضي: 443)</span>
                                                        </label>
                                                        <input
                                                                class="input-field"
                                                                type="number"
                                                                min="1"
                                                                max="65535"
                                                                placeholder="443"
                                                                bind:value={nginxHttpsPort}
                                                        />
                                                </div>
                                        </div>

                                        <div class="mt-4 p-3 rounded-lg" style="background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.1);">
                                                <div class="flex items-start gap-2">
                                                        <Wifi size={14} class="text-[var(--azure)] flex-shrink-0 mt-0.5" />
                                                        <p class="text-xs text-[var(--ink-secondary)]">تغيير منافذ Nginx يُطبق فوراً عند "تطبيق على الإنتاج" — يتم إعادة توليد إعدادات Nginx تلقائياً.</p>
                                                </div>
                                        </div>
                                </div>

                                <!-- Internal Service Ports -->
                                <div class="panel p-6">
                                        <div class="flex items-center gap-3 mb-6">
                                                <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(168,85,247,0.1);">
                                                        <Cpu size={20} style="color: var(--violet)" />
                                                </div>
                                                <div>
                                                        <h3 class="text-sm font-bold">منافذ الخدمات الداخلية</h3>
                                                        <p class="text-xs text-[var(--ink-muted)]">المنافذ التي تستمع عليها الخدمات داخل Docker — تُحدّث في إعدادات Nginx upstream</p>
                                                </div>
                                        </div>

                                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                                Backend (Go API)
                                                                <span class="text-[var(--ink-faint)]">— الافتراضي: 3000</span>
                                                        </label>
                                                        <input
                                                                class="input-field"
                                                                type="number"
                                                                min="1"
                                                                max="65535"
                                                                placeholder="3000"
                                                                bind:value={backendInternalPort}
                                                        />
                                                </div>
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                                Frontend (SvelteKit)
                                                                <span class="text-[var(--ink-faint)]">— الافتراضي: 3000</span>
                                                        </label>
                                                        <input
                                                                class="input-field"
                                                                type="number"
                                                                min="1"
                                                                max="65535"
                                                                placeholder="3000"
                                                                bind:value={frontendInternalPort}
                                                        />
                                                </div>
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                                Admin (SvelteKit)
                                                                <span class="text-[var(--ink-faint)]">— الافتراضي: 3000</span>
                                                        </label>
                                                        <input
                                                                class="input-field"
                                                                type="number"
                                                                min="1"
                                                                max="65535"
                                                                placeholder="3000"
                                                                bind:value={adminInternalPort}
                                                        />
                                                </div>
                                        </div>

                                        <div class="mt-4 p-3 rounded-lg" style="background: rgba(168,85,247,0.05); border: 1px solid rgba(168,85,247,0.1);">
                                                <div class="flex items-start gap-2">
                                                        <Cpu size={14} class="text-[var(--violet)] flex-shrink-0 mt-0.5" />
                                                        <p class="text-xs text-[var(--ink-secondary)]">هذه المنافذ تُستخدم داخل Docker. تغييرها يُحدّث إعدادات Nginx upstream تلقائياً. تأكد من أن الخدمة تستمع فعلاً على المنفذ الجديد.</p>
                                                </div>
                                        </div>
                                </div>

                                <!-- Host Access Ports -->
                                <div class="panel p-6">
                                        <div class="flex items-center gap-3 mb-6">
                                                <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(34,211,164,0.1);">
                                                        <Server size={20} style="color: var(--mint)" />
                                                </div>
                                                <div>
                                                        <h3 class="text-sm font-bold">منافذ الوصول الخارجية</h3>
                                                        <p class="text-xs text-[var(--ink-muted)]">المنافذ المعروضة على الجهاز المضيف — تحتاج إعادة تشغيل Docker لتطبيقها</p>
                                                </div>
                                        </div>

                                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                                Backend API
                                                                <span class="text-[var(--ink-faint)]">— الافتراضي: 3000</span>
                                                        </label>
                                                        <input
                                                                class="input-field"
                                                                type="number"
                                                                min="1"
                                                                max="65535"
                                                                placeholder="3000"
                                                                bind:value={backendHostPort}
                                                        />
                                                </div>
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                                Frontend واجهة
                                                                <span class="text-[var(--ink-faint)]">— الافتراضي: 3001</span>
                                                        </label>
                                                        <input
                                                                class="input-field"
                                                                type="number"
                                                                min="1"
                                                                max="65535"
                                                                placeholder="3001"
                                                                bind:value={frontendHostPort}
                                                        />
                                                </div>
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                                Admin لوحة الإدارة
                                                                <span class="text-[var(--ink-faint)]">— الافتراضي: 3002</span>
                                                        </label>
                                                        <input
                                                                class="input-field"
                                                                type="number"
                                                                min="1"
                                                                max="65535"
                                                                placeholder="3002"
                                                                bind:value={adminHostPort}
                                                        />
                                                </div>
                                        </div>

                                        <div class="mt-4 p-4 rounded-lg" style="background: rgba(251,113,133,0.05); border: 1px solid rgba(251,113,133,0.1);">
                                                <div class="flex items-start gap-3">
                                                        <AlertTriangle size={16} class="text-[var(--rose)] flex-shrink-0 mt-0.5" />
                                                        <div>
                                                                <p class="text-xs font-medium text-[var(--rose)] mb-1">تغيير المنافذ الخارجية يتطلب إعادة التشغيل</p>
                                                                <p class="text-xs text-[var(--ink-secondary)]">منافذ الوصول الخارجية مرتبطة بتعيينات Docker (port mapping). بعد الحفظ والتفعيل، يجب تشغيل: <code class="text-[var(--mint)] bg-[rgba(34,211,164,0.1)] px-1.5 py-0.5 rounded text-xs">docker compose up -d</code> ليتم تطبيق المنافذ الجديدة على مستوى المضيف.</p>
                                                        </div>
                                                </div>
                                        </div>
                                </div>

                                <!-- Port Summary -->
                                <div class="panel p-5">
                                        <h4 class="text-xs font-bold text-[var(--ink-muted)] mb-4">ملخص المنافذ الحالية</h4>
                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div class="p-3 rounded-lg text-center" style="background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.1);">
                                                        <Wifi size={16} class="text-[var(--azure)] mx-auto mb-1" />
                                                        <p class="text-[10px] text-[var(--ink-muted)]">HTTP</p>
                                                        <p class="text-lg font-bold">{nginxHttpPort}</p>
                                                </div>
                                                <div class="p-3 rounded-lg text-center" style="background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.1);">
                                                        <Lock size={16} class="text-[var(--azure)] mx-auto mb-1" />
                                                        <p class="text-[10px] text-[var(--ink-muted)]">HTTPS</p>
                                                        <p class="text-lg font-bold">{nginxHttpsPort}</p>
                                                </div>
                                                <div class="p-3 rounded-lg text-center" style="background: rgba(168,85,247,0.06); border: 1px solid rgba(168,85,247,0.1);">
                                                        <Cpu size={16} class="text-[var(--violet)] mx-auto mb-1" />
                                                        <p class="text-[10px] text-[var(--ink-muted)]">Backend</p>
                                                        <p class="text-lg font-bold">{backendHostPort}<span class="text-[10px] text-[var(--ink-muted)]">:{backendInternalPort}</span></p>
                                                </div>
                                                <div class="p-3 rounded-lg text-center" style="background: rgba(34,211,164,0.06); border: 1px solid rgba(34,211,164,0.1);">
                                                        <Globe size={16} class="text-[var(--mint)] mx-auto mb-1" />
                                                        <p class="text-[10px] text-[var(--ink-muted)]">Frontend / Admin</p>
                                                        <p class="text-lg font-bold">{frontendHostPort}<span class="text-[10px] text-[var(--ink-muted)]"> / {adminHostPort}</span></p>
                                                </div>
                                        </div>
                                </div>
                        </div>

                {:else if activeTab === 'ssl'}
                        <!-- SSL Section -->
                        <div class="panel p-6">
                                <div class="flex items-center gap-3 mb-6">
                                        <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(34,211,164,0.1);">
                                                <Lock size={20} style="color: var(--mint)" />
                                        </div>
                                        <div>
                                                <h3 class="text-sm font-bold">إعدادات SSL</h3>
                                                <p class="text-xs text-[var(--ink-muted)]">تفعيل شهادات الأمان وإدارة مسارات الشهادات</p>
                                        </div>
                                </div>

                                <div class="space-y-5">
                                        <div class="flex items-center justify-between p-4 rounded-lg" style="background: rgba(10,14,26,0.6);">
                                                <div>
                                                        <p class="text-sm font-medium">تفعيل SSL</p>
                                                        <p class="text-xs text-[var(--ink-muted)]">تفعيل HTTPS لجميع النطاقات</p>
                                                </div>
                                                <button
                                                        class="toggle-track {sslEnabled ? 'toggle-track-active' : ''}"
                                                        onclick={() => sslEnabled = !sslEnabled}
                                                >
                                                        <div class="toggle-thumb {sslEnabled ? 'toggle-thumb-active' : ''}"
                                                                style="right: {sslEnabled ? '2px' : 'calc(100% - 22px)'}; left: auto;">
                                                        </div>
                                                </button>
                                        </div>

                                        {#if sslEnabled}
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">مسار شهادة SSL</label>
                                                        <input class="input-field" placeholder="/etc/nginx/certs/cert.pem" bind:value={sslCertPath} />
                                                </div>
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">مسار مفتاح SSL</label>
                                                        <input class="input-field" placeholder="/etc/nginx/certs/key.pem" bind:value={sslKeyPath} />
                                                </div>
                                        {/if}
                                </div>

                                {#if sslEnabled}
                                        <div class="mt-6 p-4 rounded-lg" style="background: rgba(34,211,164,0.05); border: 1px solid rgba(34,211,164,0.1);">
                                                <div class="flex items-start gap-3">
                                                        <CheckCircle size={16} class="text-[var(--mint)] flex-shrink-0 mt-0.5" />
                                                        <div>
                                                                <p class="text-xs font-medium text-[var(--mint)] mb-1">SSL مفعّل</p>
                                                                <p class="text-xs text-[var(--ink-secondary)]">يمكنك توليد شهادة SSL من صفحة "شهادات SSL" أو تثبيت شهادة موجودة. تأكد من صحة المسارات قبل التطبيق.</p>
                                                        </div>
                                                </div>
                                        </div>
                                {/if}
                        </div>

                {:else if activeTab === 'security'}
                        <!-- Security Section -->
                        <div class="panel p-6">
                                <div class="flex items-center gap-3 mb-6">
                                        <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(168,85,247,0.1);">
                                                <Shield size={20} style="color: var(--violet)" />
                                        </div>
                                        <div>
                                                <h3 class="text-sm font-bold">إعدادات الأمان</h3>
                                                <p class="text-xs text-[var(--ink-muted)]">CORS وتحكم الوصول</p>
                                        </div>
                                </div>

                                <div class="space-y-5">
                                        <div>
                                                <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">
                                                        أصول CORS إضافية
                                                        <span class="text-[var(--ink-faint)]">— نطاقات مسموحة إضافية (مفصولة بفاصلة)</span>
                                                </label>
                                                <textarea
                                                        class="input-field"
                                                        rows="3"
                                                        placeholder="https://example.com, https://app.example.com"
                                                        bind:value={corsOrigins}
                                                ></textarea>
                                        </div>
                                </div>
                        </div>

                {:else if activeTab === 'features'}
                        <!-- Features Section -->
                        <div class="panel p-6">
                                <div class="flex items-center gap-3 mb-6">
                                        <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(59,130,246,0.1);">
                                                <ToggleLeft size={20} style="color: var(--azure)" />
                                        </div>
                                        <div>
                                                <h3 class="text-sm font-bold">ميزات المنصة</h3>
                                                <p class="text-xs text-[var(--ink-muted)]">تحكم في الميزات المتاحة للمستخدمين</p>
                                        </div>
                                </div>

                                <div class="space-y-4">
                                        <div class="flex items-center justify-between p-4 rounded-lg" style="background: rgba(10,14,26,0.6);">
                                                <div>
                                                        <p class="text-sm font-medium">فتح التسجيل</p>
                                                        <p class="text-xs text-[var(--ink-muted)]">السماح للمستخدمين الجدد بالتسجيل</p>
                                                </div>
                                                <button
                                                        class="toggle-track {registrationOpen ? 'toggle-track-active' : ''}"
                                                        onclick={() => registrationOpen = !registrationOpen}
                                                >
                                                        <div class="toggle-thumb {registrationOpen ? 'toggle-thumb-active' : ''}"
                                                                style="right: {registrationOpen ? '2px' : 'calc(100% - 22px)'}; left: auto;">
                                                        </div>
                                                </button>
                                        </div>

                                        <div class="flex items-center justify-between p-4 rounded-lg" style="background: rgba(10,14,26,0.6);">
                                                <div>
                                                        <p class="text-sm font-medium">وضع الصيانة</p>
                                                        <p class="text-xs text-[var(--ink-muted)]">إيقاف المنصة مؤقتاً مع عرض رسالة صيانة</p>
                                                </div>
                                                <button
                                                        class="toggle-track {maintenanceMode ? 'toggle-track-active' : ''}"
                                                        onclick={() => maintenanceMode = !maintenanceMode}
                                                >
                                                        <div class="toggle-thumb {maintenanceMode ? 'toggle-thumb-active' : ''}"
                                                                style="right: {maintenanceMode ? '2px' : 'calc(100% - 22px)'}; left: auto;">
                                                        </div>
                                                </button>
                                        </div>

                                        {#if maintenanceMode}
                                                <div>
                                                        <label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1.5">رسالة الصيانة</label>
                                                        <textarea
                                                                class="input-field"
                                                                rows="3"
                                                                placeholder="المنصة تحت الصيانة، سنعود قريباً..."
                                                                bind:value={maintenanceMessage}
                                                        ></textarea>
                                                </div>
                                        {/if}
                                </div>
                        </div>

                {:else if activeTab === 'production'}
                        <!-- Production Deployment Section -->
                        <div class="panel p-6">
                                <div class="flex items-center gap-3 mb-6">
                                        <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(245,181,68,0.1);">
                                                <Rocket size={20} style="color: var(--gold)" />
                                        </div>
                                        <div>
                                                <h3 class="text-sm font-bold">تطبيق على بيئة التشغيل</h3>
                                                <p class="text-xs text-[var(--ink-muted)]">تطبيق جميع التغييرات المحفوظة على الخادم الفعلي</p>
                                        </div>
                                </div>

                                <!-- Current Status -->
                                <div class="space-y-4 mb-6">
                                        <div class="p-4 rounded-lg" style="background: rgba(10,14,26,0.6);">
                                                <h4 class="text-xs font-bold text-[var(--ink-muted)] mb-3">النطاقات الحالية</h4>
                                                <div class="grid grid-cols-2 gap-3">
                                                        <div class="flex items-center gap-2">
                                                                <Globe size={14} class="text-[var(--gold)]" />
                                                                <span class="text-xs text-[var(--ink-muted)]">الرئيسي:</span>
                                                                <span class="text-sm font-medium">{mainDomain || '—'}</span>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                                <Globe size={14} class="text-[var(--mint)]" />
                                                                <span class="text-xs text-[var(--ink-muted)]">الواجهة:</span>
                                                                <span class="text-sm font-medium">{frontendDomain || '—'}</span>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                                <Globe size={14} class="text-[var(--azure)]" />
                                                                <span class="text-xs text-[var(--ink-muted)]">API:</span>
                                                                <span class="text-sm font-medium">{backendDomain || '—'}</span>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                                <Globe size={14} class="text-[var(--violet)]" />
                                                                <span class="text-xs text-[var(--ink-muted)]">الأدمن:</span>
                                                                <span class="text-sm font-medium">{adminDomain || '—'}</span>
                                                        </div>
                                                </div>
                                        </div>

                                        <div class="p-4 rounded-lg" style="background: rgba(10,14,26,0.6);">
                                                <h4 class="text-xs font-bold text-[var(--ink-muted)] mb-3">المنافذ الحالية</h4>
                                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        <div class="flex items-center gap-2">
                                                                <Wifi size={14} class="text-[var(--azure)]" />
                                                                <span class="text-xs text-[var(--ink-muted)]">HTTP:</span>
                                                                <span class="text-sm font-medium">{nginxHttpPort}</span>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                                <Lock size={14} class="text-[var(--azure)]" />
                                                                <span class="text-xs text-[var(--ink-muted)]">HTTPS:</span>
                                                                <span class="text-sm font-medium">{nginxHttpsPort}</span>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                                <Server size={14} class="text-[var(--violet)]" />
                                                                <span class="text-xs text-[var(--ink-muted)]">Backend:</span>
                                                                <span class="text-sm font-medium">{backendHostPort}:{backendInternalPort}</span>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                                <Cpu size={14} class="text-[var(--mint)]" />
                                                                <span class="text-xs text-[var(--ink-muted)]">Front/Admin:</span>
                                                                <span class="text-sm font-medium">{frontendHostPort}/{adminHostPort}</span>
                                                        </div>
                                                </div>
                                        </div>

                                        <div class="p-4 rounded-lg" style="background: rgba(10,14,26,0.6);">
                                                <h4 class="text-xs font-bold text-[var(--ink-muted)] mb-3">حالة SSL</h4>
                                                <div class="flex items-center gap-2">
                                                        <Lock size={14} style="color: {sslEnabled ? 'var(--mint)' : 'var(--ink-muted)'}" />
                                                        <span class="text-sm">{sslEnabled ? 'مفعّل — HTTPS' : 'معطّل — HTTP فقط'}</span>
                                                </div>
                                        </div>
                                </div>

                                <!-- Apply Button -->
                                <div class="p-5 rounded-xl text-center" style="background: linear-gradient(135deg, rgba(245,181,68,0.08), rgba(168,85,247,0.05)); border: 1px solid rgba(245,181,68,0.12);">
                                        <Rocket size={32} class="mx-auto mb-3" style="color: var(--gold)" />
                                        <h3 class="text-base font-bold mb-2">تطبيق التغييرات على الإنتاج</h3>
                                        <p class="text-xs text-[var(--ink-secondary)] mb-4">سيتم إعادة توليد إعدادات nginx وتحديث النطاقات والمنافذ وشهادات SSL</p>
                                        <button
                                                class="btn-primary text-sm px-8 py-3"
                                                onclick={applyToProduction}
                                                disabled={reloading}
                                        >
                                                {#if reloading}
                                                        <RotateCw size={16} class="animate-spin" />
                                                        جاري التطبيق...
                                                {:else}
                                                        <Rocket size={16} />
                                                        تطبيق على الإنتاج
                                                {/if}
                                        </button>
                                        <p class="text-[10px] text-[var(--ink-faint)] mt-3">ملاحظة: تغيير منافذ الوصول الخارجية يتطلب تشغيل docker compose up -d بعد التفعيل</p>
                                </div>

                                {#if applyResult}
                                        <div class="mt-4 p-4 rounded-lg {applyResult.success ? '' : 'panel-rose'}"
                                                style="background: {applyResult.success ? 'rgba(34,211,164,0.08)' : 'rgba(251,113,133,0.08)'}; border: 1px solid {applyResult.success ? 'rgba(34,211,164,0.15)' : 'rgba(251,113,133,0.15)'};">
                                                <div class="flex items-start gap-3">
                                                        {#if applyResult.success}
                                                                <CheckCircle size={18} style="color: var(--mint)" />
                                                        {:else}
                                                                <AlertTriangle size={18} style="color: var(--rose)" />
                                                        {/if}
                                                        <p class="text-sm">{applyResult.message}</p>
                                                </div>
                                        </div>
                                {/if}
                        </div>
                {/if}
        </div>

        <!-- Save Button (always visible) -->
        {#if activeTab !== 'production'}
                <div class="sticky bottom-4 mt-6 flex justify-end">
                        <button
                                class="btn-primary px-6 py-3 shadow-lg"
                                onclick={saveSettings}
                                disabled={saving}
                                style="box-shadow: 0 8px 32px rgba(245,181,68,0.2);"
                        >
                                {#if saving}
                                        <RotateCw size={16} class="animate-spin" />
                                {:else}
                                        <Save size={16} />
                                {/if}
                                حفظ الإعدادات
                        </button>
                </div>
        {/if}
{/if}
