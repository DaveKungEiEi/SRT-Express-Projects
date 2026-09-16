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
  const ROUTE_HUB_NAME = "ชุมทางบางซื่อ";
  const ROUTE_HUB_ID = stations.find((station) => station.name === ROUTE_HUB_NAME)?.id || "srt0006";

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
      description: `${getStationLineLabel(origin)} → ${getStationLineLabel(destination)} · เชื่อมผ่าน${ROUTE_HUB_NAME}`,
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

  function indexRange(start, end) {
    return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
  }

  function validThaiCoordinate(station) {
    return Number.isFinite(station?.lat) && Number.isFinite(station?.lon)
      && station.lat >= 5 && station.lat <= 21
      && station.lon >= 97 && station.lon <= 106;
  }

  function estimateSegmentDistance(origin, destination) {
    if (origin.name === destination.name) {
      return { kilometers: 0.1, estimated: false };
    }

    if (
      validThaiCoordinate(origin)
      && validThaiCoordinate(destination)
      && origin.coordinateSource === "official"
      && destination.coordinateSource === "official"
    ) {
      const direct = haversineDistanceKm(origin, destination);
      if (direct >= 0.15 && direct <= 80) {
        return {
          kilometers: Math.max(0.5, Math.round(direct * 1.14 * 10) / 10),
          estimated: origin.coordinateSource !== "official" || destination.coordinateSource !== "official",
        };
      }
    }

    return {
      kilometers: origin.province === destination.province ? 4 : 8,
      estimated: true,
    };
  }

  function addGraphEdge(graph, origin, destination, options = {}) {
    if (!origin || !destination || origin.id === destination.id) return;
    const distance = options.kilometers
      ? { kilometers: options.kilometers, estimated: true }
      : estimateSegmentDistance(origin, destination);
    const edge = {
      to: destination.id,
      kilometers: distance.kilometers,
      estimated: distance.estimated,
      transfer: Boolean(options.transfer),
      transferLabel: options.transferLabel || "",
    };
    const reverse = { ...edge, to: origin.id };
    const append = (fromId, nextEdge) => {
      if (!graph.has(fromId)) graph.set(fromId, []);
      const edges = graph.get(fromId);
      const existing = edges.find((candidate) => candidate.to === nextEdge.to);
      if (!existing || existing.kilometers > nextEdge.kilometers) {
        if (existing) edges.splice(edges.indexOf(existing), 1);
        edges.push(nextEdge);
      }
    };
    append(origin.id, edge);
    append(destination.id, reverse);
  }

  function buildRailGraph() {
    const graph = new Map(stations.map((station) => [station.id, []]));
    const segmentIndexes = [
      indexRange(0, 28),
      [28, ...indexRange(29, 128)],
      [89, ...indexRange(129, 130)],
      [28, ...indexRange(131, 200)],
      [28, ...indexRange(131, 161), ...indexRange(201, 249)],
      [137, ...indexRange(250, 287), 216],
      [5, 4, 3, 2, 1, 288, ...indexRange(289, 308)],
      [308, ...indexRange(309, 341)],
      [311, ...indexRange(342, 345), 136, 137],
      [308, ...indexRange(346, 366)],
      [5, ...indexRange(367, 369), ...indexRange(373, 574)],
      [369, 372, 371, 370],
      [540, ...indexRange(575, 577)],
      [387, ...indexRange(578, 591)],
      [387, ...indexRange(592, 618)],
      [480, ...indexRange(619, 626)],
      [505, ...indexRange(627, 639)],
      [509, ...indexRange(640, 647)],
      indexRange(648, 667),
      indexRange(668, 683),
    ];

    segmentIndexes.forEach((indexes) => {
      indexes.forEach((stationIndex, position) => {
        if (!position) return;
        addGraphEdge(graph, stations[indexes[position - 1]], stations[stationIndex]);
      });
    });

    addGraphEdge(graph, stations[5], stations[648], {
      kilometers: 12,
      transfer: true,
      transferLabel: "ช่วงเชื่อมต่อจากชุมทางบางซื่อไปวงเวียนใหญ่",
    });
    addGraphEdge(graph, stations[667], stations[668], {
      kilometers: 2,
      transfer: true,
      transferLabel: "ช่วงเปลี่ยนถ่ายมหาชัย–บ้านแหลม",
    });
    return graph;
  }

  let railGraph;

  function shortestRailPath(originId, destinationId) {
    const graph = railGraph || (railGraph = buildRailGraph());
    const distances = new Map([[originId, 0]]);
    const previous = new Map();
    const remaining = new Set(graph.keys());

    while (remaining.size) {
      let current = null;
      let currentDistance = Infinity;
      remaining.forEach((id) => {
        const distance = distances.get(id) ?? Infinity;
        if (distance < currentDistance) {
          current = id;
          currentDistance = distance;
        }
      });
      if (!current || currentDistance === Infinity) break;
      remaining.delete(current);
      if (current === destinationId) break;

      (graph.get(current) || []).forEach((edge) => {
        if (!remaining.has(edge.to)) return;
        const candidate = currentDistance + edge.kilometers;
        if (candidate < (distances.get(edge.to) ?? Infinity)) {
          distances.set(edge.to, candidate);
          previous.set(edge.to, { from: current, edge });
        }
      });
    }

    if (!distances.has(destinationId)) return null;
    const nodeIds = [destinationId];
    const edges = [];
    let cursor = destinationId;
    while (cursor !== originId) {
      const step = previous.get(cursor);
      if (!step) return null;
      edges.unshift(step.edge);
      cursor = step.from;
      nodeIds.unshift(cursor);
    }
    return { nodeIds, edges };
  }

  function joinPaths(first, second) {
    if (!first) return second;
    if (!second) return first;
    return {
      nodeIds: [...first.nodeIds, ...second.nodeIds.slice(1)],
      edges: [...first.edges, ...second.edges],
    };
  }

  function scalePathDistance(path, origin, destination) {
    if (!path) return null;
    const rawTotal = path.edges.reduce((sum, edge) => sum + edge.kilometers, 0);
    if (!rawTotal || !validThaiCoordinate(origin) || !validThaiCoordinate(destination)) return path;
    const directDistance = haversineDistanceKm(origin, destination);
    if (!directDistance || directDistance < 0.2) return path;
    const targetDistance = Math.max(1, directDistance * 1.28);
    const scale = targetDistance / rawTotal;
    return {
      nodeIds: [...path.nodeIds],
      edges: path.edges.map((edge) => ({
        ...edge,
        kilometers: edge.kilometers * scale,
        estimated: true,
      })),
    };
  }

  function getRouteJourney(origin, destination) {
    if (!origin || !destination || origin.id === destination.id) return null;
    const mustUseHub = !sharesLine(origin, destination);
    const hub = getStation(ROUTE_HUB_ID);
    const rawPath = mustUseHub && origin.id !== ROUTE_HUB_ID && destination.id !== ROUTE_HUB_ID
      ? joinPaths(
        scalePathDistance(shortestRailPath(origin.id, ROUTE_HUB_ID), origin, hub),
        scalePathDistance(shortestRailPath(ROUTE_HUB_ID, destination.id), hub, destination),
      )
      : scalePathDistance(shortestRailPath(origin.id, destination.id), origin, destination);
    if (!rawPath) return null;

    const displayStops = [];
    let pendingDistance = 0;
    let pendingEstimated = false;
    let pendingTransfer = false;
    let pendingTransferLabel = "";
    rawPath.nodeIds.forEach((nodeId, index) => {
      const station = getStation(nodeId);
      if (!station) return;
      if (index) {
        const edge = rawPath.edges[index - 1];
        pendingDistance += edge.kilometers;
        pendingEstimated ||= edge.estimated;
        pendingTransfer ||= edge.transfer;
        if (edge.transferLabel) pendingTransferLabel = edge.transferLabel;
      }
      const previousStop = displayStops[displayStops.length - 1];
      if (previousStop?.station.name === station.name) {
        previousStop.station = station;
        return;
      }
      displayStops.push({
        station,
        distanceFromPrevious: pendingDistance,
        estimated: pendingEstimated,
        transfer: pendingTransfer,
        transferLabel: pendingTransferLabel,
      });
      pendingDistance = 0;
      pendingEstimated = false;
      pendingTransfer = false;
      pendingTransferLabel = "";
    });

    let cumulative = 0;
    displayStops.forEach((stop) => {
      cumulative += stop.distanceFromPrevious;
      stop.cumulativeKilometers = cumulative;
    });
    const transferCount = rawPath.edges.filter((edge) => edge.transfer).length;
    const estimatedSegmentCount = rawPath.edges.filter((edge) => edge.estimated).length;
    return {
      hubId: ROUTE_HUB_ID,
      hubName: ROUTE_HUB_NAME,
      viaHub: rawPath.nodeIds.includes(ROUTE_HUB_ID),
      forcedHub: mustUseHub,
      stops: displayStops,
      kilometers: Math.max(1, Math.round(cumulative)),
      rawKilometers: cumulative,
      transferCount,
      estimatedSegmentCount,
      basis: mustUseHub
        ? `ลำดับโครงข่ายผ่าน${ROUTE_HUB_NAME}`
        : "ลำดับโครงข่ายภายในสายและทางแยกที่เกี่ยวข้อง",
      confidence: estimatedSegmentCount || transferCount ? "low" : "medium",
    };
  }

  function estimateRailDistance(origin, destination) {
    const journey = getRouteJourney(origin, destination);
    if (!journey) return null;
    return {
      kilometers: journey.kilometers,
      basis: journey.basis,
      confidence: journey.confidence,
      stationCount: journey.stops.length,
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
    getRouteJourney,
    routeHubName: ROUTE_HUB_NAME,
    getOrdinaryRatePerKg,
    calculateLegacyFreightEstimate,
  };
});
