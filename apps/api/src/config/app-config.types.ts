export type NodeEnvironment = "development" | "test" | "staging" | "production";

export interface AppConfiguration {
  app: {
    apiPrefix: string;
    apiVersion: string;
    corsOrigins: string[];
    jsonBodyLimit: string;
    nodeEnv: NodeEnvironment;
    port: number;
    swaggerEnabled: boolean;
    urlEncodedBodyLimit: string;
  };
  database: {
    directUrl?: string;
    poolMax: number;
    url: string;
  };
  auth: {
    accessSecret: string;
    accessTtl: string;
    audience: string;
    issuer: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  throttling: {
    defaultLimit: number;
    defaultTtlMs: number;
  };
}
