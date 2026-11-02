import type { Question } from '../model/types';
import { areaMap } from '../model/questions';
import { Markdown } from './Markdown';
import { IconCheck, IconClose, IconStar } from './Icons';

const typeLabel: Record<string, string> = {
  single: '单选',
  fill: '填空',
  case: '案例',
};

/** 共用材料题的标注头：〔共用材料 · 共 N 空，本题是第 K 空〕 */
const STEM_META = /^〔共用材料 · 共\s*(\d+)\s*空，本题是第\s*(\d+)\s*空〕[ \t]*\n*/;

const NUM_LIGHT = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const NUM_SOLID = ['❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '❿'];

/**
 * 共用材料题的材料里往往有多处 （　） 空位，但一道题只答其中一个。
 * 这里按出现顺序给空位编号，并把本题对应的那一空换成实心圆，
 * 让「我在答第几个空」一眼可见，避免「共 2 空却只有一个选项」的困惑。
 */
function numberBlanks(body: string, current: number): string {
  let i = 0;
  return body.replace(/（　）/g, () => {
    i += 1;
    const solid = i === current;
    const glyph = solid ? NUM_SOLID[i - 1] : NUM_LIGHT[i - 1];
    return glyph ? `（${glyph}　）` : '（　）';
  });
}

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
  /** 背题模式：直接亮出正确答案，但不判对错、不显示结果条 */
  answerOnly?: boolean;
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
  answerOnly = false,
  disabled,
  onPick,
  onInput,
  faved,
  onToggleFav,
  selfMark,
  onSelf,
}: QuestionViewProps) {
  const area = areaMap[q.area];

  const meta = STEM_META.exec(q.stem);
  const blankTotal = meta ? Number(meta[1]) : 0;
  const blankIndex = meta ? Number(meta[2]) : 0;
  const stemBody = meta ? q.stem.slice(meta[0].length) : q.stem;
  const stemText = meta ? numberBlanks(stemBody, blankIndex) : q.stem;
  /** 材料里实际标出的空位数，可能和「共 N 空」对不上（源卷有缺题） */
  const blanksInStem = meta ? (stemBody.match(/（　）/g) ?? []).length : 0;

  return (
    <div className="q-wrap fade-in" key={q.id}>
      <div className="q-meta">
        <span className="chip chip--primary">{area?.name ?? q.area}</span>
        <span className="chip">{typeLabel[q.type]}</span>
        {blankTotal > 0 && (
          <span className="chip chip--primary" title="共用材料题：材料中有多个空，本题只答其中一空">
            第 {blankIndex} 空 / 共 {blankTotal} 空
          </span>
        )}
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
        <Markdown>{stemText}</Markdown>
      </div>

      {blankTotal > 0 && (
        <div className="sub" style={{ marginTop: -4, marginBottom: 10 }}>
          {blanksInStem >= blankIndex
            ? `共用材料题：本题只考第 ${blankIndex} 个空位（实心圆），其余空位用浅色序号标出，下面的选项只针对这一空。`
            : `共用材料题：本题对应第 ${blankIndex} 空，但材料里只识别到 ${blanksInStem} 个空位，源卷此处有缺漏，请参考解析作答。`}
        </div>
      )}

      {q.type === 'single' && (
        <div className="opts">
          {q.options.map((opt) => {
            const isPicked = picked === opt.key;
            const isRight = reveal && (answerOnly || correct !== null) && opt.key === q.answer;
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
                {(answerOnly || (reveal && flag === false)) && (
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

      {reveal && !answerOnly && q.type !== 'case' && (
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
