export interface PackageConfig {
    sentryInitialized: boolean;
}

class ConfigStore {
    private static instance: ConfigStore;
    private config: PackageConfig = {
        sentryInitialized: false,
    };

    static getInstance(): ConfigStore {
        if (!ConfigStore.instance) {
            ConfigStore.instance = new ConfigStore();
        }
        return ConfigStore.instance;
    }

    setConfig(config: Partial<PackageConfig>): void {
        this.config = { ...this.config, ...config };
    }

    getConfig(): PackageConfig {
        return { ...this.config };
    }

    get sentryInitialized(): boolean {
        return this.config.sentryInitialized;
    }
}

export const logConfig = ConfigStore.getInstance();
