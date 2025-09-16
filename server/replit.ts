import type { Express, Request, Response } from "express";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// We import playwright lazily inside the route to avoid crashing when not installed

function getMonthRangeIso(month?: string): { start: string; end: string; slug: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let mon = now.getUTCMonth(); // 0-11
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-");
    year = Number(y);
    mon = Number(m) - 1;
  }
  const startDate = new Date(Date.UTC(year, mon, 1));
  const endDate = new Date(Date.UTC(year, mon + 1, 1));
  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);
  const slug = `${year}-${String(mon + 1).padStart(2, "0")}`;
  return { start, end, slug };
}

function parseBillingFromHtml(html: string) {
  const text = html.replace(/\s+/g, " ");

  const tryMatch = (patterns: RegExp[]): RegExpExecArray | null => {
    for (const re of patterns) {
      const m = re.exec(text);
      if (m) return m;
    }
    return null;
  };

  const toNum = (s?: string | null) => {
    if (!s) return null;
    const n = Number((s || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  // Monthly credits (handle both orders): "$X used of $Y" OR "$X of $Y used"
  const creditsM = tryMatch([
    /\$\s*([0-9][0-9.,]*)\s*(?:USD)?\s*used\s*of\s*\$\s*([0-9][0-9.,]*)/i,
    /\$\s*([0-9][0-9.,]*)\s*of\s*\$\s*([0-9][0-9.,]*)\s*used/i,
    /used\s*\$\s*([0-9][0-9.,]*)\s*of\s*\$\s*([0-9][0-9.,]*)/i,
  ]);
  const creditsUsed = creditsM ? toNum(creditsM[1]) : null;
  const creditsTotal = creditsM ? toNum(creditsM[2]) : null;

  // Resets in N day(s)
  const resetsM = tryMatch([
    /Resets\s+in\s+([0-9]+)\s+days?/i,
  ]);
  const resetsDays = resetsM ? toNum(resetsM[1]) : null;

  // Additional usage amount variations
  const additionalM = tryMatch([
    /Additional\s+usage[^$]{0,80}\$\s*([0-9][0-9.,]*)/i,
    /\$\s*([0-9][0-9.,]*)\s*spent/i,
  ]);
  const additionalSpent = additionalM ? toNum(additionalM[1]) : null;

  // Usage alert: percent or dollars
  const alertPercent = /Usage\s+alert\s*:?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i.exec(text);
  const alertDollars = /Usage\s+alert\s*:?\s*\$\s*([0-9][0-9.,]*)/i.exec(text);
  const usageAlert = alertPercent ? toNum(alertPercent[1]) : (alertDollars ? toNum(alertDollars[1]) : null);

  // Usage budget dollars
  const budgetM = /Usage\s+budget\s*:?\s*\$\s*([0-9][0-9.,]*)/i.exec(text);
  const usageBudget = budgetM ? toNum(budgetM[1]) : null;

  // Plan price: "$25/month" or "$25 per month"
  const planPriceM = tryMatch([
    /\$\s*([0-9][0-9.,]*)\s*\/\s*month/i,
    /\$\s*([0-9][0-9.,]*)\s*per\s*month/i,
    /\$\s*([0-9][0-9.,]*)\s*month/i,
  ]);
  const planPriceMonth = planPriceM ? toNum(planPriceM[1]) : null;

  // Plan name – best effort near "Your plan"
  let planName: string | null = null;
  const idx = text.toLowerCase().indexOf("your plan");
  if (idx >= 0) {
    const snippet = text.slice(idx, idx + 220);
    const nm = /your\s+plan\s+([a-z][a-z0-9\s\-+™®]{2,40})/i.exec(snippet);
    if (nm) planName = nm[1].trim();
  }

  return {
    planName,
    planPriceMonth,
    creditsUsed,
    creditsTotal,
    creditsResetsDays: resetsDays,
    additionalUsageSpent: additionalSpent,
    usageAlert,
    usageBudget,
  };
}

export async function registerReplitRoutes(app: Express) {
  // Lightweight endpoint to read precomputed cost snapshot from cost.json
  app.get("/api/replit/cost", async (_req: Request, res: Response) => {
    try {
      const path = join(process.cwd(), "cost.json");
      const raw = await (await import("fs/promises")).readFile(path, "utf8");
      const j = JSON.parse(raw || "{}");
      const subtotalAmountUsd = j?.subtotalAmountUsd ?? null;
      const totalAmountUsd = j?.totalAmountUsd ?? null;
      const totalGrantedSubscriptionCredits = j?.credits?.totalGrantedSubscriptionCredits ?? null;
      return res.json({
        ok: true,
        period: { startDate: j?.startDate || null, endDate: j?.endDate || null },
        capturedAt: j?.timestamp || null,
        totalSpendUsd: typeof subtotalAmountUsd === "number" ? subtotalAmountUsd : null,
        totalCreditsGranted: typeof totalGrantedSubscriptionCredits === "number" ? totalGrantedSubscriptionCredits : null,
        additionalUsageUsd: typeof totalAmountUsd === "number" ? totalAmountUsd : null,
      });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to read cost.json", error: err?.message || String(err) });
    }
  });

  app.post("/api/replit/fetch-usage", async (req: Request, res: Response) => {
    const email = process.env.REPLIT_EMAIL;
    const password = process.env.REPLIT_PASSWORD;
    const cookiesJson = process.env.REPLIT_COOKIES_JSON;
    const cookieHeader = process.env.REPLIT_COOKIE_HEADER; // e.g., "name=value; other=val"
    const sessionCookieName = process.env.REPLIT_SESSION_COOKIE_NAME;
    const sessionCookieValue = process.env.REPLIT_SESSION_COOKIE_VALUE;
    if (!email || !password) {
      if (!cookiesJson && !(sessionCookieName && sessionCookieValue)) {
        return res.status(400).json({ message: "REPLIT_EMAIL/REPLIT_PASSWORD not configured in .env (or provide REPLIT_COOKIES_JSON or REPLIT_SESSION_COOKIE_NAME/REPLIT_SESSION_COOKIE_VALUE)" });
      }
    }

    const { month, headless, persist } = (req.body || {}) as { month?: string; headless?: boolean; persist?: boolean };
    const { start, end, slug } = getMonthRangeIso(month);

    try {
      // Lazy import so the server can boot without playwright installed
      const { chromium } = await import("playwright");

      // Use persistent profile when seeding login; otherwise per-run to avoid lock conflicts
      const userDataDir = persist
        ? join(process.cwd(), "server", "data", ".replit-profile")
        : join(process.cwd(), "server", "data", `.replit-profile-${Date.now()}`);
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: headless !== false,
        acceptDownloads: true,
        args: [
          "--disable-blink-features=AutomationControlled",
          "--no-sandbox",
          "--disable-dev-shm-usage",
        ],
        ignoreHTTPSErrors: true,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1366, height: 900 },
      });
      context.setDefaultTimeout(90000);
      const page = await context.newPage();

      // If cookies are provided, set them to bypass interactive login entirely
      let appliedCookies: Array<{ name: string; value: string; domain?: string; path?: string }> = [];
      try {
        const cookiesToSet: any[] = [];
        if (cookiesJson) {
          const parsed = JSON.parse(cookiesJson);
          if (Array.isArray(parsed)) {
            for (const c of parsed) {
              if (c && c.name && c.value) {
                cookiesToSet.push({
                  name: c.name,
                  value: c.value,
                  domain: c.domain || ".replit.com",
                  path: c.path || "/",
                  httpOnly: c.httpOnly ?? true,
                  secure: c.secure ?? true,
                });
              }
            }
          }
        } else if (cookieHeader && typeof cookieHeader === "string") {
          // Parse a raw Cookie header string into individual cookies
          const parts = cookieHeader.split(";");
          for (const p of parts) {
            const seg = p.trim();
            if (!seg) continue;
            const eq = seg.indexOf("=");
            if (eq <= 0) continue;
            const name = seg.slice(0, eq).trim();
            const value = seg.slice(eq + 1).trim();
            if (!name || !value) continue;
            cookiesToSet.push({
              name,
              value,
              domain: ".replit.com",
              path: "/",
              httpOnly: true,
              secure: true,
            });
          }
        } else if (sessionCookieName && sessionCookieValue) {
          cookiesToSet.push({
            name: sessionCookieName,
            value: sessionCookieValue,
            domain: ".replit.com",
            path: "/",
            httpOnly: true,
            secure: true,
          });
        }

        if (cookiesToSet.length > 0) {
          // Set for both base and subdomain
          const expanded = cookiesToSet.flatMap(c => ([
            { ...c, domain: ".replit.com" },
            { ...c, domain: "replit.com" },
          ]));
          await context.addCookies(expanded as any);
          appliedCookies = expanded.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }));
        }
      } catch {
        // ignore cookie parse issues; will fall back to login flow
      }

      // Login flow - selectors may change; adjust as needed
      try {
        // If cookies exist, try going straight to billing
        if (cookiesJson || (sessionCookieName && sessionCookieValue)) {
          await page.goto("https://replit.com/usage", { waitUntil: "load", timeout: 60000 });
        } else {
          await page.goto("https://replit.com/login?hide_landing=true", { waitUntil: "load", timeout: 60000 });
        }
      } catch {
        // Retry once with alternative target
        await page.goto(cookiesJson || (sessionCookieName && sessionCookieValue) ? "https://replit.com/usage" : "https://replit.com/login", { waitUntil: "load", timeout: 60000 });
      }

      // If cookies were not supplied, attempt username/password login flow programmatically
      if (!(cookiesJson || (sessionCookieName && sessionCookieValue))) {
        // Some flows require choosing "Continue with email" first
        const emailLoginBtn =
          (await page.$('button:has-text("Continue with email")')) ||
          (await page.$('button:has-text("Use email")')) ||
          (await page.$('a:has-text("Use email")'));
        if (emailLoginBtn) {
          await emailLoginBtn.click();
        }

        // Replit typically asks for identifier then password on the next step
        // Try common selectors, with fallbacks
        const identifierSelector = 'input[name="identifier"], input[name="username"], input[type="email"], input[name="email"]';
        await page.waitForSelector(identifierSelector, { timeout: 20000 });
        await page.fill(identifierSelector, email || "");

        // Submit identifier if a Next/Continue button exists
        const continueBtn =
          (await page.$('button:has-text("Continue")')) ||
          (await page.$('button:has-text("Next")')) ||
          (await page.$('button[type="submit"]'));
        if (continueBtn) {
          await continueBtn.click();
        }

        const passwordSelector = 'input[name="password"], input[type="password"]';
        await page.waitForSelector(passwordSelector, { timeout: 30000 });
        await page.fill(passwordSelector, password || "");

        const submitBtn =
          (await page.$('button[type="submit"]')) ||
          (await page.$('button:has-text("Log in")')) ||
          (await page.$('button:has-text("Sign in")'));
        if (submitBtn) {
          await submitBtn.click();
        }
      }

      // Wait for post-login landing (best-effort)
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
      } catch {
        // continue
      }

      // Navigate to a presumed billing/usage area. If this 404s, update the path.
      // We also watch for XHR JSON that includes usage; if found, store it.
      const usageResponses: Array<{ url: string; body: any }> = [];
      page.on("response", async (resp) => {
        try {
          const url = resp.url();
          if (/billing|usage|invoices/i.test(url) && resp.request().resourceType() === "xhr") {
            const ct = resp.headers()["content-type"] || "";
            if (ct.includes("application/json")) {
              const body = await resp.json();
              usageResponses.push({ url, body });
            }
          }
        } catch {
          // ignore
        }
      });

      // Capture fetch()-based network calls as well
      await page.route(/https:\/\/[^/]*replit\.com\/.*/, async (route) => {
        try {
          const req = route.request();
          if (/billing|usage|invoices/i.test(req.url())) {
            const res = await route.fetch();
            const ct = res.headers()["content-type"] || "";
            let body: any = null;
            if (ct.includes("application/json")) {
              try { body = await res.json(); } catch {}
            }
            if (body) usageResponses.push({ url: req.url(), body });
            return route.fulfill({ response: res });
          }
        } catch {}
        return route.fallback();
      });

      await page.goto("https://replit.com/usage", { waitUntil: "networkidle", timeout: 90000 });

      // Wait for key texts to ensure the billing overview is mounted
      try {
        await Promise.race([
          page.waitForSelector('text=/Additional usage/i', { timeout: 30000 }),
          page.waitForSelector('text=/Monthly credits/i', { timeout: 30000 }),
          page.waitForSelector('text=/Your plan/i', { timeout: 30000 }),
          page.waitForSelector('[class*="useView_view__"]', { timeout: 30000 }),
        ]);
      } catch {
        // proceed anyway – we will still snapshot the HTML
      }

      // Let XHRs settle a bit
      await page.waitForTimeout(5000);

      // Grab HTML and visible text; attempt to capture specific billing container if present
      const pageContent = await page.content();
      const pageText: string = await page.evaluate(() => {
        try {
          // Prefer the known billing view container if present
          const specific = document.querySelector('.useView_view__C2mnv.css-1h5mh4g') as HTMLElement | null;
          if (specific && specific.innerText && specific.innerText.trim().length > 0) {
            return specific.innerText;
          }
          // Fallback: try to find an element containing the key headings
          const headings = ["Your plan", "Monthly credits", "Additional usage"];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          let best: HTMLElement | null = null;
          while (walker.nextNode()) {
            const el = walker.currentNode as HTMLElement;
            const txt = (el.innerText || "").trim();
            if (!txt) continue;
            const hasAll = headings.every(h => txt.toLowerCase().includes(h.toLowerCase()));
            if (hasAll) {
              best = el;
              break;
            }
          }
          if (best && best.innerText) return best.innerText;
          // Deep fallback: gather text from shadow roots too
          const collectTextFrom = (node: Node): string => {
            let acc = "";
            const asElem = node as any;
            if ((asElem as HTMLElement).innerText) {
              acc += " " + ((asElem as HTMLElement).innerText || "");
            }
            const sr = (asElem as any).shadowRoot as ShadowRoot | undefined;
            if (sr) {
              acc += " " + collectTextFrom(sr as any);
            }
            const children = (asElem.children || []) as any;
            for (let i = 0; i < children.length; i++) {
              acc += " " + collectTextFrom(children[i]);
            }
            return acc;
          };
          const deepText = collectTextFrom(document.body);
          if (deepText && deepText.trim().length > 0) return deepText;
        } catch {}
        return document.body.innerText || "";
      });

      // Also navigate to Usage subpage to capture its content (redundant safeguard)
      let usagePageContent = "";
      let usagePageText = "";
      let usageUrl = "";
      let contextCookies: any[] = [];
      try {
        await page.goto("https://replit.com/usage", { waitUntil: "domcontentloaded", timeout: 60000 });
        usageUrl = page.url();
        try {
          contextCookies = await context.cookies("https://replit.com");
        } catch {}
        // wait briefly for content
        try {
          await Promise.race([
            page.waitForSelector('text=Usage', { timeout: 10000 }),
            page.waitForSelector('text=Additional usage', { timeout: 10000 }),
            page.waitForSelector('text=Monthly credits', { timeout: 10000 }),
          ]);
        } catch {}
        usagePageContent = await page.content();
        usagePageText = await page.evaluate(() => {
          try {
            const headings = ["Usage", "Additional usage", "Monthly credits", "Your plan"];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
            let best: HTMLElement | null = null;
            while (walker.nextNode()) {
              const el = walker.currentNode as HTMLElement;
              const txt = (el.innerText || "").trim();
              if (!txt) continue;
              const hasAny = headings.some(h => txt.toLowerCase().includes(h.toLowerCase()));
              if (hasAny) { best = el; break; }
            }
            if (best && best.innerText) return best.innerText;
          } catch {}
          return document.body.innerText || "";
        });
      } catch {
        // ignore
      }

      // Save a screenshot for debugging
      let screenshotPath = "";
      try {
        const shotsDir = join(process.cwd(), "server", "data", "shots");
        mkdirSync(shotsDir, { recursive: true });
        screenshotPath = join(shotsDir, `replit-usage-${slug}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {}

      await context.close();

      const outDir = join(process.cwd(), "server", "data");
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      const outFile = join(outDir, `replit-usage-${slug}.json`);

      const parsed = parseBillingFromHtml(pageText || pageContent);

      const payload = {
        source: "replit",
        month: slug,
        range: { start, end },
        capturedAt: new Date().toISOString(),
        url: page.url(),
        usageUrl,
        appliedCookies,
        contextCookies,
        responses: usageResponses,
        pageSnapshotHtml: pageContent.slice(0, 200000),
        pageSnapshotText: (pageText || "").slice(0, 200000),
        usagePageSnapshotHtml: (usagePageContent || "").slice(0, 200000),
        usagePageSnapshotText: (usagePageText || "").slice(0, 200000),
        screenshotPath,
        parsed,
      };
      writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

      // Try to compute a naive total if present in JSON payloads
      let total = 0;
      for (const r of usageResponses) {
        if (r && r.body) {
          if (typeof r.body.total === "number") total += r.body.total;
          if (typeof r.body.total_usd === "number") total += r.body.total_usd;
          if (Array.isArray(r.body.days)) {
            total += r.body.days.reduce((s: number, d: any) => s + (Number(d.amount || d.total || 0) || 0), 0);
          }
        }
      }
      // Prefer additionalUsageSpent if found on the page
      if (payload.parsed?.additionalUsageSpent && Number.isFinite(payload.parsed.additionalUsageSpent)) {
        total = Number(payload.parsed.additionalUsageSpent);
      }

      return res.json({ ok: true, file: outFile, month: slug, inferredTotalUsd: Number.isFinite(total) ? total : 0 });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to fetch Replit usage", error: err?.message || String(err) });
    }
  });

  app.get("/api/replit/usage", async (req: Request, res: Response) => {
    try {
      const { month } = (req.query || {}) as { month?: string };
      const { slug } = getMonthRangeIso(month);
      const outFile = join(process.cwd(), "server", "data", `replit-usage-${slug}.json`);
      if (!existsSync(outFile)) {
        return res.status(404).json({ message: "No Replit usage snapshot found for month", month: slug });
      }
      const raw = await (await import("fs/promises")).readFile(outFile, "utf8");
      const payload = JSON.parse(raw);

      // Recompute a naive total just in case
      let total = 0;
      if (Array.isArray(payload?.responses)) {
        for (const r of payload.responses) {
          if (r && r.body) {
            if (typeof r.body.total === "number") total += r.body.total;
            if (typeof r.body.total_usd === "number") total += r.body.total_usd;
            if (Array.isArray(r.body.days)) {
              total += r.body.days.reduce((s: number, d: any) => s + (Number(d.amount || d.total || 0) || 0), 0);
            }
          }
        }
      }
      // If parsed missing in older snapshots, derive from stored HTML/TEXT
      let parsed = payload?.parsed;
      if (!parsed && typeof (payload as any)?.pageSnapshotText === "string" && (payload as any).pageSnapshotText.length > 0) {
        parsed = parseBillingFromHtml((payload as any).pageSnapshotText);
      } else if (!parsed && typeof (payload as any)?.pageSnapshotHtml === "string" && (payload as any).pageSnapshotHtml.length > 0) {
        parsed = parseBillingFromHtml((payload as any).pageSnapshotHtml);
      } else if (!parsed && typeof (payload as any)?.pageSnapshot === "string" && (payload as any).pageSnapshot.length > 0) {
        // legacy field name
        parsed = parseBillingFromHtml((payload as any).pageSnapshot);
      }

      if (parsed?.additionalUsageSpent && Number.isFinite(parsed.additionalUsageSpent)) {
        total = Number(payload.parsed.additionalUsageSpent);
      }

      return res.json({
        ok: true,
        month: payload?.month || slug,
        range: payload?.range,
        capturedAt: payload?.capturedAt,
        inferredTotalUsd: Number.isFinite(total) ? total : 0,
        parsed,
      });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to load Replit usage", error: err?.message || String(err) });
    }
  });
}


