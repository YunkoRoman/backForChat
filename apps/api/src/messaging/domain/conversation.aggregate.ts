import {
  InvalidConversationTypeError,
  GroupMustHaveAtLeastTwoMembersError,
  OneToOneConversationMustHaveExactlyTwoMembersError,
  OneToOneConversationCannotHaveNameError,
} from './errors.js';

export type ConversationType = '1:1' | 'group';

export class Conversation {
  readonly id: string;
  readonly type: ConversationType;
  readonly name: string | null; // only for group conversations
  readonly memberIds: string[];
  readonly createdBy: string;
  readonly createdAt: Date;

  constructor(
    id: string,
    type: ConversationType,
    memberIds: string[],
    createdBy: string,
    createdAt: Date,
    name?: string | null,
  ) {
    // Validate type
    if (type !== '1:1' && type !== 'group') {
      throw new InvalidConversationTypeError(type);
    }

    // Validate member count and name based on type
    if (type === '1:1') {
      if (memberIds.length !== 2) {
        throw new OneToOneConversationMustHaveExactlyTwoMembersError();
      }
      if (name) {
        throw new OneToOneConversationCannotHaveNameError();
      }
    }

    if (type === 'group') {
      if (memberIds.length < 2) {
        throw new GroupMustHaveAtLeastTwoMembersError();
      }
    }

    this.id = id;
    this.type = type;
    this.name = name || null;
    this.memberIds = memberIds;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
  }

  static createOneToOne(
    id: string,
    userIdA: string,
    userIdB: string,
    createdBy: string,
  ): Conversation {
    return new Conversation(
      id,
      '1:1',
      [userIdA, userIdB],
      createdBy,
      new Date(),
      null,
    );
  }

  static createGroup(
    id: string,
    name: string,
    memberIds: string[],
    createdBy: string,
  ): Conversation {
    return new Conversation(
      id,
      'group',
      memberIds,
      createdBy,
      new Date(),
      name,
    );
  }

  isMember(userId: string): boolean {
    return this.memberIds.includes(userId);
  }

  addMember(userId: string): void {
    if (!this.memberIds.includes(userId)) {
      this.memberIds.push(userId);
    }
  }
}
