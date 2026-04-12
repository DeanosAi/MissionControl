'use client';

import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export function CodeBlock({ code, language = 'python', filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  // Collapse code blocks longer than 10 lines
  const lines = code.split('\n');
  const isLong = lines.length > 10;
  const shouldCollapse = isLong && !expanded;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `code.${language === 'python' ? 'py' : language === 'javascript' ? 'js' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-language">{language}</span>
        <div className="code-block-actions">
          <button
            onClick={handleCopy}
            className="run-task-button"
            title="Copy code to clipboard"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="run-task-button"
            title="Download as file"
          >
            ⬇️ Download
          </button>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="run-task-button"
              title={expanded ? 'Collapse code' : 'Expand code'}
            >
              {expanded ? '▲ Collapse' : '▼ Expand'}
            </button>
          )}
        </div>
      </div>
      {shouldCollapse ? (
        <div className="code-block-collapsed">
          <p className="micro-copy">Code collapsed ({lines.length} lines). Use buttons above to copy, download, or expand.</p>
        </div>
      ) : (
        <pre className="code-block-content">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
