import { makeLogger } from "./log.ts";

const log = makeLogger("desktop");

/**
 * Tries to launch a borderless Chrome/Edge app window for the given URL.
 * Falls back to default browser if no Chromium-based browser is found.
 */
export async function launchDesktopApp(url: string): Promise<void> {
  const isWindows = Deno.build.os === "windows";

  // Try Chromium-based browsers in order of preference
  const browserPaths = isWindows
    ? [
      // Edge (built-in on Win11)
      `${Deno.env.get("ProgramFiles(x86)")}\\Microsoft\\Edge\\Application\\msedge.exe`,
      // Chrome
      `${Deno.env.get("ProgramFiles")}\\Google\\Chrome\\Application\\chrome.exe`,
      `${Deno.env.get("ProgramFiles(x86)")}\\Google\\Chrome\\Application\\chrome.exe`,
      `${Deno.env.get("LocalAppData")}\\Google\\Chrome\\Application\\chrome.exe`,
    ]
    : [
      // Linux/Mac fallback paths (if needed later)
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ];

  for (const path of browserPaths) {
    try {
      const stat = await Deno.stat(path);
      if (stat.isFile) {
        log.info("Launching desktop window", { browser: path });
        const command = new Deno.Command(path, {
          args: [`--app=${url}`, "--window-size=1280,800"],
          stdout: "null",
          stderr: "null",
          stdin: "null",
        });
        command.spawn();
        return; // Success
      }
    } catch {
      // Path not found, try next
    }
  }

  // Fallback: Default OS browser launch
  log.info("No Chromium browser found for --app launch, falling back to default browser");
  try {
    const cmd = isWindows
      ? new Deno.Command("cmd", { args: ["/c", "start", "", url] })
      : new Deno.Command("open", { args: [url] });
    cmd.spawn();
  } catch (err) {
    log.error("Failed to launch fallback browser", { error: String(err) });
  }
}
