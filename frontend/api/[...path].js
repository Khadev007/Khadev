const { URL } = require("node:url");

const sendJson = (response, status, body) => {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(body));
};

const requestJson = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Upstream request failed: ${response.status}`);
    return response.json();
};

const handleGet = async (route, url, response) => {
    if (route === "health") {
        sendJson(response, 200, { status: "ok" });
        return;
    }

    if (route === "weather/search") {
        const query = new URLSearchParams({
            name: url.searchParams.get("name") || "",
            count: url.searchParams.get("count") || "5",
            language: "en",
            format: "json"
        });
        sendJson(response, 200, await requestJson(`https://geocoding-api.open-meteo.com/v1/search?${query}`));
        return;
    }

    if (route === "weather/forecast") {
        const allowedKeys = ["latitude", "longitude", "current", "daily", "forecast_days", "timezone"];
        const query = new URLSearchParams();
        allowedKeys.forEach(key => {
            if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key));
        });
        sendJson(response, 200, await requestJson(`https://api.open-meteo.com/v1/forecast?${query}`));
        return;
    }

    if (route === "currency/rates") {
        sendJson(response, 200, await requestJson("https://open.er-api.com/v6/latest/USD"));
        return;
    }

    if (route === "scores/events") {
        const query = new URLSearchParams({
            d: url.searchParams.get("date") || "",
            s: "Soccer"
        });
        if (url.searchParams.has("league")) query.set("l", url.searchParams.get("league"));
        sendJson(response, 200, await requestJson(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?${query}`));
        return;
    }

    if (route === "scores/team") {
        const teamName = encodeURIComponent(url.searchParams.get("name") || "");
        const search = await requestJson(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${teamName}`);
        const team = search.teams?.find(item => item.strSport === "Soccer") || search.teams?.[0];
        if (!team) {
            sendJson(response, 404, { error: "Team not found" });
            return;
        }

        const [last, next] = await Promise.all([
            requestJson(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${team.idTeam}`),
            requestJson(`https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${team.idTeam}`)
        ]);
        sendJson(response, 200, { team, last, next });
        return;
    }

    if (route === "scores/match") {
        const matchId = encodeURIComponent(url.searchParams.get("id") || "");
        sendJson(response, 200, await requestJson(`https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=${matchId}`));
        return;
    }

    sendJson(response, 404, { error: "API route not found" });
};

module.exports = async (request, response) => {
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");

    if (route === "contact" && request.method === "POST") {
        sendJson(response, 503, { error: "Contact submissions are not configured for this deployment." });
        return;
    }

    if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        sendJson(response, 405, { error: "Method not allowed" });
        return;
    }

    try {
        await handleGet(route, url, response);
    } catch (error) {
        console.error("Portfolio API request failed:", error);
        sendJson(response, 502, { error: "The requested service is temporarily unavailable." });
    }
};
