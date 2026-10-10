import { expect, test } from "vitest";
import { parseSimpleYaml, flattenTokenData } from "../src/index.js";
test("parses YAML token subset",()=>{const data=parseSimpleYaml(`color:\n  brand:\n    $type: color\n    $value: \"#8838F3\"\n`);const tokens=flattenTokenData(data,{file:"tokens.yaml"});expect(tokens.get("color.brand")?.value).toBe("#8838F3")});
