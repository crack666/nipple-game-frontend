import { ReactNode } from 'react';

export function TabsLayout({ tabs, active, onChange }: { tabs: { key:string; label:string; badge?:number }[]; active:string; onChange:(k:string)=>void }) {
  return (
    <div className="tabs-bar">
      {tabs.map(t => (
        <button key={t.key} className={t.key===active? 'tab active':'tab'} onClick={()=>onChange(t.key)}>
          {t.label}
          {typeof t.badge==='number' && <span className="tab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}