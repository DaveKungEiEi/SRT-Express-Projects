(function attachSrtCalculator(root, factory) {
  let stationData = root && root.SRT_STATIONS;
  if ((!stationData || !stationData.length) && typeof module === "object" && module.exports) {
    stationData = require("./stations.js");
  }
  const calculator = factory(stationData || []);
  if (typeof module === "object" && module.exports) module.exports = calculator;
  if (root) root.SRTCalculator = calculator;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSrtCalculator(stations) {
  "use strict";

  const lineOrder = ["hub", "north", "northeast", "east", "south", "maeklong"];
  const lineLabels = {
    hub: "สถานีเชื่อมต่อกลาง",
    north: "สายเหนือ",
    northeast: "สายตะวันออกเฉียงเหนือ",
    east: "สายตะวันออก",
    south: "สายใต้",
    maeklong: "สายแม่กลอง",
  };

  function getStation(id) {
    return stations.find((station) => station.id === id);
  }

  function getPrimaryLine(station) {
    return station.hub ? "hub" : station.lines[0];
  }

  function getStationLineLabel(station) {
    if (station.hub) return lineLabels.hub;
    return station.lines.map((line) => lineLabels[line]).join(" / ");
  }

  function sharesLine(origin, destination) {
    return origin.lines.some((line) => destination.lines.includes(line));
  }

  function getRoute(origin, destination) {
    const sameLine = sharesLine(origin, destination);
    if (sameLine) {
      return {
        type: "same",
        label: "ภายในสายเดียวกัน",
        price: 70,
        hours: 24,
        description: `${origin.name} → ${destination.name} · One Price 70 บาทต่อชิ้นเมื่อผ่านเกณฑ์`,
      };
    }

    return {
      type: "cross",
      label: "ส่งข้ามสาย",
      price: 100,
      hours: 48,
      description: `${getStationLineLabel(origin)} → ${getStationLineLabel(destination)} · เชื่อมต่อผ่านจุดเปลี่ยนสาย`,
    };
  }

  function getEligibility(weight, dimensions) {
    const overWeight = weight > 2;
    const oversized = dimensions.some((value) => value > 50);
    const invalid = weight <= 0 || dimensions.some((value) => value <= 0);
    return { eligible: !invalid && !overWeight && !oversized, overWeight, oversized, invalid };
  }

  function calculateCosts({ route, pieces, packing = false, originAccess = 0, destinationAccess = 0 }) {
    const safePieces = Math.max(1, Math.round(Number(pieces) || 1));
    const freight = route.price * safePieces;
    const packingCost = packing ? 15 * safePieces : 0;
    const access = Math.max(0, Number(originAccess) || 0) + Math.max(0, Number(destinationAccess) || 0);
    return { pieces: safePieces, freight, packing: packingCost, access, total: freight + packingCost + access };
  }

  function toRadians(value) {
    return (value * Math.PI) / 180;
  }

  function haversineDistanceKm(origin, destination) {
    if (![origin.lat, origin.lon, destination.lat, destination.lon].every(Number.isFinite)) return null;
    const earthRadiusKm = 6371;
    const latitudeDelta = toRadians(destination.lat - origin.lat);
    const longitudeDelta = toRadians(destination.lon - origin.lon);
    const latitudeA = toRadians(origin.lat);
    const latitudeB = toRadians(destination.lat);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function roundUpToTen(value) {
    return Math.max(10, Math.ceil(value / 10) * 10);
  }

  function estimateRailDistance(origin, destination) {
    const directDistance = haversineDistanceKm(origin, destination);
    if (directDistance === null) return null;

    let distance = directDistance * 1.22;
    let routing = "แนวเส้นทางเดียวกัน";
    if (!sharesLine(origin, destination)) {
      const central = stations.find((station) => station.name === "กลางกรุงเทพอภิวัฒน์");
      const toCentral = central ? haversineDistanceKm(origin, central) : null;
      const fromCentral = central ? haversineDistanceKm(central, destination) : null;
      if (toCentral !== null && fromCentral !== null) {
        distance = (toCentral + fromCentral) * 1.18;
        routing = "เชื่อมผ่านกรุงเทพอภิวัฒน์";
      } else {
        distance = directDistance * 1.38;
        routing = "เผื่อการเชื่อมข้ามสาย";
      }
    }

    const usesProvinceCentroid = [origin, destination].some(
      (station) => station.coordinateSource !== "official",
    );
    return {
      kilometers: roundUpToTen(distance),
      basis: usesProvinceCentroid ? `${routing} และพิกัดกลางจังหวัด` : `${routing} และพิกัดสถานี`,
      confidence: usesProvinceCentroid ? "low" : "medium",
    };
  }

  function getOrdinaryRatePerKg(distanceKm) {
    const distance = Math.max(10, Number(distanceKm) || 10);
    return Math.round((1.88 + 0.016 * distance) * 100) / 100;
  }

  function calculateLegacyFreightEstimate({ distanceKm, weight, pieces }) {
    const safePieces = Math.max(1, Math.round(Number(pieces) || 1));
    const chargeableWeight = Math.max(1, Math.ceil(Number(weight) || 1));
    const ratePerKg = getOrdinaryRatePerKg(distanceKm);
    const ordinaryPerPiece = ratePerKg * chargeableWeight;
    const expressPerPiece = ordinaryPerPiece * 2;
    const serviceFeePerPiece = expressPerPiece * 0.5;
    const calculatedPerPiece = expressPerPiece + serviceFeePerPiece;
    const freightPerPiece = Math.max(60, calculatedPerPiece);
    const minimumApplied = freightPerPiece > calculatedPerPiece;
    const roundMoney = (value) => Math.round(value * 100) / 100;

    return {
      pieces: safePieces,
      chargeableWeight,
      ratePerKg,
      ordinary: roundMoney(ordinaryPerPiece * safePieces),
      express: roundMoney(expressPerPiece * safePieces),
      serviceFee: roundMoney(serviceFeePerPiece * safePieces),
      minimumApplied,
      freight: roundMoney(freightPerPiece * safePieces),
    };
  }

  return {
    stations,
    lineOrder,
    lineLabels,
    getStation,
    getPrimaryLine,
    getStationLineLabel,
    sharesLine,
    getRoute,
    getEligibility,
    calculateCosts,
    haversineDistanceKm,
    estimateRailDistance,
    getOrdinaryRatePerKg,
    calculateLegacyFreightEstimate,
  };
});
