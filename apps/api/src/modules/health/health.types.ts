export interface LivenessResponse {
  services: {
    app: {
      status: "up";
    };
  };
  status: "ok";
  timestamp: string;
}

export interface HealthResponse {
  services: {
    app: {
      status: "up";
    };
    database: {
      status: "up";
    };
  };
  status: "ok";
  timestamp: string;
}
