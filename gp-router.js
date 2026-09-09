(() => {
  'use strict';

  const MINIMUM_SCORE = 0.18;
  const STOP_TERMS = new Set(['ช่วย', 'ต้องการ', 'เกี่ยวกับ', 'สำหรับ', 'และ', 'หรือ', 'การ', 'งาน', 'เรื่อง', 'ให้', 'ด้วย']);

  function normalize(value) {
    return String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  function compact(value) {
    return normalize(value).replace(/\s/g, '');
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function queryTerms(query) {
    const text = normalize(query);
    const words = text.split(' ').filter(term => term.length > 1 && !STOP_TERMS.has(term));
    const thaiRuns = text.match(/[\u0E00-\u0E7F]{4,}/g) || [];
    const fragments = thaiRuns.flatMap(run => {
      const terms = [];
      for (let length = 4; length <= Math.min(run.length, 8); length += 1) {
        for (let start = 0; start <= run.length - length; start += 1) terms.push(run.slice(start, start + length));
      }
      return terms;
    });
    return unique([...words, ...fragments]);
  }

  function scoreTool(terms, query, tool) {
    const name = compact(tool.name);
    const description = compact(tool.desc);
    const category = compact(tool.category);
    const fields = compact((tool.fields || []).join(' '));
    const matchedTerms = terms.filter(term => [name, description, category, fields].some(text => text.includes(term)));
    const score = matchedTerms.reduce((total, term) => total
      + (name.includes(term) ? 0.12 : 0)
      + (description.includes(term) ? 0.08 : 0)
      + (category.includes(term) ? 0.04 : 0)
      + (fields.includes(term) ? 0.03 : 0), 0);
    const exactNameBonus = compact(query).includes(name) ? 0.55 : 0;
    return { tool, matchedTerms: unique(matchedTerms).slice(0, 3), score: Math.min(1, score + exactNameBonus) };
  }

  function fallback() {
    return Object.freeze({
      selectedGpId: null,
      score: 0,
      confidence: 0,
      matchedReason: 'ไม่พบ GP ที่ตรงกับคำค้นอย่างเพียงพอ',
      fallback: true
    });
  }

  function route(query) {
    const text = normalize(query);
    const tools = Array.isArray(window.GOVPROMPT_TOOLS) ? window.GOVPROMPT_TOOLS : [];
    if (!text || !tools.length) return fallback();

    const terms = queryTerms(text);
    const ranked = tools.map(tool => scoreTool(terms, text, tool));
    ranked.sort((left, right) => right.score - left.score || left.tool.id.localeCompare(right.tool.id));
    const selected = ranked[0];
    if (!selected || selected.score < MINIMUM_SCORE) return fallback();

    return Object.freeze({
      selectedGpId: selected.tool.id,
      score: Number(selected.score.toFixed(2)),
      confidence: Number(selected.score.toFixed(2)),
      matchedReason: `ตรงกับ ${selected.tool.id}: ${selected.matchedTerms.join(', ')}`,
      fallback: false,
      tool: selected.tool
    });
  }

  window.GOVPROMPT_ROUTER = Object.freeze({ route });
})();
