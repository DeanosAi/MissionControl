import fs from 'fs';
import { FileText, FolderOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getRuntimeConfig, resolveDocsPath } from '@/lib/runtime';

export const dynamic = 'force-dynamic';

interface Doc {
  filename: string;
  title: string;
  content: string;
  createdAt: string;
}

function loadDocs(): Doc[] {
  try {
    const docsDir = getRuntimeConfig().docsDir;
    const files = fs.readdirSync(docsDir).filter((f: string) => f.endsWith('.md'));
    return files.map((filename: string) => {
      const content = fs.readFileSync(resolveDocsPath(filename), 'utf-8');
      const stat = fs.statSync(resolveDocsPath(filename));
      const titleMatch = content.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');
      return {
        filename,
        title,
        content,
        createdAt: stat.birthtime.toISOString().split('T')[0],
      };
    });
  } catch {
    return [];
  }
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default function DocsPage() {
  const docs = loadDocs();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Documents</h1>
        <p style={{ color: 'var(--muted)' }} className="text-sm">
          Every artifact, PRD, plan, and doc created during our work.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <FolderOpen size={16} style={{ color: 'var(--accent)' }} />
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {docs.length === 0 ? (
        <div className="card text-center py-12">
          <FileText size={32} style={{ color: 'var(--muted)' }} className="mx-auto mb-4" />
          <p style={{ color: 'var(--muted)' }} className="text-sm">
            No docs yet. They&apos;ll show up here as we create things together.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {docs.map((doc) => (
            <div key={doc.filename} className="card">
              <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                <FileText size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-semibold">{doc.title}</span>
                <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>
                  {doc.createdAt}
                </span>
              </div>
              <div className="text-sm leading-relaxed" style={{ color: 'var(--foreground)', opacity: 0.9 }}>
                <MarkdownContent content={doc.content} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
