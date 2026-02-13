import { describe, it, expect } from 'vitest';
import AuthorizationService from './authorization';

describe('Email Validation Tests', () => {
  describe('General Email Address Format Validation', () => {
    describe('Valid Email Addresses', () => {
      const validEmails = [
        'user@gmail.com',
        'user@yahoo.com',
        'user@outlook.com',
        'user@company.com',
        'test.email@example.com',
        'user_name@domain.org',
        'user-name@example.net',
        'user+tag@gmail.com',
        '123user@example.com',
        'user123@domain.co.uk',
        'User.Name@example.com',
        'test_email_123+tag@company.org',
        // Google Workspace/custom domain emails
        'user@yourcompany.com',
        'user@googleworkspace.com',
      ];

      it.each(validEmails)('should accept valid email address: %s', email => {
        expect(AuthorizationService.isValidGmailAddress(email)).toBe(true);
      });
    });

    describe('Invalid Email Addresses', () => {
      const invalidEmails = [
        // Invalid formats
        'user@.com',
        'user@',
        'user@ gmail.com',
        'user@domain .com',
        '@gmail.com',
        'user',
        '',
        'user@domain',
        'user@domain.',
      ];

      it.each(invalidEmails)('should reject invalid email: %s', email => {
        expect(AuthorizationService.isValidGmailAddress(email)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string', () => {
        expect(AuthorizationService.isValidGmailAddress('')).toBe(false);
      });

      it('should handle null input', () => {
        expect(AuthorizationService.isValidGmailAddress(null as any)).toBe(false);
      });

      it('should handle undefined input', () => {
        expect(AuthorizationService.isValidGmailAddress(undefined as any)).toBe(false);
      });
    });

    describe('Case Sensitivity', () => {
      it('should accept any case combination for domain', () => {
        const cases = ['user@gmail.com', 'user@GMAIL.COM', 'user@Gmail.Com', 'user@gMail.cOm'];

        cases.forEach(email => {
          expect(AuthorizationService.isValidGmailAddress(email)).toBe(true);
        });
      });
    });
  });

  describe('Email Normalization', () => {
    it('should normalize email to lowercase and trim whitespace', () => {
      expect(AuthorizationService.normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
      expect(AuthorizationService.normalizeEmail('Test.Email+Tag@COMPANY.COM')).toBe(
        'test.email+tag@company.com'
      );
      expect(AuthorizationService.normalizeEmail('user@example.com')).toBe('user@example.com');
    });

    it('should handle edge cases in normalization', () => {
      expect(AuthorizationService.normalizeEmail('')).toBe('');
      expect(AuthorizationService.normalizeEmail('   ')).toBe('');
      expect(() => AuthorizationService.normalizeEmail(null as any)).not.toThrow();
    });
  });
});
