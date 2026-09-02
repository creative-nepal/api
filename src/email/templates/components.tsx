import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { brandName } from '../brand';

const colors = {
  background: '#f4f4f5',
  card: '#ffffff',
  border: '#e4e4e7',
  text: '#18181b',
  muted: '#71717a',
  brand: '#111827',
};

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.background,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: '32px 16px',
        }}
      >
        <Container
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            maxWidth: 480,
            margin: '0 auto',
            padding: '32px 32px 24px',
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: colors.brand,
              letterSpacing: '-0.01em',
              margin: '0 0 24px',
            }}
          >
            {brandName()}
          </Text>
          {children}
          <Hr style={{ borderColor: colors.border, margin: '32px 0 16px' }} />
          <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 20,
        fontWeight: 600,
        color: colors.text,
        margin: '0 0 12px',
      }}
    >
      {children}
    </Text>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 14,
        lineHeight: '22px',
        color: colors.muted,
        margin: '0 0 20px',
      }}
    >
      {children}
    </Text>
  );
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section style={{ margin: '0 0 24px' }}>
      <a
        href={href}
        style={{
          display: 'inline-block',
          backgroundColor: colors.brand,
          color: '#ffffff',
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
          padding: '12px 24px',
          borderRadius: 8,
        }}
      >
        {children}
      </a>
    </Section>
  );
}

export function EmailCode({ children }: { children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: '16px 24px',
        margin: '0 0 24px',
        textAlign: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '0.3em',
          color: colors.text,
          margin: 0,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

export function EmailFootnote({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontSize: 12, color: colors.muted, margin: '0 0 4px' }}>
      {children}
    </Text>
  );
}
