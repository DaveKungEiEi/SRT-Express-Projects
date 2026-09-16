"use strict";

const {
  stations,
  lineLabels,
  getStation,
  getPrimaryLine,
  getRoute,
  getEligibility,
  calculateCosts,
  getRouteJourney,
  routeHubName,
  calculateLegacyFreightEstimate,
} = window.SRTCalculator;

const elements = {
  header: document.querySelector(".site-header"),
  menuToggle: document.querySelector(".menu-toggle"),
  mainNav: document.querySelector(".main-nav"),
  form: document.querySelector("#shipping-form"),
  origin: document.querySelector("#origin"),
  destination: document.querySelector("#destination"),
  swap: document.querySelector("#swap-route"),
  pieces: document.querySelector("#pieces"),
  weight: document.querySelector("#weight"),
  length: document.querySelector("#length"),
  width: document.querySelector("#width"),
  height: document.querySelector("#height"),
  railDistance: document.querySelector("#rail-distance"),
  distanceHint: document.querySelector("#distance-hint"),
  packing: document.querySelector("#packing"),
  originAccess: document.querySelector("#origin-access"),
  destinationAccess: document.querySelector("#destination-access"),
  optionalToggle: document.querySelector("#optional-toggle"),
  optionalPanel: document.querySelector("#optional-panel"),
  routePreview: document.querySelector("#route-preview"),
  routeBadge: document.querySelector("#route-badge"),
  routeDescription: document.querySelector("#route-description"),
  weightStatus: document.querySelector("#weight-status"),
  sizeStatus: document.querySelector("#size-status"),
  weightMeter: document.querySelector("#weight-meter"),
  sizeMeter: document.querySelector("#size-meter"),
  quoteResult: document.querySelector("#quote-result"),
  manualQuote: document.querySelector("#manual-quote"),
  manualReason: document.querySelector("#manual-reason"),
  resultRoute: document.querySelector("#result-route"),
  resultMode: document.querySelector("#result-mode"),
  grandTotal: document.querySelector("#grand-total"),
  freightLabel: document.querySelector("#freight-label"),
  freightTotal: document.querySelector("#freight-total"),
  packingTotal: document.querySelector("#packing-total"),
  accessTotal: document.querySelector("#access-total"),
  legacyRows: document.querySelectorAll("[data-legacy-row]"),
  distanceTotal: document.querySelector("#distance-total"),
  ordinaryTotal: document.querySelector("#ordinary-total"),
  expressTotal: document.querySelector("#express-total"),
  feeTotal: document.querySelector("#fee-total"),
  minimumTotal: document.querySelector("#minimum-total"),
  deliveryTime: document.querySelector("#delivery-time"),
  resultDisclaimer: document.querySelector("#result-disclaimer"),
  journeyDistance: document.querySelector("#journey-distance"),
  journeyStations: document.querySelector("#journey-stations"),
  journeyOrigin: document.querySelector("#journey-origin"),
  journeyDestination: document.querySelector("#journey-destination"),
  journeySummary: document.querySelector("#journey-summary"),
  routeDetail: document.querySelector("#route-detail"),
  routeToggleLabel: document.querySelector("#route-toggle-label"),
  routeTimeline: document.querySelector("#route-timeline"),
  routeDataNote: document.querySelector("#route-data-note"),
};

const excludedStationTypes = new Set(["ที่หยุดรถ", "ป้ายหยุดรถ", "ทีหยุดรถ"]);
const selectableStations = stations.filter((station) => !excludedStationTypes.has(station.note.trim()));

function normalizeStationSearch(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("th-TH")
    .replace(/[.\s\-–—()（）]/g, "");
}

const stationSearchEntries = selectableStations.map((station) => ({
  station,
  searchText: normalizeStationSearch(`${station.name} ${station.code || ""}`),
}));

document.querySelector("#selectable-station-count").textContent = selectableStations.length.toLocaleString("th-TH");

function getSelectedStation(input) {
  return getStation(input.dataset.stationId || "");
}

function findExactStation(value) {
  const query = normalizeStationSearch(value);
  if (!query) return null;
  const matches = selectableStations.filter((station) =>
    normalizeStationSearch(station.name) === query
    || (station.code && normalizeStationSearch(station.code) === query));
  return matches.length === 1 ? matches[0] : null;
}

function updateStationInputState(input) {
  input.closest("[data-station-combobox]").classList.toggle("has-value", Boolean(input.value));
}

function closeStationOptions(input) {
  const list = document.querySelector(`#${input.getAttribute("aria-controls")}`);
  list.hidden = true;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
}

function setStationInput(input, station) {
  input.value = station?.name || "";
  input.dataset.stationId = station?.id || "";
  updateStationInputState(input);
  closeStationOptions(input);
}

function createStationCombobox(input) {
  const combobox = input.closest("[data-station-combobox]");
  const list = combobox.querySelector("[role='listbox']");
  const clearButton = combobox.querySelector(".station-clear");
  let visibleStations = [];
  let activeIndex = -1;

  function setActiveOption(index) {
    const options = Array.from(list.querySelectorAll("[role='option']"));
    if (!options.length) return;
    activeIndex = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((option, optionIndex) => {
      const active = optionIndex === activeIndex;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", String(active));
    });
    const activeOption = options[activeIndex];
    input.setAttribute("aria-activedescendant", activeOption.id);
    activeOption.scrollIntoView({ block: "nearest" });
  }

  function renderOptions(query = "") {
    const normalizedQuery = normalizeStationSearch(query);
    visibleStations = stationSearchEntries
      .filter((entry) => !normalizedQuery || entry.searchText.includes(normalizedQuery))
      .map((entry) => entry.station);
    activeIndex = -1;
    list.replaceChildren();

    if (!visibleStations.length) {
      const empty = document.createElement("p");
      empty.className = "station-options-empty";
      empty.textContent = "ไม่พบสถานีจากชื่อหรือรหัสที่พิมพ์";
      list.append(empty);
    } else {
      visibleStations.forEach((station, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.id = `${input.id}-option-${station.id}`;
        option.className = "station-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.dataset.stationId = station.id;

        const name = document.createElement("span");
        name.className = "station-option-name";
        name.textContent = station.name;
        const meta = document.createElement("span");
        meta.className = "station-option-meta";
        if (station.code) {
          const code = document.createElement("b");
          code.textContent = station.code;
          meta.append(code);
        }
        const line = document.createElement("small");
        line.textContent = lineLabels[getPrimaryLine(station)] || "เครือข่าย รฟท.";
        meta.append(line);
        option.append(name, meta);
        list.append(option);
      });
    }

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function chooseStation(station) {
    setStationInput(input, station);
    clearFieldError(input);
    updateRoutePreview();
  }

  function chooseExactMatch() {
    const station = findExactStation(input.value);
    if (!station) return false;
    chooseStation(station);
    return true;
  }

  input.addEventListener("focus", () => renderOptions(input.value));
  input.addEventListener("input", () => {
    const selected = getSelectedStation(input);
    if (!selected || input.value !== selected.name) input.dataset.stationId = "";
    updateStationInputState(input);
    clearFieldError(input);
    renderOptions(input.value);
    updateRoutePreview();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (list.hidden) renderOptions(input.value);
      setActiveOption(event.key === "ArrowDown" ? activeIndex + 1 : activeIndex <= 0 ? visibleStations.length - 1 : activeIndex - 1);
    } else if (event.key === "Enter") {
      if (!list.hidden && activeIndex >= 0 && visibleStations[activeIndex]) {
        event.preventDefault();
        chooseStation(visibleStations[activeIndex]);
      } else if (chooseExactMatch()) {
        event.preventDefault();
      }
    } else if (event.key === "Escape") {
      closeStationOptions(input);
    }
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (!getSelectedStation(input)) chooseExactMatch();
      closeStationOptions(input);
    }, 120);
  });

  list.addEventListener("mousedown", (event) => event.preventDefault());
  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-station-id]");
    if (!option) return;
    chooseStation(getStation(option.dataset.stationId));
    input.focus();
  });
  clearButton.addEventListener("click", () => {
    setStationInput(input, null);
    clearFieldError(input);
    updateRoutePreview();
    input.focus();
    renderOptions();
  });
  updateStationInputState(input);
}

createStationCombobox(elements.origin);
createStationCombobox(elements.destination);

function selectedRoute() {
  const origin = getSelectedStation(elements.origin);
  const destination = getSelectedStation(elements.destination);
  if (!origin || !destination || origin.id === destination.id) return null;
  return { origin, destination, route: getRoute(origin, destination) };
}

function updateDistanceHint() {
  const selection = selectedRoute();
  if (!selection) {
    elements.distanceHint.textContent = "เว้นว่างเพื่อให้ระบบประมาณจากแนวโครงข่ายและแสดงทุกสถานีที่ผ่าน";
    return;
  }
  const journey = getRouteJourney(selection.origin, selection.destination);
  elements.distanceHint.textContent = journey
    ? `ระบบจะใช้ประมาณ ${journey.kilometers.toLocaleString("th-TH")} กม. ผ่าน ${journey.stops.length.toLocaleString("th-TH")} สถานี (${journey.basis})`
    : "เส้นทางนี้ไม่มีพิกัดเพียงพอ กรุณากรอกระยะทางทางราง";
}

function updateRoutePreview() {
  const selection = selectedRoute();
  if (!selection) {
    elements.routePreview.hidden = true;
    updateDistanceHint();
    return;
  }

  elements.routeBadge.textContent = selection.route.label;
  elements.routeBadge.style.background = selection.route.type === "cross" ? "#741f2b" : "#1d6c50";
  elements.routeDescription.textContent = selection.route.description;
  elements.routePreview.hidden = false;
  updateDistanceHint();
}

function numberValue(input) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : 0;
}

function updateLimits() {
  const weight = numberValue(elements.weight);
  const dimensions = [numberValue(elements.length), numberValue(elements.width), numberValue(elements.height)];
  const largestSide = Math.max(...dimensions);
  const weightPercent = Math.min(Math.max((weight / 2) * 100, 0), 100);
  const sizePercent = Math.min(Math.max((largestSide / 50) * 100, 0), 100);
  const weightOk = weight > 0 && weight <= 2;
  const sizeOk = dimensions.every((value) => value > 0 && value <= 50);

  elements.weightMeter.style.width = `${weightPercent}%`;
  elements.sizeMeter.style.width = `${sizePercent}%`;
  elements.weightMeter.style.background = weightOk ? "#1d6c50" : "#b02b3b";
  elements.sizeMeter.style.background = sizeOk ? "#1d6c50" : "#b02b3b";
  elements.weightStatus.textContent = weightOk ? `${weight.toFixed(1)} / 2 กก.` : "คำนวณนอก One Price";
  elements.sizeStatus.textContent = sizeOk ? `${largestSide || 0} / 50 ซม.` : "คำนวณนอก One Price";
  elements.weightStatus.classList.toggle("over-limit", !weightOk);
  elements.sizeStatus.classList.toggle("over-limit", !sizeOk);
}

function clearFieldError(field) {
  field.classList.remove("is-invalid");
  const error = document.querySelector(`#${field.id}-error`);
  if (error) error.textContent = "";
}

function setFieldError(field, message) {
  field.classList.add("is-invalid");
  const error = document.querySelector(`#${field.id}-error`);
  if (error) error.textContent = message;
}

function validateForm() {
  let valid = true;
  clearFieldError(elements.origin);
  clearFieldError(elements.destination);
  const origin = getSelectedStation(elements.origin) || findExactStation(elements.origin.value);
  const destination = getSelectedStation(elements.destination) || findExactStation(elements.destination.value);

  if (origin) setStationInput(elements.origin, origin);
  if (destination) setStationInput(elements.destination, destination);

  if (!origin) {
    setFieldError(elements.origin, "กรุณาพิมพ์และเลือกสถานีต้นทางจากรายการ");
    valid = false;
  }
  if (!destination) {
    setFieldError(elements.destination, "กรุณาพิมพ์และเลือกสถานีปลายทางจากรายการ");
    valid = false;
  }
  if (origin && destination && origin.id === destination.id) {
    setFieldError(elements.destination, "สถานีปลายทางต้องต่างจากต้นทาง");
    valid = false;
  }

  [elements.pieces, elements.weight, elements.length, elements.width, elements.height].forEach((field) => {
    const invalid = !field.value || numberValue(field) <= 0;
    field.classList.toggle("is-invalid", invalid);
    if (invalid) valid = false;
  });
  if (elements.railDistance.value && numberValue(elements.railDistance) <= 0) {
    elements.railDistance.classList.add("is-invalid");
    valid = false;
  } else {
    elements.railDistance.classList.remove("is-invalid");
  }

  return valid;
}

function formatBaht(value) {
  const hasSatang = Math.abs(value - Math.round(value)) > 0.001;
  return `${new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: hasSatang ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)} บาท`;
}

function showLegacyRows(show) {
  elements.legacyRows.forEach((row) => {
    row.hidden = !show;
  });
}

function formatKilometers(value) {
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return rounded.toLocaleString("th-TH", { maximumFractionDigits: 1 });
}

function renderJourney(journey, distanceOverride = 0) {
  const displayedDistance = distanceOverride || journey.kilometers;
  const scale = distanceOverride && journey.rawKilometers
    ? displayedDistance / journey.rawKilometers
    : 1;
  const origin = journey.stops[0];
  const destination = journey.stops[journey.stops.length - 1];
  const intermediateStops = journey.stops.slice(1, -1);
  elements.journeyDistance.textContent = displayedDistance.toLocaleString("th-TH", { maximumFractionDigits: 1 });
  elements.journeyStations.textContent = journey.stops.length.toLocaleString("th-TH");
  elements.journeyOrigin.textContent = origin.station.name;
  elements.journeyDestination.textContent = destination.station.name;
  elements.journeySummary.textContent = journey.forcedHub
    ? `${intermediateStops.length.toLocaleString("th-TH")} สถานี · ผ่าน${routeHubName}`
    : `${intermediateStops.length.toLocaleString("th-TH")} สถานีคั่นกลาง`;
  elements.routeDetail.hidden = intermediateStops.length === 0;
  elements.routeDetail.open = false;
  elements.routeToggleLabel.textContent = "ดูสถานีระหว่างทาง";
  elements.routeTimeline.replaceChildren();

  intermediateStops.forEach((stop) => {
    const distanceFromPrevious = stop.distanceFromPrevious * scale;
    const cumulativeDistance = stop.cumulativeKilometers * scale;
    const isHub = stop.station.id === journey.hubId;
    const item = document.createElement("li");
    item.className = "route-stop";
    if (isHub) item.classList.add("is-hub");
    if (stop.transfer) item.classList.add("is-transfer");

    const marker = document.createElement("span");
    marker.className = "route-stop-marker";
    marker.setAttribute("aria-hidden", "true");
    const content = document.createElement("div");
    content.className = "route-stop-content";
    const heading = document.createElement("p");
    heading.className = "route-stop-name";
    heading.textContent = stop.station.name;
    if (isHub) {
      const badge = document.createElement("b");
      badge.textContent = "จุดศูนย์กลาง";
      heading.append(badge);
    }
    const meta = document.createElement("small");
    if (stop.transfer) {
      meta.textContent = `${stop.transferLabel} · ประมาณ ${formatKilometers(distanceFromPrevious)} กม.`;
    } else {
      meta.textContent = `จากสถานีก่อนหน้า ${formatKilometers(distanceFromPrevious)} กม. · สะสม ${formatKilometers(cumulativeDistance)} กม.`;
    }
    content.append(heading, meta);
    item.append(marker, content);
    elements.routeTimeline.append(item);
  });

  const distanceBasis = distanceOverride
    ? "ระยะทางรวมยึดตามค่าที่ผู้ใช้กรอก และกระจายตามสัดส่วนของแต่ละช่วง"
    : "ระยะทางเป็นค่าประมาณจากแนวโครงข่ายและพิกัดสถานี";
  const transferNote = journey.transferCount
    ? " เส้นทางสายแม่กลองมีช่วงเปลี่ยนถ่ายที่ไม่ได้ต่อเนื่องด้วยราง"
    : "";
  elements.routeDataNote.textContent =
    `${distanceBasis} รายการนี้แสดงสถานีบนแนวทางที่ระบบจำลอง ไม่ได้หมายความว่าขบวนสินค้าจะหยุดรับ–ส่งทุกสถานี.${transferNote}`;
}

function renderOnePrice(selection, costs, journey) {
  showLegacyRows(false);
  renderJourney(journey, numberValue(elements.railDistance));
  elements.resultMode.textContent = "ผ่านเกณฑ์ SRT Express One Price";
  elements.freightLabel.textContent = "ค่าระวาง One Price";
  elements.freightTotal.textContent = formatBaht(costs.freight);
  elements.grandTotal.textContent = new Intl.NumberFormat("th-TH").format(costs.total);
  elements.deliveryTime.textContent = `ภายใน ${selection.route.hours} ชั่วโมง*`;
  elements.deliveryTime.style.color = "#1d6c50";
  elements.resultDisclaimer.textContent =
    "*เป็นแบบจำลองโครงการ โปรดให้สถานียืนยันพื้นที่บริการ ราคา ขบวน และเวลาส่งมอบก่อนฝากส่งจริง";
}

function renderLegacyEstimate(selection, baseCosts, weight, dimensions, journey) {
  const enteredDistance = numberValue(elements.railDistance);
  if (!enteredDistance && !journey) {
    elements.manualReason.textContent = "ไม่พบพิกัดเพียงพอสำหรับประมาณระยะทาง กรุณากลับไปกรอกระยะทางทางราง";
    elements.quoteResult.hidden = true;
    elements.manualQuote.hidden = false;
    return false;
  }

  const distanceKm = enteredDistance || journey.kilometers;
  const estimate = calculateLegacyFreightEstimate({
    distanceKm,
    weight,
    pieces: baseCosts.pieces,
  });
  const total = estimate.freight + baseCosts.packing + baseCosts.access;
  const distanceBasis = enteredDistance ? "ระยะทางที่ผู้ใช้กรอก" : journey.basis;
  const oversized = dimensions.some((value) => value > 50);

  showLegacyRows(true);
  renderJourney(journey, enteredDistance);
  elements.resultMode.textContent = "ประมาณการนอก One Price จากโครงสร้างอัตราเดิม";
  elements.freightLabel.textContent = "ค่าระวางโดยประมาณ";
  elements.freightTotal.textContent = formatBaht(estimate.freight);
  elements.distanceTotal.textContent = `${distanceKm.toLocaleString("th-TH")} กม. · ${distanceBasis}`;
  elements.ordinaryTotal.textContent = `${formatBaht(estimate.ordinary)} · ${estimate.chargeableWeight} กก./ชิ้น × ${formatBaht(estimate.ratePerKg)}/กก.`;
  elements.expressTotal.textContent = formatBaht(estimate.express);
  elements.feeTotal.textContent = formatBaht(estimate.serviceFee);
  elements.minimumTotal.textContent = estimate.minimumApplied ? "ใช้ขั้นต่ำ 60 บาท/ชิ้น" : "ไม่ใช้ขั้นต่ำ";
  elements.grandTotal.textContent = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(total);
  elements.deliveryTime.textContent = "ต้องให้สถานียืนยันขบวนและเวลารับส่ง";
  elements.deliveryTime.style.color = "#9d2d3e";
  elements.resultDisclaimer.textContent =
    `*ราคาเพื่อวางแผน ไม่ใช่อัตรายืนยัน สูตรสอบเทียบจากช่วง 391–410 กม. ในใบแทรก 910 แล้วใช้อัตราด่วน 2 เท่า บวกค่าธรรมเนียมเดิม 50% และขั้นต่ำ 60 บาท/ชิ้น${oversized ? " ขนาดเกิน 50 ซม. อาจถูกจัดเป็นสินค้าเฉพาะและมีค่าใช้จ่ายเพิ่ม" : ""} โปรดให้สถานีตรวจชนิดสินค้า ตารางอัตราปัจจุบัน และสิทธิรับฝากทุกครั้ง`;
  return true;
}

function calculateQuote(event) {
  event.preventDefault();
  if (!validateForm()) {
    const firstInvalid = elements.form.querySelector(".is-invalid");
    firstInvalid?.focus();
    return;
  }

  const selection = selectedRoute();
  const pieces = numberValue(elements.pieces);
  const weight = numberValue(elements.weight);
  const dimensions = [numberValue(elements.length), numberValue(elements.width), numberValue(elements.height)];
  const eligibility = getEligibility(weight, dimensions);
  const journey = getRouteJourney(selection.origin, selection.destination);
  if (!journey) {
    elements.form.hidden = true;
    elements.manualReason.textContent = "ยังไม่พบแนวเชื่อมต่อของสถานีคู่นี้ในแบบจำลองโครงข่าย";
    elements.quoteResult.hidden = true;
    elements.manualQuote.hidden = false;
    return;
  }
  const baseCosts = calculateCosts({
    route: { price: 0 },
    pieces,
    packing: elements.packing.checked,
    originAccess: numberValue(elements.originAccess),
    destinationAccess: numberValue(elements.destinationAccess),
  });

  elements.form.hidden = true;
  elements.resultRoute.textContent = `${selection.origin.name} → ${selection.destination.name} · ${selection.route.label}`;
  elements.resultRoute.style.background = selection.route.type === "cross" ? "#741f2b" : "#1d6c50";
  elements.packingTotal.textContent = formatBaht(baseCosts.packing);
  elements.accessTotal.textContent = formatBaht(baseCosts.access);

  if (eligibility.eligible) {
    const costs = calculateCosts({
      route: selection.route,
      pieces,
      packing: elements.packing.checked,
      originAccess: numberValue(elements.originAccess),
      destinationAccess: numberValue(elements.destinationAccess),
    });
    renderOnePrice(selection, costs, journey);
  } else if (!renderLegacyEstimate(selection, baseCosts, weight, dimensions, journey)) {
    return;
  }

  elements.manualQuote.hidden = true;
  elements.quoteResult.hidden = false;
  elements.quoteResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function editQuote() {
  elements.quoteResult.hidden = true;
  elements.manualQuote.hidden = true;
  elements.form.hidden = false;
  elements.form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

elements.swap.addEventListener("click", () => {
  const origin = getSelectedStation(elements.origin);
  const destination = getSelectedStation(elements.destination);
  setStationInput(elements.origin, destination);
  setStationInput(elements.destination, origin);
  clearFieldError(elements.origin);
  clearFieldError(elements.destination);
  updateRoutePreview();
});

[elements.weight, elements.length, elements.width, elements.height].forEach((input) => {
  input.addEventListener("input", updateLimits);
});

elements.optionalToggle.addEventListener("click", () => {
  const expanded = elements.optionalToggle.getAttribute("aria-expanded") === "true";
  elements.optionalToggle.setAttribute("aria-expanded", String(!expanded));
  elements.optionalPanel.hidden = expanded;
});

elements.form.addEventListener("submit", calculateQuote);
elements.routeDetail.addEventListener("toggle", () => {
  elements.routeToggleLabel.textContent = elements.routeDetail.open
    ? "ซ่อนสถานีระหว่างทาง"
    : "ดูสถานีระหว่างทาง";
});
document.querySelector("#edit-quote").addEventListener("click", editQuote);
document.querySelector("#edit-manual").addEventListener("click", editQuote);
document.querySelector("#print-quote").addEventListener("click", () => window.print());

document.querySelector("[data-disabled-tab]").addEventListener("click", () => {
  document.querySelector("[data-disabled-tab]").setAttribute("aria-selected", "false");
  const faq = document.querySelector("#faq");
  faq.scrollIntoView({ behavior: "smooth" });
  setTimeout(() => {
    const target = document.querySelectorAll("#faq details")[2];
    if (target) target.open = true;
  }, 500);
});

elements.menuToggle.addEventListener("click", () => {
  const open = elements.menuToggle.getAttribute("aria-expanded") === "true";
  elements.menuToggle.setAttribute("aria-expanded", String(!open));
  elements.mainNav.classList.toggle("is-open", !open);
  document.body.classList.toggle("menu-open", !open);
});

elements.mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    elements.menuToggle.setAttribute("aria-expanded", "false");
    elements.mainNav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  });
});

const readingProgress = document.querySelector(".reading-progress");
const navLinks = Array.from(document.querySelectorAll('.main-nav a[href^="#"]'));
const navSections = navLinks
  .map((link) => ({ link, section: document.querySelector(link.getAttribute("href")) }))
  .filter((item) => item.section);
let scrollFrame = 0;

function updateScrollState() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0;
  elements.header.classList.toggle("scrolled", window.scrollY > 56);
  if (readingProgress) readingProgress.style.width = `${progress}%`;

  const marker = window.scrollY + Math.min(220, window.innerHeight * 0.28);
  let activeItem = null;
  navSections.forEach((item) => {
    if (item.section.offsetTop <= marker) activeItem = item;
  });
  navLinks.forEach((link) => link.classList.toggle("active", link === activeItem?.link));
}

function scheduleScrollState() {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0;
    updateScrollState();
  });
}

window.addEventListener("scroll", scheduleScrollState, { passive: true });
window.addEventListener("resize", scheduleScrollState);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
updateLimits();
updateDistanceHint();
updateScrollState();
