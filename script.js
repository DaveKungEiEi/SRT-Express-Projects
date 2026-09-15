"use strict";

const { stations, lineOrder, lineLabels, getStation, getRoute, getEligibility, calculateCosts } = window.SRTCalculator;

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
  grandTotal: document.querySelector("#grand-total"),
  freightTotal: document.querySelector("#freight-total"),
  packingTotal: document.querySelector("#packing-total"),
  accessTotal: document.querySelector("#access-total"),
  deliveryTime: document.querySelector("#delivery-time"),
  resultDisclaimer: document.querySelector("#result-disclaimer"),
};

function createStationOptions(select) {
  lineOrder.forEach((line) => {
    const group = document.createElement("optgroup");
    group.label = lineLabels[line];
    stations
      .filter((station) => station.line === line)
      .forEach((station) => {
        const option = document.createElement("option");
        option.value = station.id;
        option.textContent = station.name;
        group.append(option);
      });
    select.append(group);
  });
}

createStationOptions(elements.origin);
createStationOptions(elements.destination);

function updateRoutePreview() {
  const origin = getStation(elements.origin.value);
  const destination = getStation(elements.destination.value);

  if (!origin || !destination || origin.id === destination.id) {
    elements.routePreview.hidden = true;
    return;
  }

  const route = getRoute(origin, destination);
  elements.routeBadge.textContent = route.label;
  elements.routeBadge.style.background = route.type === "remote-cross" ? "#9d2d3e" : route.type === "cross" ? "#741f2b" : "#1d6c50";
  elements.routeDescription.textContent = route.description;
  elements.routePreview.hidden = false;
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
  elements.weightStatus.textContent = weightOk ? `${weight.toFixed(1)} / 2 กก.` : "เกินเกณฑ์";
  elements.sizeStatus.textContent = sizeOk ? `${largestSide || 0} / 50 ซม.` : "เกินเกณฑ์";
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

  return valid;
}

function formatBaht(value) {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value)} บาท`;
}

function calculateQuote(event) {
  event.preventDefault();
  if (!validateForm()) {
    const firstInvalid = elements.form.querySelector(".is-invalid");
    firstInvalid?.focus();
    return;
  }

  const weight = numberValue(elements.weight);
  const dimensions = [numberValue(elements.length), numberValue(elements.width), numberValue(elements.height)];
  const { overWeight, oversized } = getEligibility(weight, dimensions);

  elements.form.hidden = true;

  if (overWeight || oversized) {
    const reasons = [];
    if (overWeight) reasons.push(`น้ำหนัก ${weight} กก. เกินเกณฑ์ 2 กก.`);
    if (oversized) reasons.push(`มีด้านยาวเกินเกณฑ์ 50 ซม.`);
    elements.manualReason.textContent = reasons.join(" และ ");
    elements.quoteResult.hidden = true;
    elements.manualQuote.hidden = false;
    elements.manualQuote.focus?.();
    return;
  }

  const origin = getStation(elements.origin.value);
  const destination = getStation(elements.destination.value);
  const route = getRoute(origin, destination);
  const costs = calculateCosts({
    route,
    pieces: numberValue(elements.pieces),
    packing: elements.packing.checked,
    originAccess: numberValue(elements.originAccess),
    destinationAccess: numberValue(elements.destinationAccess),
  });

  elements.resultRoute.textContent = `${origin.name} → ${destination.name} · ${route.label}`;
  elements.resultRoute.style.background = route.type === "remote-cross" ? "#9d2d3e" : route.type === "cross" ? "#741f2b" : "#1d6c50";
  elements.grandTotal.textContent = new Intl.NumberFormat("th-TH").format(costs.total);
  elements.freightTotal.textContent = formatBaht(costs.freight);
  elements.packingTotal.textContent = formatBaht(costs.packing);
  elements.accessTotal.textContent = formatBaht(costs.access);

  if (route.type === "remote-cross") {
    elements.deliveryTime.textContent = "ประมาณ 64 ชั่วโมง — เกินเป้าหมาย 48 ชั่วโมง";
    elements.deliveryTime.style.color = "#9d2d3e";
    elements.resultDisclaimer.textContent = "*แบบจำลองจัดเส้นทางระยะไกลนี้เป็นกรณีที่ไม่ผ่านเป้าหมาย 48 ชั่วโมง ต้องให้สถานีตรวจรอบขบวนและเวลาจริงก่อนรับฝาก";
  } else {
    elements.deliveryTime.textContent = `ภายใน ${route.hours} ชั่วโมง*`;
    elements.deliveryTime.style.color = "#1d6c50";
    elements.resultDisclaimer.textContent = "*เป็นเพียงแบบจำลองโครงการ โปรดให้สถานียืนยันราคา เส้นทาง ขบวน และเวลาส่งมอบก่อนฝากส่งจริง";
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

elements.origin.addEventListener("change", () => {
  clearFieldError(elements.origin);
  updateRoutePreview();
});
elements.destination.addEventListener("change", () => {
  clearFieldError(elements.destination);
  updateRoutePreview();
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

window.addEventListener(
  "scroll",
  () => elements.header.classList.toggle("is-scrolled", window.scrollY > 24),
  { passive: true },
);

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
