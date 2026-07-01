// ═══════════════════════════════════════════════════════════
// NEXUS ADMIN v6.0 — Type Definitions
// ═══════════════════════════════════════════════════════════

export interface AdminStats {
        totalUsers: number;
        totalOrders: number;
        totalTransactions: number;
        pendingWithdrawals: number;
        pendingDeposits: number;
        pendingKYC: number;
}

export interface AdminUser {
        id: number;
        email: string;
        username: string;
        role: 'USER' | 'ADMIN' | 'VERIFIED_USER';
        email_verified: boolean;
        two_fa_enabled: boolean;
        created_at: string;
        kyc_status?: string;
}

export interface UserStats {
        total: number;
        admins: number;
        emailVerified: number;
        kycVerified: number;
}

export interface KYCRequest {
        id: number;
        user_id: number;
        document_type: string;
        document_number: string;
        document_front: string;
        document_back?: string;
        selfie_image?: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED';
        rejection_reason?: string;
        created_at: string;
        reviewed_at?: string;
        user: AdminUser;
}

export interface KYCStats {
        pending: number;
        approved: number;
        rejected: number;
}

export interface AdminTransaction {
        id: number;
        user_id: number;
        username: string;
        email: string;
        type: 'DEPOSIT' | 'WITHDRAWAL';
        currency: string;
        amount: number;
        status: 'PENDING' | 'COMPLETED' | 'REJECTED';
        address?: string;
        tx_id?: string;
        createdAt: string;
}

export interface AuditLog {
        id: number;
        user_id: number;
        action: string;
        details: string;
        ipAddress: string;
        username: string;
        createdAt: string;
}

export interface AuditStats {
        authEvents: number;
        adminActions: number;
        tradeActions: number;
}

export interface Ad {
        id: number;
        title: string;
        link: string;
        image_url: string;
        button_text: string;
        button_link: string;
        position: 'hero' | 'section' | 'bottom' | 'floating';
        active: boolean;
        sort_order: number;
        created_at: string;
        updated_at: string;
}

export interface FeeSchedule {
        id: number;
        user_type: string;
        order_type: string;
        maker_fee: number;
        taker_fee: number;
        min_fee: number;
        created_at: string;
        updated_at: string;
}

export interface SystemSettings {
        domains: {
                frontend_domain: string;
                backend_domain: string;
                admin_domain: string;
                main_domain: string;
        };
        ports: {
                nginx_http_port: string;
                nginx_https_port: string;
                backend_internal_port: string;
                frontend_internal_port: string;
                admin_internal_port: string;
                backend_host_port: string;
                frontend_host_port: string;
                admin_host_port: string;
        };
        ssl: {
                ssl_enabled: string;
                ssl_cert_path: string;
                ssl_key_path: string;
        };
        security: {
                cors_extra_origins: string;
        };
        features: {
                registration_open: string;
                maintenance_mode: string;
                maintenance_message: string;
        };
}

export interface SSLStatus {
        enabled: boolean;
        type: string;
        issuer: string;
        cert_path: string;
        key_path: string;
        domains: string[];
        email: string;
        generated_at: string;
        exists: boolean;
        subject?: string;
        issuer_org?: string;
        not_before?: string;
        not_after?: string;
        expires_at?: string;
        days_remaining?: number;
        health: 'healthy' | 'warning' | 'critical' | 'expired';
        sans?: string[];
        key_algorithm?: string;
        signature_algorithm?: string;
        serial_number?: string;
        key_exists?: boolean;
        error?: string;
}

export interface MetricsData {
        ts: number;
        websocket: {
                market_clients: number;
                user_clients: number;
                online_users: number;
        };
        sse: {
                admin_subscribers: number;
                active_conns: number;
                max_conns: number;
        };
        upstream: {
                binance_connected: boolean;
                binance_symbols: number;
                binance_intervals: number;
                binance_sub_streams: number;
                redis_pubsub_enabled: boolean;
        };
        runtime: {
                goroutines: number;
                heap_alloc_mb: number;
                heap_in_use_mb: number;
                num_gc: number;
                gc_pause_ms_total: number;
                go_version: string;
                num_cpu: number;
        };
        tickers: { symbol: string; price: number; age_ms: number; stale: boolean }[];
}

export interface PaginationMeta {
        total: number;
        page: number;
        limit: number;
}

export interface PaginatedResponse<T> {
        success: boolean;
        data: T[];
        total: number;
        page: number;
        limit: number;
}

export interface ApiResponse<T> {
        success: boolean;
        data?: T;
        message?: string;
        error?: string;
}

export interface LoginResponse {
        success: boolean;
        data: {
                token: string;
                refresh_token: string;
                user: AdminUser;
                requires_2fa?: boolean;
        };
}

export interface SSEMessage {
        type: string;
        data: unknown;
}

export interface PublicConfig {
        main_domain: string;
        frontend_domain: string;
        backend_domain: string;
        admin_domain: string;
        ssl_enabled: boolean;
        registration_open: boolean;
        maintenance_mode: boolean;
        nginx_http_port: string;
        nginx_https_port: string;
        backend_internal_port: string;
        frontend_internal_port: string;
        admin_internal_port: string;
        backend_host_port: string;
        frontend_host_port: string;
        admin_host_port: string;
}
