import { useEffect, useId, useRef, useState } from 'react';
import { useLanguage } from '../i18n';
import { helpGuides, type HelpGuide } from './help-guides';
import './help.css';

export { helpGuides } from './help-guides';
export type { HelpStep } from './help-guides';
export type HelpTopic = keyof typeof helpGuides | 'all';
type GuideKey = Exclude<HelpTopic, 'all'>;

export function Help({ topic, className = '', label }: { topic: HelpTopic; className?: string; label?: string }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  return <div className={`module-help ${className}`}>
    <button className="help-link" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      {label ?? (language === 'en' ? 'help' : 'ayuda')}
    </button>
    {open && <HelpDialog topic={topic} close={() => setOpen(false)} />}
  </div>;
}

function HelpDialog({ topic, close }: { topic: HelpTopic; close(): void }) {
  const { language } = useLanguage();
  const [selected, setSelected] = useState<GuideKey>(topic === 'all' ? 'overview' : topic);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const topicId = useId();
  const guide: HelpGuide = helpGuides[selected];
  const step = guide.steps[index];
  const keys = Object.keys(helpGuides) as GuideKey[];
  const image = `/help/${language}/${step.image}`;
  const chooseGuide = (key: GuideKey) => { setSelected(key); setIndex(0); };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => { headingRef.current?.focus(); }, [index, selected]);

  return <dialog ref={dialogRef} className="help-dialog" aria-labelledby={titleId} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }}>
    <header className="help-heading">
      <h2 id={titleId}>{language === 'en' ? 'Help' : 'Ayuda'}</h2>
      <button type="button" className="help-close" onClick={close} aria-label={language === 'en' ? 'Close help' : 'Cerrar ayuda'}>{language === 'en' ? 'Close' : 'Cerrar'} <span aria-hidden="true">×</span></button>
    </header>
    <div className="help-layout">
      <nav className="help-topics" aria-label={language === 'en' ? 'Help topics' : 'Temas de ayuda'}>
        <p className="help-topics-label">{language === 'en' ? 'Topics' : 'Temas'}</p>
        {keys.map(key => <button key={key} type="button" aria-current={selected === key ? 'true' : undefined} onClick={() => chooseGuide(key)}>{helpGuides[key].title[language]}</button>)}
      </nav>
      <div className="help-reader">
        <div className="help-topic-picker">
          <label htmlFor={topicId}>{language === 'en' ? 'Topic' : 'Tema'}</label>
          <select id={topicId} value={selected} onChange={event => chooseGuide(event.target.value as GuideKey)}>
            {keys.map(key => <option key={key} value={key}>{helpGuides[key].title[language]}</option>)}
          </select>
        </div>
        <div className="help-progress" aria-live="polite">
          <span>{guide.title[language]}</span>
          <span>{language === 'en' ? 'Step' : 'Paso'} {index + 1} / {guide.steps.length}</span>
        </div>
        <ol className="help-step-nav" aria-label={language === 'en' ? 'Guide steps' : 'Pasos de la guía'}>
          {guide.steps.map((item, position) => <li key={position}><button type="button" aria-current={position === index ? 'step' : undefined} aria-label={`${language === 'en' ? 'Step' : 'Paso'} ${position + 1}: ${item.title[language]}`} onClick={() => setIndex(position)}>{position + 1}</button></li>)}
        </ol>
        <h3 ref={headingRef} tabIndex={-1}>{step.title[language]}</h3>
        <p className="help-instruction">{step.text[language]}</p>
        <figure className="help-screenshot">
          <a href={image} target="_blank" rel="noopener noreferrer" aria-label={`${language === 'en' ? 'Enlarge image' : 'Ampliar imagen'}: ${step.alt[language]}`}>
            <img key={image} src={image} alt={step.alt[language]} decoding="async" />
            <span className="help-image-action">{language === 'en' ? 'Enlarge image' : 'Ampliar imagen'} <span aria-hidden="true">↗</span></span>
          </a>
        </figure>
        <footer className="help-actions">
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>{language === 'en' ? 'Previous' : 'Anterior'}</button>
          {index < guide.steps.length - 1
            ? <button type="button" className="help-next" onClick={() => setIndex(index + 1)}>{language === 'en' ? 'Next' : 'Siguiente'} <span aria-hidden="true">→</span></button>
            : <button type="button" className="help-next" onClick={close}>{language === 'en' ? 'Done' : 'Listo'}</button>}
        </footer>
      </div>
    </div>
  </dialog>;
}
