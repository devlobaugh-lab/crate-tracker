import { describe, it, expect } from 'vitest';
import AuthorizationService from './authorization';

describe('Gmail Validation Tests', () => {
  describe('Gmail Address Format Validation', () => {
    describe('Valid Gmail Addresses', () => {
      const validGmailAddresses = [
        'user@gmail.com',
        'test.email@gmail.com',
        'user_name@gmail.com',
        'user-name@gmail.com',
        'user+tag@gmail.com',
        '123user@gmail.com',
        'user123@gmail.com',
        'User.Name@gmail.com',
        'test_email_123+tag@gmail.com',
      ];

      it.each(validGmailAddresses)('should accept valid Gmail address: %s', email => {
        expect(AuthorizationService.isValidGmailAddress(email)).toBe(true);
      });
    });

    describe('Invalid Email Addresses', () => {
      const invalidEmails = [
        // Non-Gmail domains
        'user@yahoo.com',
        'user@outlook.com',
        'user@hotmail.com',
        'user@aol.com',
        'user@protonmail.com',
        'user@icloud.com',

        // Invalid Gmail formats
        'user@gmail.com.extra',
        'user@google.com',
        'user@gmai.com',
        'user@gmail.co',
        'user@.gmail.com',
        'user@gmail.com.',
        '@gmail.com',
        'user@',
        'user@ gmail.com',
        'user@gmail .com',
        '',
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

      it('should handle very long email addresses', () => {
        const longEmail = 'a'.repeat(64) + '@gmail.com'; // 64 chars before @ + @gmail.com
        expect(AuthorizationService.isValidGmailAddress(longEmail)).toBe(true);
      });

      it('should handle maximum allowed local part length', () => {
        // Gmail allows up to 64 characters before @
        const maxLocal = 'a'.repeat(64) + '@gmail.com';
        expect(AuthorizationService.isValidGmailAddress(maxLocal)).toBe(true);
      });
    });

    describe('Case Sensitivity', () => {
      it('should accept any case combination of gmail.com', () => {
        const cases = ['user@gmail.com', 'user@GMAIL.COM', 'user@Gmail.Com', 'user@gMail.cOm'];

        cases.forEach(email => {
          expect(AuthorizationService.isValidGmailAddress(email)).toBe(true);
        });
      });
    });

    describe('Special Characters', () => {
      it('should accept Gmail-supported special characters', () => {
        const specialChars = [
          'user+tag@gmail.com',
          'user-name@gmail.com',
          'user.name@gmail.com',
          'user_name@gmail.com',
          'user123@gmail.com',
          '123user@gmail.com',
        ];

        specialChars.forEach(email => {
          expect(AuthorizationService.isValidGmailAddress(email)).toBe(true);
        });
      });
    });
  });

  describe('Email Normalization', () => {
    it('should normalize email to lowercase and trim whitespace', () => {
      expect(AuthorizationService.normalizeEmail('  User@Gmail.COM  ')).toBe('user@gmail.com');
      expect(AuthorizationService.normalizeEmail('Test.Email+Tag@GMAIL.COM')).toBe(
        'test.email+tag@gmail.com'
      );
      expect(AuthorizationService.normalizeEmail('user@gmail.com')).toBe('user@gmail.com');
    });

    it('should handle edge cases in normalization', () => {
      expect(AuthorizationService.normalizeEmail('')).toBe('');
      expect(AuthorizationService.normalizeEmail('   ')).toBe('');
      expect(() => AuthorizationService.normalizeEmail(null as any)).not.toThrow();
    });
  });
});
