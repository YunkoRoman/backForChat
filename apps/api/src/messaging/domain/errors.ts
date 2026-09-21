import { DomainError } from '../../shared-kernel/domain-error.js';

export class InvalidConversationTypeError extends DomainError {
  constructor(type: string) {
    super(`Invalid conversation type: ${type}. Must be '1:1' or 'group'.`);
    this.name = 'InvalidConversationTypeError';
    Object.setPrototypeOf(this, InvalidConversationTypeError.prototype);
  }
}

export class GroupMustHaveAtLeastTwoMembersError extends DomainError {
  constructor() {
    super('Group conversation must have at least 2 members total (including creator).');
    this.name = 'GroupMustHaveAtLeastTwoMembersError';
    Object.setPrototypeOf(this, GroupMustHaveAtLeastTwoMembersError.prototype);
  }
}

export class OneToOneConversationMustHaveExactlyTwoMembersError extends DomainError {
  constructor() {
    super('1:1 conversation must have exactly 2 members.');
    this.name = 'OneToOneConversationMustHaveExactlyTwoMembersError';
    Object.setPrototypeOf(this, OneToOneConversationMustHaveExactlyTwoMembersError.prototype);
  }
}

export class OneToOneConversationCannotHaveNameError extends DomainError {
  constructor() {
    super('1:1 conversation cannot have a name.');
    this.name = 'OneToOneConversationCannotHaveNameError';
    Object.setPrototypeOf(this, OneToOneConversationCannotHaveNameError.prototype);
  }
}

export class EmptyMessageError extends DomainError {
  constructor() {
    super('Message text cannot be empty.');
    this.name = 'EmptyMessageError';
    Object.setPrototypeOf(this, EmptyMessageError.prototype);
  }
}

export class MessageTooLongError extends DomainError {
  constructor(maxLength: number) {
    super(`Message text cannot exceed ${maxLength} characters.`);
    this.name = 'MessageTooLongError';
    Object.setPrototypeOf(this, MessageTooLongError.prototype);
  }
}

export class RequesterNotAMemberError extends DomainError {
  constructor() {
    super('Requester is not a member of this conversation.');
    this.name = 'RequesterNotAMemberError';
    Object.setPrototypeOf(this, RequesterNotAMemberError.prototype);
  }
}

export class CannotAddMemberToOneToOneConversationError extends DomainError {
  constructor() {
    super('Cannot add members to a 1:1 conversation.');
    this.name = 'CannotAddMemberToOneToOneConversationError';
    Object.setPrototypeOf(this, CannotAddMemberToOneToOneConversationError.prototype);
  }
}
