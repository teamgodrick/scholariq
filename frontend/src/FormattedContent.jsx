import React from 'react';

/**
 * Clean markdown and math formatter for ScholarIQ Prof. Pilot.
 * Turns raw ##, ###, **, $$, and LaTeX formulas into readable, beautifully formatted typography.
 */
export default function FormattedContent({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let inList = false;
  let listItems = [];

  const flushList = (keyPrefix) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-ul`} style={{ margin: '8px 0 14px 22px', paddingLeft: '2px' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '6px', lineHeight: 1.6, color: '#f1e8ff' }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const cleanMathString = (str) => {
    return str
      .replace(/\\lim_\{x\s*\\to\s*([^}]+)\}/gi, 'lim (x → $1)')
      .replace(/\\lim_\{x\s*->\s*([^}]+)\}/gi, 'lim (x → $1)')
      .replace(/\\lim_\(x\s*\\to\s*([^)]+)\)/gi, 'lim (x → $1)')
      .replace(/\\to/gi, '→')
      .replace(/\\le/gi, '≤')
      .replace(/\\ge/gi, '≥')
      .replace(/\\neq/gi, '≠')
      .replace(/\\approx/gi, '≈')
      .replace(/\\cdot/gi, '·')
      .replace(/\\times/gi, '×')
      .replace(/\\pm/gi, '±')
      .replace(/\\infty/gi, '∞')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/gi, '($1 / $2)')
      .replace(/\\text\{([^}]+)\}/gi, '$1')
      .replace(/\\sin/gi, 'sin')
      .replace(/\\cos/gi, 'cos')
      .replace(/\\tan/gi, 'tan')
      .replace(/\\det/gi, 'det')
      .replace(/\\left\(/gi, '(')
      .replace(/\\right\)/gi, ')')
      .replace(/\\\(/gi, '')
      .replace(/\\\)/gi, '')
      .replace(/\\\[/gi, '')
      .replace(/\\\]/gi, '')
      .replace(/\\_/g, '_')
      .replace(/\$\$/g, '')
      .replace(/\$/g, '');
  };

  const renderInline = (str) => {
    const cleaned = cleanMathString(str);
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    const tokens = cleaned.split(regex);

    return tokens.map((token, idx) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return (
          <strong key={idx} style={{ color: '#ffffff', fontWeight: 700 }}>
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith('`') && token.endsWith('`')) {
        return (
          <code
            key={idx}
            style={{
              background: 'rgba(168, 85, 247, 0.15)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              color: '#c084fc',
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      return token;
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList(idx);
      return;
    }

    // Display Math lines: starts with $$ or looks like a centered formula
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      flushList(idx);
      const mathContent = trimmed.slice(2, -2).trim();
      elements.push(
        <div
          key={idx}
          style={{
            margin: '10px 0',
            padding: '10px 16px',
            background: 'rgba(168, 85, 247, 0.12)',
            borderLeft: '3px solid var(--purple-bright)',
            borderRadius: '6px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '14px',
            color: '#f3e8ff',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {cleanMathString(mathContent)}
        </div>
      );
      return;
    }

    // Heading 2: ## Title
    if (trimmed.startsWith('## ')) {
      flushList(idx);
      elements.push(
        <h2
          key={idx}
          style={{
            fontSize: '17px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '20px 0 10px',
            paddingBottom: '6px',
            borderBottom: '1px solid rgba(168, 85, 247, 0.25)',
          }}
        >
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      return;
    }

    // Heading 3: ### Title
    if (trimmed.startsWith('### ')) {
      flushList(idx);
      elements.push(
        <h3
          key={idx}
          style={{
            fontSize: '14.5px',
            fontWeight: 700,
            color: '#c084fc',
            margin: '14px 0 6px',
          }}
        >
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      return;
    }

    // Bullet points: • or - or *
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(trimmed.slice(2));
      return;
    }

    // Normal text paragraph
    flushList(idx);
    elements.push(
      <p key={idx} style={{ margin: '6px 0', lineHeight: 1.65, color: '#e9d5ff' }}>
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList('final');

  return <div style={{ fontSize: '13.5px' }}>{elements}</div>;
}
