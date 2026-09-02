import { brandName } from '../brand';
import {
  EmailButton,
  EmailFootnote,
  EmailHeading,
  EmailLayout,
  EmailParagraph,
} from './components';

export interface OrganizationInvitationEmailProps {
  organizationName: string;
  inviterName: string;
  role: string;
  url: string;
}

export function OrganizationInvitationEmail({
  organizationName,
  inviterName,
  role,
  url,
}: OrganizationInvitationEmailProps) {
  return (
    <EmailLayout preview={`Join ${organizationName} on ${brandName()}`}>
      <EmailHeading>You have been invited to {organizationName}</EmailHeading>
      <EmailParagraph>
        {inviterName} invited you to join <strong>{organizationName}</strong> on
        {brandName()} as a <strong>{role}</strong>. Accept the invitation to get
        access.
      </EmailParagraph>
      <EmailButton href={url}>Accept invitation</EmailButton>
      <EmailFootnote>
        Or copy and paste this URL into your browser:
      </EmailFootnote>
      <EmailFootnote>{url}</EmailFootnote>
    </EmailLayout>
  );
}
