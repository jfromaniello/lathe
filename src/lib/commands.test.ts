import { describe, expect, it, vi } from "vitest";
import { clampStep, matchOption, parseQuery, searchCommands, shapeCommands, type ChoiceCommand, type NumberCommand } from "./commands";
import { DEFAULT_PARAMS, type ShapeParams } from "./shape";
import { en, es } from "@/i18n/dictionaries";

const ids = (q: string, dict = es) => searchCommands(shapeCommands(dict, DEFAULT_PARAMS, () => {}), q).map((c) => c.id);

describe("searchCommands", () => {
  it("finds settings by label, in either language, ignoring accents", () => {
    expect(ids("altura")[0]).toBe("height");
    expect(ids("height")[0]).toBe("height");
    expect(ids("estrias")).toContain("ribCount");
    expect(ids("cupula")[0]).toBe("topDome");
  });

  it("finds settings by the words people actually use", () => {
    expect(ids("giro")[0]).toBe("twist");
    expect(ids("bisel")[0]).toBe("slant");
    expect(ids("pendiente")[0]).toBe("slant");
    expect(ids("slant", en)[0]).toBe("slant");
    expect(ids("macizo")[0]).toBe("mode");
  });

  it("narrows with every word and ignores the value", () => {
    expect(ids("lobulos profundidad 12")[0]).toBe("lobeAmplitude");
    expect(ids("estrias profundidad")[0]).toBe("ribAmplitude");
  });

  it("tolerates loose typing (prefixes and subsequences)", () => {
    expect(ids("alt")[0]).toBe("height");
    expect(ids("tw", en)[0]).toBe("twist");
  });

  it("returns nothing for gibberish and everything for an empty query", () => {
    expect(ids("zzqx")).toEqual([]);
    expect(ids("").length).toBe(shapeCommands(es, DEFAULT_PARAMS, () => {}).length);
  });
});

describe("parseQuery", () => {
  it("pulls out a trailing number with or without unit, also with a decimal comma", () => {
    expect(parseQuery("altura 150")).toEqual({ text: ["altura"], value: 150 });
    expect(parseQuery("giro -45°")).toEqual({ text: ["giro"], value: -45 });
    expect(parseQuery("pared 1,5 mm")).toEqual({ text: ["pared", "mm"], value: 1.5 });
    expect(parseQuery("wall 2mm").value).toBe(2);
    expect(parseQuery("wall").value).toBeUndefined();
  });
});

describe("commands write the params", () => {
  const run = (id: string, v: number, p: ShapeParams = DEFAULT_PARAMS) => {
    const onChange = vi.fn();
    const cmd = shapeCommands(es, p, onChange).find((c) => c.id === id) as NumberCommand;
    cmd.set(clampStep(cmd, v));
    return onChange.mock.calls[0][0] as ShapeParams;
  };

  it("sets a plain number, clamped to the slider range and snapped to its step", () => {
    expect(run("twist", 90).twist).toBe(90);
    expect(run("height", 1000).height).toBe(400);
    expect(run("wall", 1.234).wall).toBe(1.2);
  });

  it("maps the percentage and the split height back to fractions", () => {
    expect(run("innerRib", 50).innerRib).toBe(0.5);
    expect(run("split", 90).split).toBeCloseTo(0.5, 5);
    expect(run("split", 0).split).toBe(0);
  });

  it("matches a choice option from the query", () => {
    const wave = shapeCommands(en, DEFAULT_PARAMS, () => {}).find((c) => c.id === "ribWaveform") as ChoiceCommand;
    expect(matchOption(wave, "wave sine")).toBe("sine");
    const mode = shapeCommands(es, DEFAULT_PARAMS, () => {}).find((c) => c.id === "mode") as ChoiceCommand;
    expect(matchOption(mode, "modo macizo")).toBe("solid");
    expect(matchOption(mode, "modo")).toBeUndefined();
  });
});
