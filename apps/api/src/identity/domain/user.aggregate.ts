import { Email } from './email.value-object.js';
import { Credentials } from './credentials.value-object.js';

export class User {
  readonly id: string;
  readonly email: Email;
  readonly displayName: string;
  readonly credentials: Credentials;
  readonly createdAt: Date;

  constructor(
    id: string,
    email: Email,
    displayName: string,
    credentials: Credentials,
    createdAt: Date,
  ) {
    this.id = id;
    this.email = email;
    this.displayName = displayName;
    this.credentials = credentials;
    this.createdAt = createdAt;
  }

  static create(
    id: string,
    email: Email,
    displayName: string,
    credentials: Credentials,
  ): User {
    return new User(id, email, displayName, credentials, new Date());
  }
}
