export type Result<T, E = Error> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly kind = 'ok' as const;

  constructor(readonly value: T) {}

  isOk(): this is Ok<T> {
    return true;
  }

  isErr(): this is Err<never> {
    return false;
  }

  static ok<T>(value: T): Result<T> {
    return new Ok(value);
  }
}

export class Err<E> {
  readonly kind = 'err' as const;

  constructor(readonly error: E) {}

  isOk(): this is Ok<never> {
    return false;
  }

  isErr(): this is Err<E> {
    return true;
  }

  static err<E>(error: E): Result<never, E> {
    return new Err(error);
  }
}

export function ok<T>(value: T): Result<T> {
  return new Ok(value);
}

export function err<E>(error: E): Result<never, E> {
  return new Err(error);
}
