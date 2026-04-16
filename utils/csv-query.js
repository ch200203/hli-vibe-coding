/**
 * filter(data, conditions)
 * conditions: [{ field, op, value }]
 * ops: eq, neq, gt, gte, lt, lte, between(value=[min,max]), contains, in(value=[...])
 * Numeric strings auto-coerced for comparison.
 */
function filter(data, conditions) {
  // 하위호환: { key: value } 객체 → [{ field, op, value }] 배열로 변환
  if (!Array.isArray(conditions)) {
    conditions = Object.entries(conditions).map(([field, value]) => {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        if (value.min !== undefined || value.max !== undefined) {
          return { field, op: "between", value: [value.min ?? -Infinity, value.max ?? Infinity] };
        }
        return { field, op: "eq", value };
      }
      return { field, op: "eq", value };
    });
  }
  return data.filter((row) =>
    conditions.every(({ field, op, value }) => {
      const cell = row[field];
      const cellNum = Number(cell);
      const isNum = !isNaN(cellNum) && cell !== null && cell !== "";

      switch (op) {
        case "eq":
          return isNum ? cellNum === Number(value) : cell === value;
        case "neq":
          return isNum ? cellNum !== Number(value) : cell !== value;
        case "gt":
          return isNum ? cellNum > Number(value) : cell > value;
        case "gte":
          return isNum ? cellNum >= Number(value) : cell >= value;
        case "lt":
          return isNum ? cellNum < Number(value) : cell < value;
        case "lte":
          return isNum ? cellNum <= Number(value) : cell <= value;
        case "between": {
          const [min, max] = value;
          return isNum
            ? cellNum >= Number(min) && cellNum <= Number(max)
            : cell >= min && cell <= max;
        }
        case "contains":
          return String(cell).includes(String(value));
        case "in":
          return value.includes(isNum ? cellNum : cell) ||
            value.map(String).includes(String(cell));
        default:
          return false;
      }
    })
  );
}

/**
 * groupBy(data, key) → { [keyValue]: rows[] }
 */
function groupBy(data, key) {
  return data.reduce((groups, row) => {
    const groupKey = row[key];
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(row);
    return groups;
  }, {});
}

/**
 * aggregate(groups, fn) → [{ key, value }] sorted by value desc
 * fn: "count" | "sum:fieldName" | "avg:fieldName" | "min:fieldName" | "max:fieldName"
 */
function aggregate(groups, fn) {
  const result = [];

  for (const [groupKey, rows] of Object.entries(groups)) {
    let value;

    if (fn === "count") {
      value = rows.length;
    } else {
      const [op, col] = fn.split(":");
      const values = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));

      if (op === "sum") {
        value = values.reduce((a, b) => a + b, 0);
      } else if (op === "avg") {
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      } else if (op === "max") {
        value = values.length > 0 ? Math.max(...values) : null;
      } else if (op === "min") {
        value = values.length > 0 ? Math.min(...values) : null;
      } else {
        value = null;
      }
    }

    result.push({ key: groupKey, value });
  }

  return result.sort((a, b) => b.value - a.value);
}

/**
 * join(leftData, rightData, leftKey, rightKey) → merged array
 */
function join(leftData, rightData, leftKey, rightKey) {
  const rightMap = new Map();
  for (const row of rightData) {
    const k = row[rightKey];
    if (!rightMap.has(k)) rightMap.set(k, []);
    rightMap.get(k).push(row);
  }

  const result = [];
  for (const leftRow of leftData) {
    const matches = rightMap.get(leftRow[leftKey]);
    if (matches) {
      for (const rightRow of matches) {
        result.push({ ...leftRow, ...rightRow });
      }
    }
  }
  return result;
}

/**
 * sort(data, field, order) — order: "asc" | "desc"
 */
function sort(data, field, order = "asc") {
  return [...data].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    const cmp = av < bv ? -1 : 1;
    return order === "desc" ? -cmp : cmp;
  });
}

/**
 * topN(data, field, n) — top N rows by field value
 */
function topN(data, field, n = 5) {
  return sort(data, field, "desc").slice(0, n);
}

module.exports = { filter, groupBy, aggregate, join, sort, topN };
