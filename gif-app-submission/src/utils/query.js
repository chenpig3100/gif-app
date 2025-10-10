export function parseBool(v, def = undefined) {
    if (v === undefined || v === null) return def;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (["1", "true", "yes", "on"].includes(s)) return true;
        if (["0", "false", "no", "off"].includes(s)) return false;
    }
    return def;
};

export function parseNumber(v, def = undefined) {
    if (v === undefined || v === null) return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
};

export function parseData(v, def = undefined) {
    if (!v) return def;
    const d = new Date(v);
    return isNaN(d.getTime()) ? def : d;
};

export function buildLinkHeader(baseUrl, { nextCursor } = {}) {
    const parts = [];
    if (nextCursor) { 
        const u = new URL(baseUrl, "http://dummy"); // base is required but ignored
        u.searchParams.set("cursor", nextCursor);
        parts.push(`<${u.pathname + u.search}>; rel="next"`);
    }

    return parts.join(", ");
};