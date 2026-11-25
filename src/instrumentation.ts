export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("@/lib/reminderScheduler");
    startReminderScheduler();
    const { registerDiscordCommands } = await import("@/lib/discord/api");
    void registerDiscordCommands();
  }
}
