import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/push-config")({
  server: {
    handlers: {
      GET: async () => {
        const publicKey = process.env["VAPID_PUBLIC_KEY"] ?? null;
        return Response.json({ publicKey });
      },
    },
  },
});
