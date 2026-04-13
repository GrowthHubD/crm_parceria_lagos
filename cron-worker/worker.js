/**
 * Cron Worker — Growth Hub Manager
 *
 * Triggers scheduled jobs on Cloudflare Pages by calling the cron API endpoints.
 * Deploy separately: `wrangler deploy` inside the cron-worker/ directory.
 *
 * Cron schedule (UTC):
 *   "0 8 * * *"   → daily   at 08:00 (kanban-daily)
 *   "0 8 * * 1"   → Monday  at 08:00 (kanban-weekly)
 */

export default {
  async scheduled(event, env, ctx) {
    const headers = {
      Authorization: `Bearer ${env.CRON_SECRET}`,
    };

    const base = env.APP_URL; // e.g. https://sistemagh.pages.dev

    if (event.cron === "0 8 * * *") {
      const res = await fetch(`${base}/api/cron/kanban-daily`, { headers });
      console.log("[cron] kanban-daily →", res.status);
    }

    if (event.cron === "0 8 * * 1") {
      const res = await fetch(`${base}/api/cron/kanban-weekly`, { headers });
      console.log("[cron] kanban-weekly →", res.status);
    }
  },
};
