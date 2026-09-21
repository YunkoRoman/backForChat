import { describe, it, expect } from 'vitest';
import { Message } from './message.entity.js';
import { EmptyMessageError, MessageTooLongError } from './errors.js';

describe('Message Entity', () => {
  describe('message creation', () => {
    it('should create a valid message', () => {
      const msg = Message.create(
        'msg-1',
        'conv-1',
        'user-1',
        'Hello, world!',
      );

      expect(msg.id).toBe('msg-1');
      expect(msg.conversationId).toBe('conv-1');
      expect(msg.senderId).toBe('user-1');
      expect(msg.text).toBe('Hello, world!');
      expect(msg.createdAt).toBeDefined();
    });

    it('should create a message at maximum allowed length', () => {
      const maxText = 'a'.repeat(Message.MAX_LENGTH);
      const msg = Message.create('msg-1', 'conv-1', 'user-1', maxText);

      expect(msg.text.length).toBe(Message.MAX_LENGTH);
    });
  });

  describe('empty message rejection', () => {
    it('should reject an empty string message', () => {
      expect(() => {
        Message.create('msg-1', 'conv-1', 'user-1', '');
      }).toThrow(EmptyMessageError);
    });

    it('should reject a whitespace-only message', () => {
      expect(() => {
        Message.create('msg-1', 'conv-1', 'user-1', '   ');
      }).toThrow(EmptyMessageError);
    });

    it('should reject a newline-only message', () => {
      expect(() => {
        Message.create('msg-1', 'conv-1', 'user-1', '\n\n\n');
      }).toThrow(EmptyMessageError);
    });
  });

  describe('message length validation', () => {
    it('should reject a message that exceeds the maximum length', () => {
      const tooLongText = 'a'.repeat(Message.MAX_LENGTH + 1);

      expect(() => {
        Message.create('msg-1', 'conv-1', 'user-1', tooLongText);
      }).toThrow(MessageTooLongError);
    });

    it('should accept a message just under the limit', () => {
      const text = 'a'.repeat(Message.MAX_LENGTH - 1);
      const msg = Message.create('msg-1', 'conv-1', 'user-1', text);

      expect(msg.text.length).toBe(Message.MAX_LENGTH - 1);
    });
  });

  describe('edge cases', () => {
    it('should accept a single character message', () => {
      const msg = Message.create('msg-1', 'conv-1', 'user-1', 'a');

      expect(msg.text).toBe('a');
    });

    it('should accept a message with special characters', () => {
      const text = '😀 Hello! 👋 🌟 (test@example.com)';
      const msg = Message.create('msg-1', 'conv-1', 'user-1', text);

      expect(msg.text).toBe(text);
    });

    it('should accept a message with newlines in the middle', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const msg = Message.create('msg-1', 'conv-1', 'user-1', text);

      expect(msg.text).toBe(text);
    });
  });
});
