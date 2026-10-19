const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
};
const MAGNITUDES: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };
const DIGITS = /^\$?(\d[\d,]*(?:\.\d+)?)(k|m|b|x|%)?$/;

type Kind = "unit" | "tens" | "scale";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.,$%\s-]/g, " ")
    .split(/[\s-]+/)
    .map((token) => token.replace(/^[.,]+|[.,]+$/g, ""))
    .filter(Boolean);
}

function canJoin(last: Kind | null, kind: Kind, current: number, value: number): boolean {
  if (last === null || last === "scale") return true;
  return last === "tens" && kind === "unit" && current % 10 === 0 && value < 10;
}

export function numbersIn(text: string): Set<number> {
  const found = new Set<number>();
  const tokens = tokenize(text);
  const spelled: { value: number; followsNumber: boolean }[] = [];
  let total = 0;
  let current = 0;
  let last: Kind | null = null;
  let followsNumber = false;

  const finish = () => {
    if (last === null) return;
    spelled.push({ value: total + current, followsNumber });
    total = 0;
    current = 0;
    last = null;
  };

  tokens.forEach((token, index) => {
    const word = UNITS[token] ?? TENS[token];
    if (word !== undefined) {
      const kind: Kind = token in UNITS ? "unit" : "tens";
      if (!canJoin(last, kind, current, word)) {
        finish();
        followsNumber = true;
      }
      current += word;
      last = kind;
      return;
    }
    const scale = SCALES[token];
    if (scale !== undefined && last !== null) {
      if (scale === 100) current = (current || 1) * 100;
      else {
        total += (current || 1) * scale;
        current = 0;
      }
      last = "scale";
      return;
    }
    if (token === "and" && last === "scale") return;

    finish();
    followsNumber = false;
    const ordinal = ORDINALS[token];
    if (ordinal !== undefined) {
      found.add(ordinal);
      return;
    }
    const digits = DIGITS.exec(token);
    if (digits) {
      const value = Number(digits[1]!.replace(/,/g, ""));
      found.add(value);
      const magnitude = MAGNITUDES[digits[2] ?? ""];
      if (magnitude) found.add(value * magnitude);
      const following = SCALES[tokens[index + 1] ?? ""];
      if (following) found.add(value * following);
    }
  });
  finish();

  spelled.forEach(({ value, followsNumber: paired }, k) => {
    found.add(value);
    const previous = spelled[k - 1]?.value;
    if (paired && previous !== undefined && previous >= 10 && previous < 100 && value < 100) {
      found.add(previous * 100 + value);
    }
  });
  return found;
}
