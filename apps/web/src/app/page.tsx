"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth";

export default function Page() {
  const router = useRouter();
  const status = useAuth((state) => state.status);
  const bootstrap = useAuth((state) => state.bootstrap);

  useEffect(() => {
    if (status === "loading") {
      void bootstrap();
    }
  }, [bootstrap, status]);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }

    if (status === "unauthenticated" || status === "expired") {
      router.replace("/login");
    }
  }, [router, status]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "var(--background)",
        color: "var(--text)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <strong>Atlas Finance</strong>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Verificando sua sessão…
        </p>
      </div>
    </main>
  );
}
