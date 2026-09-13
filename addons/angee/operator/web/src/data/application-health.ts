import type { ServiceState } from "./types";

export interface ApplicationHealth {
  status: "failed" | "unavailable" | "running" | "healthy";
  service: string | null;
  detail: string | null;
  readinessUnavailable: boolean;
}

/** Aggregate application health from the daemon-owned service observations. */
export function applicationHealth(
  services: readonly ServiceState[],
): ApplicationHealth | null {
  const unhealthy = services.find(
    (service) => service.health && !["healthy", "ok"].includes(service.health.toLowerCase()),
  );
  if (unhealthy) return { status: "failed", service: unhealthy.name, detail: unhealthy.health, readinessUnavailable: false };

  const stopped = services.find((service) => service.status.toLowerCase() !== "running");
  if (stopped) return { status: "unavailable", service: stopped.name, detail: stopped.status, readinessUnavailable: false };

  const waiting = services.find((service) => !service.health);
  if (waiting) return { status: "running", service: waiting.name, detail: null, readinessUnavailable: true };

  return services.length > 0 ? { status: "healthy", service: null, detail: null, readinessUnavailable: false } : null;
}
