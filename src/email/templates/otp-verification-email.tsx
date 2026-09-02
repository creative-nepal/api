import { brandName } from '../brand';
import {
  EmailCode,
  EmailHeading,
  EmailLayout,
  EmailParagraph,
} from './components';

export interface OtpVerificationEmailProps {
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
}

const copyByType: Record<
  OtpVerificationEmailProps['type'],
  { preview: string; heading: string; body: string }
> = {
  'sign-in': {
    preview: `Your ${brandName()} sign-in code`,
    heading: 'Your sign-in code',
    body: 'Enter this code to finish signing in to your account.',
  },
  'email-verification': {
    preview: `Verify your ${brandName()} email address`,
    heading: 'Verify your email',
    body: 'Enter this code to verify your email address.',
  },
  'forget-password': {
    preview: `Your ${brandName()} password reset code`,
    heading: 'Reset your password',
    body: 'Enter this code to reset your password.',
  },
  'change-email': {
    preview: `Confirm your new ${brandName()} email address`,
    heading: 'Confirm your new email',
    body: 'Enter this code to confirm your new email address.',
  },
};

export function OtpVerificationEmail({ otp, type }: OtpVerificationEmailProps) {
  const copy = copyByType[type];

  return (
    <EmailLayout preview={copy.preview}>
      <EmailHeading>{copy.heading}</EmailHeading>
      <EmailParagraph>{copy.body} It expires in 5 minutes.</EmailParagraph>
      <EmailCode>{otp}</EmailCode>
      <EmailParagraph>
        Never share this code with anyone. {brandName()} will never ask you for
        it.
      </EmailParagraph>
    </EmailLayout>
  );
}
