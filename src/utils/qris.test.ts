import { assertEquals } from "@std/assert";
import {
  parseEMVCo,
  serializeEMVCo,
  computeCRC16,
  generateDynamicQRIS,
  validateStaticQrisPayload,
  describeQrisValidationError,
} from "./qris.ts";

Deno.test("parseEMVCo - should parse raw tags correctly", () => {
  const payload = "0002010102116304ABCD";
  const tags = parseEMVCo(payload);
  assertEquals(tags.get("00"), "01");
  assertEquals(tags.get("01"), "11");
  assertEquals(tags.get("63"), "ABCD");
});

Deno.test("serializeEMVCo - should serialize tags while skipping CRC tag 63", () => {
  const tags = new Map<string, string>([
    ["00", "01"],
    ["01", "11"],
    ["63", "ABCD"]
  ]);
  const serialized = serializeEMVCo(tags);
  assertEquals(serialized, "000201010211");
});

Deno.test("computeCRC16 - should calculate correct CRC-16-CCITT checksum", () => {
  const data = "123456789";
  const crc = computeCRC16(data);
  assertEquals(crc, "29B1");
});

Deno.test("generateDynamicQRIS - should inject transaction amount and dynamic indicator while preserving tags", () => {
  const staticPayload = "00020101021151260016ID.CO.QRIS.WWW020412345802ID6304ABCD";
  const dynamic = generateDynamicQRIS(staticPayload, 25000, "inv_test_999");
  
  const tags = parseEMVCo(dynamic);
  assertEquals(tags.get("01"), "12"); // Initiation Method should be 12 (Dynamic)
  assertEquals(tags.get("54"), "25000"); // Amount tag 54 should be set
  assertEquals(tags.get("58"), "ID"); // Tag 58 should be preserved
});

Deno.test("generateDynamicQRIS - should correctly convert real GoPay/GoFood QRIS to dynamic", () => {
  const realGoPayStatic = "00020101021126610014COM.GO-JEK.WWW01189360091435575271210210G5575271210303UMI51440014ID.CO.QRIS.WWW0215ID10253801132960303UMI5204504553033605802ID5920Mango Teknusa, MGRSR6009MOJOKERTO61056131762070703A0163044ACC";
  const dynamic = generateDynamicQRIS(realGoPayStatic, 5001);
  
  const tags = parseEMVCo(dynamic);
  assertEquals(tags.get("01"), "12");
  assertEquals(tags.get("54"), "5001");
  assertEquals(tags.get("58"), "ID");
  assertEquals(tags.get("62"), "0703A01"); // Tag 62 terminal label must be preserved untouched!
  assertEquals(tags.get("59"), "Mango Teknusa, MGRSR");
});


// ---------------------------------------------------------------------------
// [EMPLOYR PATCH P2] validateStaticQrisPayload
// ---------------------------------------------------------------------------

/** Membangun QRIS statis uji yang sah: isi dirakit lalu CRC dihitung, bukan ditulis tangan. */
function buildTestQris(overrides: { drop?: string[]; extra?: string } = {}): string {
  const field = (tag: string, value: string) => `${tag}${value.length.toString().padStart(2, "0")}${value}`;
  const parts: Record<string, string> = {
    "00": "01",
    "01": "11",
    "26": "0014ID.CO.QRIS.WWW0215ID1234567890123",
    "52": "5812",
    "53": "360",
    "58": "ID",
    "59": "Toko Uji Employr",
    "60": "JAKARTA",
    "61": "10110",
  };
  for (const tag of overrides.drop ?? []) delete parts[tag];
  const body = Object.keys(parts).sort().map((tag) => field(tag, parts[tag])).join("") + (overrides.extra ?? "");
  const withCrcHeader = `${body}6304`;
  return withCrcHeader + computeCRC16(withCrcHeader);
}

Deno.test("validateStaticQrisPayload - accepts a well-formed static QRIS and returns merchant name and city", () => {
  const result = validateStaticQrisPayload(buildTestQris());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.merchantName, "Toko Uji Employr");
    assertEquals(result.city, "JAKARTA");
  }
});

Deno.test("validateStaticQrisPayload - tolerates surrounding whitespace and a lowercase CRC", () => {
  const good = buildTestQris();
  assertEquals(validateStaticQrisPayload(`  \n${good}\t `).ok, true);
  const lowerCrc = good.slice(0, -4) + good.slice(-4).toLowerCase();
  assertEquals(validateStaticQrisPayload(lowerCrc).ok, true);
});

Deno.test("validateStaticQrisPayload - rejects empty or whitespace-only input", () => {
  assertEquals(validateStaticQrisPayload(""), { ok: false, reason: "EMPTY" });
  assertEquals(validateStaticQrisPayload("   \n "), { ok: false, reason: "EMPTY" });
  assertEquals(validateStaticQrisPayload(null), { ok: false, reason: "EMPTY" });
  assertEquals(validateStaticQrisPayload(undefined), { ok: false, reason: "EMPTY" });
});

Deno.test("validateStaticQrisPayload - rejects text that is not a QRIS", () => {
  assertEquals(validateStaticQrisPayload("https://example.com/pay"), { ok: false, reason: "NOT_QRIS" });
  assertEquals(validateStaticQrisPayload("hello world"), { ok: false, reason: "NOT_QRIS" });
  assertEquals(validateStaticQrisPayload("0002020101126304ABCD"), { ok: false, reason: "NOT_QRIS" });
});

Deno.test("validateStaticQrisPayload - rejects a truncated payload (structure runs past the end)", () => {
  const good = buildTestQris();
  for (const cut of [5, 8, 30, 60]) {
    const result = validateStaticQrisPayload(good.slice(0, cut));
    assertEquals(result.ok, false, `cut at ${cut} chars must be rejected`);
  }
});

Deno.test("validateStaticQrisPayload - rejects a wrong CRC (a single changed character)", () => {
  const good = buildTestQris();
  const flipped = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");
  assertEquals(validateStaticQrisPayload(flipped), { ok: false, reason: "BAD_CRC" });
  // Isi diubah tetapi CRC lama dipertahankan
  const tampered = good.replace("Toko Uji Employr", "Toko Uji Lainnya");
  assertEquals(validateStaticQrisPayload(tampered).ok, false);
});

Deno.test("validateStaticQrisPayload - rejects trailing data after the CRC", () => {
  const result = validateStaticQrisPayload(buildTestQris() + "00");
  assertEquals(result.ok, false);
});

Deno.test("validateStaticQrisPayload - rejects a payload missing a required field", () => {
  for (const tag of ["52", "53", "58", "59", "60"]) {
    const result = validateStaticQrisPayload(buildTestQris({ drop: [tag] }));
    assertEquals(result, { ok: false, reason: "MISSING_FIELDS" }, `missing tag ${tag}`);
  }
});

Deno.test("validateStaticQrisPayload - rejects non-numeric tag or length", () => {
  const good = buildTestQris();
  const badTag = "00020101021A" + good.slice(12);
  assertEquals(validateStaticQrisPayload(badTag).ok, false);
});

Deno.test("validateStaticQrisPayload - the real GoPay sample from the existing test suite is accepted", () => {
  // Memastikan validator tidak terlalu ketat terhadap format QRIS GoPay/GoFood yang nyata
  // (tag 26 COM.GO-JEK, tag 51 ID.CO.QRIS.WWW, tag 62 label terminal), bukan hanya payload buatan sendiri.
  const realGoPayStatic = "00020101021126610014COM.GO-JEK.WWW01189360091435575271210210G5575271210303UMI51440014ID.CO.QRIS.WWW0215ID10253801132960303UMI5204504553033605802ID5920Mango Teknusa, MGRSR6009MOJOKERTO61056131762070703A0163044ACC";
  const result = validateStaticQrisPayload(realGoPayStatic);
  assertEquals(result.ok, true, JSON.stringify(result));
  if (result.ok) {
    assertEquals(result.merchantName, "Mango Teknusa, MGRSR");
    assertEquals(result.city, "MOJOKERTO");
  }
});

Deno.test("describeQrisValidationError - every reason has a human-readable message", () => {
  for (const reason of ["EMPTY", "NOT_QRIS", "BAD_STRUCTURE", "BAD_CRC", "MISSING_FIELDS"] as const) {
    const message = describeQrisValidationError(reason);
    assertEquals(typeof message, "string");
    assertEquals(message.length > 20, true, reason);
  }
});
