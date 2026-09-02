import { brandName } from '../brand';
import {
  EmailButton,
  EmailFootnote,
  EmailHeading,
  EmailLayout,
  EmailParagraph,
} from './components';

export interface NotificationDigestItem {
  title: string;
  body?: string;
  severity: string;
}

export interface NotificationDigestEmailProps {
  businessName: string;
  items: NotificationDigestItem[];
  workspaceUrl: string;
}

export function NotificationDigestEmail({
  businessName,
  items,
  workspaceUrl,
}: NotificationDigestEmailProps) {
  return (
    <EmailLayout preview={`${businessName} — ${items.length} update(s)`}>
      <EmailHeading>{businessName}</EmailHeading>
      <EmailParagraph>
        {items.length === 1
          ? 'There is one thing waiting for you:'
          : `There are ${items.length} things waiting for you:`}
      </EmailParagraph>

      {items.map((item) => (
        <EmailParagraph key={`${item.severity}-${item.title}`}>
          <strong>{item.title}</strong>
          {item.body ? ` — ${item.body}` : ''}
        </EmailParagraph>
      ))}

      <EmailButton href={workspaceUrl}>Open {brandName()}</EmailButton>
      <EmailFootnote>
        You are receiving this because you own or manage {businessName}.
      </EmailFootnote>
    </EmailLayout>
  );
}
