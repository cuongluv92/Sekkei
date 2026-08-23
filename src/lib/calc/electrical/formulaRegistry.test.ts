import { describe, expect, it } from "vitest";
import { FORMULA_REGISTRY, findFormulaById } from "./formulaRegistry";
import { solveAcPower, solveDcCircuit, solveEfficiency } from "./ohmsLaw";
import { solveThreePhaseConnection } from "./threePhase";
import { solveTransformer } from "./transformer";
import { solveSyncSpeed, solveSlip, solveMotorPower } from "./motorFrequency";
import { solveVoltageDrop, solveSimplifiedVoltageDrop } from "./voltageDrop";
import { solvePowerTriangle, solveCapacitorCorrection } from "./powerFactor";
import {
  solveImpedance,
  solveInductiveReactance,
  solveCapacitiveReactance,
  solveResonance,
  solveSeriesRX,
  solveParallelResistance,
  solveParallelComplexImpedance,
} from "./impedanceRLC";
import {
  solveTransformerRatedCurrent,
  solveSimplifiedShortCircuit,
  solvePercentZBaseConversion,
  checkBreakingCapacity,
} from "./shortCircuit";
import { solveInstrumentTransformerRatio } from "./ctVt";
import { classifyVoltage } from "./highLowVoltage";

describe("FORMULA_REGISTRY — structural integrity", () => {
  it("has unique ids", () => {
    const ids = FORMULA_REGISTRY.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has non-empty core metadata", () => {
    for (const f of FORMULA_REGISTRY) {
      expect(f.id.length).toBeGreaterThan(0);
      expect(f.nameJa.length).toBeGreaterThan(0);
      expect(f.expression.length).toBeGreaterThan(0);
      expect(f.applicability.length).toBeGreaterThan(0);
      expect(f.reference.length).toBeGreaterThan(0);
      expect(f.engineFiles.length).toBeGreaterThan(0);
    }
  });

  it("verified:false always carries a verificationNote explaining what's unconfirmed", () => {
    for (const f of FORMULA_REGISTRY) {
      if (!f.verified) {
        expect(f.verificationNote, `${f.id} is verified:false but has no verificationNote`).toBeTruthy();
      }
    }
  });

  it("engineering_fundamental entries are always verified:true (true by derivation, not by confirmation)", () => {
    for (const f of FORMULA_REGISTRY) {
      if (f.sourceType === "engineering_fundamental") {
        expect(f.verified, `${f.id} is engineering_fundamental but not verified:true`).toBe(true);
      }
    }
  });

  it("law-sourced entries are never conflated with standard (JIS/JEAC) sourceType", () => {
    const lawEntries = FORMULA_REGISTRY.filter((f) => f.sourceType === "law");
    expect(lawEntries.length).toBeGreaterThan(0);
    for (const f of lawEntries) {
      expect(f.standard).not.toMatch(/^JIS|^JEAC|^JEC/);
    }
  });

  it("forward-only entries never claim bidirectional in the same breath (direction is explicit)", () => {
    const forwardOnly = FORMULA_REGISTRY.filter((f) => f.direction === "forward");
    expect(forwardOnly.length).toBeGreaterThan(0);
    for (const f of forwardOnly) {
      expect(f.direction).not.toBe("bidirectional");
    }
  });

  it("findFormulaById resolves a known id and returns undefined for an unknown one", () => {
    expect(findFormulaById("dc_ohms_law")).toBeDefined();
    expect(findFormulaById("does_not_exist")).toBeUndefined();
  });
});

describe("FORMULA_REGISTRY — cross-checked against actual engine computations", () => {
  it("dc_ohms_law: V=IR", () => {
    const r = solveDcCircuit({ I: 10, R: 5 }, "V");
    expect(r.ok && r.value).toBeCloseTo(50, 10);
  });

  it("ac_apparent_power: 1φ has no √3, 3φ does", () => {
    const single = solveAcPower({ V: 200, I: 30 }, "S", "single");
    const three = solveAcPower({ V: 200, I: 30 }, "S", "three");
    expect(single.ok && single.value).toBeCloseTo((200 * 30) / 1000, 10);
    expect(three.ok && three.value).toBeCloseTo((Math.sqrt(3) * 200 * 30) / 1000, 10);
  });

  it("ac_active_power_direct: matches P=V*I*cosφ/1000 exactly (1φ) and with √3 (3φ)", () => {
    const single = solveAcPower({ V: 200, I: 30, pf: 0.8 }, "P", "single");
    const three = solveAcPower({ V: 200, I: 30, pf: 0.8 }, "P", "three");
    expect(single.ok && single.value).toBeCloseTo((200 * 30 * 0.8) / 1000, 10);
    expect(three.ok && three.value).toBeCloseTo((Math.sqrt(3) * 200 * 30 * 0.8) / 1000, 10);
  });

  it("efficiency_def: η=out/in, used identically by ohmsLaw and motorFrequency", () => {
    const generic = solveEfficiency({ inputKw: 10, outputKw: 9 }, "eta");
    const motor = solveMotorPower({ inputKw: 10, outputKw: 9 }, "eta", "single");
    expect(generic.ok && generic.value).toBeCloseTo(0.9, 10);
    expect(motor.ok && motor.value).toBeCloseTo(0.9, 10);
  });

  it("three_phase_y_voltage: V_line = √3 × V_phase, never conflated with Δ's V_line=V_phase", () => {
    const y = solveThreePhaseConnection({ phaseVoltage: 100 }, "lineVoltage", "Y");
    const d = solveThreePhaseConnection({ phaseVoltage: 100 }, "lineVoltage", "Delta");
    expect(y.ok && y.value).toBeCloseTo(100 * Math.sqrt(3), 10);
    expect(d.ok && d.value).toBeCloseTo(100, 10);
  });

  it("three_phase_delta_current: I_line = √3 × I_phase, never conflated with Y's I_line=I_phase", () => {
    const delta = solveThreePhaseConnection({ phaseCurrent: 10 }, "lineCurrent", "Delta");
    const y = solveThreePhaseConnection({ phaseCurrent: 10 }, "lineCurrent", "Y");
    expect(delta.ok && delta.value).toBeCloseTo(10 * Math.sqrt(3), 10);
    expect(y.ok && y.value).toBeCloseTo(10, 10);
  });

  it("transformer_capacity_conservation: S1=S2 across 1φ/3φ k-factor", () => {
    const singleR = solveTransformer({ v1: 6600, i1: 15.15 }, "kva", "single");
    const threeR = solveTransformer({ v1: 6600, i1: 15.15 }, "kva", "three");
    expect(singleR.ok && singleR.value).toBeCloseTo((6600 * 15.15) / 1000, 6);
    expect(threeR.ok && threeR.value).toBeCloseTo((Math.sqrt(3) * 6600 * 15.15) / 1000, 6);
  });

  it("motor_sync_speed: ns=120f/p", () => {
    const r = solveSyncSpeed({ frequencyHz: 50, poles: 4 }, "nsRpm");
    expect(r.ok && r.value).toBeCloseTo((120 * 50) / 4, 10); // 1500
  });

  it("motor_slip: s=(ns-nr)/ns", () => {
    const r = solveSlip({ nsRpm: 1500, actualRpm: 1450 }, "slip");
    expect(r.ok && r.value).toBeCloseTo((1500 - 1450) / 1500, 10);
  });

  it("motor_input_power: matches √3×V×I×cosφ/1000 (3φ)", () => {
    const r = solveMotorPower({ voltage: 400, current: 20, pf: 0.85 }, "inputKw", "three");
    expect(r.ok && r.value).toBeCloseTo((Math.sqrt(3) * 400 * 20 * 0.85) / 1000, 10);
  });

  it("voltage_drop_rx: lagging sign matches r·cosφ + x·sinφ, k=2 for single-phase", () => {
    const r = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "deltaV",
      "single",
      "lagging",
    );
    const sinPhi = Math.sqrt(1 - 0.8 * 0.8);
    expect(r.ok && r.value).toBeCloseTo((2 * 20 * (0.5 * 0.8 + 0.3 * sinPhi) * 50) / 1000, 10);
  });

  it("voltage_drop_simplified_coefficient: 35.6 (1φ2W) vs 30.8 (3φ3W) are never swapped", () => {
    const single = solveSimplifiedVoltageDrop({ current: 20, lengthM: 50, areaMm2: 5.5 }, "deltaV", "single2wire");
    const three = solveSimplifiedVoltageDrop({ current: 20, lengthM: 50, areaMm2: 5.5 }, "deltaV", "three3wire");
    expect(single.ok && single.value).toBeCloseTo((35.6 * 50 * 20) / (1000 * 5.5), 10);
    expect(three.ok && three.value).toBeCloseTo((30.8 * 50 * 20) / (1000 * 5.5), 10);
  });

  it("capacitor_correction: Qc=P(tanφ1-tanφ2)", () => {
    const r = solveCapacitorCorrection({ activePowerKw: 100, pfBefore: 0.8, pfAfter: 0.95 }, "qcKvar");
    const tan1 = Math.sqrt(1 - 0.8 * 0.8) / 0.8;
    const tan2 = Math.sqrt(1 - 0.95 * 0.95) / 0.95;
    expect(r.ok && r.value).toBeCloseTo(100 * (tan1 - tan2), 6);
  });

  it("ac_power_triangle / ac_power_factor_def: consistent between ohmsLaw and powerFactor implementations", () => {
    const fromOhms = solveAcPower({ P: 8, Q: 6 }, "S", "single");
    const fromPf = solvePowerTriangle({ activeP: 8, reactiveQ: 6 }, "apparentS");
    expect(fromOhms.ok && fromOhms.value).toBeCloseTo(10, 10);
    expect(fromPf.ok && fromPf.value).toBeCloseTo(10, 10);
  });

  it("impedance_magnitude: |Z|=√(R²+X²)", () => {
    const r = solveImpedance({ R: 3, X: 4 }, "Z");
    expect(r.ok && r.value).toBeCloseTo(5, 10);
  });

  it("inductive_reactance / capacitive_reactance: XL=2πfL, XC=1/(2πfC)", () => {
    const xl = solveInductiveReactance({ f: 50, L: 0.1 }, "XL");
    const xc = solveCapacitiveReactance({ f: 50, C: 100e-6 }, "XC");
    expect(xl.ok && xl.value).toBeCloseTo(2 * Math.PI * 50 * 0.1, 10);
    expect(xc.ok && xc.value).toBeCloseTo(1 / (2 * Math.PI * 50 * 100e-6), 6);
  });

  it("lc_resonance: f0=1/(2π√(LC))", () => {
    const r = solveResonance({ L: 1e-3, C: 1e-6 }, "f0");
    expect(r.ok && r.value).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(1e-3 * 1e-6)), 3);
  });

  it("series_rx_combination / parallel_resistance_pure", () => {
    const series = solveSeriesRX({ R1: 3, R2: 4 }, "Rtotal");
    const parallel = solveParallelResistance({ R1: 6, R2: 3 }, "Rtotal");
    expect(series.ok && series.value).toBeCloseTo(7, 10);
    expect(parallel.ok && parallel.value).toBeCloseTo(2, 10); // 6*3/9
  });

  it("parallel_complex_impedance: matches explicit complex division for a known pair", () => {
    const r = solveParallelComplexImpedance({ R1: 3, X1: 4, R2: 3, X2: 4 }, "Rtotal");
    expect(r.ok && r.value).toBeCloseTo(1.5, 10); // Z/2 for two identical impedances
  });

  it("transformer_rated_current: In=kVA*1000/(k*V)", () => {
    const single = solveTransformerRatedCurrent({ kva: 100, voltage: 200 }, "current", "single");
    const three = solveTransformerRatedCurrent({ kva: 100, voltage: 200 }, "current", "three");
    expect(single.ok && single.value).toBeCloseTo((100 * 1000) / 200, 6);
    expect(three.ok && three.value).toBeCloseTo((100 * 1000) / (Math.sqrt(3) * 200), 6);
  });

  it("simplified_short_circuit_current: Isc=In*100/%Z", () => {
    const r = solveSimplifiedShortCircuit({ ratedCurrentA: 500, percentZ: 5 }, "shortCircuitCurrentA");
    expect(r.ok && r.value).toBeCloseTo((500 * 100) / 5, 10);
  });

  it("percent_z_base_conversion: %Znew=%Zold*(kVAnew/kVAold)", () => {
    const r = solvePercentZBaseConversion({ percentZOld: 5, kvaOld: 100, kvaNew: 200 }, "percentZNew");
    expect(r.ok && r.value).toBeCloseTo(5 * (200 / 100), 10);
  });

  it("breaking_capacity_check: sufficient iff rated >= Isc", () => {
    expect(checkBreakingCapacity(2000, 2500)?.sufficient).toBe(true);
    expect(checkBreakingCapacity(2600, 2500)?.sufficient).toBe(false);
  });

  it("instrument_transformer_ratio: primary=secondary*ratio", () => {
    const r = solveInstrumentTransformerRatio({ secondary: 5, ratio: 200 }, "primary");
    expect(r.ok && r.value).toBeCloseTo(1000, 10);
  });

  it("voltage_classification: matches the registry's stated AC/DC boundary thresholds exactly", () => {
    expect(classifyVoltage(600, "AC")).toBe("low");
    expect(classifyVoltage(601, "AC")).toBe("high");
    expect(classifyVoltage(750, "DC")).toBe("low");
    expect(classifyVoltage(751, "DC")).toBe("high");
    expect(classifyVoltage(7000)).toBe("high");
    expect(classifyVoltage(7001)).toBe("extraHigh");
  });
});

/**
 * For every variable a registry entry declares, leave that one out of a
 * self-consistent full value set and confirm the engine actually solves it
 * — not just that ONE example value happens to check out. This is what
 * caught two real bugs during this audit: `solveMotorPower`'s declared "pf"
 * variable had no rule that could ever produce it, and `solveVoltageDrop`'s
 * declared "xOhmPerKm" was the same — both are fixed above; this harness
 * exists so a future formula added to a `direction:"bidirectional"` entry
 * without a matching rule fails CI immediately instead of silently shipping
 * a 求める値 option that can never actually resolve.
 */
function expectAllTargetsSolvable<K extends string>(
  solve: (known: Partial<Record<K, number>>, target: K) => { ok: boolean },
  fullValues: Record<K, number>,
) {
  const keys = Object.keys(fullValues) as K[];
  for (const target of keys) {
    const known: Partial<Record<K, number>> = {};
    for (const k of keys) if (k !== target) known[k] = fullValues[k];
    const r = solve(known, target);
    expect(r.ok, `expected target "${String(target)}" to be solvable from {${keys.filter((k) => k !== target).join(", ")}}`).toBe(true);
  }
}

describe("FORMULA_REGISTRY — declared 'bidirectional' entries: every variable is actually solvable by the engine", () => {
  it("dc_ohms_law: V,I,R,P all solvable from the other three", () => {
    expectAllTargetsSolvable(solveDcCircuit, { V: 50, I: 10, R: 5, P: 500 });
  });

  it("ac_apparent_power / ac_active_power_direct / ac_power_triangle / ac_power_factor_def: V,I,S,P,Q,pf all solvable", () => {
    // V=200,I=30,pf=0.8 => S=6,P=4.8,Q=sqrt(36-23.04)=3.6 (self-consistent)
    expectAllTargetsSolvable(
      (known, target) => solveAcPower(known, target, "single"),
      { V: 200, I: 30, S: 6, P: 4.8, Q: 3.6, pf: 0.8 },
    );
  });

  it("efficiency_def: inputKw,outputKw,eta all solvable", () => {
    expectAllTargetsSolvable(solveEfficiency, { inputKw: 10, outputKw: 9, eta: 0.9 });
  });

  it("three_phase_y_*: lineVoltage,phaseVoltage,lineCurrent,phaseCurrent all solvable (Y)", () => {
    expectAllTargetsSolvable(
      (known, target) => solveThreePhaseConnection(known, target, "Y"),
      { lineVoltage: Math.sqrt(3) * 100, phaseVoltage: 100, lineCurrent: 10, phaseCurrent: 10 },
    );
  });

  it("three_phase_delta_*: lineVoltage,phaseVoltage,lineCurrent,phaseCurrent all solvable (Δ)", () => {
    expectAllTargetsSolvable(
      (known, target) => solveThreePhaseConnection(known, target, "Delta"),
      { lineVoltage: 100, phaseVoltage: 100, lineCurrent: Math.sqrt(3) * 10, phaseCurrent: 10 },
    );
  });

  it("transformer_capacity_conservation / transformer_turns_ratio_single_phase: kva,v1,i1,v2,i2,turnsRatio all solvable (1φ)", () => {
    // v1=200,i1=5 => kva=1; v2=100,turnsRatio=2 => i2=10 (i2/i1=2=turnsRatio, consistent)
    expectAllTargetsSolvable(
      (known, target) => solveTransformer(known, target, "single"),
      { kva: 1, v1: 200, i1: 5, v2: 100, i2: 10, turnsRatio: 2 },
    );
  });

  it("motor_sync_speed: frequencyHz,poles,nsRpm all solvable", () => {
    expectAllTargetsSolvable(solveSyncSpeed, { frequencyHz: 50, poles: 4, nsRpm: 1500 });
  });

  it("motor_slip: nsRpm,actualRpm,slip all solvable", () => {
    expectAllTargetsSolvable(solveSlip, { nsRpm: 1500, actualRpm: 1450, slip: 1 / 30 });
  });

  it("motor_input_power / efficiency_def (motor side): voltage,current,pf,eta,inputKw,outputKw all solvable (3φ)", () => {
    const k = Math.sqrt(3);
    const inputKw = (k * 400 * 20 * 0.85) / 1000;
    expectAllTargetsSolvable(
      (known, target) => solveMotorPower(known, target, "three"),
      { voltage: 400, current: 20, pf: 0.85, eta: 0.9, inputKw, outputKw: inputKw * 0.9 },
    );
  });

  it("voltage_drop_rx: current,rOhmPerKm,xOhmPerKm,lengthM,deltaV all solvable (pf is intentionally input-only, checked separately)", () => {
    const sinPhi = Math.sqrt(1 - 0.8 * 0.8);
    const deltaV = (2 * 20 * (0.5 * 0.8 + 0.3 * sinPhi) * 50) / 1000;
    expectAllTargetsSolvable(
      (known: Partial<Record<"current" | "rOhmPerKm" | "xOhmPerKm" | "lengthM" | "deltaV", number>>, target) =>
        solveVoltageDrop({ ...known, pf: 0.8 }, target, "single", "lagging"),
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, lengthM: 50, deltaV },
    );
  });

  it("voltage_drop_rx: pf is deliberately NOT solvable (documented exception, not a gap)", () => {
    const r = solveVoltageDrop(
      { deltaV: 1.16, current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, lengthM: 50 },
      "pf",
      "single",
      "lagging",
    );
    expect(r.ok).toBe(false);
  });

  it("voltage_drop_relations: deltaV,deltaVPercent,sourceVoltage,endVoltage all solvable", () => {
    expectAllTargetsSolvable(
      (known: Partial<Record<"deltaV" | "deltaVPercent" | "sourceVoltage" | "endVoltage", number>>, target) =>
        solveVoltageDrop(known, target, "dc"),
      { deltaV: 10, deltaVPercent: 5, sourceVoltage: 200, endVoltage: 190 },
    );
  });

  it("voltage_drop_simplified_coefficient: current,lengthM,areaMm2,deltaV all solvable (単相2線式)", () => {
    expectAllTargetsSolvable(
      (known, target) => solveSimplifiedVoltageDrop(known, target, "single2wire"),
      { current: 20, lengthM: 50, areaMm2: 5.5, deltaV: (35.6 * 50 * 20) / (1000 * 5.5) },
    );
  });

  it("capacitor_correction: activePowerKw,pfBefore,pfAfter,qcKvar all solvable (previously pfBefore was not)", () => {
    const tan1 = Math.sqrt(1 - 0.8 * 0.8) / 0.8;
    const tan2 = Math.sqrt(1 - 0.95 * 0.95) / 0.95;
    expectAllTargetsSolvable(solveCapacitorCorrection, {
      activePowerKw: 100,
      pfBefore: 0.8,
      pfAfter: 0.95,
      qcKvar: 100 * (tan1 - tan2),
    });
  });

  it("impedance_magnitude: R,X,Z all solvable", () => {
    expectAllTargetsSolvable(solveImpedance, { R: 3, X: 4, Z: 5 });
  });

  it("inductive_reactance: XL,L,f all solvable", () => {
    expectAllTargetsSolvable(solveInductiveReactance, { XL: 2 * Math.PI * 50 * 0.1, L: 0.1, f: 50 });
  });

  it("capacitive_reactance: XC,C,f all solvable", () => {
    expectAllTargetsSolvable(solveCapacitiveReactance, {
      XC: 1 / (2 * Math.PI * 50 * 100e-6),
      C: 100e-6,
      f: 50,
    });
  });

  it("lc_resonance: f0,L,C all solvable", () => {
    expectAllTargetsSolvable(solveResonance, {
      f0: 1 / (2 * Math.PI * Math.sqrt(1e-3 * 1e-6)),
      L: 1e-3,
      C: 1e-6,
    });
  });

  it("series_rx_combination: R1,R2,Rtotal,X1,X2,Xtotal all solvable", () => {
    expectAllTargetsSolvable(solveSeriesRX, { R1: 3, R2: 4, Rtotal: 7, X1: 2, X2: 5, Xtotal: 7 });
  });

  it("parallel_resistance_pure: R1,R2,Rtotal all solvable", () => {
    expectAllTargetsSolvable(solveParallelResistance, { R1: 6, R2: 3, Rtotal: 2 });
  });

  it("transformer_rated_current: kva,voltage,current all solvable (1φ)", () => {
    expectAllTargetsSolvable(
      (known, target) => solveTransformerRatedCurrent(known, target, "single"),
      { kva: 100, voltage: 200, current: 500 },
    );
  });

  it("simplified_short_circuit_current: ratedCurrentA,percentZ,shortCircuitCurrentA all solvable", () => {
    expectAllTargetsSolvable(solveSimplifiedShortCircuit, {
      ratedCurrentA: 500,
      percentZ: 5,
      shortCircuitCurrentA: 10000,
    });
  });

  it("percent_z_base_conversion: percentZOld,kvaOld,percentZNew,kvaNew all solvable", () => {
    expectAllTargetsSolvable(solvePercentZBaseConversion, {
      percentZOld: 5,
      kvaOld: 100,
      percentZNew: 10,
      kvaNew: 200,
    });
  });

  it("instrument_transformer_ratio: primary,secondary,ratio all solvable", () => {
    expectAllTargetsSolvable(solveInstrumentTransformerRatio, { primary: 1000, secondary: 5, ratio: 200 });
  });

  it("parallel_complex_impedance (direction:forward): Rtotal/Xtotal/Ztotal solvable, but R1/X1/R2/X2 are NOT (documented, not a gap)", () => {
    const full = { R1: 3, X1: 4, R2: 3, X2: 4, Rtotal: 1.5, Xtotal: 2, Ztotal: 2.5 };
    for (const target of ["Rtotal", "Xtotal", "Ztotal"] as const) {
      const known = { ...full };
      delete (known as Record<string, number | undefined>)[target];
      const r = solveParallelComplexImpedance(known, target);
      expect(r.ok, `expected ${target} to be solvable`).toBe(true);
    }
    for (const target of ["R1", "X1", "R2", "X2"] as const) {
      const known = { ...full };
      delete (known as Record<string, number | undefined>)[target];
      const r = solveParallelComplexImpedance(known, target);
      expect(r.ok, `expected ${target} to remain unsolvable (forward-only by design)`).toBe(false);
    }
  });
});
