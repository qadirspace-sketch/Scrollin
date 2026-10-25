
// --- CONSTANTS: STATIC TEMPLATE SCHEMAS ---

const SCHEMAS = {
    'Listicle': {
        name: 'The "Value List" Framework',
        structure: [
            { key: 'HOOK', label: 'Hook (Problem/Promise)' },
            { key: 'TRANSITION', label: 'Transition (Credibility/Context)' },
            { key: 'BODY', label: 'List Items (The Value)' },
            { key: 'CTA', label: 'Call to Action' }
        ]
    },
    'Personal Story': {
        name: 'The "Hero\'s Journey" Framework',
        structure: [
            { key: 'HOOK', label: 'Hook (The Conflict)' },
            { key: 'CONTEXT', label: 'Context ( The Situation)' },
            { key: 'TURNING_POINT', label: 'Turning Point (The Realization)' },
            { key: 'LESSON', label: 'The Lesson' },
            { key: 'CTA', label: 'Call to Action' }
        ]
    },
    'Contrarian / Warning': {
        name: 'The "Myth Buster" Framework',
        structure: [
            { key: 'HOOK', label: 'Hook (The Myth/Mistake)' },
            { key: 'AGITATION', label: 'Agitation (Why it fails)' },
            { key: 'SOLUTION', label: 'The Better Way' },
            { key: 'CTA', label: 'Call to Action' }
        ]
    },
    'Educational / Value': {
        name: 'The "How-To" Guide',
        structure: [
            { key: 'HOOK', label: 'Hook (The Outcome)' },
            { key: 'CONTEXT', label: 'Why it matters' },
            { key: 'STEPS', label: 'The Process' },
            { key: 'CTA', label: 'Call to Action' }
        ]
    },
    'Default': {
        name: 'The "Standard" Framework',
        structure: [
            { key: 'HOOK', label: 'Hook' },
            { key: 'BODY', label: 'Main Content' },
            { key: 'CTA', label: 'Outro' }
        ]
    }
};

// --- HELPER: TEXT EXTRACTION ---

const extractHook = (lines) => {
    // Usually first 1-2 lines
    return lines.slice(0, 2).join('\n').trim();
};

const extractCTA = (lines) => {
    // Look for common CTA markers in last few lines
    const lastLines = lines.slice(-4);
    const ctaIndex = lastLines.findIndex(l =>
        /comment|follow|dm|link|repost|agree\?|thoughts\?/i.test(l)
    );

    if (ctaIndex !== -1) {
        return lastLines.slice(ctaIndex).join('\n').trim();
    }
    // Fallback: Last non-empty line
    return lines[lines.length - 1] || "";
};

const maskEntities = (text) => {
    if (!text) return "";
    return text
        .replace(/\$\d+(?:,\d+)*(?:\.\d+)?/g, '${Amount}')
        .replace(/\d+(?:,\d+)*(?:\.\d+)?/g, '{N}')
        .replace(/@\w+/g, '{Mention}')
        .replace(/(https?:\/\/[^\s]+)/g, '{Link}');
};

// --- MAIN ENGINE ---

export const generateDeterministicTemplate = (post, patternType) => {
    if (!post || !post.text) return null;

    const lines = post.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Robustness: Even short posts should generate a template template
    // if (lines.length < 3) return null; <--- REMOVED THIS CHECK

    // 1. Select Schema - content-driven override
    // We re-analyze the body lines to see if it's REALLY a list, regardless of the label
    const probableListItems = lines.filter(l => /^[0-9]+[\.\)]|^\-/i.test(l));
    const isStrongList = probableListItems.length >= 3;

    let schemaType = 'Default';
    if (isStrongList || patternType.includes('Listicle') || patternType.includes('List-based')) {
        schemaType = 'Listicle';
    }
    else if (patternType.includes('Story')) schemaType = 'Personal Story';
    else if (patternType.includes('Contrarian')) schemaType = 'Contrarian / Warning';
    else if (patternType.includes('Educational') || patternType.includes('Guide')) schemaType = 'Educational / Value';

    const schema = SCHEMAS[schemaType];

    // 2. Extract Sections (Rule-Based)
    const hook = extractHook(lines);
    const cta = extractCTA(lines);

    // Body is everything between Hook and CTA
    const bodyLines = lines.filter(l => !hook.includes(l) && !cta.includes(l));
    const bodyText = bodyLines.join('\n');

    // 3. Map to Schema Slots
    const templateData = {};

    // Standard Mapping Strategy
    templateData['HOOK'] = `[Opening Hook]\n${maskEntities(hook)}\n(Goal: Grab attention with this style)`;

    if (schemaType === 'Listicle') {
        templateData['TRANSITION'] = "[Context]\n(Explain why this list matters)";
        templateData['BODY'] = "[The List]\n(Item 1)\n(Item 2)\n(Item 3)";
    } else if (schemaType === 'Personal Story') {
        templateData['CONTEXT'] = "[The Situation]\n(Set the scene)";
        templateData['TURNING_POINT'] = "[The Turning Point]\n(When things changed)";
        templateData['LESSON'] = `[The Lesson]\n${maskEntities(bodyText.slice(0, 100))}...`;
    } else {
        templateData['BODY'] = `[Main Content]\n${maskEntities(bodyText.slice(0, 150))}...`;
    }

    templateData['CTA'] = `[Call To Action]\n${maskEntities(cta)}`;

    return {
        schemaName: schema.name,
        structure: schema.structure,
        data: templateData,
        rawText: post.text // Valid for reference
    };
};
