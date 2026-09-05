const menuButton = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const contactForm = document.querySelector(".contact-form");
const formMessage = document.querySelector(".form-message");
const weatherForm = document.querySelector("#weather-form");
const cityInput = document.querySelector("#city-input");
const citySuggestions = document.querySelector("#city-suggestions");
const weatherStatus = document.querySelector("#weather-status");
const weatherDashboard = document.querySelector("#weather-dashboard");
let suggestionTimer;
let suggestedLocations = [];
let activeSuggestion = -1;

const weatherCodes = {
    0: ["Clear sky", "☀"], 1: ["Mainly clear", "🌤"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁"],
    45: ["Foggy", "🌫"], 48: ["Rime fog", "🌫"], 51: ["Light drizzle", "🌦"], 53: ["Drizzle", "🌦"],
    55: ["Heavy drizzle", "🌧"], 61: ["Light rain", "🌦"], 63: ["Rain", "🌧"], 65: ["Heavy rain", "🌧"],
    71: ["Light snow", "🌨"], 73: ["Snow", "❄"], 75: ["Heavy snow", "❄"], 80: ["Rain showers", "🌦"],
    81: ["Rain showers", "🌧"], 82: ["Heavy showers", "⛈"], 95: ["Thunderstorm", "⛈"],
    96: ["Storm with hail", "⛈"], 99: ["Storm with hail", "⛈"]
};

const getWeatherLabel = code => weatherCodes[code] || ["Unknown conditions", "☁"];
const formatDay = date => new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${date}T12:00:00`));

const showWeatherError = message => {
    weatherStatus.textContent = message;
    weatherStatus.classList.add("error");
    weatherDashboard.hidden = true;
};

const fetchWeatherJson = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.reason || "Weather data unavailable");
    return data;
};

const closeSuggestions = () => {
    citySuggestions.innerHTML = "";
    citySuggestions.classList.remove("open");
    cityInput.setAttribute("aria-expanded", "false");
    suggestedLocations = [];
    activeSuggestion = -1;
};

const showSuggestions = locations => {
    suggestedLocations = locations;
    citySuggestions.innerHTML = "";

    locations.forEach((location, index) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const region = location.admin1 || location.country;

        item.setAttribute("role", "option");
        button.className = "city-suggestion";
        button.type = "button";
        button.dataset.index = index;
        button.textContent = `${location.name}, ${region}`;

        const country = document.createElement("small");
        country.textContent = location.country;
        button.append(country);
        item.append(button);
        citySuggestions.append(item);
    });

    citySuggestions.classList.toggle("open", locations.length > 0);
    cityInput.setAttribute("aria-expanded", locations.length > 0);
};

const findSuggestions = async city => {
    if (city.length < 2) {
        closeSuggestions();
        return;
    }

    try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`);
        const data = await response.json();
        showSuggestions(data.results || []);
    } catch (error) {
        closeSuggestions();
    }
};

cityInput?.addEventListener("input", () => {
    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(() => findSuggestions(cityInput.value.trim()), 250);
});

cityInput?.addEventListener("keydown", event => {
    if (!suggestedLocations.length) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        activeSuggestion = event.key === "ArrowDown"
            ? (activeSuggestion + 1) % suggestedLocations.length
            : (activeSuggestion - 1 + suggestedLocations.length) % suggestedLocations.length;
        document.querySelectorAll(".city-suggestion").forEach((button, index) => {
            button.classList.toggle("active", index === activeSuggestion);
        });
    }

    if (event.key === "Enter" && activeSuggestion >= 0) {
        event.preventDefault();
        cityInput.value = suggestedLocations[activeSuggestion].name;
        closeSuggestions();
        loadWeather(cityInput.value);
    }

    if (event.key === "Escape") closeSuggestions();
});

citySuggestions?.addEventListener("click", event => {
    const button = event.target.closest(".city-suggestion");
    if (!button) return;
    cityInput.value = suggestedLocations[Number(button.dataset.index)].name;
    closeSuggestions();
    loadWeather(cityInput.value);
});

document.addEventListener("click", event => {
    if (!event.target.closest(".weather-input-wrap")) closeSuggestions();
});

const loadWeather = async city => {
    const trimmedCity = city.trim();
    if (!trimmedCity) {
        showWeatherError("Enter a city to see its forecast.");
        return;
    }

    weatherStatus.textContent = `Finding ${trimmedCity}...`;
    weatherStatus.classList.remove("error");
    weatherDashboard.hidden = false;

    try {
        closeSuggestions();
        const locationData = await fetchWeatherJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedCity)}&count=1&language=en&format=json`);
        const location = locationData.results?.[0];
        if (!location) throw new Error("City not found");

        const data = await fetchWeatherJson(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`);
        const current = data.current;
        const [description, icon] = getWeatherLabel(current.weather_code);

        document.querySelector("#weather-location").textContent = `${location.name}, ${location.country}`;
        document.querySelector("#weather-date").textContent = "Right now";
        document.querySelector("#weather-icon").textContent = icon;
        document.querySelector("#weather-temperature").textContent = `${Math.round(current.temperature_2m)}°`;
        document.querySelector("#weather-description").textContent = description;
        document.querySelector("#weather-feels").textContent = `${Math.round(current.apparent_temperature)}°`;
        document.querySelector("#weather-humidity").textContent = `${current.relative_humidity_2m}%`;
        document.querySelector("#weather-wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;

        document.querySelector("#forecast-list").innerHTML = data.daily.time.map((date, index) => {
            const [dayDescription, dayIcon] = getWeatherLabel(data.daily.weather_code[index]);
            return `<div class="forecast-day" title="${dayDescription}">
                <strong>${index === 0 ? "Today" : formatDay(date)}</strong>
                <span class="forecast-icon" aria-hidden="true">${dayIcon}</span>
                <span>${Math.round(data.daily.temperature_2m_max[index])}° / ${Math.round(data.daily.temperature_2m_min[index])}°</span>
            </div>`;
        }).join("");

        weatherStatus.textContent = `Updated for ${location.timezone.replaceAll("_", " ")}`;
    } catch (error) {
        showWeatherError(error.message === "City not found"
            ? "That city was not found. Try a nearby city or country."
            : "Weather is unavailable right now. Check your connection and try again.");
    }
};

weatherForm?.addEventListener("submit", event => {
    event.preventDefault();
    loadWeather(cityInput.value.trim());
});

if (weatherForm) loadWeather(cityInput.value);

const currencyForm = document.querySelector("#currency-form");
const currencyAmount = document.querySelector("#currency-amount");
const currencyFrom = document.querySelector("#currency-from");
const currencyTo = document.querySelector("#currency-to");
const swapCurrency = document.querySelector("#swap-currency");
const currencyOutput = document.querySelector("#currency-output");
const currencyRate = document.querySelector("#currency-rate");
const currencyUpdate = document.querySelector("#currency-update");
let exchangeRates = {};

const getCurrencyName = code => {
    try {
        return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) || code;
    } catch (error) {
        return code;
    }
};

const formatMoney = (amount, code) => new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2
}).format(amount);

const populateCurrencies = rates => {
    const currencyOptions = Object.keys(rates)
        .sort()
        .map(code => `<option value="${code}">${code} - ${getCurrencyName(code)}</option>`)
        .join("");

    currencyFrom.innerHTML = currencyOptions;
    currencyTo.innerHTML = currencyOptions;
    currencyFrom.value = "NGN";
    currencyTo.value = "USD";
};

const convertCurrency = () => {
    const amount = Number(currencyAmount.value);
    const fromRate = exchangeRates[currencyFrom.value];
    const toRate = exchangeRates[currencyTo.value];

    if (!Number.isFinite(amount) || amount < 0 || !fromRate || !toRate) return;

    const convertedAmount = amount * (toRate / fromRate);
    const oneUnitRate = toRate / fromRate;
    currencyOutput.textContent = `${formatMoney(convertedAmount, currencyTo.value)}`;
    currencyRate.textContent = `1 ${currencyFrom.value} = ${formatMoney(oneUnitRate, currencyTo.value)}`;
};

const loadCurrencyRates = async () => {
    try {
        const response = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await response.json();
        if (data.result !== "success") throw new Error("Exchange rates unavailable");

        exchangeRates = { ...data.rates, USD: 1 };
        populateCurrencies(exchangeRates);
        currencyUpdate.textContent = `Rates updated ${data.time_last_update_utc || "recently"}`;
        convertCurrency();
    } catch (error) {
        currencyOutput.textContent = "Rates unavailable";
        currencyRate.textContent = "Please try again later.";
        currencyUpdate.textContent = "Unable to update rates";
    }
};

currencyForm?.addEventListener("submit", event => {
    event.preventDefault();
    convertCurrency();
});

[currencyAmount, currencyFrom, currencyTo].forEach(control => {
    control?.addEventListener("input", convertCurrency);
    control?.addEventListener("change", convertCurrency);
});

swapCurrency?.addEventListener("click", () => {
    const currentFrom = currencyFrom.value;
    currencyFrom.value = currencyTo.value;
    currencyTo.value = currentFrom;
    convertCurrency();
});

if (currencyForm) loadCurrencyRates();

const scoresStatus = document.querySelector("#scores-status");
const scoresList = document.querySelector("#scores-list");
const scoresDate = document.querySelector("#scores-date");
const leagueSelect = document.querySelector("#league-select");
const teamSearchForm = document.querySelector("#team-search-form");
const teamSearchInput = document.querySelector("#team-search-input");

const premierLeagueName = "English Premier League";

const getLocalDateKey = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const fetchScoresJson = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Scores request failed: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.message || "Scores unavailable");
    return data;
};

const sortMatches = matches => [...matches].sort((first, second) => {
    const firstPremierLeague = first.strLeague === premierLeagueName;
    const secondPremierLeague = second.strLeague === premierLeagueName;
    if (firstPremierLeague !== secondPremierLeague) return firstPremierLeague ? -1 : 1;

    const firstStatus = getMatchStatus(first)[1];
    const secondStatus = getMatchStatus(second)[1];
    const firstLive = firstStatus === "live";
    const secondLive = secondStatus === "live";
    if (firstLive !== secondLive) return firstLive ? -1 : 1;

    return new Date(first.strTimestamp || 0) - new Date(second.strTimestamp || 0);
});

const formatMatchTime = date => date
    ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(date))
    : "Time TBC";

const getMatchStatus = match => {
    if (match.strStatus === "Match Finished" || match.strStatus === "FT") return ["Finished", "finished"];
    if (match.strStatus === "Postponed") return ["Postponed", "postponed"];
    if (match.strStatus === "Cancelled") return ["Cancelled", "cancelled"];
    if (["In Progress", "Live", "1H", "2H", "HT", "ET", "P"].includes(match.strStatus)) {
        return [match.strProgress || match.strStatus, "live"];
    }
    return ["Upcoming", "upcoming"];
};

const formatDetailList = value => {
    if (!value) return "Not published yet";
    return value.split(/[;|\n]+/).map(item => item.trim()).filter(Boolean).join(" • ");
};

const getLineupState = match => {
    const kickoff = new Date(match.strTimestamp || 0).getTime();
    const oneHourBefore = kickoff - 60 * 60 * 1000;
    const lineupPublished = match.strHomeLineup || match.strAwayLineup;

    if (lineupPublished && Date.now() >= oneHourBefore) return "Confirmed lineup";
    if (lineupPublished) return "Possible lineup";
    if (Date.now() >= oneHourBefore) return "Lineup not published";
    return "Possible lineup pending";
};

const loadMatchDetails = async (matchId, details, teamSide) => {
    details.hidden = false;
    details.innerHTML = "<p>Loading match details...</p>";

    try {
        const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=${matchId}`);
        const data = await response.json();
        const match = data.events?.[0];
        if (!match) throw new Error("Match details unavailable");

        const teamName = teamSide === "home" ? match.strHomeTeam : match.strAwayTeam;
        const lineup = teamSide === "home" ? match.strHomeLineup : match.strAwayLineup;
        const stats = teamSide === "home" ? match.strHomeStats : match.strAwayStats;
        const formation = teamSide === "home" ? match.strHomeFormation : match.strAwayFormation;
        const commentary = match.strComments || match.strEventAlternate || "Commentary is not available yet.";

        details.innerHTML = `
            <div class="match-detail-heading">
                <strong>${teamName}</strong>
                <span>${getLineupState(match)}</span>
            </div>
            <div class="match-detail-grid">
                <div><small>Lineup</small><p>${formatDetailList(lineup)}</p></div>
                <div><small>Formation</small><p>${formation || "Not published yet"}</p></div>
                <div><small>Team stats</small><p>${formatDetailList(stats)}</p></div>
                <div><small>Commentary</small><p>${commentary}</p></div>
            </div>`;
    } catch (error) {
        details.innerHTML = "<p>Match details are unavailable right now. Please try again.</p>";
    }
};

const renderScores = matches => {
    if (!matches.length) {
        scoresList.innerHTML = '<div class="scores-empty">No football matches are listed for today. Check back on the next matchday.</div>';
        return;
    }

    const leagues = sortMatches(matches).reduce((groups, match) => {
        const league = match.strLeague || "Football";
        (groups[league] ||= []).push(match);
        return groups;
    }, {});

    scoresList.innerHTML = Object.entries(leagues).map(([league, leagueMatches]) => `
        <section class="score-league">
            <h3>${league}</h3>
            ${leagueMatches.map(match => {
        const [status, statusClass] = getMatchStatus(match);
        const homeScore = match.intHomeScore ?? "-";
        const awayScore = match.intAwayScore ?? "-";
        return `<div class="score-match" data-event-id="${match.idEvent}">
                    <span class="match-time">${statusClass === "upcoming" ? formatMatchTime(match.strTimestamp) : status}</span>
                    <div class="match-teams">
                        <button class="team-button" type="button" data-team-side="home" aria-expanded="false">${match.strHomeTeam}</button>
                        <button class="team-button" type="button" data-team-side="away" aria-expanded="false">${match.strAwayTeam}</button>
                    </div>
                    <span class="match-result ${statusClass}"><strong>${homeScore} - ${awayScore}</strong>${statusClass === "upcoming" ? "" : status}</span>
                    <div class="match-details" hidden></div>
                </div>`;
    }).join("")}
        </section>`).join("");
};

scoresList?.addEventListener("click", event => {
    const teamButton = event.target.closest(".team-button");
    if (!teamButton) return;
    const match = teamButton.closest(".score-match");
    const details = match.querySelector(".match-details");

    if (!details.hidden && details.dataset.teamSide === teamButton.dataset.teamSide) {
        details.hidden = true;
        teamButton.setAttribute("aria-expanded", "false");
        return;
    }

    scoresList.querySelectorAll(".match-details").forEach(item => {
        item.hidden = true;
    });
    scoresList.querySelectorAll(".team-button").forEach(button => {
        button.setAttribute("aria-expanded", "false");
    });

    details.dataset.teamSide = teamButton.dataset.teamSide;
    teamButton.setAttribute("aria-expanded", "true");
    loadMatchDetails(match.dataset.eventId, details, teamButton.dataset.teamSide);
});

const loadScores = async () => {
    const today = new Date();
    const date = getLocalDateKey(today);
    scoresDate.textContent = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(today);

    try {
        const league = leagueSelect.value;
        const leagueQuery = league ? `&l=${encodeURIComponent(league)}` : "";
        const data = await fetchScoresJson(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${date}&s=Soccer${leagueQuery}`);
        const matches = (data.events || []).filter(match => match.strSport === "Soccer");
        renderScores(matches);
        const selectedLabel = league || "all football";
        scoresStatus.textContent = `Updated ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date())} for ${selectedLabel}. Refreshing automatically.`;
        scoresStatus.classList.remove("error");
    } catch (error) {
        scoresStatus.textContent = "Live scores are unavailable right now. Please try again later.";
        scoresStatus.classList.add("error");
    }
};

const loadTeamMatches = async teamName => {
    scoresStatus.textContent = `Searching for ${teamName}...`;
    scoresStatus.classList.remove("error");

    try {
        const searchData = await fetchScoresJson(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`);
        const team = searchData.teams?.find(item => item.strSport === "Soccer") || searchData.teams?.[0];
        if (!team) throw new Error("Team not found");

        const [lastData, nextData] = await Promise.all([
            fetchScoresJson(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${team.idTeam}`),
            fetchScoresJson(`https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${team.idTeam}`)
        ]);
        const matches = [...(lastData.results || []), ...(nextData.events || [])]
            .filter(match => match.strSport === "Soccer")
            .sort((first, second) => new Date(first.strTimestamp || 0) - new Date(second.strTimestamp || 0));

        scoresDate.textContent = team.strTeam;
        renderScores(matches);
        scoresStatus.textContent = matches.length
            ? `Showing recent and upcoming matches for ${team.strTeam}.`
            : `No recent or upcoming matches found for ${team.strTeam}.`;
    } catch (error) {
        scoresList.innerHTML = '<div class="scores-empty">We could not find that team. Try a full team name.</div>';
        scoresStatus.textContent = "Team search is unavailable right now.";
        scoresStatus.classList.add("error");
    }
};

let refreshScores = loadScores;

if (scoresList) {
    loadScores();
    leagueSelect?.addEventListener("change", () => {
        refreshScores = loadScores;
        loadScores();
    });
    teamSearchForm?.addEventListener("submit", event => {
        event.preventDefault();
        const teamName = teamSearchInput.value.trim();
        refreshScores = () => loadTeamMatches(teamName);
        loadTeamMatches(teamName);
    });
    window.setInterval(() => refreshScores(), 300000);
}

// Always use dark mode
document.body.classList.add("dark");

// Mobile menu
menuButton?.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");

    menuButton.setAttribute("aria-expanded", isOpen);
    menuButton.textContent = isOpen ? "✕" : "☰";
});

document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuButton.textContent = "☰";
        menuButton.setAttribute("aria-expanded", "false");
    });
});

// Project filtering
document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelector(".filter.active")?.classList.remove("active");
        button.classList.add("active");

        const selectedCategory = button.dataset.filter;

        document.querySelectorAll(".project-card").forEach(project => {
            project.style.display =
                selectedCategory === "all" ||
                    project.dataset.category === selectedCategory
                    ? "block"
                    : "none";
        });
    });
});

// Scroll reveal animation
if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll(".reveal").forEach(element => {
        revealObserver.observe(element);
    });
}

// Contact form
contactForm?.addEventListener("submit", event => {
    event.preventDefault();

    const name = contactForm.querySelector('[name="name"]').value.trim();
    const email = contactForm.querySelector('[name="email"]').value.trim();
    const message = contactForm.querySelector('[name="message"]').value.trim();
    const subject = `Portfolio message from ${name}`;
    const body = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

    formMessage.textContent = "Opening your email app...";
    window.location.href = `mailto:raheemkhalid817@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

});