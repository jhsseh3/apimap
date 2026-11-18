const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const MIN_GEOCODE_INTERVAL_MS = 1000;

const places = {
  origin: null,
  destination: null,
};

const searchButtons = [...document.querySelectorAll("[data-search]")];
const calculateButton = document.querySelector("#calculate-button");
const formMessage = document.querySelector("#form-message");
const resultCard = document.querySelector("#result-card");
const distanceValue = document.querySelector("#distance-value");
const routeSummary = document.querySelector("#route-summary");
const mapLink = document.querySelector("#map-link");
let lastGeocodeTime = 0;
let activeRouteRequest = 0;
let geocodeQueue = Promise.resolve();
const searchRequestIds = { origin: 0, destination: 0 };

function setStatus(field, message, state = "") {
  const status = document.querySelector(`#${field}-status`);
  status.textContent = message;
  status.className = `field-status${state ? ` ${state}` : ""}`;
}

function setFormMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.className = `form-message${isError ? " error" : ""}`;
}

function updateCalculateButton() {
  calculateButton.disabled = !places.origin || !places.destination;
}

function invalidateRoute() {
  activeRouteRequest += 1;
  calculateButton.querySelector("span").textContent = "거리 계산하기";
  updateCalculateButton();
}

function formatPlace(result) {
  const address = result.address || {};
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    address.state ||
    "";
  const country = address.country || "";
  return [locality, country].filter(Boolean).join(", ");
}

function renderResults(field, results) {
  const container = document.querySelector(`#${field}-results`);
  container.replaceChildren();

  for (const result of results) {
    const option = document.createElement("button");
    const title = document.createElement("strong");
    const subtitle = document.createElement("span");
    option.type = "button";
    option.className = "result-option";
    option.setAttribute("role", "option");
    title.textContent = result.name || result.display_name.split(",")[0];
    subtitle.textContent = result.display_name;
    option.append(title, subtitle);
    option.addEventListener("click", () => {
      invalidateRoute();
      places[field] = {
        name: title.textContent,
        displayName: result.display_name,
        lat: Number(result.lat),
        lon: Number(result.lon),
      };
      document.querySelector(`#${field}-input`).value = title.textContent;
      container.hidden = true;
      setStatus(field, `${title.textContent}${formatPlace(result) ? ` · ${formatPlace(result)}` : ""} 선택됨`, "success");
      updateCalculateButton();
      resultCard.hidden = true;
      setFormMessage("");
    });
    container.append(option);
  }

  container.hidden = results.length === 0;
}

function fetchGeocode(url) {
  const request = geocodeQueue.then(async () => {
    const wait = Math.max(0, MIN_GEOCODE_INTERVAL_MS - (Date.now() - lastGeocodeTime));
    if (wait > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, wait));
    }
    lastGeocodeTime = Date.now();
    return fetch(url, { headers: { Accept: "application/json" } });
  });
  geocodeQueue = request.then(
    () => undefined,
    () => undefined,
  );
  return request;
}

async function searchPlace(field) {
  const button = searchButtons.find((item) => item.dataset.search === field);
  if (button.disabled) return;
  const input = document.querySelector(`#${field}-input`);
  const query = input.value.trim();

  if (!query) {
    setStatus(field, "장소 이름을 입력해 주세요.", "error");
    input.focus();
    return;
  }

  const requestId = ++searchRequestIds[field];
  invalidateRoute();
  places[field] = null;
  updateCalculateButton();
  resultCard.hidden = true;
  document.querySelector(`#${field}-results`).hidden = true;
  setFormMessage("");
  setStatus(field, "실제 장소를 찾고 있어요...");
  button.disabled = true;

  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      "accept-language": "ko",
    });
    const response = await fetchGeocode(`${NOMINATIM_URL}?${params.toString()}`);
    if (requestId !== searchRequestIds[field]) return;
    if (!response.ok) {
      throw new Error(`장소 검색 요청이 실패했습니다. (${response.status})`);
    }

    const results = await response.json();
    if (!Array.isArray(results)) {
      throw new Error("장소 검색 결과를 읽을 수 없습니다.");
    }
    if (results.length === 0) {
      setStatus(field, "장소를 찾지 못했어요. 다른 이름으로 검색해 주세요.", "error");
      return;
    }

    renderResults(field, results);
    setStatus(field, "검색 결과에서 정확한 장소를 선택해 주세요.");
  } catch (error) {
    if (requestId === searchRequestIds[field]) {
      setStatus(field, error.message || "장소 검색 중 문제가 발생했습니다. 다시 시도해 주세요.", "error");
    }
  } finally {
    if (requestId === searchRequestIds[field]) button.disabled = false;
  }
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString("ko-KR")} m`;
  }

  const kilometers = meters / 1000;
  const digits = kilometers < 10 ? 1 : 0;
  return `${kilometers.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} km`;
}

async function calculateDistance() {
  if (!places.origin || !places.destination) {
    setFormMessage("출발지와 도착지를 먼저 검색하고 선택해 주세요.", true);
    return;
  }

  const requestId = ++activeRouteRequest;
  calculateButton.disabled = true;
  calculateButton.querySelector("span").textContent = "경로를 찾고 있어요...";
  setFormMessage("");
  resultCard.hidden = true;

  try {
    const coordinates = `${places.origin.lon},${places.origin.lat};${places.destination.lon},${places.destination.lat}`;
    const response = await fetch(`${OSRM_URL}/${coordinates}?overview=false&steps=false`);
    if (!response.ok) {
      throw new Error(`경로 요청이 실패했습니다. (${response.status})`);
    }

    const data = await response.json();
    if (requestId !== activeRouteRequest) return;
    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error("두 장소 사이의 자동차 경로를 찾지 못했어요.");
    }

    const route = data.routes[0];
    distanceValue.textContent = formatDistance(route.distance);
    routeSummary.textContent = `${places.origin.name}에서 ${places.destination.name}까지의 자동차 경로`;
    mapLink.href = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${places.origin.lat}%2C${places.origin.lon}%3B${places.destination.lat}%2C${places.destination.lon}`;
    resultCard.hidden = false;
  } catch (error) {
    if (requestId === activeRouteRequest) {
      setFormMessage(error.message || "경로를 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.", true);
    }
  } finally {
    if (requestId === activeRouteRequest) {
      calculateButton.disabled = false;
      calculateButton.querySelector("span").textContent = "거리 계산하기";
    }
  }
}

for (const button of searchButtons) {
  const field = button.dataset.search;
  button.addEventListener("click", () => searchPlace(field));
  document.querySelector(`#${field}-input`).addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchPlace(field);
    }
  });
  document.querySelector(`#${field}-input`).addEventListener("input", () => {
    searchRequestIds[field] += 1;
    button.disabled = false;
    if (places[field]) {
      places[field] = null;
      invalidateRoute();
      resultCard.hidden = true;
    }
    document.querySelector(`#${field}-results`).hidden = true;
    setStatus(field, "");
  });
}

calculateButton.addEventListener("click", calculateDistance);
