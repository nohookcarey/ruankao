import type { Question } from '../model/types';
import { areaMap } from '../model/questions';
import { Markdown } from './Markdown';
import { IconCheck, IconClose, IconStar } from './Icons';

const typeLabel: Record<string, string> = {
  single: '单选',
  fill: '填空',
  case: '案例',
};

export interface QuestionViewProps {
  q: Question;
  picked?: string | null;
  inputs?: string[];
  /** 是否已判定/已交卷 */
  reveal: boolean;
  /** 客观题对错；主观题为 null */
  correct?: boolean | null;
  fillFlags?: boolean[];
  /** 是否展开解析与参考答案 */
  showExplanation: boolean;
  disabled?: boolean;
  onPick?: (key: string) => void;
  onInput?: (index: number, value: string) => void;
  faved?: boolean;
  onToggleFav?: () => void;
  selfMark?: 'known' | 'unknown' | null;
  onSelf?: (known: boolean) => void;
}

export function QuestionView({
  q,
  picked,
  inputs = [],
  reveal,
  correct = null,
  fillFlags = [],
  showExplanation,
  disabled,
  onPick,
  onInput,
  faved,
  onToggleFav,
  selfMark,
  onSelf,
}: QuestionViewProps) {
  const area = areaMap[q.area];

  return (
    <div className="q-wrap fade-in" key={q.id}>
      <div className="q-meta">
        <span className="chip chip--primary">{area?.name ?? q.area}</span>
        <span className="chip">{typeLabel[q.type]}</span>
        {q.difficulty === 3 && <span className="chip">较难</span>}
        {q.tags.slice(0, 2).map((t) => (
          <span className="chip" key={t}>
            {t}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        {onToggleFav && (
          <button
            className={`icon-btn${faved ? ' is-active' : ''}`}
            onClick={onToggleFav}
            aria-label="收藏"
            style={{ width: 30, height: 30 }}
          >
            <IconStar filled={faved} size={19} />
          </button>
        )}
      </div>

      <div className="q-stem">
        <Markdown>{q.stem}</Markdown>
      </div>

      {q.type === 'single' && (
        <div className="opts">
          {q.options.map((opt) => {
            const isPicked = picked === opt.key;
            const isRight = reveal && correct !== null && opt.key === q.answer;
            const isWrongPick = reveal && isPicked && correct === false;
            const cls = [
              'opt',
              isRight ? 'is-correct' : '',
              isWrongPick ? 'is-wrong' : '',
              !reveal && isPicked ? 'is-picked' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={opt.key}
                className={cls}
                disabled={disabled || reveal}
                onClick={() => onPick?.(opt.key)}
              >
                <span className="opt__key">{opt.key}</span>
                <div className="opt__text">
                  <Markdown>{opt.text}</Markdown>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'fill' && (
        <div className="fills">
          {q.blanks.map((blank, i) => {
            const flag = reveal ? fillFlags[i] : undefined;
            const cls =
              flag === true ? 'fill-input is-ok' : flag === false ? 'fill-input is-bad' : 'fill-input';
            return (
              <div key={blank.id}>
                <div className="fill-row">
                  <span className="fill-no">{i + 1}</span>
                  <input
                    className={cls}
                    value={inputs[i] ?? ''}
                    placeholder={blank.hint ?? '输入答案'}
                    disabled={disabled || reveal}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => onInput?.(i, e.target.value)}
                  />
                </div>
                {!reveal && blank.hint && <div className="fill-hint">{blank.hint}</div>}
                {reveal && flag === false && (
                  <div className="fill-hint" style={{ color: 'var(--ok)' }}>
                    参考答案：{blank.answers[0]}
                    {blank.answers.length > 1 && ` （也接受：${blank.answers.slice(1).join('、')}）`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {q.type === 'case' && (
        <div>
          {q.subQuestions.map((sub, i) => (
            <div className="case-sub" key={sub.no}>
              <div className="case-sub__no">问题 {sub.no || i + 1}</div>
              <Markdown>{sub.stem}</Markdown>
              {showExplanation && (
                <div className="explain" style={{ marginTop: 10 }}>
                  <div className="explain__title">参考答案</div>
                  <Markdown>{sub.reference}</Markdown>
                  {sub.keyPoints.length > 0 && (
                    <>
                      <div className="explain__title" style={{ marginTop: 12 }}>
                        采分要点
                      </div>
                      <ul className="kp">
                        {sub.keyPoints.map((k) => (
                          <li key={k}>{k}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {reveal && onSelf && (
            <div className="self-row">
              <button
                className={`self-btn${selfMark === 'known' ? ' is-ok' : ''}`}
                onClick={() => onSelf(true)}
              >
                我会做
              </button>
              <button
                className={`self-btn${selfMark === 'unknown' ? ' is-bad' : ''}`}
                onClick={() => onSelf(false)}
              >
                没答上来
              </button>
            </div>
          )}
        </div>
      )}

      {reveal && q.type !== 'case' && (
        <div className={`banner ${correct ? 'banner--ok' : 'banner--bad'}`}>
          {correct ? <IconCheck size={18} /> : <IconClose size={18} />}
          <span>
            {correct
              ? '回答正确'
              : q.type === 'single'
                ? `回答错误，正确答案是 ${q.answer}`
                : '回答错误'}
          </span>
        </div>
      )}

      {showExplanation && q.type !== 'case' && q.explanation && (
        <div className="explain">
          <div className="explain__title">解析</div>
          <Markdown>{q.explanation}</Markdown>
        </div>
      )}
    </div>
  );
}
