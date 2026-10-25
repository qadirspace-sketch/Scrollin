function extractTimeFromUrn(urn) {
    if (!urn || typeof urn !== 'string') return null;
    const match = urn.match(/(\d+)/);
    if (!match) return null;

    const id = BigInt(match[1]);
    const timestamp = Number(id >> 22n);
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) return null;

    return date;
}

module.exports = { extractTimeFromUrn };
