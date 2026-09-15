(function attachSrtCalculator(root, factory) {
  const calculator = factory();
  if (typeof module === "object" && module.exports) module.exports = calculator;
  if (root) root.SRTCalculator = calculator;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSrtCalculator() {
  "use strict";

  const stations = [
    { id: "bkk", name: "กรุงเทพอภิวัฒน์", line: "hub", lineName: "สถานีกลาง", tier: "hub" },
    { id: "aya", name: "อยุธยา", line: "north", lineName: "สายเหนือ", tier: "regional" },
    { id: "phs", name: "พิษณุโลก", line: "north", lineName: "สายเหนือ", tier: "regional" },
    { id: "cnx", name: "เชียงใหม่", line: "north", lineName: "สายเหนือ", tier: "remote" },
    { id: "nma", name: "นครราชสีมา", line: "northeast", lineName: "สายตะวันออกเฉียงเหนือ", tier: "regional" },
    { id: "kkc", name: "ขอนแก่น", line: "northeast", lineName: "สายตะวันออกเฉียงเหนือ", tier: "regional" },
    { id: "nki", name: "หนองคาย", line: "northeast", lineName: "สายตะวันออกเฉียงเหนือ", tier: "remote" },
    { id: "ubn", name: "อุบลราชธานี", line: "northeast", lineName: "สายตะวันออกเฉียงเหนือ", tier: "remote" },
    { id: "cco", name: "ฉะเชิงเทรา", line: "east", lineName: "สายตะวันออก", tier: "regional" },
    { id: "pty", name: "พัทยา", line: "east", lineName: "สายตะวันออก", tier: "regional" },
    { id: "any", name: "อรัญประเทศ", line: "east", lineName: "สายตะวันออก", tier: "remote" },
    { id: "hhn", name: "หัวหิน", line: "south", lineName: "สายใต้", tier: "regional" },
    { id: "urt", name: "สุราษฎร์ธานี", line: "south", lineName: "สายใต้", tier: "remote" },
    { id: "hdy", name: "หาดใหญ่", line: "south", lineName: "สายใต้", tier: "remote" },
    { id: "sgk", name: "สุไหงโก-ลก", line: "south", lineName: "สายใต้", tier: "remote" },
  ];

  const lineOrder = ["hub", "north", "northeast", "east", "south"];
  const lineLabels = {
    hub: "สถานีกลาง",
    north: "สายเหนือ",
    northeast: "สายตะวันออกเฉียงเหนือ",
    east: "สายตะวันออก",
    south: "สายใต้",
  };

  function getStation(id) {
    return stations.find((station) => station.id === id);
  }

  function getRoute(origin, destination) {
    const sameLine = origin.line === destination.line || origin.line === "hub" || destination.line === "hub";
    const remoteCrossLine = !sameLine && origin.tier === "remote" && destination.tier === "remote";

    if (sameLine) {
      return {
        type: "same",
        label: "ภายในสายเดียวกัน",
        price: 70,
        hours: 24,
        description: `${origin.name} → ${destination.name} · อัตรา One Price 70 บาท/ชิ้น`,
      };
    }

    if (remoteCrossLine) {
      return {
        type: "remote-cross",
        label: "ข้ามสายระยะไกล",
        price: 100,
        hours: 64,
        description: `${origin.lineName} → ${destination.lineName} · ต้องเปลี่ยนสายและตรวจรอบขบวน`,
      };
    }

    return {
      type: "cross",
      label: "ส่งข้ามสาย",
      price: 100,
      hours: 48,
      description: `${origin.lineName} → ${destination.lineName} · เชื่อมต่อผ่านจุดเปลี่ยนถ่ายกลาง`,
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

  return { stations, lineOrder, lineLabels, getStation, getRoute, getEligibility, calculateCosts };
});
