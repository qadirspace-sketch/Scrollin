// Plain-English names for hook patterns. The server names a pattern "<hook type> <format>",
// e.g. "Result / Transformation Mixed"; these helpers turn that into "Results story · mixed".

const HOOKS = {
    'Result / Transformation': 'Results story',
    'Contrarian / Warning': 'Contrarian take',
    'Educational / Value': 'How-to',
    'Personal Story': 'Personal story',
    'Punchy Statement': 'Punchy one-liner',
    'Visual Teaser': 'Visual teaser',
    'Listicle': 'Numbered list',
    'Question': 'Question',
    'Observation': 'Observation',
    'Other': 'Other',
};
const FORMATS = { 'List-based': 'bullet list', 'Mixed': 'text with a short list', 'Paragraph': 'paragraphs' };

const split = (name = '') => {
    const hook = Object.keys(HOOKS).find(h => name.startsWith(h));
    if (!hook) return { hook: name, format: null };
    return { hook, format: name.slice(hook.length).trim() || null };
};

/** "Result / Transformation Mixed" → "Results story" */
export const hookLabel = (name) => {
    const { hook } = split(name);
    return HOOKS[hook] || hook;
};

/** "Result / Transformation Mixed" → "Results story · text with a short list" */
export const patternLabel = (name) => {
    const { hook, format } = split(name);
    const h = HOOKS[hook] || hook;
    return format ? `${h} · ${FORMATS[format] || format.toLowerCase()}` : h;
};
