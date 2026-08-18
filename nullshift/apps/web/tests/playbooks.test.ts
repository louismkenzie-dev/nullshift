import { describe, expect, it } from "vitest";
import { PLAYBOOKS, instantiate, playbooksForStage, toggleItem } from "@/lib/playbooks";

/**
 * Playbooks are operational contracts: every template must be non-empty and
 * every lifecycle stage that promises a playbook must actually get one.
 */
describe("playbook templates", () => {
  it("every playbook has a title and 3+ items; all but children_data are stage-offered", () => {
    for (const p of Object.values(PLAYBOOKS)) {
      expect(p.title).toBeTruthy();
      expect(p.items.length).toBeGreaterThanOrEqual(3);
      // children_data is seeded by a compliance flag, never offered by stage.
      if (p.kind === "children_data") expect(p.stages).toEqual([]);
      else expect(p.stages.length).toBeGreaterThan(0);
    }
  });

  it("the gate stages each offer their playbook", () => {
    expect(playbooksForStage("onboarding").map((p) => p.kind)).toContain("onboarding");
    expect(playbooksForStage("launch_prep").map((p) => p.kind)).toContain("launch");
    expect(playbooksForStage("complete").map((p) => p.kind)).toContain("close_retro");
    expect(playbooksForStage("discovery").map((p) => p.kind)).toContain("discovery_call");
  });

  it("item names are unique within a playbook (toggling is by name)", () => {
    for (const p of Object.values(PLAYBOOKS)) {
      expect(new Set(p.items).size).toBe(p.items.length);
    }
  });
});

describe("instantiate + toggleItem", () => {
  it("instantiates all items unchecked", () => {
    const items = instantiate("launch");
    expect(items.length).toBe(PLAYBOOKS.launch.items.length);
    expect(items.every((i) => !i.done)).toBe(true);
  });

  it("toggles exactly the named item, by name not index", () => {
    const items = instantiate("onboarding");
    const target = items[2].name;
    const once = toggleItem(items, target);
    expect(once.find((i) => i.name === target)?.done).toBe(true);
    expect(once.filter((i) => i.done).length).toBe(1);
    const twice = toggleItem(once, target);
    expect(twice.every((i) => !i.done)).toBe(true);
  });

  it("ignores unknown names instead of corrupting the list", () => {
    const items = instantiate("handover");
    expect(toggleItem(items, "not-a-real-item")).toEqual(items);
  });
});
