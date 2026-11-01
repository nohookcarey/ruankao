import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { resolveAsset } from '../model/judge';

interface Props {
  children: string;
  className?: string;
}

/** 统一 Markdown 渲染：题干、选项、解析都走这里，保证样式一致 */
export function Markdown({ children, className }: Props) {
  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => (
            <img src={resolveAsset(String(src ?? ''))} alt={alt ?? ''} loading="lazy" />
          ),
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
