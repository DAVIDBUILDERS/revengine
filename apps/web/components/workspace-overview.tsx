import type {ReactNode} from 'react';

export function WorkspaceOverview({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children?:ReactNode}){
 return <section className="workspace-overview"><div className="workspace-overview-copy"><span className="studio-kicker">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{children&&<div className="workspace-overview-content">{children}</div>}</section>;
}
