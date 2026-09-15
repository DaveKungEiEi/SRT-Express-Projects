"use strict";

const {
  stations,
  lineOrder,
  lineLabels,
  getStation,
  getPrimaryLine,
  getRoute,
  getEligibility,
  calculateCosts,
  estimateRailDistance,
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
};

const nameCounts = stations.reduce((counts, station) => {
  counts[station.name] = (counts[station.name] || 0) + 1;
  return counts;
}, {});

function createStationOptions(select) {
  lineOrder.forEach((line) => {
    const matchingStations = stations.filter((station) => getPrimaryLine(station) === line);
    if (!matchingStations.length) return;
    const group = document.createElement("optgroup");
    group.label = `${lineLabels[line]} (${matchingStations.length})`;
    matchingStations.forEach((station) => {
      const option = document.createElement("option");
      option.value = station.id;
      const area = nameCounts[station.name] > 1 && station.district
        ? `${station.district}, ${station.province}`
        : station.province;
      option.textContent = `${station.name} — ${area}`;
      group.append(option);
    });
    select.append(group);
  });
}

createStationOptions(elements.origin);
createStationOptions(elements.destination);

function selectedRoute() {
  const origin = getStation(elements.origin.value);
  const destination = getStation(elements.destination.value);
  if (!origin || !destination || origin.id === destination.id) return null;
  return { origin, destination, route: getRoute(origin, destination) };
}

function updateDistanceHint() {
  const selection = selectedRoute();
  if (!selection) {
    elements.distanceHint.textContent = "เว้นว่างเพื่อให้ระบบประมาณจากพิกัดในทะเบียนสถานี";
    return;
  }
  const estimate = estimateRailDistance(selection.origin, selection.destination);
  elements.distanceHint.textContent = estimate
    ? `ระบบจะใช้ประมาณ ${estimate.kilometers} กม. (${estimate.basis}) หากไม่กรอกเอง`
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

  if (!elements.origin.value) {
    setFieldError(elements.origin, "กรุณาเลือกสถานีต้นทาง");
    valid = false;
  }
  if (!elements.destination.value) {
    setFieldError(elements.destination, "กรุณาเลือกสถานีปลายทาง");
    valid = false;
  }
  if (elements.origin.value && elements.origin.value === elements.destination.value) {
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

function renderOnePrice(selection, costs) {
  showLegacyRows(false);
  elements.resultMode.textContent = "ผ่านเกณฑ์ SRT Express One Price";
  elements.freightLabel.textContent = "ค่าระวาง One Price";
  elements.freightTotal.textContent = formatBaht(costs.freight);
  elements.grandTotal.textContent = new Intl.NumberFormat("th-TH").format(costs.total);
  elements.deliveryTime.textContent = `ภายใน ${selection.route.hours} ชั่วโมง*`;
  elements.deliveryTime.style.color = "#1d6c50";
  elements.resultDisclaimer.textContent =
    "*เป็นแบบจำลองโครงการ โปรดให้สถานียืนยันพื้นที่บริการ ราคา ขบวน และเวลาส่งมอบก่อนฝากส่งจริง";
}

function renderLegacyEstimate(selection, baseCosts, weight, dimensions) {
  const enteredDistance = numberValue(elements.railDistance);
  const automaticDistance = estimateRailDistance(selection.origin, selection.destination);
  if (!enteredDistance && !automaticDistance) {
    elements.manualReason.textContent = "ไม่พบพิกัดเพียงพอสำหรับประมาณระยะทาง กรุณากลับไปกรอกระยะทางทางราง";
    elements.quoteResult.hidden = true;
    elements.manualQuote.hidden = false;
    return false;
  }

  const distanceKm = enteredDistance || automaticDistance.kilometers;
  const estimate = calculateLegacyFreightEstimate({
    distanceKm,
    weight,
    pieces: baseCosts.pieces,
  });
  const total = estimate.freight + baseCosts.packing + baseCosts.access;
  const distanceBasis = enteredDistance ? "ระยะทางที่ผู้ใช้กรอก" : automaticDistance.basis;
  const oversized = dimensions.some((value) => value > 50);

  showLegacyRows(true);
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
    renderOnePrice(selection, costs);
  } else if (!renderLegacyEstimate(selection, baseCosts, weight, dimensions)) {
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

[elements.origin, elements.destination].forEach((select) => {
  select.addEventListener("change", () => {
    clearFieldError(select);
    updateRoutePreview();
  });
});

elements.swap.addEventListener("click", () => {
  const originValue = elements.origin.value;
  elements.origin.value = elements.destination.value;
  elements.destination.value = originValue;
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
