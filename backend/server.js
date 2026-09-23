const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const port = Number(process.env.PORT) || 3000;
const frontendDirectory = path.resolve(__dirname, "..", "frontend");
const messagesFile = path.join(__dirname, "data", "messages.json");
const staticTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
};

const sendJson = (response, status, body) => {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(body));
};

const requestJson = async (url, options = {}) => {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Upstream request failed: ${response.status}`);
    return response.json();
};

const readRequestBody = request => new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
        body += chunk;
        if (body.length > 10000) {
            reject(new Error("Request body is too large"));
            request.destroy();
        }
    });
    request.on("end", () => {
        try {
            resolve(JSON.parse(body || "{}"));
        } catch (error) {
            reject(new Error("Request body must be valid JSON"));
        }
    });
    request.on("error", reject);
});

const handleApi = async (request, response, url) => {
    if (url.pathname === "/api/health") {
        sendJson(response, 200, { status: "ok" });
        return true;
    }

    if (url.pathname === "/api/contact" && request.method === "POST") {
        const body = await readRequestBody(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim() : "";
        const message = typeof body.message === "string" ? body.message.trim() : "";

        if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) {
            sendJson(response, 400, { error: "Please provide a valid name, email, and message." });
            return true;
        }

        fs.mkdirSync(path.dirname(messagesFile), { recursive: true });
        const messages = fs.existsSync(messagesFile)
            ? JSON.parse(fs.readFileSync(messagesFile, "utf8"))
            : [];
        messages.push({ id: Date.now().toString(36), name, email, message, createdAt: new Date().toISOString() });
        fs.writeFileSync(messagesFile, `${JSON.stringify(messages, null, 2)}\n`);
        sendJson(response, 201, { message: "Thanks for reaching out. Your message has been received." });
        return true;
    }

    if (url.pathname === "/api/weather/search" && request.method === "GET") {
        const query = new URLSearchParams({
            name: url.searchParams.get("name") || "",
            count: url.searchParams.get("count") || "5",
            language: "en",
            format: "json"
        });
        sendJson(response, 200, await requestJson(`https://geocoding-api.open-meteo.com/v1/search?${query}`));
        return true;
    }

    if (url.pathname === "/api/weather/forecast" && request.method === "GET") {
        const allowedKeys = ["latitude", "longitude", "current", "daily", "forecast_days", "timezone"];
        const query = new URLSearchParams();
        allowedKeys.forEach(key => {
            if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key));
        });
        sendJson(response, 200, await requestJson(`https://api.open-meteo.com/v1/forecast?${query}`));
        return true;
    }

    if (url.pathname === "/api/currency/rates" && request.method === "GET") {
        sendJson(response, 200, await requestJson("https://open.er-api.com/v6/latest/USD"));
        return true;
    }

    if (url.pathname === "/api/scores/events" && request.method === "GET") {
        const query = new URLSearchParams({ d: url.searchParams.get("date") || "", s: "Soccer" });
        if (url.searchParams.has("league")) query.set("l", url.searchParams.get("league"));
        sendJson(response, 200, await requestJson(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?${query}`));
        return true;
    }

    if (url.pathname === "/api/scores/team" && request.method === "GET") {
        const teamName = encodeURIComponent(url.searchParams.get("name") || "");
        const search = await requestJson(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${teamName}`);
        const team = search.teams?.find(item => item.strSport === "Soccer") || search.teams?.[0];
        if (!team) {
            sendJson(response, 404, { error: "Team not found" });
            return true;
        }
        const [last, next] = await Promise.all([
            requestJson(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${team.idTeam}`),
            requestJson(`https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${team.idTeam}`)
        ]);
        sendJson(response, 200, { team, last, next });
        return true;
    }

    if (url.pathname === "/api/scores/match" && request.method === "GET") {
        const matchId = encodeURIComponent(url.searchParams.get("id") || "");
        sendJson(response, 200, await requestJson(`https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=${matchId}`));
        return true;
    }

    return false;
};

const serveStatic = (request, response, url) => {
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.resolve(frontendDirectory, `.${requestedPath}`);
    const relativePath = path.relative(frontendDirectory, filePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }
    response.writeHead(200, { "Content-Type": staticTypes[path.extname(filePath)] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
};

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    try {
        if (url.pathname.startsWith("/api/")) {
            const handled = await handleApi(request, response, url);
            if (!handled) sendJson(response, 404, { error: "API route not found" });
            return;
        }
        if (request.method !== "GET") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
        }
        serveStatic(request, response, url);
    } catch (error) {
        console.error(error);
        sendJson(response, 502, { error: "The requested service is temporarily unavailable." });
    }
});

server.listen(port, () => console.log(`Portfolio server running at http://localhost:${port}`));
