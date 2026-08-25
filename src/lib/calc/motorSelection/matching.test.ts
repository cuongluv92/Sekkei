import { describe, expect, it } from "vitest";
import { matchMainBreakerSelection, matchMotorStarterSelection } from "./matching";
import type { MainBreakerSelection, MotorStarterSelection } from "@/lib/types";

function starter(overrides: Partial<MotorStarterSelection> = {}): MotorStarterSelection {
  return {
    id: `s-${overrides.motorKw ?? overrides.ratedCurrent}`,
    manufacturerId: "mitsubishi",
    voltageClass: "200V",
    circuitType: "direct",
    motorKw: 3.7,
    ratedCurrent: 16.6,
    breakerModel: "NF32-SV",
    contactorModel: "S-N10",
    wireSize: "2.0mm2",
    order: 0,
    ...overrides,
  };
}

function mainBreaker(overrides: Partial<MainBreakerSelection> = {}): MainBreakerSelection {
  return {
    id: `m-${overrides.ratedCurrent}`,
    manufacturerId: "mitsubishi",
    voltageClass: "200V",
    ratedCurrent: 100,
    breakerModel: "NF225-SV",
    order: 0,
    ...overrides,
  };
}

describe("matchMotorStarterSelection", () => {
  it("picks the smallest row whose motorKw is >= the requested kW (round up to next standard size)", () => {
    const master = [starter({ id: "a", motorKw: 2.2 }), starter({ id: "b", motorKw: 3.7 }), starter({ id: "c", motorKw: 5.5 })];
    const result = matchMotorStarterSelection(
      { manufacturerId: "mitsubishi", voltageClass: "200V", circuitType: "direct", inputUnit: "kW", inputValue: 3 },
      master,
    );
    expect(result?.id).toBe("b");
  });

  it("matches by ratedCurrent when the input unit is A", () => {
    const master = [starter({ id: "a", ratedCurrent: 9.0 }), starter({ id: "b", ratedCurrent: 16.6 }), starter({ id: "c", ratedCurrent: 23.2 })];
    const result = matchMotorStarterSelection(
      { manufacturerId: "mitsubishi", voltageClass: "200V", circuitType: "direct", inputUnit: "A", inputValue: 15 },
      master,
    );
    expect(result?.id).toBe("b");
  });

  it("returns an exact match unchanged when the input equals a row's value exactly", () => {
    const master = [starter({ id: "a", motorKw: 3.7 })];
    const result = matchMotorStarterSelection(
      { manufacturerId: "mitsubishi", voltageClass: "200V", circuitType: "direct", inputUnit: "kW", inputValue: 3.7 },
      master,
    );
    expect(result?.id).toBe("a");
  });

  it("never matches across a different manufacturer, voltage class, or circuit type", () => {
    const master = [
      starter({ id: "wrong-maker", manufacturerId: "fuji", motorKw: 3.7 }),
      starter({ id: "wrong-voltage", voltageClass: "400V", motorKw: 3.7 }),
      starter({ id: "wrong-circuit", circuitType: "inverter", motorKw: 3.7 }),
    ];
    const result = matchMotorStarterSelection(
      { manufacturerId: "mitsubishi", voltageClass: "200V", circuitType: "direct", inputUnit: "kW", inputValue: 3 },
      master,
    );
    expect(result).toBeNull();
  });

  it("returns null (never fabricates a value) when the input exceeds every registered row", () => {
    const master = [starter({ id: "a", motorKw: 3.7 })];
    const result = matchMotorStarterSelection(
      { manufacturerId: "mitsubishi", voltageClass: "200V", circuitType: "direct", inputUnit: "kW", inputValue: 100 },
      master,
    );
    expect(result).toBeNull();
  });

  it("returns null when the master list is empty", () => {
    const result = matchMotorStarterSelection(
      { manufacturerId: "mitsubishi", voltageClass: "200V", circuitType: "direct", inputUnit: "kW", inputValue: 3.7 },
      [],
    );
    expect(result).toBeNull();
  });
});

describe("matchMainBreakerSelection", () => {
  it("picks the smallest row whose ratedCurrent is >= the total current", () => {
    const master = [mainBreaker({ id: "a", ratedCurrent: 60 }), mainBreaker({ id: "b", ratedCurrent: 100 }), mainBreaker({ id: "c", ratedCurrent: 225 })];
    const result = matchMainBreakerSelection({ manufacturerId: "mitsubishi", voltageClass: "200V", totalCurrent: 85 }, master);
    expect(result?.id).toBe("b");
  });

  it("never matches across a different manufacturer or voltage class", () => {
    const master = [
      mainBreaker({ id: "wrong-maker", manufacturerId: "fuji", ratedCurrent: 100 }),
      mainBreaker({ id: "wrong-voltage", voltageClass: "400V", ratedCurrent: 100 }),
    ];
    const result = matchMainBreakerSelection({ manufacturerId: "mitsubishi", voltageClass: "200V", totalCurrent: 85 }, master);
    expect(result).toBeNull();
  });

  it("returns null when the total current exceeds every registered row", () => {
    const master = [mainBreaker({ id: "a", ratedCurrent: 100 })];
    const result = matchMainBreakerSelection({ manufacturerId: "mitsubishi", voltageClass: "200V", totalCurrent: 500 }, master);
    expect(result).toBeNull();
  });
});
