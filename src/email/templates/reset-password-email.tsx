import {
  EmailButton,
  EmailFootnote,
  EmailHeading,
  EmailLayout,
  EmailParagraph,
} from './components';

export interface ResetPasswordEmailProps {
  name: string;
  url: string;
}

export function ResetPasswordEmail({ name, url }: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Reset your Creative Nepal password">
      <EmailHeading>Reset your password</EmailHeading>
      <EmailParagraph>
        Hi {name}, we received a request to reset the password for your account.
        Click the button below to choose a new one. This link expires in 1 hour.
      </EmailParagraph>
      <EmailButton href={url}>Reset password</EmailButton>
      <EmailFootnote>
        Or copy and paste this URL into your browser:
      </EmailFootnote>
      <EmailFootnote>{url}</EmailFootnote>
    </EmailLayout>
  );
}
