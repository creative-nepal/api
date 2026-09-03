import { brandName } from '../brand';
import {
  EmailFootnote,
  EmailHeading,
  EmailLayout,
  EmailParagraph,
} from './components';

export interface AppointmentReminderEmailProps {
  businessName: string;
  customerName: string;
  serviceName: string;
  scheduledAtLabel: string;
  durationMinutes: number;
  staffName?: string;
}

export function AppointmentReminderEmail({
  businessName,
  customerName,
  serviceName,
  scheduledAtLabel,
  durationMinutes,
  staffName,
}: AppointmentReminderEmailProps) {
  return (
    <EmailLayout preview={`${serviceName} at ${scheduledAtLabel}`}>
      <EmailHeading>{businessName}</EmailHeading>
      <EmailParagraph>
        Hello {customerName}, this is a reminder of your upcoming appointment.
      </EmailParagraph>
      <EmailParagraph>
        <strong>{serviceName}</strong>
        {staffName ? ` with ${staffName}` : ''}
      </EmailParagraph>
      <EmailParagraph>
        {scheduledAtLabel} · {durationMinutes} minutes
      </EmailParagraph>
      <EmailFootnote>
        Sent by {businessName} through {brandName()}. Please contact the shop
        directly to change or cancel.
      </EmailFootnote>
    </EmailLayout>
  );
}
