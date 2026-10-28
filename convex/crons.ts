import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Background jobs run inside Convex, independent of anyone's browser.
 * Intervals are chosen to stay comfortably inside the Convex free tier
 * (each run is a single cheap indexed query when there is nothing to do).
 */
const crons = cronJobs();

crons.interval("send meeting reminders", { minutes: 5 }, internal.meetings.sendDueReminders, {});
crons.interval("recover email queue", { minutes: 10 }, internal.emails.recoverStuck, {});
crons.daily("purge old email bodies", { hourUTC: 1, minuteUTC: 17 }, internal.emails.purgeOldBodies, {});

export default crons;
