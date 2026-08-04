export type NodeEnvironment = "development" | "test" | "staging" | "production";

export interface AppConfiguration {
  app: {
    apiPrefix: string;
    apiVersion: string;
    corsOrigins: string[];
    nodeEnv: NodeEnvironment;
    port: number;
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
}
