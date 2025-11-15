// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/**
 * Reads the links.txt file and returns an array of valid Streamtape URLs.
 */
async function fetchLinksFromFile(filePath: string): Promise<string[]> {
  try {
    const text = await Deno.readTextFile(filePath);
    return text.split('\n')               // Split by new line
               .map(link => link.trim())  // Remove whitespace
               .filter(link => link.startsWith("https://streamtape.com")); // Keep only valid links
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.error(`Error: ${filePath} file not found.`);
    } else {
      console.error(`Error reading ${filePath}:`, e);
    }
    return []; // Return empty array on error
  }
}

/**
 * Runs the fetch process for all links.
 */
async function runRefreshScript(): Promise<string> {
  const videoLinks = await fetchLinksFromFile("./links.txt");
  
  if (videoLinks.length === 0) {
    return "No valid links found in links.txt. Script did not run.";
  }

  let log = `Starting to refresh ${videoLinks.length} videos...\n`;
  log += "---------------------------------------\n";
  console.log(`Starting to refresh ${videoLinks.length} videos...`);

  let successCount = 0;
  let failCount = 0;

  for (const link of videoLinks) {
    try {
      const response = await fetch(link, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
        }
      });
      
      const logLine = `[${response.status}] ${response.ok ? '✅' : '⚠️'} ${link}\n`;
      console.log(logLine);
      log += logLine;

      if (response.ok) {
        successCount++;
      } else {
        failCount++;
      }

    } catch (error) {
      const logLine = `[ERROR] ❌ ${link}: ${error.message}\n`;
      console.error(logLine);
      log += logLine;
      failCount++;
    }
    
    // Wait 1 second between requests to avoid rate-limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  log += "---------------------------------------\n";
  log += `🎉 All links refreshed. Success: ${successCount}, Failed: ${failCount}\n`;
  console.log("Finished.");
  return log;
}

/**
 * Serves the web interface and handles the /run-script trigger.
 */
serve(async (req) => {
  const url = new URL(req.url);

  // 1. Homepage ("/") - Serves the HTML button
  if (url.pathname === "/") {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Streamtape Refresher</title>
        <style>
            body { font-family: system-ui, sans-serif; line-height: 1.5; padding: 20px; }
            button { font-size: 16px; padding: 10px 15px; cursor: pointer; }
            pre { background-color: #f4f4f4; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; }
        </style>
    </head>
    <body>
        <h1>Streamtape Video Refresher</h1>
        <p>Click the button below to start refreshing all links from links.txt.</p>
        <button id="runBtn" onclick="runScript()">Start Refreshing</button>
        <hr>
        <pre id="log">Logs will appear here...</pre>

        <script>
          function runScript() {
            const btn = document.getElementById('runBtn');
            const log = document.getElementById('log');
            
            btn.disabled = true;
            btn.innerText = 'Running... Please wait.';
            log.innerText = 'Starting script... This may take a while. Do not close this page.';
            
            fetch('/run-script')
              .then(res => res.text())
              .then(data => {
                log.innerText = data;
                btn.disabled = false;
                btn.innerText = 'Start Refreshing';
              })
              .catch(err => {
                log.innerText = 'Error: ' + err.message;
                btn.disabled = false;
                btn.innerText = 'Start Refreshing';
              });
          }
        </script>
    </body>
    </html>
    `;
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // 2. "/run-script" - Triggered by the button's JavaScript
  if (url.pathname === "/run-script") {
    const scriptLog = await runRefreshScript();
    return new Response(scriptLog, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 3. 404 Not Found
  return new Response("404 Not Found", { status: 404 });
});
