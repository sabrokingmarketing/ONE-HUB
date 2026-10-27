import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Background jobs run inside Convex, independent of anyone's browser.
 * Intervals are chosen to stay comfortably inside the Convex free tier
 * (each run is a single cheap indexed query when there is nothing to do).
 */
const crons = cronJobs();

crons.interval("publish due social posts", { minutes: 1 }, internal.socialPosts.enqueueDue, {});
crons.interval("send meeting reminders", { minutes: 5 }, internal.meetings.sendDueReminders, {});
crons.interval("recover email queue", { minutes: 10 }, internal.emails.recoverStuck, {});
crons.interval("recover publishing jobs", { minutes: 15 }, internal.socialPosts.recoverStuck, {});

crons.daily("refresh social tokens", { hourUTC: 1, minuteUTC: 17 }, internal.socialAuth.refreshTokens, {});

export default crons;
