/**
 * API Endpoints Configuration
 * Centralized endpoint definitions with clean URLs
 */

export const ENDPOINTS = {
    // Authentication
    auth: {
        login: 'auth/login.php',
        register: 'auth/register.php',
        forgotPassword: 'auth/forgot-password.php',
        logout: 'auth/logout.php',
        refresh: 'auth/refresh.php',
        user: 'auth/me.php',
        resendConfirmation: 'auth/resend-confirmation.php',
    },

    // Questions
    questions: {
        list: 'questionsList',
        create: 'questionsCreate',
        update: 'questionsUpdate',
        delete: 'questionsDelete',
        submit: 'questionsAnswer',
        answer: 'questionsAnswer',
        save: 'questionsSave',
        filter: 'questionsFilter',
        stats: 'questionsStats',
        history: 'questionsHistory',
        toggleSave: 'questionsToggleSave',
        resetAnswers: 'questionsResetAnswers',
    },

    // Comments
    comments: {
        list: 'commentsList',
        create: 'commentsHandle',
        add: 'commentsAdd',
        update: 'commentsHandle',
        delete: 'commentsHandle',
        like: 'commentsLike',
        report: 'commentsReport',
        handle: 'commentsHandle',
    },

    // Notifications
    notifications: {
        list: 'notificationsList',
        markRead: 'notificationsMarkRead',
        markAllRead: 'notificationsMarkAllRead',
        delete: 'notificationsDelete',
        clearAll: 'notificationsClearAll',
        send: 'notificationsSend',
    },

    // Rankings
    rankings: {
        list: 'rankingsList',
        create: 'rankingsCreate',
        join: 'rankingsJoin',
        update: 'rankingsUpdate',
        moderate: 'rankingsModerate',
        delete: 'rankingsDelete',
    },

    // Materials
    materials: {
        list: 'materialsList',
        create: 'materialsCreate',
        update: 'materialsUpdate',
        delete: 'materialsDelete',
        moderate: 'materialsModerate',
        rate: 'materialsRate',
    },

    // Marketplace
    marketplace: {
        list: 'marketplaceList',
        purchase: 'marketplacePurchase',
        create: 'marketplaceCreate',
        userTransactions: 'marketplaceUserTransactions',
        processTransaction: 'marketplaceProcessTransaction',
        refund: 'marketplaceRefund',
        myMaterials: 'marketplaceMyMaterials',
    },

    // Simulations
    simulations: {
        list: 'simulationsList',
        create: 'simulationsCreate',
        submit: 'simulationsSubmit',
    },

    // Users
    users: {
        list: 'usersList',
        profile: 'auth/me.php',  // Endpoint real de dados do usuário logado
        update: 'usersUpdate',
        comments: 'usersComments',
        answers: '/users/answers.php', // params: { user_id }
    },

    // Reports
    reports: {
        create: 'reportsCreate',
        list: 'reportsList',
    },

    // Filters
    filters: {
        list: 'filtersList',
        save: 'filtersSave',
        delete: 'filtersDelete',
    },

    // Admin
    admin: {
        userDetails: 'admin/user_details.php',
        userActions: 'admin/user_actions.php',
    },

    // Transactions
    transactions: {
        list: 'transactionsList',
        create: 'transactions/create.php',
        refund: 'transactions/refund.php',
    },

    // Cache
    cache: {
        manage: 'cacheManage',
    },

    // Bank Analysis
    bankAnalysis: {
        analyze: 'bankAnalysisAnalyze',
        patterns: 'bankAnalysisPatterns',
    },

    // AI
    ai: {
        generate: 'aiGenerate',
    },

    // Settings
    settings: {
        get: 'settings',
        update: 'settingsUpdate',
    },

    // Statistics
    statistics: {
        xray: 'statistics/xray.php',
        bancaInfo: 'statistics/banca_info.php',
    },

    // System
    system: {
        logs: 'system/logs.php',
    }

} as const;

export default ENDPOINTS;
