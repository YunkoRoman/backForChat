import { describe, it, expect } from 'vitest';
import { Conversation } from './conversation.aggregate.js';
import {
  InvalidConversationTypeError,
  GroupMustHaveAtLeastTwoMembersError,
  OneToOneConversationMustHaveExactlyTwoMembersError,
  OneToOneConversationCannotHaveNameError,
} from './errors.js';

describe('Conversation Aggregate', () => {
  describe('1:1 conversation creation', () => {
    it('should create a 1:1 conversation with exactly 2 members', () => {
      const conv = Conversation.createOneToOne(
        'conv-1',
        'user-1',
        'user-2',
        'user-1',
      );

      expect(conv.type).toBe('1:1');
      expect(conv.memberIds).toEqual(['user-1', 'user-2']);
      expect(conv.name).toBeNull();
      expect(conv.isMember('user-1')).toBe(true);
      expect(conv.isMember('user-2')).toBe(true);
    });

    it('should reject a 1:1 conversation with fewer than 2 members', () => {
      expect(() => {
        new Conversation(
          'conv-1',
          '1:1',
          ['user-1'],
          'user-1',
          new Date(),
        );
      }).toThrow(OneToOneConversationMustHaveExactlyTwoMembersError);
    });

    it('should reject a 1:1 conversation with more than 2 members', () => {
      expect(() => {
        new Conversation(
          'conv-1',
          '1:1',
          ['user-1', 'user-2', 'user-3'],
          'user-1',
          new Date(),
        );
      }).toThrow(OneToOneConversationMustHaveExactlyTwoMembersError);
    });

    it('should reject a 1:1 conversation with a name', () => {
      expect(() => {
        new Conversation(
          'conv-1',
          '1:1',
          ['user-1', 'user-2'],
          'user-1',
          new Date(),
          'My Conversation',
        );
      }).toThrow(OneToOneConversationCannotHaveNameError);
    });
  });

  describe('group conversation creation', () => {
    it('should create a group conversation with 2+ members and a name', () => {
      const conv = Conversation.createGroup(
        'conv-1',
        'Project Team',
        ['user-1', 'user-2', 'user-3'],
        'user-1',
      );

      expect(conv.type).toBe('group');
      expect(conv.name).toBe('Project Team');
      expect(conv.memberIds).toEqual(['user-1', 'user-2', 'user-3']);
      expect(conv.createdBy).toBe('user-1');
    });

    it('should reject a group with fewer than 2 total members', () => {
      expect(() => {
        Conversation.createGroup('conv-1', 'Solo Group', ['user-1'], 'user-1');
      }).toThrow(GroupMustHaveAtLeastTwoMembersError);
    });

    it('should create a group with exactly 2 members', () => {
      const conv = Conversation.createGroup(
        'conv-1',
        'Two-person group',
        ['user-1', 'user-2'],
        'user-1',
      );

      expect(conv.type).toBe('group');
      expect(conv.memberIds).toEqual(['user-1', 'user-2']);
    });
  });

  describe('membership checks', () => {
    it('should correctly identify members', () => {
      const conv = Conversation.createGroup(
        'conv-1',
        'Team',
        ['user-1', 'user-2'],
        'user-1',
      );

      expect(conv.isMember('user-1')).toBe(true);
      expect(conv.isMember('user-2')).toBe(true);
      expect(conv.isMember('user-3')).toBe(false);
    });
  });

  describe('add member to group', () => {
    it('should add a new member to a group conversation', () => {
      const conv = Conversation.createGroup(
        'conv-1',
        'Team',
        ['user-1', 'user-2'],
        'user-1',
      );

      conv.addMember('user-3');

      expect(conv.memberIds).toEqual(['user-1', 'user-2', 'user-3']);
      expect(conv.isMember('user-3')).toBe(true);
    });

    it('should not duplicate a member that is already in the conversation', () => {
      const conv = Conversation.createGroup(
        'conv-1',
        'Team',
        ['user-1', 'user-2'],
        'user-1',
      );

      conv.addMember('user-1');

      expect(conv.memberIds).toEqual(['user-1', 'user-2']);
    });
  });

  describe('invalid conversation type', () => {
    it('should reject an invalid conversation type', () => {
      expect(() => {
        new Conversation(
          'conv-1',
          'invalid' as any,
          ['user-1', 'user-2'],
          'user-1',
          new Date(),
        );
      }).toThrow(InvalidConversationTypeError);
    });
  });
});
