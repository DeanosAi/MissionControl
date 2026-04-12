'use client';

import { CodeBlock } from './code-block';

interface TaskOutputParserProps {
  output: string;
}

export function TaskOutputParser({ output }: TaskOutputParserProps) {
  // Parse markdown code blocks from the output
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(output)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: output.slice(lastIndex, match.index),
      });
    }

    // Add code block
    parts.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1] || 'text',
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < output.length) {
    parts.push({
      type: 'text',
      content: output.slice(lastIndex),
    });
  }

  // If no code blocks found, just show the text
  if (parts.length === 0) {
    return <pre className="exec-output-body">{output}</pre>;
  }

  return (
    <div className="task-output-parsed">
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <CodeBlock
              key={index}
              code={part.content}
              language={part.language}
              filename={`output-${index + 1}.${part.language}`}
            />
          );
        } else {
          return (
            <div key={index} className="task-output-text">
              {part.content.split('\n').map((line, i) => (
                <p key={i}>{line || '\u00A0'}</p>
              ))}
            </div>
          );
        }
      })}
    </div>
  );
}
